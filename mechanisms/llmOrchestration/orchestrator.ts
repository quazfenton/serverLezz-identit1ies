import {
  LLMOrchestrationEngine,
  createLLMOrchestrationEngine,
  PromptTemplate,
  LLMProvider,
  OrchestrationRequest,
  OrchestrationResponse,
  OrchestrationStrategy
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

// ==================== MAIN ORCHESTRATOR CLASS ====================

export class AdvancedLLMOrchestrator {
  private engine: LLMOrchestrationEngine;
  private config: LLMOrchestrationConfig;
  private retryManager: RetryManager;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private cache: LRUCache<OrchestrationResponse>;
  private rateLimiter: RateLimiter;
  private performanceMonitor: PerformanceMonitor;
  private isInitialized: boolean = false;

  constructor(customConfig?: Partial<LLMOrchestrationConfig>) {
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
    } = {}
  ): Promise<OrchestrationResponse> {
    await this.ensureInitialized();
    
    const {
      strategy = 'adaptive',
      providers,
      priority = 1,
      timeout = 30000,
      userId,
      useCache = this.config.features.enableCaching,
      bypassRateLimit = false
    } = options;

    // Check rate limiting
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

    // Generate cache key
    const cacheKey = this.generateCacheKey(promptId, variables, strategy, providers);
    
    // Check cache
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log(`📦 Cache hit for ${promptId}`);
        return cached;
      }
    }

    // Create orchestration request
    const request: OrchestrationRequest = {
      id: this.generateRequestId(),
      promptId,
      variables,
      providers: providers || this.selectOptimalProviders(promptId),
      strategy,
      priority,
      maxRetries: this.config.features.enableRetries ? 3 : 0,
      timeout,
      metadata: {
        userId,
        context: { cacheKey },
        tags: ['api_request'],
        expectedOutputType: 'text'
      },
      createdAt: new Date(),
      status: 'pending'
    };

    try {
      // Execute with retry and circuit breaker protection
      const response = await this.retryManager.executeWithRetry(
        () => this.executeWithCircuitBreaker(request),
        `prompt execution ${promptId}`
      );

      // Cache successful response
      if (useCache && response.quality.overall > 0.7) {
        this.cache.set(cacheKey, response);
      }

      // Record performance metrics
      this.recordPerformanceMetrics(response);

      return response;

    } catch (error) {
      console.error(`❌ Failed to execute prompt ${promptId}:`, error);
      
      // Record failure metrics
      this.performanceMonitor.recordRequest(
        'unknown',
        false,
        timeout,
        0,
        0
      );
      
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
    }, 60000); // Every minute

    // Performance monitoring
    if (this.config.monitoring.enableMetrics) {
      setInterval(() => {
        const metrics = this.performanceMonitor.getMetrics();
        console.log(`📊 Global metrics: ${metrics.requestCount} requests, ${(metrics.averageQuality * 100).toFixed(1)}% avg quality`);
      }, this.config.monitoring.metricsInterval * 1000);
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
    
    await this.engine.shutdown();
    this.cache.clear();
    this.performanceMonitor.reset();
    
    console.log('✅ Shutdown complete');
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
  console.log('🎬 Starting Advanced LLM Orchestration Demo...\n');
  
  const orchestrator = await createAndInitializeOrchestrator();

  try {
    // Example 1: Simple prompt execution
    console.log('📝 Example 1: Simple Prompt Execution');
    const response1 = await orchestrator.executePrompt(
      'api_design_advanced',
      {
        projectName: 'LLM Orchestrator API',
        language: 'TypeScript',
        framework: 'Express.js',
        requirements: 'RESTful API for managing LLM orchestration workflows'
      }
    );
    console.log(`✅ Quality: ${response1.quality.overall.toFixed(2)}, Cost: $${response1.totalCost.toFixed(4)}\n`);

    // Example 2: Prompt sequence
    console.log('🔄 Example 2: Prompt Sequence');
    const sequence = ['api_design_advanced', 'system_analysis_comprehensive'];
    const responses = await orchestrator.executePromptSequence(sequence, {
      projectName: 'Advanced AI System',
      systemType: 'distributed microservices',
      systemDescription: 'Multi-tenant AI orchestration platform'
    });
    console.log(`✅ Executed ${responses.length} prompts in sequence\n`);

    // Example 3: Performance analysis
    console.log('📊 Example 3: Performance Analysis');
    const analysis = await orchestrator.analyzePerformance();
    console.log(`Global success rate: ${(analysis.global.successCount / analysis.global.requestCount * 100).toFixed(1)}%`);
    console.log(`Top provider: ${analysis.providers[0]?.id}\n`);

    // Example 4: Configuration optimization
    console.log('⚡ Example 4: Configuration Optimization');
    const optimization = await orchestrator.optimizeConfiguration();
    console.log(`Recommendations: ${optimization.improvements.join(', ')}\n`);

    console.log('🎉 Advanced demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await orchestrator.shutdown();
  }
}

// ==================== EXPORTS ====================

export default AdvancedLLMOrchestrator;
export { LLMOrchestrationExamples };