import { LLMResponse, QualityMetrics, OrchestrationResponse } from './index';

// ==================== ERROR HANDLING ====================

export class LLMOrchestrationError extends Error {
  public readonly code: string;
  public readonly details: any;
  public readonly retryable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    details?: any,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'LLMOrchestrationError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
    this.timestamp = new Date();
  }
}

export class RetryableError extends LLMOrchestrationError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, details, true);
  }
}

export class NonRetryableError extends LLMOrchestrationError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, details, false);
  }
}

// ==================== RETRY LOGIC ====================

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
}

export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        'RATE_LIMIT_EXCEEDED',
        'TIMEOUT',
        'NETWORK_ERROR',
        'TEMPORARY_UNAVAILABLE',
        'INTERNAL_SERVER_ERROR'
      ],
      ...config
    };
  }

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string = 'operation'
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (!this.shouldRetry(error as Error, attempt)) {
          throw error;
        }
        
        const delay = this.calculateDelay(attempt);
        console.warn(
          `${context} failed (attempt ${attempt}/${this.config.maxAttempts}): ${lastError.message}. Retrying in ${delay}ms...`
        );
        
        await this.sleep(delay);
      }
    }
    
    throw new NonRetryableError(
      `${context} failed after ${this.config.maxAttempts} attempts`,
      'MAX_RETRIES_EXCEEDED',
      { lastError: lastError?.message || 'Unknown error' }
    );
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.config.maxAttempts) {
      return false;
    }
    
    if (error instanceof LLMOrchestrationError) {
      return error.retryable;
    }
    
    // Check if error code is in retryable list
    const errorCode = this.extractErrorCode(error);
    return this.config.retryableErrors.includes(errorCode);
  }

  private extractErrorCode(error: Error): string {
    if (error instanceof LLMOrchestrationError) {
      return error.code;
    }
    
    // Extract from common error patterns
    if (error.message.includes('rate limit')) return 'RATE_LIMIT_EXCEEDED';
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('500')) return 'INTERNAL_SERVER_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.config.maxDelay);
    
    if (this.config.jitter) {
      // Add random jitter (±25%)
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }
    
    return Math.max(delay, 0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== CIRCUIT BREAKER ====================

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  monitoringPeriod: number; // milliseconds
  minimumRequests: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private requestCount: number = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 0.5, // 50% failure rate
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      minimumRequests: 10,
      ...config
    };
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new NonRetryableError(
          'Circuit breaker is OPEN',
          'CIRCUIT_BREAKER_OPEN',
          { state: this.state, failures: this.failures }
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.requestCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      this.reset();
    }
  }

  private onFailure(): void {
    this.failures++;
    this.requestCount++;
    this.lastFailureTime = Date.now();
    
    if (this.shouldOpenCircuit()) {
      this.state = CircuitState.OPEN;
    }
  }

  private shouldOpenCircuit(): boolean {
    if (this.requestCount < this.config.minimumRequests) {
      return false;
    }
    
    const failureRate = this.failures / this.requestCount;
    return failureRate >= this.config.failureThreshold;
  }

  private shouldAttemptRecovery(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  private reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.requestCount = 0;
  }

  public getState(): CircuitState {
    return this.state;
  }

  public getMetrics(): {
    state: CircuitState;
    failures: number;
    successes: number;
    requestCount: number;
    failureRate: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requestCount: this.requestCount,
      failureRate: this.requestCount > 0 ? this.failures / this.requestCount : 0
    };
  }
}

// ==================== CACHING ====================

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) { // 5 minutes default
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  public get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, { ...entry, hits: entry.hits + 1 });
    
    return entry.value;
  }

  public set(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0
    };
    
    // Remove if already exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKeyIter = this.cache.keys().next();
      if (!firstKeyIter.done && firstKeyIter.value) {
        this.cache.delete(firstKeyIter.value);
      }
    }
    
    this.cache.set(key, entry);
  }

  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  public getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
  } {
    let totalHits = 0;
    let totalRequests = 0;
    
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalRequests += entry.hits + 1; // +1 for initial set
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalHits
    };
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// ==================== RATE LIMITING ====================

export interface RateLimitConfig {
  windowSize: number; // milliseconds
  maxRequests: number;
  keyGenerator?: (context: any) => string;
}

