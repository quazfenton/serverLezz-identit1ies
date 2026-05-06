// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — System Routes
// Health Checks • Metrics • System Status
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errors';
import { createMonitoringSystem, BusinessMetrics } from '../middleware/health';
import { logger } from '../middleware';

const router = Router();

// Create monitoring system
const monitoring = createMonitoringSystem();
const { healthCheckManager, metricsCollector } = monitoring;

// Register database health check (will be set by server)
healthCheckManager.registerCheck('database', async () => {
  try {
    const checkFn = (global as any).databaseHealthCheck;
    if (!checkFn) {
      return {
        name: 'database',
        status: 'degraded' as const,
        message: 'Database not configured',
        latency: 0,
      };
    }

    const startTime = Date.now();
    await checkFn();
    const latency = Date.now() - startTime;

    return {
      name: 'database',
      status: 'healthy' as const,
      message: 'Database connected',
      latency,
      details: { latencyMs: latency },
    };
  } catch (error: any) {
    return {
      name: 'database',
      status: 'unhealthy' as const,
      message: error.message || 'Database connection failed',
      latency: 0,
    };
  }
});

const handlers = monitoring.createHealthCheckHandlers();

/**
 * GET /api/system/health
 * Basic health check - for load balancers
 */
router.get(
  '/health',
  asyncHandler(handlers.healthHandler)
);

/**
 * GET /api/system/health/detailed
 * Detailed health check - for monitoring systems
 */
router.get(
  '/health/detailed',
  asyncHandler(handlers.healthDetailedHandler)
);

/**
 * GET /api/system/metrics
 * Application metrics
 */
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const businessMetricsFn = (global as any).businessMetricsFn as () => Promise<BusinessMetrics>;
    const metrics = await metricsCollector.getMetrics(businessMetricsFn);
    res.json(metrics);
  })
);

/**
 * GET /api/system/ready
 * Readiness probe - is the service ready to receive traffic?
 */
router.get(
  '/ready',
  asyncHandler(handlers.readyHandler)
);

/**
 * GET /api/system/live
 * Liveness probe - is the service alive?
 */
router.get(
  '/live',
  asyncHandler(handlers.liveHandler)
);

/**
 * GET /api/system/info
 * System information
 */
router.get(
  '/info',
  asyncHandler(async (req: Request, res: Response) => {
    const uptime = healthCheckManager.getUptime();
    
    res.json({
      success: true,
      info: {
        version: process.env.npm_package_version || '2.0.0',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        uptime,
        uptimeFormatted: formatUptime(uptime),
      },
    });
  })
);

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '< 1m';
}

// Export monitoring components for server use
export { monitoring, healthCheckManager, metricsCollector };

export default router;
