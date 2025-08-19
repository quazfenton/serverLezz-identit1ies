

// mechanisms/agents/index.ts

import { Profile, ServiceListing, AbstractResourceType } from '../../shared/types';
import { ListingsRepo, ProfilesRepo } from '../../backend/repos';
import { HarmonizationEngine } from '../matching/HarmonizationEngine';

// The NodalAgent seems to be part of a separate simulation and is not used by the main server.
// I will focus on enhancing the PersonalAgent as per the integration plan.

// Minimal personal agent wrapper used by backend/server.ts
export class PersonalAgent {
    private profile: Profile;
    private listingsRepo: ListingsRepo;
    private profilesRepo: ProfilesRepo;
    private harmonizationEngine: HarmonizationEngine;
    private interactionCount: number = 0;

    constructor(
        profile: Profile,
        listingsRepo: ListingsRepo,
        profilesRepo: ProfilesRepo,
        harmonizationEngine: HarmonizationEngine
    ) {
        this.profile = profile;
        this.listingsRepo = listingsRepo;
        this.profilesRepo = profilesRepo;
        this.harmonizationEngine = harmonizationEngine;
    }

    getProfile() {
        return this.profile;
    }

    getInteractionHistory() {
        return { profileInteractions: this.interactionCount };
    }

    async run() {
        // A more meaningful run method for the agent.
        // The agent will try to find matches for its needs.
        this.interactionCount++;

        const needs = this.profile.resources?.needs;
        if (!needs || needs.length === 0) {
            // console.log(`Agent ${this.profile.id} has no needs.`);
            return;
        }

        console.log(`Agent ${this.profile.id} is looking for matches for its needs...`);

        const allListings = await this.listingsRepo.getAll();
        const activeListings = allListings.filter(l => l.isActive && l.providerId !== this.profile.id);

        if (activeListings.length === 0) {
            console.log(`Agent ${this.profile.id} found no active listings.`);
            return;
        }
        
        // For simplicity, let's focus on the first need
        const firstNeed = needs[0];

        // We need to create a "seeker profile" for the harmonization engine
        const seekerProfile = this.profile;

        // The harmonization engine expects an array of candidate profiles, not listings.
        // This is a limitation of the current implementation.
        // For now, we will just log the intent of the agent.
        // A future improvement would be to adapt the harmonization engine to match profiles to listings.

        console.log(`Agent ${this.profile.id} has identified the need: "${firstNeed.name}". It would now search for matching listings.`);

        // In a future implementation, the agent would do something like this:
        /*
        const allUsers = await this.profilesRepo.getAll();
        const allUsersMap = allUsers.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {} as { [key: string]: Profile });

        const potentialProviders = activeListings.map(l => allUsersMap[l.providerId]).filter(Boolean);

        const matches = this.harmonizationEngine.findOptimalMatches(seekerProfile, potentialProviders, allUsersMap, new Date());

        if (matches.length > 0) {
            const bestMatch = matches[0];
            console.log(`Agent ${this.profile.id} found a potential match for "${firstNeed.name}": Profile ${bestMatch.profileB} with a score of ${bestMatch.score}`);
        }
        */
    }
}

export class AgentManager {
    private agents: Map<string, PersonalAgent> = new Map();
    private listingsRepo: ListingsRepo;
    private profilesRepo: ProfilesRepo;
    private harmonizationEngine: HarmonizationEngine;

    constructor(
        listingsRepo: ListingsRepo,
        profilesRepo: ProfilesRepo,
        harmonizationEngine: HarmonizationEngine
    ) {
        this.listingsRepo = listingsRepo;
        this.profilesRepo = profilesRepo;
        this.harmonizationEngine = harmonizationEngine;
    }

    createAgent(profile: Profile): PersonalAgent {
        const agent = new PersonalAgent(
            profile,
            this.listingsRepo,
            this.profilesRepo,
            this.harmonizationEngine
        );
        this.agents.set(profile.id, agent);
        return agent;
    }

    getAgent(profileId: string): PersonalAgent | undefined {
        return this.agents.get(profileId);
    }

    async runAll() {
        for (const agent of this.agents.values()) {
            await agent.run();
        }
    }
}
