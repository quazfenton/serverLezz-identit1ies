import { ProfileManager } from '../profiles';

export class BehaviorObserver {
  private profiles: ProfileManager;

  constructor(profiles: ProfileManager) {
    this.profiles = profiles;
  }

  public observeInteraction(
    profileId: string,
    interactionType: 'view' | 'message' | 'transaction',
    outcome: 'positive' | 'neutral' | 'negative'
  ): void {
    const profile = this.profiles.getProfile(profileId);
    if (!profile) return;

    // Update profile based on interaction
    this.profiles.updateProfileWeights({
      profileId,
      interactions: 1,
      positiveFeedback: outcome === 'positive' ? 1 : 0,
      negativeFeedback: outcome === 'negative' ? 1 : 0,
      timeActive: 0,
    });
  }

  public observeActivity(profileId: string, duration: number): void {
    const profile = this.profiles.getProfile(profileId);
    if (!profile) return;

    // Update profile based on activity duration
    this.profiles.updateProfileWeights({
      profileId,
      interactions: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      timeActive: duration,
    });
  }

  public analyzeBehaviorPatterns(profileId: string): {
    interactionFrequency: number;
    positivityRatio: number;
    activityLevel: number;
  } {
    const profile = this.profiles.getProfile(profileId);
    if (!profile) return { interactionFrequency: 0, positivityRatio: 0, activityLevel: 0 };

    // Get weight history and analyze patterns
    const weights = this.profiles.getWeightTrend(profileId);
    if (weights.length === 0) return { interactionFrequency: 0, positivityRatio: 0, activityLevel: 0 };

    const interactionFrequency = weights.length;
    const positivityRatio = weights.filter((w) => w > 0.5).length / weights.length;
    const activityLevel = weights.reduce((sum, w) => sum + w, 0) / weights.length;

    return {
      interactionFrequency,
      positivityRatio,
      activityLevel,
    };
  }
}
