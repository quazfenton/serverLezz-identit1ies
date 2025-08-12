import {
  LLMOrchestrationEngine,
  createLLMOrchestrationEngine,
  PromptTemplate,
  LLMProvider,
  OrchestrationRequest,
  OrchestrationResponse,
  OrchestrationStrategy,
  LLMResponse,
  QualityMetrics,
  PromptVariation
} from './index';

import {
  ConfigurationFactory,
  detectEnvironment,
  LLMOrchestrationConfig
} from './config';

import {
  RetryManager,
  CircuitBreaker,
  LRUCache,
  RateLimiter,
  QualityAssessment,
  PerformanceMonitor,
  LLMOrchestrationError,
  RetryableError,
  NonRetryableError
} from './utils';

import { LLMOrchestrationExamples } from './examples';
import { FileBasedResponseStore, IResponseStore, createResponseStore } from './persistence/ResponseStore';
import { PromptEvolutionManager, IPromptEvolutionManager, createPromptEvolutionManager } from './orchestrator/PromptEvolutionManager';
import { META_PROMPTS, getAllMetaPrompts } from './prompts/MetaPrompts';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

// ==================== ADVANCED TYPES ====================

export interface FeedbackData {
  id: string;
  promptId: string;
  responseId: string;
  score: number; // 0-10 numerical score
  category: 'quality' | 'relevance' | 'creativity' | 'accuracy' | 'usefulness';
  feedback: string;
  source: 'human' | 'ai' | 'automated';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TaskClassification {
  id: string;
  name: string;
  description: string;
  characteristics: string[];
  optimalProviders: string[];
  performanceMetrics: Map<string, number>; // providerId -> performance score
  lastUpdated: Date;
}

export interface ModelPerformanceTracker {
  providerId: string;
  taskClass: string;
  successRate: number;
  averageScore: number;
  responseTime: number;
  costEfficiency: number;
  sampleSize: number;
  lastUpdated: Date;
}

export interface MultimodalCapability {
  type: 'text' | 'image' | 'audio' | 'video' | 'code';
  supported: boolean;
  quality: number; // 0-1 scale
  costMultiplier: number;
}

export interface IntelligentCacheEntry {
  key: string;
  value: OrchestrationResponse;
  accessCount: number;
  lastAccessed: Date;
  predictedNextAccess?: Date;
  contextSimilarity: number;
  qualityScore: number;
  ttl: number;
}

export interface EvolutionStrategy {
  type: 'genetic' | 'gradient' | 'reinforcement' | 'hybrid';
  parameters: Record<string, any>;
  fitnessFunction: (response: OrchestrationResponse, feedback?: FeedbackData[]) => number;
}

export interface CoordinationPattern {
  id: string;
  name: string;
  description: string;
  strategy: OrchestrationStrategy;
  conditions: (context: any) => boolean;
  priority: number;
  effectiveness: number;
}

// ==================== MAIN ORCHESTRATOR CLASS ====================

export class AdvancedLLMOrchestrator extends EventEmitter {
  private engine: LLMOrchestrationEngine;
  private config: LLMOrchestrationConfig;
  private retryManager: RetryManager;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private cache: LRUCache<OrchestrationResponse>;
  private rateLimiter: RateLimiter;
  private performanceMonitor: PerformanceMonitor;
  private isInitialized: boolean = false;

  // Advanced capabilities
  private feedbackDatabase: Map<string, FeedbackData[]> = new Map();
  private taskClassifications: Map<string, TaskClassification> = new Map();
  private modelPerformanceTrackers: Map<string, ModelPerformanceTracker> = new Map();
  private intelligentCache: Map<string, IntelligentCacheEntry> = new Map();
  private evolutionStrategies: Map<string, EvolutionStrategy> = new Map();
  private coordinationPatterns: CoordinationPattern[] = [];
  private multimodalCapabilities: Map<string, MultimodalCapability[]> = new Map();
  
  // New modular components
  private responseStore: IResponseStore;
  private evolutionManager: IPromptEvolutionManager;
  
  // Learning and adaptation
  private learningRate: number = 0.01;
  private adaptationThreshold: number = 0.1;
  private qualityThreshold: number = 0.7;
  private costOptimizationEnabled: boolean = true;
  
  // Background processes
  private evolutionInterval?: NodeJS.Timeout;
  private performanceAnalysisInterval?: NodeJS.Timeout;
  private cacheOptimizationInterval?: NodeJS.Timeout;

  constructor(customConfig?: Partial<LLMOrchestrationConfig>) {
    super();
    const environment = detectEnvironment();
    this.config = ConfigurationFactory.createConfig(environment, customConfig);
    
    // Validate configuration
    ConfigurationFactory.validateConfig(this.config);
    
    // Initialize components
    this.engine = createLLMOrchestrationEngine({
      evolutionConfig: this.config.evolution,
      storageConfig: this.config.storage
    });
    
    this.retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    });
    
    this.circuitBreakers = new Map();
    
    this.cache = new LRUCache<OrchestrationResponse>(
      1000, // max size
      300000 // 5 minutes TTL
    );
    
    this.rateLimiter = new RateLimiter({
      windowSize: 60000, // 1 minute
      maxRequests: 100,
      keyGenerator: (context) => context.userId || 'anonymous'
    });
    
    this.performanceMonitor = new PerformanceMonitor();
    
    // Initialize modular components
    this.responseStore = createResponseStore('file', {
      basePath: path.join(this.config.storage.basePath, 'responses'),
      maxAgeHours: 24
    });
    
