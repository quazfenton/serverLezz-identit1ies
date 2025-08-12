import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMOrchestrationConfig } from './config';

// ==================== TYPES ====================

export interface MetaPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  priority: number;
  active: boolean;
  tags: string[];
  content_append?: string;
}

export interface MetaPromptCategory {
  [key: string]: MetaPrompt;
}

export interface MetaPromptConfig {
  system: MetaPromptCategory;
  developer: MetaPromptCategory;
  user: MetaPromptCategory;
  application_rules: {
    priority_order: string[];
    context_matching: {
      triggers: {
        [key: string]: string[];
      };
    };
    combination_rules: {
      strategy: string;
      conflict_resolution: string;
      max_combined_prompts: number;
    };
  };
  environments: {
    [environment: string]: {
      [category: string]: {
        [promptKey: string]: {
          content_append?: string;
          [key: string]: any;
        };
      };
    };
  };
}

export interface ConfigContext {
  environment?: string;
  userType?: 'developer' | 'business_analyst' | 'end_user' | 'system_admin';
  context?: string;
  cliArgs?: Record<string, any>;
  envVars?: Record<string, any>;
}

export interface LoadedConfig {
  orchestration: LLMOrchestrationConfig;
  metaPrompts: MetaPrompt[];
  activeMetaPrompts: MetaPrompt[];
  context: ConfigContext;
}

// ==================== CONFIG LOADER CLASS ====================

export class ConfigLoader {
  private metaPromptConfig: MetaPromptConfig | null = null;
  private configPath: string;
  private metaPromptPath: string;

  constructor(
    configPath: string = path.join(process.cwd(), 'config'),
    metaPromptPath: string = path.join(process.cwd(), 'config', 'metaPrompts.yaml')
  ) {
    this.configPath = configPath;
    this.metaPromptPath = metaPromptPath;
  }

  // ==================== PUBLIC API ====================

  /**
   * Load complete configuration including meta-prompts and orchestration config
   */
  public async loadConfig(context: ConfigContext = {}): Promise<LoadedConfig> {
    // Load meta-prompts
    const metaPromptConfig = await this.loadMetaPrompts();
    
    // Load base orchestration config (using existing config system)
    const orchestrationConfig = await this.loadOrchestrationConfig(context);
    
    // Apply context-specific overrides
    const enhancedMetaPrompts = this.applyEnvironmentOverrides(
      metaPromptConfig,
      context.environment || 'development'
    );
    
    // Select applicable meta-prompts based on context
    const applicableMetaPrompts = this.selectApplicableMetaPrompts(
      enhancedMetaPrompts,
      context
    );
    
    // Get all meta-prompts (flattened)
    const allMetaPrompts = this.flattenMetaPrompts(enhancedMetaPrompts);
    
    return {
      orchestration: orchestrationConfig,
      metaPrompts: allMetaPrompts,
      activeMetaPrompts: applicableMetaPrompts,
      context: {
        environment: 'development',
        userType: 'developer',
        ...context
      }
    };
  }

  /**
   * Load and merge configuration from multiple sources
   */
  public async loadMergedConfig(
    baseConfig?: Partial<LLMOrchestrationConfig>,
    cliArgs?: Record<string, any>,
    envVars?: Record<string, any>
  ): Promise<LoadedConfig> {
    const context: ConfigContext = {
      environment: envVars?.NODE_ENV || cliArgs?.environment || 'development',
      userType: cliArgs?.userType || 'developer',
      context: cliArgs?.context || '',
      cliArgs,
      envVars
    };

    const config = await this.loadConfig(context);
    
    // Merge base config if provided
    if (baseConfig) {
      config.orchestration = this.mergeConfigs(config.orchestration, baseConfig);
    }
    
    // Apply CLI arguments
    if (cliArgs) {
      config.orchestration = this.applyCLIOverrides(config.orchestration, cliArgs);
    }
    
    // Apply environment variables
    if (envVars) {
      config.orchestration = this.applyEnvVarOverrides(config.orchestration, envVars);
    }
    
    return config;
  }

  /**
   * Get meta-prompts for specific context
   */
  public async getMetaPromptsForContext(
    context: string,
    userType?: string
  ): Promise<MetaPrompt[]> {
    const metaPromptConfig = await this.loadMetaPrompts();
    
    const contextObj: ConfigContext = {
      context,
      userType: userType as any
    };
    
    return this.selectApplicableMetaPrompts(metaPromptConfig, contextObj);
  }

