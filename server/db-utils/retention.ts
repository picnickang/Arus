/**
 * Database Utils - Retention Management
 * Telemetry retention policy management
 */

import { db } from "../db.js";
import { telemetryRetentionPolicies, equipmentTelemetry } from "@shared/schema.js";
import { eq, lt } from "drizzle-orm";

export async function applyTelemetryRetention(): Promise<{
  success: boolean;
  deletedRecords: number;
  message: string;
}> {
  try {
    const policies = await db
      .select()
      .from(telemetryRetentionPolicies)
      .where(eq(telemetryRetentionPolicies.id, 1));
    if (policies.length === 0) {
      return {
        success: false,
        deletedRecords: 0,
        message: "No retention policy found. Create a policy first.",
      };
    }

    const policy = policies[0];
    const retentionDays = policy.retentionDays ?? 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await db.delete(equipmentTelemetry).where(lt(equipmentTelemetry.ts, cutoffDate));
    const deletedRecords = result.rowCount ?? 0;

    return {
      success: true,
      deletedRecords,
      message: `Successfully deleted ${deletedRecords} telemetry records older than ${retentionDays} days`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      deletedRecords: 0,
      message: `Failed to apply retention policy: ${message}`,
    };
  }
}

export async function getRetentionPolicy(): Promise<{
  retentionDays: number;
  rollupEnabled: boolean;
  compressionEnabled: boolean;
} | null> {
  try {
    const policies = await db
      .select()
      .from(telemetryRetentionPolicies)
      .where(eq(telemetryRetentionPolicies.id, 1));
    if (policies.length === 0) {
      return null;
    }
    const policy = policies[0];
    return {
      retentionDays: policy.retentionDays ?? 365,
      rollupEnabled: policy.rollupEnabled ?? false,
      compressionEnabled: policy.compressionEnabled ?? false,
    };
  } catch {
    return null;
  }
}

export async function updateRetentionPolicy(
  retentionDays: number,
  rollupEnabled: boolean = true,
  compressionEnabled: boolean = false
): Promise<{ success: boolean; message: string }> {
  try {
    await db
      .insert(telemetryRetentionPolicies)
      .values({ id: 1, retentionDays, rollupEnabled, compressionEnabled, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: telemetryRetentionPolicies.id,
        set: { retentionDays, rollupEnabled, compressionEnabled, updatedAt: new Date() },
      });
    return {
      success: true,
      message: `Retention policy updated: ${retentionDays} days retention, rollup ${rollupEnabled ? "enabled" : "disabled"}, compression ${compressionEnabled ? "enabled" : "disabled"}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to update retention policy: ${message}`,
    };
  }
}
