/**
 * End-to-End (E2E) Tests
 * Tests for complete user workflows and API endpoints
 */

import { ProfileService } from '../services/ProfileService';
import { ListingService } from '../services/ListingService';
import { RelevanceService } from '../services/RelevanceService';
import { IProfilesRepo, IListingsRepo, Profile, ServiceListing } from '../../shared/types';

// Mock repositories
class MockProfilesRepo implements IProfilesRepo {
  private store: Map<string, Profile> = new Map();

  async getById(id: string): Promise<Profile | undefined> {
    return this.store.get(id);
  }

  async save(profile: Profile): Promise<void> {
    this.store.set(profile.id, profile);
  }

  async getAll(): Promise<Profile[]> {
    return Array.from(this.store.values());
  }

  async getByEmail(email: string): Promise<Profile | undefined> {
    return Array.from(this.store.values()).find(
      p => p.email?.toLowerCase() === email.toLowerCase()
    );
  }
}

class MockListingsRepo implements IListingsRepo {
  private store: Map<string, ServiceListing> = new Map();

  async getById(id: string): Promise<ServiceListing | undefined> {
    return this.store.get(id);
  }

  async save(listing: ServiceListing): Promise<void> {
    this.store.set(listing.id, listing);
  }

  async getAll(): Promise<ServiceListing[]> {
    return Array.from(this.store.values());
  }

  async byProvider(providerId: string): Promise<ServiceListing[]> {
    return Array.from(this.store.values()).filter(l => l.providerId === providerId);
  }
}

