import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Generic validation middleware
export function validateSchema<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
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
          issues: error.errors
        });
      }
      
      return res.status(500).json({
        error: 'Validation error',
        message: 'An unexpected validation error occurred'
      });
    }
  };
}

// Enhanced error handling for validation failures
export function handleValidationError(error: any, res: Response) {
  if (error instanceof z.ZodError) {
    const errorMessages = error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    ).join(', ');
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errorMessages,
      issues: error.errors
    });
  }
  
  return res.status(500).json({
    error: 'Validation error',
    message: 'An unexpected validation error occurred'
  });
}

// Optional validation middleware (only validates if body exists)
export function validateSchemaOptional<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return next();
    }
    
    try {
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
          issues: error.errors
        });
      }
      
      return res.status(500).json({
        error: 'Validation error',
        message: 'An unexpected validation error occurred'
      });
    }
  };
}
