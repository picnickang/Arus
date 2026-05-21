/**
 * Condition Log Service - Data Aggregation
 */

import { db } from "../../db";
import {
  vibrationFeatures,
  vibrationAnalysis,
  conditionMonitoring,
  alertNotifications,
  equipment,
} from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { VibrationAggregation, ConditionAggregation } from "./types.js";

export async function aggregateVibrationData(
  orgId: string,
  equipmentId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<VibrationAggregation | null> {
  const features = await db
    .select({
      rmsAvg: sql<number>`avg(${vibrationFeatures.rms})`,
      rmsMax: sql<number>`max(${vibrationFeatures.rms})`,
      rmsMin: sql<number>`min(${vibrationFeatures.rms})`,
      peakAvg: sql<number>`avg(${vibrationFeatures.rms} * coalesce(${vibrationFeatures.crestFactor}, 1))`,
      peakMax: sql<number>`max(${vibrationFeatures.rms} * coalesce(${vibrationFeatures.crestFactor}, 1))`,
      crestFactor: sql<number>`avg(${vibrationFeatures.crestFactor})`,
      kurtosis: sql<number>`avg(${vibrationFeatures.kurtosis})`,
    })
    .from(vibrationFeatures)
    .where(
      and(
        eq(vibrationFeatures.orgId, orgId),
        eq(vibrationFeatures.equipmentId, equipmentId),
        gte(vibrationFeatures.timestamp, periodStart),
        lte(vibrationFeatures.timestamp, periodEnd)
      )
    );

  const analyses = await db
    .select({ id: vibrationAnalysis.id })
    .from(vibrationAnalysis)
    .where(
      and(
        eq(vibrationAnalysis.orgId, orgId),
        eq(vibrationAnalysis.equipmentId, equipmentId),
        gte(vibrationAnalysis.createdAt, periodStart),
        lte(vibrationAnalysis.createdAt, periodEnd)
      )
    );

  if (!features[0] || features[0].rmsAvg === null) {
    return null;
  }

  return {
    rmsAvg: features[0].rmsAvg,
    rmsMax: features[0].rmsMax,
    rmsMin: features[0].rmsMin,
    peakAvg: features[0].peakAvg,
    peakMax: features[0].peakMax,
    crestFactor: features[0].crestFactor,
    kurtosis: features[0].kurtosis,
    analysisIds: analyses.map((a) => a.id),
  };
}

export async function aggregateConditionData(
  orgId: string,
  equipmentId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ConditionAggregation> {
  const cm = conditionMonitoring as typeof conditionMonitoring & Record<"mlAnomalyScore" | "healthIndex" | "temperature", typeof conditionMonitoring.equipmentId> & Record<"timestamp", typeof conditionMonitoring.assessmentDate>;
  const data = await db
    .select({
      anomalyScoreAvg: sql<number>`avg(${cm.mlAnomalyScore})`,
      anomalyScoreMax: sql<number>`max(${cm.mlAnomalyScore})`,
      healthIndex: sql<number>`avg(${cm.healthIndex})`,
      tempAvg: sql<number>`avg(${cm.temperature})`,
      tempMax: sql<number>`max(${cm.temperature})`,
      tempMin: sql<number>`min(${cm.temperature})`,
      dataPoints: sql<number>`count(*)`,
    })
    .from(conditionMonitoring)
    .where(
      and(
        eq(conditionMonitoring.orgId, orgId),
        eq(conditionMonitoring.equipmentId, equipmentId),
        gte(cm.timestamp, periodStart),
        lte(cm.timestamp, periodEnd)
      )
    );

  const alertCounts = await db
    .select({
      total: sql<number>`count(*)`,
      // alert_notifications has no severity column; alertType acts as the severity discriminator.
      critical: sql<number>`count(*) FILTER (WHERE ${alertNotifications.alertType} = 'critical')`,
    })
    .from(alertNotifications)
    .where(
      and(
        eq(alertNotifications.orgId, orgId),
        eq(alertNotifications.equipmentId, equipmentId),
        gte(alertNotifications.createdAt, periodStart),
        lte(alertNotifications.createdAt, periodEnd)
      )
    );

  return {
    anomalyScoreAvg: data[0]?.anomalyScoreAvg || null,
    anomalyScoreMax: data[0]?.anomalyScoreMax || null,
    healthIndex: data[0]?.healthIndex || null,
    alertsCount: alertCounts[0]?.total || 0,
    criticalAlertsCount: alertCounts[0]?.critical || 0,
    tempAvg: data[0]?.tempAvg || null,
    tempMax: data[0]?.tempMax || null,
    tempMin: data[0]?.tempMin || null,
    dataPoints: data[0]?.dataPoints || 0,
  };
}

export async function getMonitoredEquipment(vesselId: string) {
  return db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.vesselId, vesselId),
        eq((equipment as object as Record<string, never>).status, "operational"),
        sql`${(equipment as object as Record<string, never>).category} IN ('propulsion', 'auxiliary', 'deck_machinery')`
      )
    );
}
