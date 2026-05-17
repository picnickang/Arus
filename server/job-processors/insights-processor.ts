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

    return {
      snapshotId: snapshot.id,
      scope,
      kpis: (insights as any).kpi,
      riskFactors: (insights as any).riskFactors,
      summary: (insights as any).summary,
    };
  } catch (error) {
    logger.error("[Insights] Snapshot generation failed:", undefined, error);
    throw error;
  }
}
