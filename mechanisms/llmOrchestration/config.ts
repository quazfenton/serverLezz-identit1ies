import { 
  PromptEvolutionConfig, 
  StorageConfig, 
  LLMProvider,
  PromptTemplate 
} from './index';

// ==================== CONFIGURATION PRESETS ====================

export interface LLMOrchestrationConfig {
  evolution: PromptEvolutionConfig;
  storage: StorageConfig;
  providers: LLMProvider[];
  prompts: PromptTemplate[];
  features: FeatureConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
}

export interface FeatureConfig {
  enableEvolution: boolean;
  enableCaching: boolean;
  enableRetries: boolean;
  enableFallback: boolean;
  enableAnalytics: boolean;
  enableRateLimiting: boolean;
  enableCostOptimization: boolean;
  enableQualityAssurance: boolean;
}

export interface MonitoringConfig {
  enableMetrics: boolean;
  enableLogging: boolean;
  enableAlerts: boolean;
  metricsInterval: number; // seconds
  logLevel: "debug" | "info" | "warn" | "error";
  alertThresholds: {
    errorRate: number;
    latency: number;
    cost: number;
    quality: number;
  };
}

export interface SecurityConfig {
  enableEncryption: boolean;
  enableAuthentication: boolean;
  enableAuthorization: boolean;
  apiKeyRotation: boolean;
  auditLogging: boolean;
  rateLimitingStrict: boolean;
  dataRetention: number; // days
}

// ==================== PRESET CONFIGURATIONS ====================

export const DEVELOPMENT_CONFIG: LLMOrchestrationConfig = {
  evolution: {
    enabled: true,
    interval: 2, // Evolve every 2 iterations for fast testing
    evolutionPrompt: "prompt_evolution_meta",
    maxVariations: 3,
    selectionCriteria: {
      weights: {
        performance: 0.4,
        creativity: 0.3,
        practicality: 0.2,
        innovation: 0.1,
        cost: 0.0 // Don't worry about cost in dev
      },
      minimumThreshold: 0.6
    },
    mutationRate: 0.2,
    crossoverRate: 0.3
  },
  storage: {
    type: "filesystem",
    basePath: "/home/admin/000code/serverLezz identit1ies/data/llm_orchestration_dev",
    compression: false,
    encryption: false,
    backupEnabled: false
  },
  providers: [], // Will be populated by factory
  prompts: [], // Will be populated by factory
  features: {
    enableEvolution: true,
    enableCaching: true,
    enableRetries: true,
    enableFallback: true,
    enableAnalytics: true,
    enableRateLimiting: false, // Relaxed for dev
    enableCostOptimization: false,
    enableQualityAssurance: true
  },
  monitoring: {
    enableMetrics: true,
    enableLogging: true,
    enableAlerts: false,
    metricsInterval: 30,
    logLevel: "debug",
    alertThresholds: {
      errorRate: 0.5,
      latency: 10000,
      cost: 1.0,
      quality: 0.3
    }
  },
  security: {
    enableEncryption: false,
    enableAuthentication: false,
    enableAuthorization: false,
    apiKeyRotation: false,
    auditLogging: true,
    rateLimitingStrict: false,
    dataRetention: 7
  }
};

export const PRODUCTION_CONFIG: LLMOrchestrationConfig = {
  evolution: {
    enabled: true,
    interval: 10, // More conservative evolution
    evolutionPrompt: "prompt_evolution_meta",
    maxVariations: 5,
    selectionCriteria: {
      weights: {
        performance: 0.3,
        creativity: 0.2,
        practicality: 0.3,
        innovation: 0.1,
        cost: 0.1
      },
      minimumThreshold: 0.8
    },
    mutationRate: 0.1,
    crossoverRate: 0.2
  },
  storage: {
    type: "hybrid",
    basePath: "/var/lib/llm_orchestration",
    database: {
      type: "postgresql",
      connectionString: process.env.DATABASE_URL || "",
      tables: {
        prompts: "llm_prompts",
        responses: "llm_responses", 
        sessions: "llm_sessions",
        analytics: "llm_analytics"
      }
    },
    cloud: {
      provider: "aws",
      bucket: process.env.S3_BUCKET || "llm-orchestration-data",
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
      }
    },
    compression: true,
    encryption: true,
    backupEnabled: true
  },
  providers: [], // Will be populated by factory
  prompts: [], // Will be populated by factory
  features: {
    enableEvolution: true,
    enableCaching: true,
    enableRetries: true,
    enableFallback: true,
    enableAnalytics: true,
    enableRateLimiting: true,
    enableCostOptimization: true,
    enableQualityAssurance: true
  },
  monitoring: {
    enableMetrics: true,
    enableLogging: true,
    enableAlerts: true,
    metricsInterval: 60,
    logLevel: "info",
    alertThresholds: {
      errorRate: 0.1,
      latency: 5000,
      cost: 0.1,
      quality: 0.7
    }
  },
  security: {
    enableEncryption: true,
    enableAuthentication: true,
    enableAuthorization: true,
    apiKeyRotation: true,
    auditLogging: true,
    rateLimitingStrict: true,
    dataRetention: 90
  }
};

