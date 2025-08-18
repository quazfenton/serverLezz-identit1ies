import express from "express";
import cors from "cors";
import { initializeDatabaseAdapters } from './db/adapter';
import { Profile, ServiceListing, Connection } from '../shared/types';

// Initialize database adapters
const { profilesRepo, listingsRepo, connectionsRepo } = initializeDatabaseAdapters();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory session storage (simplified)
const sessions = new Map<string, { profileId: string; createdAt: Date }>();

// Helper function to generate IDs
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to get session from header
function getSessionFromHeader(req: express.Request): any {
  const sessionId = req.headers['session-id'] as string;
  return sessions.get(sessionId);
}

// Helper function to calculate distance between two points
function haversineKm(loc1: any, loc2: any): number {
  if (!loc1 || !loc2) return 0;
  
  const R = 6371; // Earth's radius in km
  const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to calculate match score
function calculateMatchScore(profileA: Profile, profileB: Profile, dimensions?: string[]): number {
  let score = 0;
  
  // Resource complementarity
  if (dimensions && dimensions.includes('resources')) {
    const aGoods = profileA.resources.goods.map(g => g.name);
    const bNeeds = profileB.resources.needs.map(n => n.name);
    const overlap = aGoods.filter(g => bNeeds.includes(g)).length;
    score += (overlap / Math.max(aGoods.length, bNeeds.length, 1)) * 0.4;
  }
  
  // Location proximity
  if (dimensions && dimensions.includes('location')) {
    const distance = haversineKm(profileA.location, profileB.location);
    if (distance < 1) score += 0.3;
    else if (distance < 5) score += 0.25;
    else if (distance < 10) score += 0.2;
    else if (distance < 25) score += 0.15;
    else if (distance < 50) score += 0.1;
  }
  
  // Value alignment
  if (dimensions && dimensions.includes('valueAlignment')) {
    const valuesA = profileA.economicProfile.valueAlignment;
    const valuesB = profileB.economicProfile.valueAlignment;
    if (valuesA && valuesB) {
      const keys = ['community', 'sustainability', 'innovation', 'fairness'];
      let totalDiff = 0;
      let count = 0;
      for (const key of keys) {
        if (valuesA[key] !== undefined && valuesB[key] !== undefined) {
          totalDiff += Math.abs(valuesA[key] - valuesB[key]);
          count++;
        }
      }
      if (count > 0) {
        score += (1 - totalDiff / count) * 0.3;
      }
    }
  }
  
  return Math.min(1, score);
}

// Helper function to generate match reasons
function generateMatchReason(profileA: Profile, profileB: Profile, score: number, dimensions?: string[]): string {
  const reasons: string[] = [];
  
  if (score > 0.8) reasons.push("Excellent compatibility");
  else if (score > 0.6) reasons.push("Strong alignment");
  else if (score > 0.4) reasons.push("Good potential");
  else reasons.push("Basic compatibility");
  
  // Add dimension-specific reasons
  if (dimensions) {
    if (dimensions.includes('resources')) {
      const aGoods = profileA.resources.goods.map(g => g.name);
      const bNeeds = profileB.resources.needs.map(n => n.name);
      const overlap = aGoods.filter(g => bNeeds.includes(g)).length;
      if (overlap > 0) reasons.push(`${overlap} resource matches`);
    }
    
    if (dimensions.includes('location')) {
      const distance = haversineKm(profileA.location, profileB.location);
      if (distance < 10) reasons.push("Geographically close");
    }
  }
  
  return reasons.join(" • ");
}

// API Routes

// Create profile
app.post('/api/profile', async (req, res) => {
  try {
    const profileData = req.body;
    
    // Create profile with defaults
    const profile: Profile = {
      id: generateId('profile'),
      name: profileData.name,
      avatar: profileData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileData.name}`,
      location: profileData.location || { latitude: 0, longitude: 0 },
      resources: {
        goods: profileData.resources?.goods || [],
        skills: profileData.resources?.services || [],
        needs: profileData.resources?.needs || [],
        timeAvailable: [],
        preferences: {},
      },
      weight: 0.5,
      reputation: {
        overall: 0.5,
        reliability: 0.5,
        quality: 0.5,
        responsiveness: 0.5,
        fairness: 0.5,
        trustworthiness: 0.5,
        socialImpact: 0.5,
        history: [],
      },
      economicProfile: {
        totalUtility: 0,
        wealthLevel: 0.5,
        spendingPower: 0.5,
        savingsRate: 0.5,
        riskTolerance: profileData.economicProfile?.riskTolerance || 0.5,
        preferredPaymentMethods: [],
        creditScore: 0,
        transactionHistory: [],
        valueAlignment: profileData.economicProfile?.valueAlignment || {
          community: 0.5,
          sustainability: 0.5,
          innovation: 0.5,
          fairness: 0.5,
        },
      },
      behaviorProfile: {
        interactionPatterns: [],
        preferences: {},
        predictedActions: [],
        adaptationRate: 0.5,
        consistencyScore: 0.5,
        socialStyle: 'balanced',
        decisionMakingStyle: 'analytical',
      },
      lastUpdated: new Date(),
      isActive: true,
    };

    // Create session
    const sessionId = generateId('session');
    sessions.set(sessionId, { profileId: profile.id, createdAt: new Date() });

    // Store profile
    await profilesRepo.save(profile);

    res.status(201).json({ profile, sessionId });
  } catch (error) {
    console.error('Profile creation failed:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Get current user's profile
app.get("/api/profile/current", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const profile = await profilesRepo.getById(session.profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error("Get current profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// Create listing
app.post('/api/listings', async (req, res) => {
  try {
    const listingData = req.body;
    const session = getSessionFromHeader(req);
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const listing: ServiceListing = {
      id: generateId('listing'),
      title: listingData.title,
      description: listingData.description,
      type: listingData.type,
      providerId: session.profileId,
      location: listingData.location || { latitude: 0, longitude: 0 },
      pricing: listingData.pricing || {
        basePrice: 0,
        currency: 'USD',
        pricingType: 'negotiable',
      },
      availability: listingData.availability || [],
      requirements: listingData.requirements || [],
      tags: listingData.tags || [],
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
    res.status(201).json(listing);
  } catch (error) {
    console.error('Listing creation failed:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Get listings
app.get("/api/listings", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    // Get all listings and sort by relevance
    let allListings = (await listingsRepo.getAll()).filter((listing) => listing.isActive);

    // Optional filters
    const nearLat = req.query.nearLat ? parseFloat(String(req.query.nearLat)) : undefined;
    const nearLon = req.query.nearLon ? parseFloat(String(req.query.nearLon)) : undefined;
    const radiusKm = req.query.radiusKm ? parseFloat(String(req.query.radiusKm)) : undefined;
    const tagsQuery = typeof req.query.tags === 'string' ? (req.query.tags as string).split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

    if (nearLat != null && nearLon != null && radiusKm != null && radiusKm > 0) {
      const ref = { latitude: nearLat, longitude: nearLon };
      allListings = allListings.filter((l) => haversineKm(ref, l.location) <= radiusKm);
    }

    if (tagsQuery.length > 0) {
      allListings = allListings.filter((l) => l.tags.some((t) => tagsQuery.includes(t.toLowerCase())));
    }

    const ranked = allListings
      .map((listing) => ({
        ...listing,
        matchingScore: 0.5 + Math.random() * 0.5, // Simplified scoring
      }))
      .sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));

    res.json({
      listings: ranked,
      total: ranked.length,
    });
  } catch (error) {
    console.error("Get listings error:", error);
    res.status(500).json({ error: "Failed to get listings" });
  }
});

// Generate matches
app.post("/api/matches", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);
    const { targetProfileId, dimensions, constraints } = req.body;

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const sourceProfile = await profilesRepo.getById(session.profileId);
    if (!sourceProfile) {
      return res.status(404).json({ error: "Source profile not found" });
    }

    let candidateProfiles: Profile[] = [];

    if (targetProfileId) {
      const targetProfile = await profilesRepo.getById(targetProfileId);
      candidateProfiles = targetProfile ? [targetProfile] : [];
    } else {
      candidateProfiles = (await profilesRepo.getAll()).filter(
        (p) => p.id !== sourceProfile.id && p.isActive,
      );
    }

    const matches = candidateProfiles.map(candidate => {
      const matchScore = calculateMatchScore(sourceProfile, candidate, dimensions);
      const reason = generateMatchReason(sourceProfile, candidate, matchScore, dimensions);
      
      return {
        profileA: sourceProfile.id,
        profileB: candidate.id,
        matchScore,
        dimensions: dimensions || ['overall'],
        reason,
      };
    });

    // Sort by score
    matches.sort((a, b) => b.matchScore - a.matchScore);
    
    // Apply constraints if provided
    let filteredMatches = matches;
    if (constraints) {
      if (constraints.minScore) {
        filteredMatches = filteredMatches.filter(m => m.matchScore >= constraints.minScore);
      }
    }

    res.json({
      matches: filteredMatches.slice(0, 20), // Limit results
      sourceProfile: sourceProfile.id,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Generate matches error:", error);
    res.status(500).json({ error: "Failed to generate matches" });
  }
});

// Create connection
app.post('/api/connections', async (req, res) => {
  try {
    const { fromId, toId, message, strength } = req.body;
    const session = getSessionFromHeader(req);
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (session.profileId !== fromId) {
      return res.status(403).json({ error: 'Can only create connections from your own profile' });
    }

    const fromProfile = await profilesRepo.getById(fromId);
    const toProfile = await profilesRepo.getById(toId);

    if (!fromProfile || !toProfile) {
      return res.status(404).json({ error: 'One or both profiles not found' });
    }

    const connection: Connection = {
      id: generateId('connection'),
      fromProfileId: fromId,
      toProfileId: toId,
      strength: strength || 0.5,
      status: 'pending',
      lastUsed: Date.now(),
    };

    await connectionsRepo.create(connection);
    res.status(201).json(connection);
  } catch (error) {
    console.error('Connection creation failed:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// Get connections
app.get("/api/connections", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const connections = await connectionsRepo.getByProfile(session.profileId);
    res.json({ connections, total: connections.length });
  } catch (error) {
    console.error("Get connections error:", error);
    res.status(500).json({ error: "Failed to get connections" });
  }
});

// Health check
app.get("/health", async (req, res) => {
  try {
    const profileCount = (await profilesRepo.getAll()).length;
    const listingCount = (await listingsRepo.getAll()).length;
    
    res.json({
      status: "healthy",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeProfiles: profileCount,
      activeListings: listingCount,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ status: "unhealthy", error: "Failed to collect metrics" });
  }
});

// Initialize sample data for development
async function initializeSampleData() {
  try {
    const existingProfiles = await profilesRepo.getAll();
    if (existingProfiles.length > 0) {
      console.log('Sample data already exists, skipping initialization');
      return;
    }

    console.log('Initializing sample data...');

    // Create sample profiles
    const aliceProfile: Profile = {
      id: generateId('profile'),
      name: "Alice Developer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
      location: { latitude: 37.7749, longitude: -122.4194 },
      resources: {
        goods: [],
        skills: [{ 
          id: "js-skill",
          name: "JavaScript", 
          category: "programming", 
          proficiencyLevel: 0.9, 
          availability: [], 
          tags: [] 
        }],
        needs: [{ 
          id: "design-need",
          name: "Design Help", 
          category: "design", 
          urgency: 0.7, 
          priority: 0.8, 
          quantity: 1, 
          unit: "project", 
          alternatives: [], 
          tags: [] 
        }],
        timeAvailable: [],
        preferences: {},
      },
      weight: 0.8,
      reputation: {
        overall: 0.9,
        reliability: 0.9,
        quality: 0.8,
        responsiveness: 0.9,
        fairness: 0.8,
        trustworthiness: 0.9,
        socialImpact: 0.7,
        history: [],
      },
      economicProfile: {
        totalUtility: 0,
        wealthLevel: 0.7,
        spendingPower: 0.6,
        savingsRate: 0.5,
        riskTolerance: 0.6,
        preferredPaymentMethods: [],
        creditScore: 0,
        transactionHistory: [],
        valueAlignment: {
          community: 0.8,
          sustainability: 0.7,
          innovation: 0.9,
          fairness: 0.8,
        },
      },
      behaviorProfile: {
        interactionPatterns: [],
        preferences: {},
        predictedActions: [],
        adaptationRate: 0.7,
        consistencyScore: 0.8,
        socialStyle: "collaborative",
        decisionMakingStyle: "analytical",
      },
      lastUpdated: new Date(),
      isActive: true,
    };

    const bobProfile: Profile = {
      id: generateId('profile'),
      name: "Bob Designer",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
      location: { latitude: 37.7849, longitude: -122.4094 },
      resources: {
        goods: [],
        skills: [{ 
          id: "design-skill",
          name: "UI/UX Design", 
          category: "design", 
          proficiencyLevel: 0.9, 
          availability: [], 
          tags: [] 
        }],
        needs: [{ 
          id: "code-need",
          name: "Code Review", 
          category: "programming", 
          urgency: 0.6, 
          priority: 0.7, 
          quantity: 1, 
          unit: "session", 
          alternatives: [], 
          tags: [] 
        }],
        timeAvailable: [],
        preferences: {},
      },
      weight: 0.7,
      reputation: {
        overall: 0.8,
        reliability: 0.8,
        quality: 0.9,
        responsiveness: 0.7,
        fairness: 0.8,
        trustworthiness: 0.8,
        socialImpact: 0.6,
        history: [],
      },
      economicProfile: {
        totalUtility: 0,
        wealthLevel: 0.6,
        spendingPower: 0.5,
        savingsRate: 0.4,
        riskTolerance: 0.5,
        preferredPaymentMethods: [],
        creditScore: 0,
        transactionHistory: [],
        valueAlignment: {
          community: 0.7,
          sustainability: 0.8,
          innovation: 0.8,
          fairness: 0.9,
        },
      },
      behaviorProfile: {
        interactionPatterns: [],
        preferences: {},
        predictedActions: [],
        adaptationRate: 0.6,
        consistencyScore: 0.7,
        socialStyle: "creative",
        decisionMakingStyle: "intuitive",
      },
      lastUpdated: new Date(),
      isActive: true,
    };

    await profilesRepo.save(aliceProfile);
    await profilesRepo.save(bobProfile);

    // Create sample listings
    const aliceListing: ServiceListing = {
      id: generateId('listing'),
      title: "JavaScript Development Help",
      description: "Experienced developer offering JavaScript assistance and code review",
      type: "offer",
      providerId: aliceProfile.id,
      location: { latitude: 37.7749, longitude: -122.4194 },
      pricing: { basePrice: 75, currency: "USD", pricingType: "hourly" },
      availability: [],
      requirements: [],
      tags: ["javascript", "programming", "code-review"],
      qualityMetrics: {
        rating: 0,
        reliability: 0.9,
        durability: 0.8,
        functionality: 0.9,
        aesthetics: 0.7,
        sustainability: 0.8,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    const bobListing: ServiceListing = {
      id: generateId('listing'),
      title: "UI/UX Design Consultation",
      description: "Professional designer offering consultation and design reviews",
      type: "offer",
      providerId: bobProfile.id,
      location: { latitude: 37.7849, longitude: -122.4094 },
      pricing: { basePrice: 100, currency: "USD", pricingType: "hourly" },
      availability: [],
      requirements: [],
      tags: ["design", "ui-ux", "consultation"],
      qualityMetrics: {
        rating: 0,
        reliability: 0.8,
        durability: 0.7,
        functionality: 0.8,
        aesthetics: 0.9,
        sustainability: 0.7,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    await listingsRepo.save(aliceListing);
    await listingsRepo.save(bobListing);

    console.log(`✅ Sample data initialized: 2 profiles, 2 listings`);
  } catch (error) {
    console.error("Sample data initialization failed:", error);
  }
}

// Start server
async function startServer() {
  try {
    // Initialize sample data for development
    if (process.env.NODE_ENV !== 'production') {
      await initializeSampleData();
    }

    app.listen(PORT, () => {
      console.log(`🚀 Coordination Cosmos server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API base: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
