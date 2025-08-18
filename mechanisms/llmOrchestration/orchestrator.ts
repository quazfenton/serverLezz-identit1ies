

// mechanisms/llmOrchestration/orchestrator.ts

import { NodalAgentProfile, PlatformItem, OrchestratorItemRecord, TransactionRecord, IncentiveWeights, Location } from '../../shared/types';
import { NodalAgent } from '../agents'; // For direct instance calls in mock

export class OrchestratorService {
    private agents: Map<string, NodalAgentProfile> = new Map(); // Storing profiles for lookup
    private agentInstances: Map<string, NodalAgent> = new Map(); // Storing actual agent instances for direct calls (in this mock)
    private itemKnowledgeBase: Map<string, OrchestratorItemRecord> = new Map(); // All published items
    private transactionLog: TransactionRecord[] = [];

    constructor() {}

    registerAgent(agent: NodalAgent) {
        this.agents.set(agent.profile.id, { ...agent.profile }); // Store a copy of the profile
        this.agentInstances.set(agent.profile.id, agent);
        console.log(`Orchestrator: Agent ${agent.profile.id} registered.`);
    }

    getAgentProfile(agentId: string): NodalAgentProfile | undefined {
        return this.agents.get(agentId);
    }

    getAgentLocation(agentId: string): Location | undefined {
        return this.agents.get(agentId)?.currentLocation;
    }

    notifyLocationUpdate(agentId: string, newLocation: Location) {
        const agentProfile = this.agents.get(agentId);
        if (agentProfile) {
            agentProfile.currentLocation = newLocation;
        }
        // In a real system, this would update a geospatial index (e.g., R-tree, PostGIS)
    }

    publishItem(item: PlatformItem) {
        this.itemKnowledgeBase.set(item.id, {...item, addedTimestamp: Date.now() });
        // console.log(`Orchestrator: Item ${item.id} ("${item.description}") published by ${item.ownerAgentId}.`);
    }

    // Simplified matching
    async findMatchingItems(
        sourceItem: PlatformItem, // The item an agent is trying to match (e.g., a seeking)
        requestingAgentId: string,
        targetItemTypeCategory: 'offering' | 'seeking' // Are we looking for offers or seeks?
    ): Promise<PlatformItem[]> {
        const potentialMatches: PlatformItem[] = [];
        const sourceIsSeeking = sourceItem.type.startsWith('seek') || sourceItem.type.startsWith('need');

        for (const [, candidateItemRecord] of this.itemKnowledgeBase) {
            if (candidateItemRecord.ownerAgentId === requestingAgentId) continue; // Don't match with self

            const candidateIsOffering = candidateItemRecord.type === 'good' || candidateItemRecord.type === 'service' || candidateItemRecord.type === 'idea';
            const candidateIsSeeking = candidateItemRecord.type.startsWith('request') || candidateItemRecord.type.startsWith('need');

            // Match seekings with offerings, and offerings with seekings
            let typesCompatible = false;
            if (sourceIsSeeking && targetItemTypeCategory === 'offering' && candidateIsOffering) {
                typesCompatible = this.areItemTypesCompatible(sourceItem.type, candidateItemRecord.type);
            } else if (!sourceIsSeeking && targetItemTypeCategory === 'seeking' && candidateIsSeeking) {
                typesCompatible = this.areItemTypesCompatible(sourceItem.type, candidateItemRecord.type);
            }

            if (typesCompatible) {
                // Basic pre-filtering (e.g., by primary tag or broad category if available)
                // For demo, we consider all compatible types. The agent will do finer scoring.
                potentialMatches.push(candidateItemRecord);
            }
        }
        return potentialMatches;
    }

    // Defines which item types can satisfy others
    private areItemTypesCompatible(seekingType: string, offeringType: string): boolean {
        if (seekingType === 'need_good' && offeringType === 'good') return true;
        if (seekingType === 'request_service' && offeringType === 'service') return true;
        // Add more rules: e.g. idea seeking idea, good seeking good (for barter)
        return false;
    }