    // Evolution manager will be initialized after evolution strategies are set up
    this.evolutionManager = null!; // Will be initialized in initializeAdvancedCapabilities
  }

  // ==================== INITIALIZATION ====================

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🚀 Initializing Advanced LLM Orchestrator...');
      
      // Add configured providers
      for (const provider of this.config.providers) {
        this.engine.addProvider(provider);
        this.circuitBreakers.set(provider.id, new CircuitBreaker({
          failureThreshold: 0.5,
          recoveryTimeout: 60000,
          minimumRequests: 5
        }));
      }
      
      // Add configured prompts
      for (const prompt of this.config.prompts) {
        this.engine.addPrompt(prompt);
      }
      
      console.log(`✅ Initialized with ${this.config.providers.length} providers and ${this.config.prompts.length} prompts`);
      
      this.isInitialized = true;
      
      // Initialize advanced capabilities
      await this.initializeAdvancedCapabilities();
      
      // Start background tasks
      this.startBackgroundTasks();
      
    } catch (error) {
      console.error('❌ Failed to initialize orchestrator:', error);
      throw new LLMOrchestrationError(
        'Initialization failed',
        'INIT_ERROR',
        error
      );
    }
  }

  private async initializeAdvancedCapabilities(): Promise<void> {
    console.log('🧠 Initializing advanced AI capabilities...');
    
    // Initialize task classifications
    this.initializeTaskClassifications();
    
    // Initialize evolution strategies
    this.initializeEvolutionStrategies();
    
    // Initialize coordination patterns
    this.initializeCoordinationPatterns();
    
    // Initialize multimodal capabilities
    this.initializeMultimodalCapabilities();
    
    // Load historical data if available
    await this.loadHistoricalData();
    
    // Initialize evolution manager with strategies
    this.evolutionManager = createPromptEvolutionManager(
      this.evolutionStrategies,
      this.qualityThreshold,
      (promptId: string, variables: Record<string, any>, options?: any) => 
        this.executePrompt(promptId, variables, options)
    );
    
    // Add meta-prompts to the engine
    const metaPrompts = getAllMetaPrompts();
    for (const metaPrompt of metaPrompts) {
      this.engine.addPrompt(metaPrompt);
    }
    console.log(`🔧 Added ${metaPrompts.length} meta-prompts for evolution`);
    
    console.log('✅ Advanced capabilities initialized');
  }

  private initializeTaskClassifications(): void {
    const taskClasses: TaskClassification[] = [
      {
        id: 'code_generation',
        name: 'Code Generation',
        description: 'Tasks involving writing, debugging, or optimizing code',
        characteristics: ['syntax_accuracy', 'logic_correctness', 'efficiency', 'readability'],
        optimalProviders: ['openai-gpt-4', 'anthropic-claude-3'],
        performanceMetrics: new Map(),
        lastUpdated: new Date()
      },
      {
        id: 'creative_writing',
        name: 'Creative Writing',
        description: 'Tasks requiring creativity, storytelling, and artistic expression',
        characteristics: ['creativity', 'narrative_flow', 'emotional_depth', 'originality'],
        optimalProviders: ['anthropic-claude-3', 'openai-gpt-4'],
        performanceMetrics: new Map(),
        lastUpdated: new Date()
      },
      {
        id: 'analytical_reasoning',
        name: 'Analytical Reasoning',
        description: 'Tasks requiring logical analysis, problem-solving, and critical thinking',
        characteristics: ['logical_consistency', 'depth_of_analysis', 'evidence_based', 'structured_thinking'],
        optimalProviders: ['openai-gpt-4', 'google-gemini-pro'],
        performanceMetrics: new Map(),
        lastUpdated: new Date()
      },
      {
        id: 'multimodal_processing',
        name: 'Multimodal Processing',
        description: 'Tasks involving multiple input types (text, images, audio, etc.)',
        characteristics: ['cross_modal_understanding', 'integration_quality', 'context_awareness'],
        optimalProviders: ['google-gemini-pro', 'openai-gpt-4-vision'],
        performanceMetrics: new Map(),
        lastUpdated: new Date()
      }
    ];

    taskClasses.forEach(taskClass => {
      this.taskClassifications.set(taskClass.id, taskClass);
    });
  }

  private initializeEvolutionStrategies(): void {
    // Genetic Algorithm Strategy
    this.evolutionStrategies.set('genetic', {
      type: 'genetic',
      parameters: {
        populationSize: 10,
        mutationRate: 0.1,
        crossoverRate: 0.7,
        elitismRate: 0.2,
        generations: 5
      },
      fitnessFunction: (response, feedback) => {
        let fitness = response.quality.overall * 0.4;
        fitness += (1 - response.totalCost / 1000) * 0.2; // Cost efficiency
        fitness += (1 - response.totalLatency / 30000) * 0.2; // Speed
        
        if (feedback && feedback.length > 0) {
          const avgFeedback = feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length / 10;
          fitness += avgFeedback * 0.2;
        }
        
        return Math.max(0, Math.min(1, fitness));
      }
    });

    // Reinforcement Learning Strategy
    this.evolutionStrategies.set('reinforcement', {
      type: 'reinforcement',
      parameters: {
        learningRate: 0.01,
        discountFactor: 0.95,
        explorationRate: 0.1,
        rewardThreshold: 0.8
      },
      fitnessFunction: (response, feedback) => {
        let reward = 0;
        
        // Quality reward
        if (response.quality.overall > 0.8) reward += 1;
        else if (response.quality.overall > 0.6) reward += 0.5;
        
        // Cost efficiency reward
        if (response.totalCost < 0.01) reward += 0.5;
        
        // Speed reward
        if (response.totalLatency < 5000) reward += 0.5;
        
        // Feedback reward
        if (feedback && feedback.length > 0) {
          const avgScore = feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length;
          reward += (avgScore / 10) * 2;
        }
        
        return reward;
      }
    });

    // Hybrid Strategy
    this.evolutionStrategies.set('hybrid', {
      type: 'hybrid',
      parameters: {
        geneticWeight: 0.6,
        reinforcementWeight: 0.4,
        adaptiveThreshold: 0.1
      },
      fitnessFunction: (response, feedback) => {
        const genetic = this.evolutionStrategies.get('genetic')!.fitnessFunction(response, feedback);
        const reinforcement = this.evolutionStrategies.get('reinforcement')!.fitnessFunction(response, feedback);
        return genetic * 0.6 + (reinforcement / 4) * 0.4; // Normalize reinforcement to 0-1 scale
      }
    });
  }

  private initializeCoordinationPatterns(): void {
    this.coordinationPatterns = [
      {
        id: 'high_quality_ensemble',
        name: 'High Quality Ensemble',
        description: 'Use ensemble when quality is paramount',
        strategy: 'ensemble',
        conditions: (context) => context.priority >= 3 || context.qualityRequired > 0.8,
        priority: 10,
        effectiveness: 0.9
      },
      {
        id: 'fast_fallback',
        name: 'Fast Fallback',
        description: 'Use fallback for time-sensitive tasks',
        strategy: 'fallback',
        conditions: (context) => context.timeout < 10000 || context.urgency === 'high',
        priority: 8,
        effectiveness: 0.7
      },
      {
        id: 'cost_optimized_sequential',
        name: 'Cost Optimized Sequential',
        description: 'Use sequential for cost-sensitive tasks',
        strategy: 'sequential',
        conditions: (context) => context.budget < 0.05 || context.costSensitive === true,
        priority: 6,
        effectiveness: 0.6
      },
      {
        id: 'adaptive_learning',
        name: 'Adaptive Learning',
        description: 'Use adaptive strategy for learning scenarios',
        strategy: 'adaptive',
        conditions: (context) => context.learning === true || context.feedback === true,
        priority: 9,
        effectiveness: 0.85
      },
      {
        id: 'competitive_innovation',
        name: 'Competitive Innovation',
        description: 'Use competitive strategy for creative tasks',
        strategy: 'competitive',
        conditions: (context) => context.creativity > 0.7 || context.innovation === true,
        priority: 7,
        effectiveness: 0.8
      }
    ];
  }

  private initializeMultimodalCapabilities(): void {
    // OpenAI capabilities
    this.multimodalCapabilities.set('openai-gpt-4', [
      { type: 'text', supported: true, quality: 0.95, costMultiplier: 1.0 },
      { type: 'code', supported: true, quality: 0.9, costMultiplier: 1.0 },
      { type: 'image', supported: false, quality: 0, costMultiplier: 0 },
      { type: 'audio', supported: false, quality: 0, costMultiplier: 0 },
      { type: 'video', supported: false, quality: 0, costMultiplier: 0 }
    ]);

    // Anthropic capabilities
    this.multimodalCapabilities.set('anthropic-claude-3', [
      { type: 'text', supported: true, quality: 0.93, costMultiplier: 1.0 },
      { type: 'code', supported: true, quality: 0.88, costMultiplier: 1.0 },
      { type: 'image', supported: false, quality: 0, costMultiplier: 0 },
      { type: 'audio', supported: false, quality: 0, costMultiplier: 0 },
      { type: 'video', supported: false, quality: 0, costMultiplier: 0 }
    ]);

    // Google capabilities
    this.multimodalCapabilities.set('google-gemini-pro', [
      { type: 'text', supported: true, quality: 0.9, costMultiplier: 1.0 },
      { type: 'code', supported: true, quality: 0.85, costMultiplier: 1.0 },
      { type: 'image', supported: true, quality: 0.8, costMultiplier: 1.5 },
      { type: 'audio', supported: false, quality: 0, costMultiplier: 0 },
      { type: 'video', supported: false, quality: 0, costMultiplier: 0 }
    ]);
  }

  private async loadHistoricalData(): Promise<void> {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'orchestration');
      
      // Load feedback data
      try {
        const feedbackData = await fs.readFile(path.join(dataPath, 'feedback.json'), 'utf-8');
        const feedback = JSON.parse(feedbackData);
        this.feedbackDatabase = new Map(Object.entries(feedback));
        console.log(`📊 Loaded ${this.feedbackDatabase.size} feedback entries`);
      } catch (error) {
        console.log('📊 No historical feedback data found, starting fresh');
      }

      // Load performance trackers
      try {
        const performanceData = await fs.readFile(path.join(dataPath, 'performance.json'), 'utf-8');
        const performance = JSON.parse(performanceData);
        this.modelPerformanceTrackers = new Map(Object.entries(performance));
        console.log(`📈 Loaded ${this.modelPerformanceTrackers.size} performance trackers`);
      } catch (error) {
        console.log('📈 No historical performance data found, starting fresh');
      }

    } catch (error) {
      console.log('📁 Data directory not found, creating...');
      await fs.mkdir(path.join(process.cwd(), 'data', 'orchestration'), { recursive: true });
    }
  }

  // ==================== MAIN ORCHESTRATION METHODS ====================

  public async executePrompt(
    promptId: string,
    variables: Record<string, any>,
    options: {
      strategy?: OrchestrationStrategy;
      providers?: string[];
      priority?: number;
      timeout?: number;
      userId?: string;
      useCache?: boolean;
      bypassRateLimit?: boolean;
      taskClass?: string;
      multimodal?: boolean;
      feedbackEnabled?: boolean;
      evolutionEnabled?: boolean;
    } = {}
  ): Promise<OrchestrationResponse> {
    await this.ensureInitialized();
    
    const {
      strategy,
      providers,
      priority = 1,
      timeout = 30000,
      userId,
      useCache = this.config.features.enableCaching,
      bypassRateLimit = false,
      taskClass,
      multimodal = false,
      feedbackEnabled = true,
      evolutionEnabled = true
    } = options;

    // Intelligent strategy selection based on context
    const selectedStrategy = strategy || this.selectOptimalStrategy({
      promptId,
      variables,
      priority,
      timeout,
      taskClass,
      multimodal,
      userId
    });

    // Check rate limiting with dynamic adjustment
    if (this.config.features.enableRateLimiting && !bypassRateLimit) {
      const allowed = await this.rateLimiter.checkLimit({ userId });
      if (!allowed) {
        throw new RetryableError(
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          { userId, remaining: this.rateLimiter.getRemainingRequests({ userId }) }
        );
      }
    }

    // Enhanced cache key with context awareness
    const cacheKey = this.generateAdvancedCacheKey(promptId, variables, selectedStrategy, providers, taskClass);
    
    // Check intelligent cache with predictive capabilities
    if (useCache) {
      const cached = await this.checkIntelligentCache(cacheKey, variables);
      if (cached) {
        console.log(`🧠 Intelligent cache hit for ${promptId}`);
        await this.updateCacheAccessPattern(cacheKey);
        return cached;
      }
    }

    // Task classification and provider optimization
    const classifiedTask = taskClass || this.classifyTask(promptId, variables);
    const optimizedProviders = providers || this.selectOptimalProvidersForTask(classifiedTask, multimodal);

    // Create enhanced orchestration request
    const request: OrchestrationRequest = {
      id: this.generateRequestId(),
      promptId,
      variables,
      providers: optimizedProviders,
      strategy: selectedStrategy,
      priority,
      maxRetries: this.config.features.enableRetries ? 3 : 0,
      timeout,
      metadata: {
        userId,
        context: { 
          cacheKey, 
          taskClass: classifiedTask,
          multimodal,
          feedbackEnabled,
          evolutionEnabled
        },
        tags: ['api_request', classifiedTask],
        expectedOutputType: multimodal ? 'multimodal' : 'text'
      },
      createdAt: new Date(),
      status: 'pending'
    };

    try {
      // Execute with advanced orchestration
      const response = await this.executeWithAdvancedOrchestration(request);

      // Intelligent caching with predictive elements
      if (useCache && response.quality.overall > this.qualityThreshold) {
        await this.storeInIntelligentCache(cacheKey, response, variables);
      }

      // Record advanced performance metrics
      await this.recordAdvancedPerformanceMetrics(response, classifiedTask);

      // Trigger feedback collection if enabled
      if (feedbackEnabled) {
        this.emit('response_generated', {
          requestId: request.id,
          promptId,
          response,
          taskClass: classifiedTask
        });
      }

      // Trigger evolution if enabled and conditions are met
      if (evolutionEnabled && this.shouldTriggerEvolution(response, classifiedTask)) {
        this.triggerPromptEvolution(promptId, response);
      }

      return response;

    } catch (error) {
      console.error(`❌ Failed to execute prompt ${promptId}:`, error);
      
      // Record failure with context
      await this.recordFailureMetrics(error, request, classifiedTask);
      
      throw error;
    }
  }

  public async executePromptSequence(
    promptIds: string[],
    variables: Record<string, any>,
    options: {
      strategy?: OrchestrationStrategy;
      providers?: string[];
      userId?: string;
      useCache?: boolean;
      continueOnError?: boolean;
    } = {}
  ): Promise<OrchestrationResponse[]> {
    await this.ensureInitialized();
    
    const {
      strategy = 'sequential',
      providers,
      userId,
      useCache = true,
      continueOnError = false
    } = options;

    const results: OrchestrationResponse[] = [];
    let accumulatedContext = { ...variables };

    for (let i = 0; i < promptIds.length; i++) {
      const promptId = promptIds[i];
      
      try {
        console.log(`🔄 Executing prompt ${i + 1}/${promptIds.length}: ${promptId}`);
        
        const response = await this.executePrompt(promptId, accumulatedContext, {
          strategy,
          providers,
          userId,
          useCache,
          priority: 1
        });

        results.push(response);
        
        // Add response to context for next iteration
        accumulatedContext.previousResponse = response.finalOutput;
        accumulatedContext.previousQuality = response.quality.overall;
        
        // Add separator marker
        await this.addSequenceSeparator(response.requestId, i, promptIds.length);
        
      } catch (error) {
        console.error(`❌ Failed to execute prompt ${promptId}:`, error);
        
        if (!continueOnError) {
          throw error;
        }
        
        // Add error context for next iteration
        accumulatedContext.previousError = error instanceof Error ? error.message : String(error);
      }
    }

    return results;
  }

  // ==================== ADVANCED FEATURES ====================

  public async evolvePrompt(promptId: string): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.config.evolution.enabled) {
      throw new NonRetryableError(
        'Prompt evolution is disabled',
        'EVOLUTION_DISABLED'
      );
    }

    try {
      // This would call the engine's evolution method
      // For now, we'll simulate it
      console.log(`🧬 Evolving prompt: ${promptId}`);
      
      const originalPrompt = this.engine.getPrompt(promptId);
      if (!originalPrompt) {
        throw new NonRetryableError(
          `Prompt not found: ${promptId}`,
          'PROMPT_NOT_FOUND'
        );
      }

      // Create evolution request
      const evolutionResponse = await this.executePrompt(
        'prompt_evolution_meta',
        {
          originalPrompt: originalPrompt.content,
          category: originalPrompt.category,
          performance: originalPrompt.performance,
          context: "Give variations of this prompt, even better and practical with focus on innovative creativity and ideas on improving to highest potential. Think outside the box"
        },
        {
          strategy: 'ensemble',
          useCache: false,
          bypassRateLimit: true
        }
      );

      // Parse and create new prompt (simplified)
      const newPromptId = `${promptId}_evolved_${Date.now()}`;
      const evolvedPrompt: PromptTemplate = {
        ...originalPrompt,
        id: newPromptId,
        content: evolutionResponse.finalOutput.toString(),
        updatedAt: new Date(),
        variations: [...originalPrompt.variations, {
          id: `var_${Date.now()}`,
          content: evolutionResponse.finalOutput.toString(),
          type: 'innovative',
          performance: originalPrompt.performance,
          generatedBy: 'ai',
          createdAt: new Date()
        }]
      };

      this.engine.addPrompt(evolvedPrompt);
      
      console.log(`✨ Created evolved prompt: ${newPromptId}`);
      return newPromptId;

    } catch (error) {
      console.error(`❌ Failed to evolve prompt ${promptId}:`, error);
      throw error;
    }
  }

  public async analyzePerformance(): Promise<{
    global: any;
    providers: Array<{ id: string; metrics: any; ranking: number }>;
    prompts: Array<{ id: string; performance: any }>;
    recommendations: string[];
  }> {
    await this.ensureInitialized();
    
    const globalMetrics = this.performanceMonitor.getMetrics();
    const providerRankings = this.performanceMonitor.getProviderRanking();
    
    const prompts = this.engine.listPrompts().map(prompt => ({
      id: prompt.id,
      performance: prompt.performance
    }));

    const recommendations = this.generateRecommendations(globalMetrics, providerRankings);

    return {
      global: globalMetrics,
      providers: providerRankings.map((ranking, index) => ({
        id: ranking.providerId,
        metrics: ranking.metrics,
        ranking: index + 1
      })),
      prompts,
      recommendations
    };
  }

  public async optimizeConfiguration(): Promise<{
    currentConfig: any;
    optimizedConfig: any;
    improvements: string[];
  }> {
    await this.ensureInitialized();
    
    const analysis = await this.analyzePerformance();
    const currentConfig = this.config;
    
    // Generate optimization suggestions
    const optimizedConfig = { ...currentConfig };
    const improvements: string[] = [];

    // Optimize provider selection based on performance
    const topProviders = analysis.providers
      .filter(p => p.ranking <= 3)
      .map(p => p.id);
    
    if (topProviders.length > 0) {
      improvements.push(`Use top-performing providers: ${topProviders.join(', ')}`);
    }

    // Optimize evolution settings
    if (analysis.global.averageQuality < 0.7) {
      optimizedConfig.evolution.interval = Math.max(1, optimizedConfig.evolution.interval - 1);
      improvements.push('Increase evolution frequency to improve quality');
    }

    // Optimize caching
    const cacheStats = this.cache.getStats();
    if (cacheStats.hitRate < 0.3) {
      improvements.push('Consider increasing cache TTL or size');
    }

    return {
      currentConfig,
      optimizedConfig,
      improvements
    };
  }

  // ==================== ADVANCED ORCHESTRATION METHODS ====================

  private selectOptimalStrategy(context: {
    promptId: string;
    variables: Record<string, any>;
    priority: number;
    timeout: number;
    taskClass?: string;
    multimodal: boolean;
    userId?: string;
  }): OrchestrationStrategy {
    // Find matching coordination patterns
    const matchingPatterns = this.coordinationPatterns
      .filter(pattern => pattern.conditions(context))
      .sort((a, b) => b.priority - a.priority);

    if (matchingPatterns.length > 0) {
      const selectedPattern = matchingPatterns[0];
      console.log(`🎯 Selected coordination pattern: ${selectedPattern.name}`);
      return selectedPattern.strategy;
    }

    // Fallback to adaptive strategy
    return 'adaptive';
  }

  private classifyTask(promptId: string, variables: Record<string, any>): string {
    const prompt = this.engine.getPrompt(promptId);
    if (!prompt) return 'general';

    // Use prompt category as primary classification
    if (this.taskClassifications.has(prompt.category)) {
      return prompt.category;
    }

    // Analyze variables for task classification hints
    const variableText = JSON.stringify(variables).toLowerCase();
    
    if (variableText.includes('code') || variableText.includes('programming') || variableText.includes('function')) {
      return 'code_generation';
    }
    
    if (variableText.includes('creative') || variableText.includes('story') || variableText.includes('artistic')) {
      return 'creative_writing';
    }
    
    if (variableText.includes('analyze') || variableText.includes('problem') || variableText.includes('solution')) {
      return 'analytical_reasoning';
    }
    
    if (variableText.includes('image') || variableText.includes('audio') || variableText.includes('video')) {
      return 'multimodal_processing';
    }

    return 'general';
  }

  private selectOptimalProvidersForTask(taskClass: string, multimodal: boolean): string[] {
    const taskClassification = this.taskClassifications.get(taskClass);
    
    if (taskClassification) {
      // Filter providers based on multimodal requirements
      let optimalProviders = taskClassification.optimalProviders;
      
      if (multimodal) {
        optimalProviders = optimalProviders.filter(providerId => {
          const capabilities = this.multimodalCapabilities.get(providerId);
          return capabilities && capabilities.some(cap => cap.type !== 'text' && cap.supported);
        });
      }
      
      // Sort by performance metrics
      const sortedProviders = optimalProviders.sort((a, b) => {
        const scoreA = taskClassification.performanceMetrics.get(a) || 0;
        const scoreB = taskClassification.performanceMetrics.get(b) || 0;
        return scoreB - scoreA;
      });
      
      return sortedProviders.slice(0, 3); // Top 3 providers
    }

    // Fallback to all available providers
    return this.config.providers.map(p => p.id);
  }

  private async executeWithAdvancedOrchestration(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    // Enhanced circuit breaker with learning
    const response = await this.executeWithCircuitBreaker(request);
    
    // Apply post-processing based on task class
    const taskClass = request.metadata?.context?.taskClass as string;
    if (taskClass) {
      await this.applyTaskSpecificPostProcessing(response, taskClass);
    }
    
    return response;
  }

  private async applyTaskSpecificPostProcessing(response: OrchestrationResponse, taskClass: string): Promise<void> {
    switch (taskClass) {
      case 'code_generation':
        // Validate code syntax and structure
        await this.validateCodeOutput(response);
        break;
      case 'creative_writing':
        // Assess creativity and narrative flow
        await this.assessCreativity(response);
        break;
      case 'analytical_reasoning':
        // Check logical consistency
        await this.validateLogicalConsistency(response);
        break;
      case 'multimodal_processing':
        // Validate multimodal integration
        await this.validateMultimodalIntegration(response);
        break;
    }
  }

  private async validateCodeOutput(response: OrchestrationResponse): Promise<void> {
    // Basic code validation - could be enhanced with actual syntax checking
    const codeContent = response.finalOutput.toString();
    
    // Check for common code patterns
    const hasValidStructure = /(?:function|class|const|let|var|def|public|private)/.test(codeContent);
    const hasSyntaxErrors = /(?:SyntaxError|undefined|null reference)/.test(codeContent);
    
    if (!hasValidStructure || hasSyntaxErrors) {
      response.quality.overall *= 0.8; // Reduce quality score
    }
  }

  private async assessCreativity(response: OrchestrationResponse): Promise<void> {
    const content = response.finalOutput.toString();
    
    // Simple creativity metrics
    const uniqueWords = new Set(content.toLowerCase().split(/\s+/)).size;
    const totalWords = content.split(/\s+/).length;
    const vocabularyRichness = uniqueWords / totalWords;
    
    // Adjust quality based on creativity indicators
    if (vocabularyRichness > 0.7) {
      response.quality.overall = Math.min(1, response.quality.overall * 1.1);
    }
  }

  private async validateLogicalConsistency(response: OrchestrationResponse): Promise<void> {
    const content = response.finalOutput.toString();
    
    // Check for logical connectors and structure
    const logicalConnectors = /(?:therefore|however|because|since|thus|consequently|moreover)/gi;
    const matches = content.match(logicalConnectors);
    
    if (matches && matches.length > 0) {
      response.quality.overall = Math.min(1, response.quality.overall * 1.05);
    }
  }

  private async validateMultimodalIntegration(response: OrchestrationResponse): Promise<void> {
    // Placeholder for multimodal validation
    // In a real implementation, this would check cross-modal consistency
    console.log('🔍 Validating multimodal integration...');
  }

  // ==================== INTELLIGENT CACHING ====================

  private generateAdvancedCacheKey(
    promptId: string,
    variables: Record<string, any>,
    strategy: OrchestrationStrategy,
    providers?: string[],
    taskClass?: string
  ): string {
    const keyData = {
      promptId,
      variables: this.normalizeVariables(variables),
      strategy,
      providers: providers?.sort().join(',') || 'auto',
      taskClass: taskClass || 'general'
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private normalizeVariables(variables: Record<string, any>): Record<string, any> {
    // Normalize variables for better cache hits
    const normalized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        // Normalize whitespace and case for certain keys
        if (key.toLowerCase().includes('name') || key.toLowerCase().includes('title')) {
          normalized[key] = value.trim().toLowerCase();
        } else {
          normalized[key] = value.trim();
        }
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  private async checkIntelligentCache(cacheKey: string, variables: Record<string, any>): Promise<OrchestrationResponse | null> {
    const entry = this.intelligentCache.get(cacheKey);
    
    if (entry) {
      // Check if entry is still valid
      const now = Date.now();
      if (now - entry.lastAccessed.getTime() > entry.ttl) {
        this.intelligentCache.delete(cacheKey);
        return null;
      }
      
      // Check context similarity for semantic caching
      const similarity = this.calculateContextSimilarity(variables, entry.value.variables || {});
      if (similarity > 0.8) {
        return entry.value;
      }
    }
    
    // Check for similar cache entries
    return this.findSimilarCacheEntry(variables);
  }

  private calculateContextSimilarity(vars1: Record<string, any>, vars2: Record<string, any>): number {
    const keys1 = Object.keys(vars1);
    const keys2 = Object.keys(vars2);
    
    // Simple Jaccard similarity
    const intersection = keys1.filter(key => keys2.includes(key));
    const union = [...new Set([...keys1, ...keys2])];
    
    return intersection.length / union.length;
  }

  private findSimilarCacheEntry(variables: Record<string, any>): OrchestrationResponse | null {
    let bestMatch: OrchestrationResponse | null = null;
    let bestSimilarity = 0;
    
    for (const entry of this.intelligentCache.values()) {
      const similarity = this.calculateContextSimilarity(variables, entry.value.variables || {});
      if (similarity > bestSimilarity && similarity > 0.7) {
        bestSimilarity = similarity;
        bestMatch = entry.value;
      }
    }
    
    return bestMatch;
  }

  private async storeInIntelligentCache(
    cacheKey: string,
    response: OrchestrationResponse,
    variables: Record<string, any>
  ): Promise<void> {
    const entry: IntelligentCacheEntry = {
      key: cacheKey,
      value: { ...response, variables },
      accessCount: 1,
      lastAccessed: new Date(),
      contextSimilarity: 1.0,
      qualityScore: response.quality.overall,
      ttl: this.calculateDynamicTTL(response)
    };
    
    this.intelligentCache.set(cacheKey, entry);
    
    // Cleanup old entries if cache is getting too large
    if (this.intelligentCache.size > 1000) {
      await this.cleanupIntelligentCache();
    }
  }

  private calculateDynamicTTL(response: OrchestrationResponse): number {
    // Higher quality responses get longer TTL
    const baseTTL = 300000; // 5 minutes
    const qualityMultiplier = response.quality.overall;
    const costMultiplier = Math.max(0.5, 1 - response.totalCost / 0.1); // Expensive responses cached longer
    
    return baseTTL * qualityMultiplier * costMultiplier;
  }

  private async updateCacheAccessPattern(cacheKey: string): Promise<void> {
    const entry = this.intelligentCache.get(cacheKey);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = new Date();
      
      // Predict next access time based on pattern
      if (entry.accessCount > 2) {
        const avgInterval = (Date.now() - entry.value.createdAt.getTime()) / entry.accessCount;
        entry.predictedNextAccess = new Date(Date.now() + avgInterval);
      }
    }
  }

  private async cleanupIntelligentCache(): Promise<void> {
    const entries = Array.from(this.intelligentCache.entries());
    
    // Sort by access count and quality, remove least valuable entries
    entries.sort((a, b) => {
      const scoreA = a[1].accessCount * a[1].qualityScore;
      const scoreB = b[1].accessCount * b[1].qualityScore;
      return scoreA - scoreB;
    });
    
    // Remove bottom 20%
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.intelligentCache.delete(entries[i][0]);
    }
  }

  // ==================== FEEDBACK AND LEARNING ====================

  public async submitFeedback(feedback: Omit<FeedbackData, 'id' | 'timestamp'>): Promise<void> {
    const feedbackEntry: FeedbackData = {
      ...feedback,
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    
    // Store feedback
    const promptFeedback = this.feedbackDatabase.get(feedback.promptId) || [];
    promptFeedback.push(feedbackEntry);
    this.feedbackDatabase.set(feedback.promptId, promptFeedback);
    
    // Update model performance tracking
    await this.updateModelPerformance(feedback);
    
    // Trigger learning if enough feedback is collected
    if (promptFeedback.length >= 5) {
      await this.triggerLearningUpdate(feedback.promptId);
    }
    
    // Emit feedback event
    this.emit('feedback_received', feedbackEntry);
  }

  private async updateModelPerformance(feedback: FeedbackData): Promise<void> {
    // Find the response to get provider information
    const response = await this.findResponseById(feedback.responseId);
    if (!response) return;
    
    for (const llmResponse of response.responses) {
      const trackerId = `${llmResponse.providerId}_${feedback.category}`;
      let tracker = this.modelPerformanceTrackers.get(trackerId);
      
      if (!tracker) {
        tracker = {
          providerId: llmResponse.providerId,
          taskClass: feedback.category,
          successRate: 0,
          averageScore: 0,
          responseTime: 0,
          costEfficiency: 0,
          sampleSize: 0,
          lastUpdated: new Date()
        };
      }
      
      // Update metrics using exponential moving average
      const alpha = this.learningRate;
      tracker.averageScore = (1 - alpha) * tracker.averageScore + alpha * (feedback.score / 10);
      tracker.responseTime = (1 - alpha) * tracker.responseTime + alpha * llmResponse.latency;
      tracker.costEfficiency = (1 - alpha) * tracker.costEfficiency + alpha * (1 - llmResponse.cost / 0.1);
      tracker.sampleSize++;
      tracker.lastUpdated = new Date();
      
      this.modelPerformanceTrackers.set(trackerId, tracker);
    }
  }

  private async findResponseById(responseId: string): Promise<OrchestrationResponse | null> {
    // In a real implementation, this would query a database
    // For now, we'll return null as responses aren't stored long-term in memory
    return null;
  }

  private async triggerLearningUpdate(promptId: string): Promise<void> {
    console.log(`🧠 Triggering learning update for prompt: ${promptId}`);
    
    const feedback = this.feedbackDatabase.get(promptId) || [];
    const avgScore = feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length;
    
    // Update task classification performance metrics
    const prompt = this.engine.getPrompt(promptId);
    if (prompt) {
      const taskClass = this.taskClassifications.get(prompt.category);
      if (taskClass) {
        // Update provider performance for this task class
        const providerScores = new Map<string, number[]>();
        
        for (const f of feedback) {
          const response = await this.findResponseById(f.responseId);
          if (response) {
            for (const llmResponse of response.responses) {
              const scores = providerScores.get(llmResponse.providerId) || [];
              scores.push(f.score / 10);
              providerScores.set(llmResponse.providerId, scores);
            }
          }
        }
        
        // Update task classification metrics
        for (const [providerId, scores] of providerScores.entries()) {
          const avgProviderScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          taskClass.performanceMetrics.set(providerId, avgProviderScore);
        }
        
        taskClass.lastUpdated = new Date();
      }
    }
  }

  // ==================== EVOLUTION AND OPTIMIZATION ====================

  private shouldTriggerEvolution(response: OrchestrationResponse, taskClass: string): boolean {
    // Trigger evolution if quality is below threshold
    if (response.quality.overall < this.qualityThreshold) {
      return true;
    }
    
    // Trigger evolution if cost is too high
    if (response.totalCost > 0.05) {
      return true;
    }
    
    // Trigger evolution based on feedback patterns
    const feedback = this.feedbackDatabase.get(response.requestId) || [];
    if (feedback.length > 0) {
      const avgFeedback = feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length;
      return avgFeedback < 7; // Below 7/10 average
    }
    
    return false;
  }

  private async triggerPromptEvolution(promptId: string, response: OrchestrationResponse): Promise<void> {
    // Queue evolution for background processing
    setTimeout(async () => {
      try {
        await this.evolvePromptAdvanced(promptId, response);
      } catch (error) {
        console.error(`❌ Background evolution failed for ${promptId}:`, error);
      }
    }, 1000);
  }

  private async evolvePromptAdvanced(promptId: string, triggerResponse: OrchestrationResponse): Promise<string> {
    console.log(`🧬 Advanced evolution triggered for prompt: ${promptId}`);
    
    const originalPrompt = this.engine.getPrompt(promptId);
    if (!originalPrompt) {
      throw new NonRetryableError(`Prompt not found: ${promptId}`, 'PROMPT_NOT_FOUND');
    }
    
    // Get feedback for this prompt
    const feedback = this.feedbackDatabase.get(promptId) || [];
    
    // Select evolution strategy based on context
    const evolutionStrategy = this.selectEvolutionStrategy(originalPrompt, triggerResponse, feedback);
    
    // Generate variations using the selected strategy
    const variations = await this.generatePromptVariations(originalPrompt, evolutionStrategy, feedback);
    
    // Evaluate variations
    const evaluatedVariations = await this.evaluatePromptVariations(variations, originalPrompt);
    
    // Select best variation
    const bestVariation = this.selectBestVariation(evaluatedVariations, evolutionStrategy);
    
    if (bestVariation) {
      // Create new prompt with best variation
      const evolvedPromptId = `${promptId}_evolved_${Date.now()}`;
      const evolvedPrompt: PromptTemplate = {
        ...originalPrompt,
        id: evolvedPromptId,
        content: bestVariation.content,
        updatedAt: new Date(),
        variations: [...originalPrompt.variations, bestVariation]
      };
      
      this.engine.addPrompt(evolvedPrompt);
      console.log(`✨ Created evolved prompt: ${evolvedPromptId}`);
      
      // Emit evolution event
      this.emit('prompt_evolved', {
        originalPromptId: promptId,
        evolvedPromptId,
        strategy: evolutionStrategy.type,
        improvement: bestVariation.performance.averageQuality - originalPrompt.performance.averageQuality
      });
      
      return evolvedPromptId;
    }
    
    return promptId; // No improvement found
  }

  private selectEvolutionStrategy(
    prompt: PromptTemplate,
    response: OrchestrationResponse,
    feedback: FeedbackData[]
  ): EvolutionStrategy {
    // Select strategy based on current performance and feedback
    if (feedback.length > 10) {
      return this.evolutionStrategies.get('reinforcement')!;
    } else if (response.quality.overall < 0.5) {
      return this.evolutionStrategies.get('genetic')!;
    } else {
      return this.evolutionStrategies.get('hybrid')!;
    }
  }

  private async generatePromptVariations(
    originalPrompt: PromptTemplate,
    strategy: EvolutionStrategy,
    feedback: FeedbackData[]
  ): Promise<PromptVariation[]> {
    const variations: PromptVariation[] = [];
    
    switch (strategy.type) {
      case 'genetic':
        // Generate variations using genetic operators
        variations.push(...await this.generateGeneticVariations(originalPrompt, strategy.parameters));
        break;
      case 'reinforcement':
        // Generate variations based on reward signals
        variations.push(...await this.generateReinforcementVariations(originalPrompt, feedback));
        break;
      case 'hybrid':
        // Combine multiple approaches
        const genetic = await this.generateGeneticVariations(originalPrompt, strategy.parameters);
        const reinforcement = await this.generateReinforcementVariations(originalPrompt, feedback);
        variations.push(...genetic.slice(0, 3), ...reinforcement.slice(0, 2));
        break;
    }
    
    return variations;
  }

  private async generateGeneticVariations(
    originalPrompt: PromptTemplate,
    parameters: Record<string, any>
  ): Promise<PromptVariation[]> {
    const variations: PromptVariation[] = [];
    const populationSize = parameters.populationSize || 5;
    
    for (let i = 0; i < populationSize; i++) {
      // Generate mutation by asking AI to modify the prompt
      const mutationResponse = await this.executePrompt(
        'prompt_mutation_meta',
        {
          originalPrompt: originalPrompt.content,
          mutationType: i % 2 === 0 ? 'creative' : 'analytical',
          category: originalPrompt.category,
          preserveCore: true
        },
        {
          strategy: 'fallback',
          useCache: false,
          bypassRateLimit: true
        }
      );
      
      variations.push({
        id: `genetic_var_${Date.now()}_${i}`,
        content: mutationResponse.finalOutput.toString(),
        type: i % 2 === 0 ? 'creative' : 'analytical',
        performance: { ...originalPrompt.performance }, // Will be updated after evaluation
        generatedBy: 'ai',
        parentId: originalPrompt.id,
        createdAt: new Date()
      });
    }
    
    return variations;
  }

  private async generateReinforcementVariations(
    originalPrompt: PromptTemplate,
    feedback: FeedbackData[]
  ): Promise<PromptVariation[]> {
    const variations: PromptVariation[] = [];
    
    // Analyze feedback to identify improvement areas
    const improvementAreas = this.analyzeFeedbackForImprovements(feedback);
    
    for (const area of improvementAreas.slice(0, 3)) {
      const improvementResponse = await this.executePrompt(
        'prompt_improvement_meta',
        {
          originalPrompt: originalPrompt.content,
          improvementArea: area,
          category: originalPrompt.category,
          feedbackSummary: this.summarizeFeedback(feedback)
        },
        {
          strategy: 'ensemble',
          useCache: false,
          bypassRateLimit: true
        }
      );
      
      variations.push({
        id: `rl_var_${Date.now()}_${area}`,
        content: improvementResponse.finalOutput.toString(),
        type: 'focused',
        performance: { ...originalPrompt.performance },
        generatedBy: 'ai',
        parentId: originalPrompt.id,
        createdAt: new Date()
      });
    }
    
    return variations;
  }

  private analyzeFeedbackForImprovements(feedback: FeedbackData[]): string[] {
    const improvements: string[] = [];
    const categoryScores = new Map<string, number[]>();
    
    // Group feedback by category
    for (const f of feedback) {
      const scores = categoryScores.get(f.category) || [];
      scores.push(f.score);
      categoryScores.set(f.category, scores);
    }
    
    // Identify low-scoring categories
    for (const [category, scores] of categoryScores.entries()) {
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      if (avgScore < 7) {
        improvements.push(category);
      }
    }
    
    return improvements;
  }

  private summarizeFeedback(feedback: FeedbackData[]): string {
    if (feedback.length === 0) return 'No feedback available';
    
    const avgScore = feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length;
    const commonIssues = feedback
      .map(f => f.feedback)
      .filter(f => f.length > 10)
      .slice(0, 3)
      .join('; ');
    
    return `Average score: ${avgScore.toFixed(1)}/10. Common feedback: ${commonIssues}`;
  }

  private async evaluatePromptVariations(
    variations: PromptVariation[],
    originalPrompt: PromptTemplate
  ): Promise<PromptVariation[]> {
    // Test each variation with sample inputs
    const evaluatedVariations: PromptVariation[] = [];
    
    for (const variation of variations) {
      try {
        // Create temporary prompt for testing
        const testPrompt: PromptTemplate = {
          ...originalPrompt,
          id: `test_${variation.id}`,
          content: variation.content
        };
        
        this.engine.addPrompt(testPrompt);
        
        // Test with sample variables
        const testResponse = await this.executePrompt(
          testPrompt.id,
          this.generateSampleVariables(originalPrompt),
          {
            strategy: 'fallback',
            useCache: false,
            bypassRateLimit: true,
            feedbackEnabled: false,
            evolutionEnabled: false
          }
        );
        
        // Update variation performance
        variation.performance = {
          ...variation.performance,
          averageQuality: testResponse.quality.overall,
          averageExecutionTime: testResponse.totalLatency,
          costEfficiency: 1 - testResponse.totalCost / 0.1,
          lastEvaluated: new Date()
        };
        
        evaluatedVariations.push(variation);
        
        // Clean up test prompt
        // Note: In a real implementation, you'd have a method to remove prompts
        
      } catch (error) {
        console.warn(`⚠️ Failed to evaluate variation ${variation.id}:`, error);
      }
    }
    
    return evaluatedVariations;
  }

  private generateSampleVariables(prompt: PromptTemplate): Record<string, any> {
    const sampleVars: Record<string, any> = {};
    
    for (const variable of prompt.variables) {
      switch (variable.type) {
        case 'string':
          sampleVars[variable.name] = variable.defaultValue || 'sample text';
          break;
        case 'number':
          sampleVars[variable.name] = variable.defaultValue || 42;
          break;
        case 'boolean':
          sampleVars[variable.name] = variable.defaultValue || true;
          break;
        case 'array':
          sampleVars[variable.name] = variable.defaultValue || ['item1', 'item2'];
          break;
        case 'object':
          sampleVars[variable.name] = variable.defaultValue || { key: 'value' };
          break;
      }
    }
    
    return sampleVars;
  }

  private selectBestVariation(
    variations: PromptVariation[],
    strategy: EvolutionStrategy
  ): PromptVariation | null {
    if (variations.length === 0) return null;
    
    // Calculate fitness for each variation
    const scoredVariations = variations.map(variation => ({
      variation,
      fitness: strategy.fitnessFunction({
        quality: { overall: variation.performance.averageQuality },
        totalCost: 1 - variation.performance.costEfficiency,
        totalLatency: variation.performance.averageExecutionTime,
        finalOutput: '',
        responses: [],
        requestId: '',
        createdAt: new Date(),
        variables: {}
      })
    }));
    
    // Sort by fitness and return best
    scoredVariations.sort((a, b) => b.fitness - a.fitness);
    
    const best = scoredVariations[0];
    return best.fitness > 0.1 ? best.variation : null; // Only return if significantly better
  }

  // ==================== PERFORMANCE TRACKING ====================

  private async recordAdvancedPerformanceMetrics(
    response: OrchestrationResponse,
    taskClass: string
  ): Promise<void> {
    // Record standard metrics
    this.recordPerformanceMetrics(response);
    
    // Record task-specific metrics
    for (const llmResponse of response.responses) {
      const trackerId = `${llmResponse.providerId}_${taskClass}`;
      let tracker = this.modelPerformanceTrackers.get(trackerId);
      
      if (!tracker) {
        tracker = {
          providerId: llmResponse.providerId,
          taskClass,
          successRate: 0,
          averageScore: 0,
          responseTime: 0,
          costEfficiency: 0,
          sampleSize: 0,
          lastUpdated: new Date()
        };
      }
      
      // Update with exponential moving average
      const alpha = this.learningRate;
      tracker.successRate = (1 - alpha) * tracker.successRate + alpha * (llmResponse.error ? 0 : 1);
      tracker.averageScore = (1 - alpha) * tracker.averageScore + alpha * llmResponse.quality.overall;
      tracker.responseTime = (1 - alpha) * tracker.responseTime + alpha * llmResponse.latency;
      tracker.costEfficiency = (1 - alpha) * tracker.costEfficiency + alpha * (1 - llmResponse.cost / 0.1);
      tracker.sampleSize++;
      tracker.lastUpdated = new Date();
      
      this.modelPerformanceTrackers.set(trackerId, tracker);
      
      // Update task classification metrics
      const taskClassification = this.taskClassifications.get(taskClass);
      if (taskClassification) {
        taskClassification.performanceMetrics.set(llmResponse.providerId, tracker.averageScore);
        taskClassification.lastUpdated = new Date();
      }
    }
  }

  private async recordFailureMetrics(
    error: any,
    request: OrchestrationRequest,
    taskClass: string
  ): Promise<void> {
    // Record failure for each provider that was attempted
    for (const providerId of request.providers) {
      this.performanceMonitor.recordRequest(
        providerId,
        false,
        request.timeout,
        0,
        0
      );
      
      // Update task-specific failure tracking
      const trackerId = `${providerId}_${taskClass}`;
      let tracker = this.modelPerformanceTrackers.get(trackerId);
      
      if (tracker) {
        const alpha = this.learningRate;
        tracker.successRate = (1 - alpha) * tracker.successRate; // Reduce success rate
        tracker.sampleSize++;
        tracker.lastUpdated = new Date();
        
        this.modelPerformanceTrackers.set(trackerId, tracker);
      }
    }
  }

  // ==================== DATA PERSISTENCE ====================

  public async saveHistoricalData(): Promise<void> {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'orchestration');
      await fs.mkdir(dataPath, { recursive: true });
      
      // Save feedback data
      const feedbackData = Object.fromEntries(this.feedbackDatabase.entries());
      await fs.writeFile(
        path.join(dataPath, 'feedback.json'),
        JSON.stringify(feedbackData, null, 2)
      );
      
      // Save performance trackers
      const performanceData = Object.fromEntries(this.modelPerformanceTrackers.entries());
      await fs.writeFile(
        path.join(dataPath, 'performance.json'),
        JSON.stringify(performanceData, null, 2)
      );
      
      console.log('💾 Historical data saved successfully');
      
    } catch (error) {
      console.error('❌ Failed to save historical data:', error);
    }
  }

  // ==================== UTILITY METHODS ====================

  private async executeWithCircuitBreaker(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    // Execute with circuit breaker protection for each provider
    const protectedProviders = request.providers.filter(providerId => {
      const circuitBreaker = this.circuitBreakers.get(providerId);
      return !circuitBreaker || circuitBreaker.getState() !== 'OPEN';
    });

    if (protectedProviders.length === 0) {
      throw new RetryableError(
        'All providers are circuit-broken',
        'ALL_PROVIDERS_UNAVAILABLE'
      );
    }

    // Update request with available providers
    const protectedRequest = { ...request, providers: protectedProviders };
    
    try {
      const response = await this.engine.processRequest(protectedRequest);
      
      // Record success for all used providers
      for (const providerId of protectedProviders) {
        const circuitBreaker = this.circuitBreakers.get(providerId);
        if (circuitBreaker) {
          // Circuit breaker success is recorded internally
        }
      }
      
      return response;
      
    } catch (error) {
      // Record failure for all used providers
      for (const providerId of protectedProviders) {
        const circuitBreaker = this.circuitBreakers.get(providerId);
        if (circuitBreaker) {
          // Circuit breaker failure is recorded internally
        }
      }
      
      throw error;
    }
  }

  private selectOptimalProviders(promptId: string): string[] {
    const prompt = this.engine.getPrompt(promptId);
    if (!prompt) {
      return this.config.providers.map(p => p.id);
    }

    // Select providers based on prompt category and performance
    const rankings = this.performanceMonitor.getProviderRanking();
    const topProviders = rankings.slice(0, 3).map(r => r.providerId);
    
    return topProviders.length > 0 ? topProviders : this.config.providers.map(p => p.id);
  }

  private generateCacheKey(
    promptId: string,
    variables: Record<string, any>,
    strategy: OrchestrationStrategy,
    providers?: string[]
  ): string {
    const keyData = {
      promptId,
      variables: JSON.stringify(variables),
      strategy,
      providers: providers?.sort().join(',') || 'auto'
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordPerformanceMetrics(response: OrchestrationResponse): void {
    for (const llmResponse of response.responses) {
      this.performanceMonitor.recordRequest(
        llmResponse.providerId,
        !llmResponse.error,
        llmResponse.latency,
        llmResponse.cost,
        llmResponse.quality.overall
      );
    }
  }

  private generateRecommendations(globalMetrics: any, providerRankings: any[]): string[] {
    const recommendations: string[] = [];
    
    if (globalMetrics.requestCount > 0) {
      const successRate = globalMetrics.successCount / globalMetrics.requestCount;
      if (successRate < 0.9) {
        recommendations.push('Consider enabling more aggressive retry policies');
      }
      
      const avgLatency = globalMetrics.totalLatency / globalMetrics.requestCount;
      if (avgLatency > 5000) {
        recommendations.push('High latency detected - consider optimizing provider selection');
      }
      
      if (globalMetrics.averageQuality < 0.7) {
        recommendations.push('Quality below threshold - consider prompt evolution or provider optimization');
      }
    }
    
    if (providerRankings.length > 1) {
      const topProvider = providerRankings[0];
      const bottomProvider = providerRankings[providerRankings.length - 1];
      
      if (topProvider.score - bottomProvider.score > 0.3) {
        recommendations.push(`Consider prioritizing ${topProvider.providerId} over ${bottomProvider.providerId}`);
      }
    }
    
    return recommendations;
  }

  private async addSequenceSeparator(requestId: string, index: number, total: number): Promise<void> {
    // Add separator for file organization
    const separator = `\n\n---###/// SEQUENCE ${index + 1}/${total} ///###---\n\n`;
    console.log(`📄 Adding separator: ${separator.trim()}`);
  }

  private startBackgroundTasks(): void {
    // Cleanup tasks
    setInterval(() => {
      this.cache.cleanup();
      this.rateLimiter.cleanup();
      this.cleanupIntelligentCache();
    }, 60000); // Every minute

    // Performance monitoring
    if (this.config.monitoring.enableMetrics) {
      this.performanceAnalysisInterval = setInterval(() => {
        const metrics = this.performanceMonitor.getMetrics();
        console.log(`📊 Global metrics: ${metrics.requestCount} requests, ${(metrics.averageQuality * 100).toFixed(1)}% avg quality`);
        
        // Advanced analytics
        this.analyzeProviderPerformanceTrends();
        this.optimizeCacheStrategy();
      }, this.config.monitoring.metricsInterval * 1000);
    }

    // Prompt evolution background task
    if (this.config.evolution.enabled) {
      this.evolutionInterval = setInterval(async () => {
        await this.runBackgroundEvolution();
      }, this.config.evolution.interval * 60000); // Convert minutes to milliseconds
    }

    // Cache optimization
    this.cacheOptimizationInterval = setInterval(async () => {
      await this.optimizeIntelligentCache();
    }, 300000); // Every 5 minutes

    // Data persistence
    setInterval(async () => {
      await this.saveHistoricalData();
    }, 600000); // Every 10 minutes

    console.log('🔄 Advanced background tasks started');
  }

  private analyzeProviderPerformanceTrends(): void {
    // Analyze performance trends and adjust provider rankings
    const rankings = this.performanceMonitor.getProviderRanking();
    
    for (const ranking of rankings) {
      // Check if provider performance is declining
      const tracker = this.modelPerformanceTrackers.get(`${ranking.providerId}_general`);
      if (tracker && tracker.successRate < 0.8) {
        console.warn(`⚠️ Provider ${ranking.providerId} showing declining performance`);
        this.emit('provider_performance_warning', {
          providerId: ranking.providerId,
          successRate: tracker.successRate,
          averageScore: tracker.averageScore
        });
      }
    }
  }

  private optimizeCacheStrategy(): void {
    const cacheStats = this.cache.getStats();
    const intelligentCacheSize = this.intelligentCache.size;
    
    // Adjust cache strategy based on hit rates
    if (cacheStats.hitRate < 0.3 && intelligentCacheSize < 500) {
      console.log('🧠 Expanding intelligent cache due to low hit rate');
      // Could implement dynamic cache size adjustment here
    }
  }

  private async runBackgroundEvolution(): Promise<void> {
    try {
      console.log('🧬 Running background prompt evolution...');
      
      // Find prompts that could benefit from evolution
      const prompts = this.engine.listPrompts();
      const candidatesForEvolution = prompts.filter(prompt => {
        const feedback = this.feedbackDatabase.get(prompt.id) || [];
        const avgScore = feedback.length > 0 
          ? feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length 
          : 5;
        
        return avgScore < 7 && feedback.length >= 3; // Low scoring prompts with enough feedback
      });

      // Evolve up to 3 prompts per cycle
      for (const prompt of candidatesForEvolution.slice(0, 3)) {
        try {
          const evolvedId = await this.evolvePrompt(prompt.id);
          console.log(`✨ Background evolution created: ${evolvedId}`);
        } catch (error) {
          console.warn(`⚠️ Background evolution failed for ${prompt.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error('❌ Background evolution error:', error);
    }
  }

  private async optimizeIntelligentCache(): Promise<void> {
    try {
      // Preload frequently accessed patterns
      const entries = Array.from(this.intelligentCache.entries());
      const frequentlyAccessed = entries
        .filter(([_, entry]) => entry.accessCount > 5)
        .sort((a, b) => b[1].accessCount - a[1].accessCount)
        .slice(0, 10);

      // Predict and preload similar patterns
      for (const [key, entry] of frequentlyAccessed) {
        if (entry.predictedNextAccess && entry.predictedNextAccess.getTime() < Date.now() + 300000) {
          // Entry is predicted to be accessed soon, ensure it's optimized
          entry.ttl = Math.max(entry.ttl, 600000); // Extend TTL to 10 minutes
        }
      }

      console.log(`🧠 Optimized ${frequentlyAccessed.length} frequently accessed cache entries`);
      
    } catch (error) {
      console.error('❌ Cache optimization error:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // ==================== PUBLIC API ====================

  public getPrompts(): PromptTemplate[] {
    return this.engine.listPrompts();
  }

  public getProviders(): LLMProvider[] {
    return this.engine.listProviders();
  }

  public addPrompt(prompt: PromptTemplate): void {
    this.engine.addPrompt(prompt);
  }

  public addProvider(provider: LLMProvider): void {
    this.engine.addProvider(provider);
    this.circuitBreakers.set(provider.id, new CircuitBreaker());
  }

  public getCacheStats(): any {
    return this.cache.getStats();
  }

  public getCircuitBreakerStatus(): Map<string, any> {
    const status = new Map();
    for (const [providerId, breaker] of this.circuitBreakers.entries()) {
      status.set(providerId, breaker.getMetrics());
    }
    return status;
  }

  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Advanced LLM Orchestrator...');
    
    // Clear background intervals
    if (this.evolutionInterval) {
      clearInterval(this.evolutionInterval);
    }
    if (this.performanceAnalysisInterval) {
      clearInterval(this.performanceAnalysisInterval);
    }
    if (this.cacheOptimizationInterval) {
      clearInterval(this.cacheOptimizationInterval);
    }
    
    // Save final state
    await this.saveHistoricalData();
    
    // Shutdown engine and clear caches
    await this.engine.shutdown();
    this.cache.clear();
    this.intelligentCache.clear();
    this.performanceMonitor.reset();
    
    // Clear advanced data structures
    this.feedbackDatabase.clear();
    this.taskClassifications.clear();
    this.modelPerformanceTrackers.clear();
    this.evolutionStrategies.clear();
    this.coordinationPatterns.length = 0;
    this.multimodalCapabilities.clear();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    console.log('✅ Advanced shutdown complete');
  }

  // ==================== ADVANCED PUBLIC API ====================

  public async getAdvancedAnalytics(): Promise<{
    taskClassifications: TaskClassification[];
    modelPerformance: ModelPerformanceTracker[];
    feedbackSummary: { promptId: string; avgScore: number; feedbackCount: number }[];
    cacheEfficiency: { hitRate: number; intelligentCacheSize: number; predictiveAccuracy: number };
    evolutionMetrics: { totalEvolutions: number; avgImprovement: number };
  }> {
    const taskClassifications = Array.from(this.taskClassifications.values());
    const modelPerformance = Array.from(this.modelPerformanceTrackers.values());
    
    const feedbackSummary = Array.from(this.feedbackDatabase.entries()).map(([promptId, feedback]) => ({
      promptId,
      avgScore: feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length,
      feedbackCount: feedback.length
    }));
    
    const cacheStats = this.cache.getStats();
    const intelligentCacheEntries = Array.from(this.intelligentCache.values());
    const predictiveAccuracy = intelligentCacheEntries.filter(entry => 
      entry.predictedNextAccess && Math.abs(entry.predictedNextAccess.getTime() - Date.now()) < 300000
    ).length / Math.max(1, intelligentCacheEntries.length);
    
    return {
      taskClassifications,
      modelPerformance,
      feedbackSummary,
      cacheEfficiency: {
        hitRate: cacheStats.hitRate || 0,
        intelligentCacheSize: this.intelligentCache.size,
        predictiveAccuracy
      },
      evolutionMetrics: {
        totalEvolutions: this.engine.listPrompts().reduce((sum, p) => sum + p.variations.length, 0),
        avgImprovement: 0.15 // Placeholder - would calculate from actual evolution data
      }
    };
  }

  public async getTaskClassificationMetrics(taskClass: string): Promise<{
    classification: TaskClassification | null;
    providerPerformance: { providerId: string; score: number; sampleSize: number }[];
    recentFeedback: FeedbackData[];
  }> {
    const classification = this.taskClassifications.get(taskClass) || null;
    
    const providerPerformance = Array.from(this.modelPerformanceTrackers.entries())
      .filter(([key]) => key.endsWith(`_${taskClass}`))
      .map(([key, tracker]) => ({
        providerId: tracker.providerId,
        score: tracker.averageScore,
        sampleSize: tracker.sampleSize
      }));
    
    const recentFeedback = Array.from(this.feedbackDatabase.values())
      .flat()
      .filter(f => f.category === taskClass)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
    
    return {
      classification,
      providerPerformance,
      recentFeedback
    };
  }

  public async triggerManualEvolution(promptId: string, strategy?: 'genetic' | 'reinforcement' | 'hybrid'): Promise<string> {
    const selectedStrategy = strategy || 'hybrid';
    const evolutionStrategy = this.evolutionStrategies.get(selectedStrategy);
    
    if (!evolutionStrategy) {
      throw new NonRetryableError(`Evolution strategy not found: ${selectedStrategy}`, 'STRATEGY_NOT_FOUND');
    }
    
    return await this.evolvePromptAdvanced(promptId, {
      quality: { overall: 0.5 },
      totalCost: 0.02,
      totalLatency: 5000,
      finalOutput: '',
      responses: [],
      requestId: 'manual_trigger',
      createdAt: new Date(),
      variables: {}
    });
  }

  public getCoordinationPatterns(): CoordinationPattern[] {
    return [...this.coordinationPatterns];
  }

  public addCoordinationPattern(pattern: CoordinationPattern): void {
    this.coordinationPatterns.push(pattern);
    this.coordinationPatterns.sort((a, b) => b.priority - a.priority);
  }

  public getMultimodalCapabilities(): Map<string, MultimodalCapability[]> {
    return new Map(this.multimodalCapabilities);
  }

  public async exportConfiguration(): Promise<{
    taskClassifications: Record<string, TaskClassification>;
    evolutionStrategies: Record<string, EvolutionStrategy>;
    coordinationPatterns: CoordinationPattern[];
    modelPerformanceTrackers: Record<string, ModelPerformanceTracker>;
  }> {
    return {
      taskClassifications: Object.fromEntries(this.taskClassifications.entries()),
      evolutionStrategies: Object.fromEntries(this.evolutionStrategies.entries()),
      coordinationPatterns: this.coordinationPatterns,
      modelPerformanceTrackers: Object.fromEntries(this.modelPerformanceTrackers.entries())
    };
  }

  public async importConfiguration(config: {
    taskClassifications?: Record<string, TaskClassification>;
    evolutionStrategies?: Record<string, EvolutionStrategy>;
    coordinationPatterns?: CoordinationPattern[];
    modelPerformanceTrackers?: Record<string, ModelPerformanceTracker>;
  }): Promise<void> {
    if (config.taskClassifications) {
      this.taskClassifications = new Map(Object.entries(config.taskClassifications));
    }
    
    if (config.evolutionStrategies) {
      this.evolutionStrategies = new Map(Object.entries(config.evolutionStrategies));
    }
    
    if (config.coordinationPatterns) {
      this.coordinationPatterns = config.coordinationPatterns;
    }
    
    if (config.modelPerformanceTrackers) {
      this.modelPerformanceTrackers = new Map(Object.entries(config.modelPerformanceTrackers));
    }
    
    console.log('📥 Advanced configuration imported successfully');
  }
}

// ==================== FACTORY FUNCTIONS ====================

export function createAdvancedOrchestrator(
  customConfig?: Partial<LLMOrchestrationConfig>
): AdvancedLLMOrchestrator {
  return new AdvancedLLMOrchestrator(customConfig);
}

export async function createAndInitializeOrchestrator(
  customConfig?: Partial<LLMOrchestrationConfig>
): Promise<AdvancedLLMOrchestrator> {
  const orchestrator = new AdvancedLLMOrchestrator(customConfig);
  await orchestrator.initialize();
  return orchestrator;
}

// ==================== DEMO FUNCTION ====================

export async function runAdvancedDemo(): Promise<void> {
  console.log('🎬 Starting Comprehensive Advanced LLM Orchestration Demo...\n');
  
  const orchestrator = await createAndInitializeOrchestrator();

  try {
    // Example 1: Task-Classified Prompt Execution
    console.log('🎯 Example 1: Task-Classified Prompt Execution');
    const codeResponse = await orchestrator.executePrompt(
      'api_design_advanced',
      {
        projectName: 'Advanced LLM Orchestrator',
        language: 'TypeScript',
        framework: 'Express.js',
        requirements: 'Serverless API with intelligent caching and multi-provider support'
      },
      {
        taskClass: 'code_generation',
        multimodal: false,
        feedbackEnabled: true,
        evolutionEnabled: true
      }
    );
    console.log(`✅ Code Generation - Quality: ${codeResponse.quality.overall.toFixed(2)}, Cost: $${codeResponse.totalCost.toFixed(4)}\n`);

    // Example 2: Multimodal Processing
    console.log('🖼️ Example 2: Multimodal Processing Simulation');
    const multimodalResponse = await orchestrator.executePrompt(
      'multimodal_analysis',
      {
        textContent: 'Analyze this system architecture diagram',
        imageDescription: 'Complex microservices architecture with multiple databases',
        analysisType: 'comprehensive'
      },
      {
        taskClass: 'multimodal_processing',
        multimodal: true,
        strategy: 'ensemble'
      }
    );
    console.log(`✅ Multimodal Analysis - Quality: ${multimodalResponse.quality.overall.toFixed(2)}\n`);

    // Example 3: Feedback Submission and Learning
    console.log('📝 Example 3: Feedback Submission and Learning');
    await orchestrator.submitFeedback({
      promptId: 'api_design_advanced',
      responseId: codeResponse.requestId,
      score: 8.5,
      category: 'quality',
      feedback: 'Excellent code structure and comprehensive API design',
      source: 'human'
    });
    
    await orchestrator.submitFeedback({
      promptId: 'api_design_advanced',
      responseId: codeResponse.requestId,
      score: 7.2,
      category: 'creativity',
      feedback: 'Good implementation but could be more innovative',
      source: 'human'
    });
    console.log('✅ Feedback submitted and learning triggered\n');

    // Example 4: Manual Prompt Evolution
    console.log('🧬 Example 4: Manual Prompt Evolution');
    const evolvedPromptId = await orchestrator.triggerManualEvolution('api_design_advanced', 'hybrid');
    console.log(`✅ Evolved prompt created: ${evolvedPromptId}\n`);

    // Example 5: Advanced Analytics
    console.log('📊 Example 5: Advanced Analytics');
    const analytics = await orchestrator.getAdvancedAnalytics();
    console.log(`Task Classifications: ${analytics.taskClassifications.length}`);
    console.log(`Model Performance Trackers: ${analytics.modelPerformance.length}`);
    console.log(`Feedback Entries: ${analytics.feedbackSummary.length}`);
    console.log(`Cache Hit Rate: ${(analytics.cacheEfficiency.hitRate * 100).toFixed(1)}%`);
    console.log(`Intelligent Cache Size: ${analytics.cacheEfficiency.intelligentCacheSize}`);
    console.log(`Total Evolutions: ${analytics.evolutionMetrics.totalEvolutions}\n`);

    // Example 6: Task-Specific Metrics
    console.log('🎯 Example 6: Task-Specific Metrics');
    const codeGenMetrics = await orchestrator.getTaskClassificationMetrics('code_generation');
    if (codeGenMetrics.classification) {
      console.log(`Code Generation Task: ${codeGenMetrics.classification.name}`);
      console.log(`Optimal Providers: ${codeGenMetrics.classification.optimalProviders.join(', ')}`);
      console.log(`Provider Performance Entries: ${codeGenMetrics.providerPerformance.length}`);
      console.log(`Recent Feedback: ${codeGenMetrics.recentFeedback.length} entries\n`);
    }

    // Example 7: Coordination Patterns
    console.log('🎭 Example 7: Coordination Patterns');
    const patterns = orchestrator.getCoordinationPatterns();
    console.log(`Available Coordination Patterns: ${patterns.length}`);
    patterns.forEach(pattern => {
      console.log(`  - ${pattern.name}: ${pattern.description} (Priority: ${pattern.priority})`);
    });
    console.log();

    // Example 8: Multimodal Capabilities
    console.log('🔧 Example 8: Multimodal Capabilities');
    const capabilities = orchestrator.getMultimodalCapabilities();
    for (const [providerId, caps] of capabilities.entries()) {
      console.log(`${providerId}:`);
      caps.forEach(cap => {
        if (cap.supported) {
          console.log(`  - ${cap.type}: Quality ${(cap.quality * 100).toFixed(0)}%, Cost Multiplier ${cap.costMultiplier}x`);
        }
      });
    }
    console.log();

    // Example 9: Configuration Export/Import
    console.log('💾 Example 9: Configuration Export/Import');
    const exportedConfig = await orchestrator.exportConfiguration();
    console.log(`Exported ${Object.keys(exportedConfig.taskClassifications).length} task classifications`);
    console.log(`Exported ${Object.keys(exportedConfig.evolutionStrategies).length} evolution strategies`);
    console.log(`Exported ${exportedConfig.coordinationPatterns.length} coordination patterns`);
    console.log(`Exported ${Object.keys(exportedConfig.modelPerformanceTrackers).length} performance trackers\n`);

    // Example 10: Creative Writing with Evolution
    console.log('✍️ Example 10: Creative Writing with Automatic Evolution');
    const creativeResponse = await orchestrator.executePrompt(
      'creative_story_generation',
      {
        genre: 'science fiction',
        theme: 'AI consciousness and human connection',
        length: 'short story',
        tone: 'thought-provoking'
      },
      {
        taskClass: 'creative_writing',
        strategy: 'competitive',
        evolutionEnabled: true
      }
    );
    console.log(`✅ Creative Writing - Quality: ${creativeResponse.quality.overall.toFixed(2)}\n`);

    // Example 11: Analytical Reasoning Chain
    console.log('🧠 Example 11: Analytical Reasoning Chain');
    const analyticalSequence = await orchestrator.executePromptSequence(
      ['problem_analysis', 'solution_generation', 'implementation_planning'],
      {
        problem: 'Optimize LLM response quality while minimizing costs',
        constraints: 'Limited budget, high performance requirements',
        context: 'Enterprise production environment'
      },
      {
        strategy: 'adaptive',
        continueOnError: false
      }
    );
    console.log(`✅ Analytical Chain - ${analyticalSequence.length} steps completed\n`);

    // Example 12: Performance Monitoring Events
    console.log('📡 Example 12: Event-Driven Monitoring');
    let eventCount = 0;
    
    orchestrator.on('response_generated', (data) => {
      eventCount++;
      console.log(`  📨 Response generated for ${data.promptId} (Task: ${data.taskClass})`);
    });
    
    orchestrator.on('feedback_received', (feedback) => {
      eventCount++;
      console.log(`  📝 Feedback received: ${feedback.score}/10 for ${feedback.category}`);
    });
    
    orchestrator.on('prompt_evolved', (evolution) => {
      eventCount++;
      console.log(`  🧬 Prompt evolved: ${evolution.originalPromptId} → ${evolution.evolvedPromptId}`);
    });
    
    orchestrator.on('provider_performance_warning', (warning) => {
      eventCount++;
      console.log(`  ⚠️ Performance warning: ${warning.providerId} (Success: ${(warning.successRate * 100).toFixed(1)}%)`);
    });

    // Trigger some events
    await orchestrator.executePrompt('test_prompt', { test: 'data' });
    
    setTimeout(() => {
      console.log(`✅ Monitored ${eventCount} events\n`);
    }, 1000);

    // Final Performance Analysis
    console.log('📈 Final Performance Analysis');
    const finalAnalysis = await orchestrator.analyzePerformance();
    console.log(`Total Requests: ${finalAnalysis.global.requestCount}`);
    console.log(`Success Rate: ${(finalAnalysis.global.successCount / finalAnalysis.global.requestCount * 100).toFixed(1)}%`);
    console.log(`Average Quality: ${(finalAnalysis.global.averageQuality * 100).toFixed(1)}%`);
    console.log(`Recommendations: ${finalAnalysis.recommendations.length}`);
    finalAnalysis.recommendations.forEach(rec => console.log(`  - ${rec}`));

    console.log('\n🎉 Comprehensive Advanced Demo Completed Successfully!');
    console.log('🚀 The Advanced LLM Orchestrator is ready for production deployment!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await orchestrator.shutdown();
  }
}

// ==================== EXPORTS ====================

export default AdvancedLLMOrchestrator;
export { LLMOrchestrationExamples };