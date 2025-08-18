
// mechanisms/utils/index.ts

import { Location } from '../../shared/types';

// Simple Haversine distance (approximate)
export function getDistance(loc1: Location, loc2: Location): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(loc1.latitude * Math.PI / 180) * Math.cos(loc2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Mock text embedding function (in reality, this would be a complex NLP model)
export function mockGenerateEmbedding(text: string): number[] {
    // Very simplistic: character codes sum, normalized (poor, but for demo)
    const sum = text.toLowerCase().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return [sum % 100 / 100, sum % 50 / 50, text.length / 50]; // Example 3D vector
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
