import express from "express";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import cors from "cors";
import {
  Profile,
  ServiceListing,
  CoordinationMechanism,
  SystemMetrics,
  MatchingResult,
  OptimizationObjective,
  Constraint,
  ResourceAllocation,
  SystemState,
  AIRequest,
  AIResponse,
  RecommendedAction,
} from "../shared/types";

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
const profiles: Map<string, Profile> = new Map();
const listings: Map<string, ServiceListing> = new Map();
const sessions: Map<string, any> = new Map();

// ==================== MIDDLEWARE SETUP ====================

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
    profileManager = new ProfileManager();
    behaviorObserver = new BehaviorObserver(profileManager);
    recommendationEngine = new RecommendationEngine(
      networkManager,
      behaviorObserver,
    );
    optimizationEngine = new OptimizationEngine();
    cloudModelEngine = new CloudModelEngine();
    agentManager = new AgentManager();

    // Initialize simulation
    simulation = new HighDimSimulation(
      networkManager,
      profileManager,
      [], // Cloud models will be added dynamically
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
      return res.status(404).json({ error: "No active profile" });
    }

    const profile = profiles.get(session.profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Enhance profile through AI before returning
    const enhancedProfile = await cloudModelEngine.enhanceProfile(profile);
    profiles.set(profile.id, enhancedProfile);

    res.json(enhancedProfile);
  } catch (error) {
    console.error("Get current profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

app.post("/api/profile", async (req, res) => {
  try {
    const profileData = req.body as Partial<Profile>;

    // Create comprehensive profile with defaults
    const profile: Profile = {
      id: generateId("profile"),
      name: profileData.name || "Anonymous",
      avatar: profileData.avatar || generateAvatar(),
      location: profileData.location || { latitude: 0, longitude: 0 },
      resources: {
        goods: profileData.resources?.goods || [],
        skills: profileData.resources?.skills || [],
        needs: profileData.resources?.needs || [],
        timeAvailable: profileData.resources?.timeAvailable || [],
        preferences:
          profileData.resources?.preferences || getDefaultPreferences(),
      },
      weight: 0.5, // Initial weight
      reputation: getDefaultReputation(),
      economicProfile: getDefaultEconomicProfile(),
      behaviorProfile: getDefaultBehaviorProfile(),
      lastUpdated: new Date(),
      isActive: true,
    };

    // Enhance profile through AI
    const enhancedProfile = await cloudModelEngine.enhanceProfile(profile);

    // Store in systems
    profiles.set(enhancedProfile.id, enhancedProfile);
    profileManager.addProfile(enhancedProfile);
    networkManager.addNode(enhancedProfile);

    // Create personal agent
    const agent = agentManager.createAgent(
      enhancedProfile.id,
      networkManager,
      recommendationEngine,
      behaviorObserver,
    );

    // Create session
    const sessionId = generateId("session");
    sessions.set(sessionId, {
      profileId: enhancedProfile.id,
      createdAt: new Date(),
    });

    // Broadcast new profile to network
    broadcast({
      type: "new_profile",
      profile: enhancedProfile,
    });

    res.status(201).json({
      profile: enhancedProfile,
      sessionId,
      agent: { id: agent.getProfile()?.id },
    });
  } catch (error) {
    console.error("Create profile error:", error);
    res.status(500).json({ error: "Failed to create profile" });
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

    // Get all listings and sort by relevance
    const allListings = Array.from(listings.values())
      .filter((listing) => listing.isActive)
      .map((listing) => ({
        ...listing,
        matchingScore: calculateListingRelevance(listing, session.profileId),
      }))
      .sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));

    res.json({
      listings: allListings,
      recommendations,
      total: allListings.length,
    });
  } catch (error) {
    console.error("Get listings error:", error);
    res.status(500).json({ error: "Failed to get listings" });
  }
});

