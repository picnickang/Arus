import { and, desc, eq, gte } from "drizzle-orm";

import { db } from "../../db-config";
import { insightSnapshots, metricsHistory } from "@shared/schema-runtime";
import type { InsightSnapshot } from "@shared/schema";

export async function getMetricsHistory(
  orgId: string,
  days: number = 7
): Promise<(typeof metricsHistory.$inferSelect)[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return db
    .select()
    .from(metricsHistory)
    .where(and(eq(metricsHistory.orgId, orgId), gte(metricsHistory.recordedAt, cutoffDate)))
    .orderBy(desc(metricsHistory.recordedAt));
}

export async function recordMetricsHistory(record: {
  orgId: string;
  activeDevices: number;
  fleetHealth: number;
  openWorkOrders: number;
  riskAlerts: number;
  totalEquipment: number;
  healthyEquipment: number;
  warningEquipment: number;
  criticalEquipment: number;
}): Promise<typeof metricsHistory.$inferSelect> {
  const [n] = await db
    .insert(metricsHistory)
    .values({
      orgId: record.orgId,
      recordedAt: new Date(),
      activeDevices: record.activeDevices,
      fleetHealth: record.fleetHealth,
      openWorkOrders: record.openWorkOrders,
      riskAlerts: record.riskAlerts,
      totalEquipment: record.totalEquipment,
      healthyEquipment: record.healthyEquipment,
      warningEquipment: record.warningEquipment,
      criticalEquipment: record.criticalEquipment,
    })
    .returning();
  if (!n) {
    throw new Error("Failed to create fleet metric record");
  }
  return n;
}

export async function getLatestInsightSnapshot(
  orgId: string,
  scope: string
): Promise<InsightSnapshot | undefined> {
  const [result] = await db
    .select()
    .from(insightSnapshots)
    .where(and(eq(insightSnapshots.orgId, orgId), eq(insightSnapshots.scope, scope)))
    .orderBy(desc(insightSnapshots.createdAt))
    .limit(1);
  return result;
}
