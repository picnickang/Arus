/**
 * Enhanced LLM - Cost Tracking
 * 
 * LLM usage cost calculation and database logging.
 */

import { db } from "../db";
import { llmCostTracking } from "@shared/schema-runtime";
import { nanoid } from "nanoid";
import type { CostTrackingParams } from "./types.js";

/**
 * Calculate estimated cost based on model and token usage
 * Pricing as of 2025 (per 1M tokens)
 */
export function calculateEstimatedCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    // OpenAI pricing (per 1M tokens)
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    o1: { input: 15, output: 60 },
    "o1-mini": { input: 3, output: 12 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },

    // Anthropic pricing (per 1M tokens)
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
    "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
    "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
    "claude-3-opus-20240229": { input: 15, output: 75 },
  };

  const modelPricing = pricing[model] || { input: 1, output: 5 };

  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

  return inputCost + outputCost;
}

/**
 * Log LLM cost tracking to database
 */
export async function logCostTracking(params: CostTrackingParams): Promise<void> {
  try {
    const totalTokens = params.inputTokens + params.outputTokens;
    const estimatedCost = calculateEstimatedCost(
      params.provider,
      params.model,
      params.inputTokens,
      params.outputTokens
    );

    await db.insert(llmCostTracking).values({
      orgId: params.orgId,
      requestId: nanoid(),
      provider: params.provider,
      model: params.model,
      requestType: params.requestType,
      reportType: params.reportType,
      audience: params.audience,
      vesselId: params.vesselId,
      equipmentId: params.equipmentId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens,
      estimatedCost,
      actualCost: null,
      latencyMs: params.latencyMs,
      success: params.success,
      errorMessage: params.errorMessage,
      fallbackUsed: params.fallbackUsed || false,
      fallbackModel: params.fallbackModel,
    });
  } catch (error) {
    console.error("[LLM Cost] Failed to log cost tracking:", error);
  }
}
