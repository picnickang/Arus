/**
 * Sync Jobs - Daily Metrics and Summary
 */

import { db } from "../db.js";
import { dailyMetricRollups } from "@shared/schema.js";
import type { ReconciliationResult } from "./types.js";

/**
 * Create or update a daily metric rollup
 */
export async function rollupDailyMetric(
  orgId: string,
  date: string,
  vesselId: string | null,
  deviceId: string | null,
  metricName: string,
  value: number,
  unit?: string,
  aggregationType: "sum" | "avg" | "min" | "max" | "count" = "sum",
  dataQuality: number = 1
): Promise<void> {
  try {
    await db
      .insert(dailyMetricRollups)
      .values({
        date,
        orgId,
        vesselId,
        deviceId,
        metricName,
        value,
        unit,
        aggregationType,
        dataQuality,
      })
      .onConflictDoUpdate({
        target: [
          dailyMetricRollups.date,
          dailyMetricRollups.orgId,
          dailyMetricRollups.vesselId,
          dailyMetricRollups.deviceId,
          dailyMetricRollups.metricName,
        ],
        set: {
          value,
          unit,
          aggregationType,
          dataQuality,
          calculatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("Failed to create daily metric rollup:", error);
    throw error;
  }
}

/**
 * Get recent reconciliation summary for dashboard
 */
export async function getReconciliationSummary(
  orgId: string,
  reconcileAllFn: (orgId: string) => Promise<ReconciliationResult>
): Promise<{
  lastRun: Date | null;
  totalIssues: number;
  criticalIssues: number;
  recentActivity: string[];
}> {
  try {
    const quickResult = await reconcileAllFn(orgId);

    return {
      lastRun: quickResult.timestamp,
      totalIssues: quickResult.stats.totalIssues,
      criticalIssues: quickResult.stats.criticalIssues,
      recentActivity: quickResult.issues
        .slice(0, 5)
        .map((issue) => `${issue.code}: ${issue.message}`),
    };
  } catch (error) {
    console.error("Failed to get reconciliation summary:", error);
    return {
      lastRun: null,
      totalIssues: 0,
      criticalIssues: 0,
      recentActivity: ["Failed to load reconciliation data"],
    };
  }
}
