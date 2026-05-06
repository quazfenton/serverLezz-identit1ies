// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Middleware Stack
// Security • Validation • Logging • Rate Limiting • Error Handling
// ═══════════════════════════════════════════════════════════════════════════════

import { logger, logSecurityEvent, requestLogger } from "../../shared/utils/logger";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import sanitizeHtml from "sanitize-html";
import type { Request, Response, NextFunction } from "express";
import type http from "http";

export * from "./auth";
export { logger, logSecurityEvent, requestLogger };

// ═══════════════════════════════════════════════════════════════════════════════
// CORS Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export const corsMiddleware = cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173", "http://localhost:3003"],
  credentials: process.env.CORS_CREDENTIALS !== "false",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Session-ID", "X-Request-ID"],
  exposedHeaders: ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
  maxAge: 600 // 10 minutes
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helmet Security Headers
// ═══════════════════════════════════════════════════════════════════════════════

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://api.dicebear.com"],
      connectSrc: ["'self'", "https://api.openai.com", "https://api.anthropic.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiting
// ═══════════════════════════════════════════════════════════════════════════════

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 100,
  message: { 
    error: "Too many requests", 
    message: "Rate limit exceeded. Please try again later.",
    retryAfter: Math.ceil((Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.get("x-forwarded-for") || "unknown";
  },
  handler: (req: Request, res: Response) => {
    logSecurityEvent("rate_limit_exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later."
    });
  }
});

// Stricter limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 5,
  message: { 
    error: "Too many authentication attempts",
    message: "Please try again after 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for creation endpoints (profiles, listings)
export const createLimiter = rateLimit({
  windowMs: Number(process.env.CREATE_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.CREATE_RATE_LIMIT_MAX) || 10,
  message: { 
    error: "Too many creation attempts",
    message: "Please try again after 1 hour."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ═══════════════════════════════════════════════════════════════════════════════
// Input Sanitization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recursively sanitizes input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: any): any {
  if (typeof input === "string") {
    // Remove HTML tags and trim whitespace
    const sanitized = sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {}
    }).trim();
    
    // Prevent null byte injection
    return sanitized.replace(/\0/g, "");
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Prevent prototype pollution
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Sanitization middleware - applies to all POST/PUT/PATCH requests
 */
export function sanitizeAll(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query) as any;
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Request Timeout
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wraps a promise with a timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = Number(process.env.REQUEST_TIMEOUT_MS) || 10000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      });
    })
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error Handler
// ═══════════════════════════════════════════════════════════════════════════════

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req as any).requestId;

  // Log error
  logger.error("Error occurred", {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Handle AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId
    });
  }

  // Handle validation errors
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "Validation failed",
      details: err.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`),
      requestId
    });
  }

  // Handle generic errors
  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: isProduction ? "Internal server error" : err.message,
    code: "INTERNAL_ERROR",
    requestId
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Not Found Handler
// ═══════════════════════════════════════════════════════════════════════════════

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({
    error: "Not found",
    message: `Cannot ${req.method} ${req.path}`,
    requestId: (req as any).requestId
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Uncaught Exception Handlers
// ═══════════════════════════════════════════════════════════════════════════════

export function setupUncaughtExceptionHandlers() {
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", {
      error: error.message,
      stack: error.stack
    });
    // Don't exit - let the process continue
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled rejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
    // Don't exit - let the process continue
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Graceful Shutdown
// ═══════════════════════════════════════════════════════════════════════════════

export function setupGracefulShutdown(server: http.Server) {
  const shutdownTimeout = Number(process.env.SHUTDOWN_TIMEOUT) || 30000;

  async function gracefulShutdown(signal: string) {
    logger.info(`Graceful shutdown initiated (${signal})`);

    // Stop accepting new connections
    server.close(() => {
      logger.info("HTTP server closed");
    });

    // Force close after timeout
    setTimeout(() => {
      logger.error("Forced shutdown due to timeout");
      process.exit(1);
    }, shutdownTimeout);

    // Close database connections, WebSocket connections, etc.
    try {
      // Add cleanup logic here
      logger.info("Cleanup completed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during cleanup", { error });
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket Manager
// ═══════════════════════════════════════════════════════════════════════════════

interface WebSocketManagerOptions {
  maxConnectionsPerIp: number;
  rateLimitWindow: number;
  rateLimitMax: number;
}

export class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private connectionCounts: Map<string, number> = new Map();
  private messageCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private options: WebSocketManagerOptions;

  constructor(options: WebSocketManagerOptions) {
    this.options = options;
  }

  addConnection(id: string, ws: WebSocket, ip: string): boolean {
    // Check connection limit per IP
    const currentCount = this.connectionCounts.get(ip) || 0;
    if (currentCount >= this.options.maxConnectionsPerIp) {
      logger.warn("WebSocket connection limit exceeded for IP", { ip });
      return false;
    }

    this.connections.set(id, ws);
    this.connectionCounts.set(ip, currentCount + 1);
    return true;
  }

  removeConnection(id: string, ip: string) {
    this.connections.delete(id);
    const currentCount = this.connectionCounts.get(ip) || 0;
    this.connectionCounts.set(ip, Math.max(0, currentCount - 1));
  }

  checkMessageRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = this.messageCounts.get(ip);

    if (!record || now > record.resetTime) {
      this.messageCounts.set(ip, {
        count: 1,
        resetTime: now + this.options.rateLimitWindow
      });
      return true;
    }

    if (record.count >= this.options.rateLimitMax) {
      return false;
    }

    record.count++;
    return true;
  }

  broadcast(message: any, excludeId?: string) {
    const str = JSON.stringify(message);
    this.connections.forEach((ws, id) => {
      if (id === excludeId) return;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(str);
        } catch (error) {
          logger.error("Error broadcasting to WebSocket", { id, error });
        }
      }
    });
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Authentication Middleware (Legacy - use auth.ts for full JWT auth)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use authenticateToken from './auth' instead
 * This is a legacy middleware for session-based auth.
 * New code should use the JWT-based authenticateToken from auth.ts
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Legacy session-based auth - use JWT auth from auth.ts for new code
  const sessionId = req.headers["session-id"] as string;

  if (!sessionId) {
    return res.status(401).json({
      error: "Authentication required",
      message: "Please provide a session-id header or use Bearer token"
    });
  }

  // Session validation happens in route handlers
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  logger,
  logSecurityEvent,
  requestLogger,
  corsMiddleware,
  helmetMiddleware,
  apiLimiter,
  authLimiter,
  createLimiter,
  sanitizeAll,
  withTimeout,
  errorHandler,
  notFoundHandler,
  setupUncaughtExceptionHandlers,
  setupGracefulShutdown,
  WebSocketManager,
  authenticateToken
};
