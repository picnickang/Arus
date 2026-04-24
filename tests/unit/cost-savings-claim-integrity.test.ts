/**
 * Tier A — Cost Savings Claim Integrity (Hexagonal Unit Test)
 * --------------------------------------------------------------------
 * Critical-path test for the financial layer's "savings claim integrity"
 * pillar (replit.md › Financial Layer › three-part cost integrity).
 *
 * The DB-bound `calculateWorkOrderSavings` resolves all defaulting and
 * cascade logic (work-order overrides → equipment → org → cost model →
 * hardcoded fallback) and then delegates to the pure `computeSavingsMath`
 * kernel for the actual arithmetic. This test pins down the kernel so a
 * regression in the math itself can never silently produce inflated or
 * deflated savings claims.
 *
 * Placement note: lives in tests/unit/ (not tests/integration/) so it
 * actually runs in `npm run test:unit` and CI. The test:integration npm
 * script is currently mis-wired (does not load jest.integration.config.mjs
 * and the base config's testMatch excludes tests/integration/**), so any
 * test placed there would not execute.
 */

import { describe, it, expect } from "@jest/globals";
import {
  computeSavingsMath,
  type SavingsMathInputs,
} from "../../server/cost-savings-engine/savings-math";

const baseInputs: SavingsMathInputs = {
  workOrderId: "wo-123",
  equipmentId: "eq-456",
  vesselId: "v-789",
  predictionId: 42,
  confidenceScore: 0.87,
  maintenanceType: "predictive",
  triggeredBy: "ml_prediction",
  actualLaborCost: 500,
  actualPartsCost: 1000,
  actualDowntimeHours: 4,
  downtimeCostPerHour: 1000,
  emergencyLaborMultiplier: 3,
  emergencyPartsMultiplier: 1.5,
  emergencyDowntimeMultiplier: 3,
};

