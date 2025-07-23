// ==================== CORE ENTITY TYPES ====================

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  location: {
    latitude: number;
    longitude: number;
    radius?: number; // Interaction radius in meters
    timezone?: string;
  };
  resources: {
    goods: ResourceItem[];
    skills: SkillItem[];
    needs: NeedItem[];
    timeAvailable: TimeAvailability[];
    preferences: UserPreferences;
  };
  weight: number;
  reputation: ReputationScore;
  economicProfile: EconomicProfile;
  behaviorProfile: BehaviorProfile;
  lastUpdated: Date;
  isActive: boolean;
}

export interface ResourceItem {
  id: string;
  name: string;
  category: ResourceCategory;
  quantity: number;
  unit: string;
  quality: QualityMetrics;
  availability: TimeWindow[];
  minPrice?: number;
  maxPrice?: number;
  utility: number; // Personal utility value
  tags: string[];
}

export interface SkillItem {
  id: string;
  name: string;
  category: SkillCategory;
  proficiencyLevel: number; // 0-1 scale
  experience: number; // Years or hours
  certifications: string[];
  hourlyRate?: number;
  availability: TimeWindow[];
  tags: string[];
}

export interface NeedItem {
  id: string;
  name: string;
  category: NeedCategory;
  urgency: number; // 0-1 scale
  priority: number; // 0-1 scale
  maxPrice?: number;
  preferredQuality: QualityMetrics;
  deadline?: Date;
  quantity: number;
  unit: string;
  alternatives: string[]; // Alternative need IDs
  tags: string[];
}

export interface ServiceListing {
  id: string;
  title: string;
  description: string;
  type: "goods" | "service" | "collaboration" | "social";
  providerId: string;
  location: {
    latitude: number;
    longitude: number;
    isRemote?: boolean;
    serviceRadius?: number;
  };
  pricing: PricingModel;
  availability: TimeWindow[];
  requirements: string[];
  tags: string[];
  qualityMetrics: QualityMetrics;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  matchingScore?: number;
}

// ==================== ECONOMIC MODELING TYPES ====================

export interface EconomicProfile {
  totalUtility: number;
  wealthLevel: number; // 0-1 normalized
  spendingPower: number;
  savingsRate: number;
  riskTolerance: number; // 0-1 scale
  preferredPaymentMethods: PaymentMethod[];
  creditScore: number;
  transactionHistory: TransactionRecord[];
  valueAlignment: ValueAlignment;
}

export interface PricingModel {
  basePrice: number;
  currency: string;
  pricingType: "fixed" | "dynamic" | "negotiable" | "auction" | "barter";
  dynamicFactors?: DynamicPricingFactors;
  discounts?: DiscountRule[];
  bundleOptions?: BundleOption[];
}

export interface DiscountRule {
  id: string;
  type: "percentage" | "fixed" | "bulk";
  value: number;
  conditions: string[];
  validUntil?: Date;
}

export interface BundleOption {
  id: string;
  items: string[];
  discountPercentage: number;
  description: string;
}

export interface DynamicPricingFactors {
  demandMultiplier: number;
  supplyMultiplier: number;
  timeMultiplier: number;
  qualityMultiplier: number;
  relationshipMultiplier: number;
  urgencyMultiplier: number;
}

export interface MarketDynamics {
  supply: number;
  demand: number;
  equilibriumPrice: number;
  volatility: number;
  trendDirection: "up" | "down" | "stable";
  marketEfficiency: number; // 0-1 scale
  liquidityScore: number;
}

export interface TransactionRecord {
  id: string;
  fromProfileId: string;
  toProfileId: string;
  listingId: string;
  amount: number;
  currency: string;
  timestamp: Date;
  satisfaction: number; // 0-1 scale
  utilityGain: number;
  socialImpact: SocialImpact;
}

// ==================== COORDINATION & MATCHING TYPES ====================

export interface CoordinationMechanism {
  id: string;
  type: "market" | "social" | "algorithmic" | "hybrid";
  participants: string[]; // Profile IDs
  objectives: OptimizationObjective[];
  constraints: Constraint[];
  currentState: CoordinationState;
  performance: PerformanceMetrics;
}

