/**
 * Condition Log Service - Query Functions
 */

import { db } from "../../db";
import { conditionLogSummary } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { VesselConditionSummary } from "./types.js";

export async function getConditionLogHistory(
  orgId: string,
  equipmentId: string,
  startDate: Date,
  endDate: Date,
  limit?: number
) {
  let query = db
    .select()
    .from(conditionLogSummary)
    .where(
      and(
        eq(conditionLogSummary.orgId, orgId),
        eq(conditionLogSummary.equipmentId, equipmentId),
        gte(conditionLogSummary.periodStart, startDate),
        lte(conditionLogSummary.periodEnd, endDate)
      )
    )
    .orderBy(conditionLogSummary.periodStart);

  if (limit) {
    query = query.limit(limit) as typeof query;
  }

  return query;
}

export async function getVesselConditionSummary(
  orgId: string,
  vesselId: string,
  startDate: Date,
  endDate: Date
): Promise<VesselConditionSummary> {
  const summary = await db
    .select({
      equipmentCount: sql<number>`count(DISTINCT ${conditionLogSummary.equipmentId})`,
      avgHealth: sql<number>`avg(${conditionLogSummary.healthIndex})`,
      minHealth: sql<number>`min(${conditionLogSummary.healthIndex})`,
      totalAlerts: sql<number>`sum(${conditionLogSummary.alertsCount})`,
      criticalAlerts: sql<number>`sum(${conditionLogSummary.criticalAlertsCount})`,
    })
    .from(conditionLogSummary)
    .where(
      and(
        eq(conditionLogSummary.orgId, orgId),
        eq(conditionLogSummary.vesselId, vesselId),
        gte(conditionLogSummary.periodStart, startDate),
        lte(conditionLogSummary.periodEnd, endDate)
      )
    );

  const gradeBreakdown = await db
    .select({
      grade: conditionLogSummary.healthGrade,
      count: sql<number>`count(DISTINCT ${conditionLogSummary.equipmentId})`,
    })
    .from(conditionLogSummary)
    .where(
      and(
        eq(conditionLogSummary.orgId, orgId),
        eq(conditionLogSummary.vesselId, vesselId),
        gte(conditionLogSummary.periodStart, startDate),
        lte(conditionLogSummary.periodEnd, endDate)
      )
    )
    .groupBy(conditionLogSummary.healthGrade);

  const equipmentByGrade: Record<string, number> = {};
  for (const row of gradeBreakdown) {
    if (row.grade) {
      equipmentByGrade[row.grade] = row.count;
    }
  }

  const data = summary[0];
  return {
    equipmentCount: data?.equipmentCount || 0,
    avgHealthIndex: data?.avgHealth || 0,
    minHealthIndex: data?.minHealth || 0,
    totalAlerts: data?.totalAlerts || 0,
    criticalAlerts: data?.criticalAlerts || 0,
    equipmentByGrade,
  };
}
