/**
 * ML Analytics - Anomaly Detection Routes
 * 
 * CRUD operations for anomaly detections.
 */

import type { Express } from "express";
import { insertAnomalyDetectionSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { domainEventBus, createDomainEvent } from "../../../lib/domain-event-bus/index.js";

export function registerAnomalyRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage, writeOperationRateLimit } = config;

  app.get("/api/analytics/anomaly-detections",
    withErrorHandling("fetch anomaly detections", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, severity } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const detections = await storage.getAnomalyDetections(
        orgId as string,
        equipmentId as string,
        severity as string
      );
      const { normalizeAnomalyDetections } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeAnomalyDetections(detections));
    })
  );

  app.get("/api/analytics/anomaly-detections/:id",
    withErrorHandling("fetch anomaly detection", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const detection = await storage.getAnomalyDetection(Number.parseInt(req.params.id), orgId as string);
      if (!detection) {
        return sendNotFound(res, "Anomaly detection");
      }
      const { normalizeAnomalyDetection } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeAnomalyDetection(detection));
    })
  );

  app.post("/api/analytics/anomaly-detections", writeOperationRateLimit,
    withErrorHandling("create anomaly detection", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, ...detectionData } = req.body;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const validatedData = insertAnomalyDetectionSchema.parse(detectionData);
      const detection = await storage.createAnomalyDetection(validatedData, orgId);

      if (detection.severity === "high" || detection.severity === "critical") {
        try {
          const equipment = await storage.getEquipment(orgId as string, detection.equipmentId);
          if (equipment) {
            domainEventBus.emit("pdm.anomaly.created", createDomainEvent("pdm.anomaly.created", orgId as string, {
              vesselId: equipment.vesselId || "unknown",
              equipmentId: detection.equipmentId,
              severity: detection.severity as "low" | "medium" | "high" | "critical",
              anomalyType: detection.anomalyType || "unknown",
            }));
          }
        } catch (eventError) {
          logger.error("AnomalyRoutes", "Failed to emit anomaly event", eventError);
        }
      }

      const { normalizeAnomalyDetection } = await import("../../../analytics-data-normalizer.js");
      res.status(201).json(normalizeAnomalyDetection(detection));
    })
  );

  app.patch("/api/analytics/anomaly-detections/:id/acknowledge", writeOperationRateLimit,
    withErrorHandling("acknowledge anomaly", async (req, res) => {
      const { acknowledgedBy, orgId = (req as AuthenticatedRequest).orgId } = req.body;
      if (!acknowledgedBy) {
        return res.status(400).json({ message: "acknowledgedBy is required" });
      }
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const detection = await storage.acknowledgeAnomaly(Number.parseInt(req.params.id), acknowledgedBy, orgId);
      const { normalizeAnomalyDetection } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeAnomalyDetection(detection));
    })
  );
}
