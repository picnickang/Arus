/**
 * Sensor Optimization Routes
 * AI-powered sensor optimization and threshold management
 */

import type { Express } from "express";
import { z } from "zod";
import type { SensorManagementConfig } from "./types.js";

const optimizationQuerySchema = z.object({
  equipmentId: z.string().optional(),
  sensorType: z.string().optional(),
  status: z.string().optional(),
});
const optimizationIdParamSchema = z.object({ optimizationId: z.string().min(1) });
const equipmentIdParamSchema = z.object({ equipmentId: z.string().min(1) });
const equipmentSensorParamSchema = z.object({
  equipmentId: z.string().min(1),
  sensorType: z.string().min(1),
});
const rejectBodySchema = z.object({ reason: z.string().optional() });
const applyTuningBodySchema = z.object({ parameters: z.record(z.unknown()).default({}) });
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
      const { equipmentId, sensorType, status } = optimizationQuerySchema.parse(req.query);
      const orgId = (req as AuthenticatedRequest).orgId;
      void status;
      const optimizations = await dbMlAnalyticsStorage.getThresholdOptimizations(
        orgId,
        equipmentId,
        sensorType
      );
      res.json(optimizations);
    })
  );

  app.get(
    "/api/sensor-optimization/:optimizationId",
    requireOrgId,
    withErrorHandling("fetch threshold optimization", async (req, res) => {
      const { optimizationId } = optimizationIdParamSchema.parse(req.params);
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
      const { optimizationId } = optimizationIdParamSchema.parse(req.params);
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
      const { optimizationId } = optimizationIdParamSchema.parse(req.params);
      const { reason } = rejectBodySchema.parse(req.body ?? {});
      const orgId = (req as AuthenticatedRequest).orgId;
      const result = await dbMlAnalyticsStorage.rejectThresholdOptimization(
        Number.parseInt(optimizationId),
        reason ?? "",
        orgId
      );
      res.json({ success: true, rejected: result });
    })
  );

  app.get(
    "/api/sensor-tuning/recommendations/:equipmentId",
    requireOrgId,
    withErrorHandling("get AI recommendations", async (req, res) => {
      const { equipmentId } = equipmentIdParamSchema.parse(req.params);
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
      const { equipmentId, sensorType } = equipmentSensorParamSchema.parse(req.params);
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
      const { equipmentId, sensorType } = equipmentSensorParamSchema.parse(req.params);
      const orgId = (req as AuthenticatedRequest).orgId;
      const { llmSensorTuningService } = await import("../../../llm-sensor-tuning.js");
      const comparison = await llmSensorTuningService.compareConfiguration(
        equipmentId,
        sensorType,
        {},
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
      const { equipmentId, sensorType } = equipmentSensorParamSchema.parse(req.params);
      const { parameters } = applyTuningBodySchema.parse(req.body ?? {});
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
