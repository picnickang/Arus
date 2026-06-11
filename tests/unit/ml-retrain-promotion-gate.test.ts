/**
 * Push A1 — Promotion-gate unit test for the weekly retrain job.
 *
 * Imports the SAME pure parseTrainerMetrics + evaluatePromotionGate
 * module the processor calls at runtime, without booting the DB-bearing
 * retrain orchestrator in a unit harness.
 */

import { describe, it, expect } from "@jest/globals";
import {
  evaluatePromotionGate,
  parseTrainerMetrics,
} from "../../server/job-processors/ml-retraining-gate";

describe("ml-retrain promotion gate", () => {
  it("promotes a candidate that beats production MAE by >=5% with low PSI", () => {
    const stdout = JSON.stringify({
      stage: "metrics",
      modelId: "m_new",
      mae: 0.18,
      productionMae: 0.25,
      psi: 0.08,
      artifactPath: "models/bearing/m_new.onnx",
    });
    const gate = evaluatePromotionGate(parseTrainerMetrics(stdout));
    expect(gate.promote).toBe(true);
    expect(gate.improvementPct).toBeGreaterThanOrEqual(5);
  });

  it("rejects a candidate that regresses MAE", () => {
    const stdout = JSON.stringify({
      stage: "metrics",
      modelId: "m_new",
      mae: 0.28,
      productionMae: 0.25,
      psi: 0.05,
    });
    const gate = evaluatePromotionGate(parseTrainerMetrics(stdout));
    expect(gate.promote).toBe(false);
    expect(gate.skipped).toMatch(/MAE/);
  });

  it("rejects a candidate with PSI drift above 0.25 even with MAE win", () => {
    const stdout = JSON.stringify({
      stage: "metrics",
      modelId: "m_new",
      mae: 0.1,
      productionMae: 0.25,
      psi: 0.42,
    });
    const gate = evaluatePromotionGate(parseTrainerMetrics(stdout));
    expect(gate.promote).toBe(false);
    expect(gate.skipped).toMatch(/PSI/);
  });

  it("emits no candidate when the trainer prints non-metrics output", () => {
    const metrics = parseTrainerMetrics("trainer crashed\nstack trace...");
    expect(metrics.modelId).toBeUndefined();
    const gate = evaluatePromotionGate(metrics);
    expect(gate.promote).toBe(false);
    expect(gate.skipped).toMatch(/candidate/);
  });
});
