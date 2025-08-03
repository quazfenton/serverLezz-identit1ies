import { OrchestrationResponse, OrchestrationStrategy } from '../index';

export interface IntelligentCacheEntry {
  key: string;
  value: OrchestrationResponse;
  accessCount: number;
  lastAccessed: Date;
  predictedNextAccess?: Date;
  contextSimilarity: number;
  qualityScore: number;
  ttl: number;
}

export class IntelligentCacheManager {
  private intelligentCache: Map<string, IntelligentCacheEntry> = new Map();
  private qualityThreshold: number;
  private maxCacheSize: number;

  constructor(qualityThreshold: number, maxCacheSize: number = 1000) {
    this.qualityThreshold = qualityThreshold;
    this.maxCacheSize = maxCacheSize;
  }

  public generateAdvancedCacheKey(
    promptId: string,
    variables: Record<string, any>,
    strategy: OrchestrationStrategy,
    providers?: string[],
    taskClass?: string
  ): string {
    const keyData = {
      promptId,
      variables: this.normalizeVariables(variables),
      strategy,
      providers: providers?.sort().join(',') || 'auto',
      taskClass: taskClass || 'general'
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private normalizeVariables(variables: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string') {
        if (key.toLowerCase().includes('name') || key.toLowerCase().includes('title')) {
          normalized[key] = value.trim().toLowerCase();
        } else {
          normalized[key] = value.trim();
        }
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  public async checkIntelligentCache(cacheKey: string, variables: Record<string, any>): Promise<OrchestrationResponse | null> {
    const entry = this.intelligentCache.get(cacheKey);
    
    if (entry) {
      const now = Date.now();
      if (now - entry.lastAccessed.getTime() > entry.ttl) {
        this.intelligentCache.delete(cacheKey);
        return null;
      }
      
      const similarity = this.calculateContextSimilarity(variables, entry.value.variables || {});
      if (similarity > 0.8) {
        return entry.value;
      }
    }
    
    return this.findSimilarCacheEntry(variables);
  }

  private calculateContextSimilarity(vars1: Record<string, any>, vars2: Record<string, any>): number {
    const keys1 = Object.keys(vars1);
    const keys2 = Object.keys(vars2);
    
    const intersection = keys1.filter(key => keys2.includes(key));
    const union = [...new Set([...keys1, ...keys2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  private findSimilarCacheEntry(variables: Record<string, any>): OrchestrationResponse | null {
    let bestMatch: OrchestrationResponse | null = null;
    let bestSimilarity = 0;
    
    for (const entry of this.intelligentCache.values()) {
      const similarity = this.calculateContextSimilarity(variables, entry.value.variables || {});
      if (similarity > bestSimilarity && similarity > 0.7) {
        bestSimilarity = similarity;
        bestMatch = entry.value;
      }
    }
    
    return bestMatch;
  }

  public async storeInIntelligentCache(
    cacheKey: string,
    response: OrchestrationResponse,
    variables: Record<string, any>
  ): Promise<void> {
    if (response.quality.overall < this.qualityThreshold) {
      return; // Only cache high-quality responses
    }

    const entry: IntelligentCacheEntry = {
      key: cacheKey,
      value: { ...response, variables },
      accessCount: 1,
      lastAccessed: new Date(),
      contextSimilarity: 1.0,
      qualityScore: response.quality.overall,
      ttl: this.calculateDynamicTTL(response)
    };
    
    this.intelligentCache.set(cacheKey, entry);
    
    if (this.intelligentCache.size > this.maxCacheSize) {
      await this.cleanupIntelligentCache();
    }
  }

  private calculateDynamicTTL(response: OrchestrationResponse): number {
    const baseTTL = 300000; // 5 minutes
    const qualityMultiplier = response.quality.overall;
    const costMultiplier = Math.max(0.5, 1 - (response.totalCost || 0) / 0.1); // Expensive responses cached longer
    
    return baseTTL * qualityMultiplier * costMultiplier;
  }

  public async updateCacheAccessPattern(cacheKey: string): Promise<void> {
    const entry = this.intelligentCache.get(cacheKey);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = new Date();
      
      if (entry.accessCount > 2) {
        const avgInterval = (Date.now() - entry.value.createdAt.getTime()) / entry.accessCount;
        entry.predictedNextAccess = new Date(Date.now() + avgInterval);
      }
    }
  }

  public async cleanupIntelligentCache(): Promise<void> {
    const entries = Array.from(this.intelligentCache.entries());
    
    entries.sort((a, b) => {
      const scoreA = a[1].accessCount * a[1].qualityScore;
      const scoreB = b[1].accessCount * b[1].qualityScore;
      return scoreA - scoreB;
    });
    
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.intelligentCache.delete(entries[i][0]);
    }
  }

  public getIntelligentCacheSize(): number {
    return this.intelligentCache.size;
  }

  public getIntelligentCacheEntries(): IntelligentCacheEntry[] {
    return Array.from(this.intelligentCache.values());
  }

  public clearIntelligentCache(): void {
    this.intelligentCache.clear();
  }
}
