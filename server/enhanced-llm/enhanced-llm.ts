/**
 * Enhanced LLM Service
 * 
 * Main service class for generating AI-powered reports and analysis.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";
import { db } from "../db";
import { reportContextBuilder, type ReportContext } from "../report-context";
import type {
  ModelConfig,
  EnhancedAnalysisOutput,
  PromptTemplate,
  CostTrackingContext,
  Audience,
  ReportOptions,
} from "./types.js";
import { getModelConfig } from "./model-config.js";
import { getAudiencePromptTemplate } from "./prompt-templates.js";
import { logCostTracking } from "./cost-tracking.js";
import { enrichContextWithRAG, serializeContext, buildCitations } from "./context-enrichment.js";
import { generateScenarios, calculateROI, calculateConfidence, generateFallbackAnalysis } from "./scenario-analysis.js";
import { generateWithOpenAI, generateWithAnthropic } from "./providers.js";

export class EnhancedLLMService {
  private openaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;

  constructor() {
    this.initializeClients();
  }

  private async initializeClients(): Promise<void> {
    try {
      if (!db) {
        console.warn("[Enhanced LLM] Disabled: database not initialized (embedded/local mode)");
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
          this.openaiClient = new OpenAI({ apiKey: openaiKey, timeout: 60000 });
        }

        if (process.env.ANTHROPIC_API_KEY) {
          this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        }
        return;
      }

      const settings = await storage.getSettings();
      const openaiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY;

      if (openaiKey) {
        this.openaiClient = new OpenAI({ apiKey: openaiKey, timeout: 60000 });
      }

      if (process.env.ANTHROPIC_API_KEY) {
        this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      }
    } catch (error) {
      console.warn("[Enhanced LLM] Error initializing clients:", error);
    }
  }

  async generateVesselHealthReport(
    vesselId: string,
    audience: Audience,
    options: ReportOptions = {}
  ): Promise<EnhancedAnalysisOutput> {
    const startTime = Date.now();

    const context = await reportContextBuilder.buildVesselHealthContext(vesselId, "default-org", {
      includeIntelligence: true,
      includePredictions: true,
      includeKnowledge: true,
      audience,
      timeframeDays: 30,
    });

    const promptTemplate = getAudiencePromptTemplate(audience, "health");
    const modelConfig = this.resolveModelConfig(options.modelPreference);
    const enrichedContext = enrichContextWithRAG(context);

    const costContext: CostTrackingContext = {
      orgId: "default-org-id",
      requestType: "report_generation",
      reportType: "health",
      audience,
      vesselId,
    };

    const analysis = await this.generateWithModel(enrichedContext, promptTemplate, modelConfig, costContext);
    const scenarios = options.includeScenarios ? await generateScenarios(context, modelConfig) : undefined;
    const roi = options.includeROI ? await calculateROI(context, scenarios) : undefined;
    const citations = buildCitations(context, enrichedContext);

    return {
      analysis,
      confidence: calculateConfidence(context, analysis),
      scenarios,
      roi,
      citations,
      metadata: {
        model: modelConfig.model,
        provider: modelConfig.provider,
        processingTime: Date.now() - startTime,
      },
    };
  }

  async generateFleetSummaryReport(
    audience: Audience,
    options: ReportOptions = {}
  ): Promise<EnhancedAnalysisOutput> {
    const startTime = Date.now();

    const context = await reportContextBuilder.buildFleetSummaryContext("default-org", {
      includeIntelligence: true,
      includePredictions: true,
      includeKnowledge: true,
      audience,
      timeframeDays: 30,
    });

    const promptTemplate = getAudiencePromptTemplate(audience, "fleet_summary");
    const modelConfig = this.resolveModelConfig(options.modelPreference);
    const enrichedContext = enrichContextWithRAG(context);

    const costContext: CostTrackingContext = {
      orgId: "default-org-id",
      requestType: "report_generation",
      reportType: "fleet",
      audience,
    };

    const analysis = await this.generateWithModel(enrichedContext, promptTemplate, modelConfig, costContext);
    const scenarios = options.includeScenarios ? await generateScenarios(context, modelConfig) : undefined;
    const roi = options.includeROI ? await calculateROI(context, scenarios) : undefined;
    const citations = buildCitations(context, enrichedContext);

    return {
      analysis,
      confidence: calculateConfidence(context, analysis),
      scenarios,
      roi,
      citations,
      metadata: {
        model: modelConfig.model,
        provider: modelConfig.provider,
        processingTime: Date.now() - startTime,
      },
    };
  }

  async generateMaintenanceReport(
    vesselId: string | undefined,
    audience: Audience,
    options: ReportOptions = {}
  ): Promise<EnhancedAnalysisOutput> {
    const startTime = Date.now();

    const context = await reportContextBuilder.buildMaintenanceContext(vesselId, "default-org", {
      includeIntelligence: true,
      includeKnowledge: true,
      audience,
      timeframeDays: 90,
    });

    const promptTemplate = getAudiencePromptTemplate(audience, "maintenance");
    const modelConfig = this.resolveModelConfig(options.modelPreference);
    const enrichedContext = enrichContextWithRAG(context);

    const costContext: CostTrackingContext = {
      orgId: "default-org-id",
      requestType: "report_generation",
      reportType: "maintenance",
      audience,
    };

    const analysis = await this.generateWithModel(enrichedContext, promptTemplate, modelConfig, costContext);
    const scenarios = options.includeScenarios ? await generateScenarios(context, modelConfig) : undefined;
    const citations = buildCitations(context, enrichedContext);

    return {
      analysis,
      confidence: calculateConfidence(context, analysis),
      scenarios,
      citations,
      metadata: {
        model: modelConfig.model,
        provider: modelConfig.provider,
        processingTime: Date.now() - startTime,
      },
    };
  }

  async generateComplianceReport(
    vesselId: string | undefined,
    audience: Audience,
    options: ReportOptions = {}
  ): Promise<EnhancedAnalysisOutput> {
    const startTime = Date.now();

    const context = await reportContextBuilder.buildComplianceContext(vesselId, "default-org", {
      includeKnowledge: true,
      audience,
      timeframeDays: 90,
    });

    const promptTemplate = getAudiencePromptTemplate(audience, "compliance");
    const modelConfig = this.resolveModelConfig(options.modelPreference);
    const enrichedContext = enrichContextWithRAG(context);

    const costContext: CostTrackingContext = {
      orgId: "default-org-id",
      requestType: "report_generation",
      reportType: "compliance",
      audience,
    };

    const analysis = await this.generateWithModel(enrichedContext, promptTemplate, modelConfig, costContext);
    const citations = buildCitations(context, enrichedContext);

    return {
      analysis,
      confidence: calculateConfidence(context, analysis),
      citations,
      metadata: {
        model: modelConfig.model,
        provider: modelConfig.provider,
        processingTime: Date.now() - startTime,
      },
    };
  }

  private resolveModelConfig(preference?: string): ModelConfig {
    return getModelConfig(preference, !!this.openaiClient, !!this.anthropicClient);
  }

  private async generateWithModel(
    context: ReportContext,
    promptTemplate: PromptTemplate,
    modelConfig: ModelConfig,
    costContext: CostTrackingContext
  ): Promise<string> {
    const contextStr = serializeContext(context);
    const userPrompt = promptTemplate.userPromptTemplate.replace("{context}", contextStr);
    const startTime = Date.now();

    try {
      let result: string;

      if (modelConfig.provider === "openai") {
        if (!this.openaiClient) { throw new Error("OpenAI client not initialized"); }
        result = await generateWithOpenAI(
          this.openaiClient,
          promptTemplate.systemPrompt,
          userPrompt,
          modelConfig,
          promptTemplate,
          costContext,
          startTime
        );
      } else if (modelConfig.provider === "anthropic") {
        if (!this.anthropicClient) { throw new Error("Anthropic client not initialized"); }
        result = await generateWithAnthropic(
          this.anthropicClient,
          promptTemplate.systemPrompt,
          userPrompt,
          modelConfig,
          costContext,
          startTime
        );
      } else {
        throw new Error(`Unsupported provider: ${modelConfig.provider}`);
      }

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      await logCostTracking({
        ...costContext,
        provider: modelConfig.provider,
        model: modelConfig.model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      console.error(`[Enhanced LLM] Error with ${modelConfig.provider}/${modelConfig.model}:`, error);

      if (modelConfig.fallbackModel) {
        return this.generateWithModel(context, promptTemplate, modelConfig.fallbackModel, {
          ...costContext,
          requestType: `${costContext.requestType}_fallback`,
        });
      }

      return generateFallbackAnalysis(context);
    }
  }
}

export const enhancedLLM = new EnhancedLLMService();
