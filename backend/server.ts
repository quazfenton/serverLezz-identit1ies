// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Production Backend Server
// Express.js + WebSocket + AI-Enhanced Coordination Network
// ═══════════════════════════════════════════════════════════════════════════════

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import http from "http";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";

import {
  Profile,
  ServiceListing,
  Connection,
  MatchingResult,
  SystemMetrics,
  SystemState,
  OptimizationObjective,
  CoordinationMechanism,
  SessionData,
} from "../shared/types";

import { NetworkManager } from "../mechanisms/network";
import { ProfileManager } from "../mechanisms/profiles";
import { RecommendationEngine } from "../mechanisms/recommendation";
import { OptimizationEngine } from "../mechanisms/optimization";
import { CloudModelEngine } from "../mechanisms/cloudModels";
import { AgentManager } from "../mechanisms/agents";
import { BehaviorObserver } from "../mechanisms/behavior";
import { HighDimSimulation } from "../mechanisms/simulation";
import { HarmonizationEngine } from "../mechanisms/matching/HarmonizationEngine";

import { validateSchema } from "./validation/middleware";
import {
  ProfileSchema,
  ListingSchema,
  ConnectionRequestSchema,
} from "./validation/schemas";

import { initializeDatabaseAdapters } from "./db/adapter";
import n8nRouter from "./n8n-integration";

// ═══════════════════════════════════════════════════════════════════════════════
// Server & Infrastructure
// ═══════════════════════════════════════════════════════════════════════════════

const app = express();
const PORT = parseInt(process.env.PORT || "3003", 10);
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ═══════════════════════════════════════════════════════════════════════════════
// State — initialized in startServer()
// ═══════════════════════════════════════════════════════════════════════════════

let profilesRepo: any;
let listingsRepo: any;
let connectionsRepo: any;

const sessions = new Map<string, SessionData>();
const activeCoordinations = new Map<string, CoordinationMechanism>();
const connectedClients = new Set<WebSocket>();

let networkManager: NetworkManager;
let profileManager: ProfileManager;
let recommendationEngine: RecommendationEngine;
let optimizationEngine: OptimizationEngine;
let cloudModelEngine: CloudModelEngine;
let agentManager: AgentManager;
let behaviorObserver: BehaviorObserver;
let highDimSimulation: HighDimSimulation;
let harmonizationEngine: HarmonizationEngine;

