import { 
  LLMOrchestrationEngine, 
  createLLMOrchestrationEngine,
  PromptTemplate,
  LLMProvider,
  OrchestrationRequest 
} from './index';

// ==================== EXAMPLE USAGE SCENARIOS ====================

export class LLMOrchestrationExamples {
  private engine: LLMOrchestrationEngine;

  constructor() {
    this.engine = createLLMOrchestrationEngine({
      evolutionConfig: {
        enabled: true,
        interval: 3, // Evolve every 3 iterations for demo
        maxVariations: 3
      },
      storageConfig: {
        basePath: "/home/admin/000code/serverLezz identit1ies/data/llm_orchestration_demo"
      }
    });
    
    this.setupExamplePrompts();
    this.setupExampleProviders();
  }

  // ==================== EXAMPLE 1: CODE GENERATION SEQUENCE ====================

  public async runCodeGenerationExample(): Promise<void> {
    console.log("🚀 Running Code Generation Example...");
    
    const codePrompts = [
      "api_design_prompt",
      "implementation_prompt", 
      "testing_prompt",
      "documentation_prompt"
    ];

    const variables = {
      projectName: "Advanced LLM Orchestrator",
      language: "TypeScript",
      framework: "Node.js",
      requirements: "Create a REST API for managing LLM orchestration workflows",
      features: ["authentication", "rate limiting", "caching", "monitoring"]
    };

    try {
      const results = await this.engine.executePromptSequence(
        codePrompts,
        variables,
        "adaptive"
      );

      console.log(`✅ Generated ${results.length} code artifacts`);
      results.forEach((result, index) => {
        console.log(`📄 Artifact ${index + 1}: Quality ${result.quality.overall.toFixed(2)}, Cost $${result.totalCost.toFixed(4)}`);
      });

    } catch (error) {
      console.error("❌ Code generation failed:", error);
    }
  }

  // ==================== EXAMPLE 2: CREATIVE WRITING WITH EVOLUTION ====================

