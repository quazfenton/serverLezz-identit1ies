# Refactored LLM Orchestrator Architecture

This directory contains the refactored LLM Orchestrator with a clean, modular architecture using dependency injection and a pipeline-based API.

## Architecture Overview

The orchestrator has been decomposed into separate, testable modules that work together via dependency injection:

```
Message → PromptRegistry → LLMClient → ToolRouter → MemoryManager
```

### Core Components

#### 1. **Message System** (`types/Message.ts`)
- `Message`: Core message interface with id, content, role, timestamp, and metadata
- `MessageImpl`: Concrete message implementation
- `MessageContext`: Context container for sessions, users, and variables

#### 2. **PromptRegistry** (`modules/PromptRegistry.ts`)
- Manages prompt templates and compilation
- Supports dynamic variable substitution
- Factory method: `PromptRegistry.create(prompts)`

#### 3. **LLMClient** (`modules/LLMClient.ts`)
- Handles provider management and API calls
- Abstracts different LLM providers (OpenAI, Anthropic, etc.)
- Factory method: `LLMClient.create(providers)`

#### 4. **ToolRouter** (`modules/ToolRouter.ts`)
- Implements orchestration strategies (sequential, parallel, fallback, ensemble, adaptive, competitive)
- Routes requests to appropriate providers
- Factory method: `ToolRouter.create(defaultStrategy)`

#### 5. **MemoryManager** (`modules/MemoryManager.ts`)
- Manages conversation history and context
- Handles session-based memory with automatic cleanup
- Factory method: `MemoryManager.create()`

#### 6. **Main Orchestrator** (`orchestrator.ts`)
- Coordinates all modules via dependency injection
- Exposes clean `runPipeline()` API
- Supports batch processing and streaming

## Key Features

### 🏗️ **Dependency Injection**
Each module is instantiated via factory methods and injected into the main orchestrator:

```typescript
const dependencies: Dependencies = {
  promptRegistry: PromptRegistry.create(prompts),
  llmClient: LLMClient.create(providers),
  toolRouter: ToolRouter.create('adaptive'),
  memoryManager: MemoryManager.create()
};

const orchestrator = new Orchestrator(dependencies);
```

### 🚀 **Clean Pipeline API**
Simple, consistent interface for all operations:

```typescript
const result = await orchestrator.runPipeline({
  promptId: 'general_assistant',
  variables: { request: 'Your question here' },
  sessionId: 'user_session',
  strategy: 'adaptive'
});
```

### 📦 **Multiple Processing Modes**
- **Single**: `runPipeline(config)` - Process one request
- **Batch**: `runBatchPipeline(configs)` - Process multiple requests
- **Stream**: `runStreamPipeline(configStream)` - Real-time processing

### 🧠 **Smart Data Flow**
1. **Message Processing**: Creates structured message objects
2. **Prompt Compilation**: Retrieves and compiles prompts with variables
3. **Routing Decision**: Selects strategy and providers based on context
4. **Strategy Execution**: Executes chosen orchestration strategy
5. **Response Synthesis**: Combines and processes multiple responses
6. **Memory Updates**: Stores context for future interactions

## Usage Examples

### Basic Usage
```typescript
import createDefaultOrchestrator from './orchestrator';

const orchestrator = createDefaultOrchestrator();

const result = await orchestrator.runPipeline({
  promptText: 'Explain microservices architecture',
  sessionId: 'conversation_1',
  strategy: 'adaptive'
});

console.log(result.finalOutput);
```

### Custom Configuration
```typescript
import { createOrchestrator } from './orchestrator';

const orchestrator = createOrchestrator({
  prompts: customPrompts,
  providers: customProviders,
  defaultStrategy: 'ensemble'
});
```

### Batch Processing
```typescript
const configs = [
  { promptText: 'Question 1', sessionId: 'batch_1' },
  { promptText: 'Question 2', sessionId: 'batch_2' },
  { promptText: 'Question 3', sessionId: 'batch_3' }
];

const results = await orchestrator.runBatchPipeline(configs);
```

