/**
 * Sensor Optimization Routes
 * AI-powered sensor optimization and threshold management
 */

import type { Express } from "express";
import type { SensorManagementConfig } from "./types.js";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { dbMlAnalyticsStorage } from "../../../db/ml-analytics/index.js";
import { dbSensorsStorage } from "../../../db/sensors/index.js";

export function registerSensorOptimizationRoutes(app: Express, config: SensorManagementConfig) {
  const { requireOrgId, writeOperationRateLimit } = config;

  app.get(
    "/api/sensor-optimization",
    requireOrgId,
    withErrorHandling("fetch threshold optimizations", async (req, res) => {
      const { equipmentId, sensorType, status } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;
      const optimizations = await (dbMlAnalyticsStorage.getThresholdOptimizations as any)(
        orgId,
        equipmentId as string,
        sensorType as string,
        status as string
      );
      res.json(optimizations);
    })
  );

  app.get(
    "/api/sensor-optimization/:optimizationId",
    requireOrgId,
    withErrorHandling("fetch threshold optimization", async (req, res) => {
      const { optimizationId } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const optimization = await dbMlAnalyticsStorage.getThresholdOptimization(
        Number.parseInt(optimizationId),
        orgId
      );
      if (!optimization) {
        return sendNotFound(res, "Threshold optimization");
      }
      res.json(optimization);
    })
  );

  app.post(
    "/api/sensor-optimization/apply/:optimizationId",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("apply optimization", async (req, res) => {
      const { optimizationId } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const result = await dbMlAnalyticsStorage.applyThresholdOptimization(
        Number.parseInt(optimizationId),
        orgId
      );
      res.json({ success: true, applied: result });
    })
  );

  app.post(
    "/api/sensor-optimization/reject/:optimizationId",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("reject optimization", async (req, res) => {
      const { optimizationId } = req.params;
      const { reason } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;
      const result = await dbMlAnalyticsStorage.rejectThresholdOptimization(
        Number.parseInt(optimizationId),
        reason,
        orgId
      );
      res.json({ success: true, rejected: result });
    })
  );

  app.get(
    "/api/sensor-tuning/recommendations/:equipmentId",
    requireOrgId,
    withErrorHandling("get AI recommendations", async (req, res) => {
      const { equipmentId } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const { llmSensorTuningService } = await import("../../../llm-sensor-tuning.js");
      const recommendations = await llmSensorTuningService.getRecommendations(equipmentId, orgId);
      res.json({ success: true, recommendations });
    })
  );

  app.get(
    "/api/sensor-tuning/recommendations/:equipmentId/:sensorType",
    requireOrgId,
    withErrorHandling("get sensor recommendation", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const { llmSensorTuningService } = await import("../../../llm-sensor-tuning.js");
      const recommendation = await llmSensorTuningService.getSensorRecommendation(
        equipmentId,
        sensorType,
        orgId
      );
      if (!recommendation) {
        return sendNotFound(res, "Recommendation for this sensor");
      }
      res.json(recommendation);
    })
  );

  app.get(
    "/api/sensor-tuning/compare/:equipmentId/:sensorType",
    requireOrgId,
    withErrorHandling("compare configurations", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const { llmSensorTuningService } = await import("../../../llm-sensor-tuning.js");
      const comparison = await (llmSensorTuningService.compareConfiguration as any)(
        equipmentId,
        sensorType,
        orgId
      );
      if (!comparison) {
        return sendNotFound(res, "Comparison");
      }
      res.json(comparison);
    })
  );

  app.post(
    "/api/sensor-tuning/apply/:equipmentId/:sensorType",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("apply AI recommendations", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const { parameters } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;
      let configuration;
      try {
        configuration = await dbSensorsStorage.updateSensorConfiguration(
          equipmentId,
          sensorType,
          parameters,
          orgId
        );
      } catch (updateError) {
        if (updateError instanceof Error && updateError.message?.includes("not found")) {
          configuration = await dbSensorsStorage.createSensorConfiguration({
            equipmentId,
            sensorType,
            orgId,
            enabled: true,
            ...parameters,
          });
        } else {
          throw updateError;
        }
      }
      res.json({ success: true, configuration });
    })
  );
}