export interface OptimizationObjective {
  type:
    | "utility_maximization"
    | "waste_minimization"
    | "equity_maximization"
    | "efficiency_maximization";
  weight: number;
  targetValue: number;
  currentValue: number;
  priority: number;
}

export interface MatchingResult {
  profileA: string;
  profileB: string;
  matchScore: number;
  dimensions: DimensionalMatch[];
  potentialValue: number;
  socialWelfare: number;
  coordinationCost: number;
  recommendedAction: RecommendedAction;
}

export interface DimensionalMatch {
  dimension: string;
  similarity: number;
  complementarity: number;
  synergy: number;
  weight: number;
}

export interface ResourceAllocation {
  profileId: string;
  allocatedResources: AllocationItem[];
  totalUtility: number;
  efficiency: number;
  wasteLevel: number;
  socialImpact: SocialImpact;
  timestamp: Date;
}

export interface AllocationItem {
  resourceId: string;
  quantity: number;
  utilityValue: number;
  allocationReason: string;
  alternativeUses: AlternativeUse[];
}

export interface AlternativeUse {
  description: string;
  utilityValue: number;
  feasibility: number;
  cost: number;
}

// ==================== NETWORK & GRAPH TYPES ====================

export interface GraphNode {
  profile: Profile;
  connections: Connection[];
  weight: number;
  centrality: CentralityMetrics;
  influence: number;
  lastInteraction: Date;
  networkValue: number;
}

export interface Connection {
  targetId: string;
  strength: number;
  type: ConnectionType;
  interactions: InteractionHistory[];
  mutualValue: number;
  trustLevel: number;
  lastActive: Date;
}

export interface InteractionHistory {
  timestamp: Date;
  type: InteractionType;
  outcome: string;
  satisfaction: number;
  duration: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: EdgeType;
  properties: EdgeProperties;
  lastUsed: Date;
  strength: number;
}

export interface EdgeProperties {
  bidirectional: boolean;
  capacity: number;
  cost: number;
  reliability: number;
  metadata: Record<string, any>;
}

export interface NetworkCluster {
  id: string;
  members: string[];
  centerNode: string;
  cohesion: number;
  purpose: ClusterPurpose;
  performance: ClusterPerformance;
  emergentProperties: EmergentProperty[];
}

export interface ClusterPurpose {
  type: "resource_sharing" | "skill_exchange" | "social" | "coordination";
  description: string;
  objectives: string[];
}

export interface ClusterPerformance {
  efficiency: number;
  satisfaction: number;
  growth: number;
  stability: number;
  innovation: number;
}

export interface EmergentProperty {
  name: string;
  value: number;
  stability: number;
  impact: number;
}

export interface CentralityMetrics {
  degree: number;
  betweenness: number;
  closeness: number;
  eigenvector: number;
  pagerank: number;
}

// ==================== AI/ML & BEHAVIOR TYPES ====================

export interface BehaviorProfile {
  interactionPatterns: InteractionPattern[];
  preferences: LearnedPreferences;
  predictedActions: PredictedAction[];
  adaptationRate: number;
  consistencyScore: number;
  socialStyle: SocialStyle;
  decisionMakingStyle: DecisionMakingStyle;
}

export interface SocialStyle {
  type: "collaborative" | "competitive" | "supportive" | "independent";
  traits: string[];
  adaptability: number;
}

export interface DecisionMakingStyle {
  type: "analytical" | "intuitive" | "consensus" | "authoritative";
  speed: number;
  confidence: number;
  riskTolerance: number;
}

export interface InteractionPattern {
  type: InteractionType;
  frequency: number;
  duration: number;
  satisfaction: number;
  timePattern: TemporalPattern;
  contextFactors: string[];
}

export interface TemporalPattern {
  hourlyDistribution: number[];
  dailyDistribution: number[];
  seasonality: number;
  predictability: number;
}

export interface LearnedPreferences {
  resourcePreferences: Record<string, number>;
  timePreferences: TemporalPreference[];
  socialPreferences: SocialPreference[];
  qualityWeights: QualityWeight[];
  priceElasticity: Record<string, number>;
}

export interface TemporalPreference {
  timeOfDay: string;
  dayOfWeek: number;
  preference: number;
  flexibility: number;
}

export interface SocialPreference {
  interactionType: string;
  groupSize: number;
  formality: number;
  preference: number;
}

