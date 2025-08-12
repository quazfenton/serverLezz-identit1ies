import { Message } from '../types/Message';
import { LLMResponse, OrchestrationStrategy } from '../../mechanisms/llmOrchestration/index';
import { ILLMClient, LLMRequest } from './LLMClient';

export interface RoutingDecision {
  strategy: OrchestrationStrategy;
  providerIds: string[];
  priority: number;
  timeout?: number;
}

export interface IToolRouter {
  route(
    promptText: string,
    availableProviders: string[],
    context?: any
  ): Promise<RoutingDecision>;
  
  executeStrategy(
    promptText: string,
    decision: RoutingDecision,
    llmClient: ILLMClient
  ): Promise<LLMResponse[]>;
}

export class ToolRouter implements IToolRouter {
  constructor(private defaultStrategy: OrchestrationStrategy = 'sequential') {}

  async route(
    promptText: string,
    availableProviders: string[],
    context?: any
  ): Promise<RoutingDecision> {
    // Simple routing logic - can be enhanced with ML-based decisions
    const strategy = this.selectStrategy(promptText, context);
    const providerIds = this.selectProviders(availableProviders, strategy, context);

    return {
      strategy,
      providerIds,
      priority: context?.priority || 1,
      timeout: context?.timeout || 30000
    };
  }

  async executeStrategy(
    promptText: string,
    decision: RoutingDecision,
    llmClient: ILLMClient
  ): Promise<LLMResponse[]> {
    const { strategy, providerIds } = decision;

    switch (strategy) {
      case 'sequential':
        return this.executeSequential(promptText, providerIds, llmClient);
      case 'parallel':
        return this.executeParallel(promptText, providerIds, llmClient);
      case 'fallback':
        return this.executeFallback(promptText, providerIds, llmClient);
      case 'ensemble':
        return this.executeEnsemble(promptText, providerIds, llmClient);
      case 'adaptive':
        return this.executeAdaptive(promptText, providerIds, llmClient);
      case 'competitive':
        return this.executeCompetitive(promptText, providerIds, llmClient);
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  private selectStrategy(promptText: string, context?: any): OrchestrationStrategy {
    // Simple heuristics for strategy selection
    if (context?.strategy) {
      return context.strategy;
    }

    if (context?.priority >= 3) {
      return 'ensemble'; // High priority gets ensemble for quality
    }

    if (context?.timeout && context.timeout < 10000) {
      return 'fallback'; // Low timeout gets fallback for speed
    }

    if (promptText.includes('creative') || promptText.includes('innovative')) {
      return 'competitive'; // Creative tasks benefit from competition
    }

    return this.defaultStrategy;
  }

  private selectProviders(
    availableProviders: string[],
    strategy: OrchestrationStrategy,
    context?: any
  ): string[] {
    if (context?.providers) {
      return context.providers.filter((p: string) => availableProviders.includes(p));
    }

    // Default selection logic
    switch (strategy) {
      case 'sequential':
      case 'adaptive':
        return availableProviders.slice(0, 2); // Use first 2 providers
      case 'parallel':
      case 'ensemble':
      case 'competitive':
        return availableProviders; // Use all providers
      case 'fallback':
        return availableProviders.slice(0, 3); // Use first 3 for fallback chain
      default:
        return availableProviders.slice(0, 1); // Default to first provider
    }
  }

  private async executeSequential(
    promptText: string,
    providerIds: string[],
    llmClient: ILLMClient
  ): Promise<LLMResponse[]> {
    const responses: LLMResponse[] = [];
    let currentPrompt = promptText;

    for (const providerId of providerIds) {
      try {
        const request: LLMRequest = {
          promptText: currentPrompt,
          providerId
        };
        const response = await llmClient.callProvider(request);
        responses.push(response);
        
        // Use response as context for next provider
        currentPrompt = `${promptText}\n\nPrevious response: ${response.output}`;
      } catch (error) {
        console.error(`Provider ${providerId} failed in sequential execution:`, error);
      }
    }

    return responses;
  }

  private async executeParallel(
    promptText: string,
    providerIds: string[],
    llmClient: ILLMClient
  ): Promise<LLMResponse[]> {
    const promises = providerIds.map(providerId => {
      const request: LLMRequest = {
        promptText,
        providerId
      };
      return llmClient.callProvider(request);
    });

    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<LLMResponse> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  private async executeFallback(
    promptText: string,
    providerIds: string[],
    llmClient: ILLMClient
  ): Promise<LLMResponse[]> {
    for (const providerId of providerIds) {
      try {
        const request: LLMRequest = {
          promptText,
          providerId
        };
        const response = await llmClient.callProvider(request);
        return [response]; // Return first successful response
      } catch (error) {
        console.error(`Provider ${providerId} failed, trying next:`, error);
      }
    }

    throw new Error('All providers failed in fallback strategy');
  }

  private async executeEnsemble(
    promptText: string,
    providerIds: string[],
    llmClient: ILLMClient
  ): Promise<LLMResponse[]> {
    // Similar to parallel but with consensus building
    const responses = await this.executeParallel(promptText, providerIds, llmClient);
    
    // Add consensus metrics
    responses.forEach(response => {
      response.quality.overall = this.calculateConsensusScore(response, responses);
    });

    return responses;
  }

  private async executeAdaptive(
    promptText: string,
    providerIds: string[],
    llmClient: ILLMClient
  ): Promise<LLMResponse[]> {
    // Start with best performing provider, adapt based on results
    const responses: LLMResponse[] = [];
    
    for (const providerId of providerIds) {
      try {
        const request: LLMRequest = {
          promptText,
          providerId
        };
        const response = await llmClient.callProvider(request);
        responses.push(response);
        
        // Adapt strategy based on response quality
        if (response.quality.overall > 0.8) {
          break; // Good enough, stop here
        }
      } catch (error) {
        console.error(`Provider ${providerId} failed in adaptive execution:`, error);
      }
    }

    return responses;
  }

  private async executeCompetitive(
    promptText: string,
    providerIds: string[],
    llmClient: ILLMClient
  ): Promise<LLMResponse[]> {
    const responses = await this.executeParallel(promptText, providerIds, llmClient);
    
    // Rank responses and return top performers
    const rankedResponses = responses.sort((a, b) => b.quality.overall - a.quality.overall);
    
    return rankedResponses.slice(0, Math.min(3, rankedResponses.length));
  }

  private calculateConsensusScore(response: LLMResponse, allResponses: LLMResponse[]): number {
    // Mock consensus score calculation
    return Math.random() * 0.3 + 0.7;
  }

  // Factory method for dependency injection
  static create(defaultStrategy: OrchestrationStrategy = 'sequential'): IToolRouter {
    return new ToolRouter(defaultStrategy);
  }
}
