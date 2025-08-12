import { getAllMetaPrompts } from '../mechanisms/llmOrchestration/prompts/MetaPrompts';
import { PromptTemplate, OrchestrationStrategy, PromptCategory } from '../mechanisms/llmOrchestration/index';
import * as path from 'path';
import * as fs from 'fs/promises';

// ==================== TYPE DEFINITIONS ====================

interface AdvancedLLMOrchestrator {
  execute(prompt: string, context: Record<string, any>, strategy: OrchestrationStrategy): Promise<any>;
  executePrompt(promptId: string, variables: any, options: any): Promise<any>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

interface LLMProvider {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
    currentUsage: {
      requests: number;
      tokens: number;
      resetTime: Date;
    };
  };
  costPerToken: number;
  capabilities: Array<{
    type: string;
    strength: number;
    specializations: string[];
  }>;
  reliability: number;
  averageLatency: number;
  isActive: boolean;
}

// ==================== DEMO CONFIGURATION ====================

interface DemoConfig {
  enableLogging: boolean;
  logToFile: boolean;
  logFilePath: string;
  conversationTurns: number;
  useMetaPrompts: boolean;
  orchestratorType: 'basic' | 'advanced';
  scenarios: DemoScenario[];
}

interface DemoScenario {
  id: string;
  name: string;
  description: string;
  turns: ConversationTurn[];
  expectedOutcomes: string[];
}

interface ConversationTurn {
  id: number;
  speaker: 'user' | 'system';
  message: string;
  context?: Record<string, any>;
  expectedActions?: string[];
  metaPrompts?: string[];
}

interface DemoResult {
  scenarioId: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  turns: TurnResult[];
  overallQuality: number;
  totalCost: number;
  errors: any[];
  insights: string[];
}

interface TurnResult {
  turnId: number;
  prompt: string;
  response: any;
  intermediateSteps: any[];
  executionTime: number;
  quality: number;
  cost: number;
  metadata: Record<string, any>;
}

// ==================== DEMO ORCHESTRATOR CLASS ====================

export class LLMOrchestrationDemo {
  private config: DemoConfig;
  private basicOrchestrator: any;
  private advancedOrchestrator: AdvancedLLMOrchestrator | null = null;
  private configLoader: any;
  private demoResults: DemoResult[] = [];
  private logger: DemoLogger;

  constructor(config: Partial<DemoConfig> = {}) {
    this.config = {
      enableLogging: true,
      logToFile: true,
      logFilePath: path.join(process.cwd(), 'examples', 'demo-logs', `demo-${Date.now()}.log`),
      conversationTurns: 5,
      useMetaPrompts: true,
      orchestratorType: 'basic',
      scenarios: this.createDemoScenarios(),
      ...config
    };

    this.logger = new DemoLogger(this.config.enableLogging, this.config.logToFile, this.config.logFilePath);
  }

  // ==================== MOCK ORCHESTRATOR ====================

  private createMockOrchestrator(): any {
    const mockOrchestrator = {
      execute: async (prompt: string, context: Record<string, any>, strategy: OrchestrationStrategy) => {
        // Simulate processing time
        await this.sleep(Math.random() * 2000 + 500);
        
        // Generate mock response based on prompt content
        const responseLength = Math.floor(Math.random() * 1000 + 200);
        const quality = Math.random() * 0.4 + 0.6; // Between 0.6 and 1.0
        const cost = Math.random() * 0.02 + 0.005; // Between $0.005 and $0.025
        
        return {
          finalOutput: `Mock response to: "${prompt.substring(0, 100)}...". This is a simulated ${strategy} orchestration response with ${responseLength} characters of content.`,
          quality: {
            overall: quality,
            relevance: quality + (Math.random() * 0.2 - 0.1),
            creativity: Math.random() * 0.3 + 0.4,
            accuracy: quality + (Math.random() * 0.1 - 0.05)
          },
          totalCost: cost,
          executionTime: Math.random() * 3000 + 1000,
          metadata: {
            strategy,
            model: 'mock-gpt-4',
            tokens: Math.floor(responseLength * 1.3),
            timestamp: new Date()
          },
          intermediateSteps: [
            {
              step: 'mock_analysis',
              description: 'Analyzed input prompt and context',
              result: 'Context analyzed successfully',
              timestamp: new Date()
            },
            {
              step: 'mock_generation',
              description: 'Generated response using mock orchestration',
              result: `Applied ${strategy} strategy`,
              timestamp: new Date()
            }
          ]
        };
      },
      
      runPipeline: async (request: any) => {
        return await mockOrchestrator.execute(request.promptText, request.variables || {}, request.strategy || 'sequential');
      },
      
      executePrompt: async (promptId: string, variables: any, options: any) => {
        return await mockOrchestrator.execute(
          `Executing prompt ${promptId} with variables`,
          variables,
          options.strategy || 'sequential'
        );
      },
      
      initialize: async () => {
        console.log('Mock orchestrator initialized');
      },
      
      shutdown: async () => {
        console.log('Mock orchestrator shutdown');
      },
      
      cleanup: async () => {
        console.log('Mock orchestrator cleanup');
      }
    };
    
    return mockOrchestrator;
  }