export interface QualityWeight {
  dimension: string;
  weight: number;
  importance: number;
}

export interface PredictedAction {
  action: ActionType;
  probability: number;
  confidence: number;
  timeWindow: TimeWindow;
  context: ActionContext;
  potentialImpact: ImpactPrediction;
}

export interface ActionContext {
  location: string;
  timeOfDay: string;
  socialContext: string[];
  resourceAvailability: number;
  urgency: number;
}

export interface ImpactPrediction {
  utilityChange: number;
  socialChange: number;
  networkChange: number;
  confidence: number;
  timeframe: number;
}

export interface ReputationScore {
  overall: number;
  reliability: number;
  quality: number;
  responsiveness: number;
  fairness: number;
  trustworthiness: number;
  socialImpact: number;
  history: ReputationEvent[];
}

export interface ReputationEvent {
  timestamp: Date;
  type: "positive" | "negative" | "neutral";
  category: string;
  value: number;
  description: string;
  verifiable: boolean;
}

// ==================== OPTIMIZATION & SIMULATION TYPES ====================

export interface OptimizationResult {
  solution: SolutionVector;
  objectiveValue: number;
  constraints: ConstraintStatus[];
  convergence: ConvergenceMetrics;
  alternativeSolutions: AlternativeSolution[];
  sensitivity: SensitivityAnalysis;
}

export interface SolutionVector {
  variables: Record<string, number>;
  feasible: boolean;
  optimal: boolean;
  metadata: Record<string, any>;
}

export interface ConstraintStatus {
  id: string;
  satisfied: boolean;
  violation: number;
  slack: number;
}

export interface ConvergenceMetrics {
  iterations: number;
  finalError: number;
  convergenceRate: number;
  stable: boolean;
}

export interface AlternativeSolution {
  solution: SolutionVector;
  objectiveValue: number;
  rank: number;
  similarity: number;
}

export interface SensitivityAnalysis {
  parameters: Record<string, number>;
  robustness: number;
  criticalVariables: string[];
}

export interface SimulationState {
  timestamp: Date;
  profiles: Record<string, Profile>;
  activeCoordinations: CoordinationMechanism[];
  marketState: MarketState;
  networkTopology: NetworkTopology;
  systemMetrics: SystemMetrics;
}

export interface SystemMetrics {
  totalUtility: number;
  wasteLevel: number;
  efficiencyScore: number;
  equityIndex: number;
  socialWelfare: number;
  coordinationCost: number;
  networkHealth: number;
  adaptationSpeed: number;
}

// ==================== AGENT TYPES ====================

export interface PersonalAgent {
  id: string;
  profileId: string;
  capabilities: AgentCapability[];
  goals: AgentGoal[];
  strategies: Strategy[];
  learningModel: LearningModel;
  performance: AgentPerformance;
  autonomyLevel: number;
}

export interface AgentGoal {
  id: string;
  type: "utility_max" | "social_good" | "efficiency" | "learning";
  priority: number;
  target: number;
  current: number;
  deadline?: Date;
}

export interface AgentCapability {
  type: CapabilityType;
  proficiency: number;
  scope: CapabilityScope;
  limitations: string[];
  dependencies: string[];
}

export interface CapabilityScope {
  domain: string[];
  complexity: "low" | "medium" | "high";
  scalability: number;
  reliability: number;
}

export interface Strategy {
  id: string;
  type: StrategyType;
  parameters: Record<string, any>;
  effectiveness: number;
  applicability: ApplicabilityCondition[];
  outcomes: StrategyOutcome[];
}

export interface ApplicabilityCondition {
  type: "context" | "resource" | "time" | "social";
  condition: string;
  threshold: number;
  weight: number;
}

export interface StrategyOutcome {
  timestamp: Date;
  success: boolean;
  utilityGain: number;
  cost: number;
  sideEffects: string[];
}

// ==================== UTILITY ENUMS & TYPES ====================

export type ResourceCategory =
  | "physical_goods"
  | "digital_assets"
  | "consumables"
  | "tools_equipment"
  | "space_access"
  | "transportation"
  | "intellectual_property";

