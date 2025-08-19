import { Profile, ServiceListing } from '../../shared/types';
import { NetworkManager } from '../network';
import { ProfileManager } from '../profiles';
import { CloudModelEngine } from '../cloudModels'; // Import CloudModelEngine

export class HighDimSimulation {
  private network: NetworkManager;
  private profiles: ProfileManager;
  private cloudModels: CloudModelEngine[]; // Changed type to CloudModelEngine
  // Note: The original CloudModel was an interface, but CloudModelEngine is a class.
  // Assuming CloudModelEngine is the intended type for cloudModels.

  constructor(
    network: NetworkManager,
    profiles: ProfileManager,
    cloudModels: CloudModelEngine[] // Changed type
  ) {
    this.network = network;
    this.profiles = profiles;
    this.cloudModels = cloudModels;
  }

  public async simulateInteraction(
    profileA: Profile,
    profileB: Profile
  ): Promise<void> {
    // Process profiles through cloud models
    const updatedProfileA = await this.processProfileThroughModels(profileA);
    const updatedProfileB = await this.processProfileThroughModels(profileB);

    // Update profiles in the system (this will save to repo now)
    await this.profiles.addProfile(updatedProfileA); // Use addProfile which saves
    await this.profiles.addProfile(updatedProfileB); // Use addProfile which saves

    // Calculate interaction weight based on profile similarities
    const weight = this.calculateInteractionWeight(
      updatedProfileA,
      updatedProfileB
    );

    // Update network connections
    this.network.addEdge(updatedProfileA.id, updatedProfileB.id, weight);
  }

  private async processProfileThroughModels(
    profile: Profile
  ): Promise<Profile> {
    let updatedProfile = profile;
    for (const model of this.cloudModels) {
      // Call the enhanceProfile method of the CloudModelEngine
      updatedProfile = await model.enhanceProfile(updatedProfile);
    }
    return updatedProfile;
  }

  private calculateInteractionWeight(
    profileA: Profile,
    profileB: Profile
  ): number {
    // More robust needs/skills matching
    const aNeeds = new Set(profileA.resources.needs.map(n => n.name.toLowerCase()));
    const bSkills = new Set(profileB.resources.skills.map(s => s.name.toLowerCase()));
    const aSkills = new Set(profileA.resources.skills.map(s => s.name.toLowerCase()));
    const bNeeds = new Set(profileB.resources.needs.map(n => n.name.toLowerCase()));

    const needsToSkillsOverlap = Array.from(aNeeds).filter(need => bSkills.has(need)).length;
    const skillsToNeedsOverlap = Array.from(aSkills).filter(skill => bNeeds.has(skill)).length;

    const totalMatches = needsToSkillsOverlap + skillsToNeedsOverlap;
    const maxPossible = Math.max(
      1,
      profileA.resources.needs.length + profileA.resources.skills.length,
      profileB.resources.needs.length + profileB.resources.skills.length
    );

    return Math.min(1, totalMatches / maxPossible);
  }

  public async runSimulationStep(): Promise<void> {
    // Get all profiles from the ProfileManager (which now uses the repo)
    const allProfiles = await this.profiles.getProfiles();
    const profileIds = allProfiles.map(p => p.id);

    if (profileIds.length < 2) {
        console.log("Not enough profiles to simulate interactions.");
        return;
    }

    // Simulate random interactions
    // Limit to a reasonable number of interactions per step to avoid excessive load
    const numInteractions = Math.min(10, profileIds.length * (profileIds.length - 1) / 2); // Max possible pairs

    for (let i = 0; i < numInteractions; i++) {
      const idxA = Math.floor(Math.random() * profileIds.length);
      let idxB = Math.floor(Math.random() * profileIds.length);
      while (idxA === idxB) { // Ensure different profiles
        idxB = Math.floor(Math.random() * profileIds.length);
      }

      const profileA = await this.profiles.getProfile(profileIds[idxA]);
      const profileB = await this.profiles.getProfile(profileIds[idxB]);

      if (profileA && profileB) {
        await this.simulateInteraction(profileA, profileB);
      }
    }

    // Update network weights
    this.network.updateWeights();
  }
}
