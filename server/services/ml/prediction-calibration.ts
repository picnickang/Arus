/**
 * Prediction Calibration Service
 *
 * GAP FILL #1: Makes prediction confidence scores actually meaningful.
 *
 * Problem: Models output raw probabilities that don't correspond to real-world
 * failure rates. A model saying "0.85 confidence" doesn't mean 85% of similar
 * predictions are correct.
 *
 * Solution: Two calibration methods:
 * - Platt Scaling: Fits a logistic regression on model outputs vs actual outcomes
 * - Isotonic Regression: Non-parametric monotonic mapping (more flexible, needs more data)
 *
 * Usage:
 *   const calibrator = new PredictionCalibrator(db);
 *   await calibrator.fitFromHistory(orgId, modelId);           // Train on past predictions
 *   const calibrated = calibrator.calibrate(rawProbability);    // Calibrate new predictions
 *   const report = await calibrator.getCalibrationReport(orgId, modelId); // Reliability diagram data
 */

import { logger } from "../../utils/logger";

// ============================================================================
// Types
// ============================================================================

interface CalibrationDataPoint {
  predictedProbability: number;
  actualOutcome: 0 | 1; // 0 = no failure occurred, 1 = failure occurred
}

interface PlattParameters {
  a: number; // slope
  b: number; // intercept
}

interface IsotonicMapping {
  thresholds: number[]; // sorted predicted probabilities
  values: number[];     // corresponding calibrated probabilities
}

interface CalibrationModel {
  method: "platt" | "isotonic";
  plattParams?: PlattParameters;
  isotonicMapping?: IsotonicMapping;
  dataPointCount: number;
  fittedAt: Date;
  metrics: {
    brierScoreBefore: number;
    brierScoreAfter: number;
    ece: number; // Expected Calibration Error
    mce: number; // Maximum Calibration Error
  };
}

interface CalibrationBin {
  binStart: number;
  binEnd: number;
  avgPredicted: number;
  avgActual: number;
  count: number;
  gap: number; // |avgPredicted - avgActual|
}

export interface CalibrationReport {
  modelId: string;
  orgId: string;
  method: string;
  dataPoints: number;
  fittedAt: Date;
  brierScoreBefore: number;
  brierScoreAfter: number;
  expectedCalibrationError: number;
  maxCalibrationError: number;
  reliabilityDiagram: CalibrationBin[];
  isCalibrated: boolean;
}

// ============================================================================
// Platt Scaling Implementation
// ============================================================================

/**
 * Fits a sigmoid (logistic) function to map raw model outputs to calibrated probabilities.
 * Minimizes negative log-likelihood using gradient descent.
 *
 * P_calibrated = 1 / (1 + exp(a * f + b))
 * where f is the raw model output
 */
function fitPlattScaling(data: CalibrationDataPoint[], maxIter = 100, lr = 0.01): PlattParameters {
  let a = 0;
  let b = 0;

  // Use Newton's method / gradient descent
  for (let iter = 0; iter < maxIter; iter++) {
    let gradA = 0;
    let gradB = 0;

    for (const { predictedProbability: f, actualOutcome: y } of data) {
      const p = 1 / (1 + Math.exp(a * f + b));
      const diff = p - y;
      gradA += diff * f;
      gradB += diff;
    }

    gradA /= data.length;
    gradB /= data.length;

    a -= lr * gradA;
    b -= lr * gradB;

    // Early stopping if gradients are tiny
    if (Math.abs(gradA) < 1e-8 && Math.abs(gradB) < 1e-8) {break;}
  }

  return { a, b };
}

function applyPlattScaling(rawProbability: number, params: PlattParameters): number {
  const calibrated = 1 / (1 + Math.exp(params.a * rawProbability + params.b));
  return Math.max(0, Math.min(1, calibrated));
}

// ============================================================================
// Isotonic Regression Implementation
// ============================================================================

/**
 * Pool Adjacent Violators (PAV) algorithm for isotonic regression.
 * Produces a non-decreasing mapping from predicted to actual probabilities.
 * More flexible than Platt scaling but needs more data (~500+ points).
 */