describe('E2E Tests - User Workflows', () => {
  let profilesRepo: IProfilesRepo;
  let listingsRepo: IListingsRepo;
  let profileService: ProfileService;
  let listingService: ListingService;
  let relevanceService: RelevanceService;

  beforeEach(() => {
    profilesRepo = new MockProfilesRepo();
    listingsRepo = new MockListingsRepo();
    profileService = new ProfileService(profilesRepo);
    listingService = new ListingService(listingsRepo, profilesRepo);
    relevanceService = new RelevanceService();
  });

  describe('Complete User Registration and Listing Flow', () => {
    it('should complete full user journey', async () => {
      // Step 1: User registers
      const user = await profileService.createProfile({
        name: 'John Developer',
        email: 'john@example.com',
        passwordHash: 'hashed-password',
        location: { latitude: 37.7749, longitude: -122.4194 },
        resources: {
          skills: [
            { name: 'JavaScript', tags: ['programming', 'web', 'frontend'] },
            { name: 'React', tags: ['frontend', 'ui'] },
            { name: 'Node.js', tags: ['backend', 'api'] },
          ],
          needs: [
            { name: 'UI Design', tags: ['design', 'ui'] },
          ],
          goods: [],
        },
      });

      expect(user.id).toBeDefined();
      expect(user.name).toBe('John Developer');
      expect(user.email).toBe('john@example.com');

      // Step 2: User creates a service listing
      const listing = await listingService.createListing(user.id, {
        title: 'Full-Stack Web Development',
        description: 'Professional web development services using React and Node.js',
        type: 'service',
        location: { latitude: 37.7749, longitude: -122.4194 },
        pricing: {
          basePrice: 150,
          currency: 'USD',
          pricingType: 'fixed',
        },
        tags: ['javascript', 'react', 'nodejs', 'fullstack', 'web'],
      });

      expect(listing.id).toBeDefined();
      expect(listing.providerId).toBe(user.id);
      expect(listing.isActive).toBe(true);

      // Step 3: User updates their listing
      const updatedListing = await listingService.updateListing(
        listing.id,
        user.id,
        {
          title: 'Senior Full-Stack Development',
          pricing: { basePrice: 200, currency: 'USD', pricingType: 'negotiable' },
        }
      );

      expect(updatedListing.title).toBe('Senior Full-Stack Development');
      expect(updatedListing.pricing?.basePrice).toBe(200);
      expect(updatedListing.version).toBe(1);

      // Step 4: Another user searches for services
      const searcher = await profileService.createProfile({
        name: 'Jane Manager',
        email: 'jane@example.com',
        passwordHash: 'hashed',
        location: { latitude: 37.7849, longitude: -122.4094 }, // Near SF
        resources: {
          skills: [],
          needs: [{ name: 'Web Development', tags: ['javascript', 'react'] }],
          goods: [],
        },
      });

      const searchResults = await listingService.getListings({
        type: 'service',
        search: 'development',
        location: {
          latitude: 37.7849,
          longitude: -122.4094,
          radiusKm: 50,
        },
      });

      expect(searchResults.total).toBeGreaterThanOrEqual(1);
      expect(searchResults.listings.some(l => l.id === listing.id)).toBe(true);

      // Step 5: Calculate relevance for searcher
      const relevanceScore = relevanceService.calculateListingRelevance(
        searcher,
        updatedListing
      );

      expect(relevanceScore.overall).toBeGreaterThan(0.5);
      expect(relevanceScore.reasons.length).toBeGreaterThan(0);

      // Step 6: User deactivates listing
      await listingService.deleteListing(listing.id, user.id);

      const deactivatedListing = await listingService.getListingById(listing.id);
      expect(deactivatedListing.isActive).toBe(false);

      // Step 7: Deactivated listing should not appear in search
      const activeResults = await listingService.getListings({ isActive: true });
      expect(activeResults.listings.some(l => l.id === listing.id)).toBe(false);
    });
  });

  describe('Multi-Provider Marketplace Flow', () => {
    it('should handle multiple providers and listings', async () => {
      // Create multiple providers
      const provider1 = await profileService.createProfile({
        name: 'Alice Designer',
        email: 'alice@example.com',
        passwordHash: 'hashed',
        location: { latitude: 37.7749, longitude: -122.4194 },
      });

      const provider2 = await profileService.createProfile({
        name: 'Bob Developer',
        email: 'bob@example.com',
        passwordHash: 'hashed',
        location: { latitude: 40.7128, longitude: -74.0060 },
      });

      const provider3 = await profileService.createProfile({
        name: 'Charlie Writer',
        email: 'charlie@example.com',
        passwordHash: 'hashed',
        location: { latitude: 51.5074, longitude: -0.1278 },
      });

      // Each provider creates multiple listings
      const aliceListings = [
        await listingService.createListing(provider1.id, {
          title: 'UI/UX Design',
          description: 'Modern UI/UX design services',
          type: 'service',
          tags: ['design', 'ui', 'ux'],
        }),
        await listingService.createListing(provider1.id, {
          title: 'Logo Design',
          description: 'Professional logo design',
          type: 'service',
          tags: ['design', 'logo', 'branding'],
        }),
      ];

      const bobListings = [
        await listingService.createListing(provider2.id, {
          title: 'Web Development',
          description: 'Full-stack web development',
          type: 'service',
          tags: ['development', 'web', 'javascript'],
        }),
        await listingService.createListing(provider2.id, {
          title: 'API Development',
          description: 'RESTful API design and development',
          type: 'service',
          tags: ['development', 'api', 'backend'],
        }),
      ];

      const charlieListings = [
        await listingService.createListing(provider3.id, {
          title: 'Content Writing',
          description: 'Professional content writing',
          type: 'service',
          tags: ['writing', 'content', 'copywriting'],
        }),
      ];

      // Get all listings
      const allListings = await listingService.getListings();
      expect(allListings.total).toBe(5);

      // Filter by type
      const designListings = await listingService.getListings({ type: 'service' });
      expect(designListings.total).toBe(5);

      // Filter by provider
      const aliceListingsResult = await listingService.getListings({ providerId: provider1.id });
      expect(aliceListingsResult.total).toBe(2);

      // Filter by tags
      const devListings = await listingService.getListings({ tags: ['development'] });
      expect(devListings.total).toBe(2);

      // Search by keyword
      const designSearch = await listingService.getListings({ search: 'design' });
      expect(designSearch.total).toBe(2);

      // Location-based filtering (SF area)
      const sfListings = await listingService.getListings({
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          radiusKm: 100,
        },
      });
      expect(sfListings.total).toBe(2); // Alice's listings

      // Pagination
      const page1 = await listingService.getListings({ limit: 2, offset: 0 });
      expect(page1.listings.length).toBe(2);
      expect(page1.total).toBe(5);

      const page2 = await listingService.getListings({ limit: 2, offset: 2 });
      expect(page2.listings.length).toBe(2);

      const page3 = await listingService.getListings({ limit: 2, offset: 4 });
      expect(page3.listings.length).toBe(1);
    });
  });

  describe('Relevance-Based Discovery Flow', () => {
    it('should rank listings by relevance for user', async () => {
      // Create user with specific profile
      const user: Profile = {
        id: 'user-123',
        name: 'Tech Startup',
        email: 'startup@example.com',
        passwordHash: 'hashed',
        location: { latitude: 37.7749, longitude: -122.4194 }, // SF
        resources: {
          skills: [
            { name: 'Product Management', tags: ['product', 'management'] },
          ],
          needs: [
            { name: 'Frontend Development', tags: ['react', 'javascript', 'frontend'] },
            { name: 'Backend Development', tags: ['nodejs', 'api', 'backend'] },
            { name: 'DevOps', tags: ['aws', 'docker', 'kubernetes'] },
          ],
          goods: [],
        },
        reputation: { overall: 0.7, reliability: 0.6 },
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create listings with varying relevance
      const highlyRelevantListing: ServiceListing = {
        id: 'highly-relevant',
        title: 'React Developer',
        description: 'Expert React developer with Node.js backend skills',
        type: 'service',
        providerId: 'provider-1',
        location: { latitude: 37.7849, longitude: -122.4094 }, // Near SF
        tags: ['react', 'javascript', 'frontend', 'nodejs', 'backend'],
        pricing: { basePrice: 150, currency: 'USD', pricingType: 'fixed' },
        availability: [],
        requirements: [],
        qualityMetrics: { rating: 0.9, reliability: 0.85, durability: 0.7, functionality: 0.9, aesthetics: 0.8, sustainability: 0.6 },
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const moderatelyRelevantListing: ServiceListing = {
        id: 'moderately-relevant',
        title: 'Full-Stack Developer',
        description: 'General web development',
        type: 'service',
        providerId: 'provider-2',
        location: { latitude: 34.0522, longitude: -118.2437 }, // LA (farther)
        tags: ['javascript', 'web', 'development'],
        pricing: { basePrice: 100, currency: 'USD', pricingType: 'fixed' },
        availability: [],
        requirements: [],
        qualityMetrics: { rating: 0.7, reliability: 0.65, durability: 0.6, functionality: 0.7, aesthetics: 0.6, sustainability: 0.5 },
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const lowRelevanceListing: ServiceListing = {
        id: 'low-relevant',
        title: 'Graphic Designer',
        description: 'Logo and brand design',
        type: 'service',
        providerId: 'provider-3',
        location: { latitude: 51.5074, longitude: -0.1278 }, // London (very far)
        tags: ['design', 'graphics', 'branding'],
        pricing: { basePrice: 80, currency: 'USD', pricingType: 'fixed' },
        availability: [],
        requirements: [],
        qualityMetrics: { rating: 0.8, reliability: 0.75, durability: 0.7, functionality: 0.6, aesthetics: 0.9, sustainability: 0.5 },
        isActive: true,
        version: 0,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Old
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      };

      const listings = [
        lowRelevanceListing,
        moderatelyRelevantListing,
        highlyRelevantListing,
      ];

      // Sort by relevance
      const sorted = relevanceService.sortListingsByRelevance(user, listings);

      // Verify ordering
      expect(sorted[0].id).toBe('highly-relevant');
      expect(sorted[1].id).toBe('moderately-relevant');
      expect(sorted[2].id).toBe('low-relevant');

      // Verify scores decrease
      const score1 = relevanceService.calculateListingRelevance(user, sorted[0]).overall;
      const score2 = relevanceService.calculateListingRelevance(user, sorted[1]).overall;
      const score3 = relevanceService.calculateListingRelevance(user, sorted[2]).overall;

      expect(score1).toBeGreaterThan(score2);
      expect(score2).toBeGreaterThan(score3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent modifications gracefully', async () => {
      const provider = await profileService.createProfile({
        name: 'Provider',
        email: 'provider@example.com',
        passwordHash: 'hashed',
        location: { latitude: 37.7749, longitude: -122.4194 },
      });

      const listing = await listingService.createListing(provider.id, {
        title: 'Original',
        description: 'Description',
        type: 'service',
      });

      // Simulate concurrent updates
      const update1 = listingService.updateListing(
        listing.id,
        provider.id,
        { title: 'Update 1' },
        0
      );

      const update2 = listingService.updateListing(
        listing.id,
        provider.id,
        { title: 'Update 2' },
        0
      );

      // One should succeed, one should fail
      const results = await Promise.allSettled([update1, update2]);
      
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    });

    it('should handle empty search results', async () => {
      const results = await listingService.getListings({
        search: 'nonexistent-term-xyz',
        type: 'service',
      });

      expect(results.total).toBe(0);
      expect(results.listings.length).toBe(0);
    });

    it('should handle boundary conditions in pagination', async () => {
      // Create exactly 100 listings
      const provider = await profileService.createProfile({
        name: 'Provider',
        email: 'provider@example.com',
        passwordHash: 'hashed',
        location: { latitude: 37.7749, longitude: -122.4194 },
      });

      for (let i = 0; i < 100; i++) {
        await listingService.createListing(provider.id, {
          title: `Listing ${i}`,
          description: `Description ${i}`,
          type: 'service',
        });
      }

      // Request more than max page size
      const result = await listingService.getListings({ limit: 200 });
      expect(result.limit).toBe(100);
      expect(result.listings.length).toBe(100);

      // Request beyond total
      const beyondResult = await listingService.getListings({ limit: 10, offset: 1000 });
      expect(beyondResult.listings.length).toBe(0);
    });
  });
});
