/**
 * ML Analytics - Anomaly Detection Routes
 *
 * CRUD operations for anomaly detections. Data access + event emission live in
 * the application service; this layer only handles HTTP concerns + validation.
 */

import type { Express } from "express";
import { insertAnomalyDetectionSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import { authenticatedRequest } from "../../../middleware/auth";
import { mlAnalyticsService } from "../application/index.js";

export function registerAnomalyRoutes(app: Express, config: MlAnalyticsConfig) {
  const { writeOperationRateLimit } = config;

  app.get(
    "/api/analytics/anomaly-detections",
    withErrorHandling("fetch anomaly detections", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, equipmentId, severity } = req.query;
      return res.json(
        await mlAnalyticsService.listAnomalies(
          orgId as string,
          equipmentId as string,
          severity as string
        )
      );
    })
  );

  app.get(
    "/api/analytics/anomaly-detections/:id",
    withErrorHandling("fetch anomaly detection", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId } = req.query;
      const detection = await mlAnalyticsService.getAnomaly(
        Number.parseInt(req.params["id"] ?? ""),
        orgId as string
      );
      if (!detection) {
        return sendNotFound(res, "Anomaly detection");
      }
      return res.json(detection);
    })
  );

  app.post(
    "/api/analytics/anomaly-detections",
    writeOperationRateLimit,
    withErrorHandling("create anomaly detection", async (req, res) => {
      const { orgId = authenticatedRequest(req).orgId, ...detectionData } = req.body;
      const validatedData = insertAnomalyDetectionSchema.parse(detectionData);
      const detection = await mlAnalyticsService.createAnomaly(validatedData, orgId as string);
      return res.status(201).json(detection);
    })
  );

  app.patch(
    "/api/analytics/anomaly-detections/:id/acknowledge",
    writeOperationRateLimit,
    withErrorHandling("acknowledge anomaly", async (req, res) => {
      const { acknowledgedBy, orgId = authenticatedRequest(req).orgId } = req.body;
      if (!acknowledgedBy) {
        return res.status(400).json({ message: "acknowledgedBy is required" });
      }
      const detection = await mlAnalyticsService.acknowledgeAnomaly(
        Number.parseInt(req.params["id"] ?? ""),
        acknowledgedBy,
        orgId as string
      );
      return res.json(detection);
    })
  );
}
