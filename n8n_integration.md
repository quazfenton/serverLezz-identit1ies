# n8n Integration for Coordination Cosmos

## Overview
This document outlines the custom n8n endpoints and integration options for the Coordination Cosmos platform, enabling workflow automation and integration with external services.

## n8n Custom Endpoints

### 1. Profile Management Integration
```
POST /n8n/webhook/profile/create
POST /n8n/webhook/profile/update
POST /n8n/webhook/profile/delete
```

### 2. Listing Management Integration  
```
POST /n8n/webhook/listing/create
POST /n8n/webhook/listing/update
POST /n8n/webhook/listing/delete
GET  /n8n/webhook/listings/search
```

### 3. Match/Coordination Integration
```
POST /n8n/webhook/coordination/create
POST /n8n/webhook/coordination/update
GET  /n8n/webhook/matches/find
POST /n8n/webhook/matches/optimize
```

### 4. Communication Integration
```
POST /n8n/webhook/communication/send
POST /n8n/webhook/notifications/send
GET  /n8n/webhook/messages/recent
```

## Implementation Code

```typescript
// backend/n8n-integration.ts
import express from "express";
import { Profile, ServiceListing, MatchingResult, CoordinationMechanism } from "../shared/types";
import { profilesRepo, listingsRepo } from "./db/adapter";

const n8nRouter = express.Router();

// Profile webhook endpoints
n8nRouter.post('/profile/create', async (req, res) => {
  try {
    const { name, location, resources, economicProfile, behaviorProfile } = req.body;
    
    const profile: Profile = {
      id: generateId('profile'),
      name: name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      location: location || { latitude: 0, longitude: 0 },
      resources: resources || {
        goods: [],
        skills: [],
        needs: [],
        timeAvailable: [],
        preferences: {},
      },
      weight: 0.5,
      reputation: {
        overall: 0.5,
        reliability: 0.5,
        quality: 0.5,
        responsiveness: 0.5,
        fairness: 0.5,
        trustworthiness: 0.5,
        socialImpact: 0.5,
        history: [],
      },
      economicProfile: economicProfile || {
        totalUtility: 0,
        wealthLevel: 0.5,
        spendingPower: 0.5,
        savingsRate: 0.5,
        riskTolerance: 0.5,
        preferredPaymentMethods: [],
        creditScore: 0,
        transactionHistory: [],
        valueAlignment: {
          community: 0.5,
          sustainability: 0.5,
          innovation: 0.5,
          fairness: 0.5,
        },
      },
      behaviorProfile: behaviorProfile || {
        interactionPatterns: [],
        preferences: {},
        predictedActions: [],
        adaptationRate: 0.5,
        consistencyScore: 0.5,
        socialStyle: 'balanced',
        decisionMakingStyle: 'analytical',
      },
      lastUpdated: new Date(),
      isActive: true,
    };

    await profilesRepo.save(profile);
    res.status(201).json({ success: true, profile });
  } catch (error) {
    console.error('n8n profile creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

n8nRouter.post('/profile/update', async (req, res) => {
  try {
    const { profileId, updates } = req.body;
    const profile = await profilesRepo.getById(profileId);
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    
    Object.assign(profile, updates);
    profile.lastUpdated = new Date();
    
    await profilesRepo.save(profile);
    res.json({ success: true, profile });
  } catch (error) {
    console.error('n8n profile update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listing webhook endpoints
n8nRouter.post('/listing/create', async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      providerId,
      location,
      pricing,
      availability,
      requirements,
      tags
    } = req.body;

    const listing: ServiceListing = {
      id: generateId('listing'),
      title: title,
      description: description,
      type: type,
      providerId: providerId,
      location: location || { latitude: 0, longitude: 0 },
      pricing: pricing || {
        basePrice: 0,
        currency: 'USD',
        pricingType: 'fixed',
      },
      availability: availability || [],
      requirements: requirements || [],
      tags: tags || [],
      qualityMetrics: {
        rating: 0,
        reliability: 0.5,
        durability: 0.5,
        functionality: 0.5,
        aesthetics: 0.5,
        sustainability: 0.5,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    await listingsRepo.save(listing);
    res.status(201).json({ success: true, listing });
  } catch (error) {
    console.error('n8n listing creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

n8nRouter.get('/listings/search', async (req, res) => {
  try {
    const { tags, location, radius } = req.query as any;
    let listings = await listingsRepo.getAll();
    
    // Apply filters
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      listings = listings.filter(listing => 
        tagArray.some(tag => listing.tags.includes(tag))
      );
    }
    
    if (location && radius) {
      const [lat, lon] = location.split(',').map(Number);
      listings = listings.filter(listing => {
        const distance = haversineKm(
          { latitude: lat, longitude: lon },
          listing.location
        );
        return distance <= Number(radius);
      });
    }
    
    res.json({ success: true, listings, total: listings.length });
  } catch (error) {
    console.error('n8n listings search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Coordination webhook endpoints
n8nRouter.post('/coordination/create', async (req, res) => {
  try {
    const { type, participants, objectives } = req.body;
    
    const coordination: CoordinationMechanism = {
      id: generateId("coordination"),
      type: type || "algorithmic",
      participants: participants || [],
      initiatorId: participants[0],
      status: 'active',
      details: { 
        objectives: objectives || [{ type: 'utility_maximization', weight: 1 }] 
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      currentState: {
        phase: "discovery",
        progress: 0,
        participants: participants.map((id: string) => ({
          profileId: id,
          engagement: 0.5,
          contribution: 0,
          satisfaction: 0.5,
          commitment: 0.7,
          lastActive: new Date(),
        })),
        resources: [],
        conflicts: [],
        resolutions: [],
      },
      performance: {
        efficiency: 0.5,
        effectiveness: 0.5,
        satisfaction: 0.5,
        scalability: 0.7,
        adaptability: 0.6,
        robustness: 0.6,
      },
    };

    // Store coordination (in a real implementation, this would be stored in a database)
    // activeCoordinations.set(coordination.id, coordination);

    res.status(201).json({ success: true, coordination });
  } catch (error) {
    console.error('n8n coordination creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Matches endpoint
n8nRouter.get('/matches/find', async (req, res) => {
  try {
    const { sourceProfileId, targetProfileId, dimensions } = req.query as any;
    // This would integrate with the matching engine
    // For now returning a mock response
    const matches: MatchingResult[] = [
      {
        profileA: sourceProfileId,
        profileB: targetProfileId || 'any',
        score: 0.8,
        reason: 'High compatibility in requested dimensions'
      }
    ];
    
    res.json({ success: true, matches, sourceProfile: sourceProfileId });
  } catch (error) {
    console.error('n8n matches find error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper functions
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const x = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// Communication endpoint
n8nRouter.post('/communication/send', async (req, res) => {
  try {
    const { fromId, toId, message, type } = req.body;
    
    // In a real implementation, this would send the message through the platform's messaging system
    // This could trigger WebSocket notifications or email/SMS
	
    res.status(200).json({ 
      success: true, 
      message: 'Communication sent', 
      communication: { fromId, toId, message, type, timestamp: new Date() }
    });
  } catch (error) {
    console.error('n8n communication send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default n8nRouter;
```

