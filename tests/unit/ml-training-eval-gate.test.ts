/**
 * ML training eval-gate honesty (security follow-up — Finding 3).
 *
 * The training job queue used to hard-code `evaluationPassed = true` for every
 * completed run, claiming a model passed an evaluation that never ran. This
 * pins the corrected behaviour:
 *   - A run with NO held-out test data is reported as "not_evaluated", never
 *     "passed".
 *   - When held-out test data IS present the real ModelEvaluationGate runs and
 *     its verdict maps to "passed" / "failed".
 *   - A gate error degrades to "not_evaluated" — it is never laundered into a
 *     spurious "passed".
 *
 * `runEvaluationGate` is private; we reach it via a typed cast (private is a
 * compile-time-only marker — the method exists at runtime). The gate's
 * `getCurrentModelMetrics` performs a db read that throws against the stub db
 * and is caught internally (current model = null), so a perfect predictor is
 * approved purely on its absolute metrics.
 */
import { describe, it, expect } from "@jest/globals";
import PgBoss from "pg-boss";
import { MlTrainingJobQueue } from "../../server/services/ml/ml-training-job-queue";
import type { ModelEvaluationInputs } from "../../server/services/ml/model-evaluation-gate";
import type { TrainingResult } from "../../server/ml-training-pipeline";

type EvalStatus = "passed" | "not_evaluated" | "failed";

interface GateRunner {
  runEvaluationGate(orgId: string, result: TrainingResult | undefined): Promise<EvalStatus>;
}

function newQueue(withDb = true): GateRunner {
  const boss = {} as unknown as PgBoss;
  const db = withDb ? ({} as unknown as Parameters<typeof MlTrainingJobQueue>[1]) : undefined;
  const queue = new MlTrainingJobQueue(boss, db);
  return queue as unknown as GateRunner;
}

function makeTestData(n: number): ModelEvaluationInputs["testData"] {
  const out: ModelEvaluationInputs["testData"] = [];
  for (let i = 0; i < n; i++) {
    out.push({ features: { x: i }, label: i % 2 === 0 ? 1 : 0 });
  }
  return out;
}

function resultWith(evaluation?: ModelEvaluationInputs): TrainingResult {
  return {
    modelPath: null,
    metrics: {},
    trainedAt: new Date(),
    ...(evaluation ? { evaluation } : {}),
  };
}

describe("ML training eval-gate — honest status reporting (Finding 3)", () => {
  it("reports not_evaluated when the run carries no result at all", async () => {
    const status = await newQueue().runEvaluationGate("org-1", undefined);
    expect(status).toBe("not_evaluated");
  });

  it("reports not_evaluated when the result has no held-out evaluation data", async () => {
    const status = await newQueue().runEvaluationGate("org-1", resultWith());
    expect(status).toBe("not_evaluated");
  });

  it("reports not_evaluated when the test set is empty (never 'passed')", async () => {
    const evaluation: ModelEvaluationInputs = {
      modelId: "m1",
      testData: [],
      predict: async () => 0.9,
    };
    const status = await newQueue().runEvaluationGate("org-1", resultWith(evaluation));
    expect(status).toBe("not_evaluated");
  });

  it("reports not_evaluated when no db handle is available", async () => {
    const evaluation: ModelEvaluationInputs = {
      modelId: "m1",
      testData: makeTestData(60),
      predict: async (f) => (f["x"]! % 2 === 0 ? 1 : 0),
    };
    const status = await newQueue(false).runEvaluationGate("org-1", resultWith(evaluation));
    expect(status).toBe("not_evaluated");
  });

  it("reports passed when a perfect predictor clears the gate thresholds", async () => {
    const evaluation: ModelEvaluationInputs = {
      modelId: "m1",
      testData: makeTestData(60),
      // Perfect predictor: returns the true label as its probability.
      predict: async (f) => (f["x"]! % 2 === 0 ? 1 : 0),
    };
    const status = await newQueue().runEvaluationGate("org-1", resultWith(evaluation));
    expect(status).toBe("passed");
  });

  it("reports failed when the predictor cannot clear the absolute thresholds", async () => {
    const evaluation: ModelEvaluationInputs = {
      modelId: "m1",
      testData: makeTestData(60),
      // Always predicts the positive class → accuracy 0.5, below minAccuracy.
      predict: async () => 0.5,
    };
    const status = await newQueue().runEvaluationGate("org-1", resultWith(evaluation));
    expect(status).toBe("failed");
  });

  it("never reports passed when the predictor is systematically broken", async () => {
    const evaluation: ModelEvaluationInputs = {
      modelId: "m1",
      testData: makeTestData(60),
      predict: async () => {
        throw new Error("predictor exploded");
      },
    };
    // Every prediction throws → the gate rejects (too many failures). The key
    // invariant: a broken predictor is never green-lit as "passed".
    const status = await newQueue().runEvaluationGate("org-1", resultWith(evaluation));
    expect(status).not.toBe("passed");
  });
});
