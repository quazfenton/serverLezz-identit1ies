// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Redis Cache Service
// Connection Management • Caching Strategies • Cache Invalidation
// ═══════════════════════════════════════════════════════════════════════════════

import Redis from 'ioredis';
import { logger } from '../middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// Cache Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTTL?: number;
  maxRetries?: number;
  retryDelay?: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: 'coordination:',
  defaultTTL: 3600, // 1 hour
  maxRetries: 3,
  retryDelay: 1000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Cache Entry Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version?: string;
}

export type CacheKey = string;

// ═══════════════════════════════════════════════════════════════════════════════
// Cache Statistics
// ═══════════════════════════════════════════════════════════════════════════════

export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  sets: number;
  deletes: number;
  hitRate: number;
  memoryUsage?: number;
  connectedClients: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Redis Cache Service
// ═══════════════════════════════════════════════════════════════════════════════

export class CacheService {
  private client: Redis | null = null;
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    connectedClients: 0,
  };
  private isConnected: boolean = false;
  private retryCount: number = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      this.client = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        retryStrategy: (times: number) => {
          if (times > this.config.maxRetryCount!) {
            logger.error('Redis max retries reached, using in-memory cache');
            return null;
          }
          const delay = Math.min(times * this.config.retryDelay!, 3000);
          logger.info(`Redis reconnect attempt ${times}, delay: ${delay}ms`);
          return delay;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.retryCount = 0;
        logger.info('✅ Redis connected', {
          host: this.config.host,
          port: this.config.port,
        });
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.stats.errors++;
        logger.error('Redis error', {
          error: error.message,
          host: this.config.host,
        });
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', (delay: number) => {
        logger.info('Redis reconnecting', { delay });
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        if (this.client!.isReady) {
          resolve();
        } else {
          const timeout = setTimeout(() => {
            reject(new Error('Redis connection timeout'));
          }, 5000);

          this.client!.once('connect', () => {
            clearTimeout(timeout);
            resolve();
          });
        }
      });

    } catch (error) {
      logger.warn('⚠️  Redis connection failed, caching disabled', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.client = null;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: CacheKey): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      this.stats.misses++;
      return null;
    }

    try {
      const value = await this.client.get(key);
      
      if (!value) {
        this.stats.misses++;
        return null;
      }

      const entry = JSON.parse(value) as CacheEntry<T>;
      
      // Check if entry is expired
      if (entry.timestamp + entry.ttl < Date.now()) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      return entry.data;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: CacheKey,
    value: T,
    ttl?: number
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL!,
        version: this.generateVersion(),
      };

      await this.client.setex(key, entry.ttl, JSON.stringify(entry));
      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: CacheKey): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      this.stats.deletes++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      const deleted = await this.client.del(...keys);
      this.stats.deletes += deleted;
      logger.info('Cache invalidation', {
        pattern,
        deleted,
      });
      return deleted;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete by pattern error', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: CacheKey): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const stats = { ...this.stats };
    stats.hitRate = stats.hits + stats.misses > 0
      ? stats.hits / (stats.hits + stats.misses)
      : 0;

    if (this.client && this.isConnected) {
      try {
        const info = await this.client.info('stats');
        const memoryInfo = await this.client.info('memory');
        
        // Parse Redis info
        const connectedClientsMatch = info.match(/connected_clients:(\d+)/);
        if (connectedClientsMatch?.[1]) {
          stats.connectedClients = parseInt(connectedClientsMatch[1]);
        }

        const usedMemoryMatch = memoryInfo.match(/used_memory:(\d+)/);
        if (usedMemoryMatch?.[1]) {
          stats.memoryUsage = parseInt(usedMemoryMatch[1]);
        }
      } catch (error) {
        logger.debug('Failed to get Redis stats', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return stats;
  }

  /**
   * Clear all cache entries with prefix
   */
  async clear(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      const keys = await this.client.keys(`${this.config.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info('Cache cleared', { keys: keys.length });
      }
    } catch (error) {
      logger.error('Cache clear error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get or set value with factory function
   */
  async getOrSet<T>(
    key: CacheKey,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Factory call
    const value = await factory();
    
    // Set in cache
    await this.set(key, value, ttl);
    
    return value;
  }

  /**
   * Increment counter
   */
  async increment(key: CacheKey, by: number = 1, ttl?: number): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      const result = await this.client.incrby(key, by);
      
      // Set TTL if key is new
      if (ttl && by === 1) {
        await this.client.expire(key, ttl);
      }
      
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache increment error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: CacheKey, by: number = 1): Promise<number> {
    if (!this.client || !this.isConnected) {
      return 0;
    }

    try {
      return await this.client.decrby(key, by);
    } catch (error) {
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Check if Redis is connected and healthy
   */
  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Generate version string for cache entry
   */
  private generateVersion(): string {
    return Date.now().toString(36);
  }

  /**
   * Get max retry count from config
   */
  private get maxRetryCount(): number {
    return this.config.maxRetries || 3;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cache Key Generators
// ═══════════════════════════════════════════════════════════════════════════════

export const CacheKeys = {
  // Profile keys
  profile: (id: string) => `profile:${id}`,
  profileByEmail: (email: string) => `profile:email:${email.toLowerCase()}`,
  profiles: (filter: string) => `profiles:${filter}`,
  
  // Listing keys
  listing: (id: string) => `listing:${id}`,
  listings: (filter: string) => `listings:${filter}`,
  listingsByProvider: (providerId: string) => `listings:provider:${providerId}`,
  
  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,
  sessionByProfile: (profileId: string) => `session:profile:${profileId}`,
  
  // Rate limit keys
  rateLimit: (identifier: string, type: string) => `ratelimit:${type}:${identifier}`,
  
  // Lock keys
  lock: (resource: string, id: string) => `lock:${resource}:${id}`,
  
  // Verification keys
  verification: (type: string, token: string) => `verification:${type}:${token}`,
  
  // Metrics keys
  metrics: (type: string, date: string) => `metrics:${type}:${date}`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Factory Function
// ═══════════════════════════════════════════════════════════════════════════════

let cacheServiceInstance: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

export async function initializeCache(): Promise<CacheService> {
  const cache = getCacheService();
  await cache.connect();
  return cache;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export default CacheService;
