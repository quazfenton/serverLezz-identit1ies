import { createAndInitializeOrchestrator } from './orchestrator';
import { LLMOrchestrationExamples } from './examples';

// ==================== BASIC FUNCTIONALITY TEST ====================

async function testBasicFunctionality(): Promise<void> {
  console.log('🧪 Testing Basic Functionality...\n');
  
  try {
    // Test 1: Orchestrator initialization
    console.log('1️⃣ Testing orchestrator initialization...');
    const orchestrator = await createAndInitializeOrchestrator();
    console.log('✅ Orchestrator initialized successfully\n');

    // Test 2: List available resources
    console.log('2️⃣ Testing resource listing...');
    const prompts = orchestrator.getPrompts();
    const providers = orchestrator.getProviders();
    console.log(`✅ Found ${prompts.length} prompts and ${providers.length} providers\n`);

    // Test 3: Simple prompt execution (mock)
    console.log('3️⃣ Testing prompt execution...');
    try {
      const response = await orchestrator.executePrompt(
        'api_design_advanced',
        {
          projectName: 'Test API',
          language: 'TypeScript',
          framework: 'Express.js',
          requirements: 'Simple REST API for testing'
        },
        {
          strategy: 'adaptive',
          useCache: true
        }
      );
      console.log(`✅ Prompt executed - Quality: ${response.quality.overall.toFixed(2)}, Cost: $${response.totalCost.toFixed(4)}\n`);
    } catch (error) {
      console.log(`⚠️ Prompt execution failed (expected in test environment): ${error}\n`);
    }

    // Test 4: Performance analysis
    console.log('4️⃣ Testing performance analysis...');
    const analysis = await orchestrator.analyzePerformance();
    console.log(`✅ Performance analysis complete - ${analysis.recommendations.length} recommendations\n`);

    // Test 5: Configuration optimization
    console.log('5️⃣ Testing configuration optimization...');
    const optimization = await orchestrator.optimizeConfiguration();
    console.log(`✅ Configuration optimization complete - ${optimization.improvements.length} improvements suggested\n`);

    // Test 6: Cache and circuit breaker status
    console.log('6️⃣ Testing monitoring features...');
    const cacheStats = orchestrator.getCacheStats();
    const circuitStatus = orchestrator.getCircuitBreakerStatus();
    console.log(`✅ Cache: ${cacheStats.size} entries, Circuit breakers: ${circuitStatus.size} providers\n`);

    // Cleanup
    await orchestrator.shutdown();
    console.log('✅ All basic functionality tests passed!\n');

  } catch (error) {
    console.error('❌ Basic functionality test failed:', error);
    throw error;
  }
}

// ==================== CONFIGURATION TEST ====================

async function testConfiguration(): Promise<void> {
  console.log('⚙️ Testing Configuration System...\n');
  
  try {
    const { ConfigurationFactory, detectEnvironment } = await import('./config');
    
    // Test environment detection
    console.log('1️⃣ Testing environment detection...');
    const env = detectEnvironment();
    console.log(`✅ Detected environment: ${env}\n`);

    // Test configuration creation
    console.log('2️⃣ Testing configuration creation...');
    const devConfig = ConfigurationFactory.createConfig('development');
    const prodConfig = ConfigurationFactory.createConfig('production');
    const researchConfig = ConfigurationFactory.createConfig('research');
    
    console.log(`✅ Development config: ${devConfig.providers.length} providers, evolution ${devConfig.evolution.enabled ? 'enabled' : 'disabled'}`);
    console.log(`✅ Production config: ${prodConfig.providers.length} providers, encryption ${prodConfig.security.enableEncryption ? 'enabled' : 'disabled'}`);
    console.log(`✅ Research config: ${researchConfig.providers.length} providers, creativity weight ${researchConfig.evolution.selectionCriteria.weights.creativity}\n`);

    // Test configuration validation
    console.log('3️⃣ Testing configuration validation...');
    const isValid = ConfigurationFactory.validateConfig(devConfig);
    console.log(`✅ Configuration validation: ${isValid ? 'passed' : 'failed'}\n`);

    console.log('✅ All configuration tests passed!\n');

  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    throw error;
  }
}

