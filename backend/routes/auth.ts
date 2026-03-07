// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Authentication Routes
// Registration • Login • Token Refresh • Session Management • Email Verification
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  authenticateToken,
  authLimiter,
  generateSecureId,
  createSession,
  deleteSession,
  refreshSession,
  hashPassword,
  verifyPassword,
  generateAuthToken,
  generateRefreshToken,
  AuthenticatedRequest,
} from '../middleware';
import { asyncHandler, ValidationError, InvalidCredentialsError, ConflictError } from '../middleware/errors';
import { ProfileService } from '../services/ProfileService';
import { EmailVerificationService, getEmailVerificationService } from '../services/EmailVerificationService';
import { logger, logSecurityEvent } from '../middleware';

const router = Router();
const emailVerificationService = getEmailVerificationService();

// Validation schemas
const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/auth/register
 * Register a new user account with email verification
 */
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const validated = RegisterSchema.parse(req.body);
    const requestId = (req as any).requestId;

    const profileService = (req.app.locals as any).profileService as ProfileService;

    // Check lockout status
    const lockoutStatus = await emailVerificationService.getLockoutStatus(
      validated.email.toLowerCase(),
      'registration'
    );

    if (lockoutStatus.locked) {
      logSecurityEvent('registration_lockout', {
        email: validated.email,
        ip: req.ip,
        requestId,
      });
      throw new ValidationError(
        'Too many registration attempts. Please try again later.',
        { retryAfter: lockoutStatus.remainingTime },
        requestId
      );
    }

    // Check if email already exists
    const existing = await profileService.findByEmail(validated.email);
    if (existing) {
      await emailVerificationService.recordFailedAttempt(validated.email.toLowerCase(), 'registration');
      logSecurityEvent('registration_duplicate_email', {
        email: validated.email,
        ip: req.ip,
        requestId,
      });
      throw new ConflictError('Email already registered', { email: validated.email }, requestId);
    }

    // Hash password
    const passwordHash = await hashPassword(validated.password);

    // Create profile (inactive until email verified)
    const profile = await profileService.createProfile(
      {
        name: validated.name,
        email: validated.email.toLowerCase(),
        passwordHash,
        location: validated.location,
      },
      requestId
    );

    // Generate verification token
    const verificationToken = await emailVerificationService.generateToken(
      validated.email.toLowerCase(),
      'email_verification',
      profile.id
    );

    // Send verification email
    await emailVerificationService.sendVerificationEmail(
      validated.email.toLowerCase(),
      verificationToken,
      'email_verification'
    );

    // Create session and tokens (but profile is inactive until verified)
    const { sessionId, authToken, refreshToken } = createSession(
      profile.id,
      req.get('user-agent'),
      req.ip
    );

    // Don't include password hash in response
    const { passwordHash: _, ...safeProfile } = profile;

    logSecurityEvent('user_registered', {
      profileId: profile.id,
      email: validated.email,
      ip: req.ip,
      requestId,
      emailSent: true,
    });

    logger.info('User registered, verification email sent', {
      profileId: profile.id,
      requestId,
    });

    res.status(201).json({
      success: true,
      profile: safeProfile,
      sessionId,
      authToken,
      refreshToken,
      requiresEmailVerification: true,
      message: 'Registration successful. Please check your email to verify your account.',
    });
  })
);

