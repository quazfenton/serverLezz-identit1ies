// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Real LLM Client
// OpenAI • Anthropic • Google AI Integration with Retry Logic
// ═══════════════════════════════════════════════════════════════════════════════

import axios, { AxiosError } from 'axios';
import { logger } from '../middleware';
import { sanitizeLogInput } from '../middleware/auth';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type LLMProvider = 'openai' | 'anthropic' | 'google';

export interface LLMConfig {
  openai?: {
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  anthropic?: {
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  google?: {
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
}

export interface LLMRequest {
  provider: LLMProvider;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  finishReason?: string;
}

export interface QualityMetrics {
  relevance: number;
  coherence: number;
  creativity: number;
  accuracy: number;
  completeness: number;
  overall: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Retry Configuration
// ═══════════════════════════════════════════════════════════════════════════════

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  retryableStatusCodes: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  exponentialBase: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Error Classes
// ═══════════════════════════════════════════════════════════════════════════════

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: LLMProvider,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class RateLimitError extends LLMError {
  constructor(
    message: string,
    provider: LLMProvider,
    public readonly retryAfter?: number
  ) {
    super(message, provider, 429, true);
    this.name = 'RateLimitError';
  }
}

export class TimeoutError extends LLMError {
  constructor(message: string, provider: LLMProvider) {
    super(message, provider, 408, true);
    this.name = 'TimeoutError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM Client
// ═══════════════════════════════════════════════════════════════════════════════

export class LLMClient {
  private config: LLMConfig;
  private retryConfig: RetryConfig;

  constructor(config: LLMConfig, retryConfig?: Partial<RetryConfig>) {
    this.config = config;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

    // Validate configuration
    this.validateConfig();
  }

  private validateConfig(): void {
    const providers = Object.keys(this.config) as LLMProvider[];
    if (providers.length === 0) {
      logger.warn('No LLM providers configured - AI features will be disabled');
    }

    for (const provider of providers) {
      const providerConfig = this.config[provider];
      if (providerConfig && !providerConfig.apiKey) {
        logger.warn(`${provider} API key not configured`);
      }
    }
  }

  /**
   * Call LLM with automatic retry and fallback
   */
  async call(request: LLMRequest): Promise<LLMResponse> {
    const { provider, timeout = 30000 } = request;

    // Check if provider is configured
    const providerConfig = this.config[provider];
    if (!providerConfig?.apiKey) {
      throw new LLMError(
        `${provider} not configured`,
        provider,
        400,
        false
      );
    }

    // Attempt with retries
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(provider, request, providerConfig, timeout);
        
        logger.info('LLM request successful', {
          provider,
          model: providerConfig.model,
          attempt: attempt + 1,
          latency: response.latency,
          tokens: response.usage.totalTokens,
        });

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if retryable
        const isRetryable = this.isRetryableError(error, provider);
        if (!isRetryable || attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        logger.warn(`LLM request failed, retrying in ${delay}ms`, {
          provider,
          attempt: attempt + 1,
          error: lastError.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Make request to specific provider
   */
  private async makeRequest(
    provider: LLMProvider,
    request: LLMRequest,
    providerConfig: any,
    timeout: number
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    switch (provider) {
      case 'openai':
        return this.callOpenAI(request, providerConfig, timeout);
      case 'anthropic':
        return this.callAnthropic(request, providerConfig, timeout);
      case 'google':
        return this.callGoogle(request, providerConfig, timeout);
      default:
        throw new LLMError(`Unknown provider: ${provider}`, provider, 400);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(
    request: LLMRequest,
    config: any,
    timeout: number
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const url = config.baseUrl || 'https://api.openai.com/v1/chat/completions';

    const response = await axios.post(
      url,
      {
        model: config.model || 'gpt-4o-mini',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          { role: 'user' as const, content: request.prompt },
        ],
        max_tokens: request.maxTokens || 1024,
        temperature: request.temperature ?? 0.7,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stop: request.stopSequences,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        timeout,
      }
    );

    const data = response.data;
    const latency = Date.now() - startTime;

    return {
      content: data.choices[0]?.message?.content || '',
      provider: 'openai',
      model: config.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      latency,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(
    request: LLMRequest,
    config: any,
    timeout: number
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const url = config.baseUrl || 'https://api.anthropic.com/v1/messages';

    const response = await axios.post(
      url,
      {
        model: config.model || 'claude-sonnet-4-20250514',
        max_tokens: request.maxTokens || 1024,
        system: request.systemPrompt,
        messages: [
          { role: 'user' as const, content: request.prompt },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeout,
      }
    );

    const data = response.data;
    const latency = Date.now() - startTime;

    return {
      content: data.content?.[0]?.text || '',
      provider: 'anthropic',
      model: config.model,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      latency,
      finishReason: data.stop_reason,
    };
  }

  /**
   * Call Google AI API
   */
  private async callGoogle(
    request: LLMRequest,
    config: any,
    timeout: number
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const url = config.baseUrl || 
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-2.0-flash'}:generateContent`;

    const response = await axios.post(
      `${url}?key=${config.apiKey}`,
      {
        contents: [{
          parts: [{ text: request.prompt }]
        }],
        generationConfig: {
          maxOutputTokens: request.maxTokens || 1024,
          temperature: request.temperature ?? 0.7,
          topP: request.topP,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout,
      }
    );

    const data = response.data;
    const latency = Date.now() - startTime;

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      provider: 'google',
      model: config.model,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      latency,
      finishReason: data.candidates?.[0]?.finishReason,
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any, provider: LLMProvider): boolean {
    if (error instanceof TimeoutError) return true;
    if (error instanceof RateLimitError) return true;
    
    if (error instanceof LLMError) {
      return error.retryable;
    }

    if (error instanceof AxiosError) {
      const status = error.response?.status;
      if (status && this.retryConfig.retryableStatusCodes.includes(status)) {
        return true;
      }
      
      // Check for rate limit headers
      if (status === 429) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(
      this.retryConfig.exponentialBase,
      attempt
    );
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelay);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Assess response quality
   */
  assessQuality(response: string, prompt: string): QualityMetrics {
    const metrics: QualityMetrics = {
      relevance: this.calculateRelevance(response, prompt),
      coherence: this.calculateCoherence(response),
      creativity: this.calculateCreativity(response),
      accuracy: this.calculateAccuracy(response),
      completeness: this.calculateCompleteness(response, prompt),
      overall: 0,
    };

    metrics.overall = (
      metrics.relevance +
      metrics.coherence +
      metrics.creativity +
      metrics.accuracy +
      metrics.completeness
    ) / 5;

    return metrics;
  }

  private calculateRelevance(response: string, prompt: string): number {
    const promptWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const responseLower = response.toLowerCase();
    const matches = promptWords.filter(w => responseLower.includes(w)).length;
    return matches / promptWords.length;
  }

  private calculateCoherence(response: string): number {
    const flowIndicators = ['first', 'second', 'therefore', 'however', 'in conclusion', 'moreover', 'furthermore'];
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const hasIndicators = flowIndicators.filter(i => response.toLowerCase().includes(i)).length;
    return Math.min(1, (sentences.length > 0 ? hasIndicators / sentences.length : 0) + 0.5);
  }

  private calculateCreativity(response: string): number {
    const uniqueWords = new Set(response.toLowerCase().split(/\s+/)).size;
    const totalWords = response.split(/\s+/).length;
    return totalWords > 0 ? Math.min(1, uniqueWords / totalWords) : 0;
  }

  private calculateAccuracy(response: string): number {
    const uncertaintyMarkers = ['might', 'could', 'possibly', 'perhaps', 'uncertain', 'i think'];
    const hasUncertainty = uncertaintyMarkers.filter(m => response.toLowerCase().includes(m)).length;
    return Math.max(0.5, 1 - (hasUncertainty / uncertaintyMarkers.length));
  }

  private calculateCompleteness(response: string, prompt: string): number {
    const promptComplexity = prompt.split(/\s+/).length;
    const responseLength = response.split(/\s+/).length;
    const idealRatio = 3;
    const actualRatio = responseLength / promptComplexity;
    return Math.min(1, actualRatio / idealRatio);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

export function createLLMClient(config: LLMConfig): LLMClient {
  return new LLMClient(config);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default Export
// ═══════════════════════════════════════════════════════════════════════════════

export default LLMClient;
