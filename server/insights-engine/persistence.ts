/**
 * Insights Persistence
 *
 * Store and retrieve insight snapshots.
 */

import { analyticsInsightsAdapter, dbAnalyticsStorage } from "../repositories";
import type { InsightSnapshot, InsertInsightSnapshot } from "@shared/schema";
import type { InsightBundle } from "./types.js";
import { computeInsights } from "./compute-fleet-kpi.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("InsightsEngine:Persistence");

/**
 * Persist insight snapshot to database
 */
export async function persistSnapshot(
  scope: "fleet" | string,
  bundle: InsightBundle,
  orgId: string = "default-org-id"
): Promise<{ id: string; createdAt: Date }> {
  try {
    const insertData: InsertInsightSnapshot = {
      orgId,
      scope,
      kpi: bundle.kpi,
      risks: bundle.risks,
      recommendations: bundle.recommendations,
      anomalies: bundle.anomalies,
      compliance: bundle.compliance,
    } as any;

    const snapshot = await analyticsInsightsAdapter.createInsightSnapshot(orgId, insertData);
    return { id: snapshot.id, createdAt: snapshot.createdAt as any };
  } catch (error) {
    logger.error("Failed to persist insight snapshot:", undefined, error);
    logger.error("Bundle data that failed:", undefined, JSON.stringify(
        {
          scope,
          orgId,
          bundleStructure: {
            hasKpi: !!bundle.kpi,
            hasRisks: !!bundle.risks,
            hasRecommendations: !!bundle.recommendations,
            hasAnomalies: !!bundle.anomalies,
            hasCompliance: !!bundle.compliance,
          },
        },
        null,
        2
      ));
    throw new Error("Snapshot persistence failed");
  }
}

/**
 * Get latest insight snapshot
 */
export async function getLatestSnapshot(
  scope: "fleet" | string,
  orgId: string = "default-org-id"
): Promise<InsightSnapshot | null> {
  try {
    return (await dbAnalyticsStorage.getLatestInsightSnapshot(orgId, scope)) ?? null;
  } catch (error) {
    logger.error("Failed to get latest snapshot:", undefined, error);
    return null;
  }
}

/**
 * Compute and persist daily fleet snapshot (cron-safe)
 */
export async function generateDailySnapshot(orgId: string = "default-org-id"): Promise<void> {
  try {
    const bundle = await computeInsights("fleet", orgId);
    await persistSnapshot("fleet", bundle, orgId);
  } catch (error) {
    logger.error("[Insights] Daily snapshot failed:", undefined, error);
    throw error;
  }
}
