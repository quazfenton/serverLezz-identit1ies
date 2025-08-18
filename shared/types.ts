// shared/types.ts

/**
 * Represents a geographical location.
 */
export interface Location {
    latitude: number;
    longitude: number;
    address?: string; // Optional: for display or more specific context
}

/**
 * Defines the type of item being offered or requested.
 */
export type ItemCategory = 'good' | 'service' | 'knowledge' | 'connection' | 'other';

/**
 * Defines the specific transaction type.
 */
export type TransactionType = 'offer' | 'request';

/**
 * Defines acceptable payment formats.
 */
export type PaymentFormat = 'cash' | 'crypto' | 'barter' | 'credit_card' | 'bank_transfer' | 'other';

/**
 * Represents a time window for availability or deadlines.
 */
export interface TimeWindow {
    id?: string; // Optional ID if stored separately
    type: 'daily' | 'weekly' | 'specific_dates' | 'indefinite';
    daysOfWeek?: number[]; // 0-6 for Sunday-Saturday
    startTime?: string; // "HH:MM"
    endTime?: string; // "HH:MM"
    startDate?: number; // Unix timestamp (milliseconds)
    endDate?: number; // Unix timestamp (milliseconds)
    description?: string; // e.g., "Weekends only", "After 5 PM"
}

/**
 * Represents granular details or versioning for an item.
 */
export interface ItemDetails {
    version?: string;
    condition?: 'new' | 'used_like_new' | 'used_good' | 'used_fair' | 'for_parts';
    brand?: string;
    model?: string;
    // Add other specific item attributes as needed
    [key: string]: any; // Allow for flexible additional properties
}

/**
 * Represents a single item being offered or requested in the marketplace.
 */
export interface PlatformItem {
    id: string;
    ownerAgentId: string; // ID of the NodalAgent offering/seeking this
    // Back-compat fields for existing agents/orchestrator demos
    // "type" is used by demo agents as a coarse category like 'good'|'service'|'idea'|'need_good'|'request_service'
    type?: string;
    transactionType?: TransactionType; // 'offer' or 'request'
    category?: ItemCategory; // e.g., 'good', 'service'
    description: string;
    descriptionEmbedding: number[]; // Vector representation for semantic matching
    tags: string[]; // Keywords for filtering and matching
    locationContext?: Location; // Relevant if item is location-specific
    quantity?: number; // e.g., number of items, hours of service
    unit?: string; // e.g., "items", "hours", "kg"
    estimatedValue?: number; // Agent's perceived value or suggested price
    priceBounds?: { min?: number; max?: number; currency?: string; }; // Range of acceptable price
    paymentFormats?: PaymentFormat[]; // Accepted payment methods
    activeUntil?: number; // Unix timestamp (milliseconds) when the item expires
    timeWindow?: TimeWindow; // Specific availability or deadline for this item
    itemDetails?: ItemDetails; // Granular details like version, condition
    classifierTags?: string[]; // Tags derived from classification models (e.g., "electronics.smartphone", "home_repair.plumbing")
    // Add more fields as needed for specific item types
}

/**
 * Weights used by a NodalAgent to prioritize different matching criteria.
 */
export interface IncentiveWeights {
    proximity: number;        // 0.0 to 1.0: How important is geographical closeness?
    semanticMatch: number;    // 0.0 to 1.0: How important is conceptual similarity?
    tagOverlap: number;       // 0.0 to 1.0: How important is keyword matching?
    urgencyFactor: number;    // 0.0 to 1.0: How important is immediate fulfillment/deadline?
    reputationInfluence: number; // 0.0 to 1.0: How much does the other party's reputation matter?
    valueAlignment: number;   // 0.0 to 1.0: How important is perceived value/price match?
    // Add other factors like flexibility, historical success with similar types, etc.
}

/**
 * Represents a condensed history of a user's activities and interactions.
 */
export interface UserHistory {
    lastActive: number; // Unix timestamp (milliseconds)
    totalTransactions: number;
    successfulTransactions: number;
    itemsOffered: { category: ItemCategory; count: number; }[];
    itemsRequested: { category: ItemCategory; count: number; }[];
    // Add more condensed historical data points
}

/**
 * Represents a user's detailed preferences.
 */
