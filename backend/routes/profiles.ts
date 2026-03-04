/**
 * Profile Routes
 * Handles all profile-related endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Profile, IProfilesRepo } from '../../shared/types';
import {
  authenticateToken,
  optionalAuth,
  AuthenticatedRequest,
  createSession,
  profileCreateLimiter,
  sanitizeAll,
  validateAndSanitize,
} from '../middleware';
import { logger, generateSecureId, sanitizeLogInput, logAudit } from '../../shared/utils';

const router = Router();

// Validation schemas
const ProfileCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  resources: z.object({
    goods: z.array(z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      quantity: z.number(),
      unit: z.string(),
      tags: z.array(z.string()),
    })).optional(),
    skills: z.array(z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      proficiencyLevel: z.number(),
      tags: z.array(z.string()),
    })).optional(),
    needs: z.array(z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      urgency: z.number(),
      priority: z.number(),
      tags: z.array(z.string()),
    })).optional(),
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

/**
 * GET /api/profiles/current
 * Get current user's profile
 */
router.get('/current', optionalAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.auth?.profileId) {
      return res.status(401).json({ error: 'No active session' });
    }

    const profilesRepo = (req.app.locals as any).profilesRepo as IProfilesRepo;
    const profile = await profilesRepo.getById(authReq.auth.profileId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    logger.info('Profile retrieved', {
      profileId: profile.id,
      requestId: (req as any).requestId,
    });

    res.json(profile);
  } catch (error) {
    logger.error('Get profile error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * GET /api/profiles/:id
 * Get profile by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const profilesRepo = (req.app.locals as any).profilesRepo as IProfilesRepo;
    const profile = await profilesRepo.getById(req.params.id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Don't expose sensitive data
    const safeProfile = {
      ...profile,
      economicProfile: profile.economicProfile ? {
        ...profile.economicProfile,
        transactionHistory: [], // Hide transaction history
      } : undefined,
    };

    res.json(safeProfile);
  } catch (error) {
    logger.error('Get profile by ID error', {
      profileId: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * POST /api/profiles
 * Create new profile
 */
router.post(
  '/',
  profileCreateLimiter,
  sanitizeAll,
  validateAndSanitize(ProfileCreateSchema),
  async (req: Request, res: Response) => {
    try {
      const d = req.body;
      const profilesRepo = (req.app.locals as any).profilesRepo as IProfilesRepo;

      const profile: Profile = {
        id: generateSecureId('profile'),
        name: d.name,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${generateSecureId('avatar')}`,
        location: d.location || { latitude: 0, longitude: 0 },
        resources: {
          goods: d.resources?.goods || [],
          skills: d.resources?.skills || [],
          needs: d.resources?.needs || [],
          timeAvailable: [],
          preferences: {},
        },
        weight: 0.5,
        reputation: {
          overall: 0.5,
          reliability: 0.5,
          quality: 0.5,
          responsiveness: 0.5,
          fairness: 0.5,
          trustworthiness: 0.5,
          socialImpact: 0.5,
          history: [],
        },
        economicProfile: {
          totalUtility: 0,
          wealthLevel: 0.5,
          spendingPower: 0.5,
          savingsRate: 0.5,
          riskTolerance: d.economicProfile?.riskTolerance || 0.5,
          preferredPaymentMethods: [],
          creditScore: 0,
          transactionHistory: [],
          valueAlignment: d.economicProfile?.valueAlignment || {
            community: 0.5,
            sustainability: 0.5,
            innovation: 0.5,
            fairness: 0.5,
          },
        },
        behaviorProfile: {
          interactionPatterns: [],
          preferences: {},
          predictedActions: [],
          adaptationRate: 0.5,
          consistencyScore: 0.5,
          socialStyle: d.behaviorProfile?.socialStyle || 'balanced',
          decisionMakingStyle: d.behaviorProfile?.decisionMakingStyle || 'analytical',
        },
        lastUpdated: new Date(),
        isActive: true,
        seekings: [],
        offerings: [],
      };

      await profilesRepo.save(profile);

      // Create session and token
      const { sessionId, token } = createSession(profile.id);

      logAudit('profile_created', profile.id, 'profiles', {
        name: sanitizeLogInput(profile.name),
        sessionId,
      });

      logger.info('Profile created', {
        profileId: profile.id,
        sessionId,
        requestId: (req as any).requestId,
      });

      res.status(201).json({
        profile,
        sessionId,
        token,
      });
    } catch (error) {
      logger.error('Profile creation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requestId: (req as any).requestId,
      });
      res.status(500).json({ error: 'Failed to create profile' });
    }
  }
);

/**
 * PUT /api/profiles/:id
 * Update profile
 */
router.put(
  '/:id',
  authenticateToken,
  sanitizeAll,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const profilesRepo = (req.app.locals as any).profilesRepo as IProfilesRepo;

      if (!authReq.auth?.profileId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check ownership
      if (authReq.auth.profileId !== req.params.id) {
        logSecurityEvent('unauthorized_profile_access', {
          requesterId: authReq.auth.profileId,
          targetId: req.params.id,
        });
        return res.status(403).json({ error: 'Forbidden' });
      }

      const profile = await profilesRepo.getById(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Update allowed fields
      const updates = sanitizeInput(req.body);
      
      if (updates.name) profile.name = updates.name;
      if (updates.location) profile.location = updates.location;
      if (updates.resources) profile.resources = updates.resources;
      if (updates.economicProfile) profile.economicProfile = updates.economicProfile;
      if (updates.behaviorProfile) profile.behaviorProfile = updates.behaviorProfile;
      
      profile.lastUpdated = new Date();

      await profilesRepo.save(profile);

      logAudit('profile_updated', profile.id, 'profiles', {
        fields: Object.keys(updates),
      });

      logger.info('Profile updated', {
        profileId: profile.id,
        requestId: (req as any).requestId,
      });

      res.json(profile);
    } catch (error) {
      logger.error('Profile update error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
      });
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

/**
 * DELETE /api/profiles/:id
 * Soft delete profile
 */
router.delete(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const profilesRepo = (req.app.locals as any).profilesRepo as IProfilesRepo;

      if (!authReq.auth?.profileId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (authReq.auth.profileId !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const profile = await profilesRepo.getById(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Soft delete
      profile.isActive = false;
      profile.lastUpdated = new Date();
      await profilesRepo.save(profile);

      logAudit('profile_deactivated', profile.id, 'profiles');

      logger.info('Profile deactivated', {
        profileId: profile.id,
        requestId: (req as any).requestId,
      });

      res.json({ success: true, message: 'Profile deactivated' });
    } catch (error) {
      logger.error('Profile delete error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
      });
      res.status(500).json({ error: 'Failed to delete profile' });
    }
  }
);

// Helper function to sanitize input
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.replace(/[<>]/g, '');
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

// Security event logging helper
function logSecurityEvent(event: string, details: Record<string, any>) {
  logger.warn(`Security: ${event}`, details);
}

export default router;
