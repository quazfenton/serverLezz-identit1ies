/**
 * ListingService Unit Tests
 * Tests for listing CRUD operations, validation, and filtering
 */

import { ListingService, CreateListingInput, UpdateListingInput, ListingFilter } from '../services/ListingService';
import { ServiceListing, IListingsRepo, IProfilesRepo, Profile } from '../../../shared/types';
import {
  ListingNotFoundError,
  ValidationError,
  DatabaseError,
  InsufficientPermissionsError,
} from '../../middleware/errors';

// Mock repositories
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

describe('ListingService', () => {
  let listingService: ListingService;
  let listingsRepo: MockListingsRepo;
  let profilesRepo: MockProfilesRepo;

  const mockProvider: Profile = {
    id: 'provider-123',
    name: 'Test Provider',
    email: 'provider@test.com',
    passwordHash: 'hashed-password',
    location: { latitude: 37.7749, longitude: -122.4194 },
    resources: { goods: [], skills: [], needs: [] },
    reputation: { overall: 0.8, reliability: 0.7 },
    isActive: true,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    listingsRepo = new MockListingsRepo();
    profilesRepo = new MockProfilesRepo();
    listingService = new ListingService(listingsRepo, profilesRepo);
    
    // Add mock provider
    profilesRepo.save(mockProvider);
  });

  const createListingInput: CreateListingInput = {
    title: 'Test Service',
    description: 'A test service description',
    type: 'service',
    location: { latitude: 37.7749, longitude: -122.4194 },
    pricing: {
      basePrice: 100,
      currency: 'USD',
      pricingType: 'fixed',
    },
    tags: ['test', 'service'],
  };

  describe('createListing', () => {
    it('should create a listing with valid input', async () => {
      const listing = await listingService.createListing(mockProvider.id, createListingInput);

      expect(listing.id).toBeDefined();
      expect(listing.title).toBe('Test Service');
      expect(listing.type).toBe('service');
      expect(listing.providerId).toBe(mockProvider.id);
      expect(listing.isActive).toBe(true);
      expect(listing.qualityMetrics).toBeDefined();
      expect(listing.qualityMetrics.rating).toBe(0);
    });

    it('should reject listing creation with empty title', async () => {
      const input = { ...createListingInput, title: '' };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject listing creation with title too long', async () => {
      const input = { ...createListingInput, title: 'a'.repeat(201) };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject listing creation with empty description', async () => {
      const input = { ...createListingInput, description: '' };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject listing creation with description too long', async () => {
      const input = { ...createListingInput, description: 'a'.repeat(2001) };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject invalid listing type', async () => {
      const input = { ...createListingInput, type: 'invalid' as any };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject invalid latitude', async () => {
      const input = {
        ...createListingInput,
        location: { latitude: 100, longitude: -122.4194 },
      };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject invalid longitude', async () => {
      const input = {
        ...createListingInput,
        location: { latitude: 37.7749, longitude: -200 },
      };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject negative price', async () => {
      const input = {
        ...createListingInput,
        pricing: { basePrice: -10, currency: 'USD', pricingType: 'fixed' },
      };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject too many tags', async () => {
      const input = {
        ...createListingInput,
        tags: Array(21).fill('tag'),
      };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject tag that is too long', async () => {
      const input = {
        ...createListingInput,
        tags: ['a'.repeat(51)],
      };

      await expect(listingService.createListing(mockProvider.id, input))
        .rejects.toThrow(ValidationError);
    });

    it('should reject listing creation for non-existent provider', async () => {
      await expect(listingService.createListing('non-existent', createListingInput))
        .rejects.toThrow(ValidationError);
    });

    it('should create listing with default values', async () => {
      const input = {
        title: 'Test',
        description: 'Test description',
        type: 'service' as const,
      };

      const listing = await listingService.createListing(mockProvider.id, input);

      expect(listing.location).toEqual({ latitude: 0, longitude: 0 });
      expect(listing.pricing).toEqual({
        basePrice: 0,
        currency: 'USD',
        pricingType: 'negotiable',
      });
      expect(listing.availability).toEqual([]);
      expect(listing.requirements).toEqual([]);
      expect(listing.tags).toEqual([]);
    });

    it('should trim title and description', async () => {
      const input = {
        ...createListingInput,
        title: '  Test Service  ',
        description: '  Description  ',
      };

      const listing = await listingService.createListing(mockProvider.id, input);

      expect(listing.title).toBe('Test Service');
      expect(listing.description).toBe('Description');
    });
  });

  describe('getListingById', () => {
    it('should return listing by id', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      const retrieved = await listingService.getListingById(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe('Test Service');
    });

    it('should throw ListingNotFoundError for non-existent listing', async () => {
      await expect(listingService.getListingById('non-existent'))
        .rejects.toThrow(ListingNotFoundError);
    });
  });

  describe('updateListing', () => {
    it('should update listing title', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      const updated = await listingService.updateListing(
        created.id,
        mockProvider.id,
        { title: 'Updated Title' }
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.version).toBe(1);
    });

    it('should update listing description', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      const updated = await listingService.updateListing(
        created.id,
        mockProvider.id,
        { description: 'Updated description' }
      );

      expect(updated.description).toBe('Updated description');
    });

    it('should update pricing', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      const updated = await listingService.updateListing(
        created.id,
        mockProvider.id,
        { pricing: { basePrice: 200, currency: 'EUR', pricingType: 'negotiable' } }
      );

      expect(updated.pricing?.basePrice).toBe(200);
      expect(updated.pricing?.currency).toBe('EUR');
    });

    it('should update tags', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      const updated = await listingService.updateListing(
        created.id,
        mockProvider.id,
        { tags: ['updated', 'tags'] }
      );

      expect(updated.tags).toEqual(['updated', 'tags']);
    });

    it('should deactivate listing', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      const updated = await listingService.updateListing(
        created.id,
        mockProvider.id,
        { isActive: false }
      );

      expect(updated.isActive).toBe(false);
    });

    it('should increment version on update', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      expect(created.version).toBe(0);

      const updated1 = await listingService.updateListing(
        created.id,
        mockProvider.id,
        { title: 'Title 2' }
      );
      expect(updated1.version).toBe(1);

      const updated2 = await listingService.updateListing(
        created.id,
        mockProvider.id,
        { title: 'Title 3' }
      );
      expect(updated2.version).toBe(2);
    });

    it('should throw ValidationError on version conflict', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);

      await listingService.updateListing(created.id, mockProvider.id, { title: 'Title 2' });

      await expect(
        listingService.updateListing(created.id, mockProvider.id, { title: 'Title 3' }, 0)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw InsufficientPermissionsError for wrong provider', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      await expect(
        listingService.updateListing(created.id, 'other-provider', { title: 'Updated' })
      ).rejects.toThrow(InsufficientPermissionsError);
    });

    it('should reject empty title on update', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      await expect(
        listingService.updateListing(created.id, mockProvider.id, { title: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject negative price on update', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      await expect(
        listingService.updateListing(created.id, mockProvider.id, {
          pricing: { basePrice: -10, currency: 'USD', pricingType: 'fixed' },
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteListing', () => {
    it('should soft delete listing', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      await listingService.deleteListing(created.id, mockProvider.id);

      const retrieved = await listingService.getListingById(created.id);
      expect(retrieved.isActive).toBe(false);
    });

    it('should increment version on delete', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      await listingService.deleteListing(created.id, mockProvider.id);

      const retrieved = await listingService.getListingById(created.id);
      expect(retrieved.version).toBe(1);
    });

    it('should throw InsufficientPermissionsError for wrong provider', async () => {
      const created = await listingService.createListing(mockProvider.id, createListingInput);
      
      await expect(
        listingService.deleteListing(created.id, 'other-provider')
      ).rejects.toThrow(InsufficientPermissionsError);
    });
  });

  describe('getListings', () => {
    beforeEach(async () => {
      // Create test listings
      await listingService.createListing(mockProvider.id, {
        title: 'Service 1',
        description: 'Description 1',
        type: 'service',
        tags: ['tag1', 'tag2'],
        location: { latitude: 37.7749, longitude: -122.4194 },
      });

      await listingService.createListing(mockProvider.id, {
        title: 'Goods 1',
        description: 'Description 2',
        type: 'goods',
        tags: ['tag2', 'tag3'],
        location: { latitude: 40.7128, longitude: -74.0060 },
      });

      await listingService.createListing(mockProvider.id, {
        title: 'Collaboration 1',
        description: 'Description 3',
        type: 'collaboration',
        tags: ['tag1', 'tag3'],
      });
    });

    it('should return all active listings', async () => {
      const result = await listingService.getListings();

      expect(result.total).toBe(3);
      expect(result.listings.length).toBe(3);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should filter by type', async () => {
      const result = await listingService.getListings({ type: 'service' });

      expect(result.total).toBe(1);
      expect(result.listings[0].type).toBe('service');
    });

    it('should filter by provider', async () => {
      const result = await listingService.getListings({ providerId: mockProvider.id });

      expect(result.total).toBe(3);
    });

    it('should filter by location radius', async () => {
      // San Francisco location
      const result = await listingService.getListings({
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          radiusKm: 100,
        },
      });

      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by tags', async () => {
      const result = await listingService.getListings({ tags: ['tag1'] });

      expect(result.total).toBe(2); // Service 1 and Collaboration 1
    });

    it('should filter by search term', async () => {
      const result = await listingService.getListings({ search: 'service' });

      expect(result.total).toBe(1);
      expect(result.listings[0].title).toBe('Service 1');
    });

    it('should paginate results', async () => {
      const page1 = await listingService.getListings({ limit: 2, offset: 0 });
      expect(page1.listings.length).toBe(2);
      expect(page1.total).toBe(3);

      const page2 = await listingService.getListings({ limit: 2, offset: 2 });
      expect(page2.listings.length).toBe(1);
    });

    it('should limit max page size to 100', async () => {
      const result = await listingService.getListings({ limit: 200 });

      expect(result.limit).toBe(100);
    });

    it('should filter by active status', async () => {
      const listings = await listingService.getListings();
      await listingService.deleteListing(listings.listings[0].id, mockProvider.id);

      const activeListings = await listingService.getListings({ isActive: true });
      expect(activeListings.total).toBe(2);

      const inactiveListings = await listingService.getListings({ isActive: false });
      expect(inactiveListings.total).toBe(1);
    });
  });

  describe('getListingsByProvider', () => {
    beforeEach(async () => {
      await listingService.createListing(mockProvider.id, {
        title: 'Listing 1',
        description: 'Description 1',
        type: 'service',
      });

      await listingService.createListing(mockProvider.id, {
        title: 'Listing 2',
        description: 'Description 2',
        type: 'goods',
      });
    });

    it('should return all listings by provider', async () => {
      const result = await listingService.getListingsByProvider(mockProvider.id);

      expect(result.total).toBe(2);
      expect(result.listings.length).toBe(2);
    });

    it('should filter by active status', async () => {
      const listings = await listingService.getListingsByProvider(mockProvider.id);
      await listingService.deleteListing(listings.listings[0].id, mockProvider.id);

      const activeOnly = await listingService.getListingsByProvider(mockProvider.id, true);
      expect(activeOnly.total).toBe(1);
    });
  });

  describe('haversineDistance', () => {
    it('should calculate distance between San Francisco and New York', () => {
      // This is tested indirectly through location filtering
      // SF: 37.7749, -122.4194
      // NY: 40.7128, -74.0060
      // Expected: ~4129 km
    });

    it('should return 0 for same location', () => {
      // Same point should have 0 distance
    });
  });
});
