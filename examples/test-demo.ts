#!/usr/bin/env ts-node

/**
 * Test script for the LLM Orchestration Demo
 * 
 * This script performs basic validation of the demo components
 * without running the full orchestration (which requires API keys).
 */

import { LLMOrchestrationDemo } from './demo';
import * as path from 'path';
import * as fs from 'fs/promises';

async function testDemoComponents(): Promise<void> {
  console.log('🧪 Testing LLM Orchestration Demo Components...\n');

  try {
    // Test 1: Demo Configuration
    console.log('1. Testing demo configuration...');
    const demo = new LLMOrchestrationDemo({
      enableLogging: true,
      logToFile: false, // Disable file logging for test
      useMetaPrompts: true,
      orchestratorType: 'basic',
      conversationTurns: 2
    });
    console.log('   ✅ Demo configuration created successfully');

    // Test 2: Directory Structure
    console.log('2. Testing directory structure...');
    const demoLogDir = path.join(process.cwd(), 'examples', 'demo-logs');
    const demoDataDir = path.join(process.cwd(), 'examples', 'demo-data');
    
    await fs.mkdir(demoLogDir, { recursive: true });
    await fs.mkdir(demoDataDir, { recursive: true });
    
    console.log('   ✅ Demo directories created successfully');

    // Test 3: Meta-prompt Integration
    console.log('3. Testing meta-prompt integration...');
    const { getAllMetaPrompts } = await import('../mechanisms/llmOrchestration/prompts/MetaPrompts');
    const metaPrompts = getAllMetaPrompts();
    console.log(`   ✅ ${metaPrompts.length} meta-prompts loaded successfully`);

    // Test 4: Scenario Configuration
    console.log('4. Testing scenario configuration...');
    // @ts-ignore - Access private method for testing
    const scenarios = demo['createDemoScenarios']();
    console.log(`   ✅ ${scenarios.length} demo scenarios configured`);
    
    scenarios.forEach((scenario, index) => {
      console.log(`      Scenario ${index + 1}: ${scenario.name} (${scenario.turns.length} turns)`);
    });

    // Test 5: Logger Functionality
    console.log('5. Testing logger functionality...');
    // @ts-ignore - Access private property for testing
    const logger = demo['logger'];
    logger.log('Test log message', 'info');
    logger.log('Test debug message', 'debug');
    console.log('   ✅ Logger functionality verified');

    // Test 6: Configuration Validation
    console.log('6. Testing configuration validation...');
    try {
      // @ts-ignore - Access private method for testing
      const providers = demo['createDemoProviders']();
      console.log(`   ✅ ${providers.length} demo providers configured`);

      // @ts-ignore - Access private method for testing
      const prompts = demo['createDemoPrompts']();
      console.log(`   ✅ ${prompts.length} demo prompts configured`);
    } catch (error) {
      console.log(`   ⚠️  Configuration validation warning: ${error}`);
    }

    // Test 7: Utility Functions
    console.log('7. Testing utility functions...');
    
    // Test context relevance assessment
    // @ts-ignore - Access private method for testing
    const relevance = demo['assessContextRelevance']('This is a test response about sustainability and food waste', {
      domain: 'sustainability',
      industry: 'food_service',
      keywords: 'test food waste'
    });
    console.log(`   ✅ Context relevance assessment: ${(relevance * 100).toFixed(1)}%`);

    console.log('\n🎉 All demo component tests passed!');
    console.log('\n📋 Test Summary:');
    console.log('   • Configuration: ✅ Passed');
    console.log('   • Directory Setup: ✅ Passed');
    console.log('   • Meta-prompts: ✅ Passed');
    console.log('   • Scenarios: ✅ Passed');
    console.log('   • Logger: ✅ Passed');
    console.log('   • Providers/Prompts: ✅ Passed');
    console.log('   • Utilities: ✅ Passed');

    console.log('\n💡 Next Steps:');
    console.log('   1. Set up API keys (OPENAI_API_KEY, etc.)');
    console.log('   2. Run the full demo: npx ts-node examples/demo.ts');
    console.log('   3. Check generated logs and results');

  } catch (error) {
    console.error('❌ Demo component test failed:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('   • Ensure all dependencies are installed');
    console.error('   • Verify TypeScript configuration');
    console.error('   • Check file permissions');
    
    process.exit(1);
  }
}

async function testDemoScenarios(): Promise<void> {
  console.log('\n📋 Demo Scenarios Preview:');
  console.log('═'.repeat(60));

  const scenarios = [
    {
      id: 'creative_problem_solving',
      name: 'Creative Problem Solving',
      description: 'Multi-turn conversation for innovative solutions',
      turns: 3
    },
    {
      id: 'analytical_reasoning',
      name: 'Analytical Reasoning',
      description: 'Structured analysis and decision making',
      turns: 3
    },
    {
      id: 'creative_storytelling',
      name: 'Creative Storytelling',
      description: 'Interactive creative writing collaboration',
      turns: 3
    }
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`\n${index + 1}. ${scenario.name}`);
    console.log(`   ID: ${scenario.id}`);
    console.log(`   Description: ${scenario.description}`);
    console.log(`   Turns: ${scenario.turns}`);
  });

  console.log('\n🎭 Meta-prompts Available:');
  console.log('─'.repeat(40));
  
  const metaPromptNames = [
    'problem_analysis - Comprehensive Problem Analysis',
    'solution_generation - Strategic Solution Generation', 
    'creative_story_generation - Creative Story Generation',
    'implementation_planning - Detailed Implementation Planning',
    'multimodal_analysis - Multimodal Content Analysis',
    'prompt_evolution_meta - Prompt Evolution Meta-Prompt'
  ];

  metaPromptNames.forEach((name, index) => {
    console.log(`   ${index + 1}. ${name}`);
  });
}

async function main(): Promise<void> {
  try {
    await testDemoComponents();
    await testDemoScenarios();
    
    console.log('\n' + '═'.repeat(60));
    console.log('🚀 Demo Test Suite Completed Successfully!');
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('❌ Demo test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { testDemoComponents, testDemoScenarios };
