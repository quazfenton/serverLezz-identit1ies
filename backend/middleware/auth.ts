// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Enhanced Security Middleware
// JWT Authentication • Rate Limiting • Input Sanitization • Log Sanitization
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import sanitizeHtml from "sanitize-html";
import rateLimit from "express-rate-limit";
import { logger, logSecurityEvent } from "../../shared/utils/logger";

// ═══════════════════════════════════════════════════════════════════════════════
// JWT Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "24h";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || "7d";

if (!JWT_SECRET || !REFRESH_TOKEN_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET and REFRESH_TOKEN_SECRET must be set in production environment"
    );
  }
  console.warn("⚠️  Using default JWT secrets - CHANGE IN PRODUCTION!");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Secure ID Generation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a cryptographically secure unique ID
 * Uses crypto.randomBytes for security - NOT Math.random() which is predictable
 */
export function generateSecureId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(16).toString("hex");
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generates a cryptographically secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

// ═══════════════════════════════════════════════════════════════════════════════
// JWT Token Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthTokenPayload {
  profileId: string;
  sessionId: string;
  email?: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  profileId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthTokenPayload;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Token Generation & Verification
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate JWT access token
 */
export function generateAuthToken(
  profileId: string,
  sessionId: string,
  email?: string
): string {
  const payload: AuthTokenPayload = {
    profileId,
    sessionId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + parseExpiration(JWT_EXPIRATION),
  };

  return jwt.sign(payload, JWT_SECRET || "default-secret-change-in-production");
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(
  profileId: string,
  sessionId: string
): string {
  const payload: RefreshTokenPayload = {
    profileId,
    sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + parseExpiration(REFRESH_TOKEN_EXPIRATION),
  };

  return jwt.sign(
    payload,
    REFRESH_TOKEN_SECRET || "default-refresh-secret-change-in-production"
  );
}

/**
 * Verify and decode JWT access token
 */
export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(
      token,
      JWT_SECRET || "default-secret-change-in-production"
    ) as AuthTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return null;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return null;
    }
    return null;
  }
}

/**
 * Verify and decode JWT refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(
      token,
      REFRESH_TOKEN_SECRET || "default-refresh-secret-change-in-production"
    ) as RefreshTokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Parse expiration string to seconds
 */
function parseExpiration(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/);
  if (!match) return 86400; // Default 24 hours

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 86400;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Authentication Middleware
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Middleware to require authentication
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    logSecurityEvent("auth_missing_token", {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      error: "Authentication required",
      code: "AUTH_TOKEN_MISSING",
    });
    return;
  }

  const auth = verifyAuthToken(token);
  if (!auth) {
    logSecurityEvent("auth_invalid_token", {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(403).json({
      error: "Invalid or expired token",
      code: "AUTH_TOKEN_INVALID",
    });
    return;
  }

  (req as AuthenticatedRequest).auth = auth;
  next();
}

/**
 * Middleware for optional authentication
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    const auth = verifyAuthToken(token);
    if (auth) {
      (req as AuthenticatedRequest).auth = auth;
    }
  }

  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Log Sanitization
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize log input to prevent API key and sensitive data exposure
 */
export function sanitizeLogInput(input: string, maxLength: number = 100): string {
  if (!input) return "";

  let sanitized = input;

  // Redact API keys (OpenAI, Anthropic, Google, etc.)
  sanitized = sanitized.replace(
    /(sk-[a-zA-Z0-9]{20,})/g,
    "sk-***REDACTED_API_KEY***"
  );
  sanitized = sanitized.replace(
    /(anthropic-[a-zA-Z0-9]{20,})/g,
    "anthropic-***REDACTED_API_KEY***"
  );
  sanitized = sanitized.replace(
    /(AIza[a-zA-Z0-9_-]{20,})/g,
    "***REDACTED_GOOGLE_API_KEY***"
  );

  // Redact Bearer tokens
  sanitized = sanitized.replace(
    /(Bearer [a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+)/g,
    "Bearer ***REDACTED_TOKEN***"
  );

  // Redact JWT tokens
  sanitized = sanitized.replace(
    /eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g,
    "***REDACTED_JWT***"
  );

  // Redact email addresses
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "***REDACTED_EMAIL***"
  );

  // Redact passwords in URLs
  sanitized = sanitized.replace(
    /password[=:][^&\s]+/gi,
    "password=***REDACTED***"
  );

  // Redact API key parameters
  sanitized = sanitized.replace(
    /(api[_-]?key|apikey)[=:][^&\s]+/gi,
    "$1=***REDACTED***"
  );

  // Redact secret keys
  sanitized = sanitized.replace(
    /(secret|password|token|key)[=:][^&\s]+/gi,
    "$1=***REDACTED***"
  );

  // Truncate if needed
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + "...";
  }

  return sanitized;
}