app.post("/api/listings", async (req, res) => {
  try {
    const listingData = req.body as Partial<ServiceListing>;
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const listing: ServiceListing = {
      id: generateId("listing"),
      title: listingData.title || "Untitled",
      description: listingData.description || "",
      type: listingData.type || "service",
      providerId: session.profileId,
      location: listingData.location || { latitude: 0, longitude: 0 },
      pricing: listingData.pricing || {
        basePrice: 0,
        currency: "USD",
        pricingType: "negotiable",
      },
      availability: listingData.availability || [],
      requirements: listingData.requirements || [],
      tags: listingData.tags || [],
      qualityMetrics: listingData.qualityMetrics || getDefaultQuality(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    // Store listing
    listings.set(listing.id, listing);

    // Update network with new listing
    networkManager.addEdge(listing.providerId, listing.id, 1.0);

    // Broadcast new listing
    broadcast({
      type: "new_listing",
      listing,
    });

    res.status(201).json(listing);
  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({ error: "Failed to create listing" });
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
      objectives: objectives || [
        {
          type: "utility_maximization",
          weight: 1,
          targetValue: 1,
          currentValue: 0,
          priority: 1,
        },
      ],
      constraints: [],
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
app.post("/api/matches", async (req, res) => {
  try {
    const { targetProfileId, dimensions } = req.body;
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);

    if (!session?.profileId) {
      return res.status(401).json({ error: "No active session" });
    }

    const sourceProfile = profiles.get(session.profileId);
    if (!sourceProfile) {
      return res.status(404).json({ error: "Source profile not found" });
    }

    let candidateProfiles: Profile[];

    if (targetProfileId) {
      const targetProfile = profiles.get(targetProfileId);
      candidateProfiles = targetProfile ? [targetProfile] : [];
    } else {
      candidateProfiles = Array.from(profiles.values()).filter(
        (p) => p.id !== sourceProfile.id && p.isActive,
      );
    }

    // Use AI-enhanced optimization for matching
    const aiMatches = await cloudModelEngine.optimizeMatching(
      sourceProfile,
      candidateProfiles,
    );

    // Also use traditional optimization engine
    const traditionalMatches = optimizationEngine.findOptimalMatches(
      sourceProfile,
      candidateProfiles,
      dimensions,
    );

    // Combine and rank results
    const combinedMatches = combineMatchingResults(
      aiMatches,
      traditionalMatches,
    );

    res.json({
      matches: combinedMatches,
      sourceProfile: sourceProfile.id,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Matching error:", error);
    res.status(500).json({ error: "Failed to find matches" });
  }
});

app.post("/api/optimize", async (req, res) => {
  try {
    const { nodeId, currentProfile: currentProfileId, objectives } = req.body;

    const profile = profiles.get(currentProfileId);
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
app.post("/api/connections", async (req, res) => {
  try {
    const { fromId, toId } = req.body;
    const sessionId = req.headers["session-id"] as string;
    const session = sessions.get(sessionId);

    if (!session?.profileId || session.profileId !== fromId) {
      return res.status(401).json({ error: "Unauthorized connection request" });
    }

    const fromProfile = profiles.get(fromId);
    const toProfile = profiles.get(toId);

    if (!fromProfile || !toProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Calculate connection strength
    const strength = calculateConnectionStrength(fromProfile, toProfile);

    // Add edge to network
    networkManager.addEdge(fromId, toId, strength);

    // Record behavior observation
    behaviorObserver.observeInteraction(fromId, "message", "positive");
    behaviorObserver.observeInteraction(toId, "message", "positive");

    // Broadcast connection
    broadcast({
      type: "connection_established",
      from: fromId,
      to: toId,
      strength,
    });

    res.json({
      success: true,
      connection: { from: fromId, to: toId, strength },
    });
  } catch (error) {
    console.error("Connection error:", error);
    res.status(500).json({ error: "Failed to create connection" });
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
    activeProfiles: profiles.size,
    activeListings: listings.size,
    activeCoordinations: activeCoordinations.size,
    systemHealth: systemState.systemHealth,
    timestamp: new Date(),
  };

  res.json(health);
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
  listing: ServiceListing,
  profileId: string,
): number {
  const profile = profiles.get(profileId);
  if (!profile) return 0;

  // Simple relevance calculation based on needs matching
  const needs = profile.resources.needs.map((n) => n.name);
  const tagMatches = listing.tags.filter((tag) => needs.includes(tag)).length;

  return tagMatches / Math.max(listing.tags.length, 1);
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

function calculateLocationBonus(locA: any, locB: any): number {
  if (!locA || !locB) return 0;

  const distance = Math.sqrt(
    Math.pow(locA.latitude - locB.latitude, 2) +
      Math.pow(locA.longitude - locB.longitude, 2),
  );

  return Math.max(0, 1 - distance / 100); // Max bonus within 100 units
}

function calculateValueAlignment(valuesA: any, valuesB: any): number {
  const keys = Object.keys(valuesA);
  const alignments = keys.map((key) => {
    const diff = Math.abs((valuesA[key] || 0) - (valuesB[key] || 0));
    return 1 - diff;
  });

  return (
    alignments.reduce((sum, alignment) => sum + alignment, 0) /
    alignments.length
  );
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
    const profilesArray = Array.from(profiles.values());
    const objectives: OptimizationObjective[] = [
      {
        type: "utility_maximization",
        weight: 0.4,
        targetValue: 1,
        currentValue: systemMetrics.totalUtility,
        priority: 1,
      },
      {
        type: "waste_minimization",
        weight: 0.3,
        targetValue: 0,
        currentValue: systemMetrics.wasteLevel,
        priority: 2,
      },
      {
        type: "equity_maximization",
        weight: 0.3,
        targetValue: 1,
        currentValue: systemMetrics.equityIndex,
        priority: 2,
      },
    ];

    const constraints: Constraint[] = [
      {
        id: "resource_limit",
        type: "resource_limit",
        parameters: { maxResources: 1000 },
        hardness: "hard",
        weight: 1,
        violated: false,
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
      coordination.currentState.progress = Math.min(
        1,
        coordination.currentState.progress + 0.02,
      );

      // Update participant states
      coordination.currentState.participants.forEach((participant) => {
        participant.engagement = Math.min(
          1,
          participant.engagement + Math.random() * 0.1,
        );
        participant.lastActive = new Date();
      });

      // Update performance metrics
      coordination.performance.efficiency = Math.min(
        1,
        coordination.performance.efficiency + 0.01,
      );

      // Move to next phase if progress is sufficient
      if (
        coordination.currentState.progress > 0.8 &&
        coordination.currentState.phase !== "completion"
      ) {
        const phases = [
          "discovery",
          "matching",
          "negotiation",
          "agreement",
          "execution",
          "completion",
        ];
        const currentPhaseIndex = phases.indexOf(
          coordination.currentState.phase,
        );
        if (currentPhaseIndex < phases.length - 1) {
          coordination.currentState.phase = phases[
            currentPhaseIndex + 1
          ] as any;
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
    for (const [profileId, profile] of profiles) {
      // Simulate learning from interactions
      const agent = agentManager.getAgent(profileId);
      if (agent) {
        const history = agent.getInteractionHistory();

        // Update profile weight based on recent activity
        if (history.profileInteractions > 10) {
          profile.weight = Math.min(1, profile.weight + 0.01);
        }

        // Update behavior patterns
        behaviorObserver.observeActivity(
          profileId,
          history.profileInteractions * 1000,
        );
      }
    }
  } catch (error) {
    console.error("Learning adaptation error:", error);
  }
}

async function collectComprehensiveMetrics(): Promise<Partial<SystemMetrics>> {
  try {
    const activeProfileCount = Array.from(profiles.values()).filter(
      (p) => p.isActive,
    ).length;
    const activeListingCount = Array.from(listings.values()).filter(
      (l) => l.isActive,
    ).length;

    // Calculate total utility across all profiles
    const totalUtility =
      Array.from(profiles.values()).reduce(
        (sum, profile) => sum + profile.weight,
        0,
      ) / Math.max(activeProfileCount, 1);

    // Calculate network health based on connections
    const totalConnections = Array.from(profiles.values()).reduce(
      (sum, profile) => {
        const node = networkManager.getNode(profile.id);
        return sum + (node?.connections.length || 0);
      },
      0,
    );

    const networkHealth = Math.min(
      1,
      totalConnections / Math.max(activeProfileCount * 2, 1),
    );

    // Calculate social welfare
    const socialWelfare =
      Array.from(profiles.values()).reduce(
        (sum, profile) =>
          sum + profile.economicProfile.valueAlignment.community,
        0,
      ) / Math.max(activeProfileCount, 1);

    return {
      totalUtility,
      networkHealth,
      socialWelfare,
      coordinationCost: activeCoordinations.size * 0.01,
      adaptationSpeed: 0.6 + Math.random() * 0.2,
    };
  } catch (error) {
    console.error("Metrics collection error:", error);
    return {};
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
      activeProfiles: profiles.size,
      activeCoordinations: activeCoordinations.size,
    });
  }
}

async function updateSystemMetrics(): Promise<void> {
  try {
    const newMetrics = await collectComprehensiveMetrics();
    Object.assign(systemMetrics, newMetrics);

    // Update system state
    systemState.activeProfiles = Array.from(profiles.values()).filter(
      (p) => p.isActive,
    ).length;
    systemState.activeListings = Array.from(listings.values()).filter(
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
    const profile = profiles.get(profileId);
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

    // Initialize advanced systems
    await initializeAdvancedSystems();

    // Add some sample data for development
    if (process.env.NODE_ENV !== "production") {
      await initializeSampleData();
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
  console.log("🔄 Initializing sample data...");

  try {
    // Create sample profiles
    const sampleProfiles = [
      {
        name: "Alice Cooper",
        location: { latitude: 37.7749, longitude: -122.4194 },
        resources: {
          goods: [
            {
              id: "bike",
              name: "Mountain Bike",
              category: "transportation",
              quantity: 1,
              unit: "item",
              quality: getDefaultQuality(),
              availability: [],
              utility: 0.8,
              tags: ["transport", "recreation"],
            },
          ],
          skills: [
            {
              id: "design",
              name: "Graphic Design",
              category: "creative",
              proficiencyLevel: 0.9,
              experience: 5,
              certifications: [],
              availability: [],
              tags: ["creative", "digital"],
            },
          ],
          needs: [
            {
              id: "garden",
              name: "Garden Help",
              category: "professional",
              urgency: 0.7,
              priority: 0.8,
              quantity: 1,
              unit: "service",
              alternatives: [],
              tags: ["gardening", "outdoor"],
            },
          ],
          timeAvailable: [],
          preferences: getDefaultPreferences(),
        },
      },
      {
        name: "Bob Builder",
        location: { latitude: 37.7849, longitude: -122.4094 },
        resources: {
          goods: [
            {
              id: "tools",
              name: "Construction Tools",
              category: "tools_equipment",
              quantity: 1,
              unit: "set",
              quality: getDefaultQuality(),
              availability: [],
              utility: 0.9,
              tags: ["construction", "repair"],
            },
          ],
          skills: [
            {
              id: "carpentry",
              name: "Carpentry",
              category: "technical",
              proficiencyLevel: 0.95,
              experience: 15,
              certifications: ["Licensed Contractor"],
              availability: [],
              tags: ["construction", "repair"],
            },
          ],
          needs: [
            {
              id: "marketing",
              name: "Marketing Help",
              category: "professional",
              urgency: 0.5,
              priority: 0.6,
              quantity: 1,
              unit: "service",
              alternatives: [],
              tags: ["business", "promotion"],
            },
          ],
          timeAvailable: [],
          preferences: getDefaultPreferences(),
        },
      },
      {
        name: "Carol Green",
        location: { latitude: 37.7649, longitude: -122.4294 },
        resources: {
          goods: [
            {
              id: "vegetables",
              name: "Organic Vegetables",
              category: "consumables",
              quantity: 10,
              unit: "pounds",
              quality: getDefaultQuality(),
              availability: [],
              utility: 0.7,
              tags: ["food", "organic", "healthy"],
            },
          ],
          skills: [
            {
              id: "gardening",
              name: "Organic Gardening",
              category: "specialized",
              proficiencyLevel: 0.8,
              experience: 8,
              certifications: [],
              availability: [],
              tags: ["gardening", "organic"],
            },
          ],
          needs: [
            {
              id: "website",
              name: "Website Design",
              category: "professional",
              urgency: 0.6,
              priority: 0.7,
              quantity: 1,
              unit: "project",
              alternatives: [],
              tags: ["web", "design"],
            },
          ],
          timeAvailable: [],
          preferences: getDefaultPreferences(),
        },
      },
    ];

    for (const profileData of sampleProfiles) {
      const profile: Profile = {
        id: generateId("profile"),
        name: profileData.name,
        avatar: generateAvatar(),
        location: profileData.location,
        resources: profileData.resources,
        weight: 0.7 + Math.random() * 0.3,
        reputation: getDefaultReputation(),
        economicProfile: getDefaultEconomicProfile(),
        behaviorProfile: getDefaultBehaviorProfile(),
        lastUpdated: new Date(),
        isActive: true,
      };

      profiles.set(profile.id, profile);
      profileManager.addProfile(profile);
      networkManager.addNode(profile);

      // Create personal agent
      agentManager.createAgent(
        profile.id,
        networkManager,
        recommendationEngine,
        behaviorObserver,
      );
    }

    // Create some sample listings
    const profileIds = Array.from(profiles.keys());
    const sampleListings = [
      {
        title: "Bike Repair Service",
        description: "Professional bike maintenance and repair",
        type: "service" as const,
        providerId: profileIds[1], // Bob
        tags: ["repair", "bicycle", "maintenance"],
      },
      {
        title: "Fresh Organic Vegetables",
        description: "Locally grown organic vegetables, harvested weekly",
        type: "goods" as const,
        providerId: profileIds[2], // Carol
        tags: ["organic", "food", "vegetables", "healthy"],
      },
      {
        title: "Logo Design Service",
        description: "Creative logo design for small businesses",
        type: "service" as const,
        providerId: profileIds[0], // Alice
        tags: ["design", "logo", "branding", "creative"],
      },
    ];

    for (const listingData of sampleListings) {
      const listing: ServiceListing = {
        id: generateId("listing"),
        title: listingData.title,
        description: listingData.description,
        type: listingData.type,
        providerId: listingData.providerId,
        location: { latitude: 37.7749, longitude: -122.4194 },
        pricing: {
          basePrice: 50 + Math.random() * 100,
          currency: "USD",
          pricingType: "negotiable",
        },
        availability: [],
        requirements: [],
        tags: listingData.tags,
        qualityMetrics: getDefaultQuality(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      listings.set(listing.id, listing);
    }

    // Create initial connections
    if (profileIds.length >= 3) {
      networkManager.addEdge(profileIds[0], profileIds[1], 0.6); // Alice -> Bob
      networkManager.addEdge(profileIds[1], profileIds[2], 0.7); // Bob -> Carol
      networkManager.addEdge(profileIds[2], profileIds[0], 0.5); // Carol -> Alice
    }

    console.log(
      `✅ Sample data initialized: ${profiles.size} profiles, ${listings.size} listings`,
    );
  } catch (error) {
    console.error("❌ Failed to initialize sample data:", error);
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
