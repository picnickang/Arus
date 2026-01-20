/**
 * Insights Snapshot Job Processor
 */

import { computeInsights, persistSnapshot } from "../insights-engine";

export async function processInsightsSnapshotGeneration(data: {
  orgId: string;
  scope?: string;
}): Promise<any> {
  try {
    const { orgId, scope = "fleet" } = data;

    console.log(`[Insights] Generating snapshot for org: ${orgId}, scope: ${scope}`);

    const insights = await computeInsights(scope, orgId);
    const snapshot = await persistSnapshot(scope, insights, orgId);

    console.log(`[Insights] Snapshot generated successfully: ${snapshot.id}`);

    return {
      snapshotId: snapshot.id,
      scope,
      kpis: insights.kpis,
      riskFactors: insights.riskFactors,
      summary: insights.summary,
    };
  } catch (error) {
    console.error("[Insights] Snapshot generation failed:", error);
    throw error;
  }
}
