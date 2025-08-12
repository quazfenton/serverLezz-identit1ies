# Meta-Prompt Configuration System

This directory contains configuration files for the LLM orchestration system, with a focus on meta-prompts that guide AI behavior across different contexts and user types.

## 📁 Files

- **`metaPrompts.yaml`** - Main meta-prompt configuration file
- **`README.md`** - This documentation

## 🚀 Quick Start

```typescript
import { createConfigLoader } from '../mechanisms/llmOrchestration/ConfigLoader';

// Create a config loader
const configLoader = createConfigLoader();

// Load configuration for a specific context
const config = await configLoader.loadConfig({
  environment: 'development',
  userType: 'developer',
  context: 'code generation for REST API'
});

// Access active meta-prompts
console.log('Active meta-prompts:', config.activeMetaPrompts.length);

// Combine meta-prompts into a single instruction
const combinedPrompt = configLoader.combineMetaPrompts(
  config.activeMetaPrompts,
  'hierarchical_merge'
);
```

## 🎯 Meta-Prompt Categories

### System Meta-Prompts
**Priority: Highest (100-85)**

Core system-level instructions that define fundamental AI behavior:

- **`system_core_meta`** - Fundamental system behavior and safety guidelines
- **`system_error_handling_meta`** - Error handling and recovery procedures  
- **`system_performance_meta`** - Performance optimization principles

### Developer Meta-Prompts  
**Priority: High (95-85)**

Instructions specifically for development contexts:

- **`dev_code_generation_meta`** - High-quality code generation standards
- **`dev_architecture_meta`** - Architectural design and decision guidance
- **`dev_debugging_meta`** - Debugging and troubleshooting methodology

### User Meta-Prompts
**Priority: Medium (85-75)**

User-type specific instructions:

- **`user_business_analyst_meta`** - Business analysis and requirements support
- **`user_end_user_meta`** - End-user support and assistance
- **`user_system_admin_meta`** - System administration and DevOps support

## 🔧 Configuration Context

The ConfigLoader automatically selects appropriate meta-prompts based on context:

```typescript
interface ConfigContext {
  environment?: 'development' | 'staging' | 'production';
  userType?: 'developer' | 'business_analyst' | 'end_user' | 'system_admin';
  context?: string;  // Free-form context description
  cliArgs?: Record<string, any>;
  envVars?: Record<string, any>;
}
```

### Context Matching Rules

Meta-prompts are selected based on:

1. **User Type** - Directly maps to user-specific meta-prompts
2. **Context Keywords** - Triggers based on content analysis:
   - `code`, `function`, `class` → Developer prompts
   - `error`, `bug`, `debug` → Debugging prompts  
   - `architecture`, `design`, `scalability` → Architecture prompts
   - `requirements`, `business`, `analysis` → Business analyst prompts

3. **Environment** - Applies environment-specific overrides

## 🌍 Environment-Specific Configuration

The system supports different environments with specific overrides:

### Development Environment
```yaml
development:
  system:
    core:
      content_append: |
        Development Environment Notes:
        - Prioritize developer experience and debugging capabilities
        - Include verbose logging and detailed error messages
        - Allow for experimental features and rapid iteration
```

### Staging Environment  
```yaml
staging:
  system:
    core:
      content_append: |
        Staging Environment Notes:
        - Balance between development flexibility and production stability
        - Implement comprehensive testing and validation
        - Focus on integration testing and performance validation
```

### Production Environment
```yaml
production:
  system:
    core:
      content_append: |
        Production Environment Notes:
        - Prioritize stability, security, and performance
        - Implement conservative change management
        - Focus on monitoring, alerting, and observability
```

## ⚙️ Configuration Loading Strategies

### 1. Basic Configuration Loading

```typescript
const config = await configLoader.loadConfig({
  environment: 'development',
  userType: 'developer'
});
```

### 2. Merged Configuration (CLI + Environment Variables)

```typescript
const config = await configLoader.loadMergedConfig(
  baseConfig,           // Optional base config overrides
  cliArgs,             // CLI arguments
  process.env          // Environment variables
);
```

### 3. Enhanced Configuration (with existing system)

```typescript
import { createEnhancedConfig } from '../mechanisms/llmOrchestration/config';

const config = await createEnhancedConfig('development', {
  userType: 'developer',
  context: 'API development',
  cliArgs: { evolutionEnabled: false },
  envVars: process.env
});
```

## 🔀 Meta-Prompt Combination Strategies

### Hierarchical Merge (Default)
Combines prompts with clear priority sections and conflict resolution:

```typescript
const combined = configLoader.combineMetaPrompts(prompts, 'hierarchical_merge');
```

### Concatenation
Simple concatenation with separators:

```typescript
const combined = configLoader.combineMetaPrompts(prompts, 'concatenate');
```

### Priority Only
Uses only the highest priority meta-prompt:

```typescript
const combined = configLoader.combineMetaPrompts(prompts, 'priority_only');
```

## 📊 Configuration Validation

```typescript
const validation = await configLoader.validateConfig(loadedConfig);

console.log('Is Valid:', validation.isValid);
console.log('Errors:', validation.errors);
console.log('Warnings:', validation.warnings);
```

