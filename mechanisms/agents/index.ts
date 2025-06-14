import { Profile, ServiceListing } from '../../shared/types';
import { NetworkManager } from '../network';
import { RecommendationEngine } from '../recommendation';
import { BehaviorObserver } from '../behavior';

export class PersonalAgent {
  private profileId: string;
  private network: NetworkManager;
  private recommendations: RecommendationEngine;
  private behavior: BehaviorObserver;

  constructor(
    profileId: string,
    network: NetworkManager,
    recommendations: RecommendationEngine,
    behavior: BehaviorObserver
  ) {
    this.profileId = profileId;
    this.network = network;
    this.recommendations = recommendations;
    this.behavior = behavior;
  }

  public async run(): Promise<void> {
    // Get recommendations for this profile
    const profileRecs = this.recommendations.getProfileRecommendations(this.profileId);
    const listingRecs = this.recommendations.getListingRecommendations(this.profileId);

    // Simulate interactions based on recommendations
    for (const profileId of profileRecs.slice(0, 3)) {
      await this.interactWithProfile(profileId);
    }

    for (const listing of listingRecs.slice(0, 3)) {
      await this.interactWithListing(listing);
    }
  }

  private async interactWithProfile(profileId: string): Promise<void> {
    // Simulate interaction with another profile
    this.behavior.observeInteraction(this.profileId, 'message', 'positive');
    this.behavior.observeInteraction(profileId, 'message', 'positive');
  }

  private async interactWithListing(listing: ServiceListing): Promise<void> {
    // Simulate interaction with a listing
    this.behavior.observeInteraction(this.profileId, 'view', 'neutral');
    this.behavior.observeInteraction(listing.providerId, 'view', 'neutral');
  }

  public getProfile(): Profile | undefined {
    return this.network.getNode(this.profileId)?.profile;
  }

  public getInteractionHistory(): {
    profileInteractions: number;
    listingInteractions: number;
  } {
    const behavior = this.behavior.analyzeBehaviorPatterns(this.profileId);
    return {
      profileInteractions: behavior.interactionFrequency,
      listingInteractions: behavior.activityLevel,
    };
  }
}

export class AgentManager {
  private agents: Map<string, PersonalAgent>;

  constructor() {
    this.agents = new Map();
  }

  public createAgent(
    profileId: string,
    network: NetworkManager,
    recommendations: RecommendationEngine,
    behavior: BehaviorObserver
  ): PersonalAgent {
    const agent = new PersonalAgent(
      profileId,
      network,
      recommendations,
      behavior
    );
    this.agents.set(profileId, agent);
    return agent;
  }

  public getAgent(profileId: string): PersonalAgent | undefined {
    return this.agents.get(profileId);
  }

  public async runAll(): Promise<void> {
    await Promise.all(
      Array.from(this.agents.values()).map((agent) => agent.run())
    );
  }
}