function fitIsotonicRegression(data: CalibrationDataPoint[]): IsotonicMapping {
  // Sort by predicted probability
  const sorted = [...data].sort((a, b) => a.predictedProbability - b.predictedProbability);

  // PAV algorithm
  const n = sorted.length;
  const values = sorted.map(d => d.actualOutcome as number);
  const weights = new Array(n).fill(1);

  // Pool adjacent violators
  let i = 0;
  while (i < n - 1) {
    if (values[i] > values[i + 1]) {
      // Pool these two blocks
      const totalWeight = weights[i] + weights[i + 1];
      const pooledValue = (values[i] * weights[i] + values[i + 1] * weights[i + 1]) / totalWeight;

      values[i] = pooledValue;
      weights[i] = totalWeight;

      // Remove the next element
      values.splice(i + 1, 1);
      weights.splice(i + 1, 1);
      sorted.splice(i + 1, 1);

      // Check backwards for violations
      if (i > 0) {i--;}
    } else {
      i++;
    }
  }

  return {
    thresholds: sorted.map(d => d.predictedProbability),
    values,
  };
}

function applyIsotonicRegression(rawProbability: number, mapping: IsotonicMapping): number {
  const { thresholds, values } = mapping;

  if (thresholds.length === 0) {return rawProbability;}
  if (rawProbability <= thresholds[0]) {return values[0];}
  if (rawProbability >= thresholds[thresholds.length - 1]) {return values[values.length - 1];}

  // Binary search for the right interval
  let lo = 0;
  let hi = thresholds.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (thresholds[mid] <= rawProbability) {lo = mid;}
    else {hi = mid;}
  }

  // Linear interpolation between the two nearest points
  const t = (rawProbability - thresholds[lo]) / (thresholds[hi] - thresholds[lo]);
  const calibrated = values[lo] + t * (values[hi] - values[lo]);
  return Math.max(0, Math.min(1, calibrated));
}

// ============================================================================
// Calibration Metrics
// ============================================================================

function computeBrierScore(data: CalibrationDataPoint[], calibrateFn?: (p: number) => number): number {
  let sum = 0;
  for (const { predictedProbability, actualOutcome } of data) {
    const p = calibrateFn ? calibrateFn(predictedProbability) : predictedProbability;
    sum += (p - actualOutcome) ** 2;
  }
  return sum / data.length;
}

function computeCalibrationBins(data: CalibrationDataPoint[], numBins = 10, calibrateFn?: (p: number) => number): CalibrationBin[] {
  const bins: CalibrationBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const binStart = i / numBins;
    const binEnd = (i + 1) / numBins;

    const binData = data.filter(d => {
      const p = calibrateFn ? calibrateFn(d.predictedProbability) : d.predictedProbability;
      return p >= binStart && (i === numBins - 1 ? p <= binEnd : p < binEnd);
    });

    if (binData.length === 0) {
      bins.push({ binStart, binEnd, avgPredicted: (binStart + binEnd) / 2, avgActual: 0, count: 0, gap: 0 });
      continue;
    }

    const avgPredicted = binData.reduce((s, d) => {
      const p = calibrateFn ? calibrateFn(d.predictedProbability) : d.predictedProbability;
      return s + p;
    }, 0) / binData.length;

    const avgActual = binData.reduce((s, d) => s + d.actualOutcome, 0) / binData.length;

    bins.push({
      binStart,
      binEnd,
      avgPredicted,
      avgActual,
      count: binData.length,
      gap: Math.abs(avgPredicted - avgActual),
    });
  }

  return bins;
}

function computeECE(bins: CalibrationBin[], totalPoints: number): number {
  let ece = 0;
  for (const bin of bins) {
    if (bin.count === 0) {continue;}
    ece += (bin.count / totalPoints) * bin.gap;
  }
  return ece;
}

function computeMCE(bins: CalibrationBin[]): number {
  return Math.max(...bins.filter(b => b.count > 0).map(b => b.gap), 0);
}

