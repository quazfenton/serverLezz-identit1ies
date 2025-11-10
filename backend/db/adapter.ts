// Database adapter that can work with or without Prisma
// This provides a clean interface that can be backed by in-memory storage or database

import { PrismaClient } from '@prisma/client';
import { Profile, ServiceListing, Connection } from '../../shared/types';

const prisma = new PrismaClient();

// Database adapter for profiles
export class DatabaseProfilesRepo {
  async getById(id: string): Promise<Profile | undefined> {
    try {
      const dbProfile = await prisma.profile.findUnique({
        where: { id },
        include: {
          listings: true,
          connections: true,
        },
      });

      if (!dbProfile) return undefined;

      // Convert database model to shared type
      return this.mapDbProfileToProfile(dbProfile);
    } catch (error) {
      console.error('Database error getting profile:', error);
      return undefined;
    }
  }

  async save(profile: Profile): Promise<void> {
    try {
      const dbProfile = this.mapProfileToDbProfile(profile);
      
      await prisma.profile.upsert({
        where: { id: profile.id },
        update: dbProfile,
        create: dbProfile,
      });
    } catch (error) {
      console.error('Database error saving profile:', error);
      throw error;
    }
  }

  async getAll(): Promise<Profile[]> {
    try {
      const dbProfiles = await prisma.profile.findMany({
        include: {
          listings: true,
          connections: true,
        },
      });

      return dbProfiles.map(this.mapDbProfileToProfile);
    } catch (error) {
      console.error('Database error getting all profiles:', error);
      return [];
    }
  }

  private mapDbProfileToProfile(dbProfile: any): Profile {
    return {
      id: dbProfile.id,
      name: dbProfile.name,
      avatar: dbProfile.avatar || '',
      location: {
        latitude: dbProfile.latitude || 0,
        longitude: dbProfile.longitude || 0,
      },
      resources: dbProfile.resources || {
        goods: [],
        skills: [],
        needs: [],
        timeAvailable: [],
        preferences: {},
      },
      weight: dbProfile.weight || 0.5,
      reputation: dbProfile.reputation || {
        overall: 0.5,
        reliability: 0.5,
        quality: 0.5,
        responsiveness: 0.5,
        fairness: 0.5,
        trustworthiness: 0.5,
        socialImpact: 0.5,
        history: [],
      },
      economicProfile: dbProfile.economicProfile || {
        totalUtility: 0,
        wealthLevel: 0.5,
        spendingPower: 0.5,
        savingsRate: 0.5,
        riskTolerance: 0.5,
        preferredPaymentMethods: [],
        creditScore: 0,
        transactionHistory: [],
        valueAlignment: {
          community: 0.5,
          sustainability: 0.5,
          innovation: 0.5,
          fairness: 0.5,
        },
      },
      behaviorProfile: dbProfile.behaviorProfile || {
        interactionPatterns: [],
        preferences: {},
        predictedActions: [],
        adaptationRate: 0.5,
        consistencyScore: 0.5,
        socialStyle: 'balanced',
        decisionMakingStyle: 'analytical',
      },
      lastUpdated: dbProfile.updatedAt,
      isActive: dbProfile.isActive,
    };
  }

  private mapProfileToDbProfile(profile: Profile): any {
    return {
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar,
      latitude: profile.location.latitude,
      longitude: profile.location.longitude,
      resources: profile.resources,
      economicProfile: profile.economicProfile,
      behaviorProfile: profile.behaviorProfile,
      reputation: profile.reputation,
      weight: profile.weight,
      tags: profile.resources.goods.map(g => g.name).concat(
        profile.resources.skills.map(s => s.name)
      ),
      isActive: profile.isActive,
    };
  }
}

// Database adapter for listings
export class DatabaseListingsRepo {
  async getById(id: string): Promise<ServiceListing | undefined> {
    try {
      const dbListing = await prisma.listing.findUnique({
        where: { id },
        include: { provider: true },
      });

      if (!dbListing) return undefined;

      return this.mapDbListingToServiceListing(dbListing);
    } catch (error) {
      console.error('Database error getting listing:', error);
      return undefined;
    }
  }

