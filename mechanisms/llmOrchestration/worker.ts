import { createAndInitializeOrchestrator } from './orchestrator';
import { LLMOrchestrationConfig } from './config';

// ==================== BACKGROUND WORKER ====================

class LLMOrchestrationWorker {
  private orchestrator?: any;
  private isRunning: boolean = false;
  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down worker gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down worker gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception in worker:', error);
      await this.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection in worker:', reason, 'at:', promise);
      await this.stop();
      process.exit(1);
    });
  }

  public async start(): Promise<void> {
    try {
      console.log('🔧 Starting LLM Orchestration Background Worker...');

      // Initialize orchestrator with worker-optimized config
      const workerConfig: Partial<LLMOrchestrationConfig> = {
        evolution: {
          enabled: process.env.ENABLE_EVOLUTION === 'true',
          interval: parseInt(process.env.EVOLUTION_INTERVAL || '60'),
          maxVariations: 5,
          qualityThreshold: 0.7
        },
        monitoring: {
          enableMetrics: process.env.ENABLE_ANALYTICS === 'true',
          metricsInterval: 60,
          retentionDays: 30
        },
        caching: {
          enabled: true,
          ttl: parseInt(process.env.CACHE_TTL || '300'),
          maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000')
        }
      };

      this.orchestrator = await createAndInitializeOrchestrator(workerConfig);
      this.isRunning = true;

      // Start background tasks
      this.startBackgroundTasks();

      console.log('✅ Background Worker started successfully');

    } catch (error) {
      console.error('❌ Failed to start background worker:', error);
      throw error;
    }
  }

  private startBackgroundTasks(): void {
    // Evolution task
    if (process.env.ENABLE_EVOLUTION === 'true') {
      const evolutionInterval = setInterval(async () => {
        try {
          await this.runEvolutionCycle();
        } catch (error) {
          console.error('Evolution cycle error:', error);
        }
      }, parseInt(process.env.EVOLUTION_INTERVAL || '60') * 60000);
      
      this.intervals.push(evolutionInterval);
      console.log('🧬 Evolution background task started');
    }

    // Analytics and cleanup task
    if (process.env.ENABLE_ANALYTICS === 'true') {
      const analyticsInterval = setInterval(async () => {
        try {
          await this.runAnalyticsCycle();
        } catch (error) {
          console.error('Analytics cycle error:', error);
        }
      }, 300000); // Every 5 minutes
      
      this.intervals.push(analyticsInterval);
      console.log('📊 Analytics background task started');
    }

    // Cleanup task
    if (process.env.ENABLE_CLEANUP === 'true') {
      const cleanupInterval = setInterval(async () => {
        try {
          await this.runCleanupCycle();
        } catch (error) {
          console.error('Cleanup cycle error:', error);
        }
      }, 3600000); // Every hour
      
      this.intervals.push(cleanupInterval);
      console.log('🧹 Cleanup background task started');
    }

    // Health check task
    const healthInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
    
    this.intervals.push(healthInterval);
    console.log('❤️ Health check task started');
  }

  private async runEvolutionCycle(): Promise<void> {
    if (!this.orchestrator) return;

    console.log('🧬 Running evolution cycle...');
    
    try {
      // Get analytics to identify underperforming prompts
      const analytics = await this.orchestrator.getAdvancedAnalytics();
      
      // Find prompts with low scores that have enough feedback
      const candidatesForEvolution = analytics.feedbackSummary
        .filter(summary => summary.avgScore < 7 && summary.feedbackCount >= 3)
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 3); // Top 3 candidates

      let evolutionsPerformed = 0;
      
      for (const candidate of candidatesForEvolution) {
        try {
          const evolvedId = await this.orchestrator.triggerManualEvolution(
            candidate.promptId, 
            'hybrid'
          );
          
          console.log(`✨ Evolved prompt: ${candidate.promptId} → ${evolvedId}`);
          evolutionsPerformed++;
          
          // Small delay between evolutions
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.warn(`⚠️ Failed to evolve ${candidate.promptId}:`, error.message);
        }
      }

      console.log(`🧬 Evolution cycle completed: ${evolutionsPerformed} prompts evolved`);
      
    } catch (error) {
      console.error('Evolution cycle failed:', error);
    }
  }

  private async runAnalyticsCycle(): Promise<void> {
    if (!this.orchestrator) return;

    console.log('📊 Running analytics cycle...');
    
    try {
      // Generate comprehensive analytics
      const analytics = await this.orchestrator.getAdvancedAnalytics();
      const performance = await this.orchestrator.analyzePerformance();
      
      // Log key metrics
      console.log(`📈 Analytics Summary:`);
      console.log(`  - Task Classifications: ${analytics.taskClassifications.length}`);
      console.log(`  - Model Performance Trackers: ${analytics.modelPerformance.length}`);
      console.log(`  - Feedback Entries: ${analytics.feedbackSummary.length}`);
      console.log(`  - Cache Hit Rate: ${(analytics.cacheEfficiency.hitRate * 100).toFixed(1)}%`);
      console.log(`  - Total Requests: ${performance.global.requestCount}`);
      console.log(`  - Success Rate: ${(performance.global.successCount / Math.max(1, performance.global.requestCount) * 100).toFixed(1)}%`);
      console.log(`  - Average Quality: ${(performance.global.averageQuality * 100).toFixed(1)}%`);

      // Check for performance warnings
      if (performance.global.averageQuality < 0.7) {
        console.warn('⚠️ Average quality below threshold (70%)');
      }

      if (analytics.cacheEfficiency.hitRate < 0.3) {
        console.warn('⚠️ Cache hit rate below optimal (30%)');
      }

      // Identify top and bottom performing providers
      if (performance.providers.length > 0) {
        const topProvider = performance.providers[0];
        const bottomProvider = performance.providers[performance.providers.length - 1];
        
        console.log(`🏆 Top Provider: ${topProvider.id} (Rank: ${topProvider.ranking})`);
        if (performance.providers.length > 1) {
          console.log(`📉 Bottom Provider: ${bottomProvider.id} (Rank: ${bottomProvider.ranking})`);
        }
      }

      console.log('📊 Analytics cycle completed');
      
    } catch (error) {
      console.error('Analytics cycle failed:', error);
    }
  }

  private async runCleanupCycle(): Promise<void> {
    if (!this.orchestrator) return;

    console.log('🧹 Running cleanup cycle...');
    
    try {
      // Save historical data
      await this.orchestrator.saveHistoricalData();
      
      // Get cache stats before cleanup
      const cacheStatsBefore = this.orchestrator.getCacheStats();
      
      // Perform cleanup operations
      // Note: The orchestrator's background tasks already handle cache cleanup
      // This is additional maintenance
      
      console.log(`🧹 Cleanup cycle completed`);
      console.log(`  - Cache entries before: ${cacheStatsBefore.size || 'N/A'}`);
      console.log(`  - Historical data saved`);
      
    } catch (error) {
      console.error('Cleanup cycle failed:', error);
    }
  }

  private performHealthCheck(): void {
    if (!this.orchestrator || !this.isRunning) {
      console.warn('⚠️ Health check failed: Orchestrator not available');
      return;
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    // Log health status periodically (every 10 minutes)
    const now = Date.now();
    if (!this.lastHealthLog || now - this.lastHealthLog > 600000) {
      console.log(`❤️ Worker Health Check:`);
      console.log(`  - Status: Running`);
      console.log(`  - Uptime: ${Math.round(process.uptime())}s`);
      console.log(`  - Memory: ${memUsageMB.heapUsed}MB / ${memUsageMB.heapTotal}MB`);
      console.log(`  - RSS: ${memUsageMB.rss}MB`);
      
      this.lastHealthLog = now;
    }

    // Warn if memory usage is high
    if (memUsageMB.heapUsed > 400) {
      console.warn(`⚠️ High memory usage: ${memUsageMB.heapUsed}MB`);
    }
  }

  private lastHealthLog: number = 0;

  public async stop(): Promise<void> {
    console.log('🛑 Stopping background worker...');
    
    this.isRunning = false;

    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    // Shutdown orchestrator
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
    }

    console.log('✅ Background worker stopped');
  }

  public isWorkerRunning(): boolean {
    return this.isRunning;
  }
}

// ==================== MAIN EXECUTION ====================

if (require.main === module) {
  const worker = new LLMOrchestrationWorker();
  
  worker.start().catch((error) => {
    console.error('Failed to start background worker:', error);
    process.exit(1);
  });
}

export default LLMOrchestrationWorker;