let systemState: SystemState;
let systemMetrics: SystemMetrics;

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAvatar(): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).substr(2, 8)}`;
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
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return !na || !nb ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function getSessionFromHeader(req: Request): SessionData | undefined {
  const sid = req.headers["session-id"] as string;
  return sid ? sessions.get(sid) : undefined;
}

async function calculateListingRelevance(profileId: string, listing: ServiceListing): Promise<number> {
  try {
    const profile = await profilesRepo.getById(profileId);
    if (!profile) return 0;
    const needs = profile.resources.needs.map((n: any) => n.name.toLowerCase());
    const skills = profile.resources.skills.map((s: any) => s.name.toLowerCase());
    const profileText = [...needs, ...skills, profile.name].join(" ");
    const listingTags = listing.tags.map((t) => t.toLowerCase());
    const tagOverlap = listingTags.filter((t) => needs.includes(t) || skills.includes(t)).length;
    const tagScore = tagOverlap / Math.max(listingTags.length, 1);
    const semScore = cosineSim(textEmbed(profileText), textEmbed(`${listing.title} ${listing.description} ${listing.tags.join(" ")}`));
    return tagScore * 0.6 + semScore * 0.4;
  } catch { return 0.5; }
}

function calculateLocationBonus(a: any, b: any): number {
  if (!a || !b) return 0.5;
  const d = haversineKm(a, b);
  if (d < 1) return 1; if (d < 5) return 0.9; if (d < 10) return 0.8; if (d < 25) return 0.6; if (d < 50) return 0.4;
  return 0.2;
}

function calculateValueAlignment(va: any, vb: any): number {
  if (!va || !vb) return 0.5;
  let diff = 0, n = 0;
  for (const k of ["community", "sustainability", "innovation", "fairness"]) {
    if (va[k] !== undefined && vb[k] !== undefined) { diff += Math.abs(va[k] - vb[k]); n++; }
  }
  return n === 0 ? 0.5 : Math.max(0, 1 - diff / n);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════════════════════════════════════════

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});
app.use("/n8n", n8nRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// API — Profile Management
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/api/profile/current", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromHeader(req);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });
    const profile = await profilesRepo.getById(session.profileId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    try {
      const enhanced = await cloudModelEngine.enhanceProfile(profile);
      await profilesRepo.save(enhanced);
      return res.json(enhanced);
    } catch { return res.json(profile); }
  } catch (err: any) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

app.get("/api/profile/:id", async (req: Request, res: Response) => {
  try {
    const profile = await profilesRepo.getById(req.params.id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to get profile" });
  }
});

app.post("/api/profile", validateSchema(ProfileSchema), async (req: Request, res: Response) => {
  try {
    const d = req.body;
    const profile: Profile = {
      id: generateId("profile"), name: d.name, avatar: generateAvatar(),
      location: d.location || { latitude: 0, longitude: 0 },
      resources: {
        goods: d.resources?.goods || [], skills: d.resources?.services || [],
        needs: d.resources?.needs || [], timeAvailable: [], preferences: {},
      },
      weight: 0.5,
      reputation: { overall: 0.5, reliability: 0.5, quality: 0.5, responsiveness: 0.5, fairness: 0.5, trustworthiness: 0.5, socialImpact: 0.5, history: [] },
      economicProfile: {
        totalUtility: 0, wealthLevel: 0.5, spendingPower: 0.5, savingsRate: 0.5,
        riskTolerance: d.economicProfile?.riskTolerance || 0.5,
        preferredPaymentMethods: [], creditScore: 0, transactionHistory: [],
        valueAlignment: d.economicProfile?.valueAlignment || { community: 0.5, sustainability: 0.5, innovation: 0.5, fairness: 0.5 },
      },
      behaviorProfile: { interactionPatterns: [], preferences: {}, predictedActions: [], adaptationRate: 0.5, consistencyScore: 0.5, socialStyle: "balanced", decisionMakingStyle: "analytical" },
      lastUpdated: new Date(), isActive: true, seekings: [], offerings: [],
    };

    const sessionId = generateId("session");
    sessions.set(sessionId, { profileId: profile.id, createdAt: new Date() });
    await profilesRepo.save(profile);
    profileManager.addProfile(profile);
    networkManager.addNode(profile);
    agentManager.createAgent(profile);

    try { const e = await cloudModelEngine.enhanceProfile(profile); await profilesRepo.save(e); } catch {}
    res.status(201).json({ profile, sessionId });
  } catch (err: any) {
    console.error("Profile creation failed:", err);
    res.status(500).json({ error: "Failed to create profile" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API — Listing Management
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/api/listings", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromHeader(req);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });

    const recommendations = recommendationEngine.getListingRecommendations(session.profileId);
    const nearLat = req.query.nearLat ? parseFloat(String(req.query.nearLat)) : undefined;
    const nearLon = req.query.nearLon ? parseFloat(String(req.query.nearLon)) : undefined;
    const radiusKm = req.query.radiusKm ? parseFloat(String(req.query.radiusKm)) : undefined;
    const tagsQ = typeof req.query.tags === "string" ? req.query.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) : [];

    let all = (await listingsRepo.getAll()).filter((l: ServiceListing) => l.isActive);
    if (nearLat != null && nearLon != null && radiusKm != null && radiusKm > 0) {
      const ref = { latitude: nearLat, longitude: nearLon };
      all = all.filter((l: ServiceListing) => haversineKm(ref, l.location) <= radiusKm);
    }
    if (tagsQ.length) all = all.filter((l: ServiceListing) => l.tags.some((t) => tagsQ.includes(t.toLowerCase())));

    const scored = await Promise.all(all.map(async (l: ServiceListing) => ({ ...l, matchingScore: await calculateListingRelevance(session.profileId, l) })));
    scored.sort((a, b) => (b.matchingScore || 0) - (a.matchingScore || 0));
    res.json({ listings: scored, recommendations, total: scored.length });
  } catch (err: any) {
    console.error("Get listings error:", err);
    res.status(500).json({ error: "Failed to get listings" });
  }
});

app.get("/api/listings/mine", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromHeader(req);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });
    const mine = await listingsRepo.byProvider(session.profileId);
    res.json({ listings: mine, total: mine.length });
  } catch { res.status(500).json({ error: "Failed to get my listings" }); }
});

app.post("/api/listings", validateSchema(ListingSchema), async (req: Request, res: Response) => {
  try {
    const d = req.body;
    const session = getSessionFromHeader(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const listing: ServiceListing = {
      id: generateId("listing"), title: d.title, description: d.description, type: d.type,
      providerId: session.profileId,
      location: d.location || { latitude: 0, longitude: 0 },
      pricing: { basePrice: d.pricing?.basePrice || 0, currency: d.pricing?.currency || "USD", pricingType: d.pricing?.negotiable ? "negotiable" : "fixed" },
      availability: d.availability ? [d.availability] : [], requirements: d.requirements || [], tags: d.tags || [],
      qualityMetrics: { rating: 0, reliability: 0.5, durability: 0.5, functionality: 0.5, aesthetics: 0.5, sustainability: 0.5 },
      createdAt: new Date(), updatedAt: new Date(), isActive: true,
    };
    await listingsRepo.save(listing);
    networkManager.addEdge(listing.providerId, listing.id, 1.0);
    res.status(201).json(listing);
  } catch (err: any) {
    console.error("Listing creation failed:", err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

app.put("/api/listings/:id", validateSchema(ListingSchema.partial()), async (req: Request, res: Response) => {
  try {
    const session = getSessionFromHeader(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const listing = await listingsRepo.getById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.providerId !== session.profileId) return res.status(403).json({ error: "Forbidden" });
    const d = req.body;
    if (d.title !== undefined) listing.title = d.title;
    if (d.description !== undefined) listing.description = d.description;
    if (d.tags !== undefined) listing.tags = d.tags;
    listing.updatedAt = new Date();
    await listingsRepo.save(listing);
    res.json(listing);
  } catch (err: any) { res.status(500).json({ error: "Failed to update listing" }); }
});

app.delete("/api/listings/:id", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromHeader(req);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });
    const listing = await listingsRepo.getById(req.params.id);
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.providerId !== session.profileId) return res.status(403).json({ error: "Forbidden" });
    listing.isActive = false; listing.updatedAt = new Date();
    await listingsRepo.save(listing);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "Failed to delete listing" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API — Coordination
// ═══════════════════════════════════════════════════════════════════════════════

app.post("/api/coordination", async (req: Request, res: Response) => {
  try {
    const { type, participants, objectives } = req.body;
    const session = getSessionFromHeader(req);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });
    const pList = participants || [session.profileId];
    const coord: CoordinationMechanism = {
      id: generateId("coordination"), type: type || "algorithmic",
      participants: pList, initiatorId: session.profileId, status: "active",
      details: { objectives: objectives || [{ type: "utility_maximization", weight: 1 }] },
      createdAt: Date.now(), updatedAt: Date.now(),
      currentState: {
        phase: "discovery", progress: 0,
        participants: pList.map((id: string) => ({ profileId: id, engagement: 0.5, contribution: 0, satisfaction: 0.5, commitment: 0.7, lastActive: new Date() })),
        resources: [], conflicts: [], resolutions: [],
      },
      performance: { efficiency: 0.5, effectiveness: 0.5, satisfaction: 0.5, scalability: 0.7, adaptability: 0.6, robustness: 0.6 },
    };
    activeCoordinations.set(coord.id, coord);
    broadcast({ type: "coordination_started", coordinationId: coord.id, coordination: coord });
    res.status(201).json(coord);
  } catch (err: any) { res.status(500).json({ error: "Failed to create coordination" }); }
});

app.get("/api/coordination/:id", async (req: Request, res: Response) => {
  const coord = activeCoordinations.get(req.params.id);
  if (!coord) return res.status(404).json({ error: "Coordination not found" });
  res.json(coord);
});

// ═══════════════════════════════════════════════════════════════════════════════
// API — Matching & Optimization
// ═══════════════════════════════════════════════════════════════════════════════

app.post("/api/matches", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromHeader(req);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });
    const { targetProfileId, constraints } = req.body;
    const source = await profilesRepo.getById(session.profileId);
    if (!source) return res.status(404).json({ error: "Source profile not found" });

    let candidates: Profile[];
    if (targetProfileId) {
      const t = await profilesRepo.getById(targetProfileId);
      candidates = t ? [t] : [];
    } else {
      candidates = (await profilesRepo.getAll()).filter((p: Profile) => p.id !== source.id && p.isActive);
    }

    const allUsers = (await profilesRepo.getAll()).reduce((acc: Record<string, Profile>, p: Profile) => { acc[p.id] = p; return acc; }, {});
    let matches: MatchingResult[] = harmonizationEngine.findOptimalMatches(source, candidates, allUsers, new Date());
    if (constraints?.minScore) matches = matches.filter((m) => m.score >= constraints.minScore);

    res.json({ matches: matches.slice(0, 20), sourceProfile: source.id, timestamp: new Date() });
  } catch (err: any) {
    console.error("Matches error:", err);
    res.status(500).json({ error: "Failed to generate matches" });
  }
});

app.post("/api/optimize", async (req: Request, res: Response) => {
  try {
    const { currentProfile: pid, objectives } = req.body;
    const profile = await profilesRepo.getById(pid);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    const objs: OptimizationObjective[] = objectives || [
      { type: "utility_maximization", weight: 0.4, targetValue: 1, currentValue: 0.6, priority: 1 },
      { type: "waste_minimization", weight: 0.3, targetValue: 0, currentValue: 0.1, priority: 2 },
      { type: "equity_maximization", weight: 0.3, targetValue: 1, currentValue: 0.7, priority: 2 },
    ];
    const recs = await cloudModelEngine.optimizeSystemPerformance(systemMetrics, objs);
    res.json({ recommendations: recs, timestamp: new Date() });
  } catch (err: any) { res.status(500).json({ error: "Failed to optimize" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API — Connections
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/api/connections", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromHeader(req);
    if (!session?.profileId) return res.status(401).json({ error: "No active session" });
    const node = networkManager.getNode(session.profileId);
    if (!node) return res.json({ connections: [], total: 0 });
    const conns = node.connections.map((id) => {
      const edge = networkManager.getEdge(session.profileId, id);
      return { profileId: id, strength: edge?.weight ?? 0 };
    }).sort((a, b) => b.strength - a.strength);
    res.json({ connections: conns, total: conns.length });
  } catch (err: any) { res.status(500).json({ error: "Failed to get connections" }); }
});

app.post("/api/connections", validateSchema(ConnectionRequestSchema), async (req: Request, res: Response) => {
  try {
    const { fromId, toId, strength } = req.body;
    const session = getSessionFromHeader(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const srcId = fromId || session.profileId;
    const src = await profilesRepo.getById(srcId);
    const tgt = await profilesRepo.getById(toId);
    if (!src || !tgt) return res.status(404).json({ error: "Profile not found" });

    const conn: Connection = {
      id: generateId("connection"), profileA: src.id, profileB: tgt.id,
      strength: strength || 0.5, type: "social", history: [], lastInteraction: new Date(),
    };
    await connectionsRepo.create(conn);
    networkManager.addEdge(src.id, tgt.id, conn.strength);
    res.status(201).json(conn);
  } catch (err: any) { res.status(500).json({ error: "Failed to create connection" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API — System Health & Metrics
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/api/system/metrics", (_req: Request, res: Response) => {
  res.json({ metrics: systemMetrics, state: systemState, activeCoordinations: activeCoordinations.size, connectedClients: connectedClients.size, timestamp: new Date() });
});

app.get("/api/system/health", async (_req: Request, res: Response) => {
  try {
    const profiles = await profilesRepo.getAll();
    const listings = await listingsRepo.getAll();
    res.json({
      status: "healthy", uptime: process.uptime(), memory: process.memoryUsage(),
      activeProfiles: profiles.filter((p: Profile) => p.isActive).length,
      activeListings: listings.filter((l: ServiceListing) => l.isActive).length,
      activeCoordinations: activeCoordinations.size,
      systemHealth: systemState?.systemHealth, timestamp: new Date(),
    });
  } catch (err: any) { res.status(500).json({ status: "unhealthy", error: err.message }); }
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const profiles = await profilesRepo.getAll();
    const listings = await listingsRepo.getAll();
    res.json({
      status: "healthy", uptime: process.uptime(),
      activeProfiles: profiles.filter((p: Profile) => p.isActive).length,
      activeListings: listings.filter((l: ServiceListing) => l.isActive).length,
      timestamp: new Date(),
    });
  } catch { res.status(500).json({ status: "unhealthy" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket Server
// ═══════════════════════════════════════════════════════════════════════════════

wss.on("connection", (ws: WebSocket) => {
  console.log("📡 New WebSocket connection");
  connectedClients.add(ws);
  if (systemState) ws.send(JSON.stringify({ type: "system_state", data: systemState }));

  ws.on("message", async (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString());
      switch (data.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: new Date() }));
          break;
        case "subscribe_metrics":
          ws.send(JSON.stringify({ type: "system_metrics", metrics: systemMetrics }));
          break;
        case "update_resonance":
          await handleResonanceUpdate(data.resonanceFilter, data.profileId);
          break;
        case "interaction":
          await handleAuraInteraction(data.interaction);
          break;
        default:
          ws.send(JSON.stringify({ type: "error", error: "Unknown message type" }));
      }
    } catch { ws.send(JSON.stringify({ type: "error", error: "Invalid message" })); }
  });

  ws.on("close", () => connectedClients.delete(ws));
  ws.on("error", () => connectedClients.delete(ws));
});

function broadcast(message: any): void {
  const str = JSON.stringify(message);
  connectedClients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) { try { c.send(str); } catch { connectedClients.delete(c); } }
  });
}

async function handleResonanceUpdate(filter: any, profileId: string) {
  try {
    const profile = await profilesRepo.getById(profileId);
    if (profile) {
      Object.assign(profile.resources.preferences, { resonanceFilter: filter, lastUpdated: new Date() });
      const recs = recommendationEngine.getProfileRecommendations(profileId);
      broadcast({ type: "resonance_updated", profileId, recommendations: recs.slice(0, 5) });
    }
  } catch (err: any) { console.error("Resonance update error:", err); }
}

async function handleAuraInteraction(interaction: any) {
  try {
    const { fromId, toId, type } = interaction;
    behaviorObserver.observeInteraction(fromId, type, "positive");
    if (toId) {
      behaviorObserver.observeInteraction(toId, type, "neutral");
      const edge = networkManager.getEdge(fromId, toId);
      networkManager.addEdge(fromId, toId, edge ? Math.min(1, edge.weight + 0.1) : 0.3);
    }
    broadcast({ type: "aura_interaction", interaction: { fromId, toId, type, timestamp: new Date() } });
  } catch (err: any) { console.error("Aura interaction error:", err); }
}

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
      broadcast({ type: "system_metrics", metrics: systemMetrics, state: systemState, timestamp: new Date() });
    } catch (err: any) { console.error("Optimization error:", err); }
  }, 30000);

  // Agent simulation — every 10s
  setInterval(async () => {
    try {
      await agentManager.runAll();
      await highDimSimulation.runSimulationStep();
    } catch (err: any) { console.error("Simulation error:", err); }
  }, 10000);

  // Metrics collection — every 5s
  setInterval(async () => {
    try {
      const fresh = await collectMetrics();
      systemMetrics = { ...systemMetrics, ...fresh };
    } catch (err: any) { console.error("Metrics error:", err); }
  }, 5000);
}

function optimizeActiveCoordinations() {
  const phases = ["discovery", "matching", "negotiation", "agreement", "execution", "completion"];
  for (const [, coord] of activeCoordinations) {
    coord.currentState.progress = Math.min(1, coord.currentState.progress + 0.02);
    coord.currentState.participants.forEach((p) => { p.engagement = Math.min(1, p.engagement + Math.random() * 0.1); p.lastActive = new Date(); });
    coord.performance.efficiency = Math.min(1, coord.performance.efficiency + 0.01);
    if (coord.currentState.progress > 0.8 && coord.currentState.phase !== "completion") {
      const idx = phases.indexOf(coord.currentState.phase);
      if (idx < phases.length - 1) { coord.currentState.phase = phases[idx + 1]; coord.currentState.progress = 0; }
    }
  }
}

async function collectMetrics(): Promise<Partial<SystemMetrics>> {
  try {
    const allP = await profilesRepo.getAll();
    const allL = await listingsRepo.getAll();
    const active = allP.filter((p: Profile) => p.isActive).length;
    const totalUtility = allP.reduce((s: number, p: Profile) => s + p.weight, 0) / Math.max(active, 1);
    const totalConns = allP.reduce((s: number, p: Profile) => s + (networkManager.getNode(p.id)?.connections.length || 0), 0);
    const socialWelfare = allP.reduce((s: number, p: Profile) => s + ((p.economicProfile.valueAlignment as any)?.community || 0), 0) / Math.max(active, 1);
    return {
      totalUsers: allP.length, activeUsers: active,
      totalListings: allL.length, activeListings: allL.filter((l: ServiceListing) => l.isActive).length,
      totalUtility, networkHealth: Math.min(1, totalConns / Math.max(active * 2, 1)),
      socialWelfare, coordinationCost: activeCoordinations.size * 0.01,
      adaptationSpeed: 0.6 + Math.random() * 0.2,
    };
  } catch { return {}; }
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
  if (!req.path.startsWith("/api")) res.sendFile(path.join(__dirname, "../frontend/index.html"));
  else res.status(404).json({ error: "API endpoint not found" });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("🚨 Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Server Startup
// ═══════════════════════════════════════════════════════════════════════════════

async function startServer() {
  try {
    console.log("🌟 Starting Coordination Cosmos...");

    // Initialize database adapters (async — may connect to Prisma or fall back to in-memory)
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
      timestamp: new Date(), activeProfiles: 0, activeListings: 0, activeCoordinations: 0,
      systemHealth: { overall: 1, network: 1, agents: 1, coordination: 1, learning: 1, adaptation: 1 },
      performance: { throughput: 0, latency: 50, errorRate: 0, resourceUtilization: 0.3, scalabilityIndex: 0.8 },
      metrics: {},
    };
    systemMetrics = {
      totalUsers: 0, activeUsers: 0, totalListings: 0, activeListings: 0,
      successfulMatches: 0, totalUtility: 0, wasteLevel: 0.1, efficiencyScore: 0.8,
      equityIndex: 0.7, socialWelfare: 0, coordinationCost: 0.05, networkHealth: 0.9, adaptationSpeed: 0.6,
    };

    // Sample data for dev
    if (process.env.NODE_ENV !== "production" && (await profilesRepo.getAll()).length === 0) {
      await initializeSampleData();
    }

    startBackgroundProcesses();

    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📡 WebSocket active at ws://localhost:${PORT}`);
      console.log(`🧠 AI-Enhanced Coordination Network Active`);
      console.log("💫 Ready for coordination...\n");
    });
  } catch (err: any) {
    console.error("❌ Fatal startup error:", err);
    process.exit(1);
  }
}