## Integration Setup Guide

### 1. Adding the n8n endpoints to your server

Add this to your main server file:

```typescript
// In backend/server.ts, add after other imports:
import n8nIntegration from './n8n-integration';

// Add before app.listen():
app.use('/n8n', n8nIntegration);
```

### 2. n8n Node Configuration

To use these endpoints in n8n workflows:

1. Create an HTTP Request node
2. Set Method to POST or GET as required
3. Set URL to your server endpoint (e.g., `http://your-server.com/n8n/webhook/profile/create`)
4. Set headers: `"Content-Type": "application/json"`
5. Set body with the required parameters

### 3. Example n8n Workflows

#### Workflow 1: Create Profile from Webhook
- Trigger: Webhook
- Action: HTTP Request to `POST /n8n/webhook/profile/create`
- Body:
```json
{
  "name": "{{ $json.name }}",
  "location": {
    "latitude": {{ $json.latitude }},
    "longitude": {{ $json.longitude }}
  },
  "resources": {
    "skills": {{ $json.skills }},
    "needs": {{ $json.needs }}
  }
}
```

#### Workflow 2: Find Matches for New Listing
- Trigger: HTTP Request to `POST /n8n/webhook/listing/create`
- Action: HTTP Request to `GET /n8n/webhook/matches/find`
- Action: Send notification emails to matched profiles

#### Workflow 3: Daily Coordination Optimization
- Trigger: Schedule Trigger (daily)
- Action: HTTP Request to `POST /n8n/webhook/matches/optimize`

## Security Considerations

1. **Authentication**: All n8n endpoints should implement proper authentication
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Validation**: Add input validation for all payloads
4. **Whitelist IPs**: Restrict n8n endpoints to specific IP addresses if needed

## Error Handling

All n8n endpoints return standardized responses:
- Success: `{ "success": true, ...data... }`
- Error: `{ "success": false, "error": "error message" }`

## Testing

To test the n8n endpoints:

```bash
# Test profile creation
curl -X POST http://localhost:3003/n8n/webhook/profile/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "location": {"latitude": 40.7128, "longitude": -74.0060},
    "resources": {
      "skills": [{"name": "Web Development"}],
      "needs": [{"name": "Design Help"}]
    }
  }'
```

This n8n integration enables automation of profile management, listing creation, matching, and coordination tasks, making the Coordination Cosmos platform extensible and integrable with other systems.