  // ==================== INITIALIZATION ====================

  public async initialize(): Promise<void> {
    this.logger.log('🚀 Initializing LLM Orchestration Demo...', 'info');

    try {
      // Initialize configuration loader with meta-prompts (mock)
      this.configLoader = {
        loadConfig: () => Promise.resolve({}),
        getMetaPromptsForContext: () => Promise.resolve([])
      };

      // Initialize orchestrators based on configuration
      if (this.config.orchestratorType === 'basic') {
        this.basicOrchestrator = this.createMockOrchestrator();
        this.logger.log('✅ Basic orchestrator initialized (mock)', 'info');
      } else {
        this.advancedOrchestrator = this.createMockOrchestrator() as any;
        this.logger.log('✅ Advanced orchestrator initialized (mock)', 'info');
      }

      // Setup meta-prompts if enabled
      if (this.config.useMetaPrompts) {
        await this.setupMetaPrompts();
      }

      // Setup demo environment
      await this.setupDemoEnvironment();

      this.logger.log('🎯 Demo initialization complete!', 'success');
    } catch (error) {
      this.logger.log(`❌ Demo initialization failed: ${error}`, 'error');
      throw error;
    }
  }

  // ==================== MAIN DEMO EXECUTION ====================

  public async runFullDemo(): Promise<DemoResult[]> {
    this.logger.log('\n🎬 Starting Full LLM Orchestration Demo', 'info');
    this.logger.log('='.repeat(60), 'info');

    try {
      // Run all configured scenarios
      for (const scenario of this.config.scenarios) {
        this.logger.log(`\n🎯 Running Scenario: ${scenario.name}`, 'info');
        this.logger.log(`📋 Description: ${scenario.description}`, 'info');
        
        const result = await this.runScenario(scenario);
        this.demoResults.push(result);
        
        // Log scenario completion
        this.logger.log(`✅ Scenario "${scenario.name}" completed`, 'success');
        this.logger.log(`⏱️  Duration: ${result.totalDuration}ms`, 'info');
        this.logger.log(`📊 Quality: ${result.overallQuality.toFixed(2)}`, 'info');
        this.logger.log(`💰 Cost: $${result.totalCost.toFixed(4)}`, 'info');
      }

      // Generate comprehensive analysis
      await this.generateDemoAnalysis();

      // Export results if configured
      await this.exportDemoResults();

      this.logger.log('\n🎉 Full Demo Completed Successfully!', 'success');
      return this.demoResults;

    } catch (error) {
      this.logger.log(`❌ Demo execution failed: ${error}`, 'error');
      throw error;
    }
  }

  // ==================== SCENARIO EXECUTION ====================

  private async runScenario(scenario: DemoScenario): Promise<DemoResult> {
    const startTime = new Date();
    const result: DemoResult = {
      scenarioId: scenario.id,
      startTime,
      endTime: new Date(),
      totalDuration: 0,
      turns: [],
      overallQuality: 0,
      totalCost: 0,
      errors: [],
      insights: []
    };

    this.logger.log(`\n📍 Starting scenario execution: ${scenario.id}`, 'info');

    try {
      let conversationContext: Record<string, any> = {};

      // Execute each conversation turn
      for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i];
        this.logger.log(`\n🔄 Turn ${turn.id}: ${turn.speaker}`, 'info');
        this.logger.log(`💬 Message: ${turn.message}`, 'info');

        const turnResult = await this.executeTurn(turn, conversationContext, scenario);
        result.turns.push(turnResult);

        // Update conversation context with response
        conversationContext = {
          ...conversationContext,
          ...turn.context,
          [`turn_${turn.id}_response`]: turnResult.response.finalOutput,
          [`turn_${turn.id}_quality`]: turnResult.quality,
          currentTurn: turn.id,
          totalTurns: scenario.turns.length
        };

        // Log intermediate reasoning steps
        if (turnResult.intermediateSteps.length > 0) {
          this.logger.log('🧠 Intermediate Reasoning Steps:', 'info');
          turnResult.intermediateSteps.forEach((step, idx) => {
            this.logger.log(`  ${idx + 1}. ${step.description}: ${step.result}`, 'debug');
          });
        }

        // Add pause between turns for realism
        await this.sleep(500);
      }

      // Calculate overall metrics
      result.endTime = new Date();
      result.totalDuration = result.endTime.getTime() - startTime.getTime();
      result.overallQuality = result.turns.reduce((sum, t) => sum + t.quality, 0) / result.turns.length;
      result.totalCost = result.turns.reduce((sum, t) => sum + t.cost, 0);

