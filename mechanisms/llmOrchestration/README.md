# LLM OrchA System

A sophisticated, error-proofed serverless program for managing and orchestrating Large Language Model (LLM) API calls with advanced features including prompt evolution, multi-provider coordination, and intelligent caching.

## 🚀 Features

### Core Orchestration
- **Multi-Provider Support**: Seamlessly coordinate between OpenAI, Anthropic, Google, and custom providers
- **Intelligent Strategy Selection**: Sequential, parallel, ensemble, fallback, adaptive, and competitive execution strategies
- **Advanced Error Handling**: Circuit breakers, retry logic with exponential backoff, and graceful degradation
- **Performance Monitoring**: Real-time metrics, provider ranking, and optimization recommendations

### Prompt Evolution System
- **Automated Prompt Improvement**: AI-driven prompt evolution based on performance metrics
- **Variation Generation**: Create and test multiple prompt variations automatically
- **Performance-Based Selection**: Choose the best performing prompts based on quality, creativity, and practicality
- **Continuous Learning**: Adapt prompts over time based on usage patterns and feedback

### Storage & Organization
- **Flexible Storage**: Support for filesystem, database, and cloud storage backends
- **Structured Organization**: Automatic folder/file organization with separators and metadata
- **Response Archiving**: Complete response history with provider details and performance metrics
- **Markdown Documentation**: Auto-generated documentation for prompts and responses

### Advanced Capabilities
- **Intelligent Caching**: LRU cache with TTL and quality-based storage decisions
- **Rate Limiting**: Configurable rate limiting per provider and user
- **Quality Assessment**: Multi-dimensional quality scoring (relevance, coherence, creativity, accuracy)
- **Cost Optimization**: Automatic provider selection based on cost-effectiveness
- **Real-time Analytics**: Performance dashboards and optimization insights

## 📁 Project Structure

```
mechanisms/llmOrchestration/
├── index.ts              # Core orchestration engine and types
├── orchestrator.ts       # Main orchestrator class with advanced features
├── config.ts             # Configuration management and presets
├── utils.ts              # Utilities (retry, circuit breaker, caching, etc.)
├── examples.ts           # Comprehensive usage examples
├── cli.ts                # Command-line interface
└── README.md             # This documentation
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ with TypeScript support
- API keys for desired LLM providers

### Environment Variables
```bash
# Required for providers you want to use
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# Optional configuration
NODE_ENV=development|production|research
LLM_RESEARCH_MODE=true|false
DATABASE_URL=postgresql://...
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
S3_BUCKET=your_bucket_name
AWS_REGION=us-east-1
```

### Basic Setup
```typescript
import { createAndInitializeOrchestrator } from './mechanisms/llmOrchestration/orchestrator';

// Create orchestrator with default configuration
const orchestrator = await createAndInitializeOrchestrator();

// Execute a prompt
const response = await orchestrator.executePrompt(
  'api_design_advanced',
  {
    projectName: 'My API',
    language: 'TypeScript',
    framework: 'Express.js',
    requirements: 'RESTful API for user management'
  }
);

console.log(response.finalOutput);
```

## 🎯 Usage Examples

### 1. Simple Prompt Execution
```typescript
const response = await orchestrator.executePrompt(
  'code_generation_advanced',
  {
    requirements: 'Create a React component for user authentication',
    language: 'TypeScript',
    framework: 'React',
    constraints: 'Must use hooks and be accessible'
  },
  {
    strategy: 'adaptive',
    useCache: true,
    userId: 'user123'
  }
);
```

### 2. Prompt Sequence with Evolution
```typescript
const promptIds = [
  'research_question_prompt',
  'literature_review_prompt', 
  'methodology_prompt',
  'analysis_prompt'
];

const responses = await orchestrator.executePromptSequence(
  promptIds,
  {
    topic: 'AI Impact on Software Development',
    scope: '2020-2024 research',
    methodology: 'systematic review'
  },
  {
    strategy: 'sequential',
    continueOnError: true
  }
);
```

### 3. Prompt Evolution
```typescript
// Evolve a prompt to improve performance
const evolvedPromptId = await orchestrator.evolvePrompt('api_design_advanced');

// Use the evolved prompt
const response = await orchestrator.executePrompt(
  evolvedPromptId,
  variables
);
```

### 4. Performance Analysis
```typescript
const analysis = await orchestrator.analyzePerformance();

console.log(`Success Rate: ${analysis.global.successCount / analysis.global.requestCount * 100}%`);
console.log(`Top Provider: ${analysis.providers[0].id}`);
console.log(`Recommendations: ${analysis.recommendations.join(', ')}`);
```

## 🎮 Command Line Interface

The system includes a comprehensive CLI for testing and management:

```bash
# Run full demonstration
npx ts-node mechanisms/llmOrchestration/cli.ts demo

