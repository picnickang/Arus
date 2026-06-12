/**
 * Model Evaluation Gate
 *
 * GAP FILL #5: Prevents deploying a model that's worse than the one it replaces.
 *
 * Problem: New models are trained and deployed without any automated check
 * that they actually perform better than the current production model.
 *
 * Solution: Before any model deployment, automatically evaluate on a held-out
 * test set and reject if metrics don't meet thresholds or are worse than
 * the current production model.
 *
 * Usage:
 *   const gate = new ModelEvaluationGate(db);
 *   const result = await gate.evaluate(orgId, newModelId, testData);
 *   if (result.approved) { deploy(newModelId); }
 *   else { logger.warn("Model rejected:", result.reason); }
 */

import { logger } from "../../utils/logger";
import type { db as DbInstance } from "../../db";

const LOG_CTX = "ModelEvaluationGate";

type DbHandle = typeof DbInstance;

// ============================================================================
// Types
// ============================================================================

export interface TestDataPoint {
  features: Record<string, number>; // sensor readings
  label: 0 | 1; // 0 = no failure, 1 = failure
  predictedProbability?: number; // filled in by evaluation
}

/**
 * Held-out evaluation inputs a training run can surface so the gate can run
 * for real. When a training result carries this, the job queue runs the
 * ModelEvaluationGate; when it does not, the run is honestly recorded as
 * "not_evaluated" (never an unconditional "passed").
 */
export interface ModelEvaluationInputs {
  /** ID of the freshly trained model being evaluated for deployment. */
  modelId: string;
  /** Held-out, labelled test set. */
  testData: TestDataPoint[];
  /** Returns a failure probability in [0,1] for a feature vector. */
  predict: (features: Record<string, number>) => Promise<number>;
}

interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auroc: number;
  brierScore: number;
  sampleSize: number;
  evaluatedAt: Date;
}

interface PredictionFailureMetrics {
  total: number;
  succeeded: number;
  failed: number;
  errorRate: number;
  /** Sample of failure messages, capped to avoid unbounded growth. */
  sampleFailureMessages: string[];
}

interface GateResult {
  approved: boolean;
  newModelMetrics: EvaluationMetrics;
  currentModelMetrics: EvaluationMetrics | null;
  reason: string;
  details: {
    meetsAbsoluteThreshold: boolean;
    beatsCurrentModel: boolean;
    withinFailureBudget: boolean;
    absoluteThresholds: Record<string, number>;
    improvements: Record<string, number>;
    predictionFailures: PredictionFailureMetrics;
  };
}

interface GateConfig {
  /** Minimum accuracy to pass the gate */
  minAccuracy: number;
  /** Minimum precision (avoid too many false alarms) */
  minPrecision: number;
  /** Minimum recall (don't miss actual failures) */
  minRecall: number;
  /** Minimum F1 score */
  minF1: number;
  /** Maximum allowed Brier score (lower = better calibration) */
  maxBrierScore: number;
  /** Minimum test data points required */
  minTestSamples: number;
  /** Must be at least this much better than current model on F1 to justify deployment */
  minImprovementF1: number;
  /**
   * Maximum fraction of test samples that may fail inference (errors
   * thrown by predictFn) before the candidate is rejected. Prior to
   * this gate, silent per-sample skips could let a systematically
   * broken model pass on the surviving subset.
   */
  maxFailureRate: number;
}

const DEFAULT_CONFIG: GateConfig = {
  minAccuracy: 0.7,
  minPrecision: 0.6,
  minRecall: 0.65, // Higher recall requirement — missing failures is worse than false alarms
  minF1: 0.65,
  maxBrierScore: 0.25,
  minTestSamples: 50,
  minImprovementF1: 0.0, // 0 = just needs to be no worse; set to e.g. 0.02 to require improvement
  maxFailureRate: 0.1, // reject if >10% of test samples error during inference
};

const MAX_SAMPLE_FAILURE_MESSAGES = 5;

// ============================================================================
// Metric Computation
// ============================================================================