/**
 * POST /api/auth/login
 * Login with email and password with account lockout protection
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const validated = LoginSchema.parse(req.body);
    const requestId = (req as any).requestId;

    const profileService = (req.app.locals as any).profileService as ProfileService;

    // Check lockout status
    const lockoutStatus = await emailVerificationService.getLockoutStatus(
      validated.email.toLowerCase(),
      'login'
    );

    if (lockoutStatus.locked) {
      logSecurityEvent('login_lockout', {
        email: validated.email,
        ip: req.ip,
        requestId,
      });
      throw new ValidationError(
        'Too many failed login attempts. Please try again later.',
        { retryAfter: Math.round(lockoutStatus.remainingTime! / 1000 / 60) }, // minutes
        requestId
      );
    }

    // Find profile by email
    const profile = await profileService.findByEmail(validated.email.toLowerCase());
    if (!profile || !profile.passwordHash) {
      await emailVerificationService.recordFailedAttempt(validated.email.toLowerCase(), 'login');
      logSecurityEvent('login_failed_invalid_email', {
        email: validated.email,
        ip: req.ip,
        requestId,
      });
      throw new InvalidCredentialsError(requestId);
    }

    // Check if email is verified
    if (!profile.isActive) {
      logSecurityEvent('login_failed_inactive_profile', {
        profileId: profile.id,
        ip: req.ip,
        requestId,
      });
      throw new ValidationError('Please verify your email before logging in', undefined, requestId);
    }

    // Verify password
    const isValid = await verifyPassword(validated.password, profile.passwordHash);
    if (!isValid) {
      await emailVerificationService.recordFailedAttempt(validated.email.toLowerCase(), 'login');
      logSecurityEvent('login_failed_invalid_password', {
        profileId: profile.id,
        ip: req.ip,
        requestId,
      });
      throw new InvalidCredentialsError(requestId);
    }

    // Clear lockout on successful login
    await emailVerificationService.clearLockout(validated.email.toLowerCase(), 'login');

    // Create session and tokens
    const { sessionId, authToken, refreshToken } = createSession(
      profile.id,
      req.get('user-agent'),
      req.ip
    );

    // Don't include password hash in response
    const { passwordHash: _, ...safeProfile } = profile;

    logSecurityEvent('user_logged_in', {
      profileId: profile.id,
      email: validated.email,
      ip: req.ip,
      requestId,
    });

    logger.info('User logged in', {
      profileId: profile.id,
      requestId,
    });

    res.json({
      success: true,
      profile: safeProfile,
      sessionId,
      authToken,
      refreshToken,
    });
  })
);

/**
 * POST /api/auth/verify-email
 * Verify email address with token
 */
router.post(
  '/verify-email',
  asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      token: z.string().min(1, 'Token is required'),
    });
    const validated = schema.parse(req.body);
    const requestId = (req as any).requestId;

    const profileService = (req.app.locals as any).profileService as ProfileService;

    // Verify token
    const result = await emailVerificationService.verifyToken(
      validated.token,
      'email_verification'
    );

    if (!result.success || !result.profileId) {
      throw new ValidationError(result.error || 'Invalid verification token', undefined, requestId);
    }

    // Activate profile
    const profile = await profileService.getProfileById(result.profileId, requestId);
    await profileService.updateProfile(result.profileId, { isActive: true }, undefined, requestId);

    logger.info('Email verified', {
      profileId: result.profileId,
      requestId,
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
      profileId: result.profileId,
    });
  })
);

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
router.post(
  '/resend-verification',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email('Invalid email address'),
    });
    const validated = schema.parse(req.body);
    const requestId = (req as any).requestId;

    const profileService = (req.app.locals as any).profileService as ProfileService;

    // Find profile
    const profile = await profileService.findByEmail(validated.email.toLowerCase());

    if (!profile || !profile.email) {
      // Don't reveal if email exists
      res.json({
        success: true,
        message: 'If the email exists, a verification link has been sent',
      });
      return;
    }

    if (profile.isActive) {
      res.json({
        success: true,
        message: 'Email is already verified',
      });
      return;
    }

    // Generate new token
    const verificationToken = await emailVerificationService.generateToken(
      profile.email,
      'email_verification',
      profile.id
    );

    // Send verification email
    await emailVerificationService.sendVerificationEmail(
      profile.email,
      verificationToken,
      'email_verification'
    );

    logger.info('Verification email resent', {
      profileId: profile.id,
      requestId,
    });

    res.json({
      success: true,
      message: 'If the email exists, a verification link has been sent',
    });
  })
);

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post(
  '/logout',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    const requestId = (req as any).requestId;

    if (auth?.sessionId) {
      deleteSession(auth.sessionId);
      logSecurityEvent('user_logged_out', {
        profileId: auth.profileId,
        sessionId: auth.sessionId,
        requestId,
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const validated = RefreshTokenSchema.parse(req.body);
    const requestId = (req as any).requestId;

    const result = refreshSession(validated.refreshToken);
    if (!result) {
      logSecurityEvent('token_refresh_failed', {
        ip: req.ip,
        requestId,
      });
      throw new ValidationError('Invalid or expired refresh token', undefined, requestId);
    }

    logger.info('Token refreshed', { requestId });

    res.json({
      success: true,
      authToken: result.authToken,
      refreshToken: result.refreshToken,
    });
  })
);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    const requestId = (req as any).requestId;

    const profileService = (req.app.locals as any).profileService as ProfileService;
    const profile = await profileService.getCurrentProfile(auth!.profileId, requestId);

    // Don't include password hash in response
    const { passwordHash: _, ...safeProfile } = profile;

    res.json({
      success: true,
      profile: safeProfile,
    });
  })
);

export default router;
