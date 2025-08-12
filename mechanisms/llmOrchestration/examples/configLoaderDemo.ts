import { ConfigLoader, createConfigLoader } from '../ConfigLoader';
import { LLMOrchestrationEngine } from '../index';
import * as path from 'path';

// ==================== CONFIGURATION LOADING EXAMPLES ====================

async function demonstrateConfigLoader() {
  console.log('🚀 ConfigLoader Demo - Meta-Prompts Integration\n');

  // Create ConfigLoader instance
  const configLoader = createConfigLoader(
    path.join(process.cwd(), 'config'),
    path.join(process.cwd(), 'config/metaPrompts.yaml')
  );

  try {
    // ==================== Example 1: Basic Configuration Loading ====================
    console.log('📋 Example 1: Basic Configuration Loading');
    console.log('=' .repeat(50));

    const basicConfig = await configLoader.loadConfig({
      environment: 'development',
      userType: 'developer',
      context: 'code generation for API endpoints'
    });

    console.log('Environment:', basicConfig.context.environment);
    console.log('User Type:', basicConfig.context.userType);
    console.log('Total Meta-Prompts Loaded:', basicConfig.metaPrompts.length);
    console.log('Active Meta-Prompts:', basicConfig.activeMetaPrompts.length);
    console.log('Active Meta-Prompts:');
    basicConfig.activeMetaPrompts.forEach((prompt, index) => {
      console.log(`  ${index + 1}. ${prompt.name} (Priority: ${prompt.priority})`);
    });
    console.log();

    // ==================== Example 2: CLI and Environment Variable Integration ====================
    console.log('📋 Example 2: CLI and Environment Variable Integration');
    console.log('=' .repeat(50));

    const cliArgs = {
      environment: 'production',
      userType: 'system_admin',
      context: 'debugging performance issues',
      evolutionEnabled: false,
      logLevel: 'warn'
    };

    const envVars = {
      NODE_ENV: 'production',
      LLM_EVOLUTION_ENABLED: 'false',
      LLM_LOG_LEVEL: 'info',
      LLM_STORAGE_PATH: '/var/lib/llm_data'
    };

    const mergedConfig = await configLoader.loadMergedConfig(
      undefined, // No base config override
      cliArgs,
      envVars
    );

    console.log('Merged Configuration Summary:');
    const summary = configLoader.getConfigSummary(mergedConfig);
    console.log('  Environment:', summary.environment);
    console.log('  User Type:', summary.userType);
    console.log('  Active Meta-Prompts:', summary.activeMetaPrompts.join(', '));
    console.log('  Orchestration Features:', summary.orchestrationFeatures.join(', '));
    console.log('  Evolution Enabled:', mergedConfig.orchestration.evolution.enabled);
    console.log('  Log Level:', mergedConfig.orchestration.monitoring.logLevel);
    console.log('  Storage Path:', mergedConfig.orchestration.storage.basePath);
    console.log();

    // ==================== Example 3: Context-Specific Meta-Prompt Selection ====================
    console.log('📋 Example 3: Context-Specific Meta-Prompt Selection');
    console.log('=' .repeat(50));

    const contexts = [
      'generate code for user authentication',
      'debug database connection error',  
      'design scalable architecture for microservices',
      'help end user with login issues',
      'analyze business requirements for new feature'
    ];

    for (const context of contexts) {
      const contextPrompts = await configLoader.getMetaPromptsForContext(context);
      console.log(`Context: "${context}"`);
      console.log(`  Applicable Meta-Prompts (${contextPrompts.length}):`);
      contextPrompts.forEach(prompt => {
        console.log(`    - ${prompt.name} (${prompt.tags.join(', ')})`);
      });
      console.log();
    }

    // ==================== Example 4: Meta-Prompt Combination Strategies ====================
    console.log('📋 Example 4: Meta-Prompt Combination Strategies');
    console.log('=' .repeat(50));

    const developmentPrompts = await configLoader.getMetaPromptsForContext(
      'implement REST API with error handling',
      'developer'
    );

    console.log('Selected Prompts for Development Context:');
    developmentPrompts.forEach(prompt => {
      console.log(`  - ${prompt.name} (Priority: ${prompt.priority})`);
    });
    console.log();

    // Hierarchical merge strategy
    const hierarchicalPrompt = configLoader.combineMetaPrompts(
      developmentPrompts,
      'hierarchical_merge'
    );
    console.log('Hierarchical Merge Strategy (first 300 chars):');
    console.log(hierarchicalPrompt.substring(0, 300) + '...\n');

    // Concatenation strategy
    const concatenatedPrompt = configLoader.combineMetaPrompts(
      developmentPrompts,
      'concatenate'
    );
    console.log('Concatenation Strategy (first 300 chars):');
    console.log(concatenatedPrompt.substring(0, 300) + '...\n');

    // Priority-only strategy
    const priorityOnlyPrompt = configLoader.combineMetaPrompts(
      developmentPrompts,
      'priority_only'
    );
    console.log('Priority-Only Strategy (first 300 chars):');
    console.log(priorityOnlyPrompt.substring(0, 300) + '...\n');

    // ==================== Example 5: Configuration Validation ====================
    console.log('📋 Example 5: Configuration Validation');
    console.log('=' .repeat(50));

    const validation = await configLoader.validateConfig(mergedConfig);
    console.log('Configuration Validation:');
    console.log('  Is Valid:', validation.isValid);
    if (validation.errors.length > 0) {
      console.log('  Errors:');
      validation.errors.forEach(error => console.log(`    - ${error}`));
    }
    if (validation.warnings.length > 0) {
      console.log('  Warnings:');
      validation.warnings.forEach(warning => console.log(`    - ${warning}`));
    }
    console.log();

    // ==================== Example 6: Integration with LLM Orchestration Engine ====================
    console.log('📋 Example 6: Integration with LLM Orchestration Engine');
    console.log('=' .repeat(50));

    // Create LLM Orchestration Engine with loaded config
    const engine = new LLMOrchestrationEngine({
      evolutionConfig: mergedConfig.orchestration.evolution,
      storageConfig: mergedConfig.orchestration.storage
    });

    // Example: Use meta-prompts to enhance prompt execution
    const enhancedPromptContent = configLoader.combineMetaPrompts(
      basicConfig.activeMetaPrompts,
      'hierarchical_merge'
    );

    console.log('Enhanced Prompt System Ready!');
    console.log('  Base Prompts Available:', engine.listPrompts().length);
    console.log('  Meta-Prompt Enhancement Active: ✅');
    console.log('  Combined Meta-Prompt Length:', enhancedPromptContent.length, 'characters');
    
    // Example of how meta-prompts would be used in practice
    console.log('\nExample Integration Pattern:');
    console.log('```typescript');
    console.log('// Before executing any prompt, prepend meta-prompt instructions');
    console.log('const metaInstructions = configLoader.combineMetaPrompts(activeMetaPrompts);');
    console.log('const enhancedPrompt = metaInstructions + "\\n\\n" + userPrompt;');
    console.log('const response = await engine.executePromptSequence([enhancedPrompt], variables);');
    console.log('```');

    console.log('\n✅ ConfigLoader Demo Complete!');
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('  ✓ Meta-prompt configuration loading from YAML');
    console.log('  ✓ Environment-specific configuration merging');
    console.log('  ✓ CLI argument and environment variable integration');
    console.log('  ✓ Context-aware meta-prompt selection');
    console.log('  ✓ Multiple combination strategies');
    console.log('  ✓ Configuration validation');
    console.log('  ✓ Integration with existing LLM orchestration system');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

async function demonstrateEnvironmentSpecificConfig() {
  console.log('\n🌍 Environment-Specific Configuration Demo');
  console.log('=' .repeat(50));

  const configLoader = createConfigLoader();

  const environments = ['development', 'staging', 'production'];

  for (const env of environments) {
    const config = await configLoader.loadConfig({
      environment: env,
      userType: 'developer',
      context: 'code generation'
    });

    console.log(`\n${env.toUpperCase()} Environment:`);
    console.log(`  Active Meta-Prompts: ${config.activeMetaPrompts.length}`);
    console.log(`  Evolution Enabled: ${config.orchestration.evolution.enabled}`);
    console.log(`  Log Level: ${config.orchestration.monitoring.logLevel}`);
    console.log(`  Security Features: ${Object.entries(config.orchestration.security)
      .filter(([_, enabled]) => enabled)
      .map(([feature, _]) => feature)
      .join(', ')}`);

    // Check if environment-specific content was appended
    const systemCore = config.activeMetaPrompts.find(p => p.id === 'system_core_meta');
    if (systemCore && systemCore.content.includes(`${env.charAt(0).toUpperCase() + env.slice(1)} Environment Notes:`)) {
      console.log(`  Environment-Specific Instructions: ✅ Applied`);
    }
  }
}

async function demonstrateUserTypeSpecificPrompts() {
  console.log('\n👥 User Type-Specific Prompts Demo');
  console.log('=' .repeat(50));

  const configLoader = createConfigLoader();
  const userTypes = ['developer', 'business_analyst', 'end_user', 'system_admin'] as const;

  for (const userType of userTypes) {
    const config = await configLoader.loadConfig({
      environment: 'development',
      userType,
      context: 'general assistance'
    });

    console.log(`\n${userType.toUpperCase().replace('_', ' ')} User Type:`);
    console.log(`  Total Active Meta-Prompts: ${config.activeMetaPrompts.length}`);
    console.log(`  User-Specific Prompts:`);
    
    const userSpecificPrompts = config.activeMetaPrompts.filter(p => 
      p.id.includes('user_') && p.id.includes(userType)
    );
    
    userSpecificPrompts.forEach(prompt => {
      console.log(`    - ${prompt.name}`);
      console.log(`      Tags: ${prompt.tags.join(', ')}`);
    });
    
    if (userSpecificPrompts.length === 0) {
      console.log('    - No specific prompts for this user type');
    }
  }
}

// ==================== MAIN EXECUTION ====================

async function main() {
  try {
    await demonstrateConfigLoader();
    await demonstrateEnvironmentSpecificConfig();
    await demonstrateUserTypeSpecificPrompts();
  } catch (error) {
    console.error('❌ Demo execution failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export {
  demonstrateConfigLoader,
  demonstrateEnvironmentSpecificConfig,
  demonstrateUserTypeSpecificPrompts
};