  /**
   * Combine multiple meta-prompts into a single prompt
   */
  public combineMetaPrompts(
    metaPrompts: MetaPrompt[],
    strategy: string = 'hierarchical_merge'
  ): string {
    if (metaPrompts.length === 0) return '';
    if (metaPrompts.length === 1) return metaPrompts[0].content;

    // Sort by priority (highest first)
    const sortedPrompts = [...metaPrompts].sort((a, b) => b.priority - a.priority);

    switch (strategy) {
      case 'hierarchical_merge':
        return this.hierarchicalMerge(sortedPrompts);
      case 'concatenate':
        return this.concatenatePrompts(sortedPrompts);
      case 'priority_only':
        return sortedPrompts[0].content;
      default:
        return this.hierarchicalMerge(sortedPrompts);
    }
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Load meta-prompts configuration
   */
  private async loadMetaPrompts(): Promise<MetaPromptConfig> {
    if (this.metaPromptConfig) {
      return this.metaPromptConfig;
    }

    try {
      const content = await fs.readFile(this.metaPromptPath, 'utf8');
      this.metaPromptConfig = yaml.load(content) as MetaPromptConfig;
      return this.metaPromptConfig;
    } catch (error) {
      console.warn(`Failed to load meta-prompts from ${this.metaPromptPath}:`, error);
      // Return empty config as fallback
      return {
        system: {},
        developer: {},
        user: {},
        application_rules: {
          priority_order: ['system', 'developer', 'user'],
          context_matching: { triggers: {} },
          combination_rules: {
            strategy: 'hierarchical_merge',
            conflict_resolution: 'highest_priority_wins',
            max_combined_prompts: 3
          }
        },
        environments: {}
      };
    }
  }

  /**
   * Load orchestration config using existing system
   */
  private async loadOrchestrationConfig(context: ConfigContext): Promise<LLMOrchestrationConfig> {
    // Import the existing configuration factory
    const { ConfigurationFactory, detectEnvironment } = await import('./config');
    
    const environment = context.environment || detectEnvironment();
    const envType = environment as 'development' | 'production' | 'research';
    
    return ConfigurationFactory.createConfig(envType);
  }

  /**
   * Apply environment-specific overrides to meta-prompts
   */
  private applyEnvironmentOverrides(
    config: MetaPromptConfig,
    environment: string
  ): MetaPromptConfig {
    const envOverrides = config.environments[environment];
    if (!envOverrides) return config;

    const enhancedConfig = JSON.parse(JSON.stringify(config)); // Deep clone

    // Apply overrides
    for (const [category, categoryOverrides] of Object.entries(envOverrides)) {
      if (enhancedConfig[category]) {
        for (const [promptKey, overrides] of Object.entries(categoryOverrides)) {
          if (enhancedConfig[category][promptKey]) {
            // Apply content_append
            if (overrides.content_append) {
              enhancedConfig[category][promptKey].content += overrides.content_append;
            }
            
            // Apply other overrides
            Object.assign(enhancedConfig[category][promptKey], overrides);
          }
        }
      }
    }

    return enhancedConfig;
  }

  /**
   * Select applicable meta-prompts based on context
   */
  private selectApplicableMetaPrompts(
    config: MetaPromptConfig,
    context: ConfigContext
  ): MetaPrompt[] {
    const applicable: MetaPrompt[] = [];

    // Always include system prompts (highest priority)
    for (const systemPrompt of Object.values(config.system)) {
      if (systemPrompt.active) {
        applicable.push(systemPrompt);
      }
    }

    // Add developer prompts if context matches
    if (context.userType === 'developer' || this.contextMatchesDeveloper(context.context || '')) {
      for (const devPrompt of Object.values(config.developer)) {
        if (devPrompt.active && this.promptMatchesContext(devPrompt, context)) {
          applicable.push(devPrompt);
        }
      }
    }

    // Add user-specific prompts
    if (context.userType && config.user[context.userType]) {
      const userPrompt = config.user[context.userType];
      if (userPrompt.active) {
        applicable.push(userPrompt);
      }
    }

    // Add context-triggered prompts
    const contextTriggered = this.getContextTriggeredPrompts(config, context.context || '');
    applicable.push(...contextTriggered);

    // Remove duplicates and sort by priority
    const unique = this.removeDuplicatePrompts(applicable);
    const sorted = unique.sort((a, b) => b.priority - a.priority);

    // Limit to max_combined_prompts
    const maxPrompts = config.application_rules.combination_rules.max_combined_prompts;
    return sorted.slice(0, maxPrompts);
  }

  /**
   * Check if context matches developer-related triggers
   */
  private contextMatchesDeveloper(context: string): boolean {
    const lowerContext = context.toLowerCase();
    const devKeywords = ['code', 'function', 'class', 'implement', 'debug', 'error', 'architecture'];
    return devKeywords.some(keyword => lowerContext.includes(keyword));
  }

  /**
   * Check if prompt matches context
   */
  private promptMatchesContext(prompt: MetaPrompt, context: ConfigContext): boolean {
    if (!context.context) return true; // No context filter, include all active prompts
    
    const lowerContext = context.context.toLowerCase();
    return prompt.tags.some(tag => lowerContext.includes(tag.toLowerCase()));
  }

  /**
   * Get prompts triggered by specific context keywords
   */
  private getContextTriggeredPrompts(config: MetaPromptConfig, context: string): MetaPrompt[] {
    const triggered: MetaPrompt[] = [];
    const lowerContext = context.toLowerCase();
    
    const triggers = config.application_rules.context_matching.triggers;
    
    for (const [triggerType, keywords] of Object.entries(triggers)) {
      const hasMatch = keywords.some(keyword => lowerContext.includes(keyword.toLowerCase()));
      
      if (hasMatch) {
        // Find corresponding prompts
        const prompts = this.findPromptsByType(config, triggerType);
        triggered.push(...prompts);
      }
    }
    
    return triggered;
  }

  /**
   * Find prompts by type/category
   */
  private findPromptsByType(config: MetaPromptConfig, type: string): MetaPrompt[] {
    const found: MetaPrompt[] = [];
    
    // Search in all categories
    for (const category of Object.values(config.system)) {
      if (category.id.includes(type) || category.tags.includes(type)) {
        found.push(category);
      }
    }
    
    for (const category of Object.values(config.developer)) {
      if (category.id.includes(type) || category.tags.includes(type)) {
        found.push(category);
      }
    }
    
    for (const category of Object.values(config.user)) {
      if (category.id.includes(type) || category.tags.includes(type)) {
        found.push(category);
      }
    }
    
    return found.filter(prompt => prompt.active);
  }

  /**
   * Remove duplicate prompts (by ID)
   */
  private removeDuplicatePrompts(prompts: MetaPrompt[]): MetaPrompt[] {
    const seen = new Set<string>();
    return prompts.filter(prompt => {
      if (seen.has(prompt.id)) {
        return false;
      }
      seen.add(prompt.id);
      return true;
    });
  }

  /**
   * Flatten all meta-prompts into a single array
   */
  private flattenMetaPrompts(config: MetaPromptConfig): MetaPrompt[] {
    const all: MetaPrompt[] = [];
    
    all.push(...Object.values(config.system));
    all.push(...Object.values(config.developer));
    all.push(...Object.values(config.user));
    
    return all;
  }

  /**
   * Merge two configurations (deep merge)
   */
  private mergeConfigs(
    base: LLMOrchestrationConfig,
    override: Partial<LLMOrchestrationConfig>
  ): LLMOrchestrationConfig {
    return {
      evolution: { ...base.evolution, ...override.evolution },
      storage: { ...base.storage, ...override.storage },
      providers: override.providers || base.providers,
      prompts: override.prompts || base.prompts,
      features: { ...base.features, ...override.features },
      monitoring: { ...base.monitoring, ...override.monitoring },
      security: { ...base.security, ...override.security }
    };
  }

  /**
   * Apply CLI argument overrides
   */
  private applyCLIOverrides(
    config: LLMOrchestrationConfig,
    cliArgs: Record<string, any>
  ): LLMOrchestrationConfig {
    const result = { ...config };

    // Map CLI arguments to config properties
    if (cliArgs.evolutionEnabled !== undefined) {
      result.evolution.enabled = cliArgs.evolutionEnabled;
    }
    
    if (cliArgs.evolutionInterval !== undefined) {
      result.evolution.interval = parseInt(cliArgs.evolutionInterval);
    }
    
    if (cliArgs.logLevel) {
      result.monitoring.logLevel = cliArgs.logLevel;
    }
    
    if (cliArgs.enableMetrics !== undefined) {
      result.monitoring.enableMetrics = cliArgs.enableMetrics;
    }
    
    if (cliArgs.storageBasePath) {
      result.storage.basePath = cliArgs.storageBasePath;
    }

    return result;
  }

  /**
   * Apply environment variable overrides
   */
  private applyEnvVarOverrides(
    config: LLMOrchestrationConfig,
    envVars: Record<string, any>
  ): LLMOrchestrationConfig {
    const result = { ...config };

    // Map environment variables to config properties
    if (envVars.LLM_EVOLUTION_ENABLED !== undefined) {
      result.evolution.enabled = envVars.LLM_EVOLUTION_ENABLED === 'true';
    }
    
    if (envVars.LLM_EVOLUTION_INTERVAL) {
      result.evolution.interval = parseInt(envVars.LLM_EVOLUTION_INTERVAL);
    }
    
    if (envVars.LLM_LOG_LEVEL) {
      result.monitoring.logLevel = envVars.LLM_LOG_LEVEL;
    }
    
    if (envVars.LLM_STORAGE_PATH) {
      result.storage.basePath = envVars.LLM_STORAGE_PATH;
    }
    
    if (envVars.LLM_ENABLE_METRICS !== undefined) {
      result.monitoring.enableMetrics = envVars.LLM_ENABLE_METRICS === 'true';
    }

    return result;
  }

  // ==================== META-PROMPT COMBINATION STRATEGIES ====================

  /**
   * Hierarchical merge strategy - combines prompts based on priority with clear sections
   */
  private hierarchicalMerge(prompts: MetaPrompt[]): string {
    const sections: string[] = [];
    
    sections.push('# Combined Meta-Prompt Instructions\n');
    sections.push('Follow these guidelines in order of priority:\n');
    
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      sections.push(`## ${i + 1}. ${prompt.name} (Priority: ${prompt.priority})\n`);
      sections.push(`${prompt.content}\n`);
      
      if (i < prompts.length - 1) {
        sections.push('---\n');
      }
    }
    
    sections.push('\n# Final Instructions');
    sections.push('When conflicts arise between guidelines, follow the higher priority instruction.');
    sections.push('Ensure all responses maintain consistency with the core principles outlined above.');
    
    return sections.join('\n');
  }

