import {
  PromptTemplate,
  PromptVariation,
  OrchestrationResponse,
  PromptPerformance
} from '../index';
import { FeedbackData, EvolutionStrategy } from '../orchestrator';

export interface IPromptEvolutionManager {
  selectEvolutionStrategy(
    prompt: PromptTemplate,
    response: OrchestrationResponse,
    feedback: FeedbackData[]
  ): EvolutionStrategy;
  
  generatePromptVariations(
    originalPrompt: PromptTemplate,
    strategy: EvolutionStrategy,
    feedback: FeedbackData[]
  ): Promise<PromptVariation[]>;
  
  evaluatePromptVariations(
    variations: PromptVariation[],
    originalPrompt: PromptTemplate
  ): Promise<PromptVariation[]>;
  
  selectBestVariation(
    variations: PromptVariation[],
    strategy: EvolutionStrategy
  ): PromptVariation | null;
  
  shouldEvolvePrompt(
    prompt: PromptTemplate,
    response: OrchestrationResponse,
    feedback: FeedbackData[]
  ): boolean;
}

export class PromptEvolutionManager implements IPromptEvolutionManager {
  private evolutionStrategies: Map<string, EvolutionStrategy>;
  private qualityThreshold: number;
  private executePromptCallback?: (
    promptId: string,
    variables: Record<string, any>,
    options?: any
  ) => Promise<OrchestrationResponse>;

  constructor(
    evolutionStrategies: Map<string, EvolutionStrategy>,
    qualityThreshold: number = 0.7,
    executePromptCallback?: (
      promptId: string,
      variables: Record<string, any>,
      options?: any
    ) => Promise<OrchestrationResponse>
  ) {
    this.evolutionStrategies = evolutionStrategies;
    this.qualityThreshold = qualityThreshold;
    this.executePromptCallback = executePromptCallback;
  }

  selectEvolutionStrategy(
    prompt: PromptTemplate,
    response: OrchestrationResponse,
    feedback: FeedbackData[]
  ): EvolutionStrategy {
    // Select strategy based on current performance and feedback
    if (feedback.length > 10) {
      const strategy = this.evolutionStrategies.get('reinforcement');
      if (strategy) return strategy;
    }
    
    if (response.quality.overall < 0.5) {
      const strategy = this.evolutionStrategies.get('genetic');
      if (strategy) return strategy;
    }
    
    // Default to hybrid strategy
    const hybridStrategy = this.evolutionStrategies.get('hybrid');
    if (hybridStrategy) return hybridStrategy;

    // Fallback to genetic if hybrid not available
    const geneticStrategy = this.evolutionStrategies.get('genetic');
    if (geneticStrategy) return geneticStrategy;

    throw new Error('No evolution strategies available');
  }

  async generatePromptVariations(
    originalPrompt: PromptTemplate,
    strategy: EvolutionStrategy,
    feedback: FeedbackData[]
  ): Promise<PromptVariation[]> {
    const variations: PromptVariation[] = [];
    
    switch (strategy.type) {
      case 'genetic':
        variations.push(...await this.generateGeneticVariations(originalPrompt, strategy.parameters));
        break;
      case 'reinforcement':
        variations.push(...await this.generateReinforcementVariations(originalPrompt, feedback));
        break;
      case 'hybrid':
        const genetic = await this.generateGeneticVariations(originalPrompt, strategy.parameters);
        const reinforcement = await this.generateReinforcementVariations(originalPrompt, feedback);
        variations.push(...genetic.slice(0, 3), ...reinforcement.slice(0, 2));
        break;
      default:
        throw new Error(`Unsupported evolution strategy: ${strategy.type}`);
    }
    
    return variations;
  }

