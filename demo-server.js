const express = require("express");
const cors = require("cors");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory session storage (simplified)
const sessions = new Map();

// Helper function to generate IDs
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to get session from header
function getSessionFromHeader(req) {
  const sessionId = req.headers['session-id'];
  return sessions.get(sessionId);
}

// Helper function to calculate distance between two points
function haversineKm(loc1, loc2) {
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
function calculateMatchScore(profileA, profileB, dimensions) {
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
function generateMatchReason(profileA, profileB, score, dimensions) {
  const reasons = [];
  
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
    const profile = {
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

    // Store profile in database
    const dbProfile = await prisma.profile.create({
      data: {
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
      }
    });

    res.status(201).json({ profile, sessionId });
  } catch (error) {
    console.error('Profile creation failed:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Get current user's profile
app.get("/api/profile/current", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"];
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: session.profileId }
    });
    
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Convert back to expected format
    const convertedProfile = {
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar,
      location: { latitude: profile.latitude, longitude: profile.longitude },
      resources: profile.resources,
      weight: profile.weight,
      reputation: profile.reputation,
      economicProfile: profile.economicProfile,
      behaviorProfile: profile.behaviorProfile,
      lastUpdated: profile.updatedAt,
      isActive: profile.isActive,
    };

    res.json(convertedProfile);
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

    const listing = await prisma.listing.create({
      data: {
        title: listingData.title,
        description: listingData.description,
        type: listingData.type,
        providerId: session.profileId,
        latitude: listingData.location?.latitude || 0,
        longitude: listingData.location?.longitude || 0,
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
        status: 'active',
      }
    });

    res.status(201).json(listing);
  } catch (error) {
    console.error('Listing creation failed:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// Get listings
app.get("/api/listings", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"];
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    // Get all listings and sort by relevance
    let allListings = await prisma.listing.findMany({
      where: { status: 'active' }
    });

    // Optional filters
    const nearLat = req.query.nearLat ? parseFloat(String(req.query.nearLat)) : undefined;
    const nearLon = req.query.nearLon ? parseFloat(String(req.query.nearLon)) : undefined;
    const radiusKm = req.query.radiusKm ? parseFloat(String(req.query.radiusKm)) : undefined;
    const tagsQuery = typeof req.query.tags === 'string' ? req.query.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

    if (nearLat != null && nearLon != null && radiusKm != null && radiusKm > 0) {
      const ref = { latitude: nearLat, longitude: nearLon };
      allListings = allListings.filter((l) => haversineKm(ref, { latitude: l.latitude, longitude: l.longitude }) <= radiusKm);
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
    const sessionId = req.headers["session-id"];
    const session = sessions.get(sessionId);
    const { targetProfileId, dimensions, constraints } = req.body;

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const sourceProfile = await prisma.profile.findUnique({
      where: { id: session.profileId }
    });
    
    if (!sourceProfile) {
      return res.status(404).json({ error: "Source profile not found" });
    }

    let candidateProfiles = [];

    if (targetProfileId) {
      const targetProfile = await prisma.profile.findUnique({
        where: { id: targetProfileId }
      });
      candidateProfiles = targetProfile ? [targetProfile] : [];
    } else {
      candidateProfiles = await prisma.profile.findMany({
        where: { 
          id: { not: sourceProfile.id },
          isActive: true 
        }
      });
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

    const fromProfile = await prisma.profile.findUnique({
      where: { id: fromId }
    });
    
    const toProfile = await prisma.profile.findUnique({
      where: { id: toId }
    });

    if (!fromProfile || !toProfile) {
      return res.status(404).json({ error: 'One or both profiles not found' });
    }

    const connection = await prisma.connection.create({
      data: {
        fromId: fromId,
        toId: toId,
        strength: strength || 0.5,
        status: 'pending',
      }
    });

    res.status(201).json(connection);
  } catch (error) {
    console.error('Connection creation failed:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// Get connections
app.get("/api/connections", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"];
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const connections = await prisma.connection.findMany({
      where: {
        OR: [
          { fromId: session.profileId },
          { toId: session.profileId },
        ],
      }
    });
    
    res.json({ connections, total: connections.length });
  } catch (error) {
    console.error("Get connections error:", error);
    res.status(500).json({ error: "Failed to get connections" });
  }
});

// Health check
app.get("/health", async (req, res) => {
  try {
    const profileCount = await prisma.profile.count();
    const listingCount = await prisma.listing.count();
    
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
    const existingProfiles = await prisma.profile.count();
    if (existingProfiles > 0) {
      console.log('Sample data already exists, skipping initialization');
      return;
    }

    console.log('Initializing sample data...');

    // Create sample profiles
    const aliceProfile = await prisma.profile.create({
      data: {
        name: "Alice Developer",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
        latitude: 37.7749,
        longitude: -122.4194,
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
        isActive: true,
        tags: ["javascript", "programming", "design"],
      }
    });

    const bobProfile = await prisma.profile.create({
      data: {
        name: "Bob Designer",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
        latitude: 37.7849,
        longitude: -122.4094,
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
        isActive: true,
        tags: ["design", "ui-ux", "programming"],
      }
    });

    // Create sample listings
    const aliceListing = await prisma.listing.create({
      data: {
        title: "JavaScript Development Help",
        description: "Experienced developer offering JavaScript assistance and code review",
        type: "offer",
        providerId: aliceProfile.id,
        latitude: 37.7749,
        longitude: -122.4194,
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
        status: 'active',
      }
    });

    const bobListing = await prisma.listing.create({
      data: {
        title: "UI/UX Design Consultation",
        description: "Professional designer offering consultation and design reviews",
        type: "offer",
        providerId: bobProfile.id,
        latitude: 37.7849,
        longitude: -122.4094,
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
        status: 'active',
      }
    });

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
      console.log(`🚀 Coordination Cosmos Demo Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API base: http://localhost:${PORT}/api`);
      console.log(`💾 Database: SQLite with Prisma ORM`);
      console.log(`🎯 Features: Profiles, Listings, Matching, Connections`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
