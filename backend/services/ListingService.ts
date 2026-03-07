// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Listing Service
// Business Logic • Validation • Transaction Management
// ═══════════════════════════════════════════════════════════════════════════════

import { ServiceListing, IListingsRepo, IProfilesRepo } from "../../shared/types";
import {
  ListingNotFoundError,
  ValidationError,
  DatabaseError,
  InsufficientPermissionsError,
} from "../middleware/errors";
import { generateSecureId } from "../middleware/auth";
import { logger } from "../middleware";

// ═══════════════════════════════════════════════════════════════════════════════
// Input Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateListingInput {
  title: string;
  description: string;
  type: "service" | "goods" | "collaboration";
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  pricing?: {
    basePrice: number;
    currency: string;
    pricingType: "fixed" | "negotiable" | "range";
  };
  availability?: any[];
  requirements?: any[];
  tags?: string[];
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  pricing?: {
    basePrice: number;
    currency: string;
    pricingType: "fixed" | "negotiable" | "range";
  };
  availability?: any[];
  requirements?: any[];
  tags?: string[];
  isActive?: boolean;
}

export interface ListingFilter {
  isActive?: boolean;
  type?: string;
  providerId?: string;
  location?: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  };
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Listing Service
// ═══════════════════════════════════════════════════════════════════════════════

export class ListingService {
  private listingsRepo: IListingsRepo;
  private profilesRepo: IProfilesRepo;

  constructor(listingsRepo: IListingsRepo, profilesRepo: IProfilesRepo) {
    this.listingsRepo = listingsRepo;
    this.profilesRepo = profilesRepo;
  }

  /**
   * Create a new listing with validation
   */
  async createListing(
    providerId: string,
    input: CreateListingInput,
    requestId?: string
  ): Promise<ServiceListing> {
    // Validate input
    this.validateCreateInput(input, requestId);

    // Verify provider exists
    const provider = await this.profilesRepo.getById(providerId);
    if (!provider) {
      throw new ValidationError("Provider profile not found", { providerId }, requestId);
    }

    const now = new Date();
    const listing: ServiceListing = {
      id: generateSecureId("listing"),
      title: input.title.trim(),
      description: input.description.trim(),
      type: input.type,
      providerId,
      location: input.location || { latitude: 0, longitude: 0 },
      pricing: input.pricing || {
        basePrice: 0,
        currency: "USD",
        pricingType: "negotiable",
      },
      availability: input.availability || [],
      requirements: input.requirements || [],
      tags: input.tags || [],
      qualityMetrics: {
        rating: 0,
        reliability: 0.5,
        durability: 0.5,
        functionality: 0.5,
        aesthetics: 0.5,
        sustainability: 0.5,
      },
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };

    try {
      await this.listingsRepo.save(listing);

      logger.info("Listing created", {
        listingId: listing.id,
        providerId,
        requestId,
      });

      return listing;
    } catch (error) {
      logger.error("Failed to create listing", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to create listing", undefined, requestId);
    }
  }

  /**
   * Get listing by ID
   */
  async getListingById(listingId: string, requestId?: string): Promise<ServiceListing> {
    const listing = await this.listingsRepo.getById(listingId);

    if (!listing) {
      throw new ListingNotFoundError(listingId, requestId);
    }

    return listing;
  }

  /**
   * Update listing with optimistic locking
   */
  async updateListing(
    listingId: string,
    providerId: string,
    input: UpdateListingInput,
    expectedVersion?: number,
    requestId?: string
  ): Promise<ServiceListing> {
    const listing = await this.getListingById(listingId, requestId);

    // Check ownership
    if (listing.providerId !== providerId) {
      throw new InsufficientPermissionsError("listing", requestId);
    }

    // Check version for optimistic locking
    if (expectedVersion !== undefined && listing.version !== expectedVersion) {
      throw new ValidationError(
        "Listing was modified by another user. Please refresh and try again.",
        { currentVersion: listing.version ?? 0, expectedVersion },
        requestId
      );
    }

    // Validate update input
    this.validateUpdateInput(input, requestId);

    // Update allowed fields
    if (input.title !== undefined) listing.title = input.title!.trim();
    if (input.description !== undefined) listing.description = input.description!.trim();
    if (input.pricing !== undefined) listing.pricing = input.pricing;
    if (input.availability !== undefined) listing.availability = input.availability;
    if (input.requirements !== undefined) listing.requirements = input.requirements;
    if (input.tags !== undefined) listing.tags = input.tags;
    if (input.isActive !== undefined) listing.isActive = input.isActive;

    listing.updatedAt = new Date();
    listing.version = (listing.version ?? 0) + 1;

    try {
      await this.listingsRepo.save(listing);

      logger.info("Listing updated", {
        listingId: listing.id,
        providerId,
        requestId,
      });

      return listing;
    } catch (error) {
      logger.error("Failed to update listing", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to update listing", undefined, requestId);
    }
  }

  /**
   * Soft delete listing
   */
  async deleteListing(listingId: string, providerId: string, requestId?: string): Promise<void> {
    const listing = await this.getListingById(listingId, requestId);

    // Check ownership
    if (listing.providerId !== providerId) {
      throw new InsufficientPermissionsError("listing", requestId);
    }

    listing.isActive = false;
    listing.updatedAt = new Date();
    listing.version = (listing.version ?? 0) + 1;

    try {
      await this.listingsRepo.save(listing);

      logger.info("Listing deactivated", {
        listingId: listing.id,
        providerId,
        requestId,
      });
    } catch (error) {
      logger.error("Failed to deactivate listing", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to deactivate listing", undefined, requestId);
    }
  }

  /**
   * Get all listings with filtering and pagination
   */
  async getListings(filter: ListingFilter = {}, requestId?: string): Promise<{
    listings: ServiceListing[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(filter.limit || 20, 100); // Max 100
    const offset = filter.offset || 0;

    try {
      let listings = await this.listingsRepo.getAll();

      // Filter by active status (default to active only)
      const isActive = filter.isActive !== undefined ? filter.isActive : true;
      listings = listings.filter((l) => l.isActive === isActive);

      // Filter by type
      if (filter.type) {
        listings = listings.filter((l) => l.type === filter.type);
      }

      // Filter by provider
      if (filter.providerId) {
        listings = listings.filter((l) => l.providerId === filter.providerId);
      }

      // Filter by location
      if (filter.location) {
        const { latitude, longitude, radiusKm = 50 } = filter.location;
        listings = listings.filter((l) => {
          const distance = this.haversineDistance(
            { latitude, longitude },
            l.location
          );
          return distance <= radiusKm;
        });
      }

      // Filter by tags
      if (filter.tags && filter.tags.length > 0) {
        const tags = filter.tags.map((t) => t.toLowerCase());
        listings = listings.filter((l) =>
          l.tags.some((t) => tags.includes(t.toLowerCase()))
        );
      }

      // Filter by search term
      if (filter.search) {
        const search = filter.search.toLowerCase();
        listings = listings.filter(
          (l) =>
            l.title.toLowerCase().includes(search) ||
            l.description.toLowerCase().includes(search) ||
            l.tags.some((t) => t.toLowerCase().includes(search))
        );
      }

      const total = listings.length;
      const paginated = listings.slice(offset, offset + limit);

      return {
        listings: paginated,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error("Failed to get listings", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to get listings", undefined, requestId);
    }
  }

  /**
   * Get listings by provider
   */
  async getListingsByProvider(
    providerId: string,
    isActive?: boolean,
    requestId?: string
  ): Promise<{
    listings: ServiceListing[];
    total: number;
  }> {
    try {
      let listings = await this.listingsRepo.byProvider(providerId);

      if (isActive !== undefined) {
        listings = listings.filter((l) => l.isActive === isActive);
      }

      return {
        listings,
        total: listings.length,
      };
    } catch (error) {
      logger.error("Failed to get provider listings", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to get provider listings", undefined, requestId);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═════════════════════════════════════════════════════════════════════════════

  private validateCreateInput(input: CreateListingInput, requestId?: string): void {
    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError("Title is required", undefined, requestId);
    }

    if (input.title.length > 200) {
      throw new ValidationError("Title must be less than 200 characters", undefined, requestId);
    }

    if (!input.description || input.description.trim().length === 0) {
      throw new ValidationError("Description is required", undefined, requestId);
    }

    if (input.description.length > 2000) {
      throw new ValidationError("Description must be less than 2000 characters", undefined, requestId);
    }

    if (!["service", "goods", "collaboration"].includes(input.type)) {
      throw new ValidationError("Type must be one of: service, goods, collaboration", undefined, requestId);
    }

    if (input.location) {
      const { latitude, longitude } = input.location;
      if (latitude < -90 || latitude > 90) {
        throw new ValidationError("Latitude must be between -90 and 90", undefined, requestId);
      }
      if (longitude < -180 || longitude > 180) {
        throw new ValidationError("Longitude must be between -180 and 180", undefined, requestId);
      }
    }

    if (input.pricing && input.pricing.basePrice < 0) {
      throw new ValidationError("Price cannot be negative", undefined, requestId);
    }

    if (input.tags && input.tags.length > 20) {
      throw new ValidationError("Maximum 20 tags allowed", undefined, requestId);
    }

    if (input.tags) {
      input.tags.forEach((tag, index) => {
        if (tag.length > 50) {
          throw new ValidationError(`Tag ${index + 1} exceeds 50 characters`, undefined, requestId);
        }
      });
    }
  }

  private validateUpdateInput(input: UpdateListingInput, requestId?: string): void {
    if (input.title !== undefined) {
      if (input.title.trim().length === 0) {
        throw new ValidationError("Title cannot be empty", undefined, requestId);
      }
      if (input.title.length > 200) {
        throw new ValidationError("Title must be less than 200 characters", undefined, requestId);
      }
    }

    if (input.description !== undefined) {
      if (input.description.trim().length === 0) {
        throw new ValidationError("Description cannot be empty", undefined, requestId);
      }
      if (input.description.length > 2000) {
        throw new ValidationError("Description must be less than 2000 characters", undefined, requestId);
      }
    }

    if (input.pricing && input.pricing.basePrice < 0) {
      throw new ValidationError("Price cannot be negative", undefined, requestId);
    }

    if (input.tags && input.tags.length > 20) {
      throw new ValidationError("Maximum 20 tags allowed", undefined, requestId);
    }
  }

  private haversineDistance(
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createListingService(
  listingsRepo: IListingsRepo,
  profilesRepo: IProfilesRepo
): ListingService {
  return new ListingService(listingsRepo, profilesRepo);
}
