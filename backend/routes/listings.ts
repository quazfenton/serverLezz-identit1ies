/**
 * Listing Routes
 * Handles all listing-related endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ServiceListing, IListingsRepo, IProfilesRepo } from '../../shared/types';
import {
  authenticateToken,
  optionalAuth,
  AuthenticatedRequest,
  listingCreateLimiter,
  sanitizeAll,
  validateAndSanitize,
} from '../middleware';
import { logger, generateSecureId, logAudit } from '../../shared/utils';

const router = Router();

// Validation schemas
const ListingCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  type: z.enum(['service', 'goods', 'collaboration']),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  pricing: z.object({
    basePrice: z.number().min(0),
    currency: z.string().max(3),
    pricingType: z.enum(['fixed', 'negotiable', 'range']),
  }).optional(),
  availability: z.array(z.object({
    type: z.string(),
    daysOfWeek: z.array(z.number()).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  })).optional(),
  requirements: z.array(z.any()).optional(),
  tags: z.array(z.string().max(50)).max(20, 'Too many tags').optional(),
});

/**
 * GET /api/listings
 * Get all listings with optional filtering
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const listingsRepo = (req.app.locals as any).listingsRepo as IListingsRepo;
    const profilesRepo = (req.app.locals as any).profilesRepo as IProfilesRepo;

    const query = req.query;
    let listings = await listingsRepo.getAll();

    // Filter by active status
    listings = listings.filter(l => l.isActive);

    // Filter by location (nearby)
    if (query.nearLat && query.nearLon && query.radiusKm) {
      const nearLat = parseFloat(query.nearLat as string);
      const nearLon = parseFloat(query.nearLon as string);
      const radiusKm = parseFloat(query.radiusKm as string);

      if (!isNaN(nearLat) && !isNaN(nearLon) && !isNaN(radiusKm)) {
        const refLocation = { latitude: nearLat, longitude: nearLon };
        listings = listings.filter(l => {
          const distance = haversineDistance(refLocation, l.location);
          return distance <= radiusKm;
        });
      }
    }

    // Filter by tags
    if (query.tags && typeof query.tags === 'string') {
      const tagArray = query.tags.split(',').map(t => t.trim().toLowerCase());
      listings = listings.filter(l =>
        l.tags.some(t => tagArray.includes(t.toLowerCase()))
      );
    }

    // Calculate relevance scores if user is authenticated
    let scoredListings = listings.map(l => ({ ...l, matchingScore: 0.5 }));

    if (authReq.auth?.profileId) {
      const profile = await profilesRepo.getById(authReq.auth.profileId);
      if (profile) {
        scoredListings = await Promise.all(
          listings.map(async l => ({
            ...l,
            matchingScore: await calculateListingRelevance(profile.id, l, profilesRepo),
          }))
        );
      }
    }

    // Sort by matching score
    scoredListings.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));

    logger.info('Listings retrieved', {
      total: scoredListings.length,
      filters: {
        nearLat: query.nearLat,
        nearLon: query.nearLon,
        radiusKm: query.radiusKm,
        tags: query.tags,
      },
      requestId: (req as any).requestId,
    });

    res.json({
      listings: scoredListings,
      total: scoredListings.length,
      filters: {
        location: query.nearLat && query.nearLon ? {
          latitude: parseFloat(query.nearLat as string),
          longitude: parseFloat(query.nearLon as string),
          radiusKm: query.radiusKm ? parseFloat(query.radiusKm as string) : undefined,
        } : undefined,
        tags: query.tags ? (query.tags as string).split(',') : undefined,
      },
    });
  } catch (error) {
    logger.error('Get listings error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

/**
 * GET /api/listings/mine
 * Get current user's listings
 */
