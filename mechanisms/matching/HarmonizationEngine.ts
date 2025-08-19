
import { Profile, PlatformItem, ValueVector, AbstractResourceType } from '../../shared/types';
import { NodalAgentProfile } from '../../shared/types';

// A simple representation of a user, adapted for the harmonization engine
interface User extends NodalAgentProfile {
    current_context: string; // Assuming context is a string for now
    well_being_score: number;
}

export class HarmonizationEngine {
    private max_distance_km: number;
    private time_decay_factor: number;

    constructor(max_distance_km: number = 5.0, time_decay_factor: number = 0.01) {
        this.max_distance_km = max_distance_km;
        this.time_decay_factor = time_decay_factor;
    }

    private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of Earth in kilometers

        const lat1_rad = this.toRad(lat1);
        const lon1_rad = this.toRad(lon1);
        const lat2_rad = this.toRad(lat2);
        const lon2_rad = this.toRad(lon2);

        const dlon = lon2_rad - lon1_rad;
        const dlat = lat2_rad - lat1_rad;

        const a = Math.sin(dlat / 2)**2 + Math.cos(lat1_rad) * Math.cos(lat2_rad) * Math.sin(dlon / 2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    private toRad(value: number): number {
        return value * Math.PI / 180;
    }

    private cosineSimilarity(vec1: { [key: string]: number }, vec2: { [key: string]: number }): number {
        if (!vec1 || !vec2) {
            return 0.0;
        }

        const intersection = Object.keys(vec1).filter(key => key in vec2);
        if (intersection.length === 0) {
            return 0.0;
        }

        const numerator = intersection.reduce((sum, key) => sum + vec1[key] * vec2[key], 0);

        const sum1_sq = Object.values(vec1).reduce((sum, val) => sum + val**2, 0);
        const sum2_sq = Object.values(vec2).reduce((sum, val) => sum + val**2, 0);

        const denominator = Math.sqrt(sum1_sq) * Math.sqrt(sum2_sq);

        if (!denominator) {
            return 0.0;
        }
        return numerator / denominator;
    }

    public calculateHarmonizationScore(
        need_particle: PlatformItem,
        offer_particle: PlatformItem,
        users: { [key: string]: User },
        current_time: Date
    ): number {
        if (need_particle.ownerAgentId === offer_particle.ownerAgentId) {
            return 0.0; // Cannot harmonize with oneself
        }

        // 1. Resource Type Match
        let resource_match_score = 1.0;
        if (need_particle.category !== offer_particle.category) {
            // Allow some flexibility for related types
            if ((need_particle.category === 'knowledge' && offer_particle.category === 'service') ||
               (need_particle.category === 'service' && offer_particle.category === 'knowledge')) {
                resource_match_score = 0.5;
            } else {
                return 0.0;
            }
        }

        // 2. Value Vector Similarity
        const value_similarity_score = this.cosineSimilarity(
            need_particle.valueVector?.attributes || {},
            offer_particle.valueVector?.attributes || {}
        );

        // 3. Proximity Score
        const dist = this.haversineDistance(
            need_particle.locationContext.latitude,
            need_particle.locationContext.longitude,
            offer_particle.locationContext.latitude,
            offer_particle.locationContext.longitude
        );
        const proximity_score = Math.max(0.0, 1.0 - (dist / this.max_distance_km));

        // 4. Urgency Alignment
        const urgency_score = ((need_particle.urgency || 0.5) + (offer_particle.urgency || 0.5)) / 2.0;

        // 5. Contextual Relevance
        const need_user = users[need_particle.ownerAgentId];
        const offer_user = users[offer_particle.ownerAgentId];
        let context_relevance_score = 0.0;
        if (need_user && offer_user) {
            if (need_user.current_context === 'work' && offer_user.current_context === 'work') {
                context_relevance_score = 1.0;
            } else if (need_user.current_context === offer_user.current_context) {
                context_relevance_score = 0.5;
            } else {
                context_relevance_score = 0.2;
            }
        }

        // 6. Time Decay
        const time_diff_seconds = (current_time.getTime() - new Date(need_particle.createdAt).getTime()) / 1000;
        const time_decay = Math.exp(-this.time_decay_factor * time_diff_seconds);

        // 7. Well-being Impact
        let well_being_impact_score = 0.5;
        if (need_user && offer_user) {
            well_being_impact_score = (1.0 - need_user.well_being_score) * 0.5 + (1.0 - offer_user.well_being_score) * 0.5;
            well_being_impact_score = Math.max(0.0, Math.min(1.0, well_being_impact_score + 0.5));
        }

        // Combine all scores with weights
        const total_score = (
            resource_match_score * 0.20 +
            value_similarity_score * 0.25 +
            proximity_score * 0.15 +
            urgency_score * 0.10 +
            context_relevance_score * 0.15 +
            time_decay * 0.05 +
            well_being_impact_score * 0.10
        );

        return total_score;
    }

    public findOptimalMatches(
        sourceProfile: Profile,
        candidateProfiles: Profile[],
        users: { [key: string]: User },
        currentTime: Date
    ): any[] {
        const matches = [];

        for (const candidate of candidateProfiles) {
            if (sourceProfile.id === candidate.id) continue;

            for (const seeking of sourceProfile.seekings) {
                for (const offering of candidate.offerings) {
                    const score = this.calculateHarmonizationScore(seeking, offering, users, currentTime);
                    if (score > 0.5) {
                        matches.push({ profileA: sourceProfile, profileB: candidate, score, seeking, offering });
                    }
                }
            }
        }

        return matches.sort((a, b) => b.score - a.score);
    }
}
