// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Production Backend Server (REFACTORED)
// Express.js + WebSocket + AI-Enhanced Coordination Network
// 
// SECURITY HARDENED • MODULAR ARCHITECTURE • PRODUCTION READY
// ═══════════════════════════════════════════════════════════════════════════════

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { WebSocket, WebSocketServer } from "ws";

// Types
import {
  Profile,
  ServiceListing,
  Connection,
  MatchingResult,
  SystemMetrics,
  SystemState,
  OptimizationObjective,
  CoordinationMechanism,
} from "../shared/types";

// Mechanisms
import { NetworkManager } from "../mechanisms/network";
import { ProfileManager } from "../mechanisms/profiles";
import { RecommendationEngine } from "../mechanisms/recommendation";
import { OptimizationEngine } from "../mechanisms/optimization";
import { CloudModelEngine } from "../mechanisms/cloudModels";
import { AgentManager } from "../mechanisms/agents";
import { BehaviorObserver } from "../mechanisms/behavior";
import { HighDimSimulation } from "../mechanisms/simulation";
import { HarmonizationEngine } from "../mechanisms/matching/HarmonizationEngine";

// Middleware
import {
  apiLimiter,
  sanitizeAll,
  requestLogger,
  errorHandler,
  notFoundHandler,
  setupUncaughtExceptionHandlers,
  setupGracefulShutdown,
  WebSocketManager,
} from "./middleware";

// Routes
import profilesRouter from "./routes/profiles";
import listingsRouter from "./routes/listings";
import systemRouter from "./routes/system";
import n8nRouter from "./n8n-integration";

// Database
import { initializeDatabaseAdapters } from "./db/adapter";

// Utils
import { logger, logSecurityEvent } from "../shared/utils";

// ═══════════════════════════════════════════════════════════════════════════════
// Security & Infrastructure Setup
// ═══════════════════════════════════════════════════════════════════════════════

// Setup uncaught exception handlers
setupUncaughtExceptionHandlers();

const app = express();
const PORT = parseInt(process.env.PORT || "3003", 10);
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ═══════════════════════════════════════════════════════════════════════════════
// Application State
// ═══════════════════════════════════════════════════════════════════════════════

let profilesRepo: any;
let listingsRepo: any;
let connectionsRepo: any;

const sessions = new Map<string, { profileId: string; createdAt: Date }>();
const activeCoordinations = new Map<string, CoordinationMechanism>();

// Mechanism engines
let networkManager: NetworkManager;
let profileManager: ProfileManager;
let recommendationEngine: RecommendationEngine;
let optimizationEngine: OptimizationEngine;
let cloudModelEngine: CloudModelEngine;
let agentManager: AgentManager;
let behaviorObserver: BehaviorObserver;
let highDimSimulation: HighDimSimulation;
let harmonizationEngine: HarmonizationEngine;

// System state
let systemState: SystemState;
let systemMetrics: SystemMetrics;

