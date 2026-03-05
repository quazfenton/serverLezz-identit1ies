// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Health Checks & Monitoring
// Comprehensive Health Monitoring • Metrics Collection • System Status
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from "express";
import { logger } from "../middleware";

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: Date;
  uptime: number;
  version: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  message?: string;
  latency?: number;
  details?: any;
}

export interface Metrics {
  system: SystemMetrics;
  application: ApplicationMetrics;
  business: BusinessMetrics;
  timestamp: Date;
}

export interface SystemMetrics {
  memory: MemoryMetrics;
  cpu: CPUMetrics;
  eventLoop: EventLoopMetrics;
}

export interface MemoryMetrics {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  heapUtilization: number;
}

export interface CPUMetrics {
  usage: number;
  load1: number;
  load5: number;
  load15: number;
}

export interface EventLoopMetrics {
  latency: number;
  delay: number;
}

export interface ApplicationMetrics {
  requests: RequestMetrics;
  websocket: WebSocketMetrics;
  errors: ErrorMetrics;
}

export interface RequestMetrics {
  total: number;
  active: number;
  rate: number; // requests per second
  avgResponseTime: number;
}

export interface WebSocketMetrics {
  connections: number;
  messagesPerSecond: number;
}

export interface ErrorMetrics {
  total: number;
  rate: number; // errors per second
  recent: ErrorInfo[];
}

export interface ErrorInfo {
  message: string;
  timestamp: Date;
  path?: string;
}

export interface BusinessMetrics {
  users: UserMetrics;
  listings: ListingMetrics;
  coordination: CoordinationMetrics;
}

export interface UserMetrics {
  total: number;
  active: number;
  newToday: number;
}

export interface ListingMetrics {
  total: number;
  active: number;
  newToday: number;
}

export interface CoordinationMetrics {
  activeCoordinations: number;
  successfulMatches: number;
  averageMatchScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check Manager
// ═══════════════════════════════════════════════════════════════════════════════

export class HealthCheckManager {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // Memory check
    this.registerCheck("memory", async () => {
      const mem = process.memoryUsage();
      const heapUtilization = mem.heapUsed / mem.heapTotal;

      let status: HealthCheck["status"] = "healthy";
      let message = "Memory usage normal";

      if (heapUtilization > 0.9) {
        status = "unhealthy";
        message = "Critical memory usage (>90%)";
      } else if (heapUtilization > 0.75) {
        status = "degraded";
        message = "High memory usage (>75%)";
      }

      return {
        name: "memory",
        status,
        message,
        latency: 0,
        details: {
          rss: mem.rss,
          heapTotal: mem.heapTotal,
          heapUsed: mem.heapUsed,
          heapUtilization: Math.round(heapUtilization * 100) / 100,
        },
      };
    });

    // Event loop latency check
    this.registerCheck("event_loop", async () => {
      const latency = await this.measureEventLoopLatency();

      let status: HealthCheck["status"] = "healthy";
      let message = "Event loop responsive";

      if (latency > 500) {
        status = "unhealthy";
        message = "Event loop blocked (>500ms)";
      } else if (latency > 100) {
        status = "degraded";
        message = "Event loop slow (>100ms)";
      }

      return {
        name: "event_loop",
        status,
        message,
        latency,
        details: { latencyMs: latency },
      };
    });

    // Database check (if available)
    this.registerCheck("database", async () => {
      try {
        const startTime = Date.now();
        // Database check will be injected by the server
        const checkFn = (global as any).databaseHealthCheck;
        if (!checkFn) {
          return {
            name: "database",
            status: "degraded" as const,
            message: "Database not configured",
            latency: 0,
          };
        }

        await checkFn();
        const latency = Date.now() - startTime;

        return {
          name: "database",
          status: "healthy" as const,
          message: "Database connected",
          latency,
          details: { latencyMs: latency },
        };
      } catch (error: any) {
        return {
          name: "database",
          status: "unhealthy" as const,
          message: error.message || "Database connection failed",
          latency: 0,
        };
      }
    });

    // External API check (optional)
    this.registerCheck("external_apis", async () => {
      const apiKeys = {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        google: !!process.env.GOOGLE_AI_KEY,
      };

      const configured = Object.values(apiKeys).some((v) => v);
      const message = configured
        ? "External APIs configured"
        : "No external APIs configured";

      return {
        name: "external_apis",
        status: configured ? "healthy" : "degraded",
        message,
        details: apiKeys,
      };
    });
  }

  private async measureEventLoopLatency(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const end = process.hrtime.bigint();
        const latency = Number(end - start) / 1e6; // Convert to ms
        resolve(Math.round(latency * 100) / 100);
      });
    });
  }

  public registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
  }

  public async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    let overallStatus: HealthStatus["status"] = "healthy";

    for (const [name, checkFn] of this.checks.entries()) {
      try {
        const check = await checkFn();
        checks.push(check);

        if (check.status === "unhealthy") {
          overallStatus = "unhealthy";
        } else if (check.status === "degraded" && overallStatus !== "unhealthy") {
          overallStatus = "degraded";
        }
      } catch (error: any) {
        checks.push({
          name,
          status: "unhealthy",
          message: error.message || "Check failed",
          latency: 0,
        });
        overallStatus = "unhealthy";
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || "1.0.0",
      checks,
    };
  }

  public getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metrics Collector
// ═══════════════════════════════════════════════════════════════════════════════

export class MetricsCollector {
  private requestCount = 0;
  private activeRequests = 0;
  private errorCount = 0;
  private responseTimes: number[] = [];
  private recentErrors: ErrorInfo[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();

    // Cleanup old response times periodically
    setInterval(() => {
      this.responseTimes = this.responseTimes.slice(-1000); // Keep last 1000
      this.recentErrors = this.recentErrors.slice(-100); // Keep last 100
    }, 60000);
  }

