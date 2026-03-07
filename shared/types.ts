// shared/types.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Comprehensive Type System
// A dynamic marketplace for goods/services/knowledge exchange with AI-powered
// matching, nodal agents, graph networks, and real-time coordination.
// ═══════════════════════════════════════════════════════════════════════════════

// ────────────────────────────── Abstract Resources ──────────────────────────────

/**
 * Defines various types of abstract resources managed by the system.
 * These are non-tangible assets crucial for productivity and well-being.
 */
export enum AbstractResourceType {
  ATTENTION = "attention",
  COMPUTE = "compute_power",
  EMOTIONAL_CAPACITY = "emotional_capacity",
  CREATIVE_ENERGY = "creative_energy",
  TIME_SLOTS = "time_slots",
}

/**
 * A multi-dimensional representation of an abstract resource's state and dynamics.
 * All numeric values are normalized to 0.0–1.0 unless otherwise noted.
 */
export interface ResourceVector {
  currentLevel: number;       // 0.0 to 1.0
  maxCapacity: number;        // 0.0 to 1.0
  consumptionRate: number;    // Rate at which resource is consumed (units/hr)
  regenerationRate: number;   // Rate at which resource regenerates (units/hr)
  criticalThreshold: number;  // Level below which resource is considered critical
}

/**
 * A multi-dimensional representation of the intrinsic qualities or attributes
 * of a resource or need. Allows for nuanced matching beyond simple types.
 * Example: { "urgency": 0.9, "effort_level": 0.3, "social_impact": 0.7 }
 */
export interface ValueVector {
  attributes: Record<string, number>;
}

// ──────────────────────────────── Location ──────────────────────────────────────

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

// ──────────────────────────── Platform Items ────────────────────────────────────

export type ItemType = "good" | "service" | "idea" | "request_service" | "need_good";

export interface PlatformItem {
  id: string;
  ownerAgentId: string;
  type: ItemType;
  description: string;
  descriptionEmbedding: number[];
  tags: string[];
  category?: string;
  locationContext?: Location;
  quantity?: number;
  valuePerception?: number;
  activeUntil?: Date;
  urgency?: number;
  createdAt?: Date | string;
  valueVector?: ValueVector;
}

// ────────────────────────── Nodal Agent System ──────────────────────────────────

export interface IncentiveWeights {
  proximity: number;
  semanticMatch: number;
  tagOverlap: number;
  urgencyFactor: number;
  reputationInfluence: number;
}

export interface NodalAgentProfile {
  id: string;
  currentLocation: Location;
  offerings: PlatformItem[];
  seekings: PlatformItem[];
  incentiveWeights: IncentiveWeights;
  preferencesVector: number[];
  localInteractionHistory: Map<string, "positive" | "negative" | "neutral">;
  reputationScore: number;
}

export interface OrchestratorItemRecord extends PlatformItem {
  addedTimestamp: number;
}

export interface TransactionRecord {
  seekerAgentId: string;
  offererAgentId: string;
  seekingItemId: string;
  offeringItemId: string;
  outcome: "success" | "failure";
  timestamp: number;
}

// ─────────────────────── Coordination Mechanisms ────────────────────────────────

export interface CoordinationParticipantState {
  profileId: string;
  engagement: number;
  contribution: number;
  satisfaction: number;
  commitment: number;
  lastActive: Date;
}

export interface CoordinationPerformance {
  efficiency: number;
  effectiveness: number;
  satisfaction: number;
  scalability: number;
  adaptability: number;
  robustness: number;
}

export interface CoordinationMechanism {
  id: string;
  type: string;
  participants: string[];
  initiatorId: string;
  status: "pending" | "active" | "completed" | "failed";
  details: {
    objectives: any[];
  };
  createdAt: number;
  updatedAt: number;
  currentState: {
    phase: string;
    progress: number;
    participants: CoordinationParticipantState[];
    resources: any[];
    conflicts: any[];
    resolutions: any[];
  };
  performance: CoordinationPerformance;
}

// ──────────────────────── Time & Quality ────────────────────────────────────────

export interface TimeWindow {
  id?: string;
  type: "daily" | "weekly" | "specific_dates" | "indefinite";
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  startDate?: number;
  endDate?: number;
  description?: string;
}

export interface QualityMetrics {
  rating: number;
  reliability: number;
  durability: number;
  functionality: number;
  aesthetics: number;
  sustainability: number;
}

// ─────────────────────────── Resources ──────────────────────────────────────────

export interface ResourceGood {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  quality: QualityMetrics;
  availability: TimeWindow[];
  utility: number;
  tags: string[];
}

export interface ResourceSkill {
  id: string;
  name: string;
  category: string;
  proficiencyLevel: number; // 0–1
  experience?: number;      // years
  certifications?: string[];
  availability: TimeWindow[];
  tags: string[];
}