### Stream Processing
```typescript
async function* createQuestionStream() {
  for (const question of questions) {
    yield { promptText: question, sessionId: 'stream' };
    await new Promise(r => setTimeout(r, 1000)); // 1 second delay
  }
}

for await (const result of orchestrator.runStreamPipeline(createQuestionStream())) {
  console.log('Stream result:', result.finalOutput);
}
```

## Orchestration Strategies

### 1. **Sequential**
Processes providers one after another, using previous responses as context.

### 2. **Parallel**
Sends requests to all providers simultaneously for speed.

### 3. **Fallback**
Tries providers in order until one succeeds (fault tolerance).

### 4. **Ensemble**
Combines multiple responses using consensus mechanisms.

### 5. **Adaptive**
Dynamically adjusts based on response quality (stops early if quality is high).

### 6. **Competitive**
Runs all providers and returns the best responses based on quality ranking.

## Memory Management

The MemoryManager provides:
- **Session-based Storage**: Separate contexts for different conversations
- **Automatic Cleanup**: Removes old sessions and limits message history
- **Context Retrieval**: Access to conversation history and user variables
- **Memory Statistics**: Monitor usage and performance

## Configuration Options

### Pipeline Configuration
```typescript
interface PipelineConfig {
  promptId?: string;           // ID of prompt template to use
  promptText?: string;         // Direct prompt text
  variables?: Record<string, any>; // Variables for prompt compilation
  strategy?: OrchestrationStrategy; // Routing strategy
  providers?: string[];        // Specific providers to use
  sessionId?: string;          // Session for memory management
  userId?: string;            // User identifier
  priority?: number;          // Request priority (1-5)
  timeout?: number;           // Request timeout in ms
}
```

### Factory Configuration
```typescript
interface OrchestratorFactoryConfig {
  prompts?: PromptTemplate[];     // Custom prompt templates
  providers?: LLMProvider[];      // LLM providers
  defaultStrategy?: OrchestrationStrategy; // Default routing strategy
}
```

## Benefits of the Refactored Architecture

### 🧪 **Testability**
- Each module can be unit tested in isolation
- Dependencies can be mocked for testing
- Clear separation of concerns

### 🔧 **Maintainability**
- Single responsibility for each module
- Easy to add new providers or strategies
- Clear interfaces and contracts

### 🔄 **Extensibility**
- New orchestration strategies can be added easily
- Custom modules can be injected
- Plugin architecture support

### 📊 **Observability**
- Built-in statistics and monitoring
- Memory usage tracking
- Performance metrics

### ⚡ **Performance**
- Efficient memory management
- Streaming support for real-time applications
- Batch processing for high throughput

## Running Examples

See `example.ts` for comprehensive usage examples:

```bash
# Install dependencies
npm install

# Run examples
npm run examples
```

## Migration from Legacy System

The new architecture maintains compatibility with existing types from `mechanisms/llmOrchestration/index.ts` while providing a cleaner, more modular interface.

### Before (Legacy)
```typescript
const orchestrator = new AdvancedLLMOrchestrator(config);
await orchestrator.initialize();
const response = await orchestrator.executePrompt(promptId, variables, options);
```

### After (Refactored)
```typescript
const orchestrator = createDefaultOrchestrator();
const result = await orchestrator.runPipeline({
  promptId,
  variables,
  ...options
});
```

## Future Enhancements

- [ ] Database persistence for MemoryManager
- [ ] Real-time WebSocket API
- [ ] Metrics and monitoring dashboard
- [ ] Plugin system for custom strategies
- [ ] Machine learning-based routing decisions
- [ ] Distributed orchestration support

---

This refactored architecture provides a solid foundation for building scalable, maintainable LLM orchestration systems with clean separation of concerns and excellent testability.
