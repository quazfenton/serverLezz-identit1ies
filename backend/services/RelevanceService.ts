// ═══════════════════════════════════════════════════════════════════════════════
// Coordination Cosmos — Relevance Scoring Service
// AI-powered relevance calculation for listings and profiles
// ═══════════════════════════════════════════════════════════════════════════════

import { Profile, ServiceListing } from "../../shared/types";

export interface RelevanceScore {
  overall: number;
  breakdown: {
    tagMatch: number;
    semanticMatch: number;
    locationMatch: number;
    reputationMatch: number;
    recencyMatch: number;
  };
  reasons: string[];
}

export class RelevanceService {
  /**
   * Calculate relevance score for a listing based on user profile
   */
  calculateListingRelevance(profile: Profile, listing: ServiceListing): RelevanceScore {
    const breakdown = {
      tagMatch: this.calculateTagMatch(profile, listing),
      semanticMatch: this.calculateSemanticMatch(profile, listing),
      locationMatch: this.calculateLocationMatch(profile, listing),
      reputationMatch: this.calculateReputationMatch(profile, listing),
      recencyMatch: this.calculateRecencyMatch(listing),
    };

    // Weighted average
    const overall = (
      breakdown.tagMatch * 0.30 +
      breakdown.semanticMatch * 0.25 +
      breakdown.locationMatch * 0.20 +
      breakdown.reputationMatch * 0.15 +
      breakdown.recencyMatch * 0.10
    );

    const reasons = this.generateRelevanceReasons(profile, listing, breakdown);

    return {
      overall: Math.round(overall * 100) / 100,
      breakdown,
      reasons,
    };
  }

  /**
   * Calculate tag match score
   */
  private calculateTagMatch(profile: Profile, listing: ServiceListing): number {
    const profileTags = this.extractProfileTags(profile);
    const listingTags = listing.tags.map(t => t.toLowerCase());

    if (listingTags.length === 0 || profileTags.length === 0) {
      return 0.5; // Neutral if no tags
    }

    const matches = listingTags.filter(tag => profileTags.includes(tag));
    const matchRatio = matches.length / listingTags.length;

    // Bonus for multiple matches
    const bonus = Math.min(0.2, matches.length * 0.05);

    return Math.min(1, matchRatio + bonus);
  }

  /**
   * Calculate semantic match using text similarity
   */
  private calculateSemanticMatch(profile: Profile, listing: ServiceListing): number {
    const profileText = this.buildProfileText(profile).toLowerCase();
    const listingText = `${listing.title} ${listing.description}`.toLowerCase();

    // Simple word overlap
    const profileWords = new Set(profileText.split(/\s+/).filter(w => w.length > 3));
    const listingWords = listingText.split(/\s+/).filter(w => w.length > 3);

    if (listingWords.length === 0) return 0.5;

    const matches = listingWords.filter(word => profileWords.has(word));
    return Math.min(1, matches.length / Math.sqrt(listingWords.length));
  }

  /**
   * Calculate location match score
   */
  private calculateLocationMatch(profile: Profile, listing: ServiceListing): number {
    if (!profile.location || !listing.location) {
      return 0.5; // Neutral if no location data
    }

    const distance = this.haversineDistance(profile.location, listing.location);

    // Score decreases with distance
    // 0km = 1.0, 50km = 0.5, 100km+ = 0.0
    const score = Math.max(0, 1 - (distance / 100));

    return Math.round(score * 100) / 100;
  }

  /**
   * Calculate reputation match score
   */
  private calculateReputationMatch(profile: Profile, listing: ServiceListing): number {
    const providerReputation = listing.qualityMetrics?.rating || 0.5;
    const userReputation = profile.reputation?.overall || 0.5;

    // Higher reputation providers get better scores
    // Also consider if user reputation is compatible
    const providerScore = providerReputation;
    const compatibilityScore = 1 - Math.abs(providerReputation - userReputation);

    return (providerScore * 0.7 + compatibilityScore * 0.3);
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyMatch(listing: ServiceListing): number {
    const now = Date.now();
    const listingTime = new Date(listing.updatedAt || listing.createdAt).getTime();
    const ageHours = (now - listingTime) / (1000 * 60 * 60);

    // Newer listings get higher scores
    // 0 hours = 1.0, 24 hours = 0.8, 168 hours (1 week) = 0.4, 720 hours (30 days) = 0.0
    const score = Math.max(0, 1 - (ageHours / 720));

    return Math.round(score * 100) / 100;
  }

  /**
   * Generate human-readable relevance reasons
   */
  private generateRelevanceReasons(
    profile: Profile,
    listing: ServiceListing,
    breakdown: RelevanceScore['breakdown']
  ): string[] {
    const reasons: string[] = [];

    if (breakdown.tagMatch > 0.7) {
      const matchingTags = listing.tags.filter(tag =>
        this.extractProfileTags(profile).includes(tag.toLowerCase())
      );
      if (matchingTags.length > 0) {
        reasons.push(`Matches your interests: ${matchingTags.slice(0, 3).join(', ')}`);
      }
    }

    if (breakdown.locationMatch > 0.8) {
      reasons.push('Near your location');
    } else if (breakdown.locationMatch > 0.5) {
      reasons.push('Within reasonable distance');
    }

    if (breakdown.reputationMatch > 0.7) {
      reasons.push('High-quality provider');
    }

    if (breakdown.recencyMatch > 0.8) {
      reasons.push('Recently updated');
    }

    if (breakdown.semanticMatch > 0.6) {
      reasons.push('Relevant to your profile');
    }

    // If no specific reasons, provide generic one
    if (reasons.length === 0) {
      reasons.push('Potential match based on your profile');
    }

    return reasons;
  }

  /**
   * Extract all tags from profile
   */
  private extractProfileTags(profile: Profile): string[] {
    const tags: string[] = [];

    if (profile.resources?.skills) {
      profile.resources.skills.forEach(skill => {
        tags.push(skill.name.toLowerCase());
        tags.push(...(skill.tags || []).map(t => t.toLowerCase()));
      });
    }

    if (profile.resources?.needs) {
      profile.resources.needs.forEach(need => {
        tags.push(need.name.toLowerCase());
        tags.push(...(need.tags || []).map(t => t.toLowerCase()));
      });
    }

    if (profile.resources?.goods) {
      profile.resources.goods.forEach(good => {
        tags.push(good.name.toLowerCase());
        tags.push(...(good.tags || []).map(t => t.toLowerCase()));
      });
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Build searchable text from profile
   */
  private buildProfileText(profile: Profile): string {
    const parts = [
      profile.name,
      ...(profile.resources?.skills || []).map(s => s.name),
      ...(profile.resources?.needs || []).map(n => n.name),
      ...(profile.resources?.goods || []).map(g => g.name),
    ];

    return parts.join(' ');
  }

  /**
   * Calculate distance between two locations
   */
  private haversineDistance(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;

    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const x = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  /**
   * Sort listings by relevance
   */
  sortListingsByRelevance(profile: Profile, listings: ServiceListing[]): ServiceListing[] {
    const scored = listings.map(listing => ({
      listing,
      score: this.calculateListingRelevance(profile, listing).overall,
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.map(s => s.listing);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

export default RelevanceService;
