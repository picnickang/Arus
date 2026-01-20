import { Express, Request, Response } from "express";
import { z } from "zod";
import { RateLimitRequestHandler } from "express-rate-limit";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { insertOilAnalysisSchema, insertWearParticleAnalysisSchema } from "@shared/schema-runtime";
import { IStorage } from "../../storage";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface ConditionMonitoringRoutesConfig {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
}

export function registerConditionMonitoringRoutes(
  app: Express,
  config: ConditionMonitoringRoutesConfig
): void {
  const { storage, generalApiRateLimit } = config;

  // ===== OIL ANALYSIS ROUTES =====

  app.get("/api/condition/oil-analysis", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch oil analyses", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = req.query;
      const analyses = await storage.getOilAnalyses(orgId, equipmentId as string);
      res.json(analyses);
    })
  );

  app.get("/api/condition/oil-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch oil analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await storage.getOilAnalysis(id, orgId);
      if (!analysis) {return sendNotFound(res, "Oil analysis");}
      res.json(analysis);
    })
  );

  app.post("/api/condition/oil-analysis", requireOrgId, generalApiRateLimit,
    withErrorHandling("create oil analysis", async (req, res) => {
      const oilAnalysisSchema = insertOilAnalysisSchema.extend({
        sampleDate: z.string().or(z.date()).transform((val) => typeof val === "string" ? new Date(val) : val),
      });
      const validatedData = oilAnalysisSchema.parse(req.body);
      const analysis = await storage.createOilAnalysis(validatedData);
      sendCreated(res, analysis);
    })
  );

  app.put("/api/condition/oil-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("update oil analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await storage.updateOilAnalysis(id, req.body, orgId);
      res.json(analysis);
    })
  );

  app.delete("/api/condition/oil-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("delete oil analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      await storage.deleteOilAnalysis(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== WEAR PARTICLE ANALYSIS ROUTES =====

  app.get("/api/condition/wear-analysis", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch wear particle analyses", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = req.query;
      const analyses = await storage.getWearParticleAnalyses(orgId, equipmentId as string);
      res.json(analyses);
    })
  );

  app.get("/api/condition/wear-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch wear particle analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await storage.getWearParticleAnalysis(id, orgId);
      if (!analysis) {return sendNotFound(res, "Wear particle analysis");}
      res.json(analysis);
    })
  );

  app.post("/api/condition/wear-analysis", requireOrgId, generalApiRateLimit,
    withErrorHandling("create wear particle analysis", async (req, res) => {
      const wearAnalysisSchema = insertWearParticleAnalysisSchema.extend({
        analysisDate: z.string().or(z.date()).transform((val) => typeof val === "string" ? new Date(val) : val),
      });
      const validatedData = wearAnalysisSchema.parse(req.body);
      const analysis = await storage.createWearParticleAnalysis(validatedData);
      sendCreated(res, analysis);
    })
  );

  app.put("/api/condition/wear-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("update wear particle analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await storage.updateWearParticleAnalysis(id, req.body, orgId);
      res.json(analysis);
    })
  );

  app.delete("/api/condition/wear-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("delete wear particle analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      await storage.deleteWearParticleAnalysis(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== CONDITION MONITORING ASSESSMENT ROUTES =====

  app.get("/api/condition/assessments", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch condition monitoring assessments", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = req.query;
      const assessments = await storage.getConditionMonitoringAssessments(orgId, equipmentId as string);
      res.json(assessments);
    })
  );

  app.get("/api/condition/assessments/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch condition monitoring assessment", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const assessment = await storage.getConditionMonitoringAssessment(id, orgId);
      if (!assessment) {return sendNotFound(res, "Condition monitoring assessment");}
      res.json(assessment);
    })
  );

  app.post("/api/condition/assessments", requireOrgId, generalApiRateLimit,
    withErrorHandling("create condition monitoring assessment", async (req, res) => {
      const assessment = await storage.createConditionMonitoringAssessment(req.body);
      sendCreated(res, assessment);
    })
  );

  // ===== OIL CHANGE RECORDS ROUTES =====

  app.get("/api/condition/oil-changes", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch oil change records", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = req.query;
      const records = await storage.getOilChangeRecords(orgId, equipmentId as string);
      res.json(records);
    })
  );

  app.post("/api/condition/oil-changes", requireOrgId, generalApiRateLimit,
    withErrorHandling("create oil change record", async (req, res) => {
      const record = await storage.createOilChangeRecord(req.body);
      sendCreated(res, record);
    })
  );

  // ===== CONDITION ASSESSMENT GENERATION =====

  app.post("/api/condition/generate-assessment", requireOrgId, generalApiRateLimit,
    withErrorHandling("generate condition assessment", async (req, res) => {
      const { oilAnalysisId, wearAnalysisId, vibrationScore } = req.body;

      const oilAnalysis = await storage.getOilAnalysis(oilAnalysisId);
      if (!oilAnalysis) {return sendNotFound(res, "Oil analysis");}

      let wearAnalysis;
      if (wearAnalysisId) {
        wearAnalysis = await storage.getWearParticleAnalysis(wearAnalysisId);
        if (!wearAnalysis) {return sendNotFound(res, "Wear particle analysis");}
      }

      const { generateConditionAssessment } = await import("../../condition-monitoring.js");
      const assessmentData = generateConditionAssessment(oilAnalysis, wearAnalysis, vibrationScore);
      const savedAssessment = await storage.createConditionMonitoringAssessment(assessmentData);
      sendCreated(res, savedAssessment);
    })
  );

  // ===== LATEST CONDITION DATA =====

  app.get("/api/condition/latest/:equipmentId", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch latest condition data", async (req, res) => {
      const { equipmentId } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;

      const [latestOil, latestWear, latestAssessment, latestOilChange] = await Promise.all([
        storage.getLatestOilAnalysis(equipmentId, orgId),
        storage.getLatestWearParticleAnalysis(equipmentId, orgId),
        storage.getLatestConditionAssessment(equipmentId, orgId),
        storage.getLatestOilChange(equipmentId, orgId),
      ]);

      res.json({
        oilAnalysis: latestOil,
        wearAnalysis: latestWear,
        conditionAssessment: latestAssessment,
        lastOilChange: latestOilChange,
      });
    })
  );

  logger.info("ConditionMonitoringRoutes", "Registered: oil-analysis, wear-analysis, assessments, oil-changes, generate-assessment, latest");
}
