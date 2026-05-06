/**
 * Logging Utilities
 * Structured logging with Winston for production-grade observability
 */

import winston from 'winston';
import path from 'path';
import { sanitizeLogInput } from './security';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata, null, 2)}`;
  }
  
  return msg;
});

// Custom format for file output (JSON)
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { 
    service: 'coordination-cosmos',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      consoleFormat
    ),
  }));
}

// Ensure logs directory exists
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Request logging middleware
 */
export function requestLogger(req: any, res: any, next: () => void) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Attach request ID to request and response
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    query: sanitizeLogInput(JSON.stringify(req.query)),
    ip: req.ip,
    userAgent: sanitizeLogInput(req.get('user-agent') || 'unknown'),
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(logLevel, 'Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: res.get('content-length') || 'unknown',
    });
  });

  // Log errors
  res.on('error', (error: Error) => {
    logger.error('Response error', {
      requestId,
      error: error.message,
      stack: error.stack,
    });
  });

  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = cryptoRandomString(16);
  return `req_${timestamp}_${random}`;
}

/**
 * Generate cryptographically secure random string
 */
function cryptoRandomString(length: number): string {
  const crypto = require('crypto');
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Create child logger with additional context
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log slow queries
 */
export function logSlowQuery(query: string, duration: number, threshold: number = 1000) {
  if (duration > threshold) {
    logger.warn('Slow query detected', {
      duration: `${duration}ms`,
      threshold: `${threshold}ms`,
      query: sanitizeLogInput(query.substring(0, 500)),
    });
  }
}

/**
 * Log API call (for external services)
 */
export function logApiCall(service: string, endpoint: string, duration: number, status: number) {
  const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  
  logger.log(logLevel, 'External API call', {
    service,
    endpoint,
    status,
    duration: `${duration}ms`,
  });
}

/**
 * Log security event
 */
export function logSecurityEvent(event: string, details: Record<string, any>) {
  logger.warn('Security event', {
    event,
    ...details,
  });
}

/**
 * Log performance metric
 */
export function logPerformance(metric: string, value: number, unit: string = 'ms') {
  logger.info('Performance metric', {
    metric,
    value,
    unit,
  });
}

/**
 * Error logging helper
 */
export function logError(error: Error, context: Record<string, any> = {}) {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
  });
}

/**
 * Audit logging (for compliance)
 */
export function logAudit(
  action: string,
  userId: string,
  resource: string,
  details: Record<string, any> = {}
) {
  logger.info('Audit event', {
    action,
    userId,
    resource,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

export default logger;