## 🎮 CLI Integration

### Environment Variables

```bash
export NODE_ENV=production
export LLM_EVOLUTION_ENABLED=true
export LLM_LOG_LEVEL=info
export LLM_STORAGE_PATH=/var/lib/llm_data
```

### Command Line Arguments

```bash
ts-node app.ts --environment production --userType developer --context "debugging API issues" --evolutionEnabled false --logLevel warn
```

## 📈 Usage Examples

### Example 1: Development Context

```typescript
// Load config for code generation in development
const devConfig = await configLoader.loadConfig({
  environment: 'development',
  userType: 'developer', 
  context: 'generate REST API endpoints with authentication'
});

// This will activate:
// - System core meta-prompt (security, performance guidelines)
// - Developer code generation meta-prompt (code quality standards)
// - Development environment-specific instructions
```

### Example 2: Production Debugging

```typescript
// Load config for production debugging
const prodConfig = await configLoader.loadConfig({
  environment: 'production',
  userType: 'system_admin',
  context: 'debug database connection issues'
});

// This will activate:
// - System core meta-prompt with production safety emphasis
// - System admin meta-prompt (infrastructure focus)
// - Debugging meta-prompt (systematic troubleshooting)
```

### Example 3: Business Analysis

```typescript
// Load config for business requirements analysis
const bizConfig = await configLoader.loadConfig({
  environment: 'staging',
  userType: 'business_analyst',
  context: 'analyze requirements for new user dashboard feature'
});

// This will activate:
// - System core meta-prompt
// - Business analyst meta-prompt (stakeholder focus, business terminology)
// - Staging environment considerations
```

## 🔍 Debugging Configuration

Get a summary of loaded configuration:

```typescript
const summary = configLoader.getConfigSummary(loadedConfig);
console.log({
  environment: summary.environment,
  userType: summary.userType, 
  activeMetaPrompts: summary.activeMetaPrompts,
  orchestrationFeatures: summary.orchestrationFeatures
});
```

## 🏗️ Extending the System

### Adding New Meta-Prompts

1. **Add to metaPrompts.yaml:**
```yaml
developer:
  security_review:
    id: "dev_security_review_meta"
    name: "Security Review Meta-Prompt"
    description: "Guidelines for security code review"
    content: |
      When reviewing code for security:
      1. Check for input validation
      2. Review authentication/authorization
      3. Validate data sanitization
      # ... more guidelines
    priority: 88
    active: true
    tags: ["security", "review", "code"]
```

2. **Add context triggers:**
```yaml
application_rules:
  context_matching:
    triggers:
      security_review:
        - "security review"
        - "code review" 
        - "vulnerability"
        - "security audit"
```

### Custom Combination Strategies

Extend the ConfigLoader class:

```typescript
class CustomConfigLoader extends ConfigLoader {
  private customMergeStrategy(prompts: MetaPrompt[]): string {
    // Your custom combination logic
    return prompts
      .sort((a, b) => b.priority - a.priority)
      .map(p => `[${p.priority}] ${p.content}`)
      .join('\n---\n');
  }
  
  public combineMetaPrompts(prompts: MetaPrompt[], strategy: string): string {
    if (strategy === 'custom') {
      return this.customMergeStrategy(prompts);
    }
    return super.combineMetaPrompts(prompts, strategy);
  }
}
```

## 🚨 Best Practices

1. **Priority Assignment:**
   - System: 100-85 (critical safety and core behavior)
   - Developer: 95-85 (technical quality and standards)  
   - User: 85-75 (user experience and context)

2. **Environment Overrides:**
   - Use `content_append` for environment-specific additions
   - Keep base prompts environment-agnostic
   - Override specific properties for environment differences

3. **Context Matching:**
   - Use clear, specific trigger keywords
   - Avoid overly broad matching rules
   - Test context matching with various input scenarios

4. **Validation:**
   - Always validate configuration before use
   - Handle graceful fallbacks when meta-prompts fail to load
   - Log warnings for missing or inactive prompts

5. **Performance:**
   - ConfigLoader caches loaded meta-prompts 
   - Limit `max_combined_prompts` for optimal performance
   - Consider prompt length impact on token usage

## 📚 Integration with Existing Systems

The meta-prompt system integrates seamlessly with the existing LLM orchestration:

```typescript
// Traditional approach
const engine = new LLMOrchestrationEngine(config);

// Enhanced approach with meta-prompts
const enhancedConfig = await createEnhancedConfig('development', {
  userType: 'developer',
  context: 'API development'
});

const engine = new LLMOrchestrationEngine({
  evolutionConfig: enhancedConfig.evolution,
  storageConfig: enhancedConfig.storage
});

// Use meta-prompts to enhance any prompt execution
const metaInstructions = enhancedConfig.configLoader.combineMetaPrompts(
  enhancedConfig.metaPrompts.system.concat(enhancedConfig.metaPrompts.developer),
  'hierarchical_merge'
);

// Prepend meta-instructions to user prompts
const enhancedPrompt = `${metaInstructions}\n\n---\n\nUser Request: ${userPrompt}`;
```

This approach ensures that all AI responses are guided by appropriate meta-prompts while maintaining full backward compatibility with existing code.