// ============================================================================
// Main Calibration Service
// ============================================================================

// In-memory cache of fitted calibration models per org:model
const calibrationCache = new Map<string, CalibrationModel>();

export class PredictionCalibrator {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Fit calibration model from historical prediction-outcome pairs.
   *
   * Pulls from failure_predictions (predicted probability) and joins against
   * actual maintenance events to determine if failure actually occurred within
   * the predicted window.
   *
   * NOTE: You must adapt the query below to your actual schema. The join logic
   * depends on how you record "a failure actually happened for this equipment
   * around the predicted time."
   */
  async fitFromHistory(
    orgId: string,
    modelId?: string,
    options?: { method?: "platt" | "isotonic" | "auto"; minDataPoints?: number }
  ): Promise<CalibrationModel | null> {
    const method = options?.method ?? "auto";
    const minDataPoints = options?.minDataPoints ?? 30;

    // Query prediction-outcome pairs
    // Adapt this to your schema — the key columns are:
    //   predicted_probability: float (model's raw output)
    //   actual_outcome: 0 or 1 (did failure actually occur within the predicted window?)
    const data = await this.fetchCalibrationData(orgId, modelId);

    if (data.length < minDataPoints) {
      logger.warn("PredictionCalibrator", `Insufficient data for calibration: ${data.length} points (need ${minDataPoints})`, { orgId, modelId });
      return null;
    }

    // Choose method
    const selectedMethod = method === "auto"
      ? (data.length >= 500 ? "isotonic" : "platt")
      : method;

    logger.info("PredictionCalibrator", `Fitting ${selectedMethod} calibration on ${data.length} data points`, { orgId, modelId });

    // Compute pre-calibration metrics
    const brierBefore = computeBrierScore(data);

    // Fit
    let plattParams: PlattParameters | undefined;
    let isotonicMapping: IsotonicMapping | undefined;
    let calibrateFn: (p: number) => number;

    if (selectedMethod === "platt") {
      plattParams = fitPlattScaling(data);
      calibrateFn = (p) => applyPlattScaling(p, plattParams!);
    } else {
      isotonicMapping = fitIsotonicRegression(data);
      calibrateFn = (p) => applyIsotonicRegression(p, isotonicMapping!);
    }

    // Compute post-calibration metrics
    const brierAfter = computeBrierScore(data, calibrateFn);
    const bins = computeCalibrationBins(data, 10, calibrateFn);
    const ece = computeECE(bins, data.length);
    const mce = computeMCE(bins);

    const model: CalibrationModel = {
      method: selectedMethod,
      plattParams,
      isotonicMapping,
      dataPointCount: data.length,
      fittedAt: new Date(),
      metrics: {
        brierScoreBefore: brierBefore,
        brierScoreAfter: brierAfter,
        ece,
        mce,
      },
    };

    // Cache
    const cacheKey = `${orgId}:${modelId || "all"}`;
    calibrationCache.set(cacheKey, model);

    logger.info("PredictionCalibrator", `Calibration fitted. Brier: ${brierBefore.toFixed(4)} → ${brierAfter.toFixed(4)}, ECE: ${ece.toFixed(4)}`, { orgId, modelId });

    return model;
  }

  /**
   * Calibrate a raw prediction probability using the fitted model.
   * Returns the raw probability if no calibration model exists.
   */
  calibrate(rawProbability: number, orgId: string, modelId?: string): number {
    const cacheKey = `${orgId}:${modelId || "all"}`;
    const model = calibrationCache.get(cacheKey);

    if (!model) {return rawProbability;}

    if (model.method === "platt" && model.plattParams) {
      return applyPlattScaling(rawProbability, model.plattParams);
    }

    if (model.method === "isotonic" && model.isotonicMapping) {
      return applyIsotonicRegression(rawProbability, model.isotonicMapping);
    }

    return rawProbability;
  }