export type SkillCategory =
  | "technical"
  | "creative"
  | "analytical"
  | "interpersonal"
  | "physical"
  | "educational"
  | "management"
  | "specialized";

export type NeedCategory =
  | "basic_necessities"
  | "professional"
  | "social"
  | "educational"
  | "health"
  | "recreational"
  | "spiritual"
  | "emergency";

export type ConnectionType =
  | "transactional"
  | "collaborative"
  | "social"
  | "mentorship"
  | "competitive"
  | "supportive";

export type InteractionType =
  | "view"
  | "message"
  | "transaction"
  | "collaboration"
  | "recommendation"
  | "feedback"
  | "conflict"
  | "support";

export type ActionType =
  | "list_resource"
  | "request_service"
  | "make_offer"
  | "accept_offer"
  | "collaborate"
  | "recommend"
  | "withdraw"
  | "negotiate";

export type PaymentMethod =
  | "cash"
  | "digital"
  | "barter"
  | "credit"
  | "time_bank"
  | "community_currency"
  | "favor_exchange";

export type EdgeType =
  | "resource_flow"
  | "information_flow"
  | "trust_relationship"
  | "collaboration"
  | "dependency"
  | "competition";

export type CapabilityType =
  | "matching"
  | "negotiation"
  | "optimization"
  | "prediction"
  | "coordination"
  | "learning"
  | "communication";

export type StrategyType =
  | "utility_maximization"
  | "social_optimization"
  | "risk_minimization"
  | "exploration"
  | "exploitation"
  | "cooperation"
  | "competition";

// ==================== SUPPORTING INTERFACES ====================

export interface TimeWindow {
  start: Date;
  end: Date;
  recurrence?: RecurrencePattern;
  flexibility: number; // 0-1 scale
}

export interface TimeAvailability {
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM format
  endTime: string;
  available: boolean;
  flexibility: number;
}

export interface QualityMetrics {
  rating: number; // 0-5 scale
  reliability: number;
  durability: number;
  functionality: number;
  aesthetics: number;
  sustainability: number;
}

export interface UserPreferences {
  communicationStyle: string;
  meetingPreference: "virtual" | "in_person" | "hybrid";
  responseTime: number; // Expected response time in hours
  languages: string[];
  accessibility: AccessibilityNeeds[];
  values: PersonalValue[];
}

export interface SocialImpact {
  communityBenefit: number;
  environmentalImpact: number;
  socialEquity: number;
  knowledgeSharing: number;
  culturalExchange: number;
}

export interface ValueAlignment {
  sustainability: number;
  community: number;
  fairness: number;
  innovation: number;
  efficiency: number;
  inclusivity: number;
}

export interface RecommendedAction {
  type: ActionType;
  priority: number;
  confidence: number;
  expectedOutcome: ExpectedOutcome;
  requiredResources: string[];
  timeline: TimeWindow;
}

export interface ExpectedOutcome {
  utilityGain: number;
  socialImpact: SocialImpact;
  coordinationCost: number;
  riskLevel: number;
  alternativeScenarios: Scenario[];
}

export interface Scenario {
  name: string;
  probability: number;
  outcome: {
    utilityGain: number;
    cost: number;
    timeframe: number;
  };
  conditions: string[];
}

// ==================== COMPLEX SUPPORTING TYPES ====================

export interface RecurrencePattern {
  type: "daily" | "weekly" | "monthly" | "custom";
  interval: number;
  endDate?: Date;
  exceptions: Date[];
}

export interface AccessibilityNeeds {
  type: string;
  description: string;
  accommodations: string[];
}

export interface PersonalValue {
  name: string;
  importance: number; // 0-1 scale
  category: ValueCategory;
}

export interface ValueCategory {
  name: string;
  description: string;
  weight: number;
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  parameters: Record<string, any>;
  hardness: "hard" | "soft";
  weight: number;
  violated: boolean;
}

export interface CoordinationState {
  phase: CoordinationPhase;
  progress: number;
  participants: ParticipantState[];
  resources: ResourceState[];
  conflicts: Conflict[];
  resolutions: Resolution[];
}

export interface PerformanceMetrics {
  efficiency: number;
  effectiveness: number;
  satisfaction: number;
  scalability: number;
  adaptability: number;
  robustness: number;
}

