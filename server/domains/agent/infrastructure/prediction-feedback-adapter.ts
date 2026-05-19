import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import { predictionFeedback, predictionOutcomes, failurePredictions } from "@shared/schema";
import type { PredictionFeedbackPort, PredictionFeedbackInput } from "../domain/ports";
import { logger } from "../../../utils/logger";

const LOG_CTX = "PredictionFeedbackAdapter";

export class PredictionFeedbackAdapter implements PredictionFeedbackPort {
  async recordFeedback(input: PredictionFeedbackInput): Promise<void> {
    try {
      await db.insert(predictionFeedback).values({
        orgId: input.orgId,
        predictionId: input.predictionId,
        predictionType: "failure",
        equipmentId: input.equipmentId,
        userId: input.userId,
        feedbackType: input.feedbackType,
        isAccurate: input.isAccurate,
        rating: input.isAccurate ? 1 : 0,
        comments: input.comments || null,
        useForRetraining: true,
        feedbackStatus: "pending",
      });

      // Push A1 — also append to prediction_outcomes so the retrain
      // pipeline picks up this label without a separate ETL pass. The
      // unique (predictionId, predictionType, outcomeSource) constraint
      // makes this writer idempotent against feedback replays.
      try {
        const [pred] = await db
          .select({
            id: failurePredictions.id,
            failureProbability: failurePredictions.failureProbability,
            remainingUsefulLife: failurePredictions.remainingUsefulLife,
            predictedFailureDate: failurePredictions.predictedFailureDate,
            modelVersionId: failurePredictions.modelVersionId,
            featureSnapshotId: failurePredictions.featureSnapshotId,
          })
          .from(failurePredictions)
          .where(
            and(
              eq(failurePredictions.id, input.predictionId),
              eq(failurePredictions.orgId, input.orgId)
            )
          )
          .limit(1);
        if (pred) {
          await db
            .insert(predictionOutcomes)
            .values({
              orgId: input.orgId,
              predictionId: input.predictionId,
              predictionType: "failure",
              equipmentId: input.equipmentId,
              modelVersion: pred.modelVersionId ?? null,
              featureSnapshotId: pred.featureSnapshotId ?? null,
              predictedFailureProbability: pred.failureProbability,
              predictedRul: pred.remainingUsefulLife ?? null,
              predictedFailureDate: pred.predictedFailureDate ?? null,
              actualOutcomeLabel: input.isAccurate ? "confirmed" : "false_positive",
              outcomeSource: "feedback",
              sourceRecordId: String(input.predictionId),
              useForRetraining: true,
            })
            .onConflictDoNothing({
              target: [
                predictionOutcomes.predictionId,
                predictionOutcomes.predictionType,
                predictionOutcomes.outcomeSource,
              ],
            });
        }
      } catch (err) {
        logger.warn(
          LOG_CTX,
          `prediction_outcomes append skipped: ${err instanceof Error ? err.message : "unknown"}`
        );
      }

      logger.info(
        LOG_CTX,
        `Recorded prediction feedback for prediction ${input.predictionId} (${input.feedbackType}, accurate=${input.isAccurate})`
      );
    } catch (error: unknown) {
      logger.warn(
        LOG_CTX,
        `Failed to record prediction feedback: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }
}