export const RESEARCH_CONFIG: LLMOrchestrationConfig = {
  evolution: {
    enabled: true,
    interval: 5,
    evolutionPrompt: "prompt_evolution_meta",
    maxVariations: 7,
    selectionCriteria: {
      weights: {
        performance: 0.2,
        creativity: 0.4,
        practicality: 0.1,
        innovation: 0.3,
        cost: 0.0
      },
      minimumThreshold: 0.7
    },
    mutationRate: 0.3,
    crossoverRate: 0.4
  },
  storage: {
    type: "filesystem",
    basePath: "/home/admin/000code/serverLezz identit1ies/data/llm_orchestration_research",
    compression: true,
    encryption: false,
    backupEnabled: true
  },
  providers: [], // Will be populated by factory
  prompts: [], // Will be populated by factory
  features: {
    enableEvolution: true,
    enableCaching: false, // Want fresh results for research
    enableRetries: true,
    enableFallback: true,
    enableAnalytics: true,
    enableRateLimiting: false,
    enableCostOptimization: false,
    enableQualityAssurance: true
  },
  monitoring: {
    enableMetrics: true,
    enableLogging: true,
    enableAlerts: false,
    metricsInterval: 15,
    logLevel: "debug",
    alertThresholds: {
      errorRate: 0.3,
      latency: 15000,
      cost: 5.0,
      quality: 0.5
    }
  },
  security: {
    enableEncryption: false,
    enableAuthentication: false,
    enableAuthorization: false,
    apiKeyRotation: false,
    auditLogging: true,
    rateLimitingStrict: false,
    dataRetention: 365
  }
};

// ==================== PROVIDER CONFIGURATIONS ====================

export const PROVIDER_CONFIGS = {
  openai: {
    gpt4: {
      id: "openai-gpt4",
      name: "OpenAI GPT-4",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-4",
      maxTokens: 4096,
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 40000,
        requestsPerDay: 1000,
        currentUsage: { requests: 0, tokens: 0, resetTime: new Date() }
      },
      costPerToken: 0.00003,
      capabilities: [
        { type: "text_generation" as const, strength: 0.95, specializations: ["general", "reasoning"] },
        { type: "code_generation" as const, strength: 0.90, specializations: ["programming", "debugging"] },
        { type: "analysis" as const, strength: 0.92, specializations: ["data", "text"] }
      ],
      reliability: 0.95,
      averageLatency: 2000,
      isActive: true
    },
    gpt35: {
      id: "openai-gpt35",
      name: "OpenAI GPT-3.5 Turbo",
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-3.5-turbo",
      maxTokens: 4096,
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      rateLimits: {
        requestsPerMinute: 90,
        tokensPerMinute: 90000,
        requestsPerDay: 2000,
        currentUsage: { requests: 0, tokens: 0, resetTime: new Date() }
      },
      costPerToken: 0.000002,
      capabilities: [
        { type: "text_generation" as const, strength: 0.85, specializations: ["general", "conversation"] },
        { type: "code_generation" as const, strength: 0.80, specializations: ["basic_programming"] }
      ],
      reliability: 0.92,
      averageLatency: 1500,
      isActive: true
    }
  },
  anthropic: {
    claude3: {
      id: "anthropic-claude3",
      name: "Anthropic Claude 3 Opus",
      endpoint: "https://api.anthropic.com/v1/messages",
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: "claude-3-opus-20240229",
      maxTokens: 4096,
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      rateLimits: {
        requestsPerMinute: 50,
        tokensPerMinute: 30000,
        requestsPerDay: 800,
        currentUsage: { requests: 0, tokens: 0, resetTime: new Date() }
      },
      costPerToken: 0.000015,
      capabilities: [
        { type: "reasoning" as const, strength: 0.96, specializations: ["logic", "analysis"] },
        { type: "creativity" as const, strength: 0.88, specializations: ["writing", "ideation"] },
        { type: "text_generation" as const, strength: 0.93, specializations: ["long-form", "structured"] }
      ],
      reliability: 0.93,
      averageLatency: 2500,
      isActive: true
    }
  },
  google: {
    gemini: {
      id: "google-gemini",
      name: "Google Gemini Pro",
      endpoint: "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
      apiKey: process.env.GOOGLE_API_KEY || "",
      model: "gemini-pro",
      maxTokens: 8192,
      temperature: 0.7,
      topP: 0.8,
      frequencyPenalty: 0,
      presencePenalty: 0,
      rateLimits: {
        requestsPerMinute: 60,
        tokensPerMinute: 32000,
        requestsPerDay: 1500,
        currentUsage: { requests: 0, tokens: 0, resetTime: new Date() }
      },
      costPerToken: 0.000125,
      capabilities: [
        { type: "reasoning" as const, strength: 0.88, specializations: ["multimodal", "analysis"] },
        { type: "creativity" as const, strength: 0.85, specializations: ["content", "ideation"] },
        { type: "code_generation" as const, strength: 0.82, specializations: ["multiple_languages"] }
      ],
      reliability: 0.90,
      averageLatency: 2200,
      isActive: true
    }
  }
};