  async save(listing: ServiceListing): Promise<void> {
    try {
      const dbListing = this.mapServiceListingToDbListing(listing);
      
      await prisma.listing.upsert({
        where: { id: listing.id },
        update: dbListing,
        create: dbListing,
      });
    } catch (error) {
      console.error('Database error saving listing:', error);
      throw error;
    }
  }

  async getAll(): Promise<ServiceListing[]> {
    try {
      const dbListings = await prisma.listing.findMany({
        include: { provider: true },
        where: { status: 'active' },
      });

      return dbListings.map(this.mapDbListingToServiceListing);
    } catch (error) {
      console.error('Database error getting all listings:', error);
      return [];
    }
  }

  async byProvider(providerId: string): Promise<ServiceListing[]> {
    try {
      const dbListings = await prisma.listing.findMany({
        where: { providerId, status: 'active' },
        include: { provider: true },
      });

      return dbListings.map(this.mapDbListingToServiceListing);
    } catch (error) {
      console.error('Database error getting provider listings:', error);
      return [];
    }
  }

  private mapDbListingToServiceListing(dbListing: any): ServiceListing {
    return {
      id: dbListing.id,
      title: dbListing.title,
      description: dbListing.description,
      type: dbListing.type,
      providerId: dbListing.providerId,
      location: {
        latitude: dbListing.latitude || 0,
        longitude: dbListing.longitude || 0,
      },
      pricing: dbListing.pricing || {
        basePrice: 0,
        currency: 'USD',
        pricingType: 'negotiable',
      },
      availability: dbListing.availability || [],
      requirements: dbListing.requirements || [],
      tags: dbListing.tags || [],
      qualityMetrics: dbListing.qualityMetrics || {
        rating: 0,
        reliability: 0.5,
        durability: 0.5,
        functionality: 0.5,
        aesthetics: 0.5,
        sustainability: 0.5,
      },
      createdAt: dbListing.createdAt,
      updatedAt: dbListing.updatedAt,
      isActive: dbListing.status === 'active',
    };
  }

  private mapServiceListingToDbListing(listing: ServiceListing): any {
    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      type: listing.type,
      providerId: listing.providerId,
      latitude: listing.location.latitude,
      longitude: listing.location.longitude,
      pricing: listing.pricing,
      availability: listing.availability,
      requirements: listing.requirements,
      tags: listing.tags,
      qualityMetrics: listing.qualityMetrics,
      status: listing.isActive ? 'active' : 'inactive',
    };
  }
}

// Database adapter for connections
export class DatabaseConnectionsRepo {
  async create(connection: Connection): Promise<Connection> {
    try {
      const dbConnection = await prisma.connection.create({
        data: {
          fromId: connection.profileA,  // Map profileA to fromId
          toId: connection.profileB,    // Map profileB to toId
          strength: connection.strength,
          status: connection.status || 'active',
        },
      });

      return this.mapDbConnectionToConnection(dbConnection);
    } catch (error) {
      console.error('Database error creating connection:', error);
      throw error;
    }
  }

  async getByProfile(profileId: string): Promise<Connection[]> {
    try {
      const dbConnections = await prisma.connection.findMany({
        where: {
          OR: [
            { fromId: profileId },
            { toId: profileId },
          ],
        },
      });

      return dbConnections.map(this.mapDbConnectionToConnection);
    } catch (error) {
      console.error('Database error getting profile connections:', error);
      return [];
    }
  }

  private mapDbConnectionToConnection(dbConnection: any): Connection {
    return {
      id: dbConnection.id,
      profileA: dbConnection.fromId,
      profileB: dbConnection.toId,
      strength: dbConnection.strength,
      type: dbConnection.type || 'social',
      history: dbConnection.history || [],
      lastInteraction: new Date(dbConnection.updatedAt || Date.now()),
      // Map database fields to optional Connection interface fields
      fromProfileId: dbConnection.fromId,
      toProfileId: dbConnection.toId,
      status: dbConnection.status,
      lastUsed: new Date(dbConnection.updatedAt || Date.now()),
    };
  }
}

// Export a function to initialize the database adapters
export function initializeDatabaseAdapters() {
  console.log('Database adapters initialized with Prisma');
  return {
    profilesRepo: new DatabaseProfilesRepo(),
    listingsRepo: new DatabaseListingsRepo(),
    connectionsRepo: new DatabaseConnectionsRepo(),
  };
}

// Export the Prisma client for direct use if needed
export { prisma };
