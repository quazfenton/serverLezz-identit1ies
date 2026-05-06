/**
 * CacheService Unit Tests
 * Tests for Redis caching functionality with in-memory fallback
 */

import { CacheService, CacheKeys, getCacheService, initializeCache } from '../services/CacheService';

// Mock Redis client
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  exists: jest.fn(),
  incrby: jest.fn(),
  decrby: jest.fn(),
  expire: jest.fn(),
  info: jest.fn(),
  once: jest.fn(),
  isReady: true,
  on: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService({
      host: 'localhost',
      port: 6379,
      defaultTTL: 3600,
    });
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      mockRedis.isReady = true;
      
      await cacheService.connect();
      
      expect(cacheService.isHealthy()).toBe(true);
    });

    it('should handle connection failure gracefully', async () => {
      mockRedis.isReady = false;
      
      // Simulate connection timeout
      await expect(cacheService.connect()).resolves.toBeUndefined();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      
      await cacheService.disconnect();
      
      expect(mockRedis.quit).toHaveBeenCalled();
      expect(cacheService.isHealthy()).toBe(false);
    });
  });

  describe('get', () => {
    it('should retrieve value from cache', async () => {
      const mockEntry = {
        data: { id: '1', name: 'Test' },
        timestamp: Date.now(),
        ttl: 3600,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockEntry));
      
      const result = await cacheService.get('test:key');
      
      expect(result).toEqual({ id: '1', name: 'Test' });
      expect(mockRedis.get).toHaveBeenCalledWith('test:key');
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await cacheService.get('nonexistent');
      
      expect(result).toBeNull();
    });

    it('should return null for expired entry', async () => {
      const mockEntry = {
        data: { id: '1', name: 'Test' },
        timestamp: Date.now() - 7200000, // 2 hours ago
        ttl: 3600, // 1 hour TTL
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockEntry));
      
      const result = await cacheService.get('test:key');
      
      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith('test:key');
    });

    it('should return null when Redis is not connected', async () => {
      const result = await cacheService.get('test:key');
      
      expect(result).toBeNull();
    });

    it('should handle JSON parse errors', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');
      
      const result = await cacheService.get('test:key');
      
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in cache', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      
      const result = await cacheService.set('test:key', { id: '1', name: 'Test' });
      
      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should use custom TTL when provided', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      
      await cacheService.set('test:key', 'value', 7200);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:key',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should return false when Redis is not connected', async () => {
      const result = await cacheService.set('test:key', 'value');
      
      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete value from cache', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.del.mockResolvedValue(1);
      
      const result = await cacheService.delete('test:key');
      
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test:key');
    });

    it('should return false when Redis is not connected', async () => {
      const result = await cacheService.delete('test:key');
      
      expect(result).toBe(false);
    });
  });

  describe('deleteByPattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.keys.mockResolvedValue(['test:1', 'test:2', 'test:3']);
      mockRedis.del.mockResolvedValue(3);
      
      const deleted = await cacheService.deleteByPattern('test:*');
      
      expect(deleted).toBe(3);
      expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
      expect(mockRedis.del).toHaveBeenCalledWith('test:1', 'test:2', 'test:3');
    });

    it('should return 0 when no keys match', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.keys.mockResolvedValue([]);
      
      const deleted = await cacheService.deleteByPattern('nonexistent:*');
      
      expect(deleted).toBe(0);
    });

    it('should return 0 when Redis is not connected', async () => {
      const deleted = await cacheService.deleteByPattern('test:*');
      
      expect(deleted).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.exists.mockResolvedValue(1);
      
      const result = await cacheService.exists('test:key');
      
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.exists.mockResolvedValue(0);
      
      const result = await cacheService.exists('nonexistent');
      
      expect(result).toBe(false);
    });

    it('should return false when Redis is not connected', async () => {
      const result = await cacheService.exists('test:key');
      
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.info.mockResolvedValue('connected_clients:5\nused_memory:1024');
      
      const stats = await cacheService.getStats();
      
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should calculate hit rate correctly', async () => {
      // Manually set stats
      (cacheService as any).stats = {
        hits: 80,
        misses: 20,
        errors: 0,
        sets: 100,
        deletes: 10,
        hitRate: 0,
        connectedClients: 0,
      };
      
      const stats = await cacheService.getStats();
      
      expect(stats.hitRate).toBe(0.8);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const mockEntry = {
        data: 'cached-value',
        timestamp: Date.now(),
        ttl: 3600,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(mockEntry));
      
      const factory = jest.fn().mockResolvedValue('new-value');
      const result = await cacheService.getOrSet('test:key', factory);
      
      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.isReady = true;
      await cacheService.connect();
      
      const factory = jest.fn().mockResolvedValue('new-value');
      const result = await cacheService.getOrSet('test:key', factory);
      
      expect(result).toBe('new-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('increment', () => {
    it('should increment counter', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.incrby.mockResolvedValue(5);
      
      const result = await cacheService.increment('counter', 1);
      
      expect(result).toBe(5);
      expect(mockRedis.incrby).toHaveBeenCalledWith('counter', 1);
    });

    it('should set TTL on new key', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.incrby.mockResolvedValue(1);
      
      await cacheService.increment('new-counter', 1, 3600);
      
      expect(mockRedis.expire).toHaveBeenCalledWith('new-counter', 3600);
    });

    it('should return 0 when Redis is not connected', async () => {
      const result = await cacheService.increment('counter');
      
      expect(result).toBe(0);
    });
  });

  describe('decrement', () => {
    it('should decrement counter', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.decrby.mockResolvedValue(5);
      
      const result = await cacheService.decrement('counter', 1);
      
      expect(result).toBe(5);
      expect(mockRedis.decrby).toHaveBeenCalledWith('counter', 1);
    });

    it('should return 0 when Redis is not connected', async () => {
      const result = await cacheService.decrement('counter');
      
      expect(result).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all cache entries with prefix', async () => {
      mockRedis.isReady = true;
      await cacheService.connect();
      mockRedis.keys.mockResolvedValue(['coordination:1', 'coordination:2']);
      mockRedis.del.mockResolvedValue(2);
      
      await cacheService.clear();
      
      expect(mockRedis.keys).toHaveBeenCalledWith('coordination:*');
      expect(mockRedis.del).toHaveBeenCalledWith('coordination:1', 'coordination:2');
    });
  });

  describe('CacheKeys', () => {
    it('should generate correct profile key', () => {
      expect(CacheKeys.profile('user-123')).toBe('profile:user-123');
    });

    it('should generate correct profile by email key', () => {
      expect(CacheKeys.profileByEmail('Test@Example.COM'))
        .toBe('profile:email:test@example.com');
    });

    it('should generate correct listing key', () => {
      expect(CacheKeys.listing('listing-456')).toBe('listing:listing-456');
    });

    it('should generate correct session key', () => {
      expect(CacheKeys.session('session-789')).toBe('session:session-789');
    });

    it('should generate correct rate limit key', () => {
      expect(CacheKeys.rateLimit('user-123', 'api'))
        .toBe('ratelimit:api:user-123');
    });

    it('should generate correct verification key', () => {
      expect(CacheKeys.verification('email', 'token-abc'))
        .toBe('verification:email:token-abc');
    });
  });

  describe('getCacheService', () => {
    it('should return singleton instance', () => {
      const instance1 = getCacheService();
      const instance2 = getCacheService();
      
      expect(instance1).toBe(instance2);
    });
  });
});