export interface NeedItem {
  id: string;
  name: string;
  category: string;
  urgency: number;  // 0–1
  priority: number; // 0–1
  quantity: number;
  unit: string;
  alternatives: string[];
  tags: string[];
}

export interface Resources {
  goods: ResourceGood[];
  skills: ResourceSkill[];
  needs: NeedItem[];
  timeAvailable: TimeWindow[];
  preferences: any;
}

// ──────────────────────────── Reputation ────────────────────────────────────────

export interface ReputationProfile {
  overall: number;
  reliability: number;
  quality: number;
  responsiveness: number;
  fairness: number;
  trustworthiness: number;
  socialImpact: number;
  history: any[];
}

// ──────────────────────────── Economics ─────────────────────────────────────────

export interface EconomicProfile {
  totalUtility: number;
  wealthLevel: number;
  spendingPower: number;
  savingsRate: number;
  riskTolerance: number;
  preferredPaymentMethods: string[];
  creditScore: number;
  transactionHistory: any[];
  valueAlignment: Record<string, number> & {
    sustainability?: number;
    community?: number;
    fairness?: number;
    innovation?: number;
    efficiency?: number;
    inclusivity?: number;
  };
}

// ──────────────────────────── Behavior ──────────────────────────────────────────

export interface InteractionPattern {
  type: string;
  target: string;
  outcome: "positive" | "neutral" | "negative" | string;
  timestamp: Date;
}

export interface BehaviorProfile {
  interactionPatterns: InteractionPattern[];
  preferences: any;
  predictedActions: any[];
  adaptationRate: number;
  consistencyScore: number;
  socialStyle: string;
  decisionMakingStyle: string;
}

// ──────────────────────────── Profile ───────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  location: Location;
  resources: Resources;
  weight: number;
  reputation: ReputationProfile;
  economicProfile: EconomicProfile;
  behaviorProfile: BehaviorProfile;
  lastUpdated: Date;
  isActive: boolean;
  wellBeingScore?: number;
  abstractResources?: { [key in AbstractResourceType]?: ResourceVector };
  weightHistory?: number[];
  /** Items this profile is seeking — always an array, defaults to [] */
  seekings: PlatformItem[];
  /** Items this profile is offering — always an array, defaults to [] */
  offerings: PlatformItem[];
  /** Version for optimistic locking */
  version?: number;
  /** Optional email for authentication */
  email?: string;
  /** Optional password hash (never return in responses) */
  passwordHash?: string;
}

// ──────────────────────── Service Listings ──────────────────────────────────────

export interface ServiceListingPricing {
  basePrice: number | string;
  currency: string;
  pricingType: "fixed" | "negotiable" | "range" | string;
}

export interface ServiceListing {
  id: string;
  title: string;
  description: string;
  type: "service" | "goods" | "collaboration" | string;
  providerId: string;
  location: Location;
  pricing: ServiceListingPricing;
  availability: TimeWindow[];
  requirements: any[];
  tags: string[];
  qualityMetrics: QualityMetrics;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  valueVector?: ValueVector;
  version?: number;
}

// ──────────────────────── System Metrics & State ────────────────────────────────

export interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalListings: number;
  activeListings: number;
  successfulMatches: number;
  totalUtility: number;
  wasteLevel: number;
  efficiencyScore: number;
  equityIndex: number;
  socialWelfare: number;
  coordinationCost: number;
  networkHealth: number;
  adaptationSpeed: number;
}

/**
 * Canonical system state. Uses `timestamp` (not `lastUpdate`).
 *
 * `systemHealth` contains the richer six-axis breakdown.
 * `performance` contains throughput / latency / error-rate metrics.
 *
 * Legacy consumers that only supply { overall, performance, reliability, scalability }
 * should migrate to this shape; use `Partial<SystemState>` during transition if needed.
 */
export interface SystemState {
  timestamp: Date;
  activeProfiles: number;
  activeListings: number;
  activeCoordinations: number;
  systemHealth: {
    overall: number;
    network: number;
    agents: number;
    coordination: number;
    learning: number;
    adaptation: number;
    /** @deprecated Use top-level `performance` instead */
    performance?: number;
    /** @deprecated Use `systemHealth.overall` for reliability signals */
    reliability?: number;
    /** @deprecated Use `performance.scalabilityIndex` instead */
    scalability?: number;
  };
  performance: {
    throughput: number;
    latency: number;
    errorRate: number;
    resourceUtilization: number;
    scalabilityIndex: number;
  };
  /** @deprecated Use `timestamp` instead */
  lastUpdate?: Date;
  metrics?: any;
}

// ──────────────────────────── Connections ───────────────────────────────────────

export interface Connection {
  id: string;
  profileA: string;
  profileB: string;
  strength: number;
  type: string;
  history: any[];
  lastInteraction: Date;
  // Directional aliases for graph network compatibility
  fromProfileId?: string;
  toProfileId?: string;
  status?: string;
  lastUsed?: Date;
}

