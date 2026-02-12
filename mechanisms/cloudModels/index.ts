import {
  Profile,
  OptimizationObjective,
  MatchingResult,
  SystemMetrics,
  RecommendedAction,
  BehaviorProfile,
} from "../../shared/types";

// Minimal working CloudModelEngine to satisfy backend dependencies and enable demos
export class CloudModelEngine {
  constructor() {}

  private async mockLLMCall(prompt: string): Promise<any> {
    console.log(`[CloudModelEngine] Mock LLM Call with prompt: "${prompt.substring(0, 100)}..."`);
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

    if (prompt.includes("enhance profile")) {
        return {
            socialStyle: ["collaborative", "analytical", "creative", "expressive"][Math.floor(Math.random() * 4)],
            decisionMakingStyle: ["intuitive", "data-driven", "cautious"][Math.floor(Math.random() * 3)],
            predictedActions: ["seek_knowledge", "offer_skill", "join_project"],
        };
    }

    if (prompt.includes("optimize matching")) {
        return {
            matchScore: Math.random() * 0.5 + 0.3,
        };
    }

    return {};
  }

  public async enhanceProfile(profile: Profile): Promise<Profile> {
    const enhanced = { ...profile };
    const prompt = `enhance profile for user ${profile.id} with name ${profile.name}`;
    const llmResponse = await this.mockLLMCall(prompt);

    enhanced.weight = Math.min(1, (enhanced.weight ?? 0.5) * 1.01);
    enhanced.lastUpdated = new Date();
    if (!enhanced.behaviorProfile) {
      enhanced.behaviorProfile = {} as BehaviorProfile;
    }
    enhanced.behaviorProfile.socialStyle = llmResponse.socialStyle || enhanced.behaviorProfile.socialStyle;
    enhanced.behaviorProfile.decisionMakingStyle = llmResponse.decisionMakingStyle || enhanced.behaviorProfile.decisionMakingStyle;
    enhanced.behaviorProfile.predictedActions = llmResponse.predictedActions || enhanced.behaviorProfile.predictedActions;
    
    return enhanced;
  }

  public async optimizeMatching(
    sourceProfile: Profile,
    candidateProfiles: Profile[],
  ): Promise<MatchingResult[]> {
    const matches: MatchingResult[] = [];

    for (const candidate of candidateProfiles) {
        if (candidate.id === sourceProfile.id) continue;

        const prompt = `optimize matching between ${sourceProfile.id} and ${candidate.id}`;
        const llmResponse = await this.mockLLMCall(prompt);

        matches.push({
            profileA: sourceProfile.id,
            profileB: candidate.id,
            score: llmResponse.matchScore || 0,
            reason: `LLM-optimized match`,
            matchScore: llmResponse.matchScore || 0,
        });
    }

    return matches
      .sort((a, b) => (b.matchScore || b.score) - (a.matchScore || a.score))
      .slice(0, 20);
  }

  public async optimizeSystemPerformance(
    systemMetrics: SystemMetrics,
    objectives: OptimizationObjective[],
  ): Promise<RecommendedAction[]> {
    const actions: RecommendedAction[] = [];
    if ((systemMetrics.wasteLevel ?? 0) > 0.2) {
      actions.push({
        type: 'connect',
        priority: 0.8,
        confidence: 0.7,
        description: 'Reduce waste level in network',
        expectedOutcome: { utilityGain: 0.5 },
        requiredResources: ['communication'],
        timeline: {
          start: new Date(),
          end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
        action: 'reduce_waste',
        target: 'network',
        value: 0.05,
        justification: 'Waste level high',
      });
    } else {
      actions.push({
        type: 'collaborate',
        priority: 0.7,
        confidence: 0.6,
        description: 'Improve fairness in allocation',
        expectedOutcome: { utilityGain: 0.3 },
        requiredResources: ['allocation'],
        timeline: {
          start: new Date(),
          end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        action: 'increase_equity',
        target: 'allocation',
        value: 0.03,
        justification: 'Improve fairness',
      });
    }
    return actions;
  }
}

export default CloudModelEngine;
