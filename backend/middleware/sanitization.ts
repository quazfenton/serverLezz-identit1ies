/**
 * Input Sanitization Middleware
 * Sanitizes all incoming request data to prevent XSS and injection attacks
 */

import { Request, Response, NextFunction } from 'express';
import { sanitizeInput, sanitizeLogInput } from '../utils';
import { z } from 'zod';

/**
 * Sanitize request body
 */
export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    req.body = sanitizeInput(req.body);
  }
  next();
}

/**
 * Sanitize request query parameters
 */
export function sanitizeQuery(req: Request, res: Response, next: NextFunction) {
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
    req.query = sanitizeInput(req.query) as any;
  }
  next();
}

/**
 * Sanitize request parameters
 */
export function sanitizeParams(req: Request, res: Response, next: NextFunction) {
  if (req.params && typeof req.params === 'object' && Object.keys(req.params).length > 0) {
    req.params = sanitizeInput(req.params) as any;
  }
  next();
}

/**
 * Combined sanitization middleware
 */
export function sanitizeAll(req: Request, res: Response, next: NextFunction) {
  sanitizeBody(req, res, () => {
    sanitizeQuery(req, res, () => {
      sanitizeParams(req, res, next);
    });
  });
}

/**
 * Enhanced validation middleware with sanitization
 */
export function validateAndSanitize<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // First sanitize
      req.body = sanitizeInput(req.body);
      req.query = sanitizeInput(req.query) as any;
      req.params = sanitizeInput(req.params) as any;

      // Then validate
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err =>
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');

        return res.status(400).json({
          error: 'Validation failed',
          details: errorMessages,
          issues: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        });
      }

      return res.status(500).json({
        error: 'Validation error',
        message: 'An unexpected validation error occurred',
      });
    }
  };
}

/**
 * Validate specific fields
 */
export function validateFields(validators: Record<string, (value: any) => string | null>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    for (const [field, validate] of Object.entries(validators)) {
      const value = getNestedValue(req.body, field);
      const error = validate(value);
      if (error) {
        errors.push(`${field}: ${error}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    next();
  };
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): string | null {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email format';
  return null;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): string | null {
  if (!url) return 'URL is required';
  try {
    new URL(url);
    return null;
  } catch {
    return 'Invalid URL format';
  }
}

/**
 * Validate string length
 */
export function validateLength(min: number, max: number) {
  return (value: string): string | null => {
    if (!value) return 'Value is required';
    if (typeof value !== 'string') return 'Value must be a string';
    if (value.length < min) return `Minimum length is ${min} characters`;
    if (value.length > max) return `Maximum length is ${max} characters`;
    return null;
  };
}

/**
 * Validate number range
 */
export function validateRange(min: number, max: number) {
  return (value: number): string | null => {
    if (value === undefined || value === null) return 'Value is required';
    if (typeof value !== 'number') return 'Value must be a number';
    if (value < min) return `Minimum value is ${min}`;
    if (value > max) return `Maximum value is ${max}`;
    return null;
  };
}

/**
 * Validate array length
 */
export function validateArrayLength(min: number, max: number) {
  return (value: any[]): string | null => {
    if (!Array.isArray(value)) return 'Value must be an array';
    if (value.length < min) return `Minimum ${min} items required`;
    if (value.length > max) return `Maximum ${max} items allowed`;
    return null;
  };
}

/**
 * Sanitize and log sensitive data in request
 */
export function logRequestDetails(req: Request) {
  const sanitizedBody = sanitizeLogInput(JSON.stringify(req.body));
  const sanitizedQuery = sanitizeLogInput(JSON.stringify(req.query));
  
  return {
    method: req.method,
    path: req.path,
    body: sanitizedBody,
    query: sanitizedQuery,
    params: req.params,
    headers: {
      'user-agent': sanitizeLogInput(req.get('user-agent') || 'unknown'),
      'content-type': req.get('content-type'),
    },
  };
}
