/**
 * ProfileService Unit Tests
 */

import { ProfileService } from '../services/ProfileService';
import { IProfilesRepo, Profile } from '../../shared/types';
import { ProfileNotFoundError, ValidationError, ConflictError } from '../../middleware/errors';

// Mock repository
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
}

describe('ProfileService', () => {
  let profileService: ProfileService;
  let mockRepo: MockProfilesRepo;

  beforeEach(() => {
    mockRepo = new MockProfilesRepo();
    profileService = new ProfileService(mockRepo);
  });

  describe('createProfile', () => {
    it('should create a profile with valid input', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const profile = await profileService.createProfile(input);

      expect(profile.name).toBe('Test User');
      expect(profile.location.latitude).toBe(37.7749);
      expect(profile.isActive).toBe(true);
      expect(profile.id).toBeDefined();
    });

    it('should reject profile creation with empty name', async () => {
      const input = {
        name: '',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      await expect(profileService.createProfile(input)).rejects.toThrow(ValidationError);
    });

    it('should reject profile creation with name too long', async () => {
      const input = {
        name: 'a'.repeat(101),
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      await expect(profileService.createProfile(input)).rejects.toThrow(ValidationError);
    });

    it('should reject profile creation with invalid latitude', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 100, longitude: -122.4194 },
      };

      await expect(profileService.createProfile(input)).rejects.toThrow(ValidationError);
    });

    it('should reject profile creation with invalid longitude', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -200 },
      };

      await expect(profileService.createProfile(input)).rejects.toThrow(ValidationError);
    });

    it('should create profile with default resources', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const profile = await profileService.createProfile(input);

      expect(profile.resources.goods).toEqual([]);
      expect(profile.resources.skills).toEqual([]);
      expect(profile.resources.needs).toEqual([]);
    });

    it('should create profile with default reputation', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const profile = await profileService.createProfile(input);

      expect(profile.reputation.overall).toBe(0.5);
      expect(profile.reputation.reliability).toBe(0.5);
    });

    it('should create profile with default economic profile', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const profile = await profileService.createProfile(input);

      expect(profile.economicProfile.wealthLevel).toBe(0.5);
      expect(profile.economicProfile.valueAlignment.community).toBe(0.5);
    });
  });

  describe('getProfileById', () => {
    it('should return profile by id', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const created = await profileService.createProfile(input);
      const retrieved = await profileService.getProfileById(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Test User');
    });

    it('should throw ProfileNotFoundError for non-existent profile', async () => {
      await expect(profileService.getProfileById('non-existent-id'))
        .rejects.toThrow(ProfileNotFoundError);
    });
  });

  describe('updateProfile', () => {
    it('should update profile name', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const created = await profileService.createProfile(input);
      const updated = await profileService.updateProfile(created.id, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
      expect(updated.version).toBe(1);
    });

    it('should update profile location', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const created = await profileService.createProfile(input);
      const updated = await profileService.updateProfile(created.id, {
        location: { latitude: 40.7128, longitude: -74.0060 },
      });

      expect(updated.location.latitude).toBe(40.7128);
      expect(updated.location.longitude).toBe(-74.0060);
    });

    it('should increment version on update', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const created = await profileService.createProfile(input);
      expect(created.version).toBe(0);

      const updated1 = await profileService.updateProfile(created.id, { name: 'Name 2' });
      expect(updated1.version).toBe(1);

      const updated2 = await profileService.updateProfile(created.id, { name: 'Name 3' });
      expect(updated2.version).toBe(2);
    });

    it('should throw ValidationError on version conflict', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const created = await profileService.createProfile(input);
      
      // Update once
      await profileService.updateProfile(created.id, { name: 'Name 2' });
      
      // Try to update with old version
      await expect(
        profileService.updateProfile(created.id, { name: 'Name 3' }, 0)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject update with empty name', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const created = await profileService.createProfile(input);

      await expect(
        profileService.updateProfile(created.id, { name: '' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteProfile', () => {
    it('should soft delete profile', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const created = await profileService.createProfile(input);
      await profileService.deleteProfile(created.id);

      const retrieved = await profileService.getProfileById(created.id);
      expect(retrieved.isActive).toBe(false);
    });

    it('should increment version on delete', async () => {
      const input = {
        name: 'Test User',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const created = await profileService.createProfile(input);
      await profileService.deleteProfile(created.id);

      const retrieved = await profileService.getProfileById(created.id);
      expect(retrieved.version).toBe(1);
    });
  });

  describe('getProfiles', () => {
    it('should return all profiles', async () => {
      await profileService.createProfile({
        name: 'User 1',
        location: { latitude: 37.7749, longitude: -122.4194 },
      });

      await profileService.createProfile({
        name: 'User 2',
        location: { latitude: 40.7128, longitude: -74.0060 },
      });

      const result = await profileService.getProfiles();

      expect(result.total).toBe(2);
      expect(result.profiles.length).toBe(2);
    });

    it('should filter by active status', async () => {
      const user1 = await profileService.createProfile({
        name: 'User 1',
        location: { latitude: 37.7749, longitude: -122.4194 },
      });

      await profileService.createProfile({
        name: 'User 2',
        location: { latitude: 40.7128, longitude: -74.0060 },
      });

      await profileService.deleteProfile(user1.id);

      const result = await profileService.getProfiles({ isActive: true });
      expect(result.total).toBe(1);
      expect(result.profiles[0].name).toBe('User 2');
    });

    it('should paginate results', async () => {
      for (let i = 1; i <= 25; i++) {
        await profileService.createProfile({
          name: `User ${i}`,
          location: { latitude: 37.7749, longitude: -122.4194 },
        });
      }

      const page1 = await profileService.getProfiles({ limit: 10, offset: 0 });
      expect(page1.profiles.length).toBe(10);
      expect(page1.total).toBe(25);

      const page2 = await profileService.getProfiles({ limit: 10, offset: 10 });
      expect(page2.profiles.length).toBe(10);

      const page3 = await profileService.getProfiles({ limit: 10, offset: 20 });
      expect(page3.profiles.length).toBe(5);
    });

    it('should limit max page size to 100', async () => {
      const result = await profileService.getProfiles({ limit: 200 });
      expect(result.limit).toBe(100);
    });
  });

  describe('findByEmail', () => {
    it('should find profile by email', async () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      await profileService.createProfile(input);
      const found = await profileService.findByEmail('test@example.com');

      expect(found).toBeDefined();
      expect(found?.email).toBe('test@example.com');
    });

    it('should return undefined for non-existent email', async () => {
      const found = await profileService.findByEmail('nonexistent@example.com');
      expect(found).toBeUndefined();
    });

    it('should find email case-insensitively', async () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      await profileService.createProfile(input);
      const found = await profileService.findByEmail('TEST@EXAMPLE.COM');

      expect(found).toBeDefined();
      expect(found?.email).toBe('test@example.com');
    });
  });
});
