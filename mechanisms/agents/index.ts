

// mechanisms/agents/index.ts

import { Location, PlatformItem, IncentiveWeights, NodalAgentProfile } from '../../shared/types';
import { getDistance, mockGenerateEmbedding, cosineSimilarity } from '../utils';
import { OrchestratorService } from '../llmOrchestration/orchestrator';

export class NodalAgent {
    public profile: NodalAgentProfile;
    private orchestrator: OrchestratorService; // Reference to the (mocked) orchestrator

    constructor(id: string, initialLocation: Location, orchestrator: OrchestratorService) {
        this.profile = {
            id,
            currentLocation: initialLocation,
            offerings: [],
            seekings: [],
            incentiveWeights: { // Default initial weights
              proximity: 0.3,
              semanticMatch: 0.4,
              tagOverlap: 0.2,
              urgencyFactor: 0.1,
              reputationInfluence: 0.3,
              valueAlignment: 0.4,
            },
            preferencesVector: mockGenerateEmbedding(`default_preferences_${id}`),
            localInteractionHistory: new Map(),
            reputationScore: 0.5, // Initial neutral reputation
        };
        this.orchestrator = orchestrator;
        this.orchestrator.registerAgent(this); // Register with orchestrator
    }

    updateLocation(newLocation: Location) {
        this.profile.currentLocation = newLocation;
        console.log(`Agent ${this.profile.id} moved to ${newLocation.latitude}, ${newLocation.longitude}`);
        // Potentially notify orchestrator for geospatial index update
        this.orchestrator.notifyLocationUpdate(this.profile.id, newLocation);
    }

    addOffering(itemDetails: Omit<PlatformItem, 'id' | 'ownerAgentId' | 'descriptionEmbedding'>): PlatformItem {
        const newItem: PlatformItem = {
            ...itemDetails,
            id: `offer-${this.profile.id}-${Date.now()}`,
            ownerAgentId: this.profile.id,
            descriptionEmbedding: mockGenerateEmbedding(itemDetails.description),
        };
        this.profile.offerings.push(newItem);
        console.log(`Agent ${this.profile.id} added offering: ${newItem.description}`);
        this.orchestrator.publishItem(newItem); // Publish to orchestrator's knowledge base
        return newItem;
    }

    addSeeking(itemDetails: Omit<PlatformItem, 'id' | 'ownerAgentId' | 'descriptionEmbedding'>): PlatformItem {
        const newItem: PlatformItem = {
            ...itemDetails,
            id: `seek-${this.profile.id}-${Date.now()}`,
            ownerAgentId: this.profile.id,
            descriptionEmbedding: mockGenerateEmbedding(itemDetails.description),
        };
        this.profile.seekings.push(newItem);
        console.log(`Agent ${this.profile.id} added seeking: ${newItem.description}`);
        this.orchestrator.publishItem(newItem);
        return newItem;
    }

    // This is the agent's local evaluation logic
    evaluatePotentialMatch(ownItem: PlatformItem, candidateItem: PlatformItem, candidateAgentReputation: number): number {
        let score = 0;

        // 1. Proximity Score (if applicable)
        let proximityScore = 0;
        const loc1 = ownItem.locationContext || this.profile.currentLocation;
        const loc2 = candidateItem.locationContext || this.orchestrator.getAgentLocation(candidateItem.ownerAgentId); // Get provider's location
        if (loc1 && loc2) {
            const distance = getDistance(loc1, loc2);
            proximityScore = Math.max(0, 1 - (distance / 50)); // Max score for <0km, 0 score for >50km
        }

        // 2. Semantic Match Score
        const semanticScore = cosineSimilarity(ownItem.descriptionEmbedding, candidateItem.descriptionEmbedding);

        // 3. Tag Overlap Score
        const commonTags = ownItem.tags.filter(tag => candidateItem.tags.includes(tag)).length;
        const totalUniqueTags = new Set([...ownItem.tags, ...candidateItem.tags]).size;
        const tagScore = totalUniqueTags > 0 ? commonTags / totalUniqueTags : 0;

        // 4. Urgency (simplified - could be based on activeUntil or explicit urgency flags)
        // For demo, let's assume a static urgency factor from weights for now.

        // 5. Reputation Influence
        const reputationBonus = (candidateAgentReputation - 0.5) * 2; // Scale -1 to 1


        // Weighted sum
        score = (proximityScore * this.profile.incentiveWeights.proximity) +
                (semanticScore * this.profile.incentiveWeights.semanticMatch) +
                (tagScore * this.profile.incentiveWeights.tagOverlap) +
                (reputationBonus * this.profile.incentiveWeights.reputationInfluence);
                // Add urgency if implemented

        // Normalize to be roughly between 0 and 1 (or a bit more)
        const totalWeight = this.profile.incentiveWeights.proximity +
                            this.profile.incentiveWeights.semanticMatch +
                            this.profile.incentiveWeights.tagOverlap +
                            this.profile.incentiveWeights.reputationInfluence;

        return score / (totalWeight || 1);
    }

