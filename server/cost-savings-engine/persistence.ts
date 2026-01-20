/**
 * Cost Savings Persistence
 */

import { db } from "../db";
import { costSavings } from "@shared/schema-runtime";
import { eq } from "drizzle-orm";
import type { SavingsCalculation } from "./types";
import { calculateWorkOrderSavings } from "./calculator";

export async function saveCostSavings(
  calculation: SavingsCalculation,
  orgId: string,
  notes?: string
): Promise<void> {
  await db.insert(costSavings).values({
    orgId,
    workOrderId: calculation.workOrderId,
    equipmentId: calculation.equipmentId,
    vesselId: calculation.vesselId,
    predictionId: calculation.predictionId,
    maintenanceType: calculation.maintenanceType,
    actualCost: calculation.actualCost,
    avoidedCost: calculation.avoidedCost,
    totalSavings: calculation.totalSavings,
    laborSavings: calculation.laborSavings,
    partsSavings: calculation.partsSavings,
    downtimeSavings: calculation.downtimeSavings,
    estimatedDowntimePrevented: calculation.emergencyDowntimeHours - calculation.actualDowntimeHours,
    downtimeCostPerHour: calculation.downtimeCostPerHour,
    triggeredBy: calculation.triggeredBy,
    confidenceScore: calculation.confidenceScore,
    emergencyLaborMultiplier: calculation.emergencyLaborMultiplier,
    emergencyPartsMultiplier: calculation.emergencyPartsMultiplier,
    notes,
  });
}

export async function processWorkOrderCompletion(
  workOrderId: string,
  orgId: string
): Promise<{ saved: boolean; savings?: SavingsCalculation }> {
  const [existing] = await db
    .select()
    .from(costSavings)
    .where(eq(costSavings.workOrderId, workOrderId))
    .limit(1);

  if (existing) {
    return { saved: false };
  }

  const calculation = await calculateWorkOrderSavings(workOrderId, orgId);

  if (!calculation) {
    return { saved: false };
  }

  if (calculation.totalSavings > 0) {
    await saveCostSavings(calculation, orgId, `Automatic calculation on work order completion`);
    return { saved: true, savings: calculation };
  }

  return { saved: false };
}
