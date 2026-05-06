import { Profile } from '../../shared/types';

export class PersonalAgent {
  private profile: Profile;
  private interactionCount: number = 0;

  constructor(profile: Profile) {
    this.profile = profile;
  }

  getProfile(): Profile {
    return this.profile;
  }

  getInteractionHistory(): { profileInteractions: number } {
    return { profileInteractions: this.interactionCount };
  }

  async run(): Promise<void> {
    this.interactionCount++;
    console.log(`Agent ${this.profile.id} running (interaction #${this.interactionCount})`);
  }
}

export class AgentManager {
  private agents: Map<string, PersonalAgent> = new Map();

  constructor() {}

  createAgent(profile: Profile): PersonalAgent {
    const agent = new PersonalAgent(profile);
    this.agents.set(profile.id, agent);
    return agent;
  }

  getAgent(profileId: string): PersonalAgent | undefined {
    return this.agents.get(profileId);
  }

  async runAll(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.run();
    }
  }
}
