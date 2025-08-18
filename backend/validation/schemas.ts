import { z } from 'zod';

// Profile creation/update schema
export const ProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  bio: z.string().max(500, "Bio too long").optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(20, "Too many tags").optional(),
  resources: z.object({
    goods: z.array(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      quantity: z.number().min(0).optional(),
      unit: z.string().max(20).optional(),
      tags: z.array(z.string().max(50)).optional(),
    })).max(50, "Too many goods").optional(),
    services: z.array(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      hourlyRate: z.number().min(0).optional(),
      availability: z.string().max(200).optional(),
      tags: z.array(z.string().max(50)).optional(),
    })).max(50, "Too many services").optional(),
    needs: z.array(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      maxPrice: z.number().min(0).optional(),
      tags: z.array(z.string().max(50)).optional(),
    })).max(50, "Too many needs").optional(),
  }).optional(),
  economicProfile: z.object({
    valueAlignment: z.object({
      community: z.number().min(0).max(1).optional(),
      sustainability: z.number().min(0).max(1).optional(),
      innovation: z.number().min(0).max(1).optional(),
      fairness: z.number().min(0).max(1).optional(),
    }).optional(),
    riskTolerance: z.number().min(0).max(1).optional(),
    collaborationPreference: z.number().min(0).max(1).optional(),
  }).optional(),
  incentiveWeights: z.object({
    monetary: z.number().min(0).max(1).optional(),
    social: z.number().min(0).max(1).optional(),
    environmental: z.number().min(0).max(1).optional(),
    learning: z.number().min(0).max(1).optional(),
    timeEfficiency: z.number().min(0).max(1).optional(),
  }).optional(),
});

// Listing creation/update schema
export const ListingSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(1, "Description is required").max(2000, "Description too long"),
  type: z.enum(['offer', 'request']),
  category: z.enum(['goods', 'services', 'knowledge', 'time', 'space', 'other']),
  tags: z.array(z.string().max(50)).max(20, "Too many tags").optional(),
  pricing: z.object({
    basePrice: z.number().min(0).optional(),
    currency: z.string().max(3).default('USD'),
    negotiable: z.boolean().default(true),
    unit: z.string().max(20).optional(),
  }).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    remote: z.boolean().default(false),
  }).optional(),
  availability: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    recurring: z.boolean().default(false),
    schedule: z.string().max(500).optional(),
  }).optional(),
  requirements: z.object({
    minRating: z.number().min(0).max(5).optional(),
    skills: z.array(z.string().max(100)).max(20, "Too many skills").optional(),
    experience: z.string().max(200).optional(),
    certifications: z.array(z.string().max(200)).max(10, "Too many certifications").optional(),
  }).optional(),
});

// Match request schema
export const MatchRequestSchema = z.object({
  targetProfileId: z.string().optional(),
  dimensions: z.array(z.string().max(50)).max(10, "Too many dimensions").optional(),
  filters: z.object({
    maxDistance: z.number().min(0).max(10000).optional(),
    minScore: z.number().min(0).max(1).optional(),
    categories: z.array(z.string().max(50)).optional(),
    tags: z.array(z.string().max(50)).optional(),
  }).optional(),
});

// Connection request schema
export const ConnectionRequestSchema = z.object({
  fromId: z.string().min(1, "From ID is required"),
  toId: z.string().min(1, "To ID is required"),
  message: z.string().max(500, "Message too long").optional(),
  strength: z.number().min(0).max(1).default(0.5),
});

// Export types for use in other files
export type ProfileInput = z.infer<typeof ProfileSchema>;
export type ListingInput = z.infer<typeof ListingSchema>;
export type MatchRequestInput = z.infer<typeof MatchRequestSchema>;
export type ConnectionRequestInput = z.infer<typeof ConnectionRequestSchema>;