export class RateLimiter {
  private windows: Map<string, number[]>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.windows = new Map();
    this.config = config;
  }

  public async checkLimit(context: any = {}): Promise<boolean> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(context) : 'default';
    const now = Date.now();
    
    // Get or create window for this key
    let window = this.windows.get(key) || [];
    
    // Remove expired timestamps
    window = window.filter(timestamp => now - timestamp < this.config.windowSize);
    
    // Check if limit exceeded
    if (window.length >= this.config.maxRequests) {
      return false;
    }
    
    // Add current request
    window.push(now);
    this.windows.set(key, window);
    
    return true;
  }

  public getRemainingRequests(context: any = {}): number {
    const key = this.config.keyGenerator ? this.config.keyGenerator(context) : 'default';
    const now = Date.now();
    
    const window = this.windows.get(key) || [];
    const validRequests = window.filter(timestamp => now - timestamp < this.config.windowSize);
    
    return Math.max(0, this.config.maxRequests - validRequests.length);
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, window] of this.windows.entries()) {
      const validRequests = window.filter(timestamp => now - timestamp < this.config.windowSize);
      if (validRequests.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, validRequests);
      }
    }
  }
}

// ==================== QUALITY ASSESSMENT ====================

export class QualityAssessment {
  public static assessResponseQuality(
    response: string,
    expectedCriteria: {
      minLength?: number;
      maxLength?: number;
      requiredKeywords?: string[];
      forbiddenKeywords?: string[];
      structurePatterns?: RegExp[];
    }
  ): QualityMetrics {
    const metrics: QualityMetrics = {
      relevance: 0,
      coherence: 0,
      creativity: 0,
      accuracy: 0,
      completeness: 0,
      overall: 0
    };

    // Length assessment
    if (expectedCriteria.minLength && response.length < expectedCriteria.minLength) {
      metrics.completeness -= 0.3;
    }
    if (expectedCriteria.maxLength && response.length > expectedCriteria.maxLength) {
      metrics.relevance -= 0.2;
    }

    // Keyword assessment
    if (expectedCriteria.requiredKeywords) {
      const foundKeywords = expectedCriteria.requiredKeywords.filter(keyword =>
        response.toLowerCase().includes(keyword.toLowerCase())
      );
      metrics.relevance = foundKeywords.length / expectedCriteria.requiredKeywords.length;
    }

    if (expectedCriteria.forbiddenKeywords) {
      const foundForbidden = expectedCriteria.forbiddenKeywords.filter(keyword =>
        response.toLowerCase().includes(keyword.toLowerCase())
      );
      metrics.accuracy = Math.max(0, 1 - (foundForbidden.length * 0.2));
    }

    // Structure assessment
    if (expectedCriteria.structurePatterns) {
      const matchedPatterns = expectedCriteria.structurePatterns.filter(pattern =>
        pattern.test(response)
      );
      metrics.coherence = matchedPatterns.length / expectedCriteria.structurePatterns.length;
    }

    // Creativity assessment (basic heuristics)
    metrics.creativity = this.assessCreativity(response);

    // Overall score
    metrics.overall = (
      metrics.relevance +
      metrics.coherence +
      metrics.creativity +
      metrics.accuracy +
      metrics.completeness
    ) / 5;

    // Normalize all scores to 0-1 range
    Object.keys(metrics).forEach(key => {
      metrics[key as keyof QualityMetrics] = Math.max(0, Math.min(1, metrics[key as keyof QualityMetrics]));
    });

    return metrics;
  }

  private static assessCreativity(response: string): number {
    // Simple creativity heuristics
    const uniqueWords = new Set(response.toLowerCase().split(/\s+/)).size;
    const totalWords = response.split(/\s+/).length;
    const vocabularyDiversity = totalWords > 0 ? uniqueWords / totalWords : 0;

    const hasMetaphors = /\b(like|as|metaphor|analogy)\b/i.test(response);
    const hasQuestions = /\?/g.test(response);
    const hasExclamations = /!/g.test(response);

    let creativityScore = vocabularyDiversity * 0.5;
    if (hasMetaphors) creativityScore += 0.2;
    if (hasQuestions) creativityScore += 0.15;
    if (hasExclamations) creativityScore += 0.15;

    return Math.min(1, creativityScore);
  }

