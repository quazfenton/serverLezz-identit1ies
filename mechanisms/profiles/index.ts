import { Profile } from '../../shared/types';

export class ProfileManager {
  private profilesMap: Map<string, Profile> = new Map();

  constructor() {}

  public addProfile(profile: Profile): void {
    if (!profile.weightHistory) {
      profile.weightHistory = [profile.weight];
    }
    this.profilesMap.set(profile.id, profile);
  }

  public getProfile(id: string): Profile | undefined {
    return this.profilesMap.get(id);
  }

  public getProfiles(): Profile[] {
    return Array.from(this.profilesMap.values());
  }

  public updateProfileWeights(behaviorData: {
    profileId: string;
    interactions: number;
    positiveFeedback: number;
    negativeFeedback: number;
    timeActive: number;
  }): void {
    const profile = this.profilesMap.get(behaviorData.profileId);
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
    if (!profile.weightHistory) {
      profile.weightHistory = [];
    }
    profile.weightHistory.push(newWeight);

    // Apply weight decay based on historical trends
    const weights = profile.weightHistory || [];
    if (weights.length > 10) {
      const trend = weights
        .slice(-10)
        .reduce((sum, weight) => sum + weight, 0) / 10;
      profile.weight = Math.max(0.1, trend * 0.9);
    }
  }

  public getWeightTrend(id: string): number[] {
    const profile = this.profilesMap.get(id);
    return profile?.weightHistory || [];
  }
}