// WebSocket manager
const wsManager = new WebSocketManager({
  maxConnectionsPerIp: 10,
  rateLimitWindow: 60000,
  rateLimitMax: 30,
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

import { randomBytes } from "crypto";

/**
 * Generates a cryptographically secure unique ID
 * Uses crypto.randomBytes for security - NOT Math.random() which is predictable
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(16).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generates a random avatar seed
 * Note: Using Math.random here is acceptable as avatar seeds are not security-sensitive
 */
function generateAvatar(): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomBytes(8).toString('hex')}`;
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const x = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function textEmbed(text: string): number[] {
  const lower = (text || "").toLowerCase();
  const vec = [0, 0, 0, 0, 0];
  for (let i = 0; i < lower.length; i++) vec[i % 5] += lower.charCodeAt(i);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return !na || !nb ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function calculateListingRelevance(
  profileId: string,
  listing: ServiceListing
): Promise<number> {
  try {
    const profile = await profilesRepo.getById(profileId);
    if (!profile) return 0.5;

    const needs = profile.resources.needs.map((n: any) => n.name.toLowerCase());
    const skills = profile.resources.skills.map((s: any) => s.name.toLowerCase());
    const profileText = [...needs, ...skills, profile.name].join(" ");
    const listingTags = listing.tags.map((t) => t.toLowerCase());

    const tagOverlap = listingTags.filter((t) => needs.includes(t) || skills.includes(t)).length;
    const tagScore = tagOverlap / Math.max(listingTags.length, 1);
    const semScore = cosineSim(
      textEmbed(profileText),
      textEmbed(`${listing.title} ${listing.description} ${listing.tags.join(" ")}`)
    );

    return tagScore * 0.6 + semScore * 0.4;
  } catch {
    return 0.5;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Middleware Configuration
// ═══════════════════════════════════════════════════════════════════════════════

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://api.dicebear.com"],
        imgSrc: ["'self'", "data:", "https://api.dicebear.com"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
  })
);

// CORS with restricted origins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logSecurityEvent('cors_blocked', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  })
);

// Request logging
app.use(requestLogger);

// Body parsing with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global sanitization
app.use(sanitizeAll);

// Rate limiting for API endpoints
app.use("/api/", apiLimiter);

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Route Registration
// ═══════════════════════════════════════════════════════════════════════════════

// API routes
app.use("/api/profiles", profilesRouter);
app.use("/api/listings", listingsRouter);
app.use("/api", systemRouter);

// Legacy routes for backward compatibility (to be deprecated)
app.use("/n8n", n8nRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket Server
// ═══════════════════════════════════════════════════════════════════════════════

wss.on("connection", (ws: WebSocket, req: any) => {
  try {
    wsManager.handleConnection(ws, req);
  } catch (error) {
    logger.error('WebSocket connection error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Background Processes
// ═══════════════════════════════════════════════════════════════════════════════

function startBackgroundProcesses() {
  // System optimization — every 30s
  setInterval(async () => {
    try {
      systemState.systemHealth.overall = Math.min(1, systemState.systemHealth.overall + 0.01);
      networkManager.updateWeights();
      optimizeActiveCoordinations();
      await updateSystemMetrics();

      // Broadcast to WebSocket clients
      wsManager.broadcast({
        type: "system_metrics",
        metrics: systemMetrics,
        state: systemState,
        timestamp: new Date(),
      });
    } catch (err: any) {
      logger.error("Optimization error", {
        error: err.message,
      });
    }
  }, 30000);

  // Agent simulation — every 10s
  setInterval(async () => {
    try {
      await agentManager.runAll();
      await highDimSimulation.runSimulationStep();
    } catch (err: any) {
      logger.error("Simulation error", {
        error: err.message,
      });
    }
  }, 10000);

  // Metrics collection — every 5s
  setInterval(async () => {
    try {
      const fresh = await collectMetrics();
      systemMetrics = { ...systemMetrics, ...fresh };
    } catch (err: any) {
      logger.error("Metrics error", {
        error: err.message,
      });
    }
  }, 5000);

  // Cleanup inactive WebSocket clients — every 5 minutes
  setInterval(() => {
    wsManager.cleanupInactiveClients(30 * 60 * 1000);
  }, 5 * 60 * 1000);

  logger.info("Background processes started");
}

function optimizeActiveCoordinations() {
  const phases = ["discovery", "matching", "negotiation", "agreement", "execution", "completion"];
  for (const [, coord] of activeCoordinations) {
    coord.currentState.progress = Math.min(1, coord.currentState.progress + 0.02);
    coord.currentState.participants.forEach((p) => {
      p.engagement = Math.min(1, p.engagement + Math.random() * 0.1);
      p.lastActive = new Date();
    });
    coord.performance.efficiency = Math.min(1, coord.performance.efficiency + 0.01);

    if (coord.currentState.progress > 0.8 && coord.currentState.phase !== "completion") {
      const idx = phases.indexOf(coord.currentState.phase);
      if (idx < phases.length - 1) {
        coord.currentState.phase = phases[idx + 1];
        coord.currentState.progress = 0;
      }
    }
  }
}

async function collectMetrics(): Promise<Partial<SystemMetrics>> {
  try {
    const allP = await profilesRepo.getAll();
    const allL = await listingsRepo.getAll();
    const active = allP.filter((p: Profile) => p.isActive).length;
    const totalUtility = allP.reduce((s: number, p: Profile) => s + p.weight, 0) / Math.max(active, 1);
    const totalConns = allP.reduce(
      (s: number, p: Profile) => s + (networkManager.getNode(p.id)?.connections.length || 0),
      0
    );
    const socialWelfare = allP.reduce(
      (s: number, p: Profile) => s + ((p.economicProfile.valueAlignment as any)?.community || 0),
      0
    ) / Math.max(active, 1);

    return {
      totalUsers: allP.length,
      activeUsers: active,
      totalListings: allL.length,
      activeListings: allL.filter((l: ServiceListing) => l.isActive).length,
      totalUtility,
      networkHealth: Math.min(1, totalConns / Math.max(active * 2, 1)),
      socialWelfare,
      coordinationCost: activeCoordinations.size * 0.01,
      adaptationSpeed: 0.6 + Math.random() * 0.2,
    };
  } catch {
    return {};
  }
}

async function updateSystemMetrics() {
  const fresh = await collectMetrics();
  Object.assign(systemMetrics, fresh);

  const allP = await profilesRepo.getAll();
  const allL = await listingsRepo.getAll();

  systemState.activeProfiles = allP.filter((p: Profile) => p.isActive).length;
  systemState.activeListings = allL.filter((l: ServiceListing) => l.isActive).length;
  systemState.activeCoordinations = activeCoordinations.size;
  systemState.timestamp = new Date();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Static Files & Catch-All
// ═══════════════════════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("*", (req: Request, res: Response) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
  } else {
    res.status(404).json({ error: "API endpoint not found" });
  }
});

// Error handling
app.use(errorHandler);
app.use(notFoundHandler);

// ═══════════════════════════════════════════════════════════════════════════════
// Server Startup
// ═══════════════════════════════════════════════════════════════════════════════

async function startServer() {
  try {
    logger.info("🌟 Starting Coordination Cosmos...");

    // Initialize database adapters
    const adapters = await initializeDatabaseAdapters();
    profilesRepo = adapters.profilesRepo;
    listingsRepo = adapters.listingsRepo;
    connectionsRepo = adapters.connectionsRepo;

    // Initialize mechanism engines
    networkManager = new NetworkManager();
    profileManager = new ProfileManager();
    behaviorObserver = new BehaviorObserver(profileManager);
    recommendationEngine = new RecommendationEngine(networkManager, behaviorObserver);
    optimizationEngine = new OptimizationEngine();
    cloudModelEngine = new CloudModelEngine();
    agentManager = new AgentManager();
    harmonizationEngine = new HarmonizationEngine();
    highDimSimulation = new HighDimSimulation(networkManager, profileManager, [cloudModelEngine]);

    // Initialize system state
    systemState = {
      timestamp: new Date(),
      activeProfiles: 0,
      activeListings: 0,
      activeCoordinations: 0,
      systemHealth: {
        overall: 1,
        network: 1,
        agents: 1,
        coordination: 1,
        learning: 1,
        adaptation: 1,
      },
      performance: {
        throughput: 0,
        latency: 50,
        errorRate: 0,
        resourceUtilization: 0.3,
        scalabilityIndex: 0.8,
      },
      metrics: {},
    };

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

    // Store in app.locals for route access
    (app.locals as any).profilesRepo = profilesRepo;
    (app.locals as any).listingsRepo = listingsRepo;
    (app.locals as any).connectionsRepo = connectionsRepo;
    (app.locals as any).networkManager = networkManager;
    (app.locals as any).harmonizationEngine = harmonizationEngine;
    (app.locals as any).cloudModelEngine = cloudModelEngine;
    (app.locals as any).systemMetrics = systemMetrics;
    (app.locals as any).systemState = systemState;
    (app.locals as any).activeCoordinations = activeCoordinations;
    (app.locals as any).wsManager = wsManager;

    // Sample data for development
    if (process.env.NODE_ENV !== "production" && (await profilesRepo.getAll()).length === 0) {
      await initializeSampleData();
    }

    // Start background processes
    startBackgroundProcesses();

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running at http://localhost:${PORT}`);
      logger.info(`📡 WebSocket active at ws://localhost:${PORT}`);
      logger.info(`🧠 AI-Enhanced Coordination Network Active`);
      logger.info("💫 Ready for coordination...\n");
    });

    // Setup graceful shutdown
    setupGracefulShutdown(server);

    // Store wsManager globally for shutdown
    (global as any).wsManager = wsManager;

  } catch (err: any) {
    logger.error("❌ Fatal startup error", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

async function initializeSampleData() {
  const makeProfile = (
    name: string,
    lat: number,
    lon: number,
    skillName: string,
    skillCat: string,
    needName: string,
    needCat: string
  ): Profile => ({
    id: generateId("profile"),
    name,
    avatar: generateAvatar(),
    location: { latitude: lat, longitude: lon },
    resources: {
      goods: [],
      skills: [
        {
          id: generateId("skill"),
          name: skillName,
          category: skillCat,
          proficiencyLevel: 0.9,
          availability: [],
          tags: [skillCat],
        },
      ],
      needs: [
        {
          id: generateId("need"),
          name: needName,
          category: needCat,
          urgency: 0.7,
          priority: 0.8,
          quantity: 1,
          unit: "project",
          alternatives: [],
          tags: [needCat],
        },
      ],
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
    seekings: [],
    offerings: [],
  });

  const alice = makeProfile(
    "Alice Developer",
    37.7749,
    -122.4194,
    "JavaScript",
    "programming",
    "Design Help",
    "design"
  );
  const bob = makeProfile(
    "Bob Designer",
    37.7849,
    -122.4094,
    "UI/UX Design",
    "design",
    "Code Review",
    "programming"
  );

  for (const p of [alice, bob]) {
    await profilesRepo.save(p);
    profileManager.addProfile(p);
    networkManager.addNode(p);
    agentManager.createAgent(p);
  }

  const listings: ServiceListing[] = [
    {
      id: generateId("listing"),
      title: "JavaScript Development Help",
      description: "Experienced developer offering JS assistance",
      type: "service",
      providerId: alice.id,
      location: alice.location,
      pricing: { basePrice: 75, currency: "USD", pricingType: "hourly" },
      availability: [],
      requirements: [],
      tags: ["javascript", "programming"],
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
      id: generateId("listing"),
      title: "UI/UX Design Consultation",
      description: "Professional design reviews and consultation",
      type: "service",
      providerId: bob.id,
      location: bob.location,
      pricing: { basePrice: 100, currency: "USD", pricingType: "hourly" },
      availability: [],
      requirements: [],
      tags: ["design", "ui-ux"],
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

  for (const l of listings) {
    await listingsRepo.save(l);
  }

  logger.info(`✅ Sample data initialized`, {
    profiles: (await profilesRepo.getAll()).length,
    listings: (await listingsRepo.getAll()).length,
  });
}

// Launch
startServer().catch((err) => {
  logger.error("❌ Fatal startup error", {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});
