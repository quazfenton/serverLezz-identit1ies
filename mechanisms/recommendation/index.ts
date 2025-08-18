import { Profile, ServiceListing, GraphNode } from '../../shared/types';
import { NetworkManager } from '../network';
import { BehaviorObserver } from '../behavior';

export class RecommendationEngine {
  private network: NetworkManager;
  private behavior: BehaviorObserver;

  constructor(network: NetworkManager, behavior: BehaviorObserver) {
    this.network = network;
    this.behavior = behavior;
  }

  public getProfileRecommendations(profileId: string): string[] {
    // Get network-based recommendations
    const networkRecommendations = this.network.getRecommendations(profileId);

    // Get behavior-based recommendations
    const behaviorPatterns = this.behavior.analyzeBehaviorPatterns(profileId);
    const behaviorWeight = behaviorPatterns.positivityRatio * behaviorPatterns.activityLevel;

    // Combine recommendations with behavior weight
    return networkRecommendations
      .map((id) => ({
        id,
        weight: this.network.getEdge(profileId, id)?.weight || 0,
      }))
      .sort((a, b) => b.weight * behaviorWeight - a.weight * behaviorWeight)
      .map((rec) => rec.id);
  }

  public getListingRecommendations(profileId: string): ServiceListing[] {
    // Placeholder: convert recommended profiles into stub listings
    const profileRecs = this.getProfileRecommendations(profileId);
    const results: ServiceListing[] = [];
    for (const id of profileRecs) {
      const prof = this.network.getNode(id)?.profile;
      if (!prof) continue;
      const listing: ServiceListing = {
        id: `rec_${id}`,
        title: `Recommended from ${prof.name}`,
        description: `Potential match with ${prof.name}`,
        type: 'service',
        providerId: id,
        location: prof.location,
        pricing: { basePrice: 'Negotiable', currency: 'USD', pricingType: 'negotiable' },
        availability: [],
        requirements: [],
        tags: prof.resources.skills.map(s => s.name).slice(0, 5),
        qualityMetrics: { rating: 4.0, reliability: 0.8, durability: 0.7, functionality: 0.8, aesthetics: 0.6, sustainability: 0.7 },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };
      results.push(listing);
    }
    return results;
  }

  public getOptimalMatches(profileId: string): { profileId: string; score: number }[] {
    const profile = this.network.getNode(profileId)?.profile;
    if (!profile) return [];

    return Array.from(this.network.getNodes().entries())
      .map(([id, node]: [string, GraphNode]) => {
        const edge = this.network.getEdge(profileId, id);
        const behaviorPatterns = this.behavior.analyzeBehaviorPatterns(id);
        const score =
          (edge?.weight || 0) *
          behaviorPatterns.positivityRatio *
          behaviorPatterns.activityLevel;

        return {
          profileId: id,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }
}