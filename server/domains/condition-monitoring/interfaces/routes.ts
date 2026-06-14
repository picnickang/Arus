import { Express, Request, Response } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { RateLimitRequestHandler } from "express-rate-limit";
import { authenticatedRequest, requireOrgId } from "../../../middleware/auth";
import {
  insertConditionMonitoringSchema,
  insertOilAnalysisSchema,
  insertOilChangeRecordSchema,
  insertWearParticleAnalysisSchema,
} from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";
import { conditionMonitoringService, ConditionResourceNotFoundError } from "../application";
import type { InsertOilAnalysis, InsertWearParticleAnalysis } from "../domain/types";

interface ConditionMonitoringRoutesConfig {
  generalApiRateLimit: RateLimitRequestHandler;
}

export function registerConditionMonitoringRoutes(
  app: Express,
  config: ConditionMonitoringRoutesConfig
): void {
  const { generalApiRateLimit } = config;

  const idParamSchema = z.object({ id: z.string().min(1) });
  const equipmentIdParamSchema = z.object({ equipmentId: z.string().min(1) });
  const equipmentIdQuerySchema = z.object({ equipmentId: z.string().optional() });
  const generateAssessmentBodySchema = z.object({
    oilAnalysisId: z.string().min(1),
    wearAnalysisId: z.string().optional(),
    vibrationScore: z.number().optional(),
  });
  const assessmentBodySchema = insertConditionMonitoringSchema;
  const oilChangeBodySchema = insertOilChangeRecordSchema;
  const updateBodySchema = jsonRecordSchema;

  // ===== OIL ANALYSIS ROUTES =====

  app.get(
    "/api/condition/oil-analysis",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch oil analyses", async (req: Request, res: Response) => {
      const orgId = authenticatedRequest(req).orgId;
      const { equipmentId } = equipmentIdQuerySchema.parse(req.query);
      const analyses = await conditionMonitoringService.getOilAnalyses(orgId, equipmentId as string);
      res.json(analyses);
    })
  );

  app.get(
    "/api/condition/oil-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch oil analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const analysis = await conditionMonitoringService.getOilAnalysis(id, orgId);
      if (!analysis) {
        return sendNotFound(res, "Oil analysis");
      }
      res.json(analysis);
    })
  );

  app.post(
    "/api/condition/oil-analysis",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("create oil analysis", async (req, res) => {
      const oilAnalysisSchema = insertOilAnalysisSchema.extend({
        sampleDate: z
          .string()
          .or(z.date())
          .transform((val) => (typeof val === "string" ? new Date(val) : val)),
      });
      const validatedData = oilAnalysisSchema.parse(req.body);
      const analysis = await conditionMonitoringService.createOilAnalysis(validatedData);
      sendCreated(res, analysis);
    })
  );

  app.put(
    "/api/condition/oil-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("update oil analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const body = updateBodySchema.parse(req.body);
      const analysis = await conditionMonitoringService.updateOilAnalysis(
        id,
        body as Partial<InsertOilAnalysis>,
        orgId
      );
      res.json(analysis);
    })
  );

  app.delete(
    "/api/condition/oil-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("delete oil analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      await conditionMonitoringService.deleteOilAnalysis(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== WEAR PARTICLE ANALYSIS ROUTES =====

  app.get(
    "/api/condition/wear-analysis",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch wear particle analyses", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      const { equipmentId } = equipmentIdQuerySchema.parse(req.query);
      const analyses = await conditionMonitoringService.getWearParticleAnalyses(
        orgId,
        equipmentId as string
      );
      res.json(analyses);
    })
  );

  app.get(
    "/api/condition/wear-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch wear particle analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const analysis = await conditionMonitoringService.getWearParticleAnalysis(id, orgId);
      if (!analysis) {
        return sendNotFound(res, "Wear particle analysis");
      }
      res.json(analysis);
    })
  );

  app.post(
    "/api/condition/wear-analysis",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("create wear particle analysis", async (req, res) => {
      const wearAnalysisSchema = insertWearParticleAnalysisSchema.extend({
        analysisDate: z
          .string()
          .or(z.date())
          .transform((val) => (typeof val === "string" ? new Date(val) : val)),
      });
      const validatedData = wearAnalysisSchema.parse(req.body);
      const analysis = await conditionMonitoringService.createWearParticleAnalysis(validatedData);
      sendCreated(res, analysis);
    })
  );

  app.put(
    "/api/condition/wear-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("update wear particle analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const body = updateBodySchema.parse(req.body);
      const analysis = await conditionMonitoringService.updateWearParticleAnalysis(
        id,
        body as Partial<InsertWearParticleAnalysis>,
        orgId
      );
      res.json(analysis);
    })
  );

  app.delete(
    "/api/condition/wear-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("delete wear particle analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      await conditionMonitoringService.deleteWearParticleAnalysis(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== CONDITION MONITORING ASSESSMENT ROUTES =====

  app.get(
    "/api/condition/assessments",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch condition monitoring assessments", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      const { equipmentId } = equipmentIdQuerySchema.parse(req.query);
      const assessments = await conditionMonitoringService.getConditionMonitoringRecords(
        orgId,
        equipmentId as string
      );
      res.json(assessments);
    })
  );

  app.get(
    "/api/condition/assessments/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch condition monitoring assessment", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const assessment = await conditionMonitoringService.getConditionMonitoringRecord(id, orgId);
      if (!assessment) {
        return sendNotFound(res, "Condition monitoring assessment");
      }
      res.json(assessment);
    })
  );

  app.post(
    "/api/condition/assessments",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("create condition monitoring assessment", async (req, res) => {
      const body = assessmentBodySchema.parse(req.body);
      const assessment = await conditionMonitoringService.createConditionMonitoringRecord(body);
      sendCreated(res, assessment);
    })
  );

  // ===== OIL CHANGE RECORDS ROUTES =====

  app.get(
    "/api/condition/oil-changes",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch oil change records", async (req, res) => {
      const orgId = authenticatedRequest(req).orgId;
      const { equipmentId } = equipmentIdQuerySchema.parse(req.query);
      const records = await conditionMonitoringService.getOilChangeRecords(
        orgId,
        equipmentId as string
      );
      res.json(records);
    })
  );

  app.post(
    "/api/condition/oil-changes",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("create oil change record", async (req, res) => {
      const body = oilChangeBodySchema.parse(req.body);
      const record = await conditionMonitoringService.createOilChangeRecord(body);
      sendCreated(res, record);
    })
  );

  // ===== CONDITION ASSESSMENT GENERATION =====

  app.post(
    "/api/condition/generate-assessment",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("generate condition assessment", async (req, res) => {
      const { oilAnalysisId, wearAnalysisId, vibrationScore } = generateAssessmentBodySchema.parse(
        req.body
      );

      try {
        const savedAssessment = await conditionMonitoringService.generateAssessment({
          oilAnalysisId,
          wearAnalysisId,
          vibrationScore,
        });
        sendCreated(res, savedAssessment);
      } catch (err) {
        if (err instanceof ConditionResourceNotFoundError) {
          return sendNotFound(res, err.resource);
        }
        throw err;
      }
    })
  );

  // ===== LATEST CONDITION DATA =====

  app.get(
    "/api/condition/latest/:equipmentId",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch latest condition data", async (req, res) => {
      const { equipmentId } = equipmentIdParamSchema.parse(req.params);
      const orgId = authenticatedRequest(req).orgId;
      const latest = await conditionMonitoringService.getLatestConditionData(equipmentId, orgId);
      res.json(latest);
    })
  );

  logger.info(
    "ConditionMonitoringRoutes",
    "Registered: oil-analysis, wear-analysis, assessments, oil-changes, generate-assessment, latest"
  );
}