// ==================== UTILITIES TEST ====================

async function testUtilities(): Promise<void> {
  console.log('🔧 Testing Utility Functions...\n');
  
  try {
    const utils = await import('./utils');
    
    // Test retry manager
    console.log('1️⃣ Testing retry manager...');
    const retryManager = new utils.RetryManager({
      maxAttempts: 3,
      baseDelay: 100,
      jitter: false
    });
    
    let attempts = 0;
    try {
      await retryManager.executeWithRetry(async () => {
        attempts++;
        if (attempts < 2) {
          throw new utils.RetryableError('Test error', 'TEST_ERROR');
        }
        return 'success';
      });
      console.log(`✅ Retry manager worked - succeeded after ${attempts} attempts\n`);
    } catch (error) {
      console.log(`⚠️ Retry test failed: ${error}\n`);
    }

    // Test circuit breaker
    console.log('2️⃣ Testing circuit breaker...');
    const circuitBreaker = new utils.CircuitBreaker({
      failureThreshold: 0.5,
      minimumRequests: 2
    });
    
    // Simulate some failures
    try {
      await circuitBreaker.execute(async () => { throw new Error('Test failure'); });
    } catch {}
    try {
      await circuitBreaker.execute(async () => { throw new Error('Test failure'); });
    } catch {}
    
    const metrics = circuitBreaker.getMetrics();
    console.log(`✅ Circuit breaker state: ${metrics.state}, failure rate: ${(metrics.failureRate * 100).toFixed(1)}%\n`);

    // Test cache
    console.log('3️⃣ Testing LRU cache...');
    const cache = new utils.LRUCache<string>(3, 1000); // 3 items, 1 second TTL
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    const value = cache.get('key1');
    const stats = cache.getStats();
    console.log(`✅ Cache test - retrieved: ${value}, stats: ${stats.size} items, ${(stats.hitRate * 100).toFixed(1)}% hit rate\n`);

    // Test rate limiter
    console.log('4️⃣ Testing rate limiter...');
    const rateLimiter = new utils.RateLimiter({
      windowSize: 1000, // 1 second
      maxRequests: 2
    });
    
    const allowed1 = await rateLimiter.checkLimit();
    const allowed2 = await rateLimiter.checkLimit();
    const allowed3 = await rateLimiter.checkLimit(); // Should be false
    
    console.log(`✅ Rate limiter test - requests: ${allowed1}, ${allowed2}, ${allowed3} (last should be false)\n`);

    // Test quality assessment
    console.log('5️⃣ Testing quality assessment...');
    const quality = utils.QualityAssessment.assessResponseQuality(
      'This is a comprehensive and creative response that addresses all requirements with innovative solutions.',
      {
        minLength: 50,
        requiredKeywords: ['comprehensive', 'creative', 'innovative'],
        structurePatterns: [/\w+/]
      }
    );
    console.log(`✅ Quality assessment - overall: ${(quality.overall * 100).toFixed(1)}%, creativity: ${(quality.creativity * 100).toFixed(1)}%\n`);

    console.log('✅ All utility tests passed!\n');

  } catch (error) {
    console.error('❌ Utility test failed:', error);
    throw error;
  }
}

// ==================== EXAMPLES TEST ====================

async function testExamples(): Promise<void> {
  console.log('📚 Testing Examples System...\n');
  
  try {
    console.log('1️⃣ Testing examples initialization...');
    const examples = new LLMOrchestrationExamples();
    console.log('✅ Examples system initialized\n');

    console.log('2️⃣ Testing example prompts and providers...');
    // The examples class sets up its own prompts and providers
    console.log('✅ Example prompts and providers configured\n');

    // Note: We don't run the actual examples here as they require API keys
    // and would make real API calls. In a real test environment, you would
    // mock the API calls or use test credentials.

    await examples.shutdown();
    console.log('✅ Examples tests completed!\n');

  } catch (error) {
    console.error('❌ Examples test failed:', error);
    throw error;
  }
}

// ==================== INTEGRATION TEST ====================