export interface NetworkTopology {
  nodeCount: number;
  edgeCount: number;
  clusteringCoefficient: number;
  pathLength: number;
  density: number;
  modularity: number;
  smallWorldness: number;
}

export interface MarketState {
  activeListings: number;
  totalVolume: number;
  averagePrice: number;
  volatility: number;
  liquidity: number;
  efficiency: number;
  participantSatisfaction: number;
}

export interface LearningModel {
  type: LearningType;
  parameters: ModelParameters;
  performance: ModelPerformance;
  updateFrequency: number;
  dataRequirements: DataRequirement[];
}

export interface AgentPerformance {
  taskCompletion: number;
  goalAchievement: number;
  resourceEfficiency: number;
  socialHarmony: number;
  adaptationSpeed: number;
  learningRate: number;
}

// ==================== ENUM TYPES ====================

export type ConstraintType =
  | "resource_limit"
  | "time_constraint"
  | "location_constraint"
  | "skill_requirement"
  | "budget_limit"
  | "quality_minimum"
  | "trust_threshold";

export type CoordinationPhase =
  | "discovery"
  | "matching"
  | "negotiation"
  | "agreement"
  | "execution"
  | "completion"
  | "evaluation";

export type LearningType =
  | "reinforcement"
  | "supervised"
  | "unsupervised"
  | "collaborative_filtering"
  | "deep_learning"
  | "evolutionary";

// ==================== ADDITIONAL SUPPORTING INTERFACES ====================

export interface ParticipantState {
  profileId: string;
  engagement: number;
  contribution: number;
  satisfaction: number;
  commitment: number;
  lastActive: Date;
}

export interface ResourceState {
  resourceId: string;
  availability: number;
  utilization: number;
  demand: number;
  quality: number;
  lastUpdated: Date;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  parties: string[];
  severity: number;
  description: string;
  timestamp: Date;
  status: ConflictStatus;
}

export interface Resolution {
  conflictId: string;
  solution: string;
  satisfaction: number;
  implementationDate: Date;
  effectiveness: number;
}

export interface ModelParameters {
  learningRate: number;
  regularization: number;
  batchSize: number;
  epochs: number;
  [key: string]: any;
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lastEvaluated: Date;
}

export interface DataRequirement {
  dataType: string;
  minimumSamples: number;
  qualityThreshold: number;
  updateFrequency: number;
}

export type ConflictType =
  | "resource_dispute"
  | "quality_disagreement"
  | "timing_conflict"
  | "pricing_dispute"
  | "expectation_mismatch"
  | "communication_breakdown";

export type ConflictStatus =
  | "active"
  | "in_mediation"
  | "resolved"
  | "escalated"
  | "abandoned";

// ==================== FINAL COMPLEX TYPES ====================

export interface SystemState {
  timestamp: Date;
  activeProfiles: number;
  activeListings: number;
  activeCoordinations: number;
  systemHealth: SystemHealth;
  performance: SystemPerformance;
  metrics: ComprehensiveMetrics;
}

export interface SystemHealth {
  overall: number;
  network: number;
  agents: number;
  coordination: number;
  learning: number;
  adaptation: number;
}

export interface SystemPerformance {
  throughput: number;
  latency: number;
  errorRate: number;
  resourceUtilization: number;
  scalabilityIndex: number;
}

export interface ComprehensiveMetrics {
  economic: EconomicMetrics;
  social: SocialMetrics;
  environmental: EnvironmentalMetrics;
  innovation: InnovationMetrics;
  equity: EquityMetrics;
}

export interface EconomicMetrics {
  totalValue: number;
  efficiency: number;
  waste: number;
  distribution: number;
  growth: number;
}

export interface SocialMetrics {
  cohesion: number;
  trust: number;
  cooperation: number;
  diversity: number;
  inclusion: number;
}

export interface EnvironmentalMetrics {
  sustainability: number;
  resourceConsumption: number;
  carbonFootprint: number;
  circularEconomy: number;
}

export interface InnovationMetrics {
  novelty: number;
  adoption: number;
  diffusion: number;
  creativity: number;
  improvement: number;
}

export interface EquityMetrics {
  accessibilityIndex: number;
  distributionFairness: number;
  opportunityEquality: number;
  outcomeEquity: number;
  representationBalance: number;
}
