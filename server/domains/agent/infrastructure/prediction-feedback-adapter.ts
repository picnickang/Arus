import { db } from "../../../db";
import { predictionFeedback } from "@shared/schema";
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
