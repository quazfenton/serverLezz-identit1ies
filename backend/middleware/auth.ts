/**
 * Authentication Middleware
 * JWT-based authentication with secure token management
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { generateSecureId, logger } from '../../shared/utils';

function logSecurityEvent(event: string, details: Record<string, any>) {
  logger.warn(`Security: ${event}`, details);
}

// Validate JWT secret on module load - CRITICAL: No fallback to insecure secret
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

// CRITICAL: Enforce JWT secret in all environments
if (!JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET environment variable is not set. This is required for security.');
}

// Warn if using weak secret
if (JWT_SECRET.length < 32) {
  logger.warn('JWT_SECRET is shorter than 32 characters. Consider using a longer, more secure secret.');
}

// Check for common weak secrets
const WEAK_SECRETS = ['fallback-secret', 'secret', 'password', '123456', 'jwt-secret', 'change-me'];
if (WEAK_SECRETS.some(weak => JWT_SECRET.toLowerCase().includes(weak))) {
  logger.warn('JWT_SECRET contains a common weak pattern. Consider using a cryptographically secure random value.');
}

export interface AuthToken {
  profileId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthToken;
}

/**
 * Generate JWT auth token
 */
export function generateAuthToken(profileId: string, sessionId: string): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    { profileId, sessionId },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_EXPIRATION as string }
  );
}

/**
 * Verify JWT auth token
 */
export function verifyAuthToken(token: string): AuthToken | null {
  if (!JWT_SECRET) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET) as AuthToken;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logSecurityEvent('token_expired', { error: 'Token has expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      logSecurityEvent('token_invalid', { error: error.message });
    }
    return null;
  }
}

/**
 * Refresh auth token
 */
export function refreshAuthToken(oldToken: string): string | null {
  const auth = verifyAuthToken(oldToken);
  if (!auth) {
    return null;
  }

  // Generate new token with same profile/session
  return generateAuthToken(auth.profileId, auth.sessionId);
}

/**
 * Authentication middleware
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logSecurityEvent('auth_missing', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_MISSING'
    });
  }

  const auth = verifyAuthToken(token);
  if (!auth) {
    logSecurityEvent('auth_invalid', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(403).json({ 
      error: 'Invalid or expired token',
      code: 'AUTH_INVALID'
    });
  }

  req.auth = auth;
  next();
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const auth = verifyAuthToken(token);
    if (auth) {
      req.auth = auth;
    }
  }

  next();
}

/**
 * Require specific role/permission
 */
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // TODO: Implement role checking when roles are added to AuthToken
    // For now, just check authentication
    next();
  };
}

/**
 * Rate limit key based on authenticated user or IP
 */
export function getRateLimitKey(req: AuthenticatedRequest): string {
  if (req.auth?.profileId) {
    return `user:${req.auth.profileId}`;
  }
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * Log authentication event
 */
export function logAuthEvent(
  event: 'login' | 'logout' | 'token_refresh' | 'failed_login',
  profileId: string,
  details: Record<string, any> = {}
) {
  logSecurityEvent(`auth_${event}`, {
    profileId,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/**
 * Create session with secure token
 */
export function createSession(profileId: string): { sessionId: string; token: string } {
  const sessionId = generateSecureId('session');
  const token = generateAuthToken(profileId, sessionId);

  logAuthEvent('login', profileId, { sessionId });

  return { sessionId, token };
}

/**
 * Invalidate session (logout)
 */
export function invalidateSession(profileId: string, sessionId: string) {
  logAuthEvent('logout', profileId, { sessionId });
  // In a real implementation, you would add the token to a blacklist
  // or use short-lived tokens with refresh tokens
}