describe("Cost Savings Claim Integrity — pure math kernel", () => {
  it("golden case: predictive maintenance with all standard multipliers", () => {
    const result = computeSavingsMath(baseInputs);

    // Actual costs (what we paid)
    expect(result.actualLaborCost).toBe(500);
    expect(result.actualPartsCost).toBe(1000);
    expect(result.actualDowntimeHours).toBe(4);
    // 500 + 1000 + (4 * 1000)
    expect(result.actualCost).toBe(5500);

    // Avoided emergency costs (what we would have paid)
    expect(result.emergencyLaborCost).toBe(1500); // 500 * 3
    expect(result.emergencyPartsCost).toBe(1500); // 1000 * 1.5
    expect(result.emergencyDowntimeHours).toBe(12); // 4 * 3
    expect(result.emergencyDowntimeCost).toBe(12000); // 12 * 1000
    expect(result.avoidedCost).toBe(15000); // 1500 + 1500 + 12000

    // Savings = avoided - actual
    expect(result.totalSavings).toBe(9500); // 15000 - 5500
    expect(result.laborSavings).toBe(1000); // 1500 - 500
    expect(result.partsSavings).toBe(500); // 1500 - 1000
    expect(result.downtimeSavings).toBe(8000); // 12000 - 4000

    // Lineage fields preserved verbatim — claim integrity requires every
    // output to be auditable back to the inputs that produced it.
    expect(result.workOrderId).toBe(baseInputs.workOrderId);
    expect(result.equipmentId).toBe(baseInputs.equipmentId);
    expect(result.vesselId).toBe(baseInputs.vesselId);
    expect(result.predictionId).toBe(baseInputs.predictionId);
    expect(result.confidenceScore).toBe(baseInputs.confidenceScore);
    expect(result.maintenanceType).toBe(baseInputs.maintenanceType);
    expect(result.triggeredBy).toBe(baseInputs.triggeredBy);
  });

  it("invariant: totalSavings === avoidedCost - actualCost", () => {
    const result = computeSavingsMath(baseInputs);
    expect(result.totalSavings).toBe(result.avoidedCost - result.actualCost);
  });

  it("invariant: totalSavings === sum of component savings (labor + parts + downtime)", () => {
    const result = computeSavingsMath(baseInputs);
    expect(result.totalSavings).toBe(
      result.laborSavings + result.partsSavings + result.downtimeSavings
    );
  });

  it("zero downtime hours triggers documented 24h catastrophic-failure fallback", () => {
    const result = computeSavingsMath({ ...baseInputs, actualDowntimeHours: 0 });

    // Per savings-math.ts contract: when downtime is 0, we assume a
    // catastrophic-failure scenario would have caused 24h of downtime.
    expect(result.actualDowntimeHours).toBe(0);
    expect(result.emergencyDowntimeHours).toBe(24);
    expect(result.emergencyDowntimeCost).toBe(24000);
    // Labor & parts savings remain calculated against zero baselines
    expect(result.laborSavings).toBe(1000);
    expect(result.partsSavings).toBe(500);
    expect(result.downtimeSavings).toBe(24000); // 24000 - 0
  });

  it("scheduled preventive (no prediction) yields same arithmetic, different lineage", () => {
    const result = computeSavingsMath({
      ...baseInputs,
      maintenanceType: "preventive",
      triggeredBy: "scheduled",
      predictionId: null,
      confidenceScore: null,
    });

    // Math is identical regardless of trigger
    expect(result.totalSavings).toBe(9500);
    // But lineage flags differ — the financial layer must surface
    // who claimed the savings (ML vs schedule vs sensor)
    expect(result.maintenanceType).toBe("preventive");
    expect(result.triggeredBy).toBe("scheduled");
    expect(result.predictionId).toBeNull();
    expect(result.confidenceScore).toBeNull();
  });

  it("multiplier overrides cascade through to final claim", () => {
    // Override scenario: a high-criticality vessel with elevated multipliers
    const result = computeSavingsMath({
      ...baseInputs,
      emergencyLaborMultiplier: 5,
      emergencyPartsMultiplier: 2.5,
      emergencyDowntimeMultiplier: 4,
    });

    expect(result.emergencyLaborCost).toBe(2500); // 500 * 5
    expect(result.emergencyPartsCost).toBe(2500); // 1000 * 2.5
    expect(result.emergencyDowntimeHours).toBe(16); // 4 * 4
    expect(result.emergencyDowntimeCost).toBe(16000);
    expect(result.totalSavings).toBe(2500 + 2500 + 16000 - 5500); // 15500

    // Multipliers preserved on output for audit
    expect(result.emergencyLaborMultiplier).toBe(5);
    expect(result.emergencyPartsMultiplier).toBe(2.5);
  });

  it("zero actual costs yield zero labor/parts savings (guards against fabricated claims)", () => {
    const result = computeSavingsMath({
      ...baseInputs,
      actualLaborCost: 0,
      actualPartsCost: 0,
      actualDowntimeHours: 0,
    });

    expect(result.laborSavings).toBe(0); // 0*3 - 0
    expect(result.partsSavings).toBe(0); // 0*1.5 - 0
    // Downtime still kicks in via 24h fallback
    expect(result.downtimeSavings).toBe(24000);
    expect(result.totalSavings).toBe(24000);
  });

  it("non-negative savings invariant: with multipliers ≥ 1 and non-negative inputs", () => {
    const result = computeSavingsMath(baseInputs);
    expect(result.laborSavings).toBeGreaterThanOrEqual(0);
    expect(result.partsSavings).toBeGreaterThanOrEqual(0);
    expect(result.downtimeSavings).toBeGreaterThanOrEqual(0);
    expect(result.totalSavings).toBeGreaterThanOrEqual(0);
  });

  it("downtime cost per hour propagates to both actual and emergency calculations", () => {
    const high = computeSavingsMath({ ...baseInputs, downtimeCostPerHour: 5000 });
    const low = computeSavingsMath({ ...baseInputs, downtimeCostPerHour: 100 });

    // High-rate vessel: actualDowntimeCost = 4 * 5000 = 20000
    //                   emergencyDowntimeCost = 12 * 5000 = 60000
    expect(high.downtimeSavings).toBe(40000);
    // Low-rate: actualDowntimeCost = 400, emergency = 1200
    expect(low.downtimeSavings).toBe(800);

    // Output preserves the resolved rate for auditability
    expect(high.downtimeCostPerHour).toBe(5000);
    expect(low.downtimeCostPerHour).toBe(100);
  });
});
