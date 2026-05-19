/**
 * Push A1 — Promotion-gate unit test for the weekly retrain job.
 *
 * Drives parseTrainerMetrics + the MAE / PSI gate logic with synthetic
 * trainer stdout payloads. Confirms:
 *   - clean win (MAE down ≥5%, PSI <0.25) → eligible for promotion
 *   - MAE regression → skipped
 *   - PSI drift above threshold → skipped even if MAE improved
 *   - non-JSON trainer output → no candidate emitted
 */

import { describe, it, expect } from "@jest/globals";

// Re-implement the gate logic that lives inline in
// processModelRetrain so we can exercise it without standing up
// pg-boss + a real DB. Constants must stay in sync with
// server/job-processors/ml-retraining-processor.ts.
const MIN_MAE_IMPROVEMENT_PCT = 5;
const MAX_PSI_FOR_PROMOTION = 0.25;

interface TrainerMetrics {
  modelId?: string;
  mae?: number;
  productionMae?: number;
  psi?: number;
  artifactPath?: string;
}

function parseTrainerMetrics(stdout: string): TrainerMetrics {
  const out: TrainerMetrics = {};
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.stage === "metrics") {
        if (typeof parsed.modelId === "string") out.modelId = parsed.modelId;
        if (typeof parsed.mae === "number") out.mae = parsed.mae;
        if (typeof parsed.productionMae === "number") out.productionMae = parsed.productionMae;
        if (typeof parsed.psi === "number") out.psi = parsed.psi;
        if (typeof parsed.artifactPath === "string") out.artifactPath = parsed.artifactPath;
      }
    } catch {
      // ignore non-JSON lines
    }
  }
  return out;
}

function evaluateGate(metrics: TrainerMetrics): {
  promote: boolean;
  improvementPct?: number;
  reason?: string;
} {
  const improvement =
    metrics.mae != null && metrics.productionMae != null && metrics.productionMae > 0
      ? ((metrics.productionMae - metrics.mae) / metrics.productionMae) * 100
      : undefined;
  if (!metrics.modelId) return { promote: false, reason: "no candidate model" };
  if (improvement == null || improvement < MIN_MAE_IMPROVEMENT_PCT) {
    return {
      promote: false,
      improvementPct: improvement,
      reason: "MAE improvement below threshold",
    };
  }
  if (metrics.psi != null && metrics.psi >= MAX_PSI_FOR_PROMOTION) {
    return { promote: false, improvementPct: improvement, reason: "PSI drift too high" };
  }
  return { promote: true, improvementPct: improvement };
}

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
    const gate = evaluateGate(parseTrainerMetrics(stdout));
    expect(gate.promote).toBe(true);
    expect(gate.improvementPct).toBeGreaterThanOrEqual(MIN_MAE_IMPROVEMENT_PCT);
  });

  it("rejects a candidate that regresses MAE", () => {
    const stdout = JSON.stringify({
      stage: "metrics",
      modelId: "m_new",
      mae: 0.28,
      productionMae: 0.25,
      psi: 0.05,
    });
    const gate = evaluateGate(parseTrainerMetrics(stdout));
    expect(gate.promote).toBe(false);
    expect(gate.reason).toMatch(/MAE/);
  });

  it("rejects a candidate with PSI drift above 0.25 even with MAE win", () => {
    const stdout = JSON.stringify({
      stage: "metrics",
      modelId: "m_new",
      mae: 0.10,
      productionMae: 0.25,
      psi: 0.42,
    });
    const gate = evaluateGate(parseTrainerMetrics(stdout));
    expect(gate.promote).toBe(false);
    expect(gate.reason).toMatch(/PSI/);
  });

  it("emits no candidate when the trainer prints non-metrics output", () => {
    const metrics = parseTrainerMetrics("trainer crashed\nstack trace...");
    expect(metrics.modelId).toBeUndefined();
    const gate = evaluateGate(metrics);
    expect(gate.promote).toBe(false);
    expect(gate.reason).toMatch(/no candidate/);
  });
});
