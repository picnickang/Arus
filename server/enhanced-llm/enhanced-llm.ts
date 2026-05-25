/**
 * Enhanced LLM Service
 *
 * Main service class for generating AI-powered reports and analysis.
 */

import Anthropic from "@anthropic-ai/sdk";
import { dbSystemAdminStorage } from "../repositories";
import { db } from "../db";
import { reportContextBuilder, type ReportContext } from "../report-context";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("EnhancedLlm:EnhancedLlm");
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
import {
  generateScenarios,
  calculateROI,
  calculateConfidence,
  generateFallbackAnalysis,
} from "./scenario-analysis.js";
import { generateWithOpenAI, generateWithAnthropic } from "./providers.js";

export class EnhancedLLMService {
  private openaiEnabled: boolean = false;
  private anthropicClient: Anthropic | null = null;

  constructor() {
    this.initializeClients();
  }

  private async initializeClients(): Promise<void> {
    try {
      if (!db) {
        logger.warn("[Enhanced LLM] Disabled: database not initialized (embedded/local mode)");
        this.openaiEnabled = Boolean(process.env['OPENAI_API_KEY']);

        if (process.env['ANTHROPIC_API_KEY']) {
          this.anthropicClient = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
        }
        return;
      }

      const settings = await dbSystemAdminStorage.getSettings();
      this.openaiEnabled = Boolean(settings?.openaiApiKey || process.env['OPENAI_API_KEY']);

      if (process.env['ANTHROPIC_API_KEY']) {
        this.anthropicClient = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });
      }
    } catch (error) {
      logger.warn("[Enhanced LLM] Error initializing clients:", { details: error });
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
      timeframeDays: options.timeframeDays || 30,
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

    const analysis = await this.generateWithModel(
      enrichedContext,
      promptTemplate,
      modelConfig,
      costContext
    );
    const scenarios = options.includeScenarios
      ? await generateScenarios(context, modelConfig)
      : undefined;
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
      timeframeDays: options.timeframeDays || 30,
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

    const analysis = await this.generateWithModel(
      enrichedContext,
      promptTemplate,
      modelConfig,
      costContext
    );
    const scenarios = options.includeScenarios
      ? await generateScenarios(context, modelConfig)
      : undefined;
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
      timeframeDays: options.timeframeDays || 90,
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

    const analysis = await this.generateWithModel(
      enrichedContext,
      promptTemplate,
      modelConfig,
      costContext
    );
    const scenarios = options.includeScenarios
      ? await generateScenarios(context, modelConfig)
      : undefined;
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
      timeframeDays: options.timeframeDays || 90,
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

    const analysis = await this.generateWithModel(
      enrichedContext,
      promptTemplate,
      modelConfig,
      costContext
    );
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
    return getModelConfig(preference, this.openaiEnabled, !!this.anthropicClient);
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
        if (!this.openaiEnabled) {
          throw new Error("OpenAI is not configured. Please set up your API key.");
        }
        result = await generateWithOpenAI(
          promptTemplate.systemPrompt,
          userPrompt,
          modelConfig,
          promptTemplate,
          costContext,
          startTime
        );
      } else if (modelConfig.provider === "anthropic") {
        if (!this.anthropicClient) {
          throw new Error("Anthropic client not initialized");
        }
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

      logger.error(`[Enhanced LLM] Error with ${modelConfig.provider}/${modelConfig.model}:`, undefined, error);

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
