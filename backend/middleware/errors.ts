// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Error Handling
// Custom Error Classes • Error Hierarchy • Standardized Error Responses
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from "express";

// ═══════════════════════════════════════════════════════════════════════════════
// Base Application Error
// ═══════════════════════════════════════════════════════════════════════════════

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: any;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: any,
    requestId?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    this.requestId = requestId;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      requestId: this.requestId,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Client Errors (4xx)
// ═══════════════════════════════════════════════════════════════════════════════

export class BadRequestError extends AppError {
  constructor(message: string = "Bad request", details?: any, requestId?: string) {
    super(message, 400, "BAD_REQUEST", details, requestId);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", details?: any, requestId?: string) {
    super(message, 401, "UNAUTHORIZED", details, requestId);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", details?: any, requestId?: string) {
    super(message, 403, "FORBIDDEN", details, requestId);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", details?: any, requestId?: string) {
    super(message, 404, "NOT_FOUND", details, requestId);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict", details?: any, requestId?: string) {
    super(message, 409, "CONFLICT", details, requestId);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = "Too many requests", details?: any, requestId?: string) {
    super(message, 429, "TOO_MANY_REQUESTS", details, requestId);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", details?: any, requestId?: string) {
    super(message, 400, "VALIDATION_ERROR", details, requestId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Server Errors (5xx)
// ═══════════════════════════════════════════════════════════════════════════════

export class InternalError extends AppError {
  constructor(message: string = "Internal server error", details?: any, requestId?: string) {
    super(message, 500, "INTERNAL_ERROR", details, requestId);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = "Database error", details?: any, requestId?: string) {
    super(message, 500, "DATABASE_ERROR", details, requestId);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = "External service error", details?: any, requestId?: string) {
    super(message, 503, "EXTERNAL_SERVICE_ERROR", details, requestId);
  }
}

export class TimeoutError extends AppError {
  constructor(message: string = "Request timeout", details?: any, requestId?: string) {
    super(message, 504, "TIMEOUT_ERROR", details, requestId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Domain-Specific Errors
// ═══════════════════════════════════════════════════════════════════════════════

export class ProfileNotFoundError extends NotFoundError {
  constructor(profileId: string, requestId?: string) {
    super(`Profile not found: ${profileId}`, { profileId }, requestId);
  }
}

export class ListingNotFoundError extends NotFoundError {
  constructor(listingId: string, requestId?: string) {
    super(`Listing not found: ${listingId}`, { listingId }, requestId);
  }
}

export class ProfileAlreadyExistsError extends ConflictError {
  constructor(identifier: string, requestId?: string) {
    super(`Profile already exists: ${identifier}`, { identifier }, requestId);
  }
}

export class InvalidCredentialsError extends UnauthorizedError {
  constructor(requestId?: string) {
    super("Invalid email or password", undefined, requestId);
  }
}

export class SessionExpiredError extends UnauthorizedError {
  constructor(requestId?: string) {
    super("Session has expired", undefined, requestId);
  }
}

export class InsufficientPermissionsError extends ForbiddenError {
  constructor(resource: string, requestId?: string) {
    super(`Insufficient permissions to access ${resource}`, { resource }, requestId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error Handler Middleware
// ═══════════════════════════════════════════════════════════════════════════════

import { logger, logSecurityEvent } from "./index";
import { sanitizeObjectForLogging } from "./auth";

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as any).requestId || "unknown";

  // Log error with sanitized data
  const sanitizedError = {
    message: err.message,
    stack: err.stack,
    name: err.name,
    ...(err instanceof AppError && {
      code: err.code,
      statusCode: err.statusCode,
      details: sanitizeObjectForLogging(err.details),
    }),
  };

  if (err instanceof AppError && err.isOperational) {
    logger.warn("Operational error", {
      requestId,
      ...sanitizedError,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error("Unhandled error", {
      requestId,
      ...sanitizedError,
      path: req.path,
      method: req.method,
    });
  }

  // Handle AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId,
      ...(process.env.NODE_ENV !== "production" && {
        stack: err.stack,
        details: err.details,
      }),
    });
    return;
  }

  // Handle validation errors (Zod, etc.)
  if (err.name === "ZodError") {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      requestId,
      details: (err as any).errors?.map((e: any) => ({
        field: e.path?.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // Handle generic errors
  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: isProduction ? "Internal server error" : err.message,
    code: "INTERNAL_ERROR",
    requestId,
    ...(process.env.NODE_ENV !== "production" && {
      stack: err.stack,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Not Found Handler
// ═══════════════════════════════════════════════════════════════════════════════

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json({
    error: "Resource not found",
    code: "NOT_FOUND",
    message: `Cannot ${req.method} ${req.path}`,
    requestId: (req as any).requestId,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Async Handler Wrapper
// ═══════════════════════════════════════════════════════════════════════════════

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Try-Catch Wrapper for Services
// ═══════════════════════════════════════════════════════════════════════════════

export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorFactory: (error: Error) => AppError = (e) => new InternalError(e.message)
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw errorFactory(error instanceof Error ? error : new Error(String(error)));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ValidationError,
  InternalError,
  DatabaseError,
  ExternalServiceError,
  TimeoutError,
  ProfileNotFoundError,
  ListingNotFoundError,
  ProfileAlreadyExistsError,
  InvalidCredentialsError,
  SessionExpiredError,
  InsufficientPermissionsError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  tryCatch,
};