/**
 * Sanitize object for logging
 */
export function sanitizeObjectForLogging(obj: any, depth: number = 0): any {
  if (depth > 3) return "[Max depth exceeded]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeLogInput(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map((item) => sanitizeObjectForLogging(item, depth + 1));
  }
  if (typeof obj === "object") {
    const sanitized: any = {};
    const sensitiveKeys = [
      "password",
      "secret",
      "token",
      "apiKey",
      "api_key",
      "apikey",
      "authorization",
      "Authorization",
    ];

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        sanitized[key] = "***REDACTED***";
      } else {
        sanitized[key] = sanitizeObjectForLogging(value, depth + 1);
      }
    }
    return sanitized;
  }
  return obj;
}

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
      allowedAttributes: {},
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
      if (
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype"
      ) {
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
export function sanitizeAll(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query) as any;
  }
  if (req.params) {
    req.params = sanitizeInput(req.params) as any;
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiting
// ═══════════════════════════════════════════════════════════════════════════════

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.API_RATE_LIMIT_MAX) || 100, // 100 requests per window
  message: {
    error: "Too many requests",
    message: "Rate limit exceeded. Please try again later.",
    retryAfter: Math.ceil(
      (Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 900000) / 1000
    ),
    code: "RATE_LIMIT_EXCEEDED",
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
      method: req.method,
      userAgent: req.get("user-agent"),
    });
    res.status(429).json({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
    });
  },
});

// Stricter limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 5, // 5 attempts per 15 minutes
  message: {
    error: "Too many authentication attempts",
    message: "Please try again after 15 minutes.",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.get("x-forwarded-for") || "unknown";
  },
  handler: (req: Request, res: Response) => {
    logSecurityEvent("auth_rate_limit_exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: "Too many authentication attempts",
      message: "Please try again after 15 minutes.",
      code: "AUTH_RATE_LIMIT_EXCEEDED",
    });
  },
});

// Limiter for creation endpoints (profiles, listings)
export const createLimiter = rateLimit({
  windowMs: Number(process.env.CREATE_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.CREATE_RATE_LIMIT_MAX) || 10, // 10 creations per hour
  message: {
    error: "Too many creation attempts",
    message: "Please try again after 1 hour.",
    code: "CREATE_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.get("x-forwarded-for") || "unknown";
  },
  handler: (req: Request, res: Response) => {
    logSecurityEvent("create_rate_limit_exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      error: "Too many creation attempts",
      message: "Please try again after 1 hour.",
      code: "CREATE_RATE_LIMIT_EXCEEDED",
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// Password Hashing
// ═══════════════════════════════════════════════════════════════════════════════

import bcrypt from "bcrypt";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Session Management
// ═══════════════════════════════════════════════════════════════════════════════

export interface SessionData {
  id: string;
  profileId: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
  refreshToken?: string;
}

// In-memory session store (replace with Redis in production)
const sessions = new Map<string, SessionData>();

/**
 * Create a new session
 */
export function createSession(
  profileId: string,
  userAgent?: string,
  ip?: string
): { sessionId: string; authToken: string; refreshToken: string } {
  const sessionId = generateSecureId("session");

  const authToken = generateAuthToken(profileId, sessionId);
  const refreshToken = generateRefreshToken(profileId, sessionId);

  const session: SessionData = {
    id: sessionId,
    profileId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    userAgent,
    ip,
    refreshToken,
  };

  sessions.set(sessionId, session);

  return { sessionId, authToken, refreshToken };
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): SessionData | undefined {
  const session = sessions.get(sessionId);

  if (!session) return undefined;

  // Check expiration
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return undefined;
  }

  return session;
}

/**
 * Delete session
 */
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

/**
 * Refresh session tokens
 */
export function refreshSession(
  refreshToken: string
): { authToken: string; refreshToken: string } | null {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return null;

  const session = getSession(payload.sessionId);
  if (!session) return null;

  // Generate new tokens
  const authToken = generateAuthToken(session.profileId, session.id);
  const newRefreshToken = generateRefreshToken(session.profileId, session.id);

  // Update session
  session.refreshToken = newRefreshToken;
  sessions.set(session.id, session);

  return { authToken, refreshToken: newRefreshToken };
}

/**
 * Cleanup expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}

// Start periodic cleanup
setInterval(() => {
  const cleaned = cleanupExpiredSessions();
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired sessions`);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  generateSecureId,
  generateSecureRandom,
  generateAuthToken,
  generateRefreshToken,
  verifyAuthToken,
  verifyRefreshToken,
  authenticateToken,
  optionalAuth,
  sanitizeLogInput,
  sanitizeObjectForLogging,
  sanitizeInput,
  sanitizeAll,
  apiLimiter,
  authLimiter,
  createLimiter,
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  deleteSession,
  refreshSession,
  cleanupExpiredSessions,
};