# Execute a single prompt
npx ts-node mechanisms/llmOrchestration/cli.ts execute \
  --prompt=api_design_advanced \
  --variables='{"projectName":"MyAPI","language":"TypeScript"}' \
  --strategy=ensemble \
  --output=response.json

# Execute prompt sequence
npx ts-node mechanisms/llmOrchestration/cli.ts sequence \
  --prompt=prompt1,prompt2,prompt3 \
  --strategy=sequential \
  --verbose

# Evolve a prompt
npx ts-node mechanisms/llmOrchestration/cli.ts evolve \
  --prompt=api_design_advanced

# Analyze performance
npx ts-node mechanisms/llmOrchestration/cli.ts analyze

# List resources
npx ts-node mechanisms/llmOrchestration/cli.ts list prompts
npx ts-node mechanisms/llmOrchestration/cli.ts list providers
npx ts-node mechanisms/llmOrchestration/cli.ts list cache
```

## ⚙️ Configuration

### Environment-Based Presets
```typescript
import { ConfigurationFactory } from './config';

// Development configuration (fast iteration, verbose logging)
const devConfig = ConfigurationFactory.createConfig('development');

// Production configuration (optimized for reliability and cost)
const prodConfig = ConfigurationFactory.createConfig('production');

// Research configuration (maximum creativity and experimentation)
const researchConfig = ConfigurationFactory.createConfig('research');
```

### Custom Configuration
```typescript
const customConfig = ConfigurationFactory.createConfig('production', {
  evolution: {
    enabled: true,
    interval: 5, // Evolve every 5 iterations
    maxVariations: 7
  },
  features: {
    enableCaching: true,
    enableAnalytics: true,
    enableCostOptimization: true
  },
  storage: {
    type: 'hybrid',
    basePath: '/custom/path',
    compression: true,
    encryption: true
  }
});
```

## 🔧 Advanced Features

### Circuit Breaker Pattern
Automatically isolates failing providers to prevent cascade failures:
```typescript
// Circuit breaker automatically manages provider availability
const response = await orchestrator.executePrompt(promptId, variables);
// If a provider fails repeatedly, it's temporarily disabled
```

### Intelligent Caching
Quality-based caching that stores only high-quality responses:
```typescript
// Responses with quality > 0.7 are automatically cached
const response = await orchestrator.executePrompt(promptId, variables, {
  useCache: true // Check cache first, store if high quality
});
```

### Rate Limiting
Per-user and global rate limiting with configurable windows:
```typescript
const response = await orchestrator.executePrompt(promptId, variables, {
  userId: 'user123', // Rate limiting applied per user
  bypassRateLimit: false // Respect rate limits
});
```

### Quality Assessment
Multi-dimensional quality scoring for response evaluation:
```typescript
const quality = response.quality;
console.log(`Relevance: ${quality.relevance}`);
console.log(`Coherence: ${quality.coherence}`);
console.log(`Creativity: ${quality.creativity}`);
console.log(`Overall: ${quality.overall}`);
```

## 📊 Orchestration Strategies

### Sequential
Execute prompts one after another, using previous outputs as context:
```typescript
strategy: 'sequential' // prompt1 → prompt2 → prompt3
```

### Parallel
Execute all prompts simultaneously for speed:
```typescript
strategy: 'parallel' // prompt1 || prompt2 || prompt3
```

### Ensemble
Execute with multiple providers and combine results:
```typescript
strategy: 'ensemble' // Best of multiple provider responses
```

### Fallback
Try providers in order until one succeeds:
```typescript
strategy: 'fallback' // provider1 → provider2 → provider3
```

### Adaptive
Dynamically select providers based on performance:
```typescript
strategy: 'adaptive' // Smart provider selection
```

### Competitive
Get multiple responses and select the best:
```typescript
strategy: 'competitive' // Multiple responses, best wins
```

## 📁 Storage Organization

The system automatically organizes responses in a structured format:

```
data/llm_orchestration/
├── responses/
│   ├── 2024-01-15T10-30-00_req_123/
│   │   ├── response.json           # Main response data
│   │   ├── prompt.md              # Prompt used
│   │   ├── providers/
│   │   │   ├── openai-gpt4/
│   │   │   │   ├── output.txt     # Provider response
│   │   │   │   └── metadata.json  # Performance metrics
│   │   │   └── anthropic-claude/
│   │   │       ├── output.txt
│   │   │       └── metadata.json
│   │   └── separator.txt          # Sequence separator
│   └── ...
├── prompts/
│   ├── api_design_advanced.json   # Prompt definition
│   ├── api_design_advanced.md     # Human-readable format
│   └── ...
└── analytics/
    ├── performance_metrics.json
    └── provider_rankings.json
