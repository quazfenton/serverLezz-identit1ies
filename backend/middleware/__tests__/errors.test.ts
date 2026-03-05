/**
 * Error Middleware Unit Tests
 * Tests for error handling, custom errors, and error responses
 */

import {
  ValidationError,
  DatabaseError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ListingNotFoundError,
  ProfileNotFoundError,
  InvalidCredentialsError,
  InsufficientPermissionsError,
  asyncHandler,
} from '../errors';
import { Request, Response, NextFunction } from 'express';

const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as Response;
};

const createMockNext = () => jest.fn() as NextFunction;

describe('Custom Errors', () => {
  describe('ValidationError', () => {
    it('should create error with message', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should create error with details', () => {
      const error = new ValidationError('Invalid email', { field: 'email', value: 'invalid' });
      
      expect(error.message).toBe('Invalid email');
      expect(error.details).toEqual({ field: 'email', value: 'invalid' });
    });

    it('should create error with request ID', () => {
      const error = new ValidationError('Invalid input', undefined, 'req-123');
      
      expect(error.requestId).toBe('req-123');
    });

    it('should serialize to JSON', () => {
      const error = new ValidationError('Test error', { field: 'test' }, 'req-123');
      
      const json = error.toJSON();
      
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.message).toBe('Test error');
      expect(json.details).toEqual({ field: 'test' });
      expect(json.requestId).toBe('req-123');
    });
  });

  describe('DatabaseError', () => {
    it('should create error with message', () => {
      const error = new DatabaseError('Database connection failed');
      
      expect(error.message).toBe('Database connection failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should create error with details', () => {
      const error = new DatabaseError('Query failed', { query: 'SELECT *' });
      
      expect(error.details).toEqual({ query: 'SELECT *' });
    });

    it('should serialize to JSON', () => {
      const error = new DatabaseError('DB error', { table: 'users' }, 'req-456');
      
      const json = error.toJSON();
      
      expect(json.code).toBe('DATABASE_ERROR');
      expect(json.message).toBe('DB error');
      expect(json.requestId).toBe('req-456');
    });
  });

  describe('NotFoundError', () => {
    it('should create error with message', () => {
      const error = new NotFoundError('Resource not found');
      
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should create error with resource type and ID', () => {
      const error = new NotFoundError('User', 'user-123');
      
      expect(error.message).toBe('User not found');
      expect(error.details).toEqual({ id: 'user-123', type: 'User' });
    });
  });

  describe('UnauthorizedError', () => {
    it('should create error with message', () => {
      const error = new UnauthorizedError('Authentication required');
      
      expect(error.message).toBe('Authentication required');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('should create error with message', () => {
      const error = new ForbiddenError('Access denied');
      
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('ConflictError', () => {
    it('should create error with message', () => {
      const error = new ConflictError('Resource already exists');
      
      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
    });

    it('should create error with details', () => {
      const error = new ConflictError('Email exists', { email: 'test@example.com' });
      
      expect(error.details).toEqual({ email: 'test@example.com' });
    });
  });

  describe('RateLimitError', () => {
    it('should create error with message', () => {
      const error = new RateLimitError('Too many requests');
      
      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
    });

    it('should create error with retry after', () => {
      const error = new RateLimitError('Rate limit exceeded', { retryAfter: 60 });
      
      expect(error.details).toEqual({ retryAfter: 60 });
    });
  });

  describe('ListingNotFoundError', () => {
    it('should create error with listing ID', () => {
      const error = new ListingNotFoundError('listing-123');
      
      expect(error.message).toBe('Listing not found');
      expect(error.code).toBe('LISTING_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ id: 'listing-123', type: 'Listing' });
    });

    it('should create error with request ID', () => {
      const error = new ListingNotFoundError('listing-123', 'req-789');
      
      expect(error.requestId).toBe('req-789');
    });
  });

  describe('ProfileNotFoundError', () => {
    it('should create error with profile ID', () => {
      const error = new ProfileNotFoundError('profile-123');
      
      expect(error.message).toBe('Profile not found');
      expect(error.code).toBe('PROFILE_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.details).toEqual({ id: 'profile-123', type: 'Profile' });
    });
  });

  describe('InvalidCredentialsError', () => {
    it('should create error with message', () => {
      const error = new InvalidCredentialsError();
      
      expect(error.message).toBe('Invalid email or password');
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('InsufficientPermissionsError', () => {
    it('should create error with resource type', () => {
      const error = new InsufficientPermissionsError('listing');
      
      expect(error.message).toBe('Insufficient permissions for listing');
      expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(error.statusCode).toBe(403);
    });

    it('should create error with request ID', () => {
      const error = new InsufficientPermissionsError('resource', 'req-abc');
      
      expect(error.requestId).toBe('req-abc');
    });
  });
});

describe('asyncHandler', () => {
  it('should handle successful async function', async () => {
    const handler = asyncHandler(async (req: Request, res: Response) => {
      res.json({ success: true });
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = createMockNext();

    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('should pass errors to next middleware', async () => {
    const testError = new ValidationError('Test error');
    const handler = asyncHandler(async () => {
      throw testError;
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = createMockNext();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(testError);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should wrap non-Error objects', async () => {
    const handler = asyncHandler(async () => {
      throw 'String error';
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = createMockNext();

    await handler(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should handle rejected promises', async () => {
    const handler = asyncHandler(async () => {
      return Promise.reject(new DatabaseError('DB failed'));
    });

    const req = {} as Request;
    const res = createMockResponse();
    const next = createMockNext();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(DatabaseError));
  });
});

describe('Error Response Format', () => {
  it('should format validation error correctly', () => {
    const error = new ValidationError('Invalid input', { field: 'email' }, 'req-123');
    const json = error.toJSON();

    expect(json).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: { field: 'email' },
      requestId: 'req-123',
    });
  });

  it('should format database error correctly', () => {
    const error = new DatabaseError('Connection failed', { host: 'localhost' });
    const json = error.toJSON();

    expect(json).toEqual({
      code: 'DATABASE_ERROR',
      message: 'Connection failed',
      details: { host: 'localhost' },
    });
  });

  it('should format not found error correctly', () => {
    const error = new NotFoundError('User', 'user-123');
    const json = error.toJSON();

    expect(json).toEqual({
      code: 'NOT_FOUND',
      message: 'User not found',
      details: { id: 'user-123', type: 'User' },
    });
  });

  it('should handle undefined details', () => {
    const error = new ValidationError('Error');
    const json = error.toJSON();

    expect(json.details).toBeUndefined();
  });

  it('should handle undefined request ID', () => {
    const error = new ValidationError('Error');
    const json = error.toJSON();

    expect(json.requestId).toBeUndefined();
  });
});

describe('Error Inheritance', () => {
  it('should be instance of Error', () => {
    const error = new ValidationError('Test');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct name property', () => {
    const error = new ValidationError('Test');
    expect(error.name).toBe('ValidationError');
  });

  it('should preserve stack trace', () => {
    const error = new ValidationError('Test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ValidationError');
  });
});

describe('Error Status Codes', () => {
  it('ValidationError should be 400', () => {
    expect(new ValidationError('Test').statusCode).toBe(400);
  });

  it('DatabaseError should be 500', () => {
    expect(new DatabaseError('Test').statusCode).toBe(500);
  });

  it('NotFoundError should be 404', () => {
    expect(new NotFoundError('Test').statusCode).toBe(404);
  });

  it('UnauthorizedError should be 401', () => {
    expect(new UnauthorizedError('Test').statusCode).toBe(401);
  });

  it('ForbiddenError should be 403', () => {
    expect(new ForbiddenError('Test').statusCode).toBe(403);
  });

  it('ConflictError should be 409', () => {
    expect(new ConflictError('Test').statusCode).toBe(409);
  });

  it('RateLimitError should be 429', () => {
    expect(new RateLimitError('Test').statusCode).toBe(429);
  });

  it('ListingNotFoundError should be 404', () => {
    expect(new ListingNotFoundError('id').statusCode).toBe(404);
  });

  it('ProfileNotFoundError should be 404', () => {
    expect(new ProfileNotFoundError('id').statusCode).toBe(404);
  });

  it('InvalidCredentialsError should be 401', () => {
    expect(new InvalidCredentialsError().statusCode).toBe(401);
  });

  it('InsufficientPermissionsError should be 403', () => {
    expect(new InsufficientPermissionsError('resource').statusCode).toBe(403);
  });
});