    recordTransaction(seekerAgentId: string, offererAgentId: string, seekingItemId: string, offeringItemId: string, outcome: 'success' | 'failure') {
        this.transactionLog.push({ seekerAgentId, offererAgentId, seekingItemId, offeringItemId, outcome, timestamp: Date.now() });
        console.log(`Orchestrator: Transaction recorded - ${seekerAgentId} & ${offererAgentId}, outcome: ${outcome}`);

        // Update reputations
        const seekerAgent = this.agentInstances.get(seekerAgentId);
        const offererAgent = this.agentInstances.get(offererAgentId);

        if (outcome === 'success') {
            seekerAgent?.updateReputation(0.05); // Small positive boost
            offererAgent?.updateReputation(0.05);
        } else {
            seekerAgent?.updateReputation(-0.02); // Smaller penalty for failure
            offererAgent?.updateReputation(-0.02);
        }


        // This is where the "fine-tuning" of Nodal Agent's incentiveWeights would happen.
        // For demo, a very simplistic heuristic:
        if (outcome === 'success') {
            this.fineTuneAgentWeights(seekerAgentId, { success: true });
            this.fineTuneAgentWeights(offererAgentId, { success: true });
        } else {
            this.fineTuneAgentWeights(seekerAgentId, { success: false });
            this.fineTuneAgentWeights(offererAgentId, { success: false });
        }
    }

    // Mock fine-tuning. In reality, a complex ML model.
    private fineTuneAgentWeights(agentId: string, feedback: { success: boolean }) {
        const agent = this.agentInstances.get(agentId);
        if (!agent) return;

        const currentWeights = agent.profile.incentiveWeights;
        const newWeights: Partial<IncentiveWeights> = {};

        // Example: If successful, slightly increase weights that were likely important.
        // This is SUPER naive. Real ML would analyze features of the successful transaction.
        if (feedback.success) {
            // Assume proximity and semanticMatch are generally good indicators if they led to success
            if (currentWeights.proximity < 0.9) newWeights.proximity = currentWeights.proximity + 0.02;
            if (currentWeights.semanticMatch < 0.9) newWeights.semanticMatch = currentWeights.semanticMatch + 0.02;
        } else {
            // If failed, maybe be less reliant on what was prioritized? Or explore more.
            if (currentWeights.tagOverlap > 0.2) newWeights.tagOverlap = currentWeights.tagOverlap - 0.01;
            if (currentWeights.urgencyFactor < 0.8) newWeights.urgencyFactor = currentWeights.urgencyFactor + 0.01; // Try being more urgent
        }

        if (Object.keys(newWeights).length > 0) {
            agent.updateIncentiveWeights(newWeights);
        }
    }

    // Periodically run by the system to analyze overall network health and adjust models
    // This is a placeholder for much more complex global model training.
    runGlobalOptimizationCycle() {
        console.log("\n--- Orchestrator: Running Global Optimization Cycle ---");
        // Analyze transactionLog, itemKnowledgeBase, agent profiles...
        // e.g., Identify underserved needs, oversupplied goods in certain areas.
        // e.g., Train/update global embedding models.
        // e.g., Identify archetypes of agents and their successful strategies.

        // For this demo, let's just print some stats
        console.log(`Total agents: ${this.agents.size}`);
        console.log(`Total items in KB: ${this.itemKnowledgeBase.size}`);
        console.log(`Total transactions: ${this.transactionLog.length}`);
        const successfulTransactions = this.transactionLog.filter(t => t.outcome === 'success').length;
        console.log(`Successful transactions: ${successfulTransactions}`);
        // In a real system, this would trigger updates to the ML models which then
        // might lead to more refined `incentiveWeights` being pushed to agents.
        console.log("--- Global Optimization Cycle Complete ---");
    }
}