```

## 🔄 Prompt Evolution Process

The system includes an innovative prompt evolution mechanism:

1. **Performance Monitoring**: Track prompt performance across multiple dimensions
2. **Evolution Trigger**: Automatically evolve prompts based on iteration count or performance thresholds
3. **Variation Generation**: Use meta-prompts to generate improved variations
4. **Selection**: Choose the best variation based on weighted criteria
5. **Integration**: Seamlessly integrate evolved prompts into the workflow

### Evolution Meta-Prompt
The system uses a special meta-prompt to evolve existing prompts:
```
"Give variations of this prompt, even better and practical with focus on 
innovative creativity and ideas on improving to highest potential. 
Think outside the box"
```

### Separator System
Responses are automatically separated using distinctive markers:
```
---###///---###///---###///
```

## 🚨 Error Handling

### Comprehensive Error Types
- `LLMOrchestrationError`: Base error class with context
- `RetryableError`: Errors that can be retried
- `NonRetryableError`: Permanent failures

### Retry Logic
- Exponential backoff with jitter
- Configurable retry attempts and delays
- Smart error classification

### Circuit Breaker
- Automatic failure detection
- Temporary provider isolation
- Gradual recovery testing

## 📈 Performance Monitoring

### Real-time Metrics
- Request count and success rates
- Average latency and cost per request
- Quality scores and provider rankings
- Cache hit rates and efficiency

### Analytics Dashboard
```typescript
const analysis = await orchestrator.analyzePerformance();
// Comprehensive performance insights and recommendations
```

### Optimization Recommendations
The system provides intelligent optimization suggestions:
- Provider selection optimization
- Configuration tuning recommendations
- Cost reduction strategies
- Quality improvement suggestions

## 🔒 Security Features

### API Key Management
- Secure storage and rotation
- Environment-based configuration
- Provider-specific authentication

### Data Protection
- Optional encryption for stored responses
- Configurable data retention policies
- Audit logging for compliance

### Rate Limiting
- Per-user and global limits
- Configurable time windows
- Graceful degradation

## 🧪 Testing & Development

### Running Examples
```bash
# Run all examples
npx ts-node mechanisms/llmOrchestration/examples.ts

# Run specific example
const examples = new LLMOrchestrationExamples();
await examples.runCodeGenerationExample();
```

### Development Mode
Set `NODE_ENV=development` for:
- Verbose logging
- Relaxed rate limiting
- Fast prompt evolution
- Local file storage

### Research Mode
Set `LLM_RESEARCH_MODE=true` for:
- Maximum creativity focus
- Experimental features
- Extended data retention
- Advanced analytics

## 🤝 Integration

### Express.js Integration
```typescript
import express from 'express';
import { createAndInitializeOrchestrator } from './mechanisms/llmOrchestration/orchestrator';

const app = express();
const orchestrator = await createAndInitializeOrchestrator();

app.post('/api/llm/execute', async (req, res) => {
  try {
    const { promptId, variables, options } = req.body;
    const response = await orchestrator.executePrompt(promptId, variables, options);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Serverless Integration
```typescript
// AWS Lambda handler
export const handler = async (event: any) => {
  const orchestrator = await createAndInitializeOrchestrator();
  
  try {
    const response = await orchestrator.executePrompt(
      event.promptId,
      event.variables,
      event.options
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify(response)
    };
  } finally {
    await orchestrator.shutdown();
  }
};
```

## 📚 API Reference

### Main Classes
- `AdvancedLLMOrchestrator`: Main orchestration class
- `LLMOrchestrationEngine`: Core engine
- `ConfigurationFactory`: Configuration management
- `RetryManager`: Retry logic handler
- `CircuitBreaker`: Circuit breaker implementation
- `LRUCache`: Intelligent caching
- `QualityAssessment`: Response quality evaluation

### Key Methods
- `executePrompt()`: Execute single prompt
- `executePromptSequence()`: Execute prompt sequence
- `evolvePrompt()`: Evolve prompt for better performance
- `analyzePerformance()`: Get performance analytics
- `optimizeConfiguration()`: Get optimization recommendations

## 🔮 Future Enhancements

### Planned Features
- **Multi-modal Support**: Image, audio, and video processing
- **Workflow Templates**: Pre-built workflows for common tasks
- **A/B Testing**: Automated prompt testing and optimization
- **Real-time Collaboration**: Multi-user prompt development
- **Advanced Analytics**: ML-powered performance prediction
- **Custom Providers**: Easy integration of new LLM providers

### Extensibility
The system is designed for easy extension:
- Plugin architecture for custom strategies
- Configurable quality assessment metrics
- Custom storage backends
- Provider-specific optimizations

## 📄 License

This project is part of the ServerLezz Identities system and follows the same licensing terms.

## 🤝 Contributing

Contributions are welcome! Please see the main project's contributing guidelines.

## 📞 Support

For support and questions, please refer to the main project's support channels.

---

**Built with ❤️ for the future of AI orchestration**