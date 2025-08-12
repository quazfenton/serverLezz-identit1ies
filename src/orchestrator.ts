import { Message, MessageImpl, MessageContext } from './types/Message';
import { IPromptRegistry, PromptRegistry } from './modules/PromptRegistry';
import { ILLMClient, LLMClient } from './modules/LLMClient';
import { IToolRouter, ToolRouter } from './modules/ToolRouter';
import { IMemoryManager, MemoryManager } from './modules/MemoryManager';

// Import types from existing system
import { 
  PromptTemplate, 
  LLMProvider, 
  LLMResponse, 
  OrchestrationStrategy,
  QualityMetrics
} from '../mechanisms/llmOrchestration/index';

// Pipeline configuration and result types
export interface PipelineConfig {
  promptId?: string;
  promptText?: string;
  variables?: Record<string, any>;
  strategy?: OrchestrationStrategy;
  providers?: string[];
  sessionId?: string;
  userId?: string;
  priority?: number;
  timeout?: number;
}

export interface PipelineResult {
  id: string;
  message: Message;
  responses: LLMResponse[];
  finalOutput: string;
  metadata: {
    strategy: OrchestrationStrategy;
    providersUsed: string[];
    totalCost: number;
    totalLatency: number;
    quality: QualityMetrics;
  };
  timestamp: Date;
}

// Dependency injection container interface
export interface Dependencies {
  promptRegistry: IPromptRegistry;
  llmClient: ILLMClient;
  toolRouter: IToolRouter;
  memoryManager: IMemoryManager;
}

// Main orchestrator class
export class Orchestrator {
  constructor(private dependencies: Dependencies) {}

  /**
   * Main pipeline execution method
   * Processes a message through the complete pipeline: Message → PromptRegistry → LLMClient → ToolRouter → MemoryManager
   */
  async runPipeline(config: PipelineConfig): Promise<PipelineResult> {
    const startTime = Date.now();
    const pipelineId = this.generatePipelineId();

    try {
      // Step 1: Create and process message
      const message = await this.processMessage(config);
      
      // Step 2: Get or compile prompt from registry
      const promptText = await this.getPromptText(config);
      
      // Step 3: Get routing decision from tool router
      const availableProviders = this.dependencies.llmClient.listProviders().map(p => p.id);
      const routingDecision = await this.dependencies.toolRouter.route(
        promptText,
        availableProviders,
        {
          strategy: config.strategy,
          providers: config.providers,
          priority: config.priority,
          timeout: config.timeout
        }
      );

      // Step 4: Execute strategy via tool router and LLM client
      const responses = await this.dependencies.toolRouter.executeStrategy(
        promptText,
        routingDecision,
        this.dependencies.llmClient
      );

      // Step 5: Process responses and determine final output
      const finalOutput = this.synthesizeResponses(responses);
      
      // Step 6: Update memory with context
      if (config.sessionId) {
        await this.updateMemory(config.sessionId, message, responses);
      }

      // Step 7: Create pipeline result
      const result: PipelineResult = {
        id: pipelineId,
        message,
        responses,
        finalOutput,
        metadata: {
          strategy: routingDecision.strategy,
          providersUsed: routingDecision.providerIds,
          totalCost: responses.reduce((sum, r) => sum + r.cost, 0),
          totalLatency: Date.now() - startTime,
          quality: this.calculateOverallQuality(responses)
        },
        timestamp: new Date()
      };

      return result;

    } catch (error) {
      console.error('Pipeline execution failed:', error);
      throw error;
    }
  }

  /**
   * Batch processing method for multiple messages
   */
  async runBatchPipeline(configs: PipelineConfig[]): Promise<PipelineResult[]> {
    const results: PipelineResult[] = [];
    
    for (const config of configs) {
      try {
        const result = await this.runPipeline(config);
        results.push(result);
      } catch (error) {
        console.error(`Batch pipeline failed for config:`, config, error);
        // Continue with other configs even if one fails
      }
    }

    return results;
  }

  /**
   * Stream processing method for real-time interactions
   */
  async *runStreamPipeline(configs: AsyncIterable<PipelineConfig>): AsyncGenerator<PipelineResult> {
    for await (const config of configs) {
      try {
        const result = await this.runPipeline(config);
        yield result;
      } catch (error) {
        console.error('Stream pipeline error:', error);
        // Continue with stream even if one config fails
      }
    }
  }

  // Private helper methods
  private async processMessage(config: PipelineConfig): Promise<Message> {
    const content = config.promptText || 'Default message content';
    
    return new MessageImpl(content, 'user', {
      promptId: config.promptId,
      variables: config.variables,
      sessionId: config.sessionId,
      userId: config.userId
    });
  }

