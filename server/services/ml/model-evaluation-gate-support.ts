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

export interface EvaluationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auroc: number;
  brierScore: number;
  sampleSize: number;
  evaluatedAt: Date;
}

export interface PredictionFailureMetrics {
  total: number;
  succeeded: number;
  failed: number;
  errorRate: number;
  /** Sample of failure messages, capped to avoid unbounded growth. */
  sampleFailureMessages: string[];
}

export interface GateResult {
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

export interface GateConfig {
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

export const DEFAULT_CONFIG: GateConfig = {
  minAccuracy: 0.7,
  minPrecision: 0.6,
  minRecall: 0.65, // Higher recall requirement — missing failures is worse than false alarms
  minF1: 0.65,
  maxBrierScore: 0.25,
  minTestSamples: 50,
  minImprovementF1: 0.0, // 0 = just needs to be no worse; set to e.g. 0.02 to require improvement
  maxFailureRate: 0.1, // reject if >10% of test samples error during inference
};

// ============================================================================
// Metric Computation
// ============================================================================

export function computeMetrics(
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

export function emptyFailureMetrics(total: number): PredictionFailureMetrics {
  return { total, succeeded: 0, failed: 0, errorRate: 0, sampleFailureMessages: [] };
}
