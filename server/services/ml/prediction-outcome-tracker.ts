/**
 * Prediction Outcome Tracker
 *
 * GAP FILL #2: Closes the feedback loop from prediction → actual outcome → retraining.
 *
 * Problem: Models are trained once and degrade over time because they never learn
 * from whether their predictions were right or wrong.
 *
 * Solution: Automatically compares predictions against actual maintenance events,
 * records accuracy metrics, and triggers retraining when accuracy drops below threshold.
 *
 * Designed to run as a scheduled job (e.g., daily via pg-boss or cron).
 *
 * Usage:
 *   const tracker = new PredictionOutcomeTracker(db, { workOrderService, dbAlertStorage });
 *   const report = await tracker.evaluatePredictions(orgId);  // Run daily
 *   // Automatically triggers retraining if accuracy drops below threshold
 */

import { logger } from "../../utils/logger";

const LOG_CTX = "PredictionOutcomeTracker";

// ============================================================================
// Types
// ============================================================================

interface PredictionOutcome {
  predictionId: number;
  equipmentId: string;
  modelId: string | null;
  predictedProbability: number;
  predictedFailureDate: Date | null;
  riskLevel: string;
  actualOutcome: "true_positive" | "true_negative" | "false_positive" | "false_negative";
  outcomeRecordedAt: Date;
}

interface OutcomeEvaluationReport {
  orgId: string;
  evaluatedAt: Date;
  totalPredictionsEvaluated: number;
  totalAlreadyTracked: number;
  newOutcomesRecorded: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: {
    truePositive: number;
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
  };
  retrainingTriggered: boolean;
  retrainingReason: string | null;
  modelAccuracies: Record<string, { accuracy: number; total: number; shouldRetrain: boolean }>;
}

interface TrackerConfig {
  /** Days after predicted failure date to wait before evaluating outcome */
  outcomeWindowDays: number;
  /** Days before/after predicted date to look for actual failures */
  matchWindowDays: number;
  /** Accuracy threshold below which retraining is triggered */
  retrainAccuracyThreshold: number;
  /** Minimum predictions needed before evaluating a model */
  minPredictionsForEval: number;
}

const DEFAULT_CONFIG: TrackerConfig = {
  outcomeWindowDays: 14,
  matchWindowDays: 7,
  retrainAccuracyThreshold: 0.7,
  minPredictionsForEval: 20,
};

// ============================================================================
// Main Service
// ============================================================================

interface OutcomeTrackerDeps {
  getWorkOrders: (equipmentId?: string, orgId?: string) => Promise<any[]>;
  getAlertNotifications: (acknowledged?: boolean, orgId?: string) => Promise<any[]>;
}

export class PredictionOutcomeTracker {
  private db: any;
  private deps: OutcomeTrackerDeps;
  private config: TrackerConfig;

