// Main exports for the refactored LLM Orchestrator

// Core orchestrator
export { default as createDefaultOrchestrator, Orchestrator, createOrchestrator } from './orchestrator';
export type { PipelineConfig, PipelineResult, Dependencies, OrchestratorFactoryConfig } from './orchestrator';

// Message system
export { Message, MessageImpl, MessageContext } from './types/Message';
export type { MessageProcessor } from './types/Message';

// Modules
export { PromptRegistry, IPromptRegistry } from './modules/PromptRegistry';
export { LLMClient, ILLMClient } from './modules/LLMClient';
export type { LLMRequest } from './modules/LLMClient';
export { ToolRouter, IToolRouter } from './modules/ToolRouter';
export type { RoutingDecision } from './modules/ToolRouter';
export { MemoryManager, IMemoryManager } from './modules/MemoryManager';
export type { MemoryEntry } from './modules/MemoryManager';

// Re-export types from the existing system for compatibility
export type { 
  PromptTemplate, 
  LLMProvider, 
  LLMResponse, 
  OrchestrationStrategy,
  QualityMetrics,
  TokenUsage
} from '../mechanisms/llmOrchestration/index';

// Examples
export { default as examples } from './example';

// Quick start function
export function quickStart() {
  return createDefaultOrchestrator();
}

// Version info
export const VERSION = '2.0.0';
export const ARCHITECTURE = 'modular-dependency-injection';

// Default export
export default createDefaultOrchestrator;