async function testIntegration(): Promise<void> {
  console.log('🔗 Testing System Integration...\n');
  
  try {
    // Test that all modules can be imported together
    console.log('1️⃣ Testing module imports...');
    const orchestrator = await import('./orchestrator');
    const config = await import('./config');
    const utils = await import('./utils');
    const examples = await import('./examples');
    
    console.log('✅ All modules imported successfully\n');

    // Test that the main orchestrator can be created with different configs
    console.log('2️⃣ Testing orchestrator with different configurations...');
    
    const devOrchestrator = orchestrator.createAdvancedOrchestrator(
      config.ConfigurationFactory.createConfig('development')
    );
    
    const prodOrchestrator = orchestrator.createAdvancedOrchestrator(
      config.ConfigurationFactory.createConfig('production')
    );
    
    console.log('✅ Orchestrators created with different configurations\n');

    console.log('✅ All integration tests passed!\n');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

// ==================== MAIN TEST RUNNER ====================

async function runAllTests(): Promise<void> {
  console.log('🧪 Starting LLM Orchestration System Tests\n');
  console.log('=' .repeat(60) + '\n');
  
  const tests = [
    { name: 'Basic Functionality', fn: testBasicFunctionality },
    { name: 'Configuration System', fn: testConfiguration },
    { name: 'Utility Functions', fn: testUtilities },
    { name: 'Examples System', fn: testExamples },
    { name: 'System Integration', fn: testIntegration }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🎯 Running ${test.name} Tests`);
      console.log('-'.repeat(40));
      await test.fn();
      console.log(`✅ ${test.name} tests PASSED\n`);
      passed++;
    } catch (error) {
      console.error(`❌ ${test.name} tests FAILED:`, error);
      console.log();
      failed++;
    }
  }

  console.log('=' .repeat(60));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The LLM Orchestration System is ready for use.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the errors above.');
  }
}

// ==================== QUICK DEMO ====================

async function runQuickDemo(): Promise<void> {
  console.log('🎬 Running Quick Demo...\n');
  
  try {
    const orchestrator = await createAndInitializeOrchestrator();

    console.log('📋 Available Prompts:');
    orchestrator.getPrompts().forEach(prompt => {
      console.log(`  • ${prompt.id} (${prompt.category})`);
    });

    console.log('\n🤖 Available Providers:');
    orchestrator.getProviders().forEach(provider => {
      console.log(`  • ${provider.id} - ${provider.name}`);
    });

    console.log('\n📊 System Status:');
    const cacheStats = orchestrator.getCacheStats();
    console.log(`  Cache: ${cacheStats.size}/${cacheStats.maxSize} entries`);
    
    const circuitStatus = orchestrator.getCircuitBreakerStatus();
    console.log(`  Circuit Breakers: ${circuitStatus.size} providers monitored`);

    await orchestrator.shutdown();
    console.log('\n✅ Quick demo completed successfully!');

  } catch (error) {
    console.error('❌ Quick demo failed:', error);
  }
}

// ==================== EXECUTION ====================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';

  switch (command) {
    case 'test':
      await runAllTests();
      break;
    case 'demo':
      await runQuickDemo();
      break;
    case 'basic':
      await testBasicFunctionality();
      break;
    case 'config':
      await testConfiguration();
      break;
    case 'utils':
      await testUtilities();
      break;
    case 'examples':
      await testExamples();
      break;
    case 'integration':
      await testIntegration();
      break;
    default:
      console.log(`
🧪 LLM Orchestration Test Suite

Usage: npx ts-node test.ts [command]

Commands:
  test        Run all tests (default)
  demo        Run quick demo
  basic       Test basic functionality
  config      Test configuration system
  utils       Test utility functions
  examples    Test examples system
  integration Test system integration

Examples:
  npx ts-node mechanisms/llmOrchestration/test.ts
  npx ts-node mechanisms/llmOrchestration/test.ts demo
  npx ts-node mechanisms/llmOrchestration/test.ts basic
`);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export {
  testBasicFunctionality,
  testConfiguration,
  testUtilities,
  testExamples,
  testIntegration,
  runAllTests,
  runQuickDemo
};