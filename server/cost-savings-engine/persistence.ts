/**
 * Cost Savings Persistence
 */

import { db } from "../db";
import { costSavings } from "@shared/schema-runtime";
import { eq, and, ne } from "drizzle-orm";
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
    estimatedDowntimePrevented:
      calculation.emergencyDowntimeHours - calculation.actualDowntimeHours,
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

export async function voidSavingsForWorkOrder(
  workOrderId: string,
  orgId: string,
  reason: string,
  changedBy?: string
): Promise<number> {
  const result = await db
    .update(costSavings)
    .set({
      validationStatus: "voided",
      validationReason: reason,
      validationChangedBy: changedBy ?? "system",
      validationChangedAt: new Date(),
    })
    .where(
      and(
        eq(costSavings.workOrderId, workOrderId),
        eq(costSavings.orgId, orgId),
        ne(costSavings.validationStatus, "voided")
      )
    )
    .returning({ id: costSavings.id });

  return result.length;
}

export async function updateSavingsValidationStatus(
  savingsId: string,
  orgId: string,
  status: "valid" | "disputed" | "voided",
  reason: string,
  changedBy: string
): Promise<boolean> {
  const result = await db
    .update(costSavings)
    .set({
      validationStatus: status,
      validationReason: reason,
      validationChangedBy: changedBy,
      validationChangedAt: new Date(),
    })
    .where(and(eq(costSavings.id, savingsId), eq(costSavings.orgId, orgId)))
    .returning({ id: costSavings.id });

  return result.length > 0;
}
