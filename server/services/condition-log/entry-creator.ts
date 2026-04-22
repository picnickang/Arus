/**
 * Condition Log Service - Entry Creation
 */

import { db } from "../../db";
import { conditionLogSummary, InsertConditionLogSummary } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  getHealthGrade,
  getConditionRating,
  calculateDegradationRate,
  estimateRUL,
} from "./health-utils.js";
import { aggregateVibrationData, aggregateConditionData } from "./aggregators.js";

export async function getPreviousHealthIndex(
  orgId: string,
  equipmentId: string,
  currentPeriodStart: Date
): Promise<{ healthIndex: number; periodStart: Date } | null> {
  const previous = await db
    .select({
      healthIndex: conditionLogSummary.healthIndex,
      periodStart: conditionLogSummary.periodStart,
    })
    .from(conditionLogSummary)
    .where(
      and(
        eq(conditionLogSummary.orgId, orgId),
        eq(conditionLogSummary.equipmentId, equipmentId),
        sql`${conditionLogSummary.periodEnd} <= ${currentPeriodStart}`
      )
    )
    .orderBy(sql`${conditionLogSummary.periodEnd} DESC`)
    .limit(1);

  if (previous.length === 0 || previous[0].healthIndex === null) {
    return null;
  }
  return { healthIndex: previous[0].healthIndex, periodStart: previous[0].periodStart };
}

export async function createConditionLogEntry(
  orgId: string,
  vesselId: string,
  equipmentId: string,
  periodStart: Date,
  periodEnd: Date,
  periodType: "hourly" | "daily" = "hourly"
): Promise<string | null> {
  const vibrationData = await aggregateVibrationData(orgId, equipmentId, periodStart, periodEnd);
  const conditionData = await aggregateConditionData(orgId, equipmentId, periodStart, periodEnd);

  if (!vibrationData && conditionData.dataPoints === 0) {
    return null;
  }

  const previousHealth = await getPreviousHealthIndex(orgId, equipmentId, periodStart);
  const currentHealth = conditionData.healthIndex ?? 100;
  let degradationRate: number | null = null;
  let rulDays: number | null = null;

  if (previousHealth) {
    const daysBetween =
      (periodStart.getTime() - previousHealth.periodStart.getTime()) / (1000 * 60 * 60 * 24);
    degradationRate = calculateDegradationRate(
      currentHealth,
      previousHealth.healthIndex,
      daysBetween
    );
    rulDays = estimateRUL(currentHealth, degradationRate);
  }

  const expectedDataPoints = periodType === "hourly" ? 6 : 144;
  const completeness = Math.min(1, conditionData.dataPoints / expectedDataPoints);
  const dataQuality = completeness >= 0.9 ? "high" : completeness >= 0.5 ? "medium" : "low";

  const logEntry: InsertConditionLogSummary = {
    orgId,
    vesselId,
    equipmentId,
    periodStart,
    periodEnd,
    periodType,
    vibrationRmsAvg: vibrationData?.rmsAvg ?? null,
    vibrationRmsMax: vibrationData?.rmsMax ?? null,
    vibrationRmsMin: vibrationData?.rmsMin ?? null,
    vibrationPeakAvg: vibrationData?.peakAvg ?? null,
    vibrationPeakMax: vibrationData?.peakMax ?? null,
    vibrationCrestFactor: vibrationData?.crestFactor ?? null,
    vibrationKurtosis: vibrationData?.kurtosis ?? null,
    tempAvg: conditionData.tempAvg,
    tempMax: conditionData.tempMax,
    tempMin: conditionData.tempMin,
    mlAnomalyScoreAvg: conditionData.anomalyScoreAvg,
    mlAnomalyScoreMax: conditionData.anomalyScoreMax,
    mlConfidenceScore: completeness,
    healthIndex: currentHealth,
    healthGrade: getHealthGrade(currentHealth),
    conditionRating: getConditionRating(currentHealth),
    degradationRate,
    rulDays,
    alertsCount: conditionData.alertsCount,
    criticalAlertsCount: conditionData.criticalAlertsCount,
    warningAlertsCount: conditionData.alertsCount - conditionData.criticalAlertsCount,
    dataPointsCount: conditionData.dataPoints,
    dataCompleteness: completeness,
    dataQuality,
    sourceAnalysisIds: vibrationData?.analysisIds ?? [],
  };

  const result = await db
    .insert(conditionLogSummary)
    .values(logEntry)
    .returning({ id: conditionLogSummary.id });
  return result[0]?.id ?? null;
}
