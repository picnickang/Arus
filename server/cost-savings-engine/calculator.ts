/**
 * Cost Savings Calculator
 */

import { db } from "../db";
import {
  workOrders,
  failurePredictions,
  equipment,
  organizations,
  costModel,
} from "@shared/schema-runtime";
import { eq, and } from "drizzle-orm";
import type { SavingsCalculation } from "./types";

export async function calculateWorkOrderSavings(
  workOrderId: string,
  orgId: string,
  options: {
    emergencyLaborMultiplier?: number;
    emergencyPartsMultiplier?: number;
    emergencyDowntimeMultiplier?: number;
  } = {}
): Promise<SavingsCalculation | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

  const [workOrder] = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.orgId, orgId)))
    .limit(1);

  if (!workOrder) {
    throw new Error(`Work order ${workOrderId} not found`);
  }

  const [equipmentDetails] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, workOrder.equipmentId), eq(equipment.orgId, orgId)))
    .limit(1);

  if (workOrder.status !== "completed") {
    return null;
  }

  let maintenanceType: SavingsCalculation["maintenanceType"] =
    (workOrder.maintenanceType as any) || "corrective";
  let triggeredBy: SavingsCalculation["triggeredBy"] = "manual";
  let predictionId: number | null = null;
  let confidenceScore: number | null = null;

  console.log(
    `[Cost Savings Debug] Work Order ${workOrderId}: maintenanceType="${maintenanceType}", status="${workOrder.status}"`
  );

  const [linkedPrediction] = await db
    .select()
    .from(failurePredictions)
    .where(eq(failurePredictions.resolvedByWorkOrderId, workOrderId))
    .limit(1);

  if (linkedPrediction) {
    maintenanceType = "predictive";
    triggeredBy = "ml_prediction";
    predictionId = linkedPrediction.id;
    confidenceScore = linkedPrediction.failureProbability;
  } else if (workOrder.scheduleId) {
    maintenanceType = "preventive";
    triggeredBy = "scheduled";
  } else if (workOrder.maintenanceType === "predictive") {
    triggeredBy = "manual";
  }

  if (maintenanceType === "corrective" || maintenanceType === "emergency") {
    console.log(
      `[Cost Savings Debug] Skipping work order ${workOrderId}: maintenanceType="${maintenanceType}" is corrective/emergency`
    );
    return null;
  }

  const actualLaborCost = workOrder.totalLaborCost ?? 0;
  const actualPartsCost = workOrder.totalPartsCost ?? 0;
  const actualDowntimeHours = workOrder.actualDowntimeHours ?? 0;

  const [activeCostModel] = await db
    .select()
    .from(costModel)
    .where(and(eq(costModel.orgId, orgId), eq(costModel.isActive, true)))
    .limit(1);

  const downtimeCostPerHour =
    workOrder.downtimeCostPerHour ??
    equipmentDetails?.downtimeCostPerHour ??
    activeCostModel?.downtimePerHour ??
    1000;
  const actualDowntimeCost = actualDowntimeHours * downtimeCostPerHour;
  const actualCost = actualLaborCost + actualPartsCost + actualDowntimeCost;

  const emergencyLaborMultiplier =
    options.emergencyLaborMultiplier ??
    equipmentDetails?.emergencyLaborMultiplier ??
    org?.emergencyLaborMultiplier ??
    3;
  const emergencyPartsMultiplier =
    options.emergencyPartsMultiplier ??
    equipmentDetails?.emergencyPartsMultiplier ??
    org?.emergencyPartsMultiplier ??
    1.5;
  const emergencyDowntimeMultiplier =
    options.emergencyDowntimeMultiplier ??
    equipmentDetails?.emergencyDowntimeMultiplier ??
    org?.emergencyDowntimeMultiplier ??
    3;

  const emergencyLaborCost = actualLaborCost * emergencyLaborMultiplier;
  const emergencyPartsCost = actualPartsCost * emergencyPartsMultiplier;
  const emergencyDowntimeHours =
    actualDowntimeHours > 0 ? actualDowntimeHours * emergencyDowntimeMultiplier : 24;
  const emergencyDowntimeCost = emergencyDowntimeHours * downtimeCostPerHour;

  const avoidedCost = emergencyLaborCost + emergencyPartsCost + emergencyDowntimeCost;

  const laborSavings = emergencyLaborCost - actualLaborCost;
  const partsSavings = emergencyPartsCost - actualPartsCost;
  const downtimeSavings = emergencyDowntimeCost - actualDowntimeCost;
  const totalSavings = avoidedCost - actualCost;

  return {
    workOrderId,
    equipmentId: workOrder.equipmentId,
    vesselId: workOrder.vesselId ?? null,
    predictionId,
    actualCost,
    actualLaborCost,
    actualPartsCost,
    actualDowntimeHours,
    avoidedCost,
    emergencyLaborCost,
    emergencyPartsCost,
    emergencyDowntimeHours,
    emergencyDowntimeCost,
    totalSavings,
    laborSavings,
    partsSavings,
    downtimeSavings,
    maintenanceType,
    triggeredBy,
    confidenceScore,
    emergencyLaborMultiplier,
    emergencyPartsMultiplier,
    downtimeCostPerHour,
  };
}