async function initializeSampleData() {
  const makeProfile = (name: string, lat: number, lon: number, skillName: string, skillCat: string, needName: string, needCat: string): Profile => ({
    id: generateId("profile"), name, avatar: generateAvatar(),
    location: { latitude: lat, longitude: lon },
    resources: {
      goods: [],
      skills: [{ id: generateId("skill"), name: skillName, category: skillCat, proficiencyLevel: 0.9, availability: [], tags: [skillCat] }],
      needs: [{ id: generateId("need"), name: needName, category: needCat, urgency: 0.7, priority: 0.8, quantity: 1, unit: "project", alternatives: [], tags: [needCat] }],
      timeAvailable: [], preferences: {},
    },
    weight: 0.8,
    reputation: { overall: 0.9, reliability: 0.9, quality: 0.8, responsiveness: 0.9, fairness: 0.8, trustworthiness: 0.9, socialImpact: 0.7, history: [] },
    economicProfile: { totalUtility: 0, wealthLevel: 0.7, spendingPower: 0.6, savingsRate: 0.5, riskTolerance: 0.6, preferredPaymentMethods: [], creditScore: 0, transactionHistory: [], valueAlignment: { community: 0.8, sustainability: 0.7, innovation: 0.9, fairness: 0.8 } },
    behaviorProfile: { interactionPatterns: [], preferences: {}, predictedActions: [], adaptationRate: 0.7, consistencyScore: 0.8, socialStyle: "collaborative", decisionMakingStyle: "analytical" },
    lastUpdated: new Date(), isActive: true, seekings: [], offerings: [],
  });

  const alice = makeProfile("Alice Developer", 37.7749, -122.4194, "JavaScript", "programming", "Design Help", "design");
  const bob = makeProfile("Bob Designer", 37.7849, -122.4094, "UI/UX Design", "design", "Code Review", "programming");

  for (const p of [alice, bob]) {
    await profilesRepo.save(p);
    profileManager.addProfile(p);
    networkManager.addNode(p);
    agentManager.createAgent(p);
  }

  const listings: ServiceListing[] = [
    { id: generateId("listing"), title: "JavaScript Development Help", description: "Experienced developer offering JS assistance", type: "offer", providerId: alice.id, location: alice.location, pricing: { basePrice: 75, currency: "USD", pricingType: "hourly" }, availability: [], requirements: [], tags: ["javascript", "programming"], qualityMetrics: { rating: 0, reliability: 0.9, durability: 0.8, functionality: 0.9, aesthetics: 0.7, sustainability: 0.8 }, createdAt: new Date(), updatedAt: new Date(), isActive: true },
    { id: generateId("listing"), title: "UI/UX Design Consultation", description: "Professional design reviews and consultation", type: "offer", providerId: bob.id, location: bob.location, pricing: { basePrice: 100, currency: "USD", pricingType: "hourly" }, availability: [], requirements: [], tags: ["design", "ui-ux"], qualityMetrics: { rating: 0, reliability: 0.8, durability: 0.7, functionality: 0.8, aesthetics: 0.9, sustainability: 0.7 }, createdAt: new Date(), updatedAt: new Date(), isActive: true },
  ];
  for (const l of listings) await listingsRepo.save(l);

  console.log(`✅ Sample data: ${(await profilesRepo.getAll()).length} profiles, ${(await listingsRepo.getAll()).length} listings`);
}

// Graceful shutdown
process.on("SIGTERM", () => { console.log("🛑 SIGTERM"); server.close(() => process.exit(0)); });
process.on("SIGINT", () => { console.log("\n🛑 SIGINT"); server.close(() => process.exit(0)); });

// Launch
startServer().catch((err) => { console.error("❌ Fatal:", err); process.exit(1); });
