/**
 * Auth Middleware Unit Tests
 * Tests for authentication, authorization, rate limiting, and token utilities
 */

import {
  authenticateToken,
  generateSecureId,
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  refreshSession,
  generateAuthToken,
  generateRefreshToken,
  authLimiter,
  AuthenticatedRequest,
} from '../auth';
import { Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors';

// Mock request and response
const createMockRequest = (overrides: any = {}) => ({
  headers: {},
  body: {},
  query: {},
  params: {},
  ip: '127.0.0.1',
  get: jest.fn(),
  ...overrides,
});

const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res as Response;
};

const createMockNext = () => jest.fn() as NextFunction;

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key-min-32-chars';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-min-32';
  });

  describe('generateSecureId', () => {
    it('should generate a secure ID with prefix', () => {
      const id = generateSecureId('user');
      
      expect(id).toMatch(/^user_[a-zA-Z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateSecureId('test');
      const id2 = generateSecureId('test');
      
      expect(id1).not.toBe(id2);
    });

    it('should generate ID with default prefix', () => {
      const id = generateSecureId();
      
      expect(id).toMatch(/^id_[a-zA-Z0-9]+$/);
    });

    it('should generate reasonably long IDs', () => {
      const id = generateSecureId('prefix');
      
      expect(id.length).toBeGreaterThan(20);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'SecurePass123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'SecurePass123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should handle long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await hashPassword(longPassword);
      
      expect(hash).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'SecurePass123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'SecurePass123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('WrongPassword', hash);
      
      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      const password = 'SecurePass123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('', hash);
      
      expect(isValid).toBe(false);
    });

    it('should reject invalid hash', async () => {
      const isValid = await verifyPassword('password', 'invalid-hash');
      
      expect(isValid).toBe(false);
    });
  });

  describe('generateAuthToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = { id: 'user-123', email: 'test@example.com' };
      const token = generateAuthToken(payload);
      
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include payload in token', () => {
      const payload = { id: 'user-123', email: 'test@example.com' };
      const token = generateAuthToken(payload);
      
      expect(token).toBeDefined();
    });

    it('should generate different tokens each time', () => {
      const payload = { id: 'user-123' };
      const token1 = generateAuthToken(payload);
      const token2 = generateAuthToken(payload);
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const payload = { id: 'user-123', type: 'refresh' };
      const token = generateRefreshToken(payload);
      
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should use different secret than auth token', () => {
      const payload = { id: 'user-123' };
      const authToken = generateAuthToken(payload);
      const refreshToken = generateRefreshToken(payload);
      
      expect(authToken).not.toBe(refreshToken);
    });
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const payload = { id: 'user-123', email: 'test@example.com' };
      const token = generateAuthToken(payload);
      
      const req = createMockRequest({
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      await authenticateToken(req as AuthenticatedRequest, res, next);
      
      expect(next).toHaveBeenCalled();
      expect((req as AuthenticatedRequest).user).toBeDefined();
      expect((req as AuthenticatedRequest).user?.id).toBe('user-123');
    });

    it('should reject missing token', async () => {
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      await authenticateToken(req as AuthenticatedRequest, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('token') })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token format', async () => {
      const req = createMockRequest({
        headers: { authorization: 'InvalidFormat' },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      await authenticateToken(req as AuthenticatedRequest, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      // Create token with expired timestamp
      const jwt = require('jsonwebtoken');
      const expiredPayload = { id: 'user-123', exp: Math.floor(Date.now() / 1000) - 1000 };
      const expiredToken = jwt.sign(expiredPayload, process.env.JWT_SECRET);
      
      const req = createMockRequest({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      await authenticateToken(req as AuthenticatedRequest, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject token with invalid signature', async () => {
      const jwt = require('jsonwebtoken');
      const invalidToken = jwt.sign(
        { id: 'user-123' },
        'wrong-secret-key'
      );
      
      const req = createMockRequest({
        headers: { authorization: `Bearer ${invalidToken}` },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      await authenticateToken(req as AuthenticatedRequest, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle malformed token gracefully', async () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer not.a.valid.jwt.token' },
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      await authenticateToken(req as AuthenticatedRequest, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authLimiter', () => {
    it('should allow requests under limit', async () => {
      const req = createMockRequest({ ip: '127.0.0.1' });
      const res = createMockResponse();
      const next = createMockNext();
      
      // First request should pass
      await authLimiter(req as any, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should block requests over limit', async () => {
      const ip = '192.168.1.100';
      const next = createMockNext();
      
      // Make many requests to exceed limit
      for (let i = 0; i < 150; i++) {
        const req = createMockRequest({ ip });
        const res = createMockResponse();
        await authLimiter(req as any, res, next);
      }
      
      // Next request should be rate limited
      const req = createMockRequest({ ip });
      const res = createMockResponse();
      await authLimiter(req as any, res, next);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(next).not.toHaveBeenCalled();
    });

    it('should track limits per IP', async () => {
      const next = createMockNext();
      
      // Exhaust limit for IP1
      for (let i = 0; i < 150; i++) {
        const req = createMockRequest({ ip: '192.168.1.1' });
        const res = createMockResponse();
        await authLimiter(req as any, res, next);
      }
      
      // IP2 should still be allowed
      const req2 = createMockRequest({ ip: '192.168.1.2' });
      const res2 = createMockResponse();
      await authLimiter(req2 as any, res2, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('createSession', () => {
    it('should create a session object', async () => {
      const session = await createSession('user-123', '192.168.1.1');
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.ipAddress).toBe('192.168.1.1');
      expect(session.isActive).toBe(true);
    });

    it('should generate unique session IDs', async () => {
      const session1 = await createSession('user-123', '192.168.1.1');
      const session2 = await createSession('user-123', '192.168.1.1');
      
      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('deleteSession', () => {
    it('should mark session as inactive', async () => {
      const session = await createSession('user-123', '192.168.1.1');
      
      expect(session.isActive).toBe(true);
      
      await deleteSession(session);
      
      expect(session.isActive).toBe(false);
    });
  });

  describe('refreshSession', () => {
    it('should refresh session expiry', async () => {
      const session = await createSession('user-123', '192.168.1.1');
      const originalExpiry = session.expiresAt;
      
      await refreshSession(session);
      
      expect(session.expiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });

    it('should not refresh inactive session', async () => {
      const session = await createSession('user-123', '192.168.1.1');
      await deleteSession(session);
      
      await refreshSession(session);
      
      expect(session.isActive).toBe(false);
    });
  });
});
