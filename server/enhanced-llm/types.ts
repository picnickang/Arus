/**
 * Enhanced LLM - Types
 * 
 * Core types and interfaces for the enhanced LLM service.
 */

export interface ModelConfig {
  provider: "openai" | "anthropic";
  model: string;
  maxTokens?: number;
  temperature?: number;
  fallbackModel?: ModelConfig;
}

export interface EnhancedAnalysisOutput {
  analysis: string;
  confidence: number;
  scenarios?: {
    scenario: string;
    probability: number;
    impact: "low" | "medium" | "high" | "critical";
    recommendations: string[];
  }[];
  roi?: {
    estimatedSavings: number;
    investmentRequired: number;
    paybackPeriod: number;
    riskReduction: number;
  };
  citations: {
    source: string;
    relevance: number;
    snippet: string;
  }[];
  metadata: {
    model: string;
    provider: string;
    processingTime: number;
    tokensUsed?: number;
  };
}

export interface PromptTemplate {
  systemPrompt: string;
  userPromptTemplate: string;
  fewShotExamples?: { input: string; output: string }[];
  chainOfThought?: boolean;
}

export interface CostTrackingContext {
  orgId: string;
  requestType: string;
  reportType?: string;
  audience?: string;
  vesselId?: string;
  equipmentId?: string;
}

export interface CostTrackingParams extends CostTrackingContext {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  fallbackUsed?: boolean;
  fallbackModel?: string;
}

export type Audience = "executive" | "technical" | "maintenance" | "compliance";

export interface ReportOptions {
  includeScenarios?: boolean;
  includeROI?: boolean;
  modelPreference?: string;
}
