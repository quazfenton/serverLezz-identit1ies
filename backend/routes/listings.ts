// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Listing Routes
// Listing CRUD Operations using ListingService
// ═══════════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  authenticateToken,
  optionalAuth,
  createLimiter,
  sanitizeAll,
  AuthenticatedRequest,
} from '../../middleware';
import { asyncHandler, ValidationError, ListingNotFoundError } from '../../middleware/errors';
import { ListingService, CreateListingInput, UpdateListingInput } from '../../services/ListingService';
import { RelevanceService } from '../../services/RelevanceService';
import { logger } from '../../middleware';

const router = Router();

// Validation schemas
const ListingCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  type: z.enum(['service', 'goods', 'collaboration']),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
  }).optional(),
  pricing: z.object({
    basePrice: z.number().min(0, 'Price cannot be negative'),
    currency: z.string().max(3),
    pricingType: z.enum(['fixed', 'negotiable', 'range']),
  }).optional(),
  availability: z.array(z.any()).optional(),
  requirements: z.array(z.any()).optional(),
  tags: z.array(z.string().max(50)).max(20, 'Too many tags').optional(),
});

const ListingUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  pricing: z.object({
    basePrice: z.number().min(0),
    currency: z.string().max(3),
    pricingType: z.enum(['fixed', 'negotiable', 'range']),
  }).optional(),
  availability: z.array(z.any()).optional(),
  requirements: z.array(z.any()).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/listings
 * Get all listings with filtering and pagination
 */
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;
    const auth = (req as AuthenticatedRequest).auth;

    // Parse query parameters
    const query = req.query;
    const filter: any = {
      isActive: query.isActive !== undefined ? query.isActive === 'true' : true,
      limit: Math.min(parseInt(query.limit as string) || 20, 100),
      offset: parseInt(query.offset as string) || 0,
    };

    if (query.type && typeof query.type === 'string') {
      filter.type = query.type;
    }

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

    const listingService = (req.app.locals as any).listingService as ListingService;
    const profileService = (req.app.locals as any).profileService;
    const result = await listingService.getListings(filter, requestId);

    // Calculate relevance scores if user is authenticated
    let listings = result.listings;
    if (auth?.profileId && profileService) {
      try {
        const profile = await profileService.getProfileById(auth.profileId);
        if (profile) {
          const relevanceService = new RelevanceService();
          listings = result.listings.map(listing => {
            const relevance = relevanceService.calculateListingRelevance(profile, listing);
            return {
              ...listing,
              matchingScore: relevance.overall,
              relevanceBreakdown: relevance.breakdown,
              relevanceReasons: relevance.reasons,
            };
          });
        }
      } catch (error) {
        logger.debug('Failed to calculate relevance scores', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId,
        });
      }
    }

    logger.info('Listings retrieved', {
      total: result.total,
      filters: {
        type: query.type,
        nearLat: query.nearLat,
        nearLon: query.nearLon,
        radiusKm: query.radiusKm,
        tags: query.tags,
        search: query.search,
      },
      requestId,
    });

    res.json({
      success: true,
      ...result,
      listings,
    });
  })
);

/**
 * GET /api/listings/mine
 * Get current user's listings
 */
router.get(
  '/mine',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    const requestId = (req as any).requestId;

    const listingService = (req.app.locals as any).listingService as ListingService;
    const result = await listingService.getListingsByProvider(
      auth!.profileId,
      undefined,
      requestId
    );

    logger.info('User listings retrieved', {
      profileId: auth!.profileId,
      count: result.total,
      requestId,
    });

    res.json({
      success: true,
      ...result,
    });
  })
);

/**
 * GET /api/listings/:id
 * Get listing by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId;

    const listingService = (req.app.locals as any).listingService as ListingService;
    const listing = await listingService.getListingById(req.params.id, requestId);

    res.json({
      success: true,
      listing,
    });
  })
);

/**
 * POST /api/listings
 * Create new listing
 */
router.post(
  '/',
  authenticateToken,
  createLimiter,
  sanitizeAll,
  asyncHandler(async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    const validated = ListingCreateSchema.parse(req.body);
    const requestId = (req as any).requestId;

    if (!auth?.profileId) {
      throw new ValidationError('Authentication required', undefined, requestId);
    }

    const listingService = (req.app.locals as any).listingService as ListingService;

    const input: CreateListingInput = {
      title: validated.title,
      description: validated.description,
      type: validated.type,
      location: validated.location,
      pricing: validated.pricing,
      availability: validated.availability,
      requirements: validated.requirements,
      tags: validated.tags,
    };

    const listing = await listingService.createListing(
      auth.profileId,
      input,
      requestId
    );

    logger.info('Listing created', {
      listingId: listing.id,
      providerId: auth.profileId,
      requestId,
    });

    res.status(201).json({
      success: true,
      listing,
    });
  })
);

/**
 * PUT /api/listings/:id
 * Update listing
 */
router.put(
  '/:id',
  authenticateToken,
  sanitizeAll,
  asyncHandler(async (req: Request, res: Response) => {
    const auth = (req as AuthenticatedRequest).auth;
    const validated = ListingUpdateSchema.parse(req.body);
    const requestId = (req as any).requestId;

    if (!auth?.profileId) {
      throw new ValidationError('Authentication required', undefined, requestId);
    }

    const listingService = (req.app.locals as any).listingService as ListingService;

    // Parse version for optimistic locking
    const expectedVersion = req.headers['if-version']
      ? parseInt(req.headers['if-version'] as string)
      : undefined;

    const input: UpdateListingInput = {
      title: validated.title,
      description: validated.description,
      pricing: validated.pricing,
      availability: validated.availability,
      requirements: validated.requirements,
      tags: validated.tags,
      isActive: validated.isActive,
    };

    const listing = await listingService.updateListing(
      req.params.id,
      auth.profileId,
      input,
      expectedVersion,
      requestId
    );

    logger.info('Listing updated', {
      listingId: listing.id,
      providerId: auth.profileId,
      requestId,
    });

    res.json({
      success: true,
      listing,
      version: listing.version,
    });
  })
);

/**
 * DELETE /api/listings/:id
 * Soft delete listing
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

    const listingService = (req.app.locals as any).listingService as ListingService;
    await listingService.deleteListing(req.params.id, auth.profileId, requestId);

    logger.info('Listing deactivated', {
      listingId: req.params.id,
      providerId: auth.profileId,
      requestId,
    });

    res.json({
      success: true,
      message: 'Listing deactivated successfully',
    });
  })
);

export default router;
