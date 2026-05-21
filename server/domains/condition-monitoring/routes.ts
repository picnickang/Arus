import { Express, Request, Response } from "express";
import { z } from "zod";
import { RateLimitRequestHandler } from "express-rate-limit";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { insertOilAnalysisSchema, insertWearParticleAnalysisSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import { dbConditionMonitoringStorage } from "../../db/condition-monitoring/index.js";

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
  const assessmentBodySchema = z.record(z.unknown());
  const oilChangeBodySchema = z.record(z.unknown());
  const updateBodySchema = z.record(z.unknown());

  // ===== OIL ANALYSIS ROUTES =====

  app.get(
    "/api/condition/oil-analysis",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch oil analyses", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = equipmentIdQuerySchema.parse(req.query);
      const analyses = await dbConditionMonitoringStorage.getOilAnalyses(
        orgId,
        equipmentId as string
      );
      res.json(analyses);
    })
  );

  app.get(
    "/api/condition/oil-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch oil analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await dbConditionMonitoringStorage.getOilAnalysis(id, orgId);
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
      const analysis = await dbConditionMonitoringStorage.createOilAnalysis(validatedData);
      sendCreated(res, analysis);
    })
  );

  app.put(
    "/api/condition/oil-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("update oil analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = (req as AuthenticatedRequest).orgId;
      const body = updateBodySchema.parse(req.body);
      const analysis = await dbConditionMonitoringStorage.updateOilAnalysis(
        id,
        body as Parameters<typeof dbConditionMonitoringStorage.updateOilAnalysis>[1],
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
      const orgId = (req as AuthenticatedRequest).orgId;
      await dbConditionMonitoringStorage.deleteOilAnalysis(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== WEAR PARTICLE ANALYSIS ROUTES =====

  app.get(
    "/api/condition/wear-analysis",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch wear particle analyses", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = equipmentIdQuerySchema.parse(req.query);
      const analyses = await dbConditionMonitoringStorage.getWearParticleAnalyses(
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
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await dbConditionMonitoringStorage.getWearParticleAnalysis(id, orgId);
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
      const analysis = await dbConditionMonitoringStorage.createWearParticleAnalysis(validatedData);
      sendCreated(res, analysis);
    })
  );

  app.put(
    "/api/condition/wear-analysis/:id",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("update wear particle analysis", async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const orgId = (req as AuthenticatedRequest).orgId;
      const body = updateBodySchema.parse(req.body);
      const analysis = await dbConditionMonitoringStorage.updateWearParticleAnalysis(
        id,
        body as Parameters<typeof dbConditionMonitoringStorage.updateWearParticleAnalysis>[1],
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
      const orgId = (req as AuthenticatedRequest).orgId;
      await dbConditionMonitoringStorage.deleteWearParticleAnalysis(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== CONDITION MONITORING ASSESSMENT ROUTES =====

  app.get(
    "/api/condition/assessments",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch condition monitoring assessments", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = equipmentIdQuerySchema.parse(req.query);
      const assessments = await dbConditionMonitoringStorage.getConditionMonitoringRecords(
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
      const orgId = (req as AuthenticatedRequest).orgId;
      const assessment = await dbConditionMonitoringStorage.getConditionMonitoringRecord(id, orgId);
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
      const assessment = await dbConditionMonitoringStorage.createConditionMonitoringRecord(
        body as Parameters<typeof dbConditionMonitoringStorage.createConditionMonitoringRecord>[0]
      );
      sendCreated(res, assessment);
    })
  );

  // ===== OIL CHANGE RECORDS ROUTES =====

  app.get(
    "/api/condition/oil-changes",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch oil change records", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = equipmentIdQuerySchema.parse(req.query);
      const records = await dbConditionMonitoringStorage.getOilChangeRecords(
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
      const record = await dbConditionMonitoringStorage.createOilChangeRecord(
        body as Parameters<typeof dbConditionMonitoringStorage.createOilChangeRecord>[0]
      );
      sendCreated(res, record);
    })
  );

  // ===== CONDITION ASSESSMENT GENERATION =====

  app.post(
    "/api/condition/generate-assessment",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("generate condition assessment", async (req, res) => {
      const { oilAnalysisId, wearAnalysisId, vibrationScore } =
        generateAssessmentBodySchema.parse(req.body);

      const oilAnalysis = await dbConditionMonitoringStorage.getOilAnalysis(oilAnalysisId);
      if (!oilAnalysis) {
        return sendNotFound(res, "Oil analysis");
      }

      let wearAnalysis;
      if (wearAnalysisId) {
        wearAnalysis = await dbConditionMonitoringStorage.getWearParticleAnalysis(wearAnalysisId);
        if (!wearAnalysis) {
          return sendNotFound(res, "Wear particle analysis");
        }
      }

      const { generateConditionAssessment } = await import("../../condition-monitoring.js");
      const assessmentData = generateConditionAssessment(oilAnalysis, wearAnalysis, vibrationScore);
      const savedAssessment =
        await dbConditionMonitoringStorage.createConditionMonitoringRecord(assessmentData);
      sendCreated(res, savedAssessment);
    })
  );

  // ===== LATEST CONDITION DATA =====

  app.get(
    "/api/condition/latest/:equipmentId",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch latest condition data", async (req, res) => {
      const { equipmentId } = equipmentIdParamSchema.parse(req.params);
      const orgId = (req as AuthenticatedRequest).orgId;

      const [latestOil, latestWear, conditionRecords, lastOilChange] = await Promise.all([
        dbConditionMonitoringStorage.getLatestOilAnalysis(equipmentId, orgId),
        dbConditionMonitoringStorage.getLatestWearParticleAnalysis(equipmentId, orgId),
        dbConditionMonitoringStorage.getConditionMonitoringRecords(orgId, equipmentId),
        dbConditionMonitoringStorage.getLatestOilChangeRecord(equipmentId, orgId),
      ]);
      const latestAssessment = conditionRecords[0] ?? null;

      res.json({
        oilAnalysis: latestOil,
        wearAnalysis: latestWear,
        conditionAssessment: latestAssessment,
        lastOilChange: lastOilChange ?? null,
      });
    })
  );

  logger.info(
    "ConditionMonitoringRoutes",
    "Registered: oil-analysis, wear-analysis, assessments, oil-changes, generate-assessment, latest"
  );
}
