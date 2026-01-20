/**
 * Enhanced LLM - Module Aggregator
 * 
 * Re-exports all enhanced LLM modules for convenient imports.
 * 
 * Module structure (1,059 lines → 8 modules):
 * - types.ts (~75 lines): Core types and interfaces
 * - model-config.ts (~55 lines): Default models and selection
 * - prompt-templates.ts (~130 lines): Audience-specific templates
 * - cost-tracking.ts (~85 lines): Cost calculation and logging
 * - context-enrichment.ts (~140 lines): RAG enrichment
 * - scenario-analysis.ts (~110 lines): Scenarios and ROI
 * - providers.ts (~100 lines): OpenAI and Anthropic generation
 * - enhanced-llm.ts (~270 lines): Main service class
 * - index.ts (~30 lines): This aggregator
 */

export * from "./types.js";
export { defaultModels, getModelConfig } from "./model-config.js";
export { getAudiencePromptTemplate } from "./prompt-templates.js";
export { calculateEstimatedCost, logCostTracking } from "./cost-tracking.js";
export { enrichContextWithRAG, serializeContext, buildCitations } from "./context-enrichment.js";
export { generateScenarios, calculateROI, calculateConfidence, generateFallbackAnalysis } from "./scenario-analysis.js";
export { generateWithOpenAI, generateWithAnthropic } from "./providers.js";
export { EnhancedLLMService, enhancedLLM } from "./enhanced-llm.js";
