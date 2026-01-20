/**
 * PdM Services - Analysis Operations
 * Evaluation and asset-specific analysis
 */

import { eq, and, inArray } from "drizzle-orm";
import { pdmBaseline } from "../../shared/schema.js";
import { zScore, severityFromZ, clampSigma } from "../pdm-features.js";
import type { AnalysisResult } from "./types.js";

const MIN_BASELINE_SUPPORT = 20;

/**
 * Evaluate features against established baselines
 */
export async function evaluateAgainstBaseline(
  db: any,
  orgId: string,
  vesselName: string,
  assetId: string,
  assetClass: "bearing" | "pump",
  features: Record<string, number>
): Promise<AnalysisResult> {
  const featureNames = Object.keys(features);

  if (featureNames.length === 0) {
    console.warn(`[PdM Service] No features extracted for ${assetClass} ${assetId}`);
    return {
      features,
      scores: {},
      severity: "info",
      worstZ: 0,
      explanation: {
        type: assetClass,
        baseline_features: 0,
        total_features: 0,
        analysis_method: "No features extracted",
        warning: "Empty feature set",
      },
    };
  }

  console.log(
    `[PdM Service] Evaluating ${featureNames.length} features against baseline for ${assetClass} ${assetId}`
  );

  const baselines = await db
    .select()
    .from(pdmBaseline)
    .where(
      and(
        eq(pdmBaseline.orgId, orgId),
        eq(pdmBaseline.vesselName, vesselName),
        eq(pdmBaseline.assetId, assetId),
        inArray(pdmBaseline.feature, featureNames)
      )
    );

  const baselineMap = new Map(baselines.map((b: any) => [b.feature, b]));
  const scores: Record<string, number> = {};

  for (const [feature, value] of Object.entries(features)) {
    const baseline = baselineMap.get(feature);
    if (baseline?.n >= MIN_BASELINE_SUPPORT) {
      scores[feature] = clampSigma(zScore(baseline.mu, baseline.sigma, value));
    }
  }

  const worstZ = Object.values(scores).reduce((max, z) => Math.max(max, Math.abs(z)), 0);
  const severity = severityFromZ(worstZ);

  return {
    features,
    scores,
    severity,
    worstZ,
    explanation: {
      type: assetClass,
      baseline_features: baselines.filter((b: any) => b.n >= MIN_BASELINE_SUPPORT).length,
      total_features: featureNames.length,
      analysis_method: "Statistical baseline μ±kσ with Welford updates",
      min_support: MIN_BASELINE_SUPPORT,
    },
  };
}

/**
 * Generate LLM explanation with timeout
 */
export async function generateLLMExplanation(params: {
  assetId: string;
  vesselName: string;
  features: Record<string, number>;
  scores: Record<string, number>;
  severity: string;
  worstZ: number;
  dataSources: Record<string, number>;
}): Promise<string | null> {
  const LLM_TIMEOUT_MS = 5000;

  try {
    const { generatePumpAnalysisExplanation } = await import("../openai");

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), LLM_TIMEOUT_MS)
    );

    const llmPromise = generatePumpAnalysisExplanation({
      assetId: params.assetId,
      vesselName: params.vesselName,
      features: params.features,
      scores: params.scores,
      severity: params.severity as any,
      worstZ: params.worstZ,
      dataSources: params.dataSources,
    });

    return Promise.race([llmPromise, timeoutPromise]);
  } catch (error) {
    console.warn(`Failed to generate LLM explanation for ${params.assetId}:`, error);
    return null;
  }
}