// ────────────────────────── Matching & Optimization ─────────────────────────────

/** Breakdown of match score by individual dimensions (resources, location, etc.) */
export interface MatchDimensionBreakdown {
  dimension: string;
  score: number;
  weight: number;
}

export interface MatchingResult {
  profileA: string;
  profileB: string;
  score: number;
  reason?: string;
  /** Legacy alias for `score` — prefer using `score` */
  matchScore?: number;
  /** Per-dimension breakdown when dimension-aware matching is used */
  dimensions?: MatchDimensionBreakdown[];
}

export interface OptimizationObjective {
  type: string;
  weight: number;
  targetValue: number;
  currentValue: number;
  priority: number;
}

export interface Constraint {
  type: string;
  value: any;
}

/**
 * A recommended action produced by optimization / AI engines.
 *
 * Two construction patterns are supported:
 *  1. **Rich (planning engines):** uses `type`, `confidence`, `description`,
 *     `participants`, `expectedOutcome`, `requiredResources`, `timeline`.
 *  2. **Compact (CloudModelEngine):** uses `action`, `target`, `value`,
 *     `justification`.
 *
 * All fields except `priority` are optional so both patterns compile cleanly.
 */
export interface RecommendedAction {
  // ── Rich pattern fields ──
  type?: "connect" | "offer" | "request" | "collaborate" | "view" | string;
  confidence?: number;
  description?: string;
  participants?: string[];
  expectedOutcome?: any;
  requiredResources?: string[];
  timeline?: {
    start: Date;
    end: Date;
  };

  // ── Compact pattern fields (CloudModelEngine) ──
  action?: string;
  target?: string;
  value?: number;
  justification?: string;

  // ── Shared ──
  priority: number;
}

export interface OptimizationResult {
  solution: any;
  objectiveValue: number;
  constraints: any[];
  convergence: any;
  alternativeSolutions: any[];
  sensitivity: any;
}

// ──────────────────────────── Graph Network ────────────────────────────────────

export interface GraphNode {
  id: string;
  profile: Profile;
  connections: string[];
  weight: number;
  lastInteraction: Date;
  lastUsed?: Date;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  lastUsed: Date;
}

// ──────────────────────── Predictive Analytics ──────────────────────────────────

/** Result from bottleneck detection in PredictiveAnalyticsEngine */
export interface ResourceBottleneck {
  nodeId: string;
  resource: string;
  resource_type: AbstractResourceType;
  predictedLevel: number;
  criticalThreshold: number;
}

/** Result from surplus detection in PredictiveAnalyticsEngine */
export interface ResourceSurplus {
  nodeId: string;
  resource: string;
  resource_type: AbstractResourceType;
  predictedLevel: number;
  maxCapacity: number;
}

// ────────────────────────── Repository Interfaces ──────────────────────────────

export interface IProfilesRepo {
  getById(id: string): Promise<Profile | undefined>;
  save(profile: Profile): Promise<void>;
  getAll(): Promise<Profile[]>;
}

export interface IListingsRepo {
  getById(id: string): Promise<ServiceListing | undefined>;
  save(listing: ServiceListing): Promise<void>;
  getAll(): Promise<ServiceListing[]>;
  byProvider(providerId: string): Promise<ServiceListing[]>;
}

export interface IConnectionsRepo {
  create(connection: Connection): Promise<Connection>;
  getByProfile(profileId: string): Promise<Connection[]>;
  getById?(id: string): Promise<Connection | undefined>;
}

// ──────────────────────────── Session ───────────────────────────────────────────

export interface SessionData {
  profileId: string;
  createdAt: Date;
}

// ─────────────────────── WebSocket Messages ────────────────────────────────────

export interface WsWelcomeMessage {
  type: "welcome";
  message: string;
  timestamp: string;
}

export interface WsSubscribeMessage {
  type: "subscribe";
  events: string[];
}

export interface WsSubscribedMessage {
  type: "subscribed";
  events: string[];
}

export interface WsPingMessage {
  type: "ping";
}

export interface WsPongMessage {
  type: "pong";
  timestamp: string;
}

export interface WsEventMessage {
  type: "event";
  event: string;
  data: any;
  timestamp: string;
}

export interface WsErrorMessage {
  type: "error";
  message: string;
}

/**
 * Discriminated union of all WebSocket message shapes.
 * Discriminant field: `type`.
 */
export type WebSocketMessage =
  | WsWelcomeMessage
  | WsSubscribeMessage
  | WsSubscribedMessage
  | WsPingMessage
  | WsPongMessage
  | WsEventMessage
  | WsErrorMessage;

// ────────────────────────── API Response Wrapper ────────────────────────────────

/**
 * Generic wrapper for all REST API responses.
 *
 * ```ts
 * // Success
 * { success: true, data: profile, timestamp: new Date() }
 *
 * // Error
 * { success: false, error: "Not found", timestamp: new Date() }
 * ```
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}