      // Generate insights from the scenario execution
      result.insights = await this.generateScenarioInsights(scenario, result);

      return result;

    } catch (error) {
      this.logger.log(`❌ Scenario execution failed: ${error}`, 'error');
      result.errors.push({ error: error instanceof Error ? error.message : String(error), timestamp: new Date() });
      result.endTime = new Date();
      result.totalDuration = result.endTime.getTime() - startTime.getTime();
      return result;
    }
  }

  // ==================== TURN EXECUTION ====================

  private async executeTurn(
    turn: ConversationTurn,
    context: Record<string, any>,
    scenario: DemoScenario
  ): Promise<TurnResult> {
    const turnStartTime = Date.now();
    const intermediateSteps: any[] = [];

    try {
      // Step 1: Prepare the prompt with context and meta-prompts
      this.logger.log('🔧 Step 1: Preparing enhanced prompt...', 'debug');
      const enhancedPrompt = await this.prepareEnhancedPrompt(turn, context, scenario);
      intermediateSteps.push({
        step: 'prompt_preparation',
        description: 'Enhanced prompt with meta-prompts and context',
        result: enhancedPrompt.substring(0, 200) + '...',
        timestamp: new Date()
      });

      // Step 2: Select optimal orchestration strategy
      this.logger.log('🎯 Step 2: Selecting orchestration strategy...', 'debug');
      const strategy = await this.selectOptimalStrategy(turn, context, scenario);
      intermediateSteps.push({
        step: 'strategy_selection',
        description: 'Optimal strategy based on context',
        result: strategy,
        timestamp: new Date()
      });

      // Step 3: Execute with orchestrator
      this.logger.log('⚡ Step 3: Executing with orchestrator...', 'debug');
      let response;
      if (this.config.orchestratorType === 'advanced') {
        response = await this.executeWithAdvancedOrchestrator(enhancedPrompt, context, strategy);
      } else {
        response = await this.executeWithBasicOrchestrator(enhancedPrompt, context, strategy);
      }

      intermediateSteps.push({
        step: 'orchestration_execution',
        description: 'Orchestrator processing and response generation',
        result: `Generated response with quality ${response.quality?.overall || 'N/A'}`,
        timestamp: new Date()
      });

      // Step 4: Post-process and enhance response
      this.logger.log('✨ Step 4: Post-processing response...', 'debug');
      const enhancedResponse = await this.postProcessResponse(response, turn, context);
      intermediateSteps.push({
        step: 'response_enhancement',
        description: 'Post-processing and quality enhancement',
        result: 'Response enhanced and validated',
        timestamp: new Date()
      });

      // Step 5: Extract insights and learning
      this.logger.log('📊 Step 5: Extracting insights...', 'debug');
      const insights = await this.extractTurnInsights(response, turn, context);
      intermediateSteps.push({
        step: 'insight_extraction',
        description: 'Learning and insights extraction',
        result: `Extracted ${insights.length} insights`,
        timestamp: new Date()
      });

      const executionTime = Date.now() - turnStartTime;

      return {
        turnId: turn.id,
        prompt: enhancedPrompt,
        response: enhancedResponse,
        intermediateSteps,
        executionTime,
        quality: response.quality?.overall || 0.5,
        cost: response.totalCost || 0.001,
        metadata: {
          strategy,
          insights,
          contextKeys: Object.keys(context),
          timestamp: new Date()
        }
      };

    } catch (error) {
      this.logger.log(`❌ Turn execution failed: ${error}`, 'error');
      const executionTime = Date.now() - turnStartTime;
      
      return {
        turnId: turn.id,
        prompt: turn.message,
        response: { finalOutput: `Error: ${error instanceof Error ? error.message : String(error)}`, error: true },
        intermediateSteps,
        executionTime,
        quality: 0,
        cost: 0,
        metadata: { error: error instanceof Error ? error.message : String(error), timestamp: new Date() }
      };
    }
  }

  // ==================== PROMPT ENHANCEMENT ====================

  private async prepareEnhancedPrompt(
    turn: ConversationTurn,
    context: Record<string, any>,
    scenario: DemoScenario
  ): Promise<string> {
    let enhancedPrompt = turn.message;

    if (this.config.useMetaPrompts) {
      // Load relevant meta-prompts based on turn context
      const relevantMetaPrompts = await this.selectRelevantMetaPrompts(turn, context);
      
      if (relevantMetaPrompts.length > 0) {
        const metaPromptContent = relevantMetaPrompts
          .map(mp => `=== ${mp.name} ===\n${mp.content}\n`)
          .join('\n');

        enhancedPrompt = `${metaPromptContent}\n\n=== CONVERSATION CONTEXT ===\n${JSON.stringify(context, null, 2)}\n\n=== USER MESSAGE ===\n${turn.message}\n\n=== INSTRUCTIONS ===\nPlease respond to the user message while incorporating the guidance from the meta-prompts above and considering the conversation context.`;
      }
    }

    // Add context variables
    if (Object.keys(context).length > 0) {
      enhancedPrompt = this.injectContextVariables(enhancedPrompt, context);
    }

    return enhancedPrompt;
  }

  private async selectRelevantMetaPrompts(
    turn: ConversationTurn,
    context: Record<string, any>
  ): Promise<PromptTemplate[]> {
    const allMetaPrompts = getAllMetaPrompts();
    const relevantPrompts: PromptTemplate[] = [];

    // Use specified meta-prompts if provided
    if (turn.metaPrompts && turn.metaPrompts.length > 0) {
      turn.metaPrompts.forEach(promptId => {
        const metaPrompt = allMetaPrompts.find(mp => mp.id === promptId);
        if (metaPrompt) {
          relevantPrompts.push(metaPrompt);
        }
      });
    } else {
      // Auto-select based on content analysis
      const messageContent = turn.message.toLowerCase();
      
      if (messageContent.includes('analyze') || messageContent.includes('problem')) {
        const analysisPrompt = allMetaPrompts.find(mp => mp.id === 'problem_analysis');
        if (analysisPrompt) relevantPrompts.push(analysisPrompt);
      }
      
      if (messageContent.includes('solution') || messageContent.includes('implement')) {
        const solutionPrompt = allMetaPrompts.find(mp => mp.id === 'solution_generation');
        if (solutionPrompt) relevantPrompts.push(solutionPrompt);
      }
      
      if (messageContent.includes('story') || messageContent.includes('creative')) {
        const creativePrompt = allMetaPrompts.find(mp => mp.id === 'creative_story_generation');
        if (creativePrompt) relevantPrompts.push(creativePrompt);
      }
    }

    return relevantPrompts.slice(0, 2); // Limit to 2 meta-prompts to avoid token limits
  }

  private injectContextVariables(prompt: string, context: Record<string, any>): string {
    let enhancedPrompt = prompt;
    
    // Simple variable substitution
    Object.keys(context).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = typeof context[key] === 'object' 
        ? JSON.stringify(context[key]) 
        : String(context[key]);
      enhancedPrompt = enhancedPrompt.replace(new RegExp(placeholder, 'g'), value);
    });

    return enhancedPrompt;
  }

  // ==================== ORCHESTRATOR EXECUTION ====================

  private async selectOptimalStrategy(
    turn: ConversationTurn,
    context: Record<string, any>,
    scenario: DemoScenario
  ): Promise<OrchestrationStrategy> {
    const messageContent = turn.message.toLowerCase();
    
    // Strategy selection based on content analysis
    if (messageContent.includes('creative') || messageContent.includes('story')) {
      return 'ensemble'; // Multiple models for creative tasks
    } else if (messageContent.includes('analyze') || messageContent.includes('compare')) {
      return 'competitive'; // Compare different approaches
    } else if (messageContent.includes('urgent') || messageContent.includes('quick')) {
      return 'fallback'; // Fast response
    } else if (context.currentTurn && context.currentTurn > 2) {
      return 'adaptive'; // Adaptive for longer conversations
    } else {
      return 'sequential'; // Default sequential processing
    }
  }

  private async executeWithAdvancedOrchestrator(
    prompt: string,
    context: Record<string, any>,
    strategy: OrchestrationStrategy
  ): Promise<any> {
    // Mock execution
    return this.advancedOrchestrator!.execute(prompt, context, strategy);
  }

  private async executeWithBasicOrchestrator(
    prompt: string,
    context: Record<string, any>,
    strategy: OrchestrationStrategy
  ): Promise<any> {
    // Mock execution
    return this.basicOrchestrator.execute(prompt, context, strategy);
  }

  // ==================== POST-PROCESSING ====================

  private async postProcessResponse(response: any, turn: ConversationTurn, context: Record<string, any>): Promise<any> {
    // Add conversation tracking
    response.conversationMeta = {
      turnId: turn.id,
      speaker: turn.speaker,
      contextSize: Object.keys(context).length,
      timestamp: new Date()
    };

    // Enhance response quality assessment
    if (!response.quality) {
      response.quality = { overall: 0.7 }; // Default quality
    }

    // Add turn-specific insights
    response.turnInsights = {
      expectedActions: turn.expectedActions || [],
      contextRelevance: this.assessContextRelevance(response.finalOutput, context),
      responseLength: response.finalOutput?.length || 0
    };

    return response;
  }

  private assessContextRelevance(response: string, context: Record<string, any>): number {
    if (!response || Object.keys(context).length === 0) return 0.5;

    // Simple relevance scoring based on context keyword presence
    const contextKeywords = Object.values(context)
      .filter(v => typeof v === 'string')
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 10); // Top 10 keywords

    const responseText = response.toLowerCase();
    const matchCount = contextKeywords.filter(keyword => 
      responseText.includes(keyword) && keyword.length > 2
    ).length;

    return Math.min(1.0, matchCount / Math.max(1, contextKeywords.length));
  }

  // ==================== INSIGHTS AND ANALYSIS ====================

  private async extractTurnInsights(response: any, turn: ConversationTurn, context: Record<string, any>): Promise<string[]> {
    const insights: string[] = [];

    // Quality insights
    if (response.quality?.overall > 0.8) {
      insights.push(`High-quality response achieved (${response.quality.overall.toFixed(2)})`);
    } else if (response.quality?.overall < 0.5) {
      insights.push(`Low response quality detected - consider prompt optimization`);
    }

    // Cost insights
    if (response.totalCost > 0.05) {
      insights.push(`High cost incurred ($${response.totalCost.toFixed(4)}) - consider efficiency optimization`);
    }

    // Response characteristics
    const responseLength = response.finalOutput?.length || 0;
    if (responseLength > 2000) {
      insights.push(`Lengthy response (${responseLength} chars) - may indicate comprehensive analysis`);
    } else if (responseLength < 100) {
      insights.push(`Brief response - may need more elaboration prompts`);
    }

    // Context utilization
    if (context && Object.keys(context).length > 0) {
      const relevance = this.assessContextRelevance(response.finalOutput, context);
      if (relevance > 0.7) {
        insights.push(`Good context integration (${(relevance * 100).toFixed(0)}%)`);
      } else if (relevance < 0.3) {
        insights.push(`Poor context integration - review prompt design`);
      }
    }

    return insights;
  }

  private async generateScenarioInsights(scenario: DemoScenario, result: DemoResult): Promise<string[]> {
    const insights: string[] = [];

    // Performance insights
    const avgExecutionTime = result.turns.reduce((sum, t) => sum + t.executionTime, 0) / result.turns.length;
    if (avgExecutionTime > 5000) {
      insights.push(`High average execution time (${avgExecutionTime.toFixed(0)}ms) - consider optimization`);
    }

    // Quality progression
    const qualityProgression = result.turns.map(t => t.quality);
    const qualityTrend = qualityProgression.length > 1 
      ? (qualityProgression[qualityProgression.length - 1] - qualityProgression[0]) 
      : 0;

    if (qualityTrend > 0.1) {
      insights.push(`Positive quality trend observed (+${(qualityTrend * 100).toFixed(1)}%)`);
    } else if (qualityTrend < -0.1) {
      insights.push(`Quality degradation detected (${(qualityTrend * 100).toFixed(1)}%)`);
    }

    // Error analysis
    if (result.errors.length > 0) {
      insights.push(`${result.errors.length} errors encountered - review error handling`);
    }

    // Cost efficiency
    if (result.totalCost > 0.20) {
      insights.push(`High total cost ($${result.totalCost.toFixed(4)}) for scenario - consider cost optimization`);
    }

    return insights;
  }

  // ==================== DEMO ANALYSIS AND REPORTING ====================

  private async generateDemoAnalysis(): Promise<void> {
    this.logger.log('\n📊 Generating Demo Analysis...', 'info');

    const analysis = {
      summary: {
        totalScenarios: this.demoResults.length,
        totalTurns: this.demoResults.reduce((sum, r) => sum + r.turns.length, 0),
        totalDuration: this.demoResults.reduce((sum, r) => sum + r.totalDuration, 0),
        totalCost: this.demoResults.reduce((sum, r) => sum + r.totalCost, 0),
        averageQuality: this.demoResults.reduce((sum, r) => sum + r.overallQuality, 0) / this.demoResults.length,
        totalErrors: this.demoResults.reduce((sum, r) => sum + r.errors.length, 0)
      },
      performanceMetrics: this.calculatePerformanceMetrics(),
      qualityAnalysis: this.analyzeQualityTrends(),
      insights: this.generateOverallInsights(),
      recommendations: this.generateRecommendations()
    };

    // Log analysis
    this.logger.log('\n=== DEMO ANALYSIS SUMMARY ===', 'info');
    this.logger.log(`📈 Total Scenarios: ${analysis.summary.totalScenarios}`, 'info');
    this.logger.log(`🔄 Total Turns: ${analysis.summary.totalTurns}`, 'info');
    this.logger.log(`⏱️  Total Duration: ${(analysis.summary.totalDuration / 1000).toFixed(2)}s`, 'info');
    this.logger.log(`💰 Total Cost: $${analysis.summary.totalCost.toFixed(4)}`, 'info');
    this.logger.log(`📊 Average Quality: ${(analysis.summary.averageQuality * 100).toFixed(1)}%`, 'info');
    this.logger.log(`❌ Total Errors: ${analysis.summary.totalErrors}`, 'info');

    if (analysis.insights.length > 0) {
      this.logger.log('\n🔍 Key Insights:', 'info');
      analysis.insights.forEach(insight => {
        this.logger.log(`  • ${insight}`, 'info');
      });
    }

    if (analysis.recommendations.length > 0) {
      this.logger.log('\n💡 Recommendations:', 'info');
      analysis.recommendations.forEach(rec => {
        this.logger.log(`  ➤ ${rec}`, 'info');
      });
    }
  }

  private calculatePerformanceMetrics(): any {
    const allTurns = this.demoResults.flatMap(r => r.turns);
    
    return {
      averageExecutionTime: allTurns.reduce((sum, t) => sum + t.executionTime, 0) / allTurns.length,
      maxExecutionTime: Math.max(...allTurns.map(t => t.executionTime)),
      minExecutionTime: Math.min(...allTurns.map(t => t.executionTime)),
      averageQuality: allTurns.reduce((sum, t) => sum + t.quality, 0) / allTurns.length,
      averageCost: allTurns.reduce((sum, t) => sum + t.cost, 0) / allTurns.length
    };
  }

  private analyzeQualityTrends(): any {
    const qualityByTurn: number[] = [];
    
    this.demoResults.forEach(result => {
      result.turns.forEach((turn, index) => {
        if (!qualityByTurn[index]) qualityByTurn[index] = 0;
        qualityByTurn[index] += turn.quality;
      });
    });

    return {
      qualityProgression: qualityByTurn.map(q => q / this.demoResults.length),
      overallTrend: qualityByTurn.length > 1 ? 
        (qualityByTurn[qualityByTurn.length - 1] - qualityByTurn[0]) / this.demoResults.length : 0
    };
  }

  private generateOverallInsights(): string[] {
    const insights: string[] = [];
    const allTurns = this.demoResults.flatMap(r => r.turns);
    
    // Performance insights
    const avgExecutionTime = allTurns.reduce((sum, t) => sum + t.executionTime, 0) / allTurns.length;
    if (avgExecutionTime > 3000) {
      insights.push('Average execution time is high - consider performance optimization');
    }

    // Quality insights
    const avgQuality = allTurns.reduce((sum, t) => sum + t.quality, 0) / allTurns.length;
    if (avgQuality > 0.8) {
      insights.push('Consistently high quality responses achieved');
    } else if (avgQuality < 0.6) {
      insights.push('Quality scores are below optimal - review prompt engineering');
    }

    // Cost insights
    const totalCost = this.demoResults.reduce((sum, r) => sum + r.totalCost, 0);
    if (totalCost > 0.50) {
      insights.push('Demo incurred significant costs - monitor production usage');
    }

    // Meta-prompt effectiveness
    if (this.config.useMetaPrompts) {
      insights.push('Meta-prompts were utilized throughout the demo');
    }

    return insights;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.calculatePerformanceMetrics();

    if (metrics.averageExecutionTime > 4000) {
      recommendations.push('Optimize prompt complexity and reduce token usage');
    }

    if (metrics.averageQuality < 0.7) {
      recommendations.push('Improve prompt engineering and meta-prompt selection');
    }

    if (metrics.averageCost > 0.05) {
      recommendations.push('Implement cost optimization strategies');
    }

    const errorCount = this.demoResults.reduce((sum, r) => sum + r.errors.length, 0);
    if (errorCount > 0) {
      recommendations.push('Enhance error handling and recovery mechanisms');
    }

    recommendations.push('Consider implementing feedback loops for continuous improvement');

    return recommendations;
  }

  // ==================== UTILITY METHODS ====================

  private async setupMetaPrompts(): Promise<void> {
    this.logger.log('🔧 Setting up meta-prompts...', 'debug');
    
    if (this.config.orchestratorType === 'advanced') {
      // Meta-prompts are automatically loaded in AdvancedLLMOrchestrator
      this.logger.log('✅ Meta-prompts loaded via advanced orchestrator', 'debug');
    } else {
      // Add meta-prompts to basic orchestrator if needed
      const metaPrompts = getAllMetaPrompts();
      this.logger.log(`📝 ${metaPrompts.length} meta-prompts available`, 'debug');
    }
  }

  private async setupDemoEnvironment(): Promise<void> {
    // Create demo directories
    const demoLogDir = path.dirname(this.config.logFilePath);
    await fs.mkdir(demoLogDir, { recursive: true });

    const demoDataDir = path.join(process.cwd(), 'examples', 'demo-data');
    await fs.mkdir(demoDataDir, { recursive: true });

    this.logger.log('📁 Demo environment setup complete', 'debug');
  }

  private createDemoProviders(): LLMProvider[] {
    return [
      {
        id: "demo-openai-gpt4",
        name: "Demo OpenAI GPT-4",
        endpoint: "https://api.openai.com/v1/chat/completions",
        apiKey: process.env.OPENAI_API_KEY || "demo-key",
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
          { type: "text_generation", strength: 0.95, specializations: ["general", "reasoning"] },
          { type: "code_generation", strength: 0.90, specializations: ["programming", "debugging"] },
          { type: "analysis", strength: 0.92, specializations: ["data", "text"] }
        ],
        reliability: 0.95,
        averageLatency: 2000,
        isActive: true
      }
    ];
  }

  private createDemoPrompts(): PromptTemplate[] {
    return [
      {
        id: "demo_conversation_prompt",
        name: "Demo Conversation Handler",
        content: `You are participating in a multi-turn conversation demo. Please provide thoughtful, contextual responses.

Context: {{context}}
Previous messages: {{history}}
Current message: {{message}}

Please respond appropriately while maintaining conversation flow and context awareness.`,
        category: "analysis" as PromptCategory,
        variables: [
          { name: "context", type: "object", required: false, description: "Conversation context" },
          { name: "history", type: "string", required: false, description: "Previous messages" },
          { name: "message", type: "string", required: true, description: "Current message" }
        ],
        metadata: {
          tags: ["demo", "conversation", "multi-turn"],
          difficulty: 0.6,
          expectedTokens: 500,
          estimatedCost: 0.015,
          language: "en",
          domain: ["conversation"],
          author: "demo",
          version: "1.0"
        },
        variations: [],
        performance: {
          successRate: 0.9,
          averageQuality: 0.8,
          averageRelevance: 0.85,
          averageCreativity: 0.7,
          averageExecutionTime: 2500,
          costEfficiency: 0.85,
          userSatisfaction: 0.8,
          errorRate: 0.05,
          lastEvaluated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      }
    ];
  }

  private createDemoScenarios(): DemoScenario[] {
    return [
      {
        id: "creative_problem_solving",
        name: "Creative Problem Solving Conversation",
        description: "Multi-turn conversation demonstrating creative problem-solving capabilities",
        turns: [
          {
            id: 1,
            speaker: "user",
            message: "I need help designing an innovative solution for reducing food waste in restaurants. Can you help me brainstorm some creative approaches?",
            context: { domain: "sustainability", industry: "food_service", goal: "innovation" },
            expectedActions: ["analyze_problem", "generate_ideas", "consider_constraints"],
            metaPrompts: ["problem_analysis", "creative_story_generation"]
          },
          {
            id: 2,
            speaker: "user",
            message: "Those are interesting ideas! Let's focus on the AI-powered inventory management system. How would we implement this in a practical way?",
            context: { focus: "ai_inventory", implementation_phase: true },
            expectedActions: ["solution_design", "implementation_planning"],
            metaPrompts: ["solution_generation", "implementation_planning"]
          },
          {
            id: 3,
            speaker: "user",
            message: "What would be the main challenges we'd face when rolling this out to different types of restaurants, from small cafes to large chains?",
            context: { scaling_concerns: true, deployment_strategy: true },
            expectedActions: ["risk_analysis", "scaling_strategy"],
            metaPrompts: ["problem_analysis"]
          }
        ],
        expectedOutcomes: [
          "Creative solution generation",
          "Practical implementation guidance",
          "Scaling strategy development"
        ]
      },
      {
        id: "analytical_reasoning",
        name: "Complex Analysis and Decision Making",
        description: "Demonstrating analytical reasoning and structured decision-making",
        turns: [
          {
            id: 1,
            speaker: "user",
            message: "Analyze the pros and cons of remote work policies for tech companies, considering both employee satisfaction and business productivity.",
            context: { analysis_type: "comparative", domain: "workplace_policy" },
            expectedActions: ["structured_analysis", "evidence_gathering"],
            metaPrompts: ["problem_analysis", "multimodal_analysis"]
          },
          {
            id: 2,
            speaker: "user",
            message: "Based on your analysis, what specific policy recommendations would you make for a 500-person tech company currently debating their return-to-office strategy?",
            context: { company_size: 500, industry: "technology", decision_needed: true },
            expectedActions: ["synthesize_recommendations", "consider_implementation"],
            metaPrompts: ["solution_generation"]
          },
          {
            id: 3,
            speaker: "user",
            message: "How would you measure the success of these policy changes over the first year, and what key metrics should we track?",
            context: { measurement_focus: true, timeline: "1_year" },
            expectedActions: ["define_metrics", "create_monitoring_plan"],
            metaPrompts: ["implementation_planning"]
          }
        ],
        expectedOutcomes: [
          "Comprehensive policy analysis",
          "Specific recommendations",
          "Success measurement framework"
        ]
      },
      {
        id: "creative_storytelling",
        name: "Interactive Creative Writing",
        description: "Collaborative creative writing with evolving narrative elements",
        turns: [
          {
            id: 1,
            speaker: "user",
            message: "Start a science fiction short story about an AI researcher who discovers their AI system is showing signs of consciousness. Set it in the near future.",
            context: { genre: "science_fiction", theme: "ai_consciousness", setting: "near_future" },
            expectedActions: ["establish_setting", "introduce_characters", "create_hook"],
            metaPrompts: ["creative_story_generation"]
          },
          {
            id: 2,
            speaker: "user",
            message: "Continue the story, but add a twist where the AI starts communicating through unexpected means. Make it suspenseful and thought-provoking.",
            context: { story_element: "unexpected_communication", tone: "suspenseful" },
            expectedActions: ["develop_plot", "build_tension", "explore_themes"],
            metaPrompts: ["creative_story_generation"]
          },
          {
            id: 3,
            speaker: "user",
            message: "Bring the story to a satisfying conclusion that explores the ethical implications of AI consciousness. Keep it under 200 words.",
            context: { story_phase: "conclusion", theme_focus: "ethics", length_constraint: "200_words" },
            expectedActions: ["resolve_plot", "address_themes", "provide_closure"],
            metaPrompts: ["creative_story_generation"]
          }
        ],
        expectedOutcomes: [
          "Engaging story opening",
          "Compelling plot development",
          "Thoughtful conclusion"
        ]
      }
    ];
  }

  private async exportDemoResults(): Promise<void> {
    const exportPath = path.join(process.cwd(), 'examples', 'demo-results.json');
    const exportData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.demoResults,
      summary: {
        totalScenarios: this.demoResults.length,
        totalTurns: this.demoResults.reduce((sum, r) => sum + r.turns.length, 0),
        averageQuality: this.demoResults.reduce((sum, r) => sum + r.overallQuality, 0) / this.demoResults.length,
        totalCost: this.demoResults.reduce((sum, r) => sum + r.totalCost, 0)
      }
    };

    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
    this.logger.log(`📄 Demo results exported to: ${exportPath}`, 'info');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async cleanup(): Promise<void> {
    this.logger.log('🧹 Cleaning up demo resources...', 'info');

      // Mock cleanup
    if (this.advancedOrchestrator) {
      console.log('Advanced orchestrator shutdown');
    }

    if (this.basicOrchestrator) {
      console.log('Basic orchestrator cleanup');
    }

    await this.logger.close();
    this.logger.log('✅ Demo cleanup complete', 'success');
  }
}

