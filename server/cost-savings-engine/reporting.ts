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
  const safeStartDate = startDate instanceof Date && !isNaN(startDate.getTime()) 
    ? startDate 
    : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const safeEndDate = endDate instanceof Date && !isNaN(endDate.getTime()) 
    ? endDate 
    : new Date();

  const savings = await db
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

  const totalSavings = savings.reduce((sum, s) => sum + (s.totalSavings ?? 0), 0);
  const totalDowntimePrevented = savings.reduce((sum, s) => sum + (s.estimatedDowntimePrevented ?? 0), 0);

  const savingsByType = {
    labor: savings.reduce((sum, s) => sum + (s.laborSavings ?? 0), 0),
    parts: savings.reduce((sum, s) => sum + (s.partsSavings ?? 0), 0),
    downtime: savings.reduce((sum, s) => sum + (s.downtimeSavings ?? 0), 0),
  };

  const savingsCount = savings.length;
  const avgSavingsPerIncident = savingsCount > 0 ? totalSavings / savingsCount : 0;

  const equipmentIds = [...new Set(savings.slice(0, 5).map((s) => s.equipmentId))];
  const equipmentData = equipmentIds.length > 0
    ? await db.select().from(equipment).where(sql`${equipment.id} IN (${sql.join(equipmentIds.map((id) => sql`${id}`), sql`, `)})`)
    : [];

  const equipmentMap = new Map(equipmentData.map((e) => [e.id, e.name]));

  const topSavings = savings.slice(0, 5).map((s) => ({
    workOrderId: s.workOrderId ?? "",
    equipmentName: equipmentMap.get(s.equipmentId) ?? s.equipmentId,
    savings: s.totalSavings ?? 0,
    downtimePrevented: s.estimatedDowntimePrevented ?? 0,
  }));

  return {
    totalSavings,
    totalDowntimePrevented,
    savingsByType,
    savingsCount,
    avgSavingsPerIncident,
    topSavings,
  };
}

export async function getMonthlySavingsTrend(
  orgId: string,
  months: number = 12
): Promise<Array<{
  month: string;
  totalSavings: number;
  laborSavings: number;
  partsSavings: number;
  downtimeSavings: number;
  downtimePrevented: number;
  savingsCount: number;
}>> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const savings = await db
    .select()
    .from(costSavings)
    .where(and(eq(costSavings.orgId, orgId), gte(costSavings.calculatedAt, cutoffDate)));

  const monthlyData: Record<string, any> = {};

  savings.forEach((s) => {
    if (!s.calculatedAt) { return; }

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

  return Object.values(monthlyData).sort((a: any, b: any) => a.month.localeCompare(b.month));
}