  public async runCreativeWritingExample(): Promise<void> {
    console.log("✨ Running Creative Writing Example with Evolution...");
    
    const writingPrompts = [
      "story_concept_prompt",
      "character_development_prompt",
      "plot_structure_prompt",
      "dialogue_writing_prompt"
    ];

    const variables = {
      genre: "science fiction",
      theme: "AI consciousness and human connection",
      setting: "near-future Earth with advanced AI systems",
      tone: "thought-provoking yet accessible",
      length: "short story (3000-5000 words)"
    };

    try {
      // Run multiple iterations to trigger evolution
      for (let iteration = 1; iteration <= 5; iteration++) {
        console.log(`📝 Iteration ${iteration}...`);
        
        const results = await this.engine.executePromptSequence(
          writingPrompts,
          { ...variables, iteration },
          "ensemble"
        );

        const avgQuality = results.reduce((sum, r) => sum + r.quality.overall, 0) / results.length;
        console.log(`📊 Iteration ${iteration} - Average Quality: ${avgQuality.toFixed(2)}`);
        
        // Simulate some delay between iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error("❌ Creative writing failed:", error);
    }
  }

  // ==================== EXAMPLE 3: RESEARCH AND ANALYSIS PIPELINE ====================

  public async runResearchAnalysisExample(): Promise<void> {
    console.log("🔬 Running Research Analysis Example...");
    
    const researchPrompts = [
      "research_question_prompt",
      "literature_review_prompt",
      "methodology_prompt",
      "analysis_prompt",
      "conclusion_prompt"
    ];

    const variables = {
      topic: "Impact of Large Language Models on Software Development Productivity",
      scope: "2020-2024 academic and industry research",
      methodology: "systematic literature review with quantitative analysis",
      focus: ["productivity metrics", "code quality", "developer satisfaction", "learning curves"]
    };

    try {
      const results = await this.engine.executePromptSequence(
        researchPrompts,
        variables,
        "sequential" // Each step builds on the previous
      );

      console.log("📋 Research Analysis Complete:");
      results.forEach((result, index) => {
        const stepNames = ["Question Formation", "Literature Review", "Methodology", "Analysis", "Conclusions"];
        console.log(`${stepNames[index]}: ${result.quality.overall.toFixed(2)} quality`);
      });

    } catch (error) {
      console.error("❌ Research analysis failed:", error);
    }
  }

  // ==================== EXAMPLE 4: COMPETITIVE PROBLEM SOLVING ====================

  public async runCompetitiveProblemSolvingExample(): Promise<void> {
    console.log("🏆 Running Competitive Problem Solving Example...");
    
    const problemSolvingPrompts = [
      "problem_analysis_prompt",
      "solution_brainstorming_prompt", 
      "implementation_strategy_prompt",
      "optimization_prompt"
    ];

    const variables = {
      problem: "Design a distributed system for real-time collaborative document editing",
      constraints: ["sub-100ms latency", "99.9% availability", "support for 10M+ concurrent users"],
      technologies: ["WebRTC", "CRDT", "Redis", "Kubernetes"],
      budget: "$50K/month infrastructure cost"
    };

    try {
      const results = await this.engine.executePromptSequence(
        problemSolvingPrompts,
        variables,
        "competitive" // Get multiple solutions and pick the best
      );

      console.log("🎯 Problem Solving Results:");
      results.forEach((result, index) => {
        console.log(`Solution ${index + 1}:`);
        console.log(`  Innovation: ${result.metadata.innovationScore.toFixed(2)}`);
        console.log(`  Practicality: ${result.metadata.practicalityScore.toFixed(2)}`);
        console.log(`  Best Provider: ${result.metadata.bestProvider}`);
      });

    } catch (error) {
      console.error("❌ Problem solving failed:", error);
    }
  }

  // ==================== EXAMPLE 5: MULTI-DOMAIN KNOWLEDGE SYNTHESIS ====================

  public async runKnowledgeSynthesisExample(): Promise<void> {
    console.log("🧠 Running Knowledge Synthesis Example...");
    
    const synthesisPrompts = [
      "domain_analysis_prompt",
      "cross_domain_connections_prompt",
      "synthesis_prompt",
      "innovation_prompt"
    ];

    const variables = {
      domains: ["quantum computing", "machine learning", "blockchain", "biotechnology"],
      challenge: "sustainable energy storage solutions",
      perspective: "interdisciplinary innovation opportunities",
      timeframe: "next 10 years"
    };

    try {
      const results = await this.engine.executePromptSequence(
        synthesisPrompts,
        variables,
        "ensemble" // Combine insights from multiple models
      );

      console.log("🔗 Knowledge Synthesis Complete:");
      const finalResult = results[results.length - 1];
      console.log(`Consensus Level: ${finalResult.metadata.consensusLevel.toFixed(2)}`);
      console.log(`Diversity Score: ${finalResult.metadata.diversityScore.toFixed(2)}`);
      console.log(`Total Cost: $${finalResult.totalCost.toFixed(4)}`);

    } catch (error) {
      console.error("❌ Knowledge synthesis failed:", error);
    }
  }

  // ==================== EXAMPLE 6: REAL-TIME ADAPTIVE WORKFLOW ====================

  public async runAdaptiveWorkflowExample(): Promise<void> {
    console.log("⚡ Running Adaptive Workflow Example...");
    
    // Simulate a dynamic workflow that adapts based on intermediate results
    const basePrompts = ["analysis_prompt", "strategy_prompt", "execution_prompt"];
    let currentPrompts = [...basePrompts];
    
    const variables = {
      scenario: "startup product launch strategy",
      market: "B2B SaaS for remote teams",
      budget: "$100K marketing budget",
      timeline: "6 months to market leadership"
    };

    try {
      for (let round = 1; round <= 3; round++) {
        console.log(`🔄 Adaptive Round ${round}...`);
        
        const results = await this.engine.executePromptSequence(
          currentPrompts,
          { ...variables, round, previousResults: round > 1 ? "previous insights" : null },
          "adaptive"
        );

        // Simulate adaptation based on results
        const avgQuality = results.reduce((sum, r) => sum + r.quality.overall, 0) / results.length;
        
        if (avgQuality < 0.7) {
          console.log("📈 Quality below threshold, adding refinement prompt...");
          currentPrompts.push("refinement_prompt");
        }
        
        if (avgQuality > 0.9) {
          console.log("🎯 High quality achieved, adding innovation prompt...");
          currentPrompts.push("innovation_prompt");
        }

        console.log(`Round ${round} Quality: ${avgQuality.toFixed(2)}`);
      }

    } catch (error) {
      console.error("❌ Adaptive workflow failed:", error);
    }
  }

  // ==================== SETUP METHODS ====================

  private setupExamplePrompts(): void {
    const examplePrompts: PromptTemplate[] = [
      {
        id: "api_design_prompt",
        name: "API Design Prompt",
        content: `Design a comprehensive REST API for {{projectName}} using {{language}} and {{framework}}.

Requirements: {{requirements}}
Features: {{features}}

Provide:
1. API endpoint structure
2. Request/response schemas
3. Authentication strategy
4. Rate limiting approach
5. Error handling patterns

Focus on scalability, security, and developer experience.`,
        category: "code_generation",
        variables: [
          { name: "projectName", type: "string" as const, required: true, description: "Name of the project" },
          { name: "language", type: "string" as const, required: true, description: "Programming language" },
          { name: "framework", type: "string" as const, required: true, description: "Framework to use" },
          { name: "requirements", type: "string" as const, required: true, description: "Functional requirements" },
          { name: "features", type: "array" as const, required: false, description: "List of features" }
        ],
        metadata: {
          tags: ["api", "design", "backend"],
          difficulty: 0.7,
          expectedTokens: 1000,
          estimatedCost: 0.03,
          language: "en",
          domain: ["software_architecture", "api_design"],
          author: "system",
          version: "1.0"
        },
        variations: [],
        performance: {
          successRate: 0.85,
          averageQuality: 0.8,
          averageRelevance: 0.85,
          averageCreativity: 0.7,
          averageExecutionTime: 3000,
          costEfficiency: 0.8,
          userSatisfaction: 0.8,
          errorRate: 0.05,
          lastEvaluated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      },
      {
        id: "story_concept_prompt",
        name: "Story Concept Development",
        content: `Create an innovative story concept for a {{genre}} story with the following parameters:

Theme: {{theme}}
Setting: {{setting}}
Tone: {{tone}}
Target Length: {{length}}

Develop:
1. Core premise and hook
2. Central conflict
3. Unique elements that set it apart
4. Thematic depth
5. Reader engagement strategy

Think outside conventional boundaries while maintaining narrative coherence.`,
        category: "creative_writing",
        variables: [
          { name: "genre", type: "string" as const, required: true, description: "Story genre" },
          { name: "theme", type: "string" as const, required: true, description: "Central theme" },
          { name: "setting", type: "string" as const, required: true, description: "Story setting" },
          { name: "tone", type: "string" as const, required: true, description: "Narrative tone" },
          { name: "length", type: "string" as const, required: true, description: "Target length" }
        ],
        metadata: {
          tags: ["creative", "storytelling", "concept"],
          difficulty: 0.6,
          expectedTokens: 800,
          estimatedCost: 0.024,
          language: "en",
          domain: ["creative_writing", "narrative_design"],
          author: "system",
          version: "1.0"
        },
        variations: [],
        performance: {
          successRate: 0.9,
          averageQuality: 0.85,
          averageRelevance: 0.8,
          averageCreativity: 0.95,
          averageExecutionTime: 2500,
          costEfficiency: 0.85,
          userSatisfaction: 0.9,
          errorRate: 0.02,
          lastEvaluated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      },
      {
        id: "research_question_prompt",
        name: "Research Question Formation",
        content: `Formulate comprehensive research questions for investigating: {{topic}}

Scope: {{scope}}
Methodology: {{methodology}}
Focus Areas: {{focus}}

Develop:
1. Primary research question
2. 3-5 secondary questions
3. Hypotheses to test
4. Success metrics
5. Potential limitations

Ensure questions are specific, measurable, and academically rigorous.`,
        category: "research",
        variables: [
          { name: "topic", type: "string" as const, required: true, description: "Research topic" },
          { name: "scope", type: "string" as const, required: true, description: "Research scope" },
          { name: "methodology", type: "string" as const, required: true, description: "Research methodology" },
          { name: "focus", type: "array" as const, required: true, description: "Focus areas" }
        ],
        metadata: {
          tags: ["research", "academic", "methodology"],
          difficulty: 0.8,
          expectedTokens: 900,
          estimatedCost: 0.027,
          language: "en",
          domain: ["research_methodology", "academic_writing"],
          author: "system",
          version: "1.0"
        },
        variations: [],
        performance: {
          successRate: 0.8,
          averageQuality: 0.85,
          averageRelevance: 0.9,
          averageCreativity: 0.7,
          averageExecutionTime: 3500,
          costEfficiency: 0.75,
          userSatisfaction: 0.85,
          errorRate: 0.08,
          lastEvaluated: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      }
    ];

    examplePrompts.forEach(prompt => {
      this.engine.addPrompt(prompt);
    });
  }

  private setupExampleProviders(): void {
    // Additional providers for demonstration
    const exampleProviders: LLMProvider[] = [
      {
        id: "google-gemini",
        name: "Google Gemini Pro",
        endpoint: "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
        apiKey: process.env.GOOGLE_API_KEY || "",
        model: "gemini-pro",
        maxTokens: 8192,
        temperature: 0.7,
        topP: 0.8,
        frequencyPenalty: 0,
        presencePenalty: 0,
        rateLimits: {
          requestsPerMinute: 60,
          tokensPerMinute: 32000,
          requestsPerDay: 1500,
          currentUsage: { requests: 0, tokens: 0, resetTime: new Date() }
        },
        costPerToken: 0.000125,
        capabilities: [
          { type: "reasoning", strength: 0.88, specializations: ["multimodal", "analysis"] },
          { type: "creativity", strength: 0.85, specializations: ["content", "ideation"] },
          { type: "code_generation", strength: 0.82, specializations: ["multiple_languages"] }
        ],
        reliability: 0.90,
        averageLatency: 2200,
        isActive: true
      }
    ];

    exampleProviders.forEach(provider => {
      this.engine.addProvider(provider);
    });
  }

  // ==================== DEMO RUNNER ====================

  public async runAllExamples(): Promise<void> {
    console.log("🎬 Starting LLM Orchestration Demo...\n");
    
    const examples = [
      { name: "Code Generation", fn: () => this.runCodeGenerationExample() },
      { name: "Creative Writing with Evolution", fn: () => this.runCreativeWritingExample() },
      { name: "Research Analysis", fn: () => this.runResearchAnalysisExample() },
      { name: "Competitive Problem Solving", fn: () => this.runCompetitiveProblemSolvingExample() },
      { name: "Knowledge Synthesis", fn: () => this.runKnowledgeSynthesisExample() },
      { name: "Adaptive Workflow", fn: () => this.runAdaptiveWorkflowExample() }
    ];

    for (const example of examples) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🎯 ${example.name}`);
      console.log(`${"=".repeat(60)}`);
      
      try {
        await example.fn();
        console.log(`✅ ${example.name} completed successfully`);
      } catch (error) {
        console.error(`❌ ${example.name} failed:`, error);
      }
      
      // Pause between examples
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("\n🎉 Demo completed!");
    
    // Show final analytics
    this.showAnalytics();
  }

  private showAnalytics(): void {
    console.log("\n📊 Performance Analytics:");
    console.log("========================");
    
    const prompts = this.engine.listPrompts();
    const providers = this.engine.listProviders();
    
    console.log(`Total Prompts: ${prompts.length}`);
    console.log(`Total Providers: ${providers.length}`);
    
    const avgQuality = prompts.reduce((sum, p) => sum + p.performance.averageQuality, 0) / prompts.length;
    console.log(`Average Prompt Quality: ${avgQuality.toFixed(2)}`);
    
    const avgReliability = providers.reduce((sum, p) => sum + p.reliability, 0) / providers.length;
    console.log(`Average Provider Reliability: ${avgReliability.toFixed(2)}`);
  }

  public async shutdown(): Promise<void> {
    await this.engine.shutdown();
  }
}

// ==================== STANDALONE DEMO FUNCTION ====================

export async function runLLMOrchestrationDemo(): Promise<void> {
  const demo = new LLMOrchestrationExamples();
  
  try {
    await demo.runAllExamples();
  } finally {
    await demo.shutdown();
  }
}

// Export for use in other modules
export default LLMOrchestrationExamples;