// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Profile Routes
// Profile CRUD Operations using ProfileService
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  authenticateToken,
  optionalAuth,
  createLimiter,
  sanitizeAll,
  AuthenticatedRequest,
} from '../middleware';
import { asyncHandler, ProfileNotFoundError, ValidationError } from '../middleware/errors';
import { ProfileService, CreateProfileInput, UpdateProfileInput } from '../services/ProfileService';
import { logger } from '../middleware';

const router = Router();

// Validation schemas
const ProfileCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
  }).optional(),
  resources: z.object({
    goods: z.array(z.any()).optional(),
    skills: z.array(z.any()).optional(),
    needs: z.array(z.any()).optional(),
    timeAvailable: z.array(z.any()).optional(),
    preferences: z.record(z.any()).optional(),
  }).optional(),
  economicProfile: z.object({
    valueAlignment: z.object({
      community: z.number().min(0).max(1),
      sustainability: z.number().min(0).max(1),
      innovation: z.number().min(0).max(1),
      fairness: z.number().min(0).max(1),
    }).optional(),
    riskTolerance: z.number().min(0).max(1).optional(),
  }).optional(),
  behaviorProfile: z.object({
    socialStyle: z.string().optional(),
    decisionMakingStyle: z.string().optional(),
  }).optional(),
});

const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
  }).optional(),
  resources: z.any().optional(),
  economicProfile: z.any().optional(),
  behaviorProfile: z.any().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/profiles/current
 * Get current user's profile
 */
router.get(
  '/current',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    const requestId = (req as any).requestId;

    const profileService = (req.app.locals as any).profileService as ProfileService;
    const profile = await profileService.getCurrentProfile(auth!.profileId, requestId);

    // Don't include password hash in response
    const { passwordHash: _, ...safeProfile } = profile;

    logger.info('Profile retrieved', {
      profileId: profile.id,
      requestId,
    });

    res.json({
      success: true,
      profile: safeProfile,
    });
  })
);

/**
 * GET /api/profiles/:id
 * Get profile by ID (public - excludes sensitive data)
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;

    const profileService = (req.app.locals as any).profileService as ProfileService;
    const profile = await profileService.getProfileById(req.params.id!, requestId);

    // Don't include sensitive data in public response
    const { passwordHash: _, email: __, ...publicProfile } = profile;

    res.json({
      success: true,
      profile: publicProfile,
    });
  })
);

/**
 * GET /api/profiles
 * Get all profiles with filtering and pagination
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;

    // Parse query parameters
    const query = req.query;
    const filter: any = {
      isActive: query.isActive !== 'false', // Default to active only
      limit: Math.min(parseInt(query.limit as string) || 20, 100),
      offset: parseInt(query.offset as string) || 0,
    };

    if (query.nearLat && query.nearLon) {
      filter.location = {
        latitude: parseFloat(query.nearLat as string),
        longitude: parseFloat(query.nearLon as string),
        radiusKm: parseFloat(query.radiusKm as string) || 50,
      };
    }

    if (query.tags && typeof query.tags === 'string') {
      filter.tags = query.tags.split(',').map((t: string) => t.trim());
    }

    if (query.search && typeof query.search === 'string') {
      filter.search = query.search;
    }

    const profileService = (req.app.locals as any).profileService as ProfileService;
    const result = await profileService.getProfiles(filter, requestId);

    res.json({
      success: true,
      ...result,
    });
  })
);

/**
 * POST /api/profiles
 * Create new profile (legacy endpoint - use /api/auth/register instead)
 */
router.post(
  '/',
  createLimiter,
  sanitizeAll,
  asyncHandler(async (req: Request, res: Response) => {
    const validated = ProfileCreateSchema.parse(req.body);
    const requestId = (req as any).requestId;

    const profileService = (req.app.locals as any).profileService as ProfileService;

    const input: CreateProfileInput = {
      name: validated.name,
      email: validated.email,
      password: validated.password,
      location: validated.location,
      resources: validated.resources as any,
      economicProfile: validated.economicProfile as any,
      behaviorProfile: validated.behaviorProfile as any,
    };

    const profile = await profileService.createProfile(input, requestId);

    // Create session if no email/password (anonymous creation)
    let sessionId: string | undefined;
    let authToken: string | undefined;
    let refreshToken: string | undefined;

    if (!validated.email || !validated.password) {
      const sessionData = require('../../middleware').createSession(profile.id);
      sessionId = sessionData.sessionId;
      authToken = sessionData.authToken;
      refreshToken = sessionData.refreshToken;
    }

    // Don't include password hash in response
    const { passwordHash: _, ...safeProfile } = profile;

    logger.info('Profile created', {
      profileId: profile.id,
      requestId,
    });

    res.status(201).json({
      success: true,
      profile: safeProfile,
      sessionId,
      authToken,
      refreshToken,
    });
  })
);

/**
 * PUT /api/profiles/:id
 * Update profile
 */
router.put(
  '/:id',
  authenticateToken,
  sanitizeAll,
  asyncHandler(async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    const requestId = (req as any).requestId;

    if (!auth?.profileId) {
      throw new ValidationError('Authentication required', undefined, requestId);
    }

    // Check ownership
    if (auth.profileId !== req.params.id) {
      throw new ValidationError('Can only update your own profile', undefined, requestId);
    }

    const validated = ProfileUpdateSchema.parse(req.body);
    const profileService = (req.app.locals as any).profileService as ProfileService;

    // Parse version for optimistic locking
    const expectedVersion = req.headers['if-version']
      ? parseInt(req.headers['if-version'] as string)
      : undefined;

    const input: UpdateProfileInput = {
      name: validated.name,
      location: validated.location,
      resources: validated.resources,
      economicProfile: validated.economicProfile,
      behaviorProfile: validated.behaviorProfile,
      isActive: validated.isActive,
    };

    const profile = await profileService.updateProfile(
      req.params.id,
      input,
      expectedVersion,
      requestId
    );

    // Don't include password hash in response
    const { passwordHash: _, ...safeProfile } = profile;

    logger.info('Profile updated', {
      profileId: profile.id,
      requestId,
    });

    res.json({
      success: true,
      profile: safeProfile,
      version: profile.version,
    });
  })
);

/**
 * DELETE /api/profiles/:id
 * Soft delete profile
 */
router.delete(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    const requestId = (req as any).requestId;

    if (!auth?.profileId) {
      throw new ValidationError('Authentication required', undefined, requestId);
    }

    // Check ownership
    if (auth.profileId !== req.params.id) {
      throw new ValidationError('Can only delete your own profile', undefined, requestId);
    }

    const profileService = (req.app.locals as any).profileService as ProfileService;
    await profileService.deleteProfile(req.params.id, requestId);

    logger.info('Profile deactivated', {
      profileId: req.params.id,
      requestId,
    });

    res.json({
      success: true,
      message: 'Profile deactivated successfully',
    });
  })
);

export default router;
