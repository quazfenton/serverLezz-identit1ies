import { ServiceListing, GraphNode } from '../../shared/types';
import { NetworkManager } from '../network';
import { BehaviorObserver } from '../behavior';

export class RecommendationEngine {
  private network: NetworkManager;
  private behavior: BehaviorObserver;

  constructor(
    network: NetworkManager,
    behavior: BehaviorObserver
  ) {
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
    // Listings will be injected separately; return empty array
    return [];
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