  /**
   * Generate a calibration report with reliability diagram data.
   */
  async getCalibrationReport(orgId: string, modelId?: string): Promise<CalibrationReport | null> {
    const cacheKey = `${orgId}:${modelId || "all"}`;
    const model = calibrationCache.get(cacheKey);

    if (!model) {return null;}

    const data = await this.fetchCalibrationData(orgId, modelId);
    const calibrateFn = this.getCalibrateFn(model);
    const bins = computeCalibrationBins(data, 10, calibrateFn);

    return {
      modelId: modelId || "all",
      orgId,
      method: model.method,
      dataPoints: model.dataPointCount,
      fittedAt: model.fittedAt,
      brierScoreBefore: model.metrics.brierScoreBefore,
      brierScoreAfter: model.metrics.brierScoreAfter,
      expectedCalibrationError: model.metrics.ece,
      maxCalibrationError: model.metrics.mce,
      reliabilityDiagram: bins,
      isCalibrated: model.metrics.brierScoreAfter < model.metrics.brierScoreBefore,
    };
  }

  /**
   * Check if a calibration model exists for this org/model.
   */
  isCalibrated(orgId: string, modelId?: string): boolean {
    const cacheKey = `${orgId}:${modelId || "all"}`;
    return calibrationCache.has(cacheKey);
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  private getCalibrateFn(model: CalibrationModel): ((p: number) => number) | undefined {
    if (model.method === "platt" && model.plattParams) {
      const params = model.plattParams;
      return (p) => applyPlattScaling(p, params);
    }
    if (model.method === "isotonic" && model.isotonicMapping) {
      const mapping = model.isotonicMapping;
      return (p) => applyIsotonicRegression(p, mapping);
    }
    return undefined;
  }

  /**
   * Fetch prediction-outcome pairs from the database.
   *
   * ADAPT THIS to your schema. The logic:
   * 1. Get failure predictions with their predicted probability
   * 2. For each prediction, check if a failure/work order/alert actually occurred
   *    for that equipment within the predicted time window
   * 3. Return pairs of (predicted_probability, actual_outcome)
   */
  private async fetchCalibrationData(orgId: string, modelId?: string): Promise<CalibrationDataPoint[]> {
    try {
      const { failurePredictions, workOrders } = await import("@shared/schema");
      const { eq, and, sql, gte, lte } = await import("drizzle-orm");

      // Get all predictions for this org/model
      const conditions = [eq(failurePredictions.orgId, orgId)];
      if (modelId) {
        conditions.push(eq(failurePredictions.modelId, modelId));
      }

      const predictions = await this.db
        .select()
        .from(failurePredictions)
        .where(and(...conditions))
        .orderBy(sql`${failurePredictions.predictionTimestamp} ASC`);

      const dataPoints: CalibrationDataPoint[] = [];

      for (const pred of predictions) {
        // Skip predictions without a predicted failure date (can't verify outcome)
        if (!pred.predictedFailureDate) {continue;}

        const predictedDate = new Date(pred.predictedFailureDate);
        const predictionDate = new Date(pred.predictionTimestamp || pred.createdAt);

        // Only use predictions whose window has already passed (we know the outcome)
        if (predictedDate > new Date()) {continue;}

        // Check if a corrective/emergency work order was created for this equipment
        // within a window around the predicted failure date (±7 days)
        const windowStart = new Date(predictedDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(predictedDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        const relatedWorkOrders = await this.db
          .select()
          .from(workOrders)
          .where(and(
            eq(workOrders.equipmentId, pred.equipmentId),
            eq(workOrders.orgId, orgId),
            gte(workOrders.createdAt, windowStart),
            lte(workOrders.createdAt, windowEnd),
          ))
          .limit(1);

        const actualOutcome: 0 | 1 = relatedWorkOrders.length > 0 ? 1 : 0;

        dataPoints.push({
          predictedProbability: pred.failureProbability ?? 0.5,
          actualOutcome,
        });
      }

      return dataPoints;
    } catch (error) {
      logger.error("PredictionCalibrator", "Failed to fetch calibration data", error);
      return [];
    }
  }
}

export default PredictionCalibrator;
