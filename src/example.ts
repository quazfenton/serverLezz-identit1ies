import createDefaultOrchestrator, { createOrchestrator, PipelineConfig } from './orchestrator';
import { PromptRegistry } from './modules/PromptRegistry';
import { LLMClient } from './modules/LLMClient';
import { ToolRouter } from './modules/ToolRouter';
import { MemoryManager } from './modules/MemoryManager';

// Example: Basic usage with default configuration
export async function basicExample() {
  console.log('🚀 Basic Orchestrator Example');
  
  const orchestrator = createDefaultOrchestrator();

  // Simple pipeline execution
  const config: PipelineConfig = {
    promptId: 'general_assistant',
    variables: { request: 'Explain the benefits of dependency injection in software architecture' },
    sessionId: 'user_123_session',
    userId: 'user_123',
    strategy: 'adaptive'
  };

  const result = await orchestrator.runPipeline(config);
  
  console.log('✅ Pipeline Result:', {
    id: result.id,
    finalOutput: result.finalOutput.substring(0, 200) + '...',
    strategy: result.metadata.strategy,
    cost: result.metadata.totalCost,
    quality: result.metadata.quality.overall
  });

  return result;
}

// Example: Custom dependency injection
export async function dependencyInjectionExample() {
  console.log('🔧 Dependency Injection Example');

  // Create custom modules
  const customPromptRegistry = PromptRegistry.create([
    {
      id: "custom_code_review",
      name: "Code Review Assistant",
      content: `Review the following {{language}} code for best practices, potential bugs, and improvements:\n\n{{code}}\n\nProvide detailed feedback with suggestions.`,
      category: "code_generation",
      variables: [
        { name: "language", type: "string", required: true, description: "Programming language" },
        { name: "code", type: "string", required: true, description: "Code to review" }
      ],
      metadata: {
        tags: ["code", "review", "analysis"],
        difficulty: 0.7,
        expectedTokens: 800,
        estimatedCost: 0.024,
        language: "en",
        domain: ["software_development"],
        author: "custom",
        version: "1.0"
      },
      variations: [],
      performance: {
        successRate: 0.85,
        averageQuality: 0.9,
        averageRelevance: 0.95,
        averageCreativity: 0.6,
        averageExecutionTime: 3500,
        costEfficiency: 0.8,
        userSatisfation: 0.9,
        errorRate: 0.1,
        lastEvaluated: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    }
  ]);

  // Create orchestrator with custom dependencies
  const orchestrator = createOrchestrator({
    prompts: customPromptRegistry.listPrompts(),
    defaultStrategy: 'ensemble'
  });

  const config: PipelineConfig = {
    promptId: 'custom_code_review',
    variables: {
      language: 'TypeScript',
      code: `
        function processUser(user) {
          if (user.age > 18) {
            return user.name.toUpperCase();
          }
        }
      `
    },
    sessionId: 'code_review_session',
    strategy: 'ensemble'
  };

  const result = await orchestrator.runPipeline(config);
  
  console.log('✅ Custom Pipeline Result:', {
    providersUsed: result.metadata.providersUsed,
    quality: result.metadata.quality,
    cost: result.metadata.totalCost
  });

  return result;
}

// Example: Batch processing
export async function batchProcessingExample() {
  console.log('📦 Batch Processing Example');

  const orchestrator = createDefaultOrchestrator();

  const configs: PipelineConfig[] = [
    {
      promptText: 'What are the key principles of microservices architecture?',
      sessionId: 'batch_session_1',
      strategy: 'parallel'
    },
    {
      promptText: 'Explain the difference between SQL and NoSQL databases',
      sessionId: 'batch_session_2', 
      strategy: 'fallback'
    },
    {
      promptText: 'What are the benefits of containerization with Docker?',
      sessionId: 'batch_session_3',
      strategy: 'competitive'
    }
  ];

  const results = await orchestrator.runBatchPipeline(configs);
  
  console.log('✅ Batch Results:', results.map(r => ({
    id: r.id,
    strategy: r.metadata.strategy,
    cost: r.metadata.totalCost,
    quality: r.metadata.quality.overall
  })));

  return results;
}

// Example: Stream processing
export async function streamProcessingExample() {
  console.log('🌊 Stream Processing Example');

  const orchestrator = createDefaultOrchestrator();

  // Create a stream of configurations
  async function* createConfigStream(): AsyncGenerator<PipelineConfig> {
    const topics = [
      'Explain REST API design principles',
      'What is the role of load balancers in web architecture?',
      'Describe the benefits of event-driven architecture',
      'How does caching improve application performance?'
    ];

    for (let i = 0; i < topics.length; i++) {
      yield {
        promptText: topics[i],
        sessionId: `stream_session_${i}`,
        strategy: i % 2 === 0 ? 'adaptive' : 'sequential'
      };
      
      // Simulate real-time delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const results = [];
  for await (const result of orchestrator.runStreamPipeline(createConfigStream())) {
    console.log(`📨 Stream Result ${result.id}:`, {
      strategy: result.metadata.strategy,
      latency: result.metadata.totalLatency + 'ms',
      quality: result.metadata.quality.overall.toFixed(3)
    });
    results.push(result);
  }

  return results;
}

// Example: Memory and context management
export async function memoryManagementExample() {
  console.log('🧠 Memory Management Example');

  const orchestrator = createDefaultOrchestrator();
  const sessionId = 'conversation_session_123';

  // First interaction
  await orchestrator.runPipeline({
    promptText: 'Hello, I am working on a web application project.',
    sessionId,
    userId: 'developer_user'
  });

  // Follow-up interaction with context
  await orchestrator.runPipeline({
    promptText: 'What database would you recommend for my project?',
    sessionId,
    strategy: 'adaptive'
  });

  // Another follow-up
  const result = await orchestrator.runPipeline({
    promptText: 'How would I implement authentication in this setup?',
    sessionId,
    strategy: 'ensemble'
  });

  // Get memory statistics
  const stats = orchestrator.getStats();
  console.log('✅ Memory Stats:', {
    promptCount: stats.promptCount,
    providerCount: stats.providerCount,
    sessionCount: await stats.sessionCount,
    memoryStats: await stats.memoryStats
  });

  return result;
}

// Example: Advanced configuration and monitoring
export async function advancedConfigurationExample() {
  console.log('⚙️ Advanced Configuration Example');

  // Create orchestrator with custom providers
  const orchestrator = createOrchestrator({
    defaultStrategy: 'competitive',
    providers: [
      {
        id: "custom-gpt4",
        name: "Custom GPT-4",
        endpoint: "https://api.openai.com/v1/chat/completions",
        apiKey: process.env.OPENAI_API_KEY || "",
        model: "gpt-4",
        maxTokens: 2048,
        temperature: 0.8, // Higher creativity
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
        rateLimits: {
          requestsPerMinute: 30,
          tokensPerMinute: 20000,
          requestsPerDay: 500,
          currentUsage: { requests: 0, tokens: 0, resetTime: new Date() }
        },
        costPerToken: 0.00003,
        capabilities: [
          { type: "creativity", strength: 0.95, specializations: ["creative_writing", "brainstorming"] },
          { type: "reasoning", strength: 0.90, specializations: ["analysis", "problem_solving"] }
        ],
        reliability: 0.95,
        averageLatency: 1800,
        isActive: true
      }
    ]
  });

  // Complex configuration with all options
  const config: PipelineConfig = {
    promptText: 'Design an innovative solution for sustainable urban transportation',
    variables: { 
      context: 'Smart city initiative',
      constraints: 'Budget conscious, environmentally friendly'
    },
    sessionId: 'innovation_session',
    userId: 'city_planner',
    strategy: 'competitive',
    providers: ['custom-gpt4'],
    priority: 3, // High priority
    timeout: 45000 // 45 seconds
  };

  const result = await orchestrator.runPipeline(config);

  console.log('✅ Advanced Result:', {
    strategy: result.metadata.strategy,
    providersUsed: result.metadata.providersUsed,
    totalCost: result.metadata.totalCost,
    totalLatency: result.metadata.totalLatency,
    qualityMetrics: result.metadata.quality
  });

  // Cleanup
  await orchestrator.cleanup();

  return result;
}

// Run all examples
export async function runAllExamples() {
  try {
    console.log('🎯 Running Orchestrator Examples\n');

    await basicExample();
    console.log('\n---\n');
    
    await dependencyInjectionExample();
    console.log('\n---\n');
    
    await batchProcessingExample();
    console.log('\n---\n');
    
    await streamProcessingExample();
    console.log('\n---\n');
    
    await memoryManagementExample();
    console.log('\n---\n');
    
    await advancedConfigurationExample();
    
    console.log('\n🎉 All examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export for use in other modules
export default {
  basicExample,
  dependencyInjectionExample, 
  batchProcessingExample,
  streamProcessingExample,
  memoryManagementExample,
  advancedConfigurationExample,
  runAllExamples
};
