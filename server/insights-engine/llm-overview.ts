/**
 * LLM Overview Generation
 *
 * Generate AI-powered and fallback overview summaries.
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("InsightsEngine:LlmOverview");
import { dbSystemAdminStorage } from "../repositories";
// analyzeInsightBundle was removed during the openai gateway migration; we now fall back to the local summary.
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

    return generateFallbackOverview(bundle);
  } catch (error) {
    logger.error("LLM overview generation failed:", undefined, error);
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