// ==================== PROMPT TEMPLATE LIBRARY ====================

export const PROMPT_LIBRARY = {
  codeGeneration: {
    apiDesign: {
      id: "api_design_advanced",
      name: "Advanced API Design",
      content: `Design a production-ready REST API for {{projectName}} using {{language}} and {{framework}}.

Requirements: {{requirements}}
Scale: {{expectedLoad}}
Security: {{securityRequirements}}

Provide comprehensive design including:
1. Resource modeling and endpoint structure
2. Authentication and authorization strategy
3. Request/response schemas with validation
4. Error handling and status codes
5. Rate limiting and throttling
6. Caching strategy
7. API versioning approach
8. Documentation structure
9. Testing strategy
10. Monitoring and observability

Focus on scalability, maintainability, and developer experience.`,
      category: "code_generation" as const,
      variables: [
        { name: "projectName", type: "string" as const, required: true, description: "Project name" },
        { name: "language", type: "string" as const, required: true, description: "Programming language" },
        { name: "framework", type: "string" as const, required: true, description: "Framework" },
        { name: "requirements", type: "string" as const, required: true, description: "Functional requirements" },
        { name: "expectedLoad", type: "string" as const, required: false, description: "Expected load" },
        { name: "securityRequirements", type: "string" as const, required: false, description: "Security requirements" }
      ],
      metadata: {
        tags: ["api", "design", "production", "scalability"],
        difficulty: 0.8,
        expectedTokens: 1500,
        estimatedCost: 0.045,
        language: "en",
        domain: ["software_architecture", "api_design", "backend"],
        author: "system",
        version: "2.0"
      },
      variations: [],
      performance: {
        successRate: 0.9,
        averageQuality: 0.85,
        averageRelevance: 0.9,
        averageCreativity: 0.75,
        averageExecutionTime: 4000,
        costEfficiency: 0.8,
        userSatisfaction: 0.85,
        errorRate: 0.05,
        lastEvaluated: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }
  },
  analysis: {
    systemAnalysis: {
      id: "system_analysis_comprehensive",
      name: "Comprehensive System Analysis",
      content: `Perform a thorough analysis of the {{systemType}} system with the following characteristics:

System Description: {{systemDescription}}
Current Challenges: {{challenges}}
Stakeholders: {{stakeholders}}
Constraints: {{constraints}}

Provide detailed analysis covering:
1. System architecture and components
2. Data flow and dependencies
3. Performance bottlenecks and optimization opportunities
4. Security vulnerabilities and mitigation strategies
5. Scalability limitations and solutions
6. Cost analysis and optimization
7. Risk assessment and contingency planning
8. Modernization roadmap
9. Implementation priorities
10. Success metrics and KPIs

Think systematically and consider both technical and business perspectives.`,
      category: "analysis" as const,
      variables: [
        { name: "systemType", type: "string" as const, required: true, description: "Type of system" },
        { name: "systemDescription", type: "string" as const, required: true, description: "System description" },
        { name: "challenges", type: "string" as const, required: true, description: "Current challenges" },
        { name: "stakeholders", type: "string" as const, required: false, description: "Key stakeholders" },
        { name: "constraints", type: "string" as const, required: false, description: "System constraints" }
      ],
      metadata: {
        tags: ["analysis", "system", "architecture", "optimization"],
        difficulty: 0.9,
        expectedTokens: 2000,
        estimatedCost: 0.06,
        language: "en",
        domain: ["system_analysis", "architecture", "consulting"],
        author: "system",
        version: "1.0"
      },
      variations: [],
      performance: {
        successRate: 0.85,
        averageQuality: 0.88,
        averageRelevance: 0.92,
        averageCreativity: 0.7,
        averageExecutionTime: 5000,
        costEfficiency: 0.75,
        userSatisfaction: 0.9,
        errorRate: 0.08,
        lastEvaluated: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }
  }
};

// ==================== CONFIGURATION FACTORY ====================

export class ConfigurationFactory {
  public static createConfig(
    environment: "development" | "production" | "research",
    customizations?: Partial<LLMOrchestrationConfig>
  ): LLMOrchestrationConfig {
    let baseConfig: LLMOrchestrationConfig;
    
    switch (environment) {
      case "development":
        baseConfig = DEVELOPMENT_CONFIG;
        break;
      case "production":
        baseConfig = PRODUCTION_CONFIG;
        break;
      case "research":
        baseConfig = RESEARCH_CONFIG;
        break;
      default:
        throw new Error(`Unknown environment: ${environment}`);
    }
    
    // Apply customizations
    if (customizations) {
      baseConfig = this.mergeConfigs(baseConfig, customizations);
    }
    
    // Populate providers and prompts
    baseConfig.providers = this.getDefaultProviders(environment);
    baseConfig.prompts = this.getDefaultPrompts(environment);
    
    return baseConfig;
  }
  
  private static mergeConfigs(
    base: LLMOrchestrationConfig, 
    custom: Partial<LLMOrchestrationConfig>
  ): LLMOrchestrationConfig {
    return {
      evolution: { ...base.evolution, ...custom.evolution },
      storage: { ...base.storage, ...custom.storage },
      providers: custom.providers || base.providers,
      prompts: custom.prompts || base.prompts,
      features: { ...base.features, ...custom.features },
      monitoring: { ...base.monitoring, ...custom.monitoring },
      security: { ...base.security, ...custom.security }
    };
  }
  
  private static getDefaultProviders(environment: string): LLMProvider[] {
    const providers: LLMProvider[] = [];
    
    // Always include OpenAI GPT-4
    providers.push(PROVIDER_CONFIGS.openai.gpt4 as LLMProvider);
    
    // Add Claude for production and research
    if (environment !== "development") {
      providers.push(PROVIDER_CONFIGS.anthropic.claude3 as LLMProvider);
    }
    
    // Add Gemini for research
    if (environment === "research") {
      providers.push(PROVIDER_CONFIGS.google.gemini as LLMProvider);
    }
    
    // Add GPT-3.5 for cost optimization in development
    if (environment === "development") {
      providers.push(PROVIDER_CONFIGS.openai.gpt35 as LLMProvider);
    }
    
    return providers;
  }
  
  private static getDefaultPrompts(environment: string): PromptTemplate[] {
    const prompts: PromptTemplate[] = [];
    
    // Add core prompts
    prompts.push(PROMPT_LIBRARY.codeGeneration.apiDesign);
    prompts.push(PROMPT_LIBRARY.analysis.systemAnalysis);
    
    // Add more prompts based on environment
    if (environment === "research") {
      // Add experimental prompts for research
    }
    
    return prompts;
  }
  
  public static validateConfig(config: LLMOrchestrationConfig): boolean {
    // Validate configuration
    if (!config.storage.basePath) {
      throw new Error("Storage base path is required");
    }
    
    if (config.providers.length === 0) {
      throw new Error("At least one provider must be configured");
    }
    
    if (config.evolution.enabled && !config.evolution.evolutionPrompt) {
      throw new Error("Evolution prompt is required when evolution is enabled");
    }
    
    return true;
  }
}

// ==================== ENVIRONMENT DETECTION ====================

export function detectEnvironment(): "development" | "production" | "research" {
  const env = process.env.NODE_ENV || "development";
  const isResearch = process.env.LLM_RESEARCH_MODE === "true";
  
  if (isResearch) return "research";
  if (env === "production") return "production";
  return "development";
}

// ==================== EXPORTS ====================

export default {
  DEVELOPMENT_CONFIG,
  PRODUCTION_CONFIG,
  RESEARCH_CONFIG,
  PROVIDER_CONFIGS,
  PROMPT_LIBRARY,
  ConfigurationFactory,
  detectEnvironment
};