function computeMetrics(
  predictions: Array<{ predicted: number; actual: 0 | 1 }>,
  threshold = 0.5
): EvaluationMetrics {
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  let brierSum = 0;

  for (const { predicted, actual } of predictions) {
    const predictedClass = predicted >= threshold ? 1 : 0;

    if (predictedClass === 1 && actual === 1) {
      tp++;
    } else if (predictedClass === 1 && actual === 0) {
      fp++;
    } else if (predictedClass === 0 && actual === 0) {
      tn++;
    } else {
      fn++;
    }

    brierSum += (predicted - actual) ** 2;
  }

  const total = tp + fp + tn + fn;
  const accuracy = total > 0 ? (tp + tn) / total : 0;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;
  const brierScore = total > 0 ? brierSum / total : 1;

  // AUROC approximation via trapezoidal rule on sorted thresholds
  const auroc = computeAUROC(predictions);

  return {
    accuracy,
    precision,
    recall,
    f1Score,
    auroc,
    brierScore,
    sampleSize: total,
    evaluatedAt: new Date(),
  };
}

function computeAUROC(predictions: Array<{ predicted: number; actual: 0 | 1 }>): number {
  const sorted = [...predictions].sort((a, b) => b.predicted - a.predicted);

  const totalPositive = predictions.filter((p) => p.actual === 1).length;
  const totalNegative = predictions.filter((p) => p.actual === 0).length;

  if (totalPositive === 0 || totalNegative === 0) {
    return 0.5;
  } // undefined, return random

  let tpRate = 0,
    fpRate = 0,
    prevTpRate = 0,
    prevFpRate = 0;
  let auc = 0;
  let tp = 0,
    fp = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]?.actual === 1) {
      tp++;
    } else {
      fp++;
    }

    tpRate = tp / totalPositive;
    fpRate = fp / totalNegative;

    // Trapezoidal area
    auc += ((fpRate - prevFpRate) * (tpRate + prevTpRate)) / 2;

    prevTpRate = tpRate;
    prevFpRate = fpRate;
  }

  return auc;
}

// ============================================================================
// Main Service
// ============================================================================

export class ModelEvaluationGate {
  private db: DbHandle;
  private config: GateConfig;