export interface UserPreferences {
    theme: string;
    notifications: {
        email: boolean;
        inApp: boolean;
        sms: boolean;
    };
    preferredPaymentFormats: PaymentFormat[];
    preferredItemCategories: ItemCategory[];
    locationSharing: 'always' | 'on_match' | 'never';
    profileVisibility: 'public' | 'private' | 'connections_only';
    // Add more granular user preferences
    [key: string]: any; // Allow for flexible additional properties
}

/**
 * Represents the profile of a Nodal Agent (user) in the system.
 */
export interface NodalAgentProfile {
    id: string;
    name?: string;
    avatar?: string;
    currentLocation: Location;
    offerings: PlatformItem[];
    seekings: PlatformItem[];
    incentiveWeights: IncentiveWeights;
    preferencesVector: number[]; // Learned representation of broader interests/behavior
    localInteractionHistory: Map<string, 'positive' | 'negative' | 'neutral'>; // AgentID -> outcome
    reputationScore: number; // Aggregated reputation score (0.0 to 1.0)
    userPreferences?: UserPreferences; // Detailed user preferences
    userHistory?: UserHistory; // Condensed user activity history
    status?: 'online' | 'offline' | 'busy';
    // Add more profile-specific fields as needed
}

/**
 * Represents an item record as stored by the Orchestrator.
 */
export interface OrchestratorItemRecord extends PlatformItem {
    addedTimestamp: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a record of a completed or attempted transaction.
 */
export interface TransactionRecord {
    seekerAgentId: string;
    offererAgentId: string;
    seekingItemId: string;
    offeringItemId: string;
    outcome: 'success' | 'failure' | 'disputed';
    timestamp: number; // Unix timestamp (milliseconds)
    // Add more transaction details like final agreed value, payment method used
}

/**
 * Represents a connection between two profiles.
 */
export interface Connection {
    id: string;
    fromProfileId: string;
    toProfileId: string;
    strength: number; // 0-1, based on interactions, relevance
    lastUsed: number; // Unix timestamp (milliseconds)
    status: 'pending' | 'accepted' | 'rejected' | 'blocked';
    // Add more connection-specific fields
}

/**
 * Represents a message exchanged between users.
 */
export interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    content: string;
    timestamp: number; // Unix timestamp (milliseconds)
    read: boolean;
    // Add more message-specific fields
}

/**
 * Represents system-wide performance and usage metrics.
 */
export interface SystemMetrics {
    totalUsers: number;
    activeUsers: number;
    totalListings: number;
    activeListings: number;
    successfulMatches: number;
    // Add more system-wide metrics
}

/**
 * Represents a coordination mechanism (e.g., multi-party barter, collaboration).
 */
export interface CoordinationMechanism {
    id: string;
    initiatorId: string;
    participants: string[];
    status: 'proposed' | 'active' | 'completed' | 'failed';
    type: 'barter' | 'collaboration' | 'resource_sharing' | 'group_purchase' | 'algorithmic';
    details: any; // Specific details for the mechanism
    createdAt: number; // Unix timestamp (milliseconds)
    updatedAt: number; // Unix timestamp (milliseconds)
    // Extended runtime fields used in server's optimization loop
    currentState?: {
        phase: 'discovery' | 'matching' | 'negotiation' | 'agreement' | 'execution' | 'completion';
        progress: number;
        participants: Array<{ profileId: string; engagement: number; contribution: number; satisfaction: number; commitment: number; lastActive: Date }>;
        resources: any[];
        conflicts: any[];
        resolutions: any[];
    };
    performance?: {
        efficiency: number;
        effectiveness: number;
        satisfaction: number;
        scalability: number;
        adaptability: number;
        robustness: number;
    };
}

/**
 * Represents the result of a matching operation.
 */
export interface MatchResult {
    profileId: string; // The ID of the matched profile
    itemId: string; // The ID of the matched item (offer or request)
    score: number; // The match score
    // Add more match-specific fields like breakdown of scores
}

/**
 * Represents a request for system optimization.
 */
export interface OptimizationRequest {
    profileId?: string; // Optional: if optimization is user-specific
    goal: 'maximize_utility' | 'minimize_waste' | 'find_best_match' | 'balance_market';
    parameters: any; // Specific parameters for optimization
}

/**
 * Represents the result of a system optimization.
 */
