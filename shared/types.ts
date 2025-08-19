// shared/types.ts

// ==================== NEWLY INTEGRATED TYPES (from OptiFlow and SymbioticFlow) ====================

/**
 * Defines various types of abstract resources managed by the system.
 * These are non-tangible assets crucial for productivity and well-being.
 */
export enum AbstractResourceType {
    ATTENTION = "attention",             // Mental focus and concentration
    COMPUTE = "compute_power",           // Mental processing capacity, problem-solving ability
    EMOTIONAL_CAPACITY = "emotional_capacity", // Ability to handle stress, empathize, maintain composure
    CREATIVE_ENERGY = "creative_energy", // Capacity for innovation, ideation, artistic output
    TIME_SLOTS = "time_slots"           // Available blocks of time for tasks
}

/**
 * A multi-dimensional representation of an abstract resource's state and dynamics.
 */
export interface ResourceVector {
    currentLevel: number; // 0.0 to 1.0
    maxCapacity: number; // 0.0 to 1.0
    consumptionRate: number; // Rate at which resource is consumed
    regenerationRate: number; // Rate at which resource regenerates
    criticalThreshold: number; // Level below which resource is considered critical
}

/**
 * A multi-dimensional representation of the intrinsic qualities or attributes
 * of a resource or need. This allows for more nuanced matching beyond simple types.
 * Example: {"urgency": 0.9, "effort_level": 0.3, "social_impact": 0.7}
 */
export interface ValueVector {
    attributes: { [key: string]: number };
}


// ==================== TYPES USED BY BACKEND / FRONTEND ====================

export interface Location {
    latitude: number;
    longitude: number;
    address?: string;
}

export interface TimeWindow {
    id?: string;
    type: 'daily' | 'weekly' | 'specific_dates' | 'indefinite';
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
    proficiencyLevel: number; // 0-1
    experience?: number; // years
    certifications?: string[];
    availability: TimeWindow[];
    tags: string[];
}

export interface NeedItem {
    id: string;
    name: string;
    category: string;
    urgency: number; // 0-1
    priority: number; // 0-1
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

export interface InteractionPattern {
    type: string;
    target: string;
    outcome: 'positive' | 'neutral' | 'negative' | string;
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
    weightHistory?: number[]; // Added for BehaviorObserver
}

export interface ServiceListingPricing {
    basePrice: number | string;
    currency: string;
    pricingType: 'fixed' | 'negotiable' | 'range' | string;
}

export interface ServiceListing {
    id: string;
    title: string;
    description: string;
    type: 'service' | 'goods' | 'collaboration' | string;
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
}

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
    };
    performance: {
        throughput: number;
        latency: number;
        errorRate: number;
        resourceUtilization: number;
        scalabilityIndex: number;
    };
    metrics: any;
}

export interface Connection {
    id: string;
    profileA: string;
    profileB: string;
    strength: number;
    type: string;
    history: any[];
    lastInteraction: Date;
}

export interface MatchingResult {
    profileA: string;
    profileB: string;
    score: number;
    reason: string;
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

export interface RecommendedAction {
    type: 'connect' | 'offer' | 'request' | 'collaborate' | 'view' | string;
    priority: number;
    confidence: number;
    description?: string;
    participants?: string[];
    expectedOutcome: any;
    requiredResources: string[];
    timeline: {
        start: Date;
        end: Date;
    };
}

export interface OptimizationResult {
    solution: any;
    objectiveValue: number;
    constraints: any[];
    convergence: any;
    alternativeSolutions: any[];
    sensitivity: any;
}
