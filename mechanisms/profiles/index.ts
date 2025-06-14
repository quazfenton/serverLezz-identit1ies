import { Profile } from '../../shared/types';

export class ProfileManager {
  private profiles: Map<string, Profile>;
  private weightHistory: Map<string, number[]>;

  constructor() {
    this.profiles = new Map();
    this.weightHistory = new Map();
  }

  public addProfile(profile: Profile): void {
    this.profiles.set(profile.id, profile);
    this.weightHistory.set(profile.id, [profile.weight]);
  }

  public updateProfileWeights(behaviorData: {
    profileId: string;
    interactions: number;
    positiveFeedback: number;
    negativeFeedback: number;
    timeActive: number;
  }): void {
    const profile = this.profiles.get(behaviorData.profileId);
    if (!profile) return;

    // Calculate new weight based on behavior
    const interactionFactor = Math.min(1, behaviorData.interactions / 10);
    const feedbackFactor = Math.max(
      0,
      behaviorData.positiveFeedback - behaviorData.negativeFeedback
    );
    const timeFactor = Math.min(1, behaviorData.timeActive / (1000 * 60 * 60)); // 1 hour

    const newWeight = Math.min(
      1,
      profile.weight +
        (interactionFactor * 0.2 + feedbackFactor * 0.3 + timeFactor * 0.1)
    );

    // Update profile and store weight history
    profile.weight = newWeight;
    this.weightHistory.get(profile.id)?.push(newWeight);

    // Apply weight decay based on historical trends
    const weights = this.weightHistory.get(profile.id) || [];
    if (weights.length > 10) {
      const trend = weights
        .slice(-10)
        .reduce((sum, weight) => sum + weight, 0) / 10;
      profile.weight = Math.max(0.1, trend * 0.9);
    }
  }

  public getProfile(id: string): Profile | undefined {
    return this.profiles.get(id);
  }

  public getProfiles(): Map<string, Profile> {
    return this.profiles;
  }

  public getWeightTrend(id: string): number[] {
    return this.weightHistory.get(id) || [];
  }
}