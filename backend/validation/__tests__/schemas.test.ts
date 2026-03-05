/**
 * Validation Schemas Unit Tests
 * Tests for Zod validation schemas used in API requests
 */

import { z } from 'zod';

// Import schemas from validation file
// Note: Adjust import path based on actual schema exports
describe('Validation Schemas', () => {
  // Registration schema tests
  describe('Registration Validation', () => {
    const RegisterSchema = z.object({
      name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
      email: z.string().email('Invalid email address'),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
      location: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }).optional(),
    });

    it('should validate correct registration input', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123',
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const input = {
        name: '',
        email: 'test@example.com',
        password: 'SecurePass123',
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('name');
      }
    });

    it('should reject name too long', () => {
      const input = {
        name: 'a'.repeat(101),
        email: 'test@example.com',
        password: 'SecurePass123',
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const input = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'SecurePass123',
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('email');
      }
    });

    it('should reject password too short', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak',
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'lowercase123',
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'UPPERCASE123',
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject password without numbers', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'NoNumbersHere',
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should accept valid location', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123',
        location: { latitude: 37.7749, longitude: -122.4194 },
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject invalid latitude', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123',
        location: { latitude: 100, longitude: -122.4194 },
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid longitude', () => {
      const input = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123',
        location: { latitude: 37.7749, longitude: -200 },
      };

      const result = RegisterSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });
  });

  // Login schema tests
  describe('Login Validation', () => {
    const LoginSchema = z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required'),
    });

    it('should validate correct login input', () => {
      const input = {
        email: 'test@example.com',
        password: 'SecurePass123',
      };

      const result = LoginSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const input = {
        email: '',
        password: 'SecurePass123',
      };

      const result = LoginSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const input = {
        email: 'invalid',
        password: 'SecurePass123',
      };

      const result = LoginSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const input = {
        email: 'test@example.com',
        password: '',
      };

      const result = LoginSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });
  });

  // Listing creation schema tests
  describe('Listing Creation Validation', () => {
    const CreateListingSchema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(2000),
      type: z.enum(['service', 'goods', 'collaboration']),
      location: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        address: z.string().optional(),
      }).optional(),
      pricing: z.object({
        basePrice: z.number().min(0),
        currency: z.string(),
        pricingType: z.enum(['fixed', 'negotiable', 'range']),
      }).optional(),
      tags: z.array(z.string().max(50)).max(20).optional(),
    });

    it('should validate correct listing input', () => {
      const input = {
        title: 'Web Development',
        description: 'Professional web development services',
        type: 'service' as const,
      };

      const result = CreateListingSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const input = {
        title: '',
        description: 'Description',
        type: 'service' as const,
      };

      const result = CreateListingSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject title too long', () => {
      const input = {
        title: 'a'.repeat(201),
        description: 'Description',
        type: 'service' as const,
      };

      const result = CreateListingSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const input = {
        title: 'Title',
        description: '',
        type: 'service' as const,
      };

      const result = CreateListingSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
      const input = {
        title: 'Title',
        description: 'Description',
        type: 'invalid',
      };

      const result = CreateListingSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject negative price', () => {
      const input = {
        title: 'Title',
        description: 'Description',
        type: 'service' as const,
        pricing: {
          basePrice: -10,
          currency: 'USD',
          pricingType: 'fixed' as const,
        },
      };

      const result = CreateListingSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject too many tags', () => {
      const input = {
        title: 'Title',
        description: 'Description',
        type: 'service' as const,
        tags: Array(21).fill('tag'),
      };

      const result = CreateListingSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject tag too long', () => {
      const input = {
        title: 'Title',
        description: 'Description',
        type: 'service' as const,
        tags: ['a'.repeat(51)],
      };

      const result = CreateListingSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });
  });

  // Token refresh schema tests
  describe('Token Refresh Validation', () => {
    const RefreshTokenSchema = z.object({
      refreshToken: z.string().min(1, 'Refresh token is required'),
    });

    it('should validate correct refresh token input', () => {
      const input = {
        refreshToken: 'valid-refresh-token-here',
      };

      const result = RefreshTokenSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject missing refresh token', () => {
      const input = {};

      const result = RefreshTokenSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject empty refresh token', () => {
      const input = {
        refreshToken: '',
      };

      const result = RefreshTokenSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });
  });

  // Pagination schema tests
  describe('Pagination Validation', () => {
    const PaginationSchema = z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    });

    it('should validate correct pagination input', () => {
      const input = {
        limit: 10,
        offset: 0,
      };

      const result = PaginationSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(10);
    });

    it('should reject limit too high', () => {
      const input = {
        limit: 200,
        offset: 0,
      };

      const result = PaginationSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const input = {
        limit: 10,
        offset: -5,
      };

      const result = PaginationSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should use default values', () => {
      const input = {};

      const result = PaginationSchema.safeParse(input);
      
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
      expect(result.data?.offset).toBe(0);
    });
  });

  // Search schema tests
  describe('Search Validation', () => {
    const SearchSchema = z.object({
      query: z.string().min(1).max(200),
      type: z.enum(['service', 'goods', 'collaboration', 'all']).default('all'),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
        radius: z.number().min(1).max(1000).optional(),
      }).optional(),
    });

    it('should validate correct search input', () => {
      const input = {
        query: 'web development',
        type: 'service' as const,
      };

      const result = SearchSchema.safeParse(input);
      
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const input = {
        query: '',
      };

      const result = SearchSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject query too long', () => {
      const input = {
        query: 'a'.repeat(201),
      };

      const result = SearchSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
      const input = {
        query: 'search',
        type: 'invalid',
      };

      const result = SearchSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });

    it('should reject invalid radius', () => {
      const input = {
        query: 'search',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 2000,
        },
      };

      const result = SearchSchema.safeParse(input);
      
      expect(result.success).toBe(false);
    });
  });
});
