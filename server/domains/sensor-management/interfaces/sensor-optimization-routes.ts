/**
 * Sensor Optimization Routes - threshold optimization (via service) and
 * AI sensor-tuning (via the LLM tuning service).
 */

import type { Express } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import type { SensorRouteContext } from "./types.js";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import { authenticatedRequest } from "../../../middleware/auth";

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
const applyTuningBodySchema = z.object({ parameters: jsonRecordSchema.default({}) });

export function registerSensorOptimizationRoutes(app: Express, ctx: SensorRouteContext) {
  const { requireOrgId, writeOperationRateLimit, service } = ctx;

  app.get(
    "/api/sensor-optimization",
    requireOrgId,
    withErrorHandling("fetch threshold optimizations", async (req, res) => {
      const { equipmentId, sensorType, status } = optimizationQuerySchema.parse(req.query);
      const orgId = authenticatedRequest(req).orgId;
      void status;
      res.json(await service.listThresholdOptimizations(orgId, equipmentId, sensorType));
    })
  );

  app.get(
    "/api/sensor-optimization/:optimizationId",
    requireOrgId,
    withErrorHandling("fetch threshold optimization", async (req, res) => {
      const { optimizationId } = optimizationIdParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const optimization = await service.getThresholdOptimization(
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
      const orgId = authenticatedRequest(req).orgId;
      const result = await service.applyThresholdOptimization(
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
      const orgId = authenticatedRequest(req).orgId;
      const result = await service.rejectThresholdOptimization(
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
      const orgId = authenticatedRequest(req).orgId;
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
      const orgId = authenticatedRequest(req).orgId;
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
      const orgId = authenticatedRequest(req).orgId;
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
      const orgId = authenticatedRequest(req).orgId;
      const configuration = await service.applySensorTuning(
        equipmentId,
        sensorType,
        parameters,
        orgId
      );
      res.json({ success: true, configuration });
    })
  );
}
