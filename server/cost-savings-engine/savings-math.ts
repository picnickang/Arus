/**
 * Pure math kernel for cost-savings calculation.
 *
 * Extracted from calculator.ts so the financial logic can be exercised
 * deterministically without touching the database. The DB-bound
 * `calculateWorkOrderSavings` resolves all defaulting/cascading values
 * (work-order overrides → equipment defaults → org defaults → cost model
 * → hardcoded fallback) and then delegates the actual arithmetic here.
 *
 * This is the layer the "savings claim integrity" tests target — once
 * inputs are resolved, the same inputs must always produce the same
 * dollars, regardless of who calls it.
 */

import type { SavingsCalculation } from "./types";

export interface SavingsMathInputs {
  workOrderId: string;
  equipmentId: string;
  vesselId: string | null;
  predictionId: number | null;
  confidenceScore: number | null;
  maintenanceType: SavingsCalculation["maintenanceType"];
  triggeredBy: SavingsCalculation["triggeredBy"];

  actualLaborCost: number;
  actualPartsCost: number;
  actualDowntimeHours: number;

  downtimeCostPerHour: number;
  emergencyLaborMultiplier: number;
  emergencyPartsMultiplier: number;
  emergencyDowntimeMultiplier: number;
}

/**
 * Pure savings math. Returns the same shape as the DB-driven calculator.
 *
 * Contract: callers MUST pre-filter out corrective/emergency work orders
 * (those return null upstream because there is nothing to "save" against).
 *
 * Invariants that the test suite enforces:
 *   - totalSavings === avoidedCost - actualCost
 *   - totalSavings === laborSavings + partsSavings + downtimeSavings
 *   - When actualDowntimeHours === 0, emergency downtime is the documented
 *     24-hour fallback (catastrophic-failure assumption), not zero.
 *   - All multipliers ≥ 1 → savings are never negative for non-negative inputs.
 */
export function computeSavingsMath(inputs: SavingsMathInputs): SavingsCalculation {
  const {
    workOrderId,
    equipmentId,
    vesselId,
    predictionId,
    confidenceScore,
    maintenanceType,
    triggeredBy,
    actualLaborCost,
    actualPartsCost,
    actualDowntimeHours,
    downtimeCostPerHour,
    emergencyLaborMultiplier,
    emergencyPartsMultiplier,
    emergencyDowntimeMultiplier,
  } = inputs;

  const actualDowntimeCost = actualDowntimeHours * downtimeCostPerHour;
  const actualCost = actualLaborCost + actualPartsCost + actualDowntimeCost;

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
    equipmentId,
    vesselId,
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
