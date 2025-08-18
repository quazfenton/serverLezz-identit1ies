
// simulation.ts (temporary for testing core logic)

import { NodalAgent } from './mechanisms/agents';
import { OrchestratorService } from './mechanisms/llmOrchestration/orchestrator';

// --- Simulation ---
async function runSimulation() {
    console.log("--- Starting P2P Marketplace Simulation ---");

    const orchestrator = new OrchestratorService();

    const alice = new NodalAgent("Alice", { latitude: 34.0522, longitude: -118.2437 }, orchestrator); // Los Angeles
    const bob = new NodalAgent("Bob", { latitude: 34.0530, longitude: -118.2450 }, orchestrator);   // Los Angeles (nearby)
    const charlie = new NodalAgent("Charlie", { latitude: 40.7128, longitude: -74.0060 }, orchestrator); // New York

    // Alice needs gardening tools and can offer web design
    alice.addSeeking({
        type: 'need_good',
        description: "Looking for a sturdy garden spade",
        tags: ["gardening", "tools", "spade", "outdoor"],
        locationContext: alice.profile.currentLocation, // Need it locally
        quantity: 1
    });
    alice.addOffering({
        type: 'service',
        description: "Professional web design services for small businesses",
        tags: ["web design", "freelance", "tech", "creative"],
        valuePerception: 100 // Per hour/project
    });

    // Bob has gardening tools to offer and needs a logo
    bob.addOffering({
        type: 'good',
        description: "Slightly used garden spade for sale",
        tags: ["gardening", "tools", "spade", "sale"],
        locationContext: bob.profile.currentLocation,
        quantity: 1,
        valuePerception: 15
    });
    bob.addSeeking({
        type: 'request_service',
        description: "Need a logo designed for my new bakery",
        tags: ["logo design", "graphic design", "branding", "bakery"],
    });

    // Charlie offers lawn mowing services (far away from Alice/Bob)
    charlie.addOffering({
        type: 'service',
        description: "Expert lawn mowing and garden care",
        tags: ["gardening", "lawn care", "outdoor", "service"],
        locationContext: charlie.profile.currentLocation,
        valuePerception: 50
    });
     charlie.addSeeking({
        type: 'need_good',
        description: "High-quality organic fertilizer",
        tags: ["gardening", "fertilizer", "organic"],
    });


    // Simulate agents looking for matches
    await alice.findAndProcessMatches();
    await bob.findAndProcessMatches();
    await charlie.findAndProcessMatches(); // Charlie likely won't find local matches with Alice/Bob

    // Simulate a location change for Alice (moves closer to Bob for some reason)
    // alice.updateLocation({ latitude: 34.0528, longitude: -118.2445 });
    // await alice.findAndProcessMatches(); // Re-evaluate based on new location


    // Simulate orchestrator's periodic global optimization
    orchestrator.runGlobalOptimizationCycle();

    console.log("\n--- Final Agent Profiles ---");
    console.log("Alice's Profile:", alice.profile);
    console.log("Bob's Profile:", bob.profile);
    console.log("Charlie's Profile:", charlie.profile);

    console.log("\n--- Simulation Complete ---");
}

runSimulation().catch(console.error);