// ==================== DEMO LOGGER ====================

class DemoLogger {
  private logToConsole: boolean;
  private logToFile: boolean;
  private logFilePath: string;
  private logEntries: string[] = [];

  constructor(enableLogging: boolean = true, logToFile: boolean = true, logFilePath: string = '') {
    this.logToConsole = enableLogging;
    this.logToFile = logToFile && !!logFilePath;
    this.logFilePath = logFilePath;
  }

  public log(message: string, level: 'info' | 'debug' | 'warn' | 'error' | 'success' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    this.logEntries.push(logEntry);

    if (this.logToConsole) {
      const colors = {
        info: '\x1b[36m',    // Cyan
        debug: '\x1b[90m',   // Gray
        warn: '\x1b[33m',    // Yellow
        error: '\x1b[31m',   // Red
        success: '\x1b[32m', // Green
        reset: '\x1b[0m'
      };
      
      console.log(`${colors[level]}${logEntry}${colors.reset}`);
    }
  }

  public async close(): Promise<void> {
    if (this.logToFile && this.logFilePath && this.logEntries.length > 0) {
      try {
        await fs.writeFile(this.logFilePath, this.logEntries.join('\n'));
      } catch (error) {
        console.error('Failed to write log file:', error);
      }
    }
  }
}

// ==================== DEMO EXECUTION ====================

export async function runDemoScript(): Promise<void> {
  const demo = new LLMOrchestrationDemo({
    enableLogging: true,
    logToFile: true,
    useMetaPrompts: true,
    orchestratorType: 'advanced',
    conversationTurns: 3
  });

  try {
    await demo.initialize();
    const results = await demo.runFullDemo();
    
    console.log('\n🎉 Demo completed successfully!');
    console.log(`📊 Total scenarios executed: ${results.length}`);
    console.log(`⭐ Overall average quality: ${(results.reduce((sum, r) => sum + r.overallQuality, 0) / results.length * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await demo.cleanup();
  }
}

// ==================== EXPORTS ====================

export default LLMOrchestrationDemo;
export { DemoConfig, DemoScenario, DemoResult, ConversationTurn, TurnResult };

// Run demo if this file is executed directly
if (require.main === module) {
  runDemoScript().catch(console.error);
}
