import { Message, MessageContext } from '../types/Message';
import { LLMProvider, LLMResponse, QualityMetrics } from '../../mechanisms/llmOrchestration/index';
import { sanitizeLogInput, logger } from '../../shared/utils';

export interface LLMRequest {
  promptText: string;
  providerId: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  };
}

export interface ILLMClient {
  addProvider(provider: LLMProvider): void;
  removeProvider(providerId: string): boolean;
  callProvider(request: LLMRequest): Promise<LLMResponse>;
  listProviders(): LLMProvider[];
  getProvider(id: string): LLMProvider | null;
}

export class LLMClient implements ILLMClient {
  private providers: Map<string, LLMProvider> = new Map();

  constructor(providers: LLMProvider[] = []) {
    providers.forEach(provider => this.addProvider(provider));
  }

  addProvider(provider: LLMProvider): void {
    // Validate provider configuration
    if (!provider.apiKey || provider.apiKey.trim() === '') {
      logger.warn(`Provider ${provider.id} added without API key`);
    }
    this.providers.set(provider.id, provider);
    logger.info(`LLM provider added: ${provider.id} (${provider.name})`);
  }

  removeProvider(providerId: string): boolean {
    const existed = this.providers.has(providerId);
    if (existed) {
      this.providers.delete(providerId);
      logger.info(`LLM provider removed: ${providerId}`);
    }
    return existed;
  }

  async callProvider(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.getProvider(request.providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${request.providerId}`);
    }

    // Validate API key
    if (!provider.apiKey || provider.apiKey.trim() === '') {
      logger.error(`Provider ${provider.id} has no API key configured`);
      return this.createErrorResponse(
        provider.id,
        'Provider API key not configured',
        0
      );
    }

    // Validate prompt
    if (!request.promptText || request.promptText.trim().length === 0) {
      logger.warn('Empty prompt received');
      return this.createErrorResponse(
        provider.id,
        'Empty prompt',
        0
      );
    }

    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('LLM request started', {
      requestId,
      providerId: provider.id,
      providerName: provider.name,
      promptLength: request.promptText.length,
      model: provider.model,
    });

    try {
      // Check rate limits
      if (!this.checkRateLimit(provider)) {
        logger.warn('Rate limit exceeded', {
          providerId: provider.id,
          currentUsage: provider.rateLimits.currentUsage,
        });
        return this.createErrorResponse(
          provider.id,
          'Rate limit exceeded',
          Date.now() - startTime
        );
      }

      // Make API call
      const response = await this.makeAPICall(provider, request.promptText, request.options);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Update rate limit tracking
      this.updateRateLimit(provider, response.totalTokens);

      logger.info('LLM request completed', {
        requestId,
        providerId: provider.id,
        latency: `${latency}ms`,
        tokens: response.totalTokens,
        cost: response.totalTokens * provider.costPerToken,
      });

      return {
        providerId: provider.id,
        promptId: 'runtime',
        output: response.content,
        tokens: {
          prompt: response.promptTokens,
          completion: response.completionTokens,
          total: response.totalTokens
        },
        cost: response.totalTokens * provider.costPerToken,
        latency,
        quality: this.assessResponseQuality(response.content, request.promptText),
        timestamp: new Date()
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;

      logger.error('LLM request failed', {
        requestId,
        providerId: provider.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: `${latency}ms`,
      });

      return this.createErrorResponse(
        provider.id,
        error instanceof Error ? error.message : 'Unknown error',
        latency
      );
    }
  }

  listProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  getProvider(id: string): LLMProvider | null {
    return this.providers.get(id) || null;
  }

  private async makeAPICall(
    provider: LLMProvider,
    prompt: string,
    options?: LLMRequest['options']
  ): Promise<{ content: string; promptTokens: number; completionTokens: number; totalTokens: number }> {
    const controller = new AbortController();
    const timeout = options?.timeout || 30000; // Default 30s timeout
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const endpoint = this.buildEndpoint(provider);
      const payload = this.buildPayload(provider, prompt, options);

      logger.debug('Making API call', {
        provider: provider.id,
        endpoint: sanitizeLogInput(endpoint),
        model: provider.model,
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
          ...(provider.id.startsWith('anthropic-') && {
            'x-api-key': provider.apiKey,
            'anthropic-version': '2023-06-01',
          }),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        logger.error('API error response', {
          provider: provider.id,
          status: response.status,
          statusText: response.statusText,
          body: sanitizeLogInput(errorBody.substring(0, 500)),
        });

        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        } else if (response.status >= 500) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        } else {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      const result = this.parseResponse(provider, data);

      logger.debug('API response parsed', {
        provider: provider.id,
        tokens: result.totalTokens,
        contentLength: result.content.length,
      });

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach API endpoint');
      }

      throw error;
    }
  }

  private buildEndpoint(provider: LLMProvider): string {
    // Map provider IDs to actual API endpoints
    if (provider.id.startsWith('openai-')) {
      return 'https://api.openai.com/v1/chat/completions';
    } else if (provider.id.startsWith('anthropic-')) {
      return 'https://api.anthropic.com/v1/messages';
    } else if (provider.id.startsWith('google-')) {
      return `https://generativelanguage.googleapis.com/v1/models/${provider.model}:generateContent`;
    }
    return provider.endpoint;
  }

