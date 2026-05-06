// backend/n8n-integration.ts
import express, { Router } from "express";
import {
  Profile,
  ServiceListing,
  MatchingResult,
  CoordinationMechanism,
  IProfilesRepo,
  IListingsRepo,
} from "../shared/types";
// ──────────────────────── Helper functions ──────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const x =
    sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// ──────────────────────── Router factory ────────────────────────────────────────

interface N8nRouterDeps {
  profilesRepo: IProfilesRepo;
  listingsRepo: IListingsRepo;
}

export function createN8nRouter(deps: N8nRouterDeps): Router {
  const { profilesRepo, listingsRepo } = deps;
  const router = express.Router();

  // ── Profile endpoints ────────────────────────────────────────────────────

  router.post("/profile/create", async (req, res) => {
    try {
      const {
        name,
        location,
        resources,
        economicProfile,
        behaviorProfile,
      } = req.body;

      const profile: Profile = {
        id: generateId("profile"),
        name,
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
          socialStyle: "balanced",
          decisionMakingStyle: "analytical",
        },
        seekings: [],
        offerings: [],
        lastUpdated: new Date(),
        isActive: true,
      };

      await profilesRepo.save(profile);
      res.status(201).json({ success: true, profile });
    } catch (error: any) {
      console.error("n8n profile creation error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post("/profile/update", async (req, res) => {
    try {
      const { profileId, updates } = req.body;
      const profile = await profilesRepo.getById(profileId);

      if (!profile) {
        return res
          .status(404)
          .json({ success: false, error: "Profile not found" });
      }

      Object.assign(profile, updates);
      profile.lastUpdated = new Date();

      await profilesRepo.save(profile);
      res.json({ success: true, profile });
    } catch (error: any) {
      console.error("n8n profile update error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── Listing endpoints ────────────────────────────────────────────────────

  router.post("/listing/create", async (req, res) => {
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
        tags,
      } = req.body;

      const listing: ServiceListing = {
        id: generateId("listing"),
        title,
        description,
        type,
        providerId,
        location: location || { latitude: 0, longitude: 0 },
        pricing: pricing || {
          basePrice: 0,
          currency: "USD",
          pricingType: "fixed",
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
    } catch (error: any) {
      console.error("n8n listing creation error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get("/listings/search", async (req, res) => {
    try {
      const { tags, location, radius } = req.query as any;
      let listings = await listingsRepo.getAll();

      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        listings = listings.filter((listing) =>
          tagArray.some((tag: string) => listing.tags.includes(tag)),
        );
      }

      if (location && radius) {
        const [lat, lon] = location.split(",").map(Number);
        listings = listings.filter((listing) => {
          const distance = haversineKm(
            { latitude: lat, longitude: lon },
            listing.location,
          );
          return distance <= Number(radius);
        });
      }

      res.json({ success: true, listings, total: listings.length });
    } catch (error: any) {
      console.error("n8n listings search error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── Coordination endpoints ───────────────────────────────────────────────

  router.post("/coordination/create", async (req, res) => {
    try {
      const { type, participants, objectives } = req.body;

      const coordination: CoordinationMechanism = {
        id: generateId("coordination"),
        type: type || "algorithmic",
        participants: participants || [],
        initiatorId: participants[0],
        status: "active",
        details: {
          objectives: objectives || [
            { type: "utility_maximization", weight: 1 },
          ],
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

      res.status(201).json({ success: true, coordination });
    } catch (error: any) {
      console.error("n8n coordination creation error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── Matches endpoint (mock) ──────────────────────────────────────────────

  router.get("/matches/find", async (req, res) => {
    try {
      const { sourceProfileId, targetProfileId } = req.query as any;

      const matches: MatchingResult[] = [
        {
          profileA: sourceProfileId,
          profileB: targetProfileId || "any",
          score: 0.8,
          reason: "High compatibility in requested dimensions",
        },
      ];

      res.json({ success: true, matches, sourceProfile: sourceProfileId });
    } catch (error: any) {
      console.error("n8n matches find error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── Communication endpoint (mock) ────────────────────────────────────────

  router.post("/communication/send", async (req, res) => {
    try {
      const { fromId, toId, message, type } = req.body;

      res.status(200).json({
        success: true,
        message: "Communication sent",
        communication: { fromId, toId, message, type, timestamp: new Date() },
      });
    } catch (error: any) {
      console.error("n8n communication send error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

// ──────────────────────── Default export (backward compat) ─────────────────────
// Uses in-memory repos as a fallback since the async adapter can't be awaited at module level.
import { ProfilesRepo } from './repos/ProfilesRepo';
import { ListingsRepo } from './repos/ListingsRepo';

const n8nRouter = createN8nRouter({
  profilesRepo: new ProfilesRepo(),
  listingsRepo: new ListingsRepo(),
});

export default n8nRouter;