  /**
   * Simple concatenation strategy
   */
  private concatenatePrompts(prompts: MetaPrompt[]): string {
    return prompts
      .map(prompt => `${prompt.name}:\n${prompt.content}`)
      .join('\n\n---\n\n');
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Validate configuration completeness
   */
  public async validateConfig(config: LoadedConfig): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate orchestration config
    try {
      const { ConfigurationFactory } = await import('./config');
      ConfigurationFactory.validateConfig(config.orchestration);
    } catch (error) {
      errors.push(`Orchestration config validation failed: ${error}`);
    }

    // Validate meta-prompts
    if (config.metaPrompts.length === 0) {
      warnings.push('No meta-prompts loaded');
    }

    if (config.activeMetaPrompts.length === 0) {
      warnings.push('No active meta-prompts for current context');
    }

    // Check for required system prompts
    const hasSystemCore = config.activeMetaPrompts.some(p => p.id === 'system_core_meta');
    if (!hasSystemCore) {
      warnings.push('System core meta-prompt not active');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get configuration summary for debugging
   */
  public getConfigSummary(config: LoadedConfig): {
    environment: string;
    userType: string;
    activeMetaPrompts: string[];
    orchestrationFeatures: string[];
  } {
    return {
      environment: config.context.environment || 'unknown',
      userType: config.context.userType || 'unknown',
      activeMetaPrompts: config.activeMetaPrompts.map(p => p.name),
      orchestrationFeatures: Object.entries(config.orchestration.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature)
    };
  }
}

// ==================== FACTORY FUNCTION ====================

/**
 * Create a new ConfigLoader instance
 */
export function createConfigLoader(
  configPath?: string,
  metaPromptPath?: string
): ConfigLoader {
  return new ConfigLoader(configPath, metaPromptPath);
}

// ==================== EXPORTS ====================

export default ConfigLoader;
