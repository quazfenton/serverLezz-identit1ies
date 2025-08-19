import { Profile } from '../../shared/types';
import { ProfilesRepo } from '../../backend/repos'; // Assuming ProfilesRepo is available here

export class ProfileManager {
  private profilesRepo: ProfilesRepo;

  constructor(profilesRepo: ProfilesRepo) {
    this.profilesRepo = profilesRepo;
  }

  public async addProfile(profile: Profile): Promise<void> {
    // Initialize weightHistory for new profiles
    if (!profile.weightHistory) {
      profile.weightHistory = [profile.weight];
    }
    await this.profilesRepo.save(profile);
  }

  public async updateProfileWeights(behaviorData: {
    profileId: string;
    interactions: number;
    positiveFeedback: number;
    negativeFeedback: number;
    timeActive: number;
  }): Promise<void> {
    const profile = await this.profilesRepo.getById(behaviorData.profileId);
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
    await this.profilesRepo.save(profile);
  }

  public async getProfile(id: string): Promise<Profile | undefined> {
    return this.profilesRepo.getById(id);
  }

  public async getProfiles(): Promise<Profile[]> {
    return this.profilesRepo.getAll();
  }

  public async getWeightTrend(id: string): Promise<number[]> {
    const profile = await this.profilesRepo.getById(id);
    return profile?.weightHistory || [];
  }
}