  public recordRequest(responseTime: number): void {
    this.requestCount++;
    this.activeRequests--;
    this.responseTimes.push(responseTime);
  }

  public startRequest(): void {
    this.activeRequests++;
  }

  public recordError(message: string, path?: string): void {
    this.errorCount++;
    this.recentErrors.push({
      message,
      timestamp: new Date(),
      path,
    });
  }

  public async getMetrics(
    businessMetricsFn?: () => Promise<BusinessMetrics>
  ): Promise<Metrics> {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const uptimeSeconds = Math.max(1, uptime);

    // System metrics
    const mem = process.memoryUsage();
    const system: SystemMetrics = {
      memory: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
        heapUtilization: Math.round((mem.heapUsed / mem.heapTotal) * 100) / 100,
      },
      cpu: {
        usage: process.cpuUsage ? process.cpuUsage().user / 1e6 : 0,
        load1: 0, // Would need os module
        load5: 0,
        load15: 0,
      },
      eventLoop: {
        latency: 0, // Would need measurement
        delay: 0,
      },
    };

    // Application metrics
    const avgResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
        : 0;

    const application: ApplicationMetrics = {
      requests: {
        total: this.requestCount,
        active: this.activeRequests,
        rate: Math.round((this.requestCount / uptimeSeconds) * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      },
      websocket: {
        connections: (global as any).wsConnectionCount || 0,
        messagesPerSecond: (global as any).wsMessagesPerSecond || 0,
      },
      errors: {
        total: this.errorCount,
        rate: Math.round((this.errorCount / uptimeSeconds) * 100) / 100,
        recent: this.recentErrors,
      },
    };

    // Business metrics
    const business: BusinessMetrics = businessMetricsFn
      ? await businessMetricsFn()
      : {
          users: { total: 0, active: 0, newToday: 0 },
          listings: { total: 0, active: 0, newToday: 0 },
          coordination: {
            activeCoordinations: 0,
            successfulMatches: 0,
            averageMatchScore: 0,
          },
        };

    return {
      system,
      application,
      business,
      timestamp: new Date(),
    };
  }

  public reset(): void {
    this.requestCount = 0;
    this.activeRequests = 0;
    this.errorCount = 0;
    this.responseTimes = [];
    this.recentErrors = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check Routes Handler
// ═══════════════════════════════════════════════════════════════════════════════

export function createHealthCheckHandlers(
  healthCheckManager: HealthCheckManager,
  metricsCollector: MetricsCollector,
  businessMetricsFn?: () => Promise<BusinessMetrics>
) {
  /**
   * GET /health
   * Basic health check - for load balancers
   */
  async function healthHandler(req: Request, res: Response): Promise<void> {
    const status = await healthCheckManager.getHealthStatus();

    if (status.status === "unhealthy") {
      res.status(503).json({
        status: status.status,
        timestamp: status.timestamp,
      });
      return;
    }

    res.status(200).json({
      status: status.status,
      timestamp: status.timestamp,
    });
  }

  /**
   * GET /health/detailed
   * Detailed health check - for monitoring systems
   */
  async function healthDetailedHandler(
    req: Request,
    res: Response
  ): Promise<void> {
    const status = await healthCheckManager.getHealthStatus();

    if (status.status === "unhealthy") {
      res.status(503).json(status);
      return;
    }

    res.status(200).json(status);
  }

  /**
   * GET /metrics
   * Prometheus-style metrics
   */
  async function metricsHandler(req: Request, res: Response): Promise<void> {
    const metrics = await metricsCollector.getMetrics(businessMetricsFn);

    res.status(200).json(metrics);
  }

  /**
   * GET /ready
   * Readiness probe - is the service ready to receive traffic?
   */
  async function readyHandler(req: Request, res: Response): Promise<void> {
    const status = await healthCheckManager.getHealthStatus();

    // Check if database is healthy (critical for readiness)
    const dbCheck = status.checks.find((c) => c.name === "database");
    const isDbHealthy =
      dbCheck && (dbCheck.status === "healthy" || dbCheck.status === "degraded");

    if (!isDbHealthy) {
      res.status(503).json({
        status: "not_ready",
        reason: "Database not ready",
        timestamp: new Date(),
      });
      return;
    }

    res.status(200).json({
      status: "ready",
      timestamp: new Date(),
    });
  }

  /**
   * GET /live
   * Liveness probe - is the service alive?
   */
  async function liveHandler(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: "alive",
      timestamp: new Date(),
    });
  }

  return {
    healthHandler,
    healthDetailedHandler,
    metricsHandler,
    readyHandler,
    liveHandler,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request Timing Middleware
// ═══════════════════════════════════════════════════════════════════════════════

export function requestTimingMiddleware(
  metricsCollector: MetricsCollector
) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    metricsCollector.startRequest();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      metricsCollector.recordRequest(duration);
    });

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export function createMonitoringSystem() {
  const healthCheckManager = new HealthCheckManager();
  const metricsCollector = new MetricsCollector();

  return {
    healthCheckManager,
    metricsCollector,
    createHealthCheckHandlers: () =>
      createHealthCheckHandlers(healthCheckManager, metricsCollector),
    requestTimingMiddleware: () => requestTimingMiddleware(metricsCollector),
  };
}

export default {
  HealthCheckManager,
  MetricsCollector,
  createHealthCheckHandlers,
  requestTimingMiddleware,
  createMonitoringSystem,
};