router.get('/mine', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const listingsRepo = (req.app.locals as any).listingsRepo as IListingsRepo;

    if (!authReq.auth?.profileId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const mine = await listingsRepo.byProvider(authReq.auth.profileId);

    logger.info('User listings retrieved', {
      profileId: authReq.auth.profileId,
      count: mine.length,
      requestId: (req as any).requestId,
    });

    res.json({
      listings: mine,
      total: mine.length,
    });
  } catch (error) {
    logger.error('Get user listings error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

/**
 * GET /api/listings/:id
 * Get listing by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const listingsRepo = (req.app.locals as any).listingsRepo as IListingsRepo;
    const listing = await listingsRepo.getById(req.params.id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json(listing);
  } catch (error) {
    logger.error('Get listing by ID error', {
      listingId: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

/**
 * POST /api/listings
 * Create new listing
 */
router.post(
  '/',
  authenticateToken,
  listingCreateLimiter,
  sanitizeAll,
  validateAndSanitize(ListingCreateSchema),
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const listingsRepo = (req.app.locals as any).listingsRepo as IListingsRepo;

      if (!authReq.auth?.profileId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const d = req.body;

      const listing: ServiceListing = {
        id: generateSecureId('listing'),
        title: d.title,
        description: d.description,
        type: d.type,
        providerId: authReq.auth.profileId,
        location: d.location || { latitude: 0, longitude: 0 },
        pricing: d.pricing || {
          basePrice: 0,
          currency: 'USD',
          pricingType: 'fixed',
        },
        availability: d.availability || [],
        requirements: d.requirements || [],
        tags: d.tags || [],
        qualityMetrics: {
          rating: 0,
          reliability: 0.5,
          durability: 0.5,
          functionality: 0.5,
          aesthetics: 0.5,
          sustainability: 0.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      await listingsRepo.save(listing);

      logAudit('listing_created', listing.id, 'listings', {
        providerId: listing.providerId,
        title: listing.title,
      });

      logger.info('Listing created', {
        listingId: listing.id,
        providerId: listing.providerId,
        requestId: (req as any).requestId,
      });

      res.status(201).json(listing);
    } catch (error) {
      logger.error('Listing creation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
      });
      res.status(500).json({ error: 'Failed to create listing' });
    }
  }
);

/**
 * PUT /api/listings/:id
 * Update listing
 */
router.put(
  '/:id',
  authenticateToken,
  sanitizeAll,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const listingsRepo = (req.app.locals as any).listingsRepo as IListingsRepo;

      if (!authReq.auth?.profileId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const listing = await listingsRepo.getById(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      // Check ownership
      if (listing.providerId !== authReq.auth.profileId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Update allowed fields
      const updates = req.body;

      if (updates.title !== undefined) listing.title = updates.title;
      if (updates.description !== undefined) listing.description = updates.description;
      if (updates.tags !== undefined) listing.tags = updates.tags;
      if (updates.pricing !== undefined) listing.pricing = updates.pricing;
      if (updates.availability !== undefined) listing.availability = updates.availability;

      listing.updatedAt = new Date();

      await listingsRepo.save(listing);

      logAudit('listing_updated', listing.id, 'listings', {
        providerId: listing.providerId,
      });

      logger.info('Listing updated', {
        listingId: listing.id,
        requestId: (req as any).requestId,
      });

      res.json(listing);
    } catch (error) {
      logger.error('Listing update error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
      });
      res.status(500).json({ error: 'Failed to update listing' });
    }
  }
);

/**
 * DELETE /api/listings/:id
 * Soft delete listing
 */
router.delete(
  '/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const listingsRepo = (req.app.locals as any).listingsRepo as IListingsRepo;

      if (!authReq.auth?.profileId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const listing = await listingsRepo.getById(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      // Check ownership
      if (listing.providerId !== authReq.auth.profileId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Soft delete
      listing.isActive = false;
      listing.updatedAt = new Date();
      await listingsRepo.save(listing);

      logAudit('listing_deactivated', listing.id, 'listings', {
        providerId: listing.providerId,
      });

      logger.info('Listing deactivated', {
        listingId: listing.id,
        requestId: (req as any).requestId,
      });

      res.json({ success: true, message: 'Listing deactivated' });
    } catch (error) {
      logger.error('Listing delete error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: (req as any).requestId,
      });
      res.status(500).json({ error: 'Failed to delete listing' });
    }
  }
);

// Helper functions
function haversineDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const x = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function calculateListingRelevance(
  profileId: string,
  listing: ServiceListing,
  profilesRepo: IProfilesRepo
): Promise<number> {
  try {
    const profile = await profilesRepo.getById(profileId);
    if (!profile) return 0.5;

    const needs = profile.resources.needs.map((n: any) => n.name.toLowerCase());
    const skills = profile.resources.skills.map((s: any) => s.name.toLowerCase());
    const profileText = [...needs, ...skills, profile.name].join(' ');
    const listingTags = listing.tags.map((t) => t.toLowerCase());

    const tagOverlap = listingTags.filter((t) =>
      needs.includes(t) || skills.includes(t)
    ).length;
    const tagScore = tagOverlap / Math.max(listingTags.length, 1);

    // Simple semantic similarity
    const semScore = cosineSimilarity(
      textEmbed(profileText),
      textEmbed(`${listing.title} ${listing.description} ${listing.tags.join(' ')}`)
    );

    return tagScore * 0.6 + semScore * 0.4;
  } catch {
    return 0.5;
  }
}

function textEmbed(text: string): number[] {
  const lower = (text || '').toLowerCase();
  const vec = [0, 0, 0, 0, 0];
  for (let i = 0; i < lower.length; i++) {
    vec[i % 5] += lower.charCodeAt(i);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return !na || !nb ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export default router;