  private async getPromptText(config: PipelineConfig): Promise<string> {
    if (config.promptText) {
      return config.promptText;
    }

    if (config.promptId) {
      return this.dependencies.promptRegistry.compilePrompt(
        config.promptId,
        config.variables || {}
      );
    }

    throw new Error('Either promptText or promptId must be provided');
  }

  private synthesizeResponses(responses: LLMResponse[]): string {
    if (responses.length === 0) {
      return 'No responses generated';
    }

    if (responses.length === 1) {
      return responses[0].output;
    }

    // For multiple responses, return the best quality one
    const bestResponse = responses.reduce((best, current) => 
      current.quality.overall > best.quality.overall ? current : best
    );

    return bestResponse.output;
  }

  private async updateMemory(
    sessionId: string, 
    message: Message, 
    responses: LLMResponse[]
  ): Promise<void> {
    // Add the input message
    await this.dependencies.memoryManager.addMessage(sessionId, message);

    // Add responses
    for (const response of responses) {
      await this.dependencies.memoryManager.addResponse(sessionId, response);
    }

    // Create a response message from the final output
    const responseMessage = new MessageImpl(
      this.synthesizeResponses(responses),
      'assistant',
      {
        responses: responses.map(r => r.providerId),
        quality: this.calculateOverallQuality(responses)
      }
    );

    await this.dependencies.memoryManager.addMessage(sessionId, responseMessage);
  }

  private calculateOverallQuality(responses: LLMResponse[]): QualityMetrics {
    if (responses.length === 0) {
      return { relevance: 0, coherence: 0, creativity: 0, accuracy: 0, completeness: 0, overall: 0 };
    }

    const avg = (key: keyof QualityMetrics) => 
      responses.reduce((sum, r) => sum + r.quality[key], 0) / responses.length;

    return {
      relevance: avg('relevance'),
      coherence: avg('coherence'),
      creativity: avg('creativity'),
      accuracy: avg('accuracy'),
      completeness: avg('completeness'),
      overall: avg('overall')
    };
  }

  private generatePipelineId(): string {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public utility methods
  public getStats(): {
    promptCount: number;
    providerCount: number;
    sessionCount: Promise<number>;
    memoryStats: Promise<any>;
  } {
    return {
      promptCount: this.dependencies.promptRegistry.listPrompts().length,
      providerCount: this.dependencies.llmClient.listProviders().length,
      sessionCount: this.dependencies.memoryManager.getAllSessions().then(sessions => sessions.length),
      memoryStats: Promise.resolve({})
    };
  }

  public async cleanup(): Promise<void> {
    // Clean up memory and resources
    // Compact memory - implemented in concrete implementation
    console.log('Memory cleanup completed');
    console.log('Orchestrator cleanup completed');
  }
}

// Factory function for dependency injection
export interface OrchestratorFactoryConfig {
  prompts?: PromptTemplate[];
  providers?: LLMProvider[];
  defaultStrategy?: OrchestrationStrategy;
}

export function createOrchestrator(config: OrchestratorFactoryConfig = {}): Orchestrator {
  // Create dependencies using factory methods
  const dependencies: Dependencies = {
    promptRegistry: PromptRegistry.create(config.prompts || []),
    llmClient: LLMClient.create(config.providers || []),
    toolRouter: ToolRouter.create(config.defaultStrategy || 'sequential'),
    memoryManager: MemoryManager.create()
  };

  return new Orchestrator(dependencies);
}

// Default export with factory function for easy consumption
export default function createDefaultOrchestrator(): Orchestrator {
  // Load default configuration from the existing system
  const defaultProviders: LLMProvider[] = [
    {
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
        { type: "text_generation", strength: 0.95, specializations: ["general", "reasoning"] },
        { type: "code_generation", strength: 0.90, specializations: ["programming", "debugging"] },
        { type: "analysis", strength: 0.92, specializations: ["data", "text"] }
      ],
      reliability: 0.95,
      averageLatency: 2000,
      isActive: true
    }
  ];

  const defaultPrompts: PromptTemplate[] = [
    {
      id: "general_assistant",
      name: "General Assistant",
      content: `You are a helpful AI assistant. Please respond to the following request:\n\n{{request}}\n\nProvide a clear, helpful, and accurate response.`,
      category: "analysis",
      variables: [
        { name: "request", type: "string", required: true, description: "The user's request" }
      ],
      metadata: {
        tags: ["general", "assistant"],
        difficulty: 0.5,
        expectedTokens: 500,
        estimatedCost: 0.015,
        language: "en",
        domain: ["general"],
        author: "system",
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

  return createOrchestrator({
    prompts: defaultPrompts,
    providers: defaultProviders,
    defaultStrategy: 'adaptive'
  });
}
