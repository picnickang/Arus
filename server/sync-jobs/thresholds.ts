/**
 * Sync Jobs - Sensor Threshold Conflicts Check
 */

import { db } from "../db.js";
import { sensorThresholds } from "@shared/schema.js";
import { eq, sql, and } from "drizzle-orm";
import type { CheckResult } from "./types.js";

/**
 * Check for multiple active sensor thresholds for the same device/sensor combination
 */
export async function checkSensorThresholdConflicts(orgId: string): Promise<CheckResult> {
  const issues: CheckResult["issues"] = [];

  try {
    const conflicts = await db
      .select({
        deviceId: sensorThresholds.deviceId,
        sensorType: sensorThresholds.sensorType,
        count: sql<number>`count(*)`,
      })
      .from(sensorThresholds)
      .where(and(eq(sensorThresholds.orgId, orgId), eq(sensorThresholds.isActive, true)))
      .groupBy(sensorThresholds.deviceId, sensorThresholds.sensorType)
      .having(sql`count(*) > 1`);

    for (const conflict of conflicts) {
      issues.push({
        code: "MULTIPLE_ACTIVE_THRESHOLDS",
        message: `Multiple active thresholds (${conflict.count}) found for device ${conflict.deviceId}, sensor ${conflict.sensorType}`,
        severity: "medium",
        reference: {
          deviceId: conflict.deviceId,
          sensorType: conflict.sensorType,
          activeCount: conflict.count,
        },
      });
    }

    const entitiesChecked = await db
      .select({ count: sql<number>`count(*)` })
      .from(sensorThresholds)
      .where(and(eq(sensorThresholds.orgId, orgId), eq(sensorThresholds.isActive, true)))
      .then((r) => r[0]?.count || 0);

    return { issues, entitiesChecked };
  } catch (error) {
    console.error("Sensor threshold conflict check failed:", error);
    return {
      issues: [
        {
          code: "THRESHOLD_CONFLICT_CHECK_ERROR",
          message: `Failed to check sensor threshold conflicts: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "high",
        },
      ],
      entitiesChecked: 0,
    };
  }
}
