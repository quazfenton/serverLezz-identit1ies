/**
 * RelevanceService Unit Tests
 * Tests for AI-powered relevance scoring and ranking
 */

import { RelevanceService, RelevanceScore } from '../services/RelevanceService';
import { Profile, ServiceListing } from '../../shared/types';

describe('RelevanceService', () => {
  let relevanceService: RelevanceService;

  const mockProfile: Profile = {
    id: 'user-123',
    name: 'Test User',
    email: 'user@test.com',
    passwordHash: 'hashed',
    location: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    resources: {
      skills: [
        { name: 'JavaScript', tags: ['programming', 'web'] },
        { name: 'Python', tags: ['programming', 'data'] },
      ],
      needs: [
        { name: 'Web Development', tags: ['programming', 'frontend'] },
      ],
      goods: [],
    },
    reputation: { overall: 0.8, reliability: 0.7 },
    isActive: true,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockListing: ServiceListing = {
    id: 'listing-456',
    title: 'Web Development Services',
    description: 'Professional web development with JavaScript and React',
    type: 'service',
    providerId: 'provider-789',
    location: { latitude: 37.7849, longitude: -122.4094 }, // Near SF
    pricing: {
      basePrice: 100,
      currency: 'USD',
      pricingType: 'fixed',
    },
    availability: [],
    requirements: [],
    tags: ['javascript', 'web', 'programming', 'react'],
    qualityMetrics: {
      rating: 0.9,
      reliability: 0.8,
      durability: 0.7,
      functionality: 0.9,
      aesthetics: 0.8,
      sustainability: 0.6,
    },
    isActive: true,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    relevanceService = new RelevanceService();
  });

  describe('calculateListingRelevance', () => {
    it('should calculate overall relevance score', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      expect(score).toHaveProperty('overall');
      expect(score).toHaveProperty('breakdown');
      expect(score).toHaveProperty('reasons');
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
    });

    it('should have correct breakdown structure', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      expect(score.breakdown).toHaveProperty('tagMatch');
      expect(score.breakdown).toHaveProperty('semanticMatch');
      expect(score.breakdown).toHaveProperty('locationMatch');
      expect(score.breakdown).toHaveProperty('reputationMatch');
      expect(score.breakdown).toHaveProperty('recencyMatch');
    });

    it('should have high tag match for matching tags', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      // Profile has 'javascript', 'web', 'programming' tags
      // Listing has 'javascript', 'web', 'programming', 'react' tags
      expect(score.breakdown.tagMatch).toBeGreaterThan(0.5);
    });

    it('should have high location match for nearby locations', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      // Both are in San Francisco area
      expect(score.breakdown.locationMatch).toBeGreaterThan(0.9);
    });

    it('should have high reputation match for high-rated listing', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      // Listing has 0.9 rating, user has 0.8 reputation
      expect(score.breakdown.reputationMatch).toBeGreaterThan(0.7);
    });

    it('should have high recency match for recently updated listing', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      // Listing was just created
      expect(score.breakdown.recencyMatch).toBeGreaterThan(0.9);
    });

    it('should generate relevance reasons', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      expect(score.reasons.length).toBeGreaterThan(0);
      expect(score.reasons).toContainEqual(expect.any(String));
    });

    it('should handle profile without location', () => {
      const profileWithoutLocation: Profile = {
        ...mockProfile,
        location: undefined,
      };

      const score = relevanceService.calculateListingRelevance(
        profileWithoutLocation,
        mockListing
      );

      expect(score.breakdown.locationMatch).toBe(0.5); // Neutral
    });

    it('should handle listing without tags', () => {
      const listingWithoutTags: ServiceListing = {
        ...mockListing,
        tags: [],
      };

      const score = relevanceService.calculateListingRelevance(
        mockProfile,
        listingWithoutTags
      );

      expect(score.breakdown.tagMatch).toBe(0.5); // Neutral
    });

    it('should handle profile without resources', () => {
      const profileWithoutResources: Profile = {
        ...mockProfile,
        resources: { goods: [], skills: [], needs: [] },
      };

      const score = relevanceService.calculateListingRelevance(
        profileWithoutResources,
        mockListing
      );

      expect(score.breakdown.tagMatch).toBe(0.5); // Neutral
    });
  });

  describe('calculateTagMatch', () => {
    it('should return high score for exact tag matches', () => {
      const profileWithMatchingTags: Profile = {
        ...mockProfile,
        resources: {
          skills: [{ name: 'JavaScript', tags: ['javascript', 'web'] }],
          needs: [],
          goods: [],
        },
      };

      const listingWithMatchingTags: ServiceListing = {
        ...mockListing,
        tags: ['javascript', 'web'],
      };

      const score = relevanceService.calculateListingRelevance(
        profileWithMatchingTags,
        listingWithMatchingTags
      );

      expect(score.breakdown.tagMatch).toBeGreaterThan(0.8);
    });

    it('should return low score for no tag matches', () => {
      const profileWithDifferentTags: Profile = {
        ...mockProfile,
        resources: {
          skills: [{ name: 'Cooking', tags: ['food', 'kitchen'] }],
          needs: [],
          goods: [],
        },
      };

      const listingWithDifferentTags: ServiceListing = {
        ...mockListing,
        tags: ['programming', 'software'],
      };

      const score = relevanceService.calculateListingRelevance(
        profileWithDifferentTags,
        listingWithDifferentTags
      );

      expect(score.breakdown.tagMatch).toBeLessThan(0.3);
    });

    it('should give bonus for multiple matches', () => {
      const profileWithManyTags: Profile = {
        ...mockProfile,
        resources: {
          skills: [
            { name: 'JavaScript', tags: ['javascript', 'web', 'frontend'] },
            { name: 'React', tags: ['react', 'web', 'frontend'] },
          ],
          needs: [],
          goods: [],
        },
      };

      const listingWithManyTags: ServiceListing = {
        ...mockListing,
        tags: ['javascript', 'react', 'web', 'frontend'],
      };

      const score = relevanceService.calculateListingRelevance(
        profileWithManyTags,
        listingWithManyTags
      );

      expect(score.breakdown.tagMatch).toBeGreaterThan(0.9);
    });
  });

  describe('calculateLocationMatch', () => {
    it('should return 1.0 for same location', () => {
      const sameLocationListing: ServiceListing = {
        ...mockListing,
        location: { latitude: 37.7749, longitude: -122.4194 }, // Same as profile
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, sameLocationListing);

      expect(score.breakdown.locationMatch).toBe(1);
    });

    it('should decrease score with distance', () => {
      const farLocationListing: ServiceListing = {
        ...mockListing,
        location: { latitude: 40.7128, longitude: -74.0060 }, // New York
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, farLocationListing);

      expect(score.breakdown.locationMatch).toBeLessThan(0.5);
    });

    it('should return neutral score when no location data', () => {
      const profileWithoutLocation: Profile = {
        ...mockProfile,
        location: undefined,
      };

      const score = relevanceService.calculateListingRelevance(
        profileWithoutLocation,
        mockListing
      );

      expect(score.breakdown.locationMatch).toBe(0.5);
    });
  });

  describe('calculateReputationMatch', () => {
    it('should return high score for high reputation provider', () => {
      const highReputationListing: ServiceListing = {
        ...mockListing,
        qualityMetrics: {
          ...mockListing.qualityMetrics,
          rating: 0.95,
        },
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, highReputationListing);

      expect(score.breakdown.reputationMatch).toBeGreaterThan(0.8);
    });

    it('should return low score for low reputation provider', () => {
      const lowReputationListing: ServiceListing = {
        ...mockListing,
        qualityMetrics: {
          ...mockListing.qualityMetrics,
          rating: 0.2,
        },
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, lowReputationListing);

      expect(score.breakdown.reputationMatch).toBeLessThan(0.5);
    });

    it('should consider reputation compatibility', () => {
      const highRepProfile: Profile = {
        ...mockProfile,
        reputation: { overall: 0.9, reliability: 0.9 },
      };

      const highRepListing: ServiceListing = {
        ...mockListing,
        qualityMetrics: {
          ...mockListing.qualityMetrics,
          rating: 0.9,
        },
      };

      const score = relevanceService.calculateListingRelevance(highRepProfile, highRepListing);

      // High rep user + high rep listing = good compatibility
      expect(score.breakdown.reputationMatch).toBeGreaterThan(0.7);
    });
  });

  describe('calculateRecencyMatch', () => {
    it('should return high score for recently updated listing', () => {
      const recentListing: ServiceListing = {
        ...mockListing,
        updatedAt: new Date(),
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, recentListing);

      expect(score.breakdown.recencyMatch).toBeGreaterThan(0.9);
    });

    it('should return lower score for old listing', () => {
      const oldListing: ServiceListing = {
        ...mockListing,
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, oldListing);

      expect(score.breakdown.recencyMatch).toBeLessThan(0.5);
    });

    it('should use createdAt if updatedAt is not available', () => {
      const oldCreatedAtListing: ServiceListing = {
        ...mockListing,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        updatedAt: undefined,
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, oldCreatedAtListing);

      expect(score.breakdown.recencyMatch).toBeLessThan(0.5);
    });
  });

  describe('generateRelevanceReasons', () => {
    it('should include tag match reason', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      expect(score.reasons).toContainEqual(
        expect.stringMatching(/Matches your interests|Relevant/)
      );
    });

    it('should include location reason for nearby listings', () => {
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      expect(score.reasons).toContainEqual(
        expect.stringMatching(/Near your location|Within reasonable distance/)
      );
    });

    it('should include quality reason for high reputation', () => {
      const highReputationListing: ServiceListing = {
        ...mockListing,
        qualityMetrics: {
          ...mockListing.qualityMetrics,
          rating: 0.95,
        },
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, highReputationListing);

      expect(score.reasons).toContainEqual(
        expect.stringMatching(/High-quality|quality/)
      );
    });

    it('should include recency reason for recent listings', () => {
      const recentListing: ServiceListing = {
        ...mockListing,
        updatedAt: new Date(),
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, recentListing);

      expect(score.reasons).toContainEqual(
        expect.stringMatching(/Recently updated|recent/)
      );
    });
  });

  describe('sortListingsByRelevance', () => {
    it('should sort listings by relevance score', () => {
      const lowRelevanceListing: ServiceListing = {
        ...mockListing,
        id: 'low-relevance',
        tags: ['unrelated'],
        location: { latitude: 40.7128, longitude: -74.0060 }, // Far away
        qualityMetrics: { ...mockListing.qualityMetrics, rating: 0.3 },
      };

      const highRelevanceListing: ServiceListing = {
        ...mockListing,
        id: 'high-relevance',
        tags: ['javascript', 'web', 'programming'],
        location: { latitude: 37.7749, longitude: -122.4194 }, // Same location
        qualityMetrics: { ...mockListing.qualityMetrics, rating: 0.95 },
      };

      const listings = [lowRelevanceListing, highRelevanceListing, mockListing];
      const sorted = relevanceService.sortListingsByRelevance(mockProfile, listings);

      expect(sorted[0].id).toBe('high-relevance');
      expect(sorted[sorted.length - 1].id).toBe('low-relevance');
    });

    it('should handle empty listings array', () => {
      const sorted = relevanceService.sortListingsByRelevance(mockProfile, []);

      expect(sorted).toEqual([]);
    });
  });

  describe('extractProfileTags', () => {
    it('should extract all tags from profile resources', () => {
      const profile = {
        ...mockProfile,
        resources: {
          skills: [{ name: 'JavaScript', tags: ['js', 'web'] }],
          needs: [{ name: 'Frontend Dev', tags: ['frontend', 'react'] }],
          goods: [{ name: 'Laptop', tags: ['hardware', 'tech'] }],
        },
      };

      // This is tested indirectly through calculateListingRelevance
      const score = relevanceService.calculateListingRelevance(profile, mockListing);

      expect(score.breakdown.tagMatch).toBeDefined();
    });

    it('should handle empty resources', () => {
      const profile = {
        ...mockProfile,
        resources: { goods: [], skills: [], needs: [] },
      };

      const score = relevanceService.calculateListingRelevance(profile, mockListing);

      expect(score.breakdown.tagMatch).toBe(0.5); // Neutral
    });
  });

  describe('buildProfileText', () => {
    it('should build searchable text from profile', () => {
      // This is tested indirectly through semantic match calculation
      const score = relevanceService.calculateListingRelevance(mockProfile, mockListing);

      expect(score.breakdown.semanticMatch).toBeDefined();
    });
  });

  describe('haversineDistance', () => {
    it('should calculate correct distance between SF and NY', () => {
      // SF: 37.7749, -122.4194
      // NY: 40.7128, -74.0060
      // Expected: ~4129 km
      
      // This is tested indirectly through location match
      const nyListing: ServiceListing = {
        ...mockListing,
        location: { latitude: 40.7128, longitude: -74.0060 },
      };

      const score = relevanceService.calculateListingRelevance(mockProfile, nyListing);

      // Should have low location match due to distance
      expect(score.breakdown.locationMatch).toBeLessThan(0.2);
    });
  });
});