  public static compareResponses(responses: LLMResponse[]): {
    best: LLMResponse;
    worst: LLMResponse;
    consensus: number;
    diversity: number;
  } {
    if (responses.length === 0) {
      throw new Error('No responses to compare');
    }

    const sortedByQuality = [...responses].sort((a, b) => b.quality.overall - a.quality.overall);
    const best = sortedByQuality[0];
    const worst = sortedByQuality[sortedByQuality.length - 1];

    // Calculate consensus (how similar the quality scores are)
    const qualityScores = responses.map(r => r.quality.overall);
    const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    const variance = qualityScores.reduce((sum, score) => sum + Math.pow(score - avgQuality, 2), 0) / qualityScores.length;
    const consensus = Math.max(0, 1 - Math.sqrt(variance));

    // Calculate diversity (how different the responses are)
    const diversity = this.calculateResponseDiversity(responses);

    return { best, worst, consensus, diversity };
  }

  private static calculateResponseDiversity(responses: LLMResponse[]): number {
    if (responses.length < 2) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculateTextSimilarity(
          responses[i].output.toString(),
          responses[j].output.toString()
        );
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    const avgSimilarity = totalSimilarity / comparisons;
    return 1 - avgSimilarity; // Diversity is inverse of similarity
  }

  private static calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

// ==================== PERFORMANCE MONITORING ====================

export interface PerformanceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalLatency: number;
  totalCost: number;
  averageQuality: number;
  startTime: number;
  lastUpdate: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics>;
  private globalMetrics: PerformanceMetrics;

  constructor() {
    this.metrics = new Map();
    this.globalMetrics = this.initializeMetrics();
  }

  public recordRequest(
    providerId: string,
    success: boolean,
    latency: number,
    cost: number,
    quality: number
  ): void {
    // Update provider-specific metrics
    if (!this.metrics.has(providerId)) {
      this.metrics.set(providerId, this.initializeMetrics());
    }
    
    const providerMetrics = this.metrics.get(providerId)!;
    this.updateMetrics(providerMetrics, success, latency, cost, quality);
    
    // Update global metrics
    this.updateMetrics(this.globalMetrics, success, latency, cost, quality);
  }

  private updateMetrics(
    metrics: PerformanceMetrics,
    success: boolean,
    latency: number,
    cost: number,
    quality: number
  ): void {
    metrics.requestCount++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }
    metrics.totalLatency += latency;
    metrics.totalCost += cost;
    metrics.averageQuality = (metrics.averageQuality * (metrics.requestCount - 1) + quality) / metrics.requestCount;
    metrics.lastUpdate = Date.now();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      totalLatency: 0,
      totalCost: 0,
      averageQuality: 0,
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
  }

  public getMetrics(providerId?: string): PerformanceMetrics {
    if (providerId) {
      return this.metrics.get(providerId) || this.initializeMetrics();
    }
    return this.globalMetrics;
  }

  public getProviderRanking(): Array<{
    providerId: string;
    score: number;
    metrics: PerformanceMetrics;
  }> {
    const rankings = [];
    
    for (const [providerId, metrics] of this.metrics.entries()) {
      const successRate = metrics.requestCount > 0 ? metrics.successCount / metrics.requestCount : 0;
      const avgLatency = metrics.requestCount > 0 ? metrics.totalLatency / metrics.requestCount : 0;
      const avgCost = metrics.requestCount > 0 ? metrics.totalCost / metrics.requestCount : 0;
      
      // Calculate composite score (higher is better)
      const score = (
        successRate * 0.4 +
        metrics.averageQuality * 0.3 +
        (1 / (avgLatency / 1000 + 1)) * 0.2 + // Normalize latency
        (1 / (avgCost * 1000 + 1)) * 0.1 // Normalize cost
      );
      
      rankings.push({ providerId, score, metrics });
    }
    
    return rankings.sort((a, b) => b.score - a.score);
  }

  public reset(): void {
    this.metrics.clear();
    this.globalMetrics = this.initializeMetrics();
  }
}

// ==================== UTILITY FUNCTIONS ====================

export function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

export function sanitizeForStorage(data: any): any {
  if (typeof data === 'string') {
    return data.replace(/[\x00-\x1f\x7f-\x9f]/g, ''); // Remove control characters
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeForStorage);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeForStorage(value);
    }
    return sanitized;
  }
  
  return data;
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 4
  }).format(amount);
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - 3) + '...';
}

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepClone) as unknown as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
}

// ==================== EXPORTS ====================

export default {
  LLMOrchestrationError,
  RetryableError,
  NonRetryableError,
  RetryManager,
  CircuitBreaker,
  CircuitState,
  LRUCache,
  RateLimiter,
  QualityAssessment,
  PerformanceMonitor,
  generateHash,
  sanitizeForStorage,
  formatCurrency,
  formatDuration,
  truncateText,
  deepClone
};