    async findAndProcessMatches() {
        console.log(`\nAgent ${this.profile.id} looking for matches...`);
        if (this.profile.seekings.length === 0 && this.profile.offerings.length === 0) {
            console.log(`Agent ${this.profile.id} has no active seekings or offerings.`);
            return;
        }

        // For each seeking, find potential offerings from others
        for (const seeking of this.profile.seekings) {
            // "Call" to orchestrator (simulated)
            const potentialMatches = await this.orchestrator.findMatchingItems(seeking, this.profile.id, 'offering');

            if (potentialMatches.length > 0) {
                console.log(`For seeking "${seeking.description}", Agent ${this.profile.id} found ${potentialMatches.length} potential offerings:`);
                let bestMatch: { item: PlatformItem, score: number, agentRep: number } | null = null;

                for (const matchItem of potentialMatches) {
                    const candidateAgent = this.orchestrator.getAgentProfile(matchItem.ownerAgentId);
                    if (!candidateAgent) continue;

                    const score = this.evaluatePotentialMatch(seeking, matchItem, candidateAgent.reputationScore);
                    console.log(`  - Potential offering: "${matchItem.description}" (from ${matchItem.ownerAgentId}). Score: ${score.toFixed(3)}`);
                    if (!bestMatch || score > bestMatch.score) {
                        bestMatch = { item: matchItem, score, agentRep: candidateAgent.reputationScore };
                    }
                }

                if (bestMatch && bestMatch.score > 0.5) { // Threshold for "making a deal"
                    console.log(`  Agent ${this.profile.id} chooses to connect with ${bestMatch.item.ownerAgentId} for "${bestMatch.item.description}" (Score: ${bestMatch.score.toFixed(3)})`);
                    // Simulate interaction & feedback
                    // Assume positive interaction for demo
                    this.recordInteraction(bestMatch.item.ownerAgentId, 'positive');
                    this.orchestrator.recordTransaction(this.profile.id, bestMatch.item.ownerAgentId, seeking.id, bestMatch.item.id, 'success');
                } else {
                    console.log(`  No sufficiently good offering found for "${seeking.description}".`);
                }
            } else {
                 console.log(`No offerings found for seeking "${seeking.description}".`);
            }
        }
        // Could do a similar loop for offerings finding seekings
    }

    recordInteraction(otherAgentId: string, outcome: 'positive' | 'negative' | 'neutral') {
        this.profile.localInteractionHistory.set(otherAgentId, outcome);
        // This local history could also feed into its own preference adjustments over time
    }

    // Called by orchestrator after fine-tuning
    updateIncentiveWeights(newWeights: Partial<IncentiveWeights>) {
        this.profile.incentiveWeights = { ...this.profile.incentiveWeights, ...newWeights };
        console.log(`Agent ${this.profile.id} updated incentive weights:`, this.profile.incentiveWeights);
    }

    updateReputation(change: number) {
        this.profile.reputationScore = Math.max(0, Math.min(1, this.profile.reputationScore + change));
         console.log(`Agent ${this.profile.id} reputation updated to: ${this.profile.reputationScore.toFixed(2)}`);
    }
}

// Minimal personal agent wrapper used by backend/server.ts
export class PersonalAgent {
    private id: string;
    private interactionCount: number = 0;

    constructor(profileId: string) {
        this.id = profileId;
    }

    getProfile() {
        return { id: this.id } as any;
    }

    getInteractionHistory() {
        return { profileInteractions: this.interactionCount } as any;
    }

    async run() {
        // placeholder; increment some activity
        this.interactionCount += Math.floor(Math.random() * 2);
    }
}

export class AgentManager {
    private agents: Map<string, PersonalAgent> = new Map();

    createAgent(profileId: string, ..._args: any[]): PersonalAgent {
        const agent = new PersonalAgent(profileId);
        this.agents.set(profileId, agent);
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