export interface OptimizationResult {
    profileId?: string;
    recommendations: any[]; // Array of recommended actions/matches/system adjustments
    optimizedValue: number; // The value achieved by the optimization
    timestamp: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user session.
 */
export interface Session {
    id: string;
    profileId: string;
    loginTime: number; // Unix timestamp (milliseconds)
    lastActivity: number; // Unix timestamp (milliseconds)
    ipAddress: string;
    userAgent: string;
}

/**
 * Represents a node in the graph network.
 */
// Graph structures as used by network manager and backend graph
export interface GraphNode {
    profile: Profile;
    connections: string[]; // Adjacent profile IDs
    weight: number; // Node weight for ranking
    lastInteraction: Date;
}

/**
 * Represents an edge in the graph network.
 */
export interface GraphEdge {
    source: string; // Profile ID
    target: string; // Profile ID
    weight: number; // Strength of connection
    lastUsed: Date;
}

/**
 * Represents a notification for a user.
 */
export interface Notification {
    id: string;
    userId: string;
    type: 'match' | 'message' | 'system' | 'transaction_update' | 'reputation_change';
    content: string;
    read: boolean;
    timestamp: number; // Unix timestamp (milliseconds)
    link?: string; // Optional link to relevant part of the app
}

/**
 * Represents user feedback.
 */
export interface UserFeedback {
    id: string;
    userId: string;
    type: 'bug' | 'feature_request' | 'general_inquiry' | 'suggestion';
    rating?: number; // 1-5 stars, if applicable
    comment: string;
    timestamp: number; // Unix timestamp (milliseconds)
    status: 'new' | 'in_progress' | 'resolved' | 'closed';
}

/**
 * Represents an audit log entry.
 */
export interface AuditLog {
    id: string;
    timestamp: number; // Unix timestamp (milliseconds)
    actorId?: string; // User ID or system component ID
    action: string; // e.g., 'PROFILE_CREATE', 'LISTING_UPDATE', 'LOGIN_SUCCESS'
    targetType?: string; // e.g., 'Profile', 'Listing', 'Transaction'
    targetId?: string; // ID of the target entity
    details: any; // Specific details about the action
    ipAddress?: string;
}

/**
 * Represents a payment method associated with a user.
 */
export interface UserPaymentMethod {
    id: string;
    userId: string;
    type: PaymentFormat; // Re-use PaymentFormat type
    details: any; // Encrypted/tokenized payment details (e.g., last 4 digits, token)
    isDefault: boolean;
    createdAt: number; // Unix timestamp (milliseconds)
    updatedAt: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a transaction between users.
 */
export interface Transaction {
    id: string;
    initiatorId: string; // The user who started the transaction (e.g., made the request)
    responderId: string; // The user who responded (e.g., made the offer)
    platformItemId: string; // Reference to the PlatformItem that initiated the transaction
    status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'disputed' | 'cancelled';
    agreedValue?: number; // Final agreed monetary value
    currency?: string;
    agreedPaymentFormat?: PaymentFormat;
    barterDetails?: {
        initiatorItem: PlatformItem; // Details of item from initiator
        responderItem: PlatformItem; // Details of item from responder
    };
    createdAt: number; // Unix timestamp (milliseconds)
    updatedAt: number; // Unix timestamp (milliseconds)
    completedAt?: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a review given by one user to another after a transaction.
 */
export interface Review {
    id: string;
    reviewerId: string;
    revieweeId: string;
    transactionId: string;
    rating: number; // 1-5 stars
    comment: string;
    createdAt: number; // Unix timestamp (milliseconds)
    // Add metrics like 'timeliness', 'communication', 'quality_of_item/service'
    metrics?: {
        timeliness?: number; // 1-5
        communication?: number; // 1-5
        itemQuality?: number; // 1-5 (if good)
        serviceQuality?: number; // 1-5 (if service)
    };
}

/**
 * Represents a dispute related to a transaction.
 */
export interface Dispute {
    id: string;
    transactionId: string;
    initiatorId: string; // User who opened the dispute
    responderId: string; // User against whom the dispute is opened
    reason: string;
    status: 'open' | 'under_review' | 'resolved' | 'closed_without_resolution';
    resolution?: string; // Description of how it was resolved
    resolvedBy?: string; // Mediator ID or 'system'
    createdAt: number; // Unix timestamp (milliseconds)
    updatedAt: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a tag used for categorization and search.
 */
export interface Tag {
    id: string;
    name: string;
    category?: 'skill' | 'interest' | 'item_attribute' | 'service_type' | 'location_tag';
    description?: string;
    // Add popularity, synonyms, etc.
}

/**
 * Represents a geographical fence or area.
 */
export interface GeoFence {
    id: string;
    name: string;
    type: 'circle' | 'polygon';
    coordinates: Location[]; // For polygon, first and last coordinate should be same
    radiusKm?: number; // For circle, in kilometers
    description?: string;
}

/**
 * Represents a classifier model used for automated tagging or categorization.
 */
export interface Classifier {
    id: string;
    name: string;
    modelId: string; // Reference to an ML model
    version: string;
    description?: string;
    inputSchema: any; // JSON schema for expected input
    outputSchema: any; // JSON schema for expected output (e.g., tags, categories)
}

/**
 * Represents a user's incentive profile, influencing their matching behavior.
 */
export interface UserIncentiveProfile {
    userId: string;
    incentiveWeights: IncentiveWeights; // Re-use existing IncentiveWeights
    dynamicFactors: {
        urgency: number; // 0-1, dynamically calculated based on active items/history
        flexibility: number; // 0-1, dynamically calculated (e.g., willingness to travel, accept different terms)
        // Add other dynamic factors influencing incentives
    };
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents market data for a specific item or category.
 */
export interface MarketData {
    id: string; // Item ID or category ID
    type: 'item' | 'category';
    supplyCount: number;
    demandCount: number;
    averageEstimatedValue?: number;
    lastUpdated: number; // Unix timestamp (milliseconds)
    // Add historical trends, price volatility, etc.
}

/**
 * Represents a liquidity pool for resource exchange.
 */
export interface LiquidityPool {
    id: string;
    name: string;
    resourceCategories: ItemCategory[]; // Categories of resources in the pool
    currentValue: number; // Aggregate value of resources in the pool
    description?: string;
    // Add more liquidity pool fields
}

/**
 * Represents a specific metric contributing to overall user reputation.
 */
export interface ReputationMetric {
    type: 'transaction_success' | 'timeliness' | 'communication' | 'vouch' | 'dispute_resolution';
    score: number; // Score for this specific metric (e.0 to 1.0)
    weight: number; // How much this metric contributes to overall reputation (0.0 to 1.0)
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's overall reputation.
 */
export interface UserReputation {
    userId: string;
    overallScore: number; // Aggregated score (0.0 to 1.0)
    metrics: ReputationMetric[];
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a log of a user's activity.
 */
export interface UserActivityLog {
    id: string;
    userId: string;
    activityType: 'login' | 'logout' | 'listing_create' | 'listing_update' | 'listing_delete' |
                  'message_send' | 'message_read' | 'match_found' | 'match_accept' | 'match_reject' |
                  'transaction_start' | 'transaction_complete' | 'review_given' | 'review_received' |
                  'profile_update' | 'setting_change' | 'search_query';
    timestamp: number; // Unix timestamp (milliseconds)
    details: any; // Specific details about the activity (e.g., listing ID, search terms)
}

/**
 * Represents a snapshot of user preferences at a given time.
 */
export interface UserPreferenceHistory {
    userId: string;
    timestamp: number; // Unix timestamp (milliseconds)
    preferencesSnapshot: UserPreferences; // Snapshot of UserPreferences
}

/**
 * Represents a detected behavioral pattern of a user.
 */
export interface UserBehavioralPattern {
    userId: string;
    patternType: 'frequent_lister' | 'responder' | 'passive_browser' | 'high_value_seeker' | 'community_contributor';
    score: number; // How strongly this pattern applies (0.0 to 1.0)
    lastDetected: number; // Unix timestamp (milliseconds)
    description?: string;
}

/**
 * Represents the status of an AI model in the system.
 */
export interface AIModelStatus {
    modelId: string;
    name: string;
    status: 'training' | 'active' | 'inactive' | 'error';
    lastTrained: number; // Unix timestamp (milliseconds)
    performanceMetrics: any; // e.g., accuracy, F1-score, latency
    version: string;
    description?: string;
}

/**
 * Represents a system configuration setting.
 */
export interface SystemConfiguration {
    key: string;
    value: any;
    lastUpdated: number; // Unix timestamp (milliseconds)
    updatedBy?: string; // User ID or 'system'
    description?: string;
}

/**
 * Represents a system health check status.
 */
export interface SystemHealthCheck {
    component: string;
    status: 'ok' | 'warning' | 'error';
    lastChecked: number; // Unix timestamp (milliseconds)
    message?: string;
    details?: any; // More detailed error information
}

/**
 * Represents an event in the system's audit trail.
 */
export interface AuditEvent {
    id: string;
    timestamp: number; // Unix timestamp (milliseconds)
    actorId?: string; // User ID or system component ID
    action: string;
    targetType?: string; // e.g., 'Profile', 'Listing'
    targetId?: string;
    details: any;
    ipAddress?: string;
}

/**
 * Represents a user's notification preferences.
 */
export interface UserNotificationPreference {
    userId: string;
    type: 'match' | 'message' | 'system' | 'transaction_update' | 'reputation_change' | 'marketing';
    channel: 'email' | 'sms' | 'in_app';
    enabled: boolean;
    frequency: 'instant' | 'daily' | 'weekly' | 'never';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a flag for content moderation.
 */
export interface ContentModerationFlag {
    id: string;
    entityType: 'listing' | 'message' | 'profile' | 'review';
    entityId: string;
    reason: string;
    status: 'pending' | 'reviewed' | 'action_taken' | 'false_positive';
    flaggedBy: string; // User ID or 'system'
    timestamp: number; // Unix timestamp (milliseconds)
    reviewedBy?: string; // Moderator ID
    reviewTimestamp?: number; // Unix timestamp (milliseconds)
    actionTaken?: string; // e.g., 'removed', 'warned', 'no_action'
}

/**
 * Represents a case for dispute resolution.
 */
export interface DisputeResolutionCase {
    id: string;
    disputeId: string;
    mediatorId?: string; // User ID of the mediator
    resolutionSteps: string[]; // Log of steps taken
    outcome: 'resolved' | 'escalated' | 'unresolved' | 'withdrawn';
    resolvedAt?: number; // Unix timestamp (milliseconds)
    createdAt: number; // Unix timestamp (milliseconds)
    updatedAt: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's overall trust score.
 */
export interface UserTrustScore {
    userId: string;
    score: number; // Aggregated trust score (0.0 to 1.0)
    components: {
        reputation: number; // Contribution from UserReputation
        activity_history: number; // Contribution from UserActivityLog
        verified_identity: number; // Contribution from UserVerificationStatus
        // Add other components like dispute history, feedback
    };
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's verification status.
 */
export interface UserVerificationStatus {
    userId: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean; // e.g., KYC, government ID
    addressVerified: boolean;
    // Add other verification types (e.g., professional license)
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's privacy settings.
 */
export interface UserPrivacySettings {
    userId: string;
    locationSharing: 'always' | 'on_match' | 'never';
    profileVisibility: 'public' | 'private' | 'connections_only';
    dataRetentionPolicy: 'default' | 'custom'; // e.g., 'custom' might mean delete data after X days
    messageHistoryRetentionDays?: number;
    // Add other privacy settings
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's communication preferences.
 */
export interface UserCommunicationPreference {
    userId: string;
    preferredChannel: 'in_app' | 'email' | 'sms';
    doNotDisturb: boolean; // Global DND
    doNotDisturbStartTime?: string; // "HH:MM"
    doNotDisturbEndTime?: string; // "HH:MM"
    // Add more granular communication preferences (e.g., per notification type)
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a skill associated with a user.
 */
export interface UserSkill {
    id: string;
    userId: string;
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    verified: boolean; // If vouched or certified
    endorsements?: { byUserId: string; timestamp: number; }[]; // List of users who vouched
    // Add more skill-specific fields
}

/**
 * Represents an interest associated with a user.
 */
export interface UserInterest {
    id: string;
    userId: string;
    name: string;
    category?: string; // e.g., "hobby", "topic", "cause"
    // Add more interest-specific fields
}

/**
 * Represents a user's availability.
 */
export interface UserAvailability {
    userId: string;
    type: 'always' | 'time_window' | 'specific_dates';
    timeWindows?: TimeWindow[]; // Reference to TimeWindow objects
    // Add more availability fields
}

/**
 * Represents a user's location history.
 */
export interface UserLocationHistory {
    userId: string;
    timestamp: number; // Unix timestamp (milliseconds)
    location: Location;
    // Add more location history fields (e.g., accuracy)
}

/**
 * Represents a user's device information.
 */
export interface UserDevice {
    id: string;
    userId: string;
    deviceType: 'mobile' | 'desktop' | 'tablet';
    os: string;
    browser: string;
    lastUsed: number; // Unix timestamp (milliseconds)
    // Add more device-specific fields (e.g., push token, app version)
}

/**
 * Represents a user's push notification token.
 */
export interface UserNotificationToken {
    id: string;
    userId: string;
    deviceToken: string; // For push notifications
    platform: 'ios' | 'android' | 'web';
    createdAt: number; // Unix timestamp (milliseconds)
    lastUsed: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's transaction history.
 */
export interface UserTransactionHistory {
    id: string;
    userId: string;
    transactionId: string;
    role: 'initiator' | 'responder';
    status: 'completed' | 'failed' | 'disputed' | 'cancelled';
    timestamp: number; // Unix timestamp (milliseconds)
    // Add more transaction history fields (e.g., item involved, value)
}

/**
 * Represents a user's review history (reviews given or received).
 */
export interface UserReviewHistory {
    id: string;
    userId: string;
    reviewId: string;
    type: 'given' | 'received';
    timestamp: number; // Unix timestamp (milliseconds)
    // Add more review history fields (e.g., rating, comment snippet)
}

/**
 * Represents a user's dispute history.
 */
export interface UserDisputeHistory {
    id: string;
    userId: string;
    disputeId: string;
    role: 'initiator' | 'responder';
    status: 'open' | 'resolved' | 'closed';
    timestamp: number; // Unix timestamp (milliseconds)
    // Add more dispute history fields (e.g., outcome)
}

/**
 * Represents a user's preference for a specific tag.
 */
export interface UserTagPreference {
    userId: string;
    tagId: string; // Reference to Tag ID
    preference: 'like' | 'dislike' | 'neutral';
    weight: number; // How strongly this preference influences matching (0.0 to 1.0)
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for a geographical fence.
 */
export interface UserGeoFencePreference {
    userId: string;
    geoFenceId: string; // Reference to GeoFence ID
    preference: 'include' | 'exclude';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for a time window.
 */
export interface UserTimeWindowPreference {
    userId: string;
    timeWindowId: string; // Reference to TimeWindow ID
    preference: 'available' | 'unavailable';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for a classifier.
 */
export interface UserClassifierPreference {
    userId: string;
    classifierId: string; // Reference to Classifier ID
    preference: 'include' | 'exclude'; // e.g., include items classified by this model
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for market data.
 */
export interface UserMarketDataPreference {
    userId: string;
    marketDataId: string; // Reference to MarketData ID (e.g., for a specific item category)
    preference: 'monitor' | 'ignore';
    threshold?: number; // For alerts (e.g., notify if supply drops below threshold)
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for a liquidity pool.
 */
export interface UserLiquidityPoolPreference {
    userId: string;
    liquidityPoolId: string; // Reference to LiquidityPool ID
    preference: 'participate' | 'observe';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for reputation metrics.
 */
export interface UserReputationPreference {
    userId: string;
    reputationMetricType: string; // e.g., 'transaction_success'
    minScore: number; // Minimum acceptable score for this metric in a match
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for trust score.
 */
export interface UserTrustScorePreference {
    userId: string;
    minScore: number; // Minimum acceptable overall trust score in a match
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for verification status.
 */
export interface UserVerificationPreference {
    userId: string;
    verificationType: 'emailVerified' | 'phoneVerified' | 'identityVerified' | 'addressVerified';
    required: boolean; // Is this verification type required for matches?
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for privacy settings.
 */
export interface UserPrivacySettingPreference {
    userId: string;
    settingKey: keyof UserPrivacySettings; // Key from UserPrivacySettings
    value: any; // The preferred value for that setting
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for communication settings.
 */
export interface UserCommunicationSettingPreference {
    userId: string;
    settingKey: keyof UserCommunicationPreference; // Key from UserCommunicationPreference
    value: any; // The preferred value for that setting
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for skills.
 */
export interface UserSkillPreference {
    userId: string;
    skillId: string; // Reference to UserSkill ID
    minLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    verifiedRequired: boolean; // Is verification required for this skill in a match?
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for interests.
 */
export interface UserInterestPreference {
    userId: string;
    interestId: string; // Reference to UserInterest ID
    preference: 'like' | 'dislike';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for availability.
 */
export interface UserAvailabilityPreference {
    userId: string;
    availabilityType: 'always' | 'time_window' | 'specific_dates';
    preference: 'match_only_available' | 'show_all'; // e.g., only show matches when I'm available
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for device types.
 */
export interface UserDevicePreference {
    userId: string;
    deviceType: 'mobile' | 'desktop' | 'tablet';
    preference: 'allow' | 'block'; // e.g., only allow communication from certain device types
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for notification settings.
 */
export interface UserNotificationPreferenceSetting {
    userId: string;
    notificationType: UserNotificationPreference['type'];
    channel: UserNotificationPreference['channel'];
    enabled: boolean;
    frequency: UserNotificationPreference['frequency'];
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for payment methods.
 */
export interface UserPaymentMethodPreference {
    userId: string;
    paymentMethodType: PaymentFormat;
    preferred: boolean; // Is this payment method preferred for transactions?
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for transaction history filtering.
 */
export interface UserTransactionHistoryPreference {
    userId: string;
    statusFilter: 'completed' | 'failed' | 'disputed' | 'cancelled' | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for review history filtering.
 */
export interface UserReviewHistoryPreference {
    userId: string;
    typeFilter: 'given' | 'received' | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for dispute history filtering.
 */
export interface UserDisputeHistoryPreference {
    userId: string;
    statusFilter: 'open' | 'resolved' | 'closed' | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for activity log filtering.
 */
export interface UserActivityLogPreference {
    userId: string;
    activityTypeFilter: UserActivityLog['activityType'] | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for behavioral pattern filtering.
 */
export interface UserBehavioralPatternPreference {
    userId: string;
    patternTypeFilter: UserBehavioralPattern['patternType'] | 'all';
    minScore?: number;
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for AI model status monitoring.
 */
export interface AIModelStatusPreference {
    userId: string;
    modelIdFilter: string | 'all';
    statusFilter?: AIModelStatus['status'] | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for system configuration monitoring.
 */
export interface SystemConfigurationPreference {
    userId: string;
    keyFilter: string | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for system health check monitoring.
 */
export interface SystemHealthCheckPreference {
    userId: string;
    componentFilter: string | 'all';
    statusFilter?: SystemHealthCheck['status'] | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for audit event filtering.
 */
export interface AuditEventPreference {
    userId: string;
    actionFilter: AuditEvent['action'] | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for content moderation flag filtering.
 */
export interface ContentModerationFlagPreference {
    userId: string;
    entityTypeFilter: ContentModerationFlag['entityType'] | 'all';
    statusFilter?: ContentModerationFlag['status'] | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

/**
 * Represents a user's preference for dispute resolution case filtering.
 */
export interface DisputeResolutionCasePreference {
    userId: string;
    statusFilter: DisputeResolutionCase['outcome'] | 'all';
    lastUpdated: number; // Unix timestamp (milliseconds)
}

// ==================== TYPES USED BY BACKEND / FRONTEND ====================

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

export interface MatchingResultDimensionBreakdown {
    dimension: string;
    similarity: number;
    complementarity: number;
    synergy: number;
    weight: number;
}

export interface MatchingResult {
    profileA: string;
    profileB: string;
    matchScore: number;
    dimensions?: MatchingResultDimensionBreakdown[];
    potentialValue?: number;
    socialWelfare?: number;
    coordinationCost?: number;
    recommendedAction?: any;
    reason?: string;
}

export interface OptimizationObjective {
    type: 'utility_maximization' | 'waste_minimization' | 'equity_maximization' | 'efficiency_maximization' | string;
    weight: number;
    targetValue: number;
    currentValue: number;
    priority: number;
}

export interface Constraint {
    id: string;
    type: string;
    parameters: any;
    hardness: 'hard' | 'soft';
    weight: number;
    violated: boolean;
}

export interface RecommendedAction {
    action?: string;
    type?: string;
    target?: string;
    value?: any;
    priority?: number;
    justification?: string;
}

export interface AllocationItem {
    resourceId: string;
    quantity: number;
    utilityValue: number;
    allocationReason?: string;
    alternativeUses?: string[];
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

export interface SocialImpact {
    communityBenefit: number;
    environmentalImpact: number;
    socialEquity: number;
    knowledgeSharing: number;
    culturalExchange: number;
}

export interface DimensionalMatch {
    dimension: string;
    similarity: number;
    complementarity: number;
    synergy: number;
    weight: number;
}

export interface MarketDynamics {
    supply: number;
    demand: number;
    equilibriumPrice: number;
    volatility: number;
    trendDirection: 'up' | 'down' | 'stable';
    marketEfficiency: number;
    liquidityScore: number;
}

// Lightweight AI request/response placeholders (if needed later)
export interface AIRequest { id: string; [key: string]: any }
export interface AIResponse { requestId: string; [key: string]: any }