// Database adapter that can work with or without Prisma
// Falls back to in-memory storage if Prisma/database is unavailable

import { Profile, ServiceListing, Connection } from '../../shared/types';
import { ProfilesRepo } from '../repos/ProfilesRepo';
import { ListingsRepo } from '../repos/ListingsRepo';
import { ConnectionsRepo } from '../repos/ConnectionsRepo';

// Attempt to import PrismaClient - may not be generated yet
// eslint-disable-next-line @typescript-eslint/no-var-requires
let PrismaClient: any;
try {
  // Dynamic require so build doesn't fail if @prisma/client is missing
  const mod = eval("require")('@prisma/client');
  PrismaClient = mod.PrismaClient;
} catch {
  PrismaClient = null;
}

// Database adapter for profiles
export class DatabaseProfilesRepo {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  async getById(id: string): Promise<Profile | undefined> {
    try {
      const dbProfile = await this.prisma.profile.findUnique({
        where: { id },
        include: {
          listings: true,
          connections: true,
        },
      });

      if (!dbProfile) return undefined;

      return this.mapDbProfileToProfile(dbProfile);
    } catch (error) {
      console.error('Database error getting profile:', error);
      return undefined;
    }
  }

  async save(profile: Profile): Promise<void> {
    try {
      const dbProfile = this.mapProfileToDbProfile(profile);

      await this.prisma.profile.upsert({
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
      const dbProfiles = await this.prisma.profile.findMany({
        include: {
          listings: true,
          connections: true,
        },
      });

      return dbProfiles.map((p: any) => this.mapDbProfileToProfile(p));
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
      seekings: [],
      offerings: [],
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
      tags: profile.resources.goods.map((g: any) => g.name).concat(
        profile.resources.skills.map((s: any) => s.name)
      ),
      isActive: profile.isActive,
    };
  }
}

// Database adapter for listings
export class DatabaseListingsRepo {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  async getById(id: string): Promise<ServiceListing | undefined> {
    try {
      const dbListing = await this.prisma.listing.findUnique({
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

      await this.prisma.listing.upsert({
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
      const dbListings = await this.prisma.listing.findMany({
        include: { provider: true },
        where: { status: 'active' },
      });

      return dbListings.map((l: any) => this.mapDbListingToServiceListing(l));
    } catch (error) {
      console.error('Database error getting all listings:', error);
      return [];
    }
  }

  async byProvider(providerId: string): Promise<ServiceListing[]> {
    try {
      const dbListings = await this.prisma.listing.findMany({
        where: { providerId, status: 'active' },
        include: { provider: true },
      });

      return dbListings.map((l: any) => this.mapDbListingToServiceListing(l));
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
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  async create(connection: Connection): Promise<Connection> {
    try {
      const dbConnection = await this.prisma.connection.create({
        data: {
          fromId: connection.profileA,
          toId: connection.profileB,
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
      const dbConnections = await this.prisma.connection.findMany({
        where: {
          OR: [
            { fromId: profileId },
            { toId: profileId },
          ],
        },
      });

      return dbConnections.map((c: any) => this.mapDbConnectionToConnection(c));
    } catch (error) {
      console.error('Database error getting profile connections:', error);
      return [];
    }
  }

  async getById(id: string): Promise<Connection | undefined> {
    try {
      const dbConnection = await this.prisma.connection.findUnique({
        where: { id },
      });

      if (!dbConnection) return undefined;

      return this.mapDbConnectionToConnection(dbConnection);
    } catch (error) {
      console.error('Database error getting connection:', error);
      return undefined;
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
      fromProfileId: dbConnection.fromId,
      toProfileId: dbConnection.toId,
      status: dbConnection.status,
      lastUsed: new Date(dbConnection.updatedAt || Date.now()),
    };
  }
}

// Initialize database adapters with automatic fallback to in-memory
export async function initializeDatabaseAdapters(): Promise<{
  profilesRepo: DatabaseProfilesRepo | ProfilesRepo;
  listingsRepo: DatabaseListingsRepo | ListingsRepo;
  connectionsRepo: DatabaseConnectionsRepo | ConnectionsRepo;
}> {
  // Try to connect with Prisma
  if (PrismaClient) {
    try {
      const prisma = new PrismaClient();
      await prisma.$connect();
      console.log('✅ Database connected via Prisma');

      return {
        profilesRepo: new DatabaseProfilesRepo(prisma),
        listingsRepo: new DatabaseListingsRepo(prisma),
        connectionsRepo: new DatabaseConnectionsRepo(prisma),
      };
    } catch (error) {
      console.warn('⚠️  Prisma connection failed, falling back to in-memory storage:', error);
    }
  } else {
    console.warn('⚠️  @prisma/client not available (not installed or not generated), using in-memory storage');
  }

  // Fallback to in-memory repos
  console.log('📦 Using in-memory storage adapters');
  return {
    profilesRepo: new ProfilesRepo(),
    listingsRepo: new ListingsRepo(),
    connectionsRepo: new ConnectionsRepo(),
  };
}
