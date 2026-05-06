// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Cache Decorators
// Decorator-based caching for service methods
// ═══════════════════════════════════════════════════════════════════════════════

import { CacheService, CacheKeys } from './CacheService';
import { logger } from '../middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// Cache Configuration Decorator
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheOptions {
  key: string | ((...args: any[]) => string);
  ttl?: number;
  cacheEmpty?: boolean;
  invalidateOn?: string[];
}

/**
 * Cache decorator for service methods
 * 
 * @param cacheService - The cache service instance
 * @param options - Cache configuration options
 */
export function Cached(
  cacheService: CacheService,
  options: CacheOptions
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Generate cache key
      const cacheKey = typeof options.key === 'function'
        ? options.key.apply(this, args)
        : options.key;

      const fullKey = `${cacheService['config'].keyPrefix}${cacheKey}`;

      try {
        // Try to get from cache
        const cached = await cacheService.get(fullKey);
        if (cached !== null) {
          logger.debug('Cache hit', { key: fullKey, method: propertyKey });
          return cached;
        }

        logger.debug('Cache miss', { key: fullKey, method: propertyKey });

        // Call original method
        const result = await originalMethod.apply(this, args);

        // Cache result (only if not null/undefined, or cacheEmpty is true)
        if (result !== null && result !== undefined) {
          await cacheService.set(fullKey, result, options.ttl);
        } else if (options.cacheEmpty) {
          await cacheService.set(fullKey, result, options.ttl);
        }

        return result;
      } catch (error) {
        logger.error('Cache decorator error', {
          key: fullKey,
          method: propertyKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Fallback to original method on cache error
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cache Invalidation Decorator
// ═══════════════════════════════════════════════════════════════════════════════

export function InvalidateCache(
  cacheService: CacheService,
  patterns: string[] | ((...args: any[]) => string[])
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Call original method first
      const result = await originalMethod.apply(this, args);

      // Then invalidate cache
      try {
        const patternsToInvalidate = typeof patterns === 'function'
          ? patterns.apply(this, args)
          : patterns;

        for (const pattern of patternsToInvalidate) {
          const fullPattern = `${cacheService['config'].keyPrefix}${pattern}`;
          await cacheService.deleteByPattern(fullPattern);
        }

        logger.debug('Cache invalidated', {
          patterns: patternsToInvalidate,
          method: propertyKey,
        });
      } catch (error) {
        logger.error('Cache invalidation error', {
          method: propertyKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      return result;
    };

    return descriptor;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Distributed Lock
// ═══════════════════════════════════════════════════════════════════════════════

export class DistributedLock {
  constructor(
    private cacheService: CacheService,
    private ttl: number = 10000 // 10 seconds default
  ) {}

  /**
   * Acquire a distributed lock
   */
  async acquire(resource: string, id: string): Promise<boolean> {
    const key = CacheKeys.lock(resource, id);
    const now = Date.now();
    
    // Try to set lock with NX (only if not exists)
    const acquired = await this.cacheService['client']?.set(
      key,
      now.toString(),
      'NX',
      'PX',
      this.ttl
    );

    return acquired === 'OK';
  }

  /**
   * Release a distributed lock
   */
  async release(resource: string, id: string): Promise<void> {
    const key = CacheKeys.lock(resource, id);
    await this.cacheService.delete(key);
  }

  /**
   * Execute with lock (with automatic release)
   */
  async withLock<T>(
    resource: string,
    id: string,
    fn: () => Promise<T>,
    retries: number = 3,
    retryDelay: number = 100
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      const acquired = await this.acquire(resource, id);
      
      if (acquired) {
        try {
          return await fn();
        } finally {
          await this.release(resource, id);
        }
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    throw new Error(`Failed to acquire lock for ${resource}:${id} after ${retries} attempts`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiter using Redis
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  total: number;
}

export class RedisRateLimiter {
  constructor(private cacheService: CacheService) {}

  /**
   * Check rate limit and increment counter
   */
  async check(
    identifier: string,
    type: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const key = CacheKeys.rateLimit(identifier, type);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use Redis pipeline for atomic operations
    const client = this.cacheService['client'];
    if (!client) {
      return { allowed: true, remaining: limit, resetAt: now + windowMs, total: limit };
    }

    // Remove old entries
    await client.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    const current = await client.zcard(key);

    if (current >= limit) {
      // Get oldest entry to calculate reset time
      const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt = oldest[1] ? parseInt(oldest[1]) + windowMs : now + windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        total: limit,
      };
    }

    // Add new request
    await client.zadd(key, now, now.toString());
    await client.expire(key, Math.ceil(windowMs / 1000));

    return {
      allowed: true,
      remaining: limit - current - 1,
      resetAt: now + windowMs,
      total: limit,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  Cached,
  InvalidateCache,
  DistributedLock,
  RedisRateLimiter,
};
