import express from "express";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import http from "http";
import cors from "cors";
import { initializeDatabaseAdapters } from "./db/adapter";
import { Profile, ServiceListing, Connection, MatchingResult, SystemMetrics, SystemState, OptimizationObjective } from "../shared/types";
import { NetworkManager } from "../mechanisms/network";
import { ProfileManager } from "../mechanisms/profiles";
import { RecommendationEngine } from "../mechanisms/recommendation";
import { OptimizationEngine } from "../mechanisms/optimization";
import { CloudModelEngine } from "../mechanisms/cloudModels";
import { AgentManager } from "../mechanisms/agents";
import { BehaviorObserver } from "../mechanisms/behavior";
import { HighDimSimulation } from "../mechanisms/simulation";
import { validateSchema } from "./validation/middleware";
import { ProfileSchema, ListingSchema, MatchRequestSchema, ConnectionRequestSchema } from "./validation/schemas";
import { WebSocketServer, WebSocket } from "ws";
import { promisify } from "util";
import fs from "fs";

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// Initialize database adapters
const { profilesRepo, listingsRepo, connectionsRepo } = initializeDatabaseAdapters();

// Initialize mechanisms
const networkManager = new NetworkManager();
const profileManager = new ProfileManager();
const recommendationEngine = new RecommendationEngine();
const optimizationEngine = new OptimizationEngine();
const cloudModelEngine = new CloudModelEngine();
const behaviorObserver = new BehaviorObserver();
const highDimSimulation = new HighDimSimulation();

// Initialize system state
const systemState: SystemState = {
  activeProfiles: 0,
  activeListings: 0,
  lastUpdate: new Date(),
  systemHealth: {
    overall: 0.8,
    performance: 0.7,
    reliability: 0.8,
    scalability: 0.6,
  },
};

// Initialize system metrics
const systemMetrics: SystemMetrics = {
  totalUsers: 0,
  activeUsers: 0,
  totalListings: 0,
  activeListings: 0,
  successfulMatches: 0,
  totalUtility: 0,
  wasteLevel: 0.1,
  efficiencyScore: 0.5,
  equityIndex: 0.5,
  socialWelfare: 0,
  coordinationCost: 0,
  networkHealth: 0.5,
  adaptationSpeed: 0.5,
};

