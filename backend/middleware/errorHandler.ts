/**
 * Error Handling Middleware
 * Centralized error handling with proper logging and response formatting
 */

import { Request, Response, NextFunction } from 'express';
import { logger, sanitizeLogInput } from '../../shared/utils';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', code: string = 'AUTH_REQUIRED') {
    super(message, 401, code);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests',
    code: string = 'RATE_LIMIT_EXCEEDED',
    retryAfter?: number
  ) {
    super(message, 429, code);
  }
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';

  // Handle known operational errors
  if (err instanceof AppError) {
    logger.warn('Operational error', {
      requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const zodError = err as any;
    logger.warn('Validation error', {
      requestId,
      errors: zodError.errors,
      path: req.path,
      method: req.method,
    });

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: zodError.errors.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      requestId,
    });
    return;
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn('JSON parse error', {
      requestId,
      message: err.message,
    });

    res.status(400).json({
      success: false,
      error: 'Invalid JSON',
      code: 'INVALID_JSON',
      requestId,
    });
    return;
  }

  // Handle unexpected errors
  logger.error('Unexpected error', {
    requestId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: sanitizeLogInput(JSON.stringify(req.body)),
    query: sanitizeLogInput(JSON.stringify(req.query)),
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_ERROR',
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Async handler wrapper to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = (req as any).requestId || 'unknown';

  logger.info('404 Not Found', {
    requestId,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    requestId,
  });
}

/**
 * Log uncaught exceptions
 */
export function setupUncaughtExceptionHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', {
      message: error.message,
      stack: error.stack,
    });

    // Give time for logging, then exit
    setTimeout(() => process.exit(1), 1000).unref();
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled promise rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });
  });
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(server: any): void {
  const shutdown = (signal: string) => async () => {
    logger.info(`${signal} received, starting graceful shutdown`);

    // Close server
    server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connections
      try {
        const prisma = (global as any).prisma;
        if (prisma) {
          await prisma.$disconnect();
          logger.info('Database connections closed');
        }
      } catch (error) {
        logger.error('Error closing database', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Close WebSocket connections
      try {
        const wsManager = (global as any).wsManager;
        if (wsManager) {
          wsManager.shutdown();
          logger.info('WebSocket connections closed');
        }
      } catch (error) {
        logger.error('Error closing WebSockets', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
}