  private async generateGeneticVariations(
    originalPrompt: PromptTemplate,
    parameters: Record<string, any>
  ): Promise<PromptVariation[]> {
    const variations: PromptVariation[] = [];
    const populationSize = parameters.populationSize || 5;
    
    if (!this.executePromptCallback) {
      // Generate simple template variations if no callback available
      return this.generateTemplateVariations(originalPrompt, populationSize);
    }

    try {
      for (let i = 0; i < populationSize; i++) {
        const mutationResponse = await this.executePromptCallback(
          'prompt_mutation_meta',
          {
            originalPrompt: originalPrompt.content,
            mutationType: i % 2 === 0 ? 'creative' : 'analytical',
            category: originalPrompt.category,
            preserveCore: true
          },
          {
            strategy: 'fallback',
            useCache: false,
            bypassRateLimit: true
          }
        );
        
        variations.push({
          id: `genetic_var_${Date.now()}_${i}`,
          content: mutationResponse.finalOutput.toString(),
          type: i % 2 === 0 ? 'creative' : 'analytical',
          performance: this.initializePerformance(),
          generatedBy: 'ai',
          parentId: originalPrompt.id,
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to generate genetic variations:', error);
      // Fallback to template variations
      return this.generateTemplateVariations(originalPrompt, populationSize);
    }
    
    return variations;
  }

  private async generateReinforcementVariations(
    originalPrompt: PromptTemplate,
    feedback: FeedbackData[]
  ): Promise<PromptVariation[]> {
    const variations: PromptVariation[] = [];
    
    if (!this.executePromptCallback) {
      return this.generateTemplateVariations(originalPrompt, 3);
    }

    // Analyze feedback to identify improvement areas
    const improvementAreas = this.analyzeFeedbackForImprovements(feedback);
    
    try {
      for (const area of improvementAreas.slice(0, 3)) {
        const improvementResponse = await this.executePromptCallback(
          'prompt_improvement_meta',
          {
            originalPrompt: originalPrompt.content,
            improvementArea: area,
            category: originalPrompt.category,
            feedbackSummary: this.summarizeFeedback(feedback)
          },
          {
            strategy: 'ensemble',
            useCache: false,
            bypassRateLimit: true
          }
        );
        
        variations.push({
          id: `rl_var_${Date.now()}_${area}`,
          content: improvementResponse.finalOutput.toString(),
          type: 'focused',
          performance: this.initializePerformance(),
          generatedBy: 'ai',
          parentId: originalPrompt.id,
          createdAt: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to generate reinforcement variations:', error);
      return this.generateTemplateVariations(originalPrompt, 3);
    }
    
    return variations;
  }

  private generateTemplateVariations(
    originalPrompt: PromptTemplate,
    count: number
  ): PromptVariation[] {
    const variations: PromptVariation[] = [];
    const modificationTemplates = [
      'Make this more specific and detailed: ',
      'Simplify and clarify: ',
      'Add creative elements to: ',
      'Make this more analytical: ',
      'Improve the structure of: '
    ];

    for (let i = 0; i < Math.min(count, modificationTemplates.length); i++) {
      variations.push({
        id: `template_var_${Date.now()}_${i}`,
        content: modificationTemplates[i] + originalPrompt.content,
        type: i % 2 === 0 ? 'creative' : 'analytical',
        performance: this.initializePerformance(),
        generatedBy: 'template',
        parentId: originalPrompt.id,
        createdAt: new Date()
      });
    }

    return variations;
  }

  async evaluatePromptVariations(
    variations: PromptVariation[],
    originalPrompt: PromptTemplate
  ): Promise<PromptVariation[]> {
    const evaluatedVariations: PromptVariation[] = [];
    
    if (!this.executePromptCallback) {
      // Return variations with basic scoring if no callback available
      return variations.map(variation => ({
        ...variation,
        performance: {
          ...variation.performance,
          averageQuality: 0.6 + Math.random() * 0.3, // Mock evaluation
          averageExecutionTime: 3000 + Math.random() * 2000,
          costEfficiency: 0.7 + Math.random() * 0.2,
          lastEvaluated: new Date()
        }
      }));
    }

    for (const variation of variations) {
      try {
        // Create temporary prompt for testing
        const testPrompt: PromptTemplate = {
          ...originalPrompt,
          id: `test_${variation.id}`,
          content: variation.content
        };
        
        // Test with sample variables
        const testResponse = await this.executePromptCallback(
          testPrompt.id,
          this.generateSampleVariables(originalPrompt),
          {
            strategy: 'fallback',
            useCache: false,
            bypassRateLimit: true,
            feedbackEnabled: false,
            evolutionEnabled: false
          }
        );
        
        // Update variation performance
        variation.performance = {
          ...variation.performance,
          averageQuality: testResponse.quality.overall,
          averageExecutionTime: testResponse.totalLatency,
          costEfficiency: 1 - testResponse.totalCost / 0.1,
          lastEvaluated: new Date()
        };
        
        evaluatedVariations.push(variation);
        
      } catch (error) {
        console.warn(`Failed to evaluate variation ${variation.id}:`, error);
        // Add variation with default performance if evaluation fails
        evaluatedVariations.push({
          ...variation,
          performance: {
            ...variation.performance,
            averageQuality: 0.4, // Lower score for failed evaluation
            lastEvaluated: new Date()
          }
        });
      }
    }
    
    return evaluatedVariations;
  }

  selectBestVariation(
    variations: PromptVariation[],
    strategy: EvolutionStrategy
  ): PromptVariation | null {
    if (variations.length === 0) return null;
    
    // Calculate fitness for each variation
    const scoredVariations = variations.map(variation => ({
      variation,
      fitness: strategy.fitnessFunction({
        quality: { overall: variation.performance.averageQuality },
        totalCost: 1 - variation.performance.costEfficiency,
        totalLatency: variation.performance.averageExecutionTime,
        finalOutput: '',
        responses: [],
        requestId: '',
        createdAt: new Date(),
        variables: {}
      } as OrchestrationResponse)
    }));
    
    // Sort by fitness and return best
    scoredVariations.sort((a, b) => b.fitness - a.fitness);
    
    const best = scoredVariations[0];
    return best.fitness > 0.1 ? best.variation : null; // Only return if significantly better
  }

  shouldEvolvePrompt(
    prompt: PromptTemplate,
    response: OrchestrationResponse,
    feedback: FeedbackData[]
  ): boolean {
    // Trigger evolution if quality is below threshold
    if (response.quality.overall < this.qualityThreshold) {
      return true;
    }
    
    // Trigger evolution if cost is too high
    if (response.totalCost > 0.05) {
      return true;
    }
    
    // Trigger evolution based on feedback patterns
    if (feedback.length > 0) {
      const avgFeedback = feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length;
      return avgFeedback < 7; // Below 7/10 average
    }
    
    return false;
  }

  private analyzeFeedbackForImprovements(feedback: FeedbackData[]): string[] {
    const improvements: string[] = [];
    const categoryScores = new Map<string, number[]>();
    
    // Group feedback by category
    for (const f of feedback) {
      const scores = categoryScores.get(f.category) || [];
      scores.push(f.score);
      categoryScores.set(f.category, scores);
    }
    
    // Identify low-scoring categories
    for (const [category, scores] of categoryScores.entries()) {
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      if (avgScore < 7) {
        improvements.push(category);
      }
    }
    
    return improvements;
  }

  private summarizeFeedback(feedback: FeedbackData[]): string {
    if (feedback.length === 0) return 'No feedback available';
    
    const avgScore = feedback.reduce((sum, f) => sum + f.score, 0) / feedback.length;
    const commonIssues = feedback
      .map(f => f.feedback)
      .filter(f => f.length > 10)
      .slice(0, 3)
      .join('; ');
    
    return `Average score: ${avgScore.toFixed(1)}/10. Common feedback: ${commonIssues}`;
  }

  private generateSampleVariables(prompt: PromptTemplate): Record<string, any> {
    const sampleVars: Record<string, any> = {};
    
    for (const variable of prompt.variables) {
      switch (variable.type) {
        case 'string':
          sampleVars[variable.name] = variable.defaultValue || 'sample text';
          break;
        case 'number':
          sampleVars[variable.name] = variable.defaultValue || 42;
          break;
        case 'boolean':
          sampleVars[variable.name] = variable.defaultValue || true;
          break;
        case 'array':
          sampleVars[variable.name] = variable.defaultValue || ['item1', 'item2'];
          break;
        case 'object':
          sampleVars[variable.name] = variable.defaultValue || { key: 'value' };
          break;
      }
    }
    
    return sampleVars;
  }

  private initializePerformance(): PromptPerformance {
    return {
      successRate: 0.8,
      averageQuality: 0.75,
      averageRelevance: 0.8,
      averageCreativity: 0.7,
      averageExecutionTime: 3000,
      costEfficiency: 0.8,
      userSatisfaction: 0.75,
      errorRate: 0.1,
      lastEvaluated: new Date()
    };
  }
}

export function createPromptEvolutionManager(
  evolutionStrategies: Map<string, EvolutionStrategy>,
  qualityThreshold: number = 0.7,
  executePromptCallback?: (
    promptId: string,
    variables: Record<string, any>,
    options?: any
  ) => Promise<OrchestrationResponse>
): IPromptEvolutionManager {
  return new PromptEvolutionManager(evolutionStrategies, qualityThreshold, executePromptCallback);
}

export default PromptEvolutionManager;
