/**
 * ML Analytics - Failure Prediction Routes
 *
 * CRUD operations for failure predictions. Data access + event emission live in
 * the application service; this layer only handles HTTP concerns + validation.
 */

import type { Express } from "express";
import { insertFailurePredictionSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { mlAnalyticsService } from "../application/index.js";

export function registerPredictionRoutes(app: Express, config: MlAnalyticsConfig) {
  const { writeOperationRateLimit } = config;

  app.get(
    "/api/analytics/failure-predictions",
    withErrorHandling("fetch failure predictions", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, equipmentId, riskLevel } = req.query;
      res.json(
        await mlAnalyticsService.listPredictions(
          orgId as string,
          equipmentId as string,
          riskLevel as string
        )
      );
    })
  );

  app.get(
    "/api/analytics/failure-predictions/:id",
    withErrorHandling("fetch failure prediction", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId } = req.query;
      const prediction = await mlAnalyticsService.getPrediction(
        Number.parseInt(req.params["id"] ?? ""),
        orgId as string
      );
      if (!prediction) {
        return sendNotFound(res, "Failure prediction");
      }
      res.json(prediction);
    })
  );

  app.post(
    "/api/analytics/failure-predictions",
    writeOperationRateLimit,
    withErrorHandling("create failure prediction", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, ...predictionData } = req.body;
      const validatedData = insertFailurePredictionSchema.parse(predictionData);
      const prediction = await mlAnalyticsService.createPrediction(validatedData, orgId as string);
      res.status(201).json(prediction);
    })
  );
}
