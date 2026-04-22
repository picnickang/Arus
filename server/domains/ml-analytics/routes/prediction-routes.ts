/**
 * ML Analytics - Failure Prediction Routes
 *
 * CRUD operations for failure predictions.
 */

import type { Express } from "express";
import { insertFailurePredictionSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";
import { dbMlAnalyticsStorage, dbEquipmentStorage } from "../../../repositories.js";

export function registerPredictionRoutes(app: Express, config: MlAnalyticsConfig) {
  const { writeOperationRateLimit } = config;

  app.get(
    "/api/analytics/failure-predictions",
    withErrorHandling("fetch failure predictions", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, riskLevel } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const predictions = await dbMlAnalyticsStorage.getFailurePredictions(
        orgId as string,
        equipmentId as string,
        riskLevel as string
      );
      const { normalizeFailurePredictions } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeFailurePredictions(predictions));
    })
  );

  app.get(
    "/api/analytics/failure-predictions/:id",
    withErrorHandling("fetch failure prediction", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const prediction = await dbMlAnalyticsStorage.getFailurePrediction(
        Number.parseInt(req.params.id),
        orgId as string
      );
      if (!prediction) {
        return sendNotFound(res, "Failure prediction");
      }
      const { normalizeFailurePrediction } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeFailurePrediction(prediction));
    })
  );

  app.post(
    "/api/analytics/failure-predictions",
    writeOperationRateLimit,
    withErrorHandling("create failure prediction", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, ...predictionData } = req.body;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const validatedData = insertFailurePredictionSchema.parse(predictionData);
      const prediction = await dbMlAnalyticsStorage.createFailurePrediction(validatedData, orgId);

      try {
        const equipment = await dbEquipmentStorage.getEquipment(
          orgId as string,
          validatedData.equipmentId
        );
        if (equipment) {
          const remainingDays = validatedData.predictedFailureDate
            ? Math.max(
                0,
                Math.floor(
                  (new Date(validatedData.predictedFailureDate).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24)
                )
              )
            : 30;

          const riskLevel =
            remainingDays <= 3
              ? "critical"
              : remainingDays <= 7
                ? "high"
                : remainingDays <= 14
                  ? "medium"
                  : "low";
          domainEventBus.emit(
            "pdm.rul.updated",
            createDomainEvent("pdm.rul.updated", orgId as string, {
              vesselId: equipment.vesselId || "unknown",
              equipmentId: validatedData.equipmentId,
              remainingDays,
              riskLevel,
            })
          );
        }
      } catch (eventError) {
        logger.error("PredictionRoutes", "Failed to emit RUL update event", eventError);
      }

      const { normalizeFailurePrediction } = await import("../../../analytics-data-normalizer.js");
      res.status(201).json(normalizeFailurePrediction(prediction));
    })
  );
}
