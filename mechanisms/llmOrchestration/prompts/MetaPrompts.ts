import { PromptTemplate, PromptPerformance } from '../index';

// Initialize default performance for meta-prompts
function initializeMetaPromptPerformance(): PromptPerformance {
  return {
    successRate: 0.85,
    averageQuality: 0.8,
    averageRelevance: 0.85,
    averageCreativity: 0.9,
    averageExecutionTime: 4000,
    costEfficiency: 0.75,
    userSatisfaction: 0.8,
    errorRate: 0.05,
    lastEvaluated: new Date()
  };
}

export const META_PROMPTS: Record<string, PromptTemplate> = {
  prompt_evolution_meta: {
    id: "prompt_evolution_meta",
    name: "Prompt Evolution Meta-Prompt",
    content: `You are an expert prompt engineer with deep understanding of AI systems and natural language processing. Your task is to evolve and improve prompts to achieve higher performance, creativity, and practical utility.

**Original Prompt:**
{{originalPrompt}}

**Category:** {{category}}
**Performance Context:** {{performance}}
**Evolution Context:** {{context}}

**Your Mission:** Create 5 distinct, innovative variations of this prompt that significantly improve upon the original. Each variation should:

1. **Maintain Core Intent**: Preserve the fundamental purpose and goals
2. **Enhance Clarity**: Improve specificity, structure, and understandability  
3. **Boost Performance**: Optimize for better AI responses and user outcomes
4. **Innovate Creatively**: Introduce novel approaches and perspectives
5. **Consider Practicality**: Ensure real-world applicability and usefulness

**Innovation Strategies to Apply:**
- **Perspective Shifting**: Change the viewpoint or role-playing approach
- **Structural Enhancement**: Improve formatting, flow, and organization
- **Context Enrichment**: Add relevant background, constraints, or examples
- **Specificity Amplification**: Make requirements more precise and actionable
- **Creative Frameworks**: Introduce methodologies, step-by-step processes, or thinking frameworks

**Output Format:**
Create exactly 5 variations, separated by: ---###VARIATION_SEPARATOR###---

Each variation should be a complete, standalone prompt that can directly replace the original.

**Quality Standards:**
- Each variation must be substantively different from the original
- Variations should explore different approaches to the same problem
- Include at least one highly creative/experimental variation
- Ensure all variations are immediately usable and practical
- Optimize for both AI performance and human value

Begin your evolution now:`,
    category: "optimization",
    variables: [
      { name: "originalPrompt", type: "string", required: true, description: "The original prompt to evolve" },
      { name: "category", type: "string", required: true, description: "The prompt category" },
      { name: "performance", type: "object", required: false, description: "Performance metrics" },
      { name: "context", type: "string", required: false, description: "Additional context" }
    ],
    metadata: {
      tags: ["meta", "evolution", "optimization", "prompt-engineering"],
      difficulty: 0.9,
      expectedTokens: 1200,
      estimatedCost: 0.036,
      language: "en",
      domain: ["prompt_engineering", "optimization", "meta-learning"],
      author: "system",
      version: "2.0"
    },
    variations: [],
    performance: initializeMetaPromptPerformance(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },

  prompt_mutation_meta: {
    id: "prompt_mutation_meta",
    name: "Prompt Genetic Mutation Meta-Prompt",
    content: `You are a genetic algorithm specialist applying mutation operations to prompts. Your goal is to create a mutated version that maintains the core DNA while introducing beneficial variations.

**Original Prompt DNA:**
{{originalPrompt}}

**Mutation Type:** {{mutationType}}
**Category:** {{category}}
**Preserve Core:** {{preserveCore}}

**Mutation Operations Available:**
- **Creative Mutation**: Enhance artistic, innovative, and imaginative elements
- **Analytical Mutation**: Strengthen logical, systematic, and analytical aspects
- **Structural Mutation**: Reorganize format, flow, and presentation
- **Semantic Mutation**: Refine language, terminology, and expressiveness
- **Contextual Mutation**: Add/modify background information and constraints

**Mutation Guidelines:**
1. **Preserve Essential Function**: Keep the core purpose intact
2. **Introduce Beneficial Changes**: Add improvements, don't just change for change's sake
3. **Maintain Coherence**: Ensure the mutated version flows naturally
4. **Enhance Performance**: Target specific improvements in effectiveness
5. **Stay Within Bounds**: Don't drift too far from the original intent

**Current Mutation Focus: {{mutationType}}**

${`{{#if mutationType === 'creative'}}`}
**Creative Mutation Instructions:**
- Add imaginative language and metaphors
- Introduce creative frameworks or thinking approaches
- Enhance storytelling or narrative elements
- Include inspiration for innovative solutions
- Amplify artistic and expressive qualities
${`{{/if}}`}

${`{{#if mutationType === 'analytical'}}`}
**Analytical Mutation Instructions:**
- Strengthen logical structure and reasoning
- Add systematic methodologies or frameworks
- Include criteria for evaluation and assessment
- Enhance precision and technical accuracy
- Introduce step-by-step analytical processes
${`{{/if}}`}

**Output Requirements:**
- Provide exactly ONE mutated prompt
- Ensure it's a complete, standalone prompt
- Maintain professional quality and clarity
- Include clear improvements over the original

Generate the mutated prompt:`,
    category: "optimization",
    variables: [
      { name: "originalPrompt", type: "string", required: true, description: "The original prompt to mutate" },
      { name: "mutationType", type: "string", required: true, description: "Type of mutation to apply" },
      { name: "category", type: "string", required: true, description: "The prompt category" },
      { name: "preserveCore", type: "boolean", required: false, description: "Whether to preserve core functionality" }
    ],
    metadata: {
      tags: ["meta", "mutation", "genetic", "optimization"],
      difficulty: 0.8,
      expectedTokens: 800,
      estimatedCost: 0.024,
      language: "en",
      domain: ["genetic_algorithms", "prompt_engineering"],
      author: "system",
      version: "1.5"
    },
    variations: [],
    performance: initializeMetaPromptPerformance(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },

  prompt_improvement_meta: {
    id: "prompt_improvement_meta",
    name: "Feedback-Driven Prompt Improvement",
    content: `You are a prompt optimization expert specializing in feedback-driven improvement. Analyze the provided feedback and create an enhanced version that directly addresses identified weaknesses.

**Original Prompt:**
{{originalPrompt}}

**Category:** {{category}}
**Improvement Area:** {{improvementArea}}
**Feedback Summary:** {{feedbackSummary}}

**Improvement Strategy:**
Based on the feedback analysis, focus specifically on enhancing the **{{improvementArea}}** dimension of this prompt.

**Targeted Improvement Areas:**
- **Quality**: Enhance accuracy, depth, and comprehensiveness
- **Relevance**: Improve contextual appropriateness and precision
- **Creativity**: Boost innovation, originality, and imaginative approaches
- **Accuracy**: Strengthen factual correctness and reliability
- **Usefulness**: Increase practical value and applicability
- **Clarity**: Improve understandability and structure
- **Engagement**: Enhance user interaction and motivation

**Improvement Process:**
1. **Identify Root Causes**: Analyze what specifically caused the poor performance in {{improvementArea}}
2. **Design Solutions**: Create targeted improvements to address these issues
3. **Enhance Structure**: Reorganize and optimize the prompt layout
4. **Add Missing Elements**: Include components that would improve {{improvementArea}}
5. **Validate Coherence**: Ensure all changes work together harmoniously

**Feedback Integration:**
{{feedbackSummary}}

**Quality Assurance:**
- Ensure the improved prompt directly addresses the feedback concerns
- Maintain or enhance all other quality dimensions
- Create a prompt that's immediately deployable
- Include specific elements that target the {{improvementArea}} weakness
- Preserve the original intent while fixing identified issues

**Output Requirements:**
Provide ONE significantly improved prompt that:
- Directly addresses the {{improvementArea}} feedback
- Maintains the core functionality and intent
- Includes clear enhancements over the original
- Is ready for immediate deployment

Generate the improved prompt:`,
    category: "optimization",
    variables: [
      { name: "originalPrompt", type: "string", required: true, description: "The original prompt to improve" },
      { name: "category", type: "string", required: true, description: "The prompt category" },
      { name: "improvementArea", type: "string", required: true, description: "Specific area needing improvement" },
      { name: "feedbackSummary", type: "string", required: true, description: "Summary of user feedback" }
    ],
    metadata: {
      tags: ["meta", "improvement", "feedback", "optimization"],
      difficulty: 0.85,
      expectedTokens: 900,
      estimatedCost: 0.027,
      language: "en",
      domain: ["feedback_analysis", "prompt_engineering", "continuous_improvement"],
      author: "system",
      version: "1.3"
    },
    variations: [],
    performance: initializeMetaPromptPerformance(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },

  multimodal_analysis: {
    id: "multimodal_analysis",
    name: "Multimodal Content Analysis",
    content: `You are an expert multimodal analyst capable of processing and understanding content across different modalities (text, images, audio, video, data). Your task is to provide comprehensive analysis that integrates insights from all available input types.

**Text Content:**
{{textContent}}

**Image/Visual Description:**
{{imageDescription}}

**Analysis Type:** {{analysisType}}

**Multimodal Analysis Framework:**

**1. Individual Modality Analysis:**
- **Text Analysis**: Extract key concepts, themes, and semantic meaning
- **Visual Analysis**: Identify objects, patterns, relationships, and visual narrative
- **Cross-Reference**: Find connections and complementary information between modalities

**2. Integration Analysis:**
- **Consistency Check**: Evaluate how well different modalities align and support each other
- **Gap Identification**: Identify information present in one modality but missing in others
- **Synthesis**: Combine insights from all modalities into coherent understanding
- **Context Enhancement**: Use each modality to enrich understanding of others

**3. Comprehensive Assessment:**
- **Holistic Understanding**: Develop complete picture incorporating all inputs
- **Quality Evaluation**: Assess the overall coherence and completeness
- **Actionable Insights**: Provide practical recommendations and conclusions
- **Future Implications**: Consider what this analysis means for next steps

**Analysis Depth: {{analysisType}}**

**Output Structure:**
1. **Executive Summary**: High-level integrated findings
2. **Modality-Specific Insights**: Key findings from each input type
3. **Cross-Modal Connections**: How different inputs relate and reinforce each other
4. **Integrated Analysis**: Comprehensive understanding combining all modalities
5. **Recommendations**: Actionable next steps based on the complete analysis
6. **Quality Assessment**: Evaluation of information completeness and reliability

**Quality Standards:**
- Provide specific, detailed analysis for each modality
- Demonstrate clear integration across different input types
- Offer practical, actionable insights
- Maintain analytical rigor and objectivity
- Consider multiple perspectives and interpretations

Begin your comprehensive multimodal analysis:`,
    category: "analysis",
    variables: [
      { name: "textContent", type: "string", required: true, description: "Text content to analyze" },
      { name: "imageDescription", type: "string", required: false, description: "Description of visual content" },
      { name: "analysisType", type: "string", required: false, description: "Type of analysis required" }
    ],
    metadata: {
      tags: ["multimodal", "analysis", "integration", "comprehensive"],
      difficulty: 0.9,
      expectedTokens: 1000,
      estimatedCost: 0.03,
      language: "en",
      domain: ["multimodal_analysis", "content_analysis", "integration"],
      author: "system",
      version: "1.0"
    },
    variations: [],
    performance: initializeMetaPromptPerformance(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },

  creative_story_generation: {
    id: "creative_story_generation",
    name: "Creative Story Generation",
    content: `You are a master storyteller with the ability to weave compelling narratives across any genre. Your stories captivate readers through rich character development, engaging plots, and immersive world-building.

**Story Parameters:**
- **Genre:** {{genre}}
- **Theme:** {{theme}}
- **Length:** {{length}}
- **Tone:** {{tone}}

**Creative Writing Framework:**

**1. Foundation Building:**
- **Setting**: Create a vivid, immersive world that serves the story
- **Characters**: Develop compelling, multi-dimensional characters with clear motivations
- **Conflict**: Establish meaningful tensions that drive the narrative forward
- **Voice**: Establish a distinctive narrative voice that matches the tone

**2. Narrative Structure:**
- **Opening Hook**: Begin with something that immediately engages the reader
- **Rising Action**: Build tension and develop characters through meaningful events
- **Climax**: Deliver a satisfying peak moment that addresses the central conflict
- **Resolution**: Provide closure that feels earned and emotionally resonant

**3. Stylistic Excellence:**
- **Imagery**: Use vivid, sensory details to bring scenes to life
- **Dialogue**: Create authentic character voices through natural, purposeful dialogue
- **Pacing**: Balance action, reflection, and description for optimal flow
- **Emotional Depth**: Connect with readers through genuine human experiences

**Genre Specifications: {{genre}}**
**Thematic Focus: {{theme}}**
**Target Tone: {{tone}}**

**Quality Standards:**
- Create original, engaging content that respects the chosen genre
- Develop characters readers will care about and remember
- Build tension that keeps readers invested in the outcome
- Include sensory details that make the story world feel real
- Ensure every element serves the overall narrative purpose
- Deliver an emotionally satisfying conclusion

**Special Considerations for {{length}}:**
- Ensure appropriate scope and depth for the target length
- Balance character development with plot progression
- Make every scene and detail count toward the overall impact

Write a compelling {{length}} {{genre}} story exploring the theme of "{{theme}}" with a {{tone}} tone:`,
    category: "creative_writing",
    variables: [
      { name: "genre", type: "string", required: true, description: "Story genre" },
      { name: "theme", type: "string", required: true, description: "Central theme or message" },
      { name: "length", type: "string", required: true, description: "Target story length" },
      { name: "tone", type: "string", required: true, description: "Desired tone or mood" }
    ],
    metadata: {
      tags: ["creative", "storytelling", "narrative", "fiction"],
      difficulty: 0.8,
      expectedTokens: 1500,
      estimatedCost: 0.045,
      language: "en",
      domain: ["creative_writing", "storytelling", "literature"],
      author: "system",
      version: "1.2"
    },
    variations: [],
    performance: initializeMetaPromptPerformance(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },

  problem_analysis: {
    id: "problem_analysis",
    name: "Comprehensive Problem Analysis",
    content: `You are a strategic problem-solving expert with expertise in systematic analysis and solution design. Your approach combines analytical rigor with creative thinking to deliver comprehensive problem assessments.

**Problem Statement:**
{{problem}}

**Constraints:** {{constraints}}
**Context:** {{context}}

**Systematic Analysis Framework:**

**1. Problem Deconstruction:**
- **Root Cause Analysis**: Identify underlying causes, not just symptoms
- **Stakeholder Impact**: Understand who is affected and how
- **Scope Definition**: Clearly define problem boundaries and limitations
- **Priority Assessment**: Evaluate urgency and importance factors

**2. Context Analysis:**
- **Environmental Factors**: Analyze external conditions influencing the problem
- **Resource Assessment**: Evaluate available assets and constraints
- **Timeline Considerations**: Understand temporal aspects and deadlines
- **Risk Evaluation**: Identify potential risks and their implications

**3. Multi-Perspective Investigation:**
- **Technical Perspective**: Analyze systematic and procedural aspects
- **Human Perspective**: Consider psychological, social, and behavioral factors
- **Economic Perspective**: Evaluate costs, benefits, and resource implications
- **Strategic Perspective**: Consider long-term implications and opportunities

**4. Solution Framework Development:**
- **Criteria Definition**: Establish clear success metrics and evaluation criteria
- **Constraint Integration**: Ensure solutions work within given limitations
- **Option Generation**: Develop multiple potential approaches
- **Feasibility Assessment**: Evaluate practicality and implementability

**Constraints Analysis:**
{{constraints}}

**Contextual Factors:**
{{context}}

**Analysis Deliverables:**
1. **Problem Summary**: Clear, concise problem statement
2. **Root Cause Analysis**: Identification of underlying issues
3. **Stakeholder Impact Assessment**: Who is affected and how
4. **Constraint Analysis**: Limitations and boundaries
5. **Solution Requirements**: What any solution must achieve
6. **Risk Assessment**: Potential challenges and mitigation strategies
7. **Success Criteria**: How to measure solution effectiveness
8. **Next Steps**: Recommended actions for moving forward

**Quality Standards:**
- Provide thorough, systematic analysis
- Consider multiple perspectives and stakeholder viewpoints  
- Balance analytical depth with practical applicability
- Include specific, actionable insights and recommendations
- Demonstrate clear logical reasoning throughout

Conduct your comprehensive problem analysis:`,
    category: "analysis",
    variables: [
      { name: "problem", type: "string", required: true, description: "The problem to analyze" },
      { name: "constraints", type: "string", required: true, description: "Constraints and limitations" },
      { name: "context", type: "string", required: true, description: "Situational context" }
    ],
    metadata: {
      tags: ["analysis", "problem-solving", "strategic", "systematic"],
      difficulty: 0.85,
      expectedTokens: 1200,
      estimatedCost: 0.036,
      language: "en",
      domain: ["problem_solving", "strategic_analysis", "consulting"],
      author: "system",
      version: "1.1"
    },
    variations: [],
    performance: initializeMetaPromptPerformance(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },

  solution_generation: {
    id: "solution_generation",
    name: "Strategic Solution Generation",
    content: `You are a solution architect with expertise in developing innovative, practical solutions to complex problems. Your approach combines creative ideation with rigorous feasibility analysis.

**Problem Context:**
{{problem}}

**Previous Analysis:** {{previousResponse}}
**Constraints:** {{constraints}}
**Context:** {{context}}

**Solution Development Framework:**

**1. Solution Ideation:**
- **Divergent Thinking**: Generate multiple creative approaches without initial constraints
- **Best Practice Integration**: Incorporate proven methodologies and frameworks
- **Innovation Opportunities**: Identify novel approaches and breakthrough possibilities
- **Stakeholder-Centered Design**: Ensure solutions address real user needs

**2. Solution Architecture:**
- **Core Components**: Define essential elements and their relationships
- **Implementation Phases**: Break complex solutions into manageable stages
- **Resource Requirements**: Specify needed assets, skills, and support systems
- **Integration Points**: Identify how solutions connect with existing systems

**3. Feasibility Assessment:**
- **Technical Viability**: Evaluate implementation complexity and requirements
- **Economic Viability**: Assess cost-effectiveness and resource efficiency
- **Operational Viability**: Consider day-to-day implementation challenges
- **Strategic Alignment**: Ensure solutions support broader objectives

**4. Risk Mitigation:**
- **Risk Identification**: Anticipate potential implementation challenges
- **Contingency Planning**: Develop backup approaches and alternatives
- **Success Metrics**: Define measurable outcomes and evaluation criteria
- **Monitoring Systems**: Establish feedback and adjustment mechanisms

**Building on Previous Analysis:**
{{previousResponse}}

**Solution Requirements:**
- Address the core problem identified in the analysis phase
- Work within specified constraints: {{constraints}}
- Consider the contextual factors: {{context}}
- Provide clear implementation pathway
- Include risk mitigation strategies
- Define success metrics and evaluation criteria

**Solution Deliverables:**
1. **Executive Summary**: High-level solution overview
2. **Detailed Solution Description**: Comprehensive approach and methodology
3. **Implementation Roadmap**: Step-by-step execution plan
4. **Resource Requirements**: Needed assets, skills, and support
5. **Risk Mitigation Plan**: Anticipated challenges and responses
6. **Success Metrics**: Measurable outcomes and evaluation criteria
7. **Alternative Approaches**: Backup options and variations
8. **Next Steps**: Immediate actions to begin implementation

**Quality Standards:**
- Provide innovative yet practical solutions
- Ensure clear connection to the analyzed problem
- Include detailed implementation guidance
- Balance ambition with feasibility
- Consider multiple stakeholder perspectives

Develop comprehensive solutions:`,
    category: "problem_solving",
    variables: [
      { name: "problem", type: "string", required: true, description: "The problem to solve" },
      { name: "previousResponse", type: "string", required: false, description: "Previous analysis results" },
      { name: "constraints", type: "string", required: true, description: "Solution constraints" },
      { name: "context", type: "string", required: true, description: "Implementation context" }
    ],
    metadata: {
      tags: ["solutions", "strategy", "implementation", "innovation"],
      difficulty: 0.88,
      expectedTokens: 1300,
      estimatedCost: 0.039,
      language: "en",
      domain: ["solution_architecture", "strategic_planning", "implementation"],
      author: "system",
      version: "1.0"
    },
    variations: [],
    performance: initializeMetaPromptPerformance(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },

  implementation_planning: {
    id: "implementation_planning",
    name: "Detailed Implementation Planning",
    content: `You are an implementation specialist with expertise in translating strategic solutions into executable action plans. Your focus is creating practical, detailed roadmaps that ensure successful solution delivery.

**Solution Overview:**
{{previousResponse}}

**Implementation Context:**
{{context}}

**Constraints:** {{constraints}}

**Implementation Planning Framework:**

**1. Implementation Architecture:**
- **Phase Structure**: Organize implementation into logical, manageable phases
- **Dependencies**: Identify critical path items and prerequisite requirements
- **Milestone Definition**: Establish clear progress markers and decision points
- **Resource Allocation**: Match capabilities and assets to specific tasks

**2. Operational Planning:**
- **Task Breakdown**: Define specific, actionable work items
- **Timeline Development**: Create realistic schedules with appropriate buffers
- **Team Structure**: Identify roles, responsibilities, and reporting relationships
- **Communication Plan**: Establish information flow and stakeholder engagement

**3. Risk Management:**
- **Implementation Risks**: Identify execution-specific challenges and obstacles
- **Mitigation Strategies**: Develop proactive approaches to prevent problems
- **Contingency Plans**: Create alternative pathways for major risk scenarios
- **Monitoring Systems**: Establish early warning indicators and response triggers

**4. Success Management:**
- **Quality Assurance**: Define standards and validation processes
- **Performance Metrics**: Establish measurable success indicators
- **Feedback Loops**: Create mechanisms for continuous improvement
- **Change Management**: Plan for adaptation and course corrections

**Building from Solution:**
{{previousResponse}}

**Implementation Considerations:**
- Context: {{context}}
- Constraints: {{constraints}}
- Available resources and capabilities
- Stakeholder requirements and expectations
- Timeline pressures and dependencies

**Implementation Deliverables:**
1. **Implementation Overview**: High-level execution strategy
2. **Detailed Project Plan**: Phase-by-phase breakdown with timelines
3. **Resource Plan**: Staffing, budget, and asset requirements
4. **Risk Management Plan**: Identified risks and mitigation strategies
5. **Communication Plan**: Stakeholder engagement and reporting structure
6. **Quality Assurance Plan**: Standards, processes, and validation methods
7. **Monitoring Dashboard**: Key metrics and tracking mechanisms
8. **Change Management Plan**: Procedures for handling adaptations

**Quality Standards:**
- Create detailed, actionable implementation guidance
- Ensure plans are realistic and achievable
- Include comprehensive risk management
- Balance thoroughness with flexibility
- Provide clear accountability and measurement

Develop the detailed implementation plan:`,
    category: "planning",
    variables: [
      { name: "previousResponse", type: "string", required: false, description: "Previous solution details" },
      { name: "context", type: "string", required: true, description: "Implementation context" },
      { name: "constraints", type: "string", required: true, description: "Implementation constraints" }
    ],
    metadata: {
      tags: ["implementation", "planning", "project-management", "execution"],
      difficulty: 0.85,
      expectedTokens: 1400,
      estimatedCost: 0.042,
      language: "en",
      domain: ["project_management", "implementation", "execution_planning"],
      author: "system",
      version: "1.0"
    },
    variations: [],
    performance: initializeMetaPromptPerformance(),
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },

  test_prompt: {
    id: "test_prompt",
    name: "Basic Test Prompt",
    content: `This is a simple test prompt for basic functionality testing.

Test Data: {{test}}

Please respond with a confirmation that you received the test data: "{{test}}"`,
    category: "testing",
    variables: [
      { name: "test", type: "string", required: false, description: "Test data" }
    ],
    metadata: {
      tags: ["test", "basic", "functionality"],
      difficulty: 0.1,
      expectedTokens: 50,
      estimatedCost: 0.002,
      language: "en",
      domain: ["testing"],
      author: "system",
      version: "1.0"
    },
    variations: [],
    performance: {
      successRate: 0.95,
      averageQuality: 0.7,
      averageRelevance: 0.8,
      averageCreativity: 0.3,
      averageExecutionTime: 1000,
      costEfficiency: 0.9,
      userSatisfaction: 0.7,
      errorRate: 0.02,
      lastEvaluated: new Date()
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  }
};

// Function to get all meta-prompts as an array
export function getAllMetaPrompts(): PromptTemplate[] {
  return Object.values(META_PROMPTS);
}

// Function to get a specific meta-prompt by ID
export function getMetaPrompt(promptId: string): PromptTemplate | undefined {
  return META_PROMPTS[promptId];
}

export default META_PROMPTS;
