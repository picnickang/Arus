/**
 * Insights Snapshot Job Processor
 */

import { computeInsights, persistSnapshot } from "../insights-engine";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("JobProcessors:InsightsProcessor");

export async function processInsightsSnapshotGeneration(data: {
  orgId: string;
  scope?: string;
}): Promise<any> {
  try {
    const { orgId, scope = "fleet" } = data;

    logger.info(`[Insights] Generating snapshot for org: ${orgId}, scope: ${scope}`);

    const insights = await computeInsights(scope, orgId);
    const snapshot = await persistSnapshot(scope, insights, orgId);

    logger.info(`[Insights] Snapshot generated successfully: ${snapshot.id}`);

    const ins = insights as {
      kpi?: unknown;
      riskFactors?: unknown;
      summary?: unknown;
    };
    return {
      snapshotId: snapshot.id,
      scope,
      kpis: ins.kpi,
      riskFactors: ins.riskFactors,
      summary: ins.summary,
    };
  } catch (error) {
    logger.error("[Insights] Snapshot generation failed:", undefined, error);
    throw error;
  }
}
