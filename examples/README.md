# LLM Orchestration Demo

This directory contains comprehensive demonstration scripts showcasing the advanced LLM orchestration system with meta-prompts integration.

## 📁 Directory Structure

```
examples/
├── demo.ts              # Main end-to-end demo script
├── demo-logs/           # Generated demo log files
├── demo-data/           # Demo data storage
├── demo-results.json    # Exported demo results (generated)
└── README.md           # This documentation
```

## 🎯 Demo Features

The `demo.ts` script demonstrates:

### Core Orchestration Capabilities
- ✅ **Multi-turn conversational scenarios** with context preservation
- ✅ **Meta-prompts integration** for enhanced reasoning
- ✅ **Dynamic strategy selection** based on context analysis
- ✅ **Advanced orchestrator features** including evolution and feedback
- ✅ **Comprehensive logging** of all intermediate reasoning steps
- ✅ **Performance analysis** and insights generation

### Demonstration Scenarios

#### 1. Creative Problem Solving
- **Scenario**: Food waste reduction in restaurants
- **Features**: Creative brainstorming, solution design, implementation planning
- **Meta-prompts**: `problem_analysis`, `solution_generation`, `creative_story_generation`

#### 2. Analytical Reasoning  
- **Scenario**: Remote work policy analysis
- **Features**: Structured analysis, comparative evaluation, recommendations
- **Meta-prompts**: `problem_analysis`, `multimodal_analysis`, `solution_generation`

#### 3. Interactive Creative Writing
- **Scenario**: Collaborative science fiction storytelling
- **Features**: Character development, plot progression, thematic exploration
- **Meta-prompts**: `creative_story_generation`

## 🚀 Running the Demo

### Prerequisites
- Node.js 18+
- TypeScript
- Environment variables configured (OPENAI_API_KEY, etc.)
- LLM orchestration system properly set up

### Basic Usage

```bash
# Run the complete demo
cd examples
npx ts-node demo.ts

# Or import and run programmatically
npm run demo
```

### Programmatic Usage

```typescript
import { LLMOrchestrationDemo, runDemoScript } from './examples/demo';

// Run with default configuration
await runDemoScript();

// Or customize the demo
const demo = new LLMOrchestrationDemo({
  enableLogging: true,
  logToFile: true,
  useMetaPrompts: true,
  orchestratorType: 'advanced',
  conversationTurns: 5
});

await demo.initialize();
const results = await demo.runFullDemo();
await demo.cleanup();
```

## 📊 Demo Output

### Console Output
- Real-time colored logging with timestamps
- Execution progress tracking
- Intermediate reasoning steps display
- Performance metrics and analysis
- Comprehensive results summary

### Generated Files
- **Log Files**: Detailed execution logs in `demo-logs/`
- **Results Export**: JSON export with complete analysis in `demo-results.json`
- **Performance Data**: Stored in `demo-data/` directory

## 🧠 Intermediate Reasoning Steps

The demo logs detailed intermediate steps for each conversation turn:

### Step-by-Step Processing
1. **Prompt Preparation**: Meta-prompts integration and context injection
2. **Strategy Selection**: Dynamic strategy selection based on content analysis
3. **Orchestration Execution**: Advanced orchestrator processing with multiple providers
4. **Response Enhancement**: Post-processing and quality assessment
5. **Insight Extraction**: Learning and performance analysis

### Example Log Output
```
[2024-01-20T10:30:15.000Z] INFO: 🔧 Step 1: Preparing enhanced prompt...
[2024-01-20T10:30:15.500Z] DEBUG:   1. prompt_preparation: Enhanced prompt with meta-prompts and context: === Comprehensive Problem Analysis ===...
[2024-01-20T10:30:16.000Z] INFO: 🎯 Step 2: Selecting orchestration strategy...
[2024-01-20T10:30:16.200Z] DEBUG:   2. strategy_selection: Optimal strategy based on context: ensemble
[2024-01-20T10:30:17.000Z] INFO: ⚡ Step 3: Executing with orchestrator...
[2024-01-20T10:30:19.500Z] DEBUG:   3. orchestration_execution: Orchestrator processing and response generation: Generated response with quality 0.85
```

## 📈 Performance Analysis

### Quality Metrics
- **Response Quality**: Overall response quality scoring (0-1 scale)
- **Context Relevance**: How well responses incorporate conversation context
- **Meta-prompt Effectiveness**: Impact of meta-prompt integration

### Performance Metrics
- **Execution Time**: Per-turn and overall processing time
- **Cost Analysis**: Token usage and associated costs
- **Error Tracking**: Error rates and failure analysis

### Insights Generation
- **Quality Trends**: Quality progression across conversation turns
- **Performance Patterns**: Execution time and cost patterns
- **Optimization Recommendations**: Automated suggestions for improvement

## 🔧 Configuration Options

```typescript
interface DemoConfig {
  enableLogging: boolean;      // Console logging on/off
  logToFile: boolean;          // File logging on/off
  logFilePath: string;         // Log file location
  conversationTurns: number;   // Max turns per scenario
  useMetaPrompts: boolean;     // Meta-prompts integration
  orchestratorType: 'basic' | 'advanced';  // Orchestrator type
  scenarios: DemoScenario[];   // Custom scenarios
}
```

## 📋 Sample Results

### Summary Metrics
```json
{
  "totalScenarios": 3,
  "totalTurns": 9,
  "averageQuality": 0.82,
  "totalCost": 0.045,
  "totalDuration": 15000,
  "insights": [
    "High-quality response achieved (0.85)",
    "Good context integration (78%)",
    "Meta-prompts were utilized throughout the demo"
  ]
}
```

### Key Insights
- **Quality Achievement**: Consistently high response quality (>80%)
- **Context Integration**: Strong contextual awareness across turns
- **Performance Efficiency**: Balanced execution time vs. quality
- **Cost Effectiveness**: Optimized token usage and cost management

## 🔍 Troubleshooting

### Common Issues
1. **Missing API Keys**: Ensure OPENAI_API_KEY is set
2. **Module Resolution**: Verify TypeScript configuration
3. **Permission Errors**: Check write permissions for log directories
4. **Memory Issues**: Adjust scenario complexity for resource-constrained environments

### Debug Mode
Enable detailed debugging by setting log level:
```typescript
const demo = new LLMOrchestrationDemo({
  enableLogging: true,
  // Additional debug configuration
});
```

## 🎯 Next Steps

### Extension Possibilities
- **Custom Scenarios**: Add domain-specific conversation scenarios
- **Integration Testing**: Connect with external APIs or databases
- **Performance Benchmarking**: Compare different orchestration strategies
- **A/B Testing**: Test different meta-prompt combinations

### Production Considerations
- **Monitoring Integration**: Connect with production monitoring systems
- **Feedback Loops**: Implement user feedback collection
- **Cost Optimization**: Monitor and optimize API usage costs
- **Scalability Testing**: Test with higher concurrency and volume

## 📚 Additional Resources

- [LLM Orchestration Documentation](../mechanisms/llmOrchestration/README.md)
- [Meta-prompts Configuration](../config/metaPrompts.yaml)
- [Configuration Loader Examples](../mechanisms/llmOrchestration/examples/configLoaderDemo.ts)

---

**Note**: This demo script provides a comprehensive showcase of the advanced LLM orchestration capabilities. For production use, ensure proper configuration of API keys, monitoring, and resource management.
