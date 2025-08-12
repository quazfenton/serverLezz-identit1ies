import createDefaultOrchestrator, { createOrchestrator, PipelineConfig } from './orchestrator';

async function runBasicTest() {
  console.log('🧪 Running Basic Orchestrator Test');
  
  try {
    // Test 1: Default orchestrator creation
    const orchestrator = createDefaultOrchestrator();
    console.log('✅ Default orchestrator created successfully');

    // Test 2: Get stats to verify initialization
    const stats = orchestrator.getStats();
    console.log('📊 Initial Stats:', {
      promptCount: stats.promptCount,
      providerCount: stats.providerCount
    });

    // Test 3: Simple pipeline execution
    const config: PipelineConfig = {
      promptText: 'Hello, this is a test message for the refactored orchestrator.',
      sessionId: 'test_session_001',
      userId: 'test_user',
      strategy: 'sequential'
    };

    const result = await orchestrator.runPipeline(config);
    
    console.log('✅ Pipeline executed successfully');
    console.log('📋 Result Summary:', {
      id: result.id,
      finalOutputLength: result.finalOutput.length,
      strategy: result.metadata.strategy,
      providersUsed: result.metadata.providersUsed,
      totalCost: result.metadata.totalCost,
      totalLatency: result.metadata.totalLatency,
      qualityOverall: result.metadata.quality.overall
    });

    // Test 4: Memory verification
    const memoryStats = await stats.memoryStats;
    console.log('🧠 Memory Stats:', memoryStats);

    // Test 5: Cleanup
    await orchestrator.cleanup();
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All tests passed! The refactored orchestrator is working correctly.');
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runBasicTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export default runBasicTest;
