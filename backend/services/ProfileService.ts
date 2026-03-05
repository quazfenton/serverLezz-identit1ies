// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Profile Service
// Business Logic • Validation • Transaction Management • Caching
// ═══════════════════════════════════════════════════════════════════════════════

import { Profile, IProfilesRepo, Resources, EconomicProfile, BehaviorProfile } from "../../shared/types";
import {
  ProfileNotFoundError,
  ProfileAlreadyExistsError,
  ValidationError,
  DatabaseError,
} from "../middleware/errors";
import { generateSecureId } from "../middleware/auth";
import { logger } from "../middleware";
import { CacheService, CacheKeys, getCacheService } from "./CacheService";
import { InvalidateCache } from "./CacheDecorators";

// ═══════════════════════════════════════════════════════════════════════════════
// Input Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateProfileInput {
  name: string;
  email?: string;
  password?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  resources?: Partial<Resources>;
  economicProfile?: Partial<EconomicProfile>;
  behaviorProfile?: Partial<BehaviorProfile>;
}

export interface UpdateProfileInput {
  name?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  resources?: Partial<Resources>;
  economicProfile?: Partial<EconomicProfile>;
  behaviorProfile?: Partial<BehaviorProfile>;
  isActive?: boolean;
}

export interface ProfileFilter {
  isActive?: boolean;
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
// Profile Service
// ═══════════════════════════════════════════════════════════════════════════════

export class ProfileService {
  private profilesRepo: IProfilesRepo;
  private cache: CacheService;

  constructor(profilesRepo: IProfilesRepo, cache?: CacheService) {
    this.profilesRepo = profilesRepo;
    this.cache = cache || getCacheService();
  }

  /**
   * Create a new profile with validation
   */
  @InvalidateCache(getCacheService(), ['profile:*', 'profiles:*'])
  async createProfile(input: CreateProfileInput, requestId?: string): Promise<Profile> {
    // Validate input
    this.validateCreateInput(input, requestId);

    // Check if profile with same email exists (if provided)
    if (input.email) {
      const existing = await this.findByEmail(input.email);
      if (existing) {
        throw new ProfileAlreadyExistsError(input.email, requestId);
      }
    }

    const now = new Date();
    const profile: Profile = {
      id: generateSecureId("profile"),
      name: input.name.trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${generateSecureId("avatar")}`,
      location: input.location || { latitude: 0, longitude: 0 },
      resources: this.buildDefaultResources(input.resources),
      weight: 0.5,
      reputation: this.buildDefaultReputation(),
      economicProfile: this.buildDefaultEconomicProfile(input.economicProfile),
      behaviorProfile: this.buildDefaultBehaviorProfile(input.behaviorProfile),
      lastUpdated: now,
      isActive: true,
      seekings: [],
      offerings: [],
      version: 0,
    };

    try {
      await this.profilesRepo.save(profile);
      
      // Cache the profile
      await this.cache.set(CacheKeys.profile(profile.id), profile, 3600);
      if (input.email) {
        await this.cache.set(CacheKeys.profileByEmail(input.email.toLowerCase()), profile.id, 3600);
      }
      
      logger.info("Profile created", {
        profileId: profile.id,
        requestId,
      });

      return profile;
    } catch (error) {
      logger.error("Failed to create profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to create profile", undefined, requestId);
    }
  }

  /**
   * Get profile by ID with caching
   */
  async getProfileById(profileId: string, requestId?: string): Promise<Profile> {
    // Try cache first
    const cached = await this.cache.get<Profile>(CacheKeys.profile(profileId));
    if (cached) {
      logger.debug('Profile cache hit', { profileId });
      return cached;
    }

    logger.debug('Profile cache miss', { profileId });
    
    const profile = await this.profilesRepo.getById(profileId);
    
    if (!profile) {
      throw new ProfileNotFoundError(profileId, requestId);
    }

    // Cache the profile
    await this.cache.set(CacheKeys.profile(profileId), profile, 1800); // 30 minutes

    return profile;
  }

  /**
   * Get current user's profile
   */
  async getCurrentProfile(profileId: string, requestId?: string): Promise<Profile> {
    return this.getProfileById(profileId, requestId);
  }

  /**
   * Update profile with optimistic locking and cache invalidation
   */
  @InvalidateCache(getCacheService(), ['profile:*'])
  async updateProfile(
    profileId: string,
    input: UpdateProfileInput,
    expectedVersion?: number,
    requestId?: string
  ): Promise<Profile> {
    const profile = await this.getProfileById(profileId, requestId);

    // Check version for optimistic locking
    if (expectedVersion !== undefined && profile.version !== expectedVersion) {
      throw new ValidationError(
        "Profile was modified by another user. Please refresh and try again.",
        { currentVersion: profile.version, expectedVersion },
        requestId
      );
    }

    // Validate update input
    this.validateUpdateInput(input, requestId);

    // Update allowed fields
    if (input.name) profile.name = input.name.trim();
    if (input.location) profile.location = input.location;
    if (input.resources) {
      profile.resources = { ...profile.resources, ...input.resources };
    }
    if (input.economicProfile) {
      profile.economicProfile = { ...profile.economicProfile, ...input.economicProfile };
    }
    if (input.behaviorProfile) {
      profile.behaviorProfile = { ...profile.behaviorProfile, ...input.behaviorProfile };
    }
    if (input.isActive !== undefined) profile.isActive = input.isActive;

    profile.lastUpdated = new Date();
    profile.version = (profile.version || 0) + 1;

    try {
      await this.profilesRepo.save(profile);

      // Update cache
      await this.cache.set(CacheKeys.profile(profile.id), profile, 1800);

      logger.info("Profile updated", {
        profileId: profile.id,
        requestId,
      });

      return profile;
    } catch (error) {
      logger.error("Failed to update profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to update profile", undefined, requestId);
    }
  }

  /**
   * Soft delete profile with cache invalidation
   */
  @InvalidateCache(getCacheService(), ['profile:*', 'profiles:*'])
  async deleteProfile(profileId: string, requestId?: string): Promise<void> {
    const profile = await this.getProfileById(profileId, requestId);
    
    profile.isActive = false;
    profile.lastUpdated = new Date();
    profile.version = (profile.version || 0) + 1;

    try {
      await this.profilesRepo.save(profile);

      // Remove from cache
      await this.cache.delete(CacheKeys.profile(profileId));

      logger.info("Profile deactivated", {
        profileId: profile.id,
        requestId,
      });
    } catch (error) {
      logger.error("Failed to deactivate profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to deactivate profile", undefined, requestId);
    }
  }

  /**
   * Get all profiles with filtering and pagination
   */
  async getProfiles(filter: ProfileFilter = {}, requestId?: string): Promise<{
    profiles: Profile[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(filter.limit || 20, 100); // Max 100
    const offset = filter.offset || 0;

    try {
      let profiles = await this.profilesRepo.getAll();

      // Apply filters
      if (filter.isActive !== undefined) {
        profiles = profiles.filter((p) => p.isActive === filter.isActive);
      }

      if (filter.location) {
        const { latitude, longitude, radiusKm = 50 } = filter.location;
        profiles = profiles.filter((p) => {
          const distance = this.haversineDistance(
            { latitude, longitude },
            p.location
          );
          return distance <= radiusKm;
        });
      }

      if (filter.tags && filter.tags.length > 0) {
        const tags = filter.tags.map((t) => t.toLowerCase());
        profiles = profiles.filter((p) => {
          const profileTags = this.extractTags(p);
          return profileTags.some((t) => tags.includes(t));
        });
      }

      if (filter.search) {
        const search = filter.search.toLowerCase();
        profiles = profiles.filter((p) => {
          return (
            p.name.toLowerCase().includes(search) ||
            this.extractTags(p).some((t) => t.includes(search))
          );
        });
      }

      const total = profiles.length;
      const paginated = profiles.slice(offset, offset + limit);

      return {
        profiles: paginated,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error("Failed to get profiles", {
        error: error instanceof Error ? error.message : "Unknown error",
        requestId,
      });
      throw new DatabaseError("Failed to get profiles", undefined, requestId);
    }
  }

  /**
   * Find profile by email (if email is stored)
   */
  async findByEmail(email: string): Promise<Profile | undefined> {
    const profiles = await this.profilesRepo.getAll();
    return profiles.find((p) => p.email?.toLowerCase() === email.toLowerCase());
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Helper Methods
  // ═════════════════════════════════════════════════════════════════════════════

  private validateCreateInput(input: CreateProfileInput, requestId?: string): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError("Name is required", undefined, requestId);
    }

    if (input.name.length > 100) {
      throw new ValidationError("Name must be less than 100 characters", undefined, requestId);
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
  }

  private validateUpdateInput(input: UpdateProfileInput, requestId?: string): void {
    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new ValidationError("Name cannot be empty", undefined, requestId);
    }

    if (input.name !== undefined && input.name.length > 100) {
      throw new ValidationError("Name must be less than 100 characters", undefined, requestId);
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
  }

  private buildDefaultResources(partial?: Partial<Resources>): Resources {
    return {
      goods: partial?.goods || [],
      skills: partial?.skills || [],
      needs: partial?.needs || [],
      timeAvailable: partial?.timeAvailable || [],
      preferences: partial?.preferences || {},
    };
  }

  private buildDefaultReputation() {
    return {
      overall: 0.5,
      reliability: 0.5,
      quality: 0.5,
      responsiveness: 0.5,
      fairness: 0.5,
      trustworthiness: 0.5,
      socialImpact: 0.5,
      history: [],
    };
  }

  private buildDefaultEconomicProfile(partial?: Partial<EconomicProfile>): EconomicProfile {
    return {
      totalUtility: 0,
      wealthLevel: 0.5,
      spendingPower: 0.5,
      savingsRate: 0.5,
      riskTolerance: partial?.riskTolerance || 0.5,
      preferredPaymentMethods: partial?.preferredPaymentMethods || [],
      creditScore: partial?.creditScore || 0,
      transactionHistory: [],
      valueAlignment: {
        community: partial?.valueAlignment?.community || 0.5,
        sustainability: partial?.valueAlignment?.sustainability || 0.5,
        innovation: partial?.valueAlignment?.innovation || 0.5,
        fairness: partial?.valueAlignment?.fairness || 0.5,
      },
    };
  }

  private buildDefaultBehaviorProfile(partial?: Partial<BehaviorProfile>): BehaviorProfile {
    return {
      interactionPatterns: [],
      preferences: {},
      predictedActions: [],
      adaptationRate: 0.5,
      consistencyScore: 0.5,
      socialStyle: partial?.socialStyle || "balanced",
      decisionMakingStyle: partial?.decisionMakingStyle || "analytical",
    };
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

  private extractTags(profile: Profile): string[] {
    const tags: string[] = [];
    
    if (profile.resources?.goods) {
      profile.resources.goods.forEach((g) => {
        tags.push(g.name.toLowerCase(), ...(g.tags || []).map((t) => t.toLowerCase()));
      });
    }
    
    if (profile.resources?.skills) {
      profile.resources.skills.forEach((s) => {
        tags.push(s.name.toLowerCase(), ...(s.tags || []).map((t) => t.toLowerCase()));
      });
    }
    
    if (profile.resources?.needs) {
      profile.resources.needs.forEach((n) => {
        tags.push(n.name.toLowerCase(), ...(n.tags || []).map((t) => t.toLowerCase()));
      });
    }

    return tags;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createProfileService(profilesRepo: IProfilesRepo): ProfileService {
  return new ProfileService(profilesRepo);
}