  constructor(db: any, deps: OutcomeTrackerDeps, config?: Partial<TrackerConfig>) {
    this.db = db;
    this.deps = deps;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point: evaluate all predictions whose window has passed.
   * Call this daily from a scheduled job.
   */
  async evaluatePredictions(orgId: string): Promise<OutcomeEvaluationReport> {
    const evaluatedAt = new Date();

    logger.info(LOG_CTX, `Starting prediction outcome evaluation for org ${orgId}`);

    // 1. Get predictions whose predicted failure window has passed
    const eligiblePredictions = await this.getEligiblePredictions(orgId);

    // 2. For each, determine actual outcome
    const outcomes: PredictionOutcome[] = [];
    let alreadyTracked = 0;

    for (const prediction of eligiblePredictions) {
      // Skip if we already recorded the outcome for this prediction
      const existing = await this.getExistingOutcome(prediction.id, orgId);
      if (existing) {
        alreadyTracked++;
        outcomes.push(existing);
        continue;
      }

      const outcome = await this.determineOutcome(prediction, orgId);
      outcomes.push(outcome);

      // Record the outcome
      await this.recordOutcome(outcome, orgId);
    }

    const newOutcomesRecorded = outcomes.length - alreadyTracked;

    // 3. Compute accuracy metrics
    const cm = this.computeConfusionMatrix(outcomes);
    const accuracy = outcomes.length > 0
      ? (cm.truePositive + cm.trueNegative) / outcomes.length
      : 0;
    const precision = (cm.truePositive + cm.falsePositive) > 0
      ? cm.truePositive / (cm.truePositive + cm.falsePositive)
      : 0;
    const recall = (cm.truePositive + cm.falseNegative) > 0
      ? cm.truePositive / (cm.truePositive + cm.falseNegative)
      : 0;
    const f1Score = (precision + recall) > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    // 4. Per-model accuracy
    const modelAccuracies = this.computePerModelAccuracy(outcomes);

    // 5. Check if retraining is needed
    let retrainingTriggered = false;
    let retrainingReason: string | null = null;

    const modelsNeedingRetrain = Object.entries(modelAccuracies)
      .filter(([, stats]) => stats.shouldRetrain)
      .map(([modelId]) => modelId);

    if (accuracy < this.config.retrainAccuracyThreshold && outcomes.length >= this.config.minPredictionsForEval) {
      retrainingTriggered = true;
      retrainingReason = `Overall accuracy ${(accuracy * 100).toFixed(1)}% below threshold ${(this.config.retrainAccuracyThreshold * 100).toFixed(0)}%`;
    } else if (modelsNeedingRetrain.length > 0) {
      retrainingTriggered = true;
      retrainingReason = `Models below threshold: ${modelsNeedingRetrain.join(", ")}`;
    }

    // 6. Trigger retraining if needed
    if (retrainingTriggered) {
      await this.triggerRetraining(orgId, modelsNeedingRetrain, retrainingReason!);
    }

    // 7. Store performance validation records for each model
    await this.recordPerformanceValidations(orgId, modelAccuracies, cm, evaluatedAt);

    const report: OutcomeEvaluationReport = {
      orgId,
      evaluatedAt,
      totalPredictionsEvaluated: outcomes.length,
      totalAlreadyTracked: alreadyTracked,
      newOutcomesRecorded,
      accuracy,
      precision,
      recall,
      f1Score,
      confusionMatrix: cm,
      retrainingTriggered,
      retrainingReason,
      modelAccuracies,
    };

    logger.info(LOG_CTX, `Evaluation complete: ${outcomes.length} predictions, accuracy=${(accuracy * 100).toFixed(1)}%, retrain=${retrainingTriggered}`, { orgId });

    return report;
  }

  // ===========================================================================
  // Private: Data fetching
  // ===========================================================================

  private async getEligiblePredictions(orgId: string): Promise<any[]> {
    const { failurePredictions } = await import("@shared/schema");
    const { eq, and, lte, sql } = await import("drizzle-orm");

    // Predictions whose predicted failure date is at least outcomeWindowDays in the past
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.outcomeWindowDays);

    return this.db
      .select()
      .from(failurePredictions)
      .where(and(
        eq(failurePredictions.orgId, orgId),
        lte(failurePredictions.predictedFailureDate, cutoff),
      ))
      .orderBy(sql`${failurePredictions.predictionTimestamp} DESC`)
      .limit(500); // Process in batches
  }

