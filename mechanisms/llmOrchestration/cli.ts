#!/usr/bin/env node

import { AdvancedLLMOrchestrator, createAndInitializeOrchestrator, runAdvancedDemo } from './orchestrator';
import { LLMOrchestrationExamples } from './examples';
import { ConfigurationFactory, detectEnvironment } from './config';

// ==================== CLI INTERFACE ====================

interface CLIOptions {
  command: string;
  promptId?: string;
  variables?: Record<string, any>;
  strategy?: string;
  providers?: string[];
  output?: string;
  verbose?: boolean;
  config?: string;
}

class LLMOrchestrationCLI {
  private orchestrator?: AdvancedLLMOrchestrator;

  public async run(args: string[]): Promise<void> {
    const options = this.parseArgs(args);
    
    try {
      switch (options.command) {
        case 'demo':
          await this.runDemo();
          break;
        case 'examples':
          await this.runExamples();
          break;
        case 'execute':
          await this.executePrompt(options);
          break;
        case 'sequence':
          await this.executeSequence(options);
          break;
        case 'evolve':
          await this.evolvePrompt(options);
          break;
        case 'analyze':
          await this.analyzePerformance();
          break;
        case 'optimize':
          await this.optimizeConfiguration();
          break;
        case 'list':
          await this.listResources(options);
          break;
        case 'help':
          this.showHelp();
          break;
        default:
          console.error(`❌ Unknown command: ${options.command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ CLI Error:', error);
      process.exit(1);
    } finally {
      if (this.orchestrator) {
        await this.orchestrator.shutdown();
      }
    }
  }

  private parseArgs(args: string[]): CLIOptions {
    const options: CLIOptions = {
      command: args[0] || 'help'
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const [key, value] = arg.substring(2).split('=');
        
        switch (key) {
          case 'prompt':
            options.promptId = value;
            break;
          case 'variables':
            try {
              options.variables = JSON.parse(value);
            } catch {
              console.error('❌ Invalid JSON for variables');
              process.exit(1);
            }
            break;
          case 'strategy':
            options.strategy = value;
            break;
          case 'providers':
            options.providers = value.split(',');
            break;
          case 'output':
            options.output = value;
            break;
          case 'verbose':
            options.verbose = true;
            break;
          case 'config':
            options.config = value;
            break;
        }
      }
    }

    return options;
  }

  private async initializeOrchestrator(): Promise<void> {
    if (this.orchestrator) return;
    
    console.log('🚀 Initializing LLM Orchestrator...');
    this.orchestrator = await createAndInitializeOrchestrator();
    console.log('✅ Orchestrator ready\n');
  }

  private async runDemo(): Promise<void> {
    console.log('🎬 Running Advanced LLM Orchestration Demo...\n');
    await runAdvancedDemo();
  }

  private async runExamples(): Promise<void> {
    console.log('📚 Running LLM Orchestration Examples...\n');
    const examples = new LLMOrchestrationExamples();
    await examples.runAllExamples();
    await examples.shutdown();
  }

  private async executePrompt(options: CLIOptions): Promise<void> {
    if (!options.promptId) {
      console.error('❌ Prompt ID is required for execute command');
      process.exit(1);
    }

    await this.initializeOrchestrator();
    
    console.log(`📝 Executing prompt: ${options.promptId}`);
    
    const response = await this.orchestrator!.executePrompt(
      options.promptId,
      options.variables || {},
      {
        strategy: options.strategy as any,
        providers: options.providers
      }
    );

    this.displayResponse(response, options.verbose);
    
    if (options.output) {
      await this.saveResponse(response, options.output);
    }
  }

  private async executeSequence(options: CLIOptions): Promise<void> {
    if (!options.promptId) {
      console.error('❌ Comma-separated prompt IDs are required for sequence command');
      process.exit(1);
    }

    await this.initializeOrchestrator();
    
    const promptIds = options.promptId.split(',');
    console.log(`🔄 Executing prompt sequence: ${promptIds.join(' → ')}`);
    
    const responses = await this.orchestrator!.executePromptSequence(
      promptIds,
      options.variables || {},
      {
        strategy: options.strategy as any,
        providers: options.providers
      }
    );

    responses.forEach((response, index) => {
      console.log(`\n📄 Response ${index + 1}/${responses.length}:`);
      this.displayResponse(response, options.verbose);
    });
    
    if (options.output) {
      await this.saveSequenceResponses(responses, options.output);
    }
  }

  private async evolvePrompt(options: CLIOptions): Promise<void> {
    if (!options.promptId) {
      console.error('❌ Prompt ID is required for evolve command');
      process.exit(1);
    }

    await this.initializeOrchestrator();
    
    console.log(`🧬 Evolving prompt: ${options.promptId}`);
    
    const newPromptId = await this.orchestrator!.evolvePrompt(options.promptId);
    
    console.log(`✨ Created evolved prompt: ${newPromptId}`);
    
    // Show comparison
    const originalPrompt = this.orchestrator!.getPrompts().find(p => p.id === options.promptId);
    const evolvedPrompt = this.orchestrator!.getPrompts().find(p => p.id === newPromptId);
    
    if (originalPrompt && evolvedPrompt) {
      console.log('\n📊 Comparison:');
      console.log(`Original: ${originalPrompt.content.substring(0, 100)}...`);
      console.log(`Evolved:  ${evolvedPrompt.content.substring(0, 100)}...`);
    }
  }

  private async analyzePerformance(): Promise<void> {
    await this.initializeOrchestrator();
    
    console.log('📊 Analyzing Performance...\n');
    
    const analysis = await this.orchestrator!.analyzePerformance();
    
    console.log('🌐 Global Metrics:');
    console.log(`  Requests: ${analysis.global.requestCount}`);
    console.log(`  Success Rate: ${(analysis.global.successCount / analysis.global.requestCount * 100).toFixed(1)}%`);
    console.log(`  Average Quality: ${(analysis.global.averageQuality * 100).toFixed(1)}%`);
    console.log(`  Total Cost: $${analysis.global.totalCost.toFixed(4)}`);
    
    console.log('\n🏆 Provider Rankings:');
    analysis.providers.forEach((provider, index) => {
      console.log(`  ${index + 1}. ${provider.id} (${provider.metrics.requestCount} requests)`);
    });
    
    console.log('\n💡 Recommendations:');
    analysis.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }

  private async optimizeConfiguration(): Promise<void> {
    await this.initializeOrchestrator();
    
    console.log('⚡ Optimizing Configuration...\n');
    
    const optimization = await this.orchestrator!.optimizeConfiguration();
    
    console.log('🔧 Optimization Results:');
    optimization.improvements.forEach(improvement => {
      console.log(`  • ${improvement}`);
    });
    
    if (optimization.improvements.length === 0) {
      console.log('  ✅ Configuration is already optimal!');
    }
  }

  private async listResources(options: CLIOptions): Promise<void> {
    await this.initializeOrchestrator();
    
    const resource = options.promptId || 'all';
    
    switch (resource) {
      case 'prompts':
        this.listPrompts();
        break;
      case 'providers':
        this.listProviders();
        break;
      case 'cache':
        this.listCacheStats();
        break;
      case 'circuits':
        this.listCircuitBreakers();
        break;
      default:
        this.listPrompts();
        this.listProviders();
        this.listCacheStats();
        break;
    }
  }

  private listPrompts(): void {
    const prompts = this.orchestrator!.getPrompts();
    
    console.log('📝 Available Prompts:');
    prompts.forEach(prompt => {
      console.log(`  • ${prompt.id} (${prompt.category})`);
      console.log(`    Quality: ${(prompt.performance.averageQuality * 100).toFixed(1)}%`);
      console.log(`    Variables: ${prompt.variables.map(v => v.name).join(', ')}`);
    });
    console.log();
  }

  private listProviders(): void {
    const providers = this.orchestrator!.getProviders();
    
    console.log('🤖 Available Providers:');
    providers.forEach(provider => {
      console.log(`  • ${provider.id} (${provider.name})`);
      console.log(`    Model: ${provider.model}`);
      console.log(`    Reliability: ${(provider.reliability * 100).toFixed(1)}%`);
      console.log(`    Cost: $${provider.costPerToken.toFixed(6)}/token`);
    });
    console.log();
  }

  private listCacheStats(): void {
    const stats = this.orchestrator!.getCacheStats();
    
    console.log('💾 Cache Statistics:');
    console.log(`  Size: ${stats.size}/${stats.maxSize}`);
    console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`  Total Hits: ${stats.totalHits}`);
    console.log();
  }

  private listCircuitBreakers(): void {
    const circuits = this.orchestrator!.getCircuitBreakerStatus();
    
    console.log('⚡ Circuit Breaker Status:');
    for (const [providerId, status] of circuits.entries()) {
      console.log(`  • ${providerId}: ${status.state}`);
      console.log(`    Failure Rate: ${(status.failureRate * 100).toFixed(1)}%`);
      console.log(`    Requests: ${status.requestCount}`);
    }
    console.log();
  }

  private displayResponse(response: any, verbose: boolean = false): void {
    console.log(`✅ Response Quality: ${(response.quality.overall * 100).toFixed(1)}%`);
    console.log(`💰 Cost: $${response.totalCost.toFixed(4)}`);
    console.log(`⏱️  Time: ${response.totalTime}ms`);
    console.log(`🎯 Strategy: ${response.strategy}`);
    
    if (verbose) {
      console.log('\n📄 Full Response:');
      console.log(response.finalOutput);
      
      console.log('\n🔍 Provider Details:');
      response.responses.forEach((r: any, i: number) => {
        console.log(`  ${i + 1}. ${r.providerId}: ${(r.quality.overall * 100).toFixed(1)}% quality, ${r.latency}ms`);
      });
    } else {
      const preview = response.finalOutput.toString().substring(0, 200);
      console.log(`📄 Preview: ${preview}${preview.length >= 200 ? '...' : ''}`);
    }
  }

  private async saveResponse(response: any, outputPath: string): Promise<void> {
    const fs = await import('fs/promises');
    
    const output = {
      timestamp: new Date().toISOString(),
      response: response.finalOutput,
      metadata: {
        quality: response.quality,
        cost: response.totalCost,
        time: response.totalTime,
        strategy: response.strategy,
        providers: response.responses.map((r: any) => ({
          id: r.providerId,
          quality: r.quality.overall,
          latency: r.latency,
          cost: r.cost
        }))
      }
    };
    
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
    console.log(`💾 Response saved to: ${outputPath}`);
  }

  private async saveSequenceResponses(responses: any[], outputPath: string): Promise<void> {
    const fs = await import('fs/promises');
    
    const output = {
      timestamp: new Date().toISOString(),
      sequence: responses.map((response, index) => ({
        step: index + 1,
        response: response.finalOutput,
        metadata: {
          quality: response.quality,
          cost: response.totalCost,
          time: response.totalTime
        }
      })),
      summary: {
        totalSteps: responses.length,
        totalCost: responses.reduce((sum, r) => sum + r.totalCost, 0),
        totalTime: responses.reduce((sum, r) => sum + r.totalTime, 0),
        averageQuality: responses.reduce((sum, r) => sum + r.quality.overall, 0) / responses.length
      }
    };
    
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
    console.log(`💾 Sequence responses saved to: ${outputPath}`);
  }

  private showHelp(): void {
    console.log(`
🤖 LLM Orchestration CLI

USAGE:
  llm-orchestrator <command> [options]

COMMANDS:
  demo                    Run the full demonstration
  examples               Run all example scenarios
  execute                Execute a single prompt
  sequence               Execute a sequence of prompts
  evolve                 Evolve a prompt to improve it
  analyze                Analyze performance metrics
  optimize               Get configuration optimization suggestions
  list [resource]        List resources (prompts, providers, cache, circuits)
  help                   Show this help message

OPTIONS:
  --prompt=<id>          Prompt ID to execute
  --variables=<json>     Variables as JSON object
  --strategy=<strategy>  Orchestration strategy (sequential, parallel, ensemble, etc.)
  --providers=<list>     Comma-separated provider IDs
  --output=<file>        Save response to file
  --verbose              Show detailed output
  --config=<file>        Use custom configuration file

EXAMPLES:
  # Run demo
  llm-orchestrator demo

  # Execute a prompt
  llm-orchestrator execute --prompt=api_design_advanced --variables='{"projectName":"MyAPI","language":"TypeScript"}'

  # Execute prompt sequence
  llm-orchestrator sequence --prompt=prompt1,prompt2,prompt3 --strategy=sequential

  # Evolve a prompt
  llm-orchestrator evolve --prompt=api_design_advanced

  # Analyze performance
  llm-orchestrator analyze

  # List all prompts
  llm-orchestrator list prompts

ENVIRONMENT VARIABLES:
  NODE_ENV               Environment (development, production, research)
  LLM_RESEARCH_MODE      Enable research mode (true/false)
  OPENAI_API_KEY         OpenAI API key
  ANTHROPIC_API_KEY      Anthropic API key
  GOOGLE_API_KEY         Google API key

For more information, visit: https://github.com/your-repo/llm-orchestration
`);
  }
}

// ==================== MAIN EXECUTION ====================

async function main(): Promise<void> {
  const cli = new LLMOrchestrationCLI();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    args.push('help');
  }
  
  await cli.run(args);
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { LLMOrchestrationCLI };
export default main;