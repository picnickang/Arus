/**
 * LLM Overview Generation
 *
 * Generate AI-powered and fallback overview summaries.
 */

import { dbSystemAdminStorage } from "../repositories";
import { analyzeInsightBundle } from "../openai";
import type { InsightBundle } from "./types.js";

/**
 * Generate LLM overview using existing OpenAI integration
 */
export async function llmOverview(bundle: InsightBundle): Promise<string> {
  try {
    const settings = await dbSystemAdminStorage.getSettings();
    if (!settings?.llmEnabled) {
      return generateFallbackOverview(bundle);
    }

    const analysisData = {
      fleet_kpi: bundle.kpi.fleet,
      vessel_metrics: bundle.kpi.perVessel,
      risks: bundle.risks,
      recommendations: bundle.recommendations,
      anomalies: bundle.anomalies,
      compliance_notes: bundle.compliance.notes,
    };

    const overview = await analyzeInsightBundle(analysisData);
    return overview || generateFallbackOverview(bundle);
  } catch (error) {
    console.error("LLM overview generation failed:", error);
    return generateFallbackOverview(bundle);
  }
}

/**
 * Generate fallback overview without LLM
 */
export function generateFallbackOverview(bundle: InsightBundle): string {
  const { kpi, risks, recommendations } = bundle;

  const staleVessels =
    kpi.fleet.latestGapVessels.length > 0
      ? `**Stale telemetry**: ${kpi.fleet.latestGapVessels.join(", ")}`
      : "No stale telemetry detected.";

  return [
    "# Fleet Insights Overview",
    "",
    "## Fleet Status",
    `- Vessels: ${kpi.fleet.vessels}`,
    `- Mapped signals: ${kpi.fleet.signalsMapped}`,
    `- Discovered signals: ${kpi.fleet.signalsDiscovered}`,
    `- Data quality events (7d): ${kpi.fleet.dq7d}`,
    "",
    "## Connectivity Status",
    staleVessels,
    "",
    "## Risk Assessment",
    ...risks.critical.map((r) => `⚠️ **CRITICAL**: ${r}`),
    ...risks.warnings.map((r) => `⚠️ Warning: ${r}`),
    "",
    "## Recommendations",
    ...recommendations.map((r) => `- ${r}`),
    "",
    `*Analysis generated: ${new Date().toISOString()}*`,
  ].join("\n");
}