  constructor(db: DbHandle, config?: Partial<GateConfig>) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate a new model against test data and the current production model.
   *
   * @param orgId - Organization ID
   * @param newModelId - ID of the model being evaluated for deployment
   * @param testData - Held-out test dataset with labels
   * @param predictFn - Function that takes features and returns a failure probability [0,1]
   * @returns GateResult indicating whether the model is approved for deployment
   */
  async evaluate(
    orgId: string,
    newModelId: string,
    testData: TestDataPoint[],
    predictFn: (features: Record<string, number>) => Promise<number>
  ): Promise<GateResult> {
    logger.info(LOG_CTX, `Evaluating model ${newModelId} on ${testData.length} test samples`, {
      orgId,
    });

    // Validate test data size
    if (testData.length < this.config.minTestSamples) {
      return {
        approved: false,
        newModelMetrics: computeMetrics([]),
        currentModelMetrics: null,
        reason: `Insufficient test data: ${testData.length} samples (need ${this.config.minTestSamples})`,
        details: {
          meetsAbsoluteThreshold: false,
          beatsCurrentModel: false,
          withinFailureBudget: true,
          absoluteThresholds: this.getThresholds(),
          improvements: {},
          predictionFailures: emptyFailureMetrics(testData.length),
        },
      };
    }

    // 1. Generate predictions for the new model. Per-sample failures
    //    are tallied (not silently swallowed) so a candidate whose
    //    inference path is systematically broken on a subset cannot
    //    sneak through the gate on the surviving samples alone.
    const predictions: Array<{ predicted: number; actual: 0 | 1 }> = [];
    let failed = 0;
    const sampleFailureMessages: string[] = [];

    for (const dataPoint of testData) {
      try {
        const prob = await predictFn(dataPoint.features);
        predictions.push({ predicted: prob, actual: dataPoint.label });
      } catch (error) {
        failed++;
        if (sampleFailureMessages.length < MAX_SAMPLE_FAILURE_MESSAGES) {
          sampleFailureMessages.push(error instanceof Error ? error.message : String(error));
        }
        logger.warn(LOG_CTX, `Prediction failed for sample`, error);
      }
    }

    const failureMetrics: PredictionFailureMetrics = {
      total: testData.length,
      succeeded: predictions.length,
      failed,
      errorRate: testData.length > 0 ? failed / testData.length : 0,
      sampleFailureMessages,
    };
    const withinFailureBudget = failureMetrics.errorRate <= this.config.maxFailureRate;

    if (predictions.length < this.config.minTestSamples) {
      return {
        approved: false,
        newModelMetrics: computeMetrics(predictions),
        currentModelMetrics: null,
        reason: `Too many prediction failures: only ${predictions.length}/${testData.length} succeeded`,
        details: {
          meetsAbsoluteThreshold: false,
          beatsCurrentModel: false,
          withinFailureBudget,
          absoluteThresholds: this.getThresholds(),
          improvements: {},
          predictionFailures: failureMetrics,
        },
      };
    }

    if (!withinFailureBudget) {
      const reason =
        `Prediction failure rate ${(failureMetrics.errorRate * 100).toFixed(1)}% ` +
        `exceeds budget ${(this.config.maxFailureRate * 100).toFixed(1)}% ` +
        `(${failed}/${testData.length} samples failed)`;
      await this.recordEvaluation(orgId, newModelId, computeMetrics(predictions), false, reason);
      return {
        approved: false,
        newModelMetrics: computeMetrics(predictions),
        currentModelMetrics: null,
        reason,
        details: {
          meetsAbsoluteThreshold: false,
          beatsCurrentModel: false,
          withinFailureBudget,
          absoluteThresholds: this.getThresholds(),
          improvements: {},
          predictionFailures: failureMetrics,
        },
      };
    }

    // 2. Compute metrics for the new model
    const newMetrics = computeMetrics(predictions);

    // 3. Check absolute thresholds
    const meetsAbsoluteThreshold =
      newMetrics.accuracy >= this.config.minAccuracy &&
      newMetrics.precision >= this.config.minPrecision &&
      newMetrics.recall >= this.config.minRecall &&
      newMetrics.f1Score >= this.config.minF1 &&
      newMetrics.brierScore <= this.config.maxBrierScore;

    // 4. Get current production model metrics (if any)
    const currentMetrics = await this.getCurrentModelMetrics(orgId, newModelId);

    // 5. Check if new model beats current
    let beatsCurrentModel = true;
    const improvements: Record<string, number> = {};

    if (currentMetrics) {
      improvements["accuracy"] = newMetrics.accuracy - currentMetrics.accuracy;
      improvements["precision"] = newMetrics.precision - currentMetrics.precision;
      improvements["recall"] = newMetrics.recall - currentMetrics.recall;
      improvements["f1Score"] = newMetrics.f1Score - currentMetrics.f1Score;
      improvements["auroc"] = newMetrics.auroc - currentMetrics.auroc;

      beatsCurrentModel = improvements["f1Score"] >= this.config.minImprovementF1;
    }

    // 6. Decision
    const approved = meetsAbsoluteThreshold && beatsCurrentModel;

    let reason: string;
    if (approved) {
      reason = `Model meets all thresholds${currentMetrics ? ` and improves F1 by ${((improvements["f1Score"] ?? 0) * 100).toFixed(1)}%` : ""}`;
    } else if (!meetsAbsoluteThreshold) {
      const failures: string[] = [];
      if (newMetrics.accuracy < this.config.minAccuracy) {
        failures.push(
          `accuracy ${(newMetrics.accuracy * 100).toFixed(1)}% < ${this.config.minAccuracy * 100}%`
        );
      }
      if (newMetrics.precision < this.config.minPrecision) {
        failures.push(
          `precision ${(newMetrics.precision * 100).toFixed(1)}% < ${this.config.minPrecision * 100}%`
        );
      }
      if (newMetrics.recall < this.config.minRecall) {
        failures.push(
          `recall ${(newMetrics.recall * 100).toFixed(1)}% < ${this.config.minRecall * 100}%`
        );
      }
      if (newMetrics.f1Score < this.config.minF1) {
        failures.push(`F1 ${(newMetrics.f1Score * 100).toFixed(1)}% < ${this.config.minF1 * 100}%`);
      }
      if (newMetrics.brierScore > this.config.maxBrierScore) {
        failures.push(`Brier ${newMetrics.brierScore.toFixed(3)} > ${this.config.maxBrierScore}`);
      }
      reason = `Below absolute thresholds: ${failures.join("; ")}`;
    } else {
      reason = `Does not improve over current model: F1 change = ${((improvements["f1Score"] ?? 0) * 100).toFixed(1)}% (need ≥${(this.config.minImprovementF1 * 100).toFixed(1)}%)`;
    }

    // 7. Record the evaluation
    await this.recordEvaluation(orgId, newModelId, newMetrics, approved, reason);

    logger.info(LOG_CTX, `Evaluation result: ${approved ? "APPROVED" : "REJECTED"} — ${reason}`, {
      orgId,
      modelId: newModelId,
      f1: newMetrics.f1Score.toFixed(3),
      auroc: newMetrics.auroc.toFixed(3),
    });

    return {
      approved,
      newModelMetrics: newMetrics,
      currentModelMetrics: currentMetrics,
      reason,
      details: {
        meetsAbsoluteThreshold,
        beatsCurrentModel,
        withinFailureBudget,
        absoluteThresholds: this.getThresholds(),
        improvements,
        predictionFailures: failureMetrics,
      },
    };
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private getThresholds(): Record<string, number> {
    return {
      minAccuracy: this.config.minAccuracy,
      minPrecision: this.config.minPrecision,
      minRecall: this.config.minRecall,
      minF1: this.config.minF1,
      maxBrierScore: this.config.maxBrierScore,
    };
  }

  private async getCurrentModelMetrics(
    orgId: string,
    excludeModelId: string
  ): Promise<EvaluationMetrics | null> {
    try {
      const { modelPerformanceValidations } = await import("@shared/schema");
      const { eq, and, not, sql } = await import("drizzle-orm");

      // Get the most recent validation row for this org that isn't the model
      // being evaluated. The aggregate metrics live in the jsonb
      // `performanceMetrics` column (model_performance_validations is a per-
      // equipment per-prediction table, not a per-model summary table).
      const [latestValidation] = await this.db
        .select()
        .from(modelPerformanceValidations)
        .where(
          and(
            eq(modelPerformanceValidations.orgId, orgId),
            not(eq(modelPerformanceValidations.modelId, excludeModelId))
          )
        )
        .orderBy(sql`${modelPerformanceValidations.validatedAt} DESC NULLS LAST`)
        .limit(1);

      if (!latestValidation) {
        return null;
      }

      const pm = (latestValidation.performanceMetrics ?? {}) as Record<string, unknown>;
      const num = (key: string, fallback: number): number => {
        const v = pm[key];
        return typeof v === "number" && Number.isFinite(v) ? v : fallback;
      };

      const accuracy = latestValidation.accuracyScore ?? num("accuracy", 0);
      const sampleSize = num("sampleSize", num("totalSamples", 0));

      return {
        accuracy,
        precision: num("precision", 0),
        recall: num("recall", 0),
        f1Score: num("f1Score", 0),
        auroc: num("auroc", 0),
        brierScore: num("brierScore", 0),
        sampleSize,
        evaluatedAt: latestValidation.validatedAt
          ? new Date(latestValidation.validatedAt)
          : latestValidation.createdAt
            ? new Date(latestValidation.createdAt)
            : new Date(),
      };
    } catch (error) {
      logger.warn(LOG_CTX, "Failed to read current model metrics", error);
      return null;
    }
  }

  private async recordEvaluation(
    orgId: string,
    modelId: string,
    metrics: EvaluationMetrics,
    approved: boolean,
    reason: string
  ): Promise<void> {
    // model_performance_validations is keyed per equipment (FK NOT NULL).
    // Gate evaluations are model-level aggregates with no equipment context,
    // so a direct insert would always fail the equipment_id FK. Log the
    // outcome here; per-equipment rows are written by the outcome tracker.
    logger.info(LOG_CTX, "Gate evaluation recorded (not persisted to per-equipment table)", {
      orgId,
      modelId,
      approved,
      reason,
      accuracy: metrics.accuracy,
      f1Score: metrics.f1Score,
      sampleSize: metrics.sampleSize,
    });
  }
}

function emptyFailureMetrics(total: number): PredictionFailureMetrics {
  return { total, succeeded: 0, failed: 0, errorRate: 0, sampleFailureMessages: [] };
}
