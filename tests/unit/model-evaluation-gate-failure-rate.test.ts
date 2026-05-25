/**
 * P2 #9 — ModelEvaluationGate must surface per-sample inference
 * failures and reject a candidate when the error rate exceeds the
 * configured budget, instead of silently scoring on the surviving
 * subset.
 */
import { describe, it, expect } from "@jest/globals";
import { ModelEvaluationGate } from "../../server/services/ml/model-evaluation-gate";

type TestPoint = { features: Record<string, number>; label: 0 | 1 };

function makeData(n: number, positiveRate = 0.5): TestPoint[] {
  const out: TestPoint[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      features: { x: i },
      label: i / n < positiveRate ? 1 : 0,
    });
  }
  return out;
}

// Cast the db arg to the expected drizzle handle shape via `unknown`
// indirection — the gate's recordEvaluation only logs and never
// touches db here. We only need a placeholder to satisfy the
// constructor signature in this unit test.
function newGate(config?: { maxFailureRate?: number; minTestSamples?: number }) {
  const stubDb = {} as unknown as ConstructorParameters<typeof ModelEvaluationGate>[0];
  return new ModelEvaluationGate(stubDb, {
    ...(config?.maxFailureRate !== undefined ? { maxFailureRate: config.maxFailureRate } : {}),
    minTestSamples: config?.minTestSamples ?? 10,
  });
}

describe("ModelEvaluationGate — prediction failure budget (P2 #9)", () => {
  it("tracks succeeded/failed counts and an errorRate in details", async () => {
    const gate = newGate({ maxFailureRate: 0.5, minTestSamples: 10 });
    const data = makeData(20);
    let i = 0;
    const result = await gate.evaluate("org-1", "m1", data, async () => {
      // Fail every 4th sample → errorRate = 0.25
      if (++i % 4 === 0) {
        throw new Error("synthetic failure");
      }
      return 0.6;
    });
    expect(result.details.predictionFailures.total).toBe(20);
    expect(result.details.predictionFailures.failed).toBe(5);
    expect(result.details.predictionFailures.succeeded).toBe(15);
    expect(result.details.predictionFailures.errorRate).toBeCloseTo(0.25, 5);
    expect(result.details.predictionFailures.sampleFailureMessages.length).toBeGreaterThan(0);
    expect(result.details.withinFailureBudget).toBe(true);
  });

  it("rejects promotion when errorRate exceeds maxFailureRate", async () => {
    const gate = newGate({ maxFailureRate: 0.1, minTestSamples: 5 });
    const data = makeData(20);
    let i = 0;
    const result = await gate.evaluate("org-1", "m2", data, async () => {
      // Fail every other sample → errorRate = 0.5, well above 0.1
      if (++i % 2 === 0) {
        throw new Error("synthetic failure");
      }
      return 0.9;
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/failure rate/i);
    expect(result.details.withinFailureBudget).toBe(false);
    expect(result.details.predictionFailures.errorRate).toBeCloseTo(0.5, 5);
  });

  it("treats a clean run as within the failure budget", async () => {
    const gate = newGate({ maxFailureRate: 0.1, minTestSamples: 10 });
    const data = makeData(20);
    const result = await gate.evaluate("org-1", "m3", data, async () => 0.5);
    expect(result.details.predictionFailures.failed).toBe(0);
    expect(result.details.predictionFailures.errorRate).toBe(0);
    expect(result.details.withinFailureBudget).toBe(true);
  });
});