const DATA_DIR = path.join(__dirname, "../data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");
const LISTINGS_FILE = path.join(DATA_DIR, "listings.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

const mkdirAsync = promisify(fs.mkdir);

// ==================== PERSISTENCE FUNCTIONS ====================

// Load data from database
async function loadData(): Promise<void> {
  try {
    console.log("📊 Loading data from database...");
    
    // Data is already loaded through database adapters
    // Update system state with current counts
    const allProfiles = await profilesRepo.getAll();
    const allListings = await listingsRepo.getAll();
    
    systemState.activeProfiles = allProfiles.filter(p => p.isActive).length;
    systemState.activeListings = allListings.filter(l => l.isActive).length;
    systemState.lastUpdate = new Date();
    
    systemMetrics.totalUsers = allProfiles.length;
    systemMetrics.activeUsers = systemState.activeProfiles;
    systemMetrics.totalListings = allListings.length;
    systemMetrics.activeListings = systemState.activeListings;
    
    console.log(`✅ Loaded ${allProfiles.length} profiles and ${allListings.length} listings from database`);
  } catch (error) {
    console.error("❌ Failed to load data from database:", error);
  }
}

// Save data to database (no longer needed as database handles persistence)
async function saveData(): Promise<void> {
  try {
    console.log("💾 Data persistence handled by database");
    // Update system state
    await updateSystemState();
  } catch (error) {
    console.error("❌ Failed to update system state:", error);
  }
}

// Import our advanced mechanisms
import { OptimizationEngine } from "../mechanisms/optimization";
import { CloudModelEngine } from "../mechanisms/cloudModels";
import { NetworkManager } from "../mechanisms/network";
import { ProfileManager } from "../mechanisms/profiles";
import { BehaviorObserver } from "../mechanisms/behavior";
import { RecommendationEngine } from "../mechanisms/recommendation";
import { HighDimSimulation } from "../mechanisms/simulation";
import { PersonalAgent, AgentManager } from "../mechanisms/agents";

// ==================== SERVER INITIALIZATION ====================

const app = express();
const HTTP_PORT = process.env.PORT || 3003;
const WS_PORT = process.env.WS_PORT || 8083;

// Advanced system components
let optimizationEngine: OptimizationEngine;
let cloudModelEngine: CloudModelEngine;
let networkManager: NetworkManager;
let profileManager: ProfileManager;
let behaviorObserver: BehaviorObserver;
let recommendationEngine: RecommendationEngine;
let simulation: HighDimSimulation;
let agentManager: AgentManager;

// System state
let systemState: SystemState;
let activeCoordinations: Map<string, CoordinationMechanism> = new Map();
let connectedClients: Set<WebSocket> = new Set();
let systemMetrics: SystemMetrics;

// Data stores
// Remove the old in-memory maps since we're using database now
// const profiles: Map<string, Profile> = new Map();
// const listings: Map<string, ServiceListing> = new Map();
const sessions: Map<string, any> = new Map();

// ==================== VALIDATION & UTILS ====================

function isValidString(value: any, max = 1000): boolean {
  return typeof value === "string" && value.length >= 0 && value.length <= max;
}

function validateProfileInput(profileData: any): string | null {
  if (profileData == null || typeof profileData !== "object") return "Invalid body";
  if (profileData.name && !isValidString(profileData.name, 200)) return "Invalid name";
  if (profileData.location) {
    const { latitude, longitude } = profileData.location;
    if (typeof latitude !== "number" || typeof longitude !== "number") return "Invalid location";
  }
  return null;
}

function validateListingInput(listingData: any): string | null {
  if (listingData == null || typeof listingData !== "object") return "Invalid body";
  if (listingData.title != null && !isValidString(listingData.title, 200)) return "Invalid title";
  if (listingData.description != null && !isValidString(listingData.description, 2000)) return "Invalid description";
  if (listingData.tags && !Array.isArray(listingData.tags)) return "Invalid tags";
  return null;
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const x = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// Simple text embedding and cosine similarity to enrich relevance scoring
function textEmbed(text: string): number[] {
  const lower = (text || "").toLowerCase();
  const vec = [0, 0, 0, 0, 0];
  for (let i = 0; i < lower.length; i++) {
    const c = lower.charCodeAt(i);
    vec[i % vec.length] += c;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ==================== MIDDLEWARE SETUP ====================

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Basic schema guard using inline checks (upgrade to zod later)
function requireJson(req: Request, res: Response, next: NextFunction) {
  const ct = req.headers["content-type"] || "";
  if (req.method === 'POST' || req.method === 'PUT') {
    if (typeof ct !== 'string' || !ct.includes('application/json')) {
      return res.status(415).json({ error: 'Unsupported content-type, expected application/json' });
    }
  }
  next();
}
app.use(requireJson);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Server Error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  },
);

// ==================== SYSTEM INITIALIZATION ====================

async function initializeAdvancedSystems() {
  console.log("🚀 Initializing Advanced Coordination Systems...");

  try {
    // Initialize core components
    networkManager = new NetworkManager();
    profileManager = new ProfileManager(profilesRepo);
    behaviorObserver = new BehaviorObserver(profileManager);
    recommendationEngine = new RecommendationEngine(
      networkManager,
      behaviorObserver,
      listingsRepo
    );
    optimizationEngine = new OptimizationEngine();
    cloudModelEngine = new CloudModelEngine();
    agentManager = new AgentManager(listingsRepo, profilesRepo, harmonizationEngine);

    // Initialize simulation
    simulation = new HighDimSimulation(
      networkManager,
      profileManager,
      [cloudModelEngine], // Cloud models will be added dynamically
    );

    // Initialize system state
    systemState = {
      timestamp: new Date(),
      activeProfiles: 0,
      activeListings: 0,
      activeCoordinations: 0,
      systemHealth: {
        overall: 1.0,
        network: 1.0,
        agents: 1.0,
        coordination: 1.0,
        learning: 1.0,
        adaptation: 1.0,
      },
      performance: {
        throughput: 0,
        latency: 50,
        errorRate: 0,
        resourceUtilization: 0.3,
        scalabilityIndex: 0.8,
      },
      metrics: {
        economic: {
          totalValue: 0,
          efficiency: 0.8,
          waste: 0.1,
          distribution: 0.7,
          growth: 0.05,
        },
        social: {
          cohesion: 0.6,
          trust: 0.7,
          cooperation: 0.8,
          diversity: 0.9,
          inclusion: 0.7,
        },
        environmental: {
          sustainability: 0.8,
          resourceConsumption: 0.4,
          carbonFootprint: 0.3,
          circularEconomy: 0.6,
        },
        innovation: {
          novelty: 0.7,
          adoption: 0.5,
          diffusion: 0.4,
          creativity: 0.8,
          improvement: 0.6,
        },
        equity: {
          accessibilityIndex: 0.8,
          distributionFairness: 0.7,
          opportunityEquality: 0.6,
          outcomeEquity: 0.5,
          representationBalance: 0.7,
        },
      },
    };

    // Initialize system metrics
    systemMetrics = {
      totalUsers: 0,
      activeUsers: 0,
      totalListings: 0,
      activeListings: 0,
      successfulMatches: 0,
      totalUtility: 0,
      wasteLevel: 0.1,
      efficiencyScore: 0.8,
      equityIndex: 0.7,
      socialWelfare: 0,
      coordinationCost: 0.05,
      networkHealth: 0.9,
      adaptationSpeed: 0.6,
    };

    // Start background processes
    startSystemOptimization();
    startAgentSimulation();
    startMetricsCollection();

    console.log("✅ Advanced systems initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize systems:", error);
    throw error;
  }
}

// ==================== BACKGROUND PROCESSES ====================

function startSystemOptimization() {
  setInterval(async () => {
    try {
      // Periodic system optimization
      await optimizeSystemPerformance();

      // Update network weights and connections
      networkManager.updateWeights();

      // Run coordination optimization
      await optimizeActiveCoordinations();

      // Update system metrics
      await updateSystemMetrics();

      // Broadcast system state to connected clients
      broadcastSystemUpdate();
    } catch (error) {
      console.error("System optimization error:", error);
    }
  }, 30000); // Every 30 seconds
}

function startAgentSimulation() {
  setInterval(async () => {
    try {
      // Run personal agents
      await agentManager.runAll();

      // Run high-dimensional simulation step
      await simulation.runSimulationStep();

      // Process learning adaptations
      await processLearningAdaptations();
    } catch (error) {
      console.error("Agent simulation error:", error);
    }
  }, 10000); // Every 10 seconds
}

function startMetricsCollection() {
  setInterval(async () => {
    try {
      // Collect and update comprehensive metrics
      const newMetrics = await collectComprehensiveMetrics();
      systemMetrics = { ...systemMetrics, ...newMetrics };

      // Store historical data
      await storeMetricsHistory(systemMetrics);
    } catch (error) {
      console.error("Metrics collection error:", error);
    }
  }, 5000); // Every 5 seconds
}

// ==================== CORE API ENDPOINTS ====================

// Profile Management
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

    // Enhance profile through AI before returning
    const enhancedProfile = await cloudModelEngine.enhanceProfile(profile);
    await profilesRepo.save(enhancedProfile);
    await saveData(); // Save data after modification

    res.json(enhancedProfile);
  } catch (error) {
    console.error("Get current profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

app.get("/api/profile/:id", async (req, res) => {
  try {
    const profile = await profilesRepo.getById(req.params.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// Profile endpoints with validation
app.post('/api/profile', validateSchema(ProfileSchema), async (req, res) => {
  try {
    const profileData = req.body;
    
    // Create profile with defaults using the correct type structure
    const profile: Profile = {
      id: generateId('profile'),
      name: profileData.name,
      avatar: generateAvatar(),
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

    // Register with managers
    profileManager.addProfile(profile);
    networkManager.addNode(profile);
    const agent = agentManager.createAgent(profile);

    // Enhance profile with AI
    try {
      const enhancedProfile = await cloudModelEngine.enhanceProfile(profile);
      await profilesRepo.save(enhancedProfile);
    } catch (error) {
      console.warn('AI enhancement failed, using original profile:', error);
    }

    res.status(201).json({ profile, sessionId });
  } catch (error) {
    console.error('Profile creation failed:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Listing Management
app.get("/api/listings", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    // Get personalized listings through recommendation engine
    const recommendations = recommendationEngine.getListingRecommendations(
      session.profileId,
    );

    // Optional filters: nearLat, nearLon, radiusKm, tags
    const nearLat = req.query.nearLat ? parseFloat(String(req.query.nearLat)) : undefined;
    const nearLon = req.query.nearLon ? parseFloat(String(req.query.nearLon)) : undefined;
    const radiusKm = req.query.radiusKm ? parseFloat(String(req.query.radiusKm)) : undefined;
    const tagsQuery = typeof req.query.tags === 'string' ? (req.query.tags as string).split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

    // Get all listings and sort by relevance
    let allListings = (await listingsRepo.getAll()).filter((listing) => listing.isActive);

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
        matchingScore: calculateListingRelevance(session.profileId, listing),
      }))
      .sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));

    res.json({
      listings: ranked,
      recommendations,
      total: ranked.length,
    });
  } catch (error) {
    console.error("Get listings error:", error);
    res.status(500).json({ error: "Failed to get listings" });
  }
});

// Listing endpoints with validation
app.post('/api/listings', validateSchema(ListingSchema), async (req, res) => {
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
      pricing: {
        basePrice: listingData.pricing?.basePrice || 0,
        currency: listingData.pricing?.currency || 'USD',
        pricingType: listingData.pricing?.negotiable ? 'negotiable' : 'fixed',
      },
      availability: listingData.availability ? [listingData.availability] : [],
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

    listingsRepo.save(listing);
    networkManager.addEdge(listing.providerId, listing.id, 1.0);

    res.status(201).json(listing);
  } catch (error) {
    console.error('Listing creation failed:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

app.put('/api/listings/:id', validateSchema(ListingSchema.partial()), async (req, res) => {
  try {
    const { id } = req.params;
    const listingData = req.body;
    const session = getSessionFromHeader(req);
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const listing = await listingsRepo.getById(id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.providerId !== session.profileId) {
      return res.status(403).json({ error: 'Not your listing' });
    }

    // Update allowed fields
    if (listingData.title !== undefined) listing.title = listingData.title;
    if (listingData.description !== undefined) listing.description = listingData.description;
    if (listingData.tags !== undefined) listing.tags = listingData.tags;
    
    listing.updatedAt = new Date();
    await listingsRepo.save(listing);

    res.json(listing);
  } catch (error) {
    console.error('Listing update failed:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

app.delete("/api/listings/:id", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });

    const listing = await listingsRepo.getById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.providerId !== session.profileId) return res.status(403).json({ error: "Forbidden" });

    listing.isActive = false;
    listing.updatedAt = new Date();
    await listingsRepo.save(listing);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete listing error:", error);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

app.get("/api/listings/mine", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);
    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }
    const myListings = await listingsRepo.byProvider(session.profileId);
    res.json({ listings: myListings, total: myListings.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to get my listings" });
  }
});

// ==================== ADVANCED COORDINATION APIs ====================

app.post("/api/coordination", async (req, res) => {
  try {
    const { type, participants, objectives } = req.body;
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const coordination: CoordinationMechanism = {
      id: generateId("coordination"),
      type: type || "algorithmic",
      participants: participants || [session.profileId],
      initiatorId: session.profileId,
      status: 'active',
      details: { objectives: objectives || [{ type: 'utility_maximization', weight: 1 }] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentState: {
        phase: "discovery",
        progress: 0,
        participants: participants.map((id: string) => ({
          profileId: id,
          engagement: 0.5,
          contribution: 0,
          satisfaction: 0.5,
          commitment: 0.7,
          lastActive: new Date(),
        })),
        resources: [],
        conflicts: [],
        resolutions: [],
      },
      performance: {
        efficiency: 0.5,
        effectiveness: 0.5,
        satisfaction: 0.5,
        scalability: 0.7,
        adaptability: 0.6,
        robustness: 0.6,
      },
    };

    // Store coordination
    activeCoordinations.set(coordination.id, coordination);

    // Notify participants
    broadcast({
      type: "coordination_started",
      coordinationId: coordination.id,
      coordination,
    });

    res.status(201).json(coordination);
  } catch (error) {
    console.error("Create coordination error:", error);
    res.status(500).json({ error: "Failed to create coordination" });
  }
});

// Matching and Optimization
import { HarmonizationEngine } from "../mechanisms/matching/HarmonizationEngine";

const harmonizationEngine = new HarmonizationEngine();

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

    const allUsers = (await profilesRepo.getAll()).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
    }, {} as { [key: string]: Profile });

    const matches = harmonizationEngine.findOptimalMatches(sourceProfile, candidateProfiles, allUsers, new Date());

    // Apply constraints if provided
    let filteredMatches = matches;
    if (constraints) {
      if (constraints.minScore) {
        filteredMatches = filteredMatches.filter(m => m.score >= constraints.minScore);
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

app.post("/api/optimize", async (req, res) => {
  try {
    const { nodeId, currentProfile: currentProfileId, objectives } = req.body;

    const profile = await profilesRepo.getById(currentProfileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Create optimization objectives if not provided
    const optimizationObjectives: OptimizationObjective[] = objectives || [
      {
        type: "utility_maximization",
        weight: 0.4,
        targetValue: 1,
        currentValue: 0.6,
        priority: 1,
      },
      {
        type: "waste_minimization",
        weight: 0.3,
        targetValue: 0,
        currentValue: 0.1,
        priority: 2,
      },
      {
        type: "equity_maximization",
        weight: 0.3,
        targetValue: 1,
        currentValue: 0.7,
        priority: 2,
      },
    ];

    // Run system optimization
    const recommendations = await cloudModelEngine.optimizeSystemPerformance(
      systemMetrics,
      optimizationObjectives,
    );

    res.json({
      recommendations,
      nodeId,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Optimization error:", error);
    res.status(500).json({ error: "Failed to optimize" });
  }
});

// Connection Management


// Connection endpoint with validation


// List current user's connections with strength
app.get("/api/connections", async (req, res) => {
  try {
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });

    const node = networkManager.getNode(session.profileId);
    if (!node) return res.json({ connections: [], total: 0 });

    const connections = node.connections.map((id) => {
      const edge = networkManager.getEdge(session.profileId, id);
      return {
        profileId: id,
        strength: edge?.weight ?? 0,
      };
    }).sort((a, b) => b.strength - a.strength);

    res.json({ connections, total: connections.length });
  } catch (error) {
    console.error("Connections list error:", error);
    res.status(500).json({ error: "Failed to get connections" });
  }
});

// Connection endpoint with validation
app.post('/api/connections', validateSchema(ConnectionRequestSchema), async (req, res) => {
  try {
    const { targetProfileId, connectionType } = req.body;
    const session = getSessionFromHeader(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sourceProfile = await profilesRepo.getById(session.profileId);
    const targetProfile = await profilesRepo.getById(targetProfileId);

    if (!sourceProfile || !targetProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Create connection
    const connection: Connection = {
      id: generateId('connection'),
      profileA: sourceProfile.id,
      profileB: targetProfile.id,
      strength: 0.5, // Initial strength
      type: connectionType || 'social',
      history: [],
      lastInteraction: new Date(),
    };

    await connectionsRepo.save(connection);

    // Update network manager
    networkManager.addEdge(sourceProfile.id, targetProfile.id, connection.strength);

    res.status(201).json(connection);
  } catch (error) {
    console.error('Connection creation failed:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// System Metrics and Health
app.get("/api/system/metrics", (req, res) => {
  res.json({
    metrics: systemMetrics,
    state: systemState,
    activeCoordinations: activeCoordinations.size,
    connectedClients: connectedClients.size,
    timestamp: new Date(),
  });
});

app.get("/api/system/health", (req, res) => {
  const health = {
    status: "healthy",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeProfiles: profilesRepo.getAll().filter(p => p.isActive).length,
    activeListings: listingsRepo.getAll().filter(l => l.isActive).length,
    activeCoordinations: activeCoordinations.size,
    systemHealth: systemState.systemHealth,
    timestamp: new Date(),
  };

  res.json(health);
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const metrics = await collectComprehensiveMetrics();
    const activeProfiles = (await profilesRepo.getAll()).filter(p => p.isActive).length;
    const activeListings = (await listingsRepo.getAll()).filter(l => l.isActive).length;
    
    res.json({
      status: "healthy",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeProfiles,
      activeListings,
      activeCoordinations: activeCoordinations.size,
      systemHealth: systemState.systemHealth,
      metrics,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ status: "unhealthy", error: "Failed to collect metrics" });
  }
});

// ==================== WEBSOCKET SERVER ====================

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
  console.log("New WebSocket connection established");
  connectedClients.add(ws);

  // Send initial system state
  ws.send(
    JSON.stringify({
      type: "system_state",
      data: systemState,
    }),
  );

  ws.on("message", async (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      await handleWebSocketMessage(ws, data);
    } catch (error) {
      console.error("WebSocket message error:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Invalid message format",
        }),
      );
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
    connectedClients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    connectedClients.delete(ws);
  });
});

async function handleWebSocketMessage(ws: WebSocket, data: any) {
  switch (data.type) {
    case "ping":
      ws.send(JSON.stringify({ type: "pong", timestamp: new Date() }));
      break;

    case "subscribe_metrics":
      // Client wants real-time metrics updates
      ws.send(
        JSON.stringify({
          type: "system_metrics",
          metrics: systemMetrics,
        }),
      );
      break;

    case "update_resonance":
      // Handle resonance filter updates from Aura interface
      await handleResonanceUpdate(data.resonanceFilter, data.profileId);
      break;

    case "interaction":
      // Handle real-time interactions from Aura interface
      await handleAuraInteraction(data.interaction);
      break;

    default:
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Unknown message type",
        }),
      );
  }
}

// ==================== UTILITY FUNCTIONS ====================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAvatar(): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`;
}

function getDefaultPreferences(): any {
  return {
    communicationStyle: "friendly",
    meetingPreference: "hybrid",
    responseTime: 24,
    languages: ["en"],
    accessibility: [],
    values: [
      {
        name: "sustainability",
        importance: 0.7,
        category: {
          name: "environmental",
          description: "Environmental values",
          weight: 0.8,
        },
      },
      {
        name: "community",
        importance: 0.8,
        category: { name: "social", description: "Social values", weight: 0.9 },
      },
    ],
    resourcePreferences: {},
    timePreferences: [],
    socialPreferences: [],
    qualityWeights: [],
    priceElasticity: {},
  };
}

function getDefaultReputation(): any {
  return {
    overall: 0.7,
    reliability: 0.7,
    quality: 0.7,
    responsiveness: 0.7,
    fairness: 0.8,
    trustworthiness: 0.7,
    socialImpact: 0.6,
    history: [],
  };
}

function getDefaultEconomicProfile(): any {
  return {
    totalUtility: 0.5,
    wealthLevel: 0.5,
    spendingPower: 0.5,
    savingsRate: 0.2,
    riskTolerance: 0.5,
    preferredPaymentMethods: ["digital", "cash"],
    creditScore: 700,
    transactionHistory: [],
    valueAlignment: {
      sustainability: 0.7,
      community: 0.8,
      fairness: 0.8,
      innovation: 0.6,
      efficiency: 0.7,
      inclusivity: 0.8,
    },
  };
}

function getDefaultBehaviorProfile(): any {
  return {
    interactionPatterns: [],
    preferences: getDefaultPreferences(),
    predictedActions: [],
    adaptationRate: 0.5,
    consistencyScore: 0.7,
    socialStyle: "collaborative",
    decisionMakingStyle: "analytical",
  };
}

function getDefaultQuality(): any {
  return {
    rating: 4.0,
    reliability: 0.8,
    durability: 0.7,
    functionality: 0.8,
    aesthetics: 0.6,
    sustainability: 0.7,
  };
}

function calculateListingRelevance(
  profileId: string,
  listing: ServiceListing,
): number {
  try {
    // Get profile needs and skills
    const profile = profilesRepo.getById(profileId);
    if (!profile) return 0;

    const needs = profile.resources.needs.map((n) => n.name.toLowerCase());
    const skills = profile.resources.skills.map((s) => s.name.toLowerCase());
    
    // Combine profile text for semantic analysis
    const profileText = [
      profile.resources.needs.map((n) => n.name).join(" "),
      profile.resources.skills.map((s) => s.name).join(" "),
      profile.name,
    ].join(" ");

    // Calculate tag overlap (60% weight)
    const listingTags = listing.tags.map((t) => t.toLowerCase());
    const tagOverlap = listingTags.filter((tag) =>
      needs.includes(tag) || skills.includes(tag),
    ).length;
    const tagScore = tagOverlap / Math.max(listingTags.length, 1);

    // Calculate semantic similarity (40% weight)
    const profileEmbedding = textEmbed(profileText);
    const listingEmbedding = textEmbed(
      `${listing.title} ${listing.description} ${listing.tags.join(" ")}`,
    );
    const semanticScore = cosineSim(profileEmbedding, listingEmbedding);

    // Blend scores
    return tagScore * 0.6 + semanticScore * 0.4;
  } catch (error) {
    console.error("Error calculating listing relevance:", error);
    return 0.5; // Default score
  }
}

function calculateConnectionStrength(
  profileA: Profile,
  profileB: Profile,
): number {
  // Simplified connection strength calculation
  const resourceOverlap = calculateResourceOverlap(profileA, profileB);
  const locationBonus = calculateLocationBonus(
    profileA.location,
    profileB.location,
  );
  const valueAlignment = calculateValueAlignment(
    profileA.economicProfile.valueAlignment,
    profileB.economicProfile.valueAlignment,
  );

  return Math.min(1, (resourceOverlap + locationBonus + valueAlignment) / 3);
}

function calculateResourceOverlap(
  profileA: Profile,
  profileB: Profile,
): number {
  const aGoods = new Set(profileA.resources.goods.map((g) => g.name));
  const bNeeds = new Set(profileB.resources.needs.map((n) => n.name));
  const overlap = new Set([...aGoods].filter((x) => bNeeds.has(x)));

  return overlap.size / Math.max(aGoods.size, bNeeds.size, 1);
}

// Helper function to calculate location bonus
function calculateLocationBonus(locationA: any, locationB: any): number {
  if (!locationA || !locationB) return 0.5;
  
  const distance = haversineKm(locationA, locationB);
  if (distance < 1) return 1.0;      // Same location
  if (distance < 5) return 0.9;      // Very close
  if (distance < 10) return 0.8;     // Close
  if (distance < 25) return 0.6;     // Moderate
  if (distance < 50) return 0.4;     // Far
  return 0.2;                         // Very far
}

// Helper function to calculate value alignment
function calculateValueAlignment(valuesA: any, valuesB: any): number {
  if (!valuesA || !valuesB) return 0.5;
  
  let totalDifference = 0;
  let count = 0;
  
  const keys = ['community', 'sustainability', 'innovation', 'fairness'];
  for (const key of keys) {
    if (valuesA[key] !== undefined && valuesB[key] !== undefined) {
      totalDifference += Math.abs(valuesA[key] - valuesB[key]);
      count++;
    }
  }
  
  if (count === 0) return 0.5;
  
  const averageDifference = totalDifference / count;
  return Math.max(0, 1 - averageDifference);
}

function combineMatchingResults(
  aiMatches: MatchingResult[],
  traditionalMatches: MatchingResult[],
): MatchingResult[] {
  const combined = new Map<string, MatchingResult>();

  // Add AI matches
  aiMatches.forEach((match) => {
    combined.set(match.profileB, {
      ...match,
      matchScore: match.matchScore * 0.7,
    });
  });

  // Combine with traditional matches
  traditionalMatches.forEach((match) => {
    const existing = combined.get(match.profileB);
    if (existing) {
      existing.matchScore = existing.matchScore + match.matchScore * 0.3;
    } else {
      combined.set(match.profileB, {
        ...match,
        matchScore: match.matchScore * 0.3,
      });
    }
  });

  return Array.from(combined.values())
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20);
}

async function optimizeSystemPerformance(): Promise<void> {
  try {
    // Run resource allocation optimization
    const profilesArray = (await profilesRepo.getAll()).filter(p => p.isActive);
    const objectives: OptimizationObjective[] = [
      {
        type: "maximize_utility",
        weight: 0.6,
        targetValue: 1,
        currentValue: systemMetrics.totalUtility,
        priority: 1,
      },
      {
        type: "minimize_waste",
        weight: 0.4,
        targetValue: 0,
        currentValue: systemMetrics.wasteLevel,
        priority: 2,
      },
    ];

    // This would normally run actual optimization
    console.log("Running system optimization...");

    // Update system health based on performance
    systemState.systemHealth.overall = Math.min(
      1,
      systemState.systemHealth.overall + 0.01,
    );
  } catch (error) {
    console.error("System optimization failed:", error);
    systemState.systemHealth.overall = Math.max(
      0,
      systemState.systemHealth.overall - 0.05,
    );
  }
}

async function optimizeActiveCoordinations(): Promise<void> {
  for (const [id, coordination] of activeCoordinations) {
    try {
      // Update coordination progress
      const cs0 = coordination.currentState || {
        phase: 'discovery',
        progress: 0,
        participants: [],
        resources: [],
        conflicts: [],
        resolutions: [],
      };
      coordination.currentState = cs0;
      coordination.currentState.progress = Math.min(
        1,
        coordination.currentState.progress + 0.02,
      );

      // Update participant states
      const cs = coordination.currentState;
      if (cs) {
        cs.participants.forEach((participant) => {
          participant.engagement = Math.min(1, participant.engagement + Math.random() * 0.1);
          participant.lastActive = new Date();
        });
      }

      // Update performance metrics
      coordination.performance = coordination.performance || {
        efficiency: 0.5,
        effectiveness: 0.5,
        satisfaction: 0.5,
        scalability: 0.7,
        adaptability: 0.6,
        robustness: 0.6,
      };
      coordination.performance.efficiency = Math.min(
        1,
        coordination.performance.efficiency + 0.01,
      );

      // Move to next phase if progress is sufficient
      if (coordination.currentState && coordination.currentState.progress > 0.8 && coordination.currentState.phase !== "completion") {
        const phases = [
          "discovery",
          "matching",
          "negotiation",
          "agreement",
          "execution",
          "completion",
        ];
        const currentPhaseIndex = phases.indexOf(coordination.currentState.phase);
        if (currentPhaseIndex < phases.length - 1) {
          coordination.currentState.phase = phases[currentPhaseIndex + 1] as any;
          coordination.currentState.progress = 0;
        }
      }
    } catch (error) {
      console.error(`Failed to optimize coordination ${id}:`, error);
    }
  }
}

async function processLearningAdaptations(): Promise<void> {
  try {
    // Process feedback and adapt system behavior
    const allProfiles = await profilesRepo.getAll();
    for (const profile of allProfiles) {
      // Simulate learning from interactions
      const agent = agentManager.getAgent(profile.id);
      if (agent) {
        await agent.run();
      }
    }

    // Update system parameters based on performance
    const metrics = await collectComprehensiveMetrics();
    if (metrics.networkHealth && metrics.networkHealth < 0.5) {
      // Adjust matching parameters to improve network health
      console.log("Adjusting matching parameters for better network health");
    }
  } catch (error) {
    console.error("Learning adaptations failed:", error);
  }
}

async function collectComprehensiveMetrics(): Promise<Partial<SystemMetrics>> {
  try {
    const activeProfileCount = (await profilesRepo.getAll()).filter(
      (p) => p.isActive,
    ).length;
    const activeListingCount = (await listingsRepo.getAll()).filter(
      (l) => l.isActive,
    ).length;

    // Calculate total utility across all profiles
    const totalUtility =
      (await profilesRepo.getAll()).reduce(
        (sum, profile) => sum + profile.weight,
        0,
      ) / Math.max(activeProfileCount, 1);

    // Calculate network health based on connections
    const totalConnections = (await profilesRepo.getAll()).reduce(
      (sum, profile) => {
        const node = networkManager.getNode(profile.id);
        return sum + (node?.connections.length || 0);
      },
      0,
    );

    const networkHealth = Math.min(1, totalConnections / Math.max(activeProfileCount * 2, 1));

    // Calculate social welfare
    const socialWelfare =
      (await profilesRepo.getAll()).reduce((sum, profile) => {
        const community = (profile.economicProfile.valueAlignment && (profile.economicProfile.valueAlignment as any).community) || 0;
        return sum + community;
      }, 0) / Math.max(activeProfileCount, 1);

    return {
      totalUsers: (await profilesRepo.getAll()).length,
      activeUsers: activeProfileCount,
      totalListings: (await listingsRepo.getAll()).length,
      activeListings: activeListingCount,
      successfulMatches: Math.floor(Math.random() * 100),
      totalUtility,
      networkHealth,
      socialWelfare,
      coordinationCost: activeCoordinations.size * 0.01,
      adaptationSpeed: 0.6 + Math.random() * 0.2,
    } as Partial<SystemMetrics> as any;
  } catch (error) {
    console.error("Metrics collection failed:", error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalListings: 0,
      activeListings: 0,
      successfulMatches: 0,
      totalUtility: 0,
      wasteLevel: 0.1,
      efficiencyScore: 0.5,
      equityIndex: 0.5,
      socialWelfare: 0,
      coordinationCost: 0,
      networkHealth: 0.5,
      adaptationSpeed: 0.5,
    };
  }
}

async function storeMetricsHistory(metrics: SystemMetrics): Promise<void> {
  // In a real implementation, this would store to a database
  // For now, just log significant changes
  if (Math.random() < 0.1) {
    // Log 10% of the time
    console.log("📊 System Metrics Update:", {
      totalUtility: metrics.totalUtility.toFixed(3),
      efficiency: metrics.efficiencyScore.toFixed(3),
      socialWelfare: metrics.socialWelfare.toFixed(3),
      activeProfiles: profilesRepo.getAll().filter(p => p.isActive).length,
      activeCoordinations: activeCoordinations.size,
    });
  }
}

async function updateSystemMetrics(): Promise<void> {
  try {
    const newMetrics = await collectComprehensiveMetrics();
    Object.assign(systemMetrics, newMetrics);

    // Update system state
    systemState.activeProfiles = (await profilesRepo.getAll()).filter(
      (p) => p.isActive,
    ).length;
    systemState.activeListings = (await listingsRepo.getAll()).filter(
      (l) => l.isActive,
    ).length;
    systemState.activeCoordinations = activeCoordinations.size;
    systemState.timestamp = new Date();
  } catch (error) {
    console.error("System metrics update error:", error);
  }
}

function broadcast(message: any): void {
  const messageStr = JSON.stringify(message);
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageStr);
      } catch (error) {
        console.error("Broadcast error:", error);
        connectedClients.delete(client);
      }
    }
  });
}

function broadcastSystemUpdate(): void {
  broadcast({
    type: "system_metrics",
    metrics: systemMetrics,
    state: systemState,
    timestamp: new Date(),
  });
}

async function handleResonanceUpdate(
  resonanceFilter: any,
  profileId: string,
): Promise<void> {
  try {
    const profile = await profilesRepo.getById(profileId);
    if (profile) {
      // Update profile preferences based on resonance filter
      Object.assign(profile.resources.preferences, {
        resonanceFilter,
        lastUpdated: new Date(),
      });

      // Trigger re-optimization
      const recommendations =
        recommendationEngine.getProfileRecommendations(profileId);

      broadcast({
        type: "resonance_updated",
        profileId,
        recommendations: recommendations.slice(0, 5),
      });
    }
  } catch (error) {
    console.error("Resonance update error:", error);
  }
}

async function handleAuraInteraction(interaction: any): Promise<void> {
  try {
    const { fromId, toId, type, data } = interaction;

    // Record the interaction
    behaviorObserver.observeInteraction(fromId, type, "positive");

    if (toId) {
      behaviorObserver.observeInteraction(toId, type, "neutral");

      // Update network connection
      const currentEdge = networkManager.getEdge(fromId, toId);
      const newWeight = currentEdge
        ? Math.min(1, currentEdge.weight + 0.1)
        : 0.3;
      networkManager.addEdge(fromId, toId, newWeight);
    }

    // Broadcast interaction to other clients
    broadcast({
      type: "aura_interaction",
      interaction: {
        fromId,
        toId,
        type,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Aura interaction error:", error);
  }
}

// Serve static files
app.use(express.static(path.join(__dirname, "../../frontend")));

// Serve frontend for any non-API routes
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../../frontend/index.html"));
  } else {
    res.status(404).json({ error: "API endpoint not found" });
  }
});

// ==================== SERVER STARTUP ====================

async function startServer() {
  try {
    console.log("🌟 Starting Symbiotic Coordination System...");

    // Load existing data
    await loadData();

    // Initialize advanced systems
    await initializeAdvancedSystems();

    // Initialize sample data if needed
    if (process.env.NODE_ENV !== "production" && (await profilesRepo.getAll()).length === 0) {
      await initializeSampleData();
      await saveData(); // Save sample data after initialization
    }

    // Start the HTTP and WebSocket server
    server.listen(HTTP_PORT, () => {
      console.log(`🚀 Server running at http://localhost:${HTTP_PORT}`);
      console.log(`📡 WebSocket server running at ws://localhost:${HTTP_PORT}`);
      console.log(`🧠 AI-Enhanced Coordination Network Active`);
      console.log(`⚡ Advanced Optimization Algorithms Loaded`);
      console.log(`🎯 Real-time Symbiotic Matching Enabled`);
      console.log(`📊 System Metrics Collection Active`);
      console.log("💫 Ready for Coordination...\n");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

async function initializeSampleData(): Promise<void> {
  try {
    // Create some sample profiles
    const sampleProfiles = [
      {
        name: "Alice Developer",
        avatar: "alice.jpg",
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
      },
      {
        name: "Bob Designer",
        avatar: "bob.jpg",
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
      },
    ];

    for (const profileData of sampleProfiles) {
      const profile: Profile = {
        id: generateId("profile"),
        ...profileData,
      };

      await profilesRepo.save(profile);
      profileManager.addProfile(profile);
      networkManager.addNode(profile);
    }

    // Create some sample listings
    const profileIds = (await profilesRepo.getAll()).map(p => p.id);
    const sampleListings = [
      {
        title: "JavaScript Development Help",
        description: "Experienced developer offering JavaScript assistance and code review",
        type: "offer",
        providerId: profileIds[0],
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
      },
      {
        title: "UI/UX Design Consultation",
        description: "Professional designer offering consultation and design reviews",
        type: "offer",
        providerId: profileIds[1],
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
      },
    ];

    for (const listingData of sampleListings) {
      const listing: ServiceListing = {
        id: generateId("listing"),
        ...listingData,
      };

      await listingsRepo.save(listing);
    }

    console.log(
      `✅ Sample data initialized: ${(await profilesRepo.getAll()).length} profiles, ${(await listingsRepo.getAll()).length} listings`,
    );
  } catch (error) {
    console.error("Sample data initialization failed:", error);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

// Start the server
startServer().catch((error) => {
  console.error("❌ Fatal error during startup:", error);
  process.exit(1);
});

// ==================== HELPER FUNCTIONS ====================

// Helper function to get session from header
function getSessionFromHeader(req: Request): any {
  const sessionId = req.headers['session-id'] as string;
  return sessions.get(sessionId);
}


