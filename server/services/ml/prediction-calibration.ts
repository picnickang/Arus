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
import type { db as DbInstance } from "../../db";
import {
  applyIsotonicRegression,
  applyPlattScaling,
  computeBrierScore,
  computeCalibrationBins,
  computeECE,
  computeMCE,
  fitIsotonicRegression,
  fitPlattScaling,
  type CalibrationDataPoint,
  type CalibrationModel,
  type CalibrationReport,
  type IsotonicMapping,
  type PlattParameters,
} from "./prediction-calibration-math";

type DbHandle = typeof DbInstance;

// ============================================================================
// Main Calibration Service
// ============================================================================

// In-memory cache of fitted calibration models per org:model
const calibrationCache = new Map<string, CalibrationModel>();

export class PredictionCalibrator {
  private db: DbHandle;

  constructor(db: DbHandle) {
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
      logger.warn(
        "PredictionCalibrator",
        `Insufficient data for calibration: ${data.length} points (need ${minDataPoints})`,
        { orgId, modelId }
      );
      return null;
    }

    // Choose method
    const selectedMethod = method === "auto" ? (data.length >= 500 ? "isotonic" : "platt") : method;

    logger.info(
      "PredictionCalibrator",
      `Fitting ${selectedMethod} calibration on ${data.length} data points`,
      { orgId, modelId }
    );

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

    logger.info(
      "PredictionCalibrator",
      `Calibration fitted. Brier: ${brierBefore.toFixed(4)} → ${brierAfter.toFixed(4)}, ECE: ${ece.toFixed(4)}`,
      { orgId, modelId }
    );

    return model;
  }

  /**
   * Calibrate a raw prediction probability using the fitted model.
   * Returns the raw probability if no calibration model exists.
   */
  calibrate(rawProbability: number, orgId: string, modelId?: string): number {
    const cacheKey = `${orgId}:${modelId || "all"}`;
    const model = calibrationCache.get(cacheKey);

    if (!model) {
      return rawProbability;
    }

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

    if (!model) {
      return null;
    }

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
  private async fetchCalibrationData(
    orgId: string,
    modelId?: string
  ): Promise<CalibrationDataPoint[]> {
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
        if (!pred.predictedFailureDate) {
          continue;
        }

        const predictedDate = new Date(pred.predictedFailureDate);
        // failure_predictions has no `createdAt`; `predictionTimestamp` has
        // a defaultNow() so it is always populated.
        void pred.predictionTimestamp;

        // Only use predictions whose window has already passed (we know the outcome)
        if (predictedDate > new Date()) {
          continue;
        }

        // Check if a corrective/emergency work order was created for this equipment
        // within a window around the predicted failure date (±7 days)
        const windowStart = new Date(predictedDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const windowEnd = new Date(predictedDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        const relatedWorkOrders = await this.db
          .select()
          .from(workOrders)
          .where(
            and(
              eq(workOrders.equipmentId, pred.equipmentId),
              eq(workOrders.orgId, orgId),
              gte(workOrders.createdAt, windowStart),
              lte(workOrders.createdAt, windowEnd)
            )
          )
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