  private buildPayload(
    provider: LLMProvider,
    prompt: string,
    options?: LLMRequest['options']
  ): any {
    const temperature = options?.temperature ?? provider.temperature;
    const maxTokens = options?.maxTokens ?? provider.maxTokens;

    if (provider.id.startsWith('openai-')) {
      return {
        model: provider.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature,
        top_p: provider.topP,
        frequency_penalty: provider.frequencyPenalty,
        presence_penalty: provider.presencePenalty,
      };
    } else if (provider.id.startsWith('anthropic-')) {
      return {
        model: provider.model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'user', content: prompt }
        ],
      };
    } else if (provider.id.startsWith('google-')) {
      return {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature,
          topP: provider.topP,
          maxOutputTokens: maxTokens,
        },
      };
    }

    // Generic fallback
    return {
      model: provider.model,
      prompt,
      max_tokens: maxTokens,
      temperature,
    };
  }

  private parseResponse(provider: LLMProvider, data: any): {
    content: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    try {
      if (provider.id.startsWith('openai-')) {
        const choice = data.choices[0];
        const usage = data.usage;
        return {
          content: choice?.message?.content || '',
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        };
      } else if (provider.id.startsWith('anthropic-')) {
        const usage = data.usage;
        return {
          content: data.content?.[0]?.text || '',
          promptTokens: usage?.input_tokens || 0,
          completionTokens: usage?.output_tokens || 0,
          totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
        };
      } else if (provider.id.startsWith('google-')) {
        const candidate = data.candidates?.[0];
        return {
          content: candidate?.content?.parts?.[0]?.text || '',
          promptTokens: 0, // Google doesn't always provide token counts
          completionTokens: 0,
          totalTokens: 0,
        };
      }

      // Generic fallback
      return {
        content: data.text || data.content || data.response || '',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    } catch (error) {
      logger.error('Failed to parse API response', {
        provider: provider.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to parse API response');
    }
  }

  private assessResponseQuality(content: string, prompt: string): QualityMetrics {
    if (!content || content.trim().length === 0) {
      return {
        relevance: 0,
        coherence: 0,
        creativity: 0,
        accuracy: 0,
        completeness: 0,
        overall: 0,
      };
    }

    const relevance = this.calculateRelevance(content, prompt);
    const coherence = this.calculateCoherence(content);
    const creativity = this.calculateCreativity(content);
    const accuracy = this.calculateAccuracy(content);
    const completeness = this.calculateCompleteness(content, prompt);

    const overall = (relevance + coherence + creativity + accuracy + completeness) / 5;

    return {
      relevance,
      coherence,
      creativity,
      accuracy,
      completeness,
      overall,
    };
  }

  private calculateRelevance(content: string, prompt: string): number {
    // Check if response addresses prompt keywords
    const promptWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contentLower = content.toLowerCase();
    const matches = promptWords.filter(w => contentLower.includes(w)).length;
    return promptWords.length > 0 ? matches / promptWords.length : 0.5;
  }

  private calculateCoherence(content: string): number {
    // Check for logical flow indicators
    const flowIndicators = [
      'first', 'second', 'third', 'therefore', 'however', 'moreover',
      'in conclusion', 'to summarize', 'consequently', 'thus', 'hence'
    ];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const contentLower = content.toLowerCase();
    const hasIndicators = flowIndicators.filter(i => contentLower.includes(i)).length;
    
    const sentenceScore = sentences.length > 0 ? Math.min(1, hasIndicators / Math.max(1, sentences.length)) : 0;
    return 0.5 + sentenceScore * 0.5;
  }

  private calculateCreativity(content: string): number {
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return 0;
    
    const uniqueWords = new Set(words).size;
    const vocabularyDiversity = uniqueWords / words.length;
    
    // Bonus for varied sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
    const avgSentenceLength = sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(1, sentenceLengths.length);
    const sentenceVariance = sentenceLengths.reduce((sum, len) => sum + Math.abs(len - avgSentenceLength), 0) / Math.max(1, sentenceLengths.length);
    
    return Math.min(1, vocabularyDiversity * 0.7 + Math.min(1, sentenceVariance / 10) * 0.3);
  }

  private calculateAccuracy(content: string): number {
    // Check for hedging language that might indicate uncertainty
    const uncertaintyMarkers = [
      'might', 'could', 'possibly', 'perhaps', 'uncertain',
      'i think', 'i believe', 'probably', 'maybe'
    ];
    const contentLower = content.toLowerCase();
    const hasUncertainty = uncertaintyMarkers.filter(m => contentLower.includes(m)).length;
    return Math.max(0.5, 1 - (hasUncertainty / uncertaintyMarkers.length) * 0.5);
  }

  private calculateCompleteness(content: string, prompt: string): number {
    // Check response length relative to prompt complexity
    const promptWords = prompt.split(/\s+/).length;
    const responseWords = content.split(/\s+/).length;
    const idealRatio = 3; // Response should be ~3x prompt length
    const actualRatio = responseWords / Math.max(1, promptWords);
    return Math.min(1, actualRatio / idealRatio);
  }

  private checkRateLimit(provider: LLMProvider): boolean {
    const now = new Date();
    const usage = provider.rateLimits.currentUsage;
    
    // Check if we need to reset the counter
    if (now > usage.resetTime) {
      usage.requests = 0;
      usage.tokens = 0;
      usage.resetTime = new Date(now.getTime() + 60000); // Reset after 1 minute
    }
    
    return usage.requests < provider.rateLimits.requestsPerMinute &&
           usage.tokens < provider.rateLimits.tokensPerMinute;
  }

  private updateRateLimit(provider: LLMProvider, tokensUsed: number): void {
    provider.rateLimits.currentUsage.requests += 1;
    provider.rateLimits.currentUsage.tokens += tokensUsed;
  }

  private createErrorResponse(
    providerId: string,
    errorMessage: string,
    latency: number
  ): LLMResponse {
    return {
      providerId,
      promptId: 'runtime',
      output: '',
      tokens: { prompt: 0, completion: 0, total: 0 },
      cost: 0,
      latency,
      quality: {
        relevance: 0,
        coherence: 0,
        creativity: 0,
        accuracy: 0,
        completeness: 0,
        overall: 0,
      },
      error: errorMessage,
      timestamp: new Date(),
    };
  }

  // Factory method for dependency injection
  static create(providers: LLMProvider[] = []): ILLMClient {
    return new LLMClient(providers);
  }
}