  private async getExistingOutcome(predictionId: number, orgId: string): Promise<PredictionOutcome | null> {
    try {
      const { predictionFeedback } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [existing] = await this.db
        .select()
        .from(predictionFeedback)
        .where(and(
          eq(predictionFeedback.predictionId, predictionId.toString()),
          eq(predictionFeedback.orgId, orgId),
          eq(predictionFeedback.feedbackType, "outcome_tracked"),
        ))
        .limit(1);

      if (!existing) {return null;}

      return {
        predictionId,
        equipmentId: existing.equipmentId,
        modelId: existing.modelId,
        predictedProbability: 0,
        predictedFailureDate: null,
        riskLevel: "",
        actualOutcome: existing.rating === 1 ? "true_positive" : "true_negative",
        outcomeRecordedAt: new Date(existing.submittedAt),
      };
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Private: Outcome determination
  // ===========================================================================

  /**
   * Determine if a predicted failure actually occurred.
   *
   * Checks for:
   * 1. Work orders created near the predicted date (corrective/emergency type)
   * 2. Alert notifications with critical/high severity
   * 3. Equipment status changes to "critical" or "down"
   */
  private async determineOutcome(prediction: any, orgId: string): Promise<PredictionOutcome> {
    const predictedDate = new Date(prediction.predictedFailureDate);
    const windowStart = new Date(predictedDate.getTime() - this.config.matchWindowDays * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(predictedDate.getTime() + this.config.matchWindowDays * 24 * 60 * 60 * 1000);

    const predicted = (prediction.failureProbability ?? 0) >= 0.5;

    // Check for actual failure evidence
    let failureOccurred = false;

    try {
      // Check work orders (most reliable signal)
      const workOrders = await this.deps.getWorkOrders(prediction.equipmentId, orgId);
      const relevantWOs = (workOrders || []).filter((wo: any) => {
        const woDate = new Date(wo.createdAt);
        return woDate >= windowStart && woDate <= windowEnd &&
          (wo.type === "corrective" || wo.type === "emergency" || wo.priority === 1);
      });

      if (relevantWOs.length > 0) {
        failureOccurred = true;
      }
    } catch {
      // Work order check failed, try alerts
    }

    if (!failureOccurred) {
      try {
        // Check alerts
        const alerts = await this.deps.getAlertNotifications(false, orgId);
        const relevantAlerts = (alerts || []).filter((alert: any) => {
          const alertDate = new Date(alert.createdAt);
          return alert.equipmentId === prediction.equipmentId &&
            alertDate >= windowStart && alertDate <= windowEnd &&
            (alert.severity === "critical" || alert.severity === "high");
        });

        if (relevantAlerts.length > 0) {
          failureOccurred = true;
        }
      } catch {
        // Alert check failed
      }
    }

    // Classify outcome
    let actualOutcome: PredictionOutcome["actualOutcome"];
    if (predicted && failureOccurred) {actualOutcome = "true_positive";}
    else if (predicted && !failureOccurred) {actualOutcome = "false_positive";}
    else if (!predicted && failureOccurred) {actualOutcome = "false_negative";}
    else {actualOutcome = "true_negative";}

    return {
      predictionId: prediction.id,
      equipmentId: prediction.equipmentId,
      modelId: prediction.modelId,
      predictedProbability: prediction.failureProbability ?? 0,
      predictedFailureDate: predictedDate,
      riskLevel: prediction.riskLevel || "unknown",
      actualOutcome,
      outcomeRecordedAt: new Date(),
    };
  }

  // ===========================================================================
  // Private: Recording and metrics
  // ===========================================================================

  private async recordOutcome(outcome: PredictionOutcome, orgId: string): Promise<void> {
    try {
      const { predictionFeedback } = await import("@shared/schema");

      await this.db.insert(predictionFeedback).values({
        orgId,
        predictionId: outcome.predictionId.toString(),
        equipmentId: outcome.equipmentId,
        modelId: outcome.modelId,
        feedbackType: "outcome_tracked",
        rating: outcome.actualOutcome === "true_positive" || outcome.actualOutcome === "true_negative" ? 1 : 0,
        comment: `Auto-tracked: ${outcome.actualOutcome}`,
        queryText: `Prediction ${outcome.predictionId}: prob=${outcome.predictedProbability.toFixed(3)}, outcome=${outcome.actualOutcome}`,
        submittedAt: outcome.outcomeRecordedAt,
      });
    } catch (error) {
      logger.warn(LOG_CTX, `Failed to record outcome for prediction ${outcome.predictionId}`, error);
    }
  }

  private computeConfusionMatrix(outcomes: PredictionOutcome[]) {
    return {
      truePositive: outcomes.filter(o => o.actualOutcome === "true_positive").length,
      trueNegative: outcomes.filter(o => o.actualOutcome === "true_negative").length,
      falsePositive: outcomes.filter(o => o.actualOutcome === "false_positive").length,
      falseNegative: outcomes.filter(o => o.actualOutcome === "false_negative").length,
    };
  }

  private computePerModelAccuracy(outcomes: PredictionOutcome[]): Record<string, { accuracy: number; total: number; shouldRetrain: boolean }> {
    const byModel = new Map<string, PredictionOutcome[]>();

    for (const outcome of outcomes) {
      const key = outcome.modelId || "unknown";
      if (!byModel.has(key)) {byModel.set(key, []);}
      byModel.get(key)!.push(outcome);
    }

    const result: Record<string, { accuracy: number; total: number; shouldRetrain: boolean }> = {};

    for (const [modelId, modelOutcomes] of byModel) {
      const correct = modelOutcomes.filter(o =>
        o.actualOutcome === "true_positive" || o.actualOutcome === "true_negative"
      ).length;
      const accuracy = modelOutcomes.length > 0 ? correct / modelOutcomes.length : 0;
      const shouldRetrain = modelOutcomes.length >= this.config.minPredictionsForEval &&
        accuracy < this.config.retrainAccuracyThreshold;

      result[modelId] = { accuracy, total: modelOutcomes.length, shouldRetrain };
    }

    return result;
  }

  private async recordPerformanceValidations(
    orgId: string,
    modelAccuracies: Record<string, { accuracy: number; total: number }>,
    cm: { truePositive: number; trueNegative: number; falsePositive: number; falseNegative: number },
    evaluatedAt: Date
  ): Promise<void> {
    try {
      const { modelPerformanceValidations } = await import("@shared/schema");

      for (const [modelId, stats] of Object.entries(modelAccuracies)) {
        if (modelId === "unknown" || stats.total < 5) {continue;}

        const precision = (cm.truePositive + cm.falsePositive) > 0
          ? cm.truePositive / (cm.truePositive + cm.falsePositive) : 0;
        const recall = (cm.truePositive + cm.falseNegative) > 0
          ? cm.truePositive / (cm.truePositive + cm.falseNegative) : 0;

        await this.db.insert(modelPerformanceValidations).values({
          orgId,
          modelId,
          accuracy: stats.accuracy,
          precision,
          recall,
          f1Score: (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0,
          wasCorrect: stats.accuracy >= this.config.retrainAccuracyThreshold,
          validatedAt: evaluatedAt,
          createdAt: evaluatedAt,
        }).onConflictDoNothing();
      }
    } catch (error) {
      logger.warn(LOG_CTX, "Failed to record performance validations", error);
    }
  }

  private async triggerRetraining(orgId: string, modelIds: string[], reason: string): Promise<void> {
    logger.warn(LOG_CTX, `Triggering retraining: ${reason}`, { orgId, modelIds });

    try {
      // Option A: Emit event to scheduler bus (preferred — uses existing infrastructure)
      const { schedulerEventBus } = await import("../../events/scheduler-bus.js");
      schedulerEventBus.emit("retraining_needed", {
        orgId,
        modelIds,
        reason,
        triggeredAt: new Date().toISOString(),
        source: "outcome_tracker",
      });
    } catch {
      // Option B: Direct call to training pipeline
      try {
        const { retrainAllModels } = await import("../../ml-training-pipeline");
        await retrainAllModels(this.storage, orgId);
        logger.info(LOG_CTX, "Retraining completed via direct call", { orgId });
      } catch (trainError) {
        logger.error(LOG_CTX, "Failed to trigger retraining", trainError);
      }
    }
  }
}

export default PredictionOutcomeTracker;
