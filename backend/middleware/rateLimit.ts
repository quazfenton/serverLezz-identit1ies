/**
 * Rate Limiting Middleware
 * Configurable rate limits with different strategies
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { getRateLimitKey } from './auth';
import { logger } from '../../shared/utils';

// General API rate limiter
export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { 
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 900 // seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => getRateLimitKey(req as any),
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      limit: 100,
      windowMs: 900000,
    });
    res.status(429).json({
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 900,
    });
  },
});

// Strict rate limiter for authentication endpoints
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per window
  message: { 
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getRateLimitKey(req as any),
  handler: (req: Request, res: Response) => {
    logger.warn('Auth rate limit exceeded', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(429).json({
      error: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: 900,
    });
  },
});

// Rate limiter for profile creation (prevent spam)
export const profileCreateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 profile creations per hour
  message: { 
    error: 'Too many profile creation attempts',
    code: 'PROFILE_RATE_LIMIT_EXCEEDED',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getRateLimitKey(req as any),
  handler: (req: Request, res: Response) => {
    logSecurityEvent('profile_rate_limit_exceeded', {
      ip: req.ip,
    });
    res.status(429).json({
      error: 'Too many profile creation attempts',
      code: 'PROFILE_RATE_LIMIT_EXCEEDED',
      retryAfter: 3600,
    });
  },
});

// Rate limiter for listing creation
export const listingCreateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each IP to 50 listing creations per hour
  message: { 
    error: 'Too many listing creation attempts',
    code: 'LISTING_RATE_LIMIT_EXCEEDED',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getRateLimitKey(req as any),
  handler: (req: Request, res: Response) => {
    logSecurityEvent('listing_rate_limit_exceeded', {
      ip: req.ip,
    });
    res.status(429).json({
      error: 'Too many listing creation attempts',
      code: 'LISTING_RATE_LIMIT_EXCEEDED',
      retryAfter: 3600,
    });
  },
});

// Rate limiter for WebSocket connections
export const wsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 WebSocket connections per hour
  message: {
    error: 'Too many WebSocket connection attempts',
    code: 'WS_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getRateLimitKey(req as any),
});

// Rate limiter for expensive operations (matching, optimization)
export const expensiveOpLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 expensive operations per minute
  message: { 
    error: 'Too many requests, please slow down',
    code: 'EXPENSIVE_OP_RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => getRateLimitKey(req as any),
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests, please slow down',
      code: 'EXPENSIVE_OP_RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  },
});

/**
 * Custom rate limiter factory
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: any;
  keyGenerator?: (req: Request) => string;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || { 
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => getRateLimitKey(req as any)),
  });
}
