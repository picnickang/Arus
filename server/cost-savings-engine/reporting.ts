/**
 * Cost Savings Reporting
 */

import { db } from "../db";
import { costSavings, equipment } from "@shared/schema-runtime";
import { eq, and, sql, gte } from "drizzle-orm";
import type { SavingsSummary } from "./types";

export async function getSavingsSummary(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<SavingsSummary> {
  const safeStartDate =
    startDate instanceof Date && !isNaN(startDate.getTime())
      ? startDate
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const safeEndDate = endDate instanceof Date && !isNaN(endDate.getTime()) ? endDate : new Date();

  const allSavings = await db
    .select()
    .from(costSavings)
    .where(
      and(
        eq(costSavings.orgId, orgId),
        gte(costSavings.calculatedAt, safeStartDate),
        sql`${costSavings.calculatedAt} <= ${safeEndDate}`
      )
    )
    .orderBy(sql`${costSavings.totalSavings} DESC`);

  const validSavings = allSavings.filter((s) => s.validationStatus === "valid");
  const disputedSavings = allSavings.filter((s) => s.validationStatus === "disputed");
  const voidedSavings = allSavings.filter((s) => s.validationStatus === "voided");

  const totalSavings = validSavings.reduce((sum, s) => sum + (s.totalSavings ?? 0), 0);
  const totalDowntimePrevented = validSavings.reduce(
    (sum, s) => sum + (s.estimatedDowntimePrevented ?? 0),
    0
  );

  const savingsByType = {
    labor: validSavings.reduce((sum, s) => sum + (s.laborSavings ?? 0), 0),
    parts: validSavings.reduce((sum, s) => sum + (s.partsSavings ?? 0), 0),
    downtime: validSavings.reduce((sum, s) => sum + (s.downtimeSavings ?? 0), 0),
  };

  const savingsCount = validSavings.length;
  const avgSavingsPerIncident = savingsCount > 0 ? totalSavings / savingsCount : 0;

  const disputedCount = disputedSavings.length;
  const voidedCount = voidedSavings.length;
  const disputedAmount = disputedSavings.reduce((sum, s) => sum + (s.totalSavings ?? 0), 0);
  const voidedAmount = voidedSavings.reduce((sum, s) => sum + (s.totalSavings ?? 0), 0);

  const confidenceScores = validSavings
    .map((s) => s.confidenceScore)
    .filter((c): c is number => c !== null && c !== undefined);
  const avgConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length
      : 0.5;
  const clampedConfidence = Math.max(0, Math.min(1, avgConfidence));
  const uncertaintyMargin = 1 - clampedConfidence;
  const confidenceRange = {
    low: totalSavings * (1 - uncertaintyMargin),
    high: totalSavings * (1 + uncertaintyMargin),
    avgConfidence: clampedConfidence,
  };

  const equipmentIds = [...new Set(validSavings.slice(0, 5).map((s) => s.equipmentId))];
  const equipmentData =
    equipmentIds.length > 0
      ? await db
          .select()
          .from(equipment)
          .where(
            sql`${equipment.id} IN (${sql.join(
              equipmentIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
      : [];

  const equipmentMap = new Map(equipmentData.map((e) => [e.id, e.name]));

  const topSavings = validSavings.slice(0, 5).map((s) => ({
    workOrderId: s.workOrderId ?? "",
    equipmentName: equipmentMap.get(s.equipmentId) ?? s.equipmentId,
    savings: s.totalSavings ?? 0,
    downtimePrevented: s.estimatedDowntimePrevented ?? 0,
    validationStatus: s.validationStatus,
  }));

  return {
    totalSavings,
    totalDowntimePrevented,
    savingsByType,
    savingsCount,
    avgSavingsPerIncident,
    topSavings,
    disputedCount,
    voidedCount,
    disputedAmount,
    voidedAmount,
    confidenceRange,
  };
}

export async function getMonthlySavingsTrend(
  orgId: string,
  months: number = 12
): Promise<
  Array<{
    month: string;
    totalSavings: number;
    laborSavings: number;
    partsSavings: number;
    downtimeSavings: number;
    downtimePrevented: number;
    savingsCount: number;
  }>
> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const allRecords = await db
    .select()
    .from(costSavings)
    .where(and(eq(costSavings.orgId, orgId), gte(costSavings.calculatedAt, cutoffDate)));

  const savings = allRecords.filter((s) => s.validationStatus === "valid");

  const monthlyData: Record<
    string,
    {
      month: string;
      totalSavings: number;
      laborSavings: number;
      partsSavings: number;
      downtimeSavings: number;
      downtimePrevented: number;
      savingsCount: number;
    }
  > = {};

  savings.forEach((s) => {
    if (!s.calculatedAt) {
      return;
    }

    const monthKey = `${s.calculatedAt.getFullYear()}-${String(s.calculatedAt.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        totalSavings: 0,
        laborSavings: 0,
        partsSavings: 0,
        downtimeSavings: 0,
        downtimePrevented: 0,
        savingsCount: 0,
      };
    }

    monthlyData[monthKey].totalSavings += s.totalSavings ?? 0;
    monthlyData[monthKey].laborSavings += s.laborSavings ?? 0;
    monthlyData[monthKey].partsSavings += s.partsSavings ?? 0;
    monthlyData[monthKey].downtimeSavings += s.downtimeSavings ?? 0;
    monthlyData[monthKey].downtimePrevented += s.estimatedDowntimePrevented ?? 0;
    monthlyData[monthKey].savingsCount += 1;
  });

  return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
}
