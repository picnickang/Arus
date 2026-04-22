/**
 * Analytics Routes - ML Models, Performance, and Drift
 *
 * Read-model views for the analytics hub:
 *   GET /api/analytics/ml-models, model-performance, model-drift
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import { mlModelListResponseSchema, mlModelResponseSchema, modelPerformanceListResponseSchema, modelDriftListResponseSchema, type MlModelListResponse, type MlModelResponse, type ModelPerformanceListResponse, type ModelPerformanceSummaryResponse, type ModelDriftListResponse } from "../../../shared/analytics-types";
import { db } from "../../db";
import { mlModels, modelPerformanceValidations } from "../../../shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getOrgId, sendValidatedResponse, handleError } from "./helpers.js";

export function mountModelGovernanceRoutes(router: Router) {
  router.get("/ml-models", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { modelType, status } = req.query;
      const cacheKey = analyticsCacheKeys.mlModels(orgId, modelType as string | undefined);
      const response = await cachedAnalytics<MlModelListResponse>(cacheKey, async () => {
        const filters = [eq(mlModels.orgId, orgId)];
        if (modelType) { filters.push(eq(mlModels.modelType, modelType as string)); }
        if (status) { filters.push(eq(mlModels.status, status as any)); }
        const models = await db.select().from(mlModels).where(and(...filters)).orderBy(sql`${mlModels.trainedAt} DESC`);
        return { results: models, metadata: { orgId, timestamp: new Date(), version: "1.0", total: models.length, page: 1, pageSize: Math.max(models.length, 1), hasMore: false } };
      }, 300);
      sendValidatedResponse(res, response, mlModelListResponseSchema);
    } catch (error) { handleError(res, error, "ML Models List"); }
  });

  router.get("/ml-models/:id", async (req: Request, res: Response) => {
    const orgId = getOrgId(req, res);
    if (!orgId) { return; }
    try {
      const { id } = req.params;
      const cacheKey = `${orgId}:ml-model:${id}`;
      const response = await cachedAnalytics<MlModelResponse>(cacheKey, async () => {
        const [model] = await db.select().from(mlModels).where(and(eq(mlModels.id, id), eq(mlModels.orgId, orgId))).limit(1);
        if (!model) { throw new Error("Model not found"); }
        return { result: model, metadata: { orgId, timestamp: new Date(), version: "1.0" } };
      }, 180);
      sendValidatedResponse(res, response, mlModelResponseSchema);
    } catch (error) {
      if (error instanceof Error && error.message === "Model not found") { res.status(404).json({ error: { code: "NOT_FOUND", message: "ML model not found" }, metadata: { orgId, timestamp: new Date(), version: "1.0" } }); }
      else { handleError(res, error, "ML Model"); }
    }
  });

  router.get("/model-performance", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { modelId } = req.query;
      const cacheKey = analyticsCacheKeys.modelPerformance(orgId, modelId as string | undefined);
      const response = await cachedAnalytics<ModelPerformanceListResponse>(cacheKey, async () => {
        const filters = [eq(modelPerformanceValidations.orgId, orgId)];
        if (modelId) { filters.push(eq(modelPerformanceValidations.modelId, modelId as string)); }
        const results = await db.select().from(modelPerformanceValidations).where(and(...filters)).orderBy(sql`${modelPerformanceValidations.validatedAt} DESC`).limit(100);
        return { results, metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: Math.max(results.length, 1), hasMore: false } };
      }, 240);
      sendValidatedResponse(res, response, modelPerformanceListResponseSchema);
    } catch (error) { handleError(res, error, "Model Performance"); }
  });

  router.get("/model-performance/summary", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const cacheKey = `${orgId}:model-performance:summary`;
      const response = await cachedAnalytics<ModelPerformanceSummaryResponse>(cacheKey, async () => {
        const validations = await db.select().from(modelPerformanceValidations).where(eq(modelPerformanceValidations.orgId, orgId)).limit(1);
        if (validations.length === 0) {
          return { result: { summaryByModel: [], overallStats: { totalModels: 0, totalValidations: 0, avgAccuracyAcrossModels: 0 } }, metadata: { orgId, timestamp: new Date(), version: "1.0" } };
        }
        const summary = await db.select({ modelId: modelPerformanceValidations.modelId, modelType: mlModels.modelType, avgAccuracy: sql<number>`AVG(${modelPerformanceValidations.accuracy})`, avgPrecision: sql<number>`AVG(${modelPerformanceValidations.precision})`, avgRecall: sql<number>`AVG(${modelPerformanceValidations.recall})`, avgF1Score: sql<number>`AVG(${modelPerformanceValidations.f1Score})`, totalValidations: sql<number>`COUNT(*)`, lastValidation: sql<Date>`MAX(${modelPerformanceValidations.validatedAt})` }).from(modelPerformanceValidations).innerJoin(mlModels, eq(modelPerformanceValidations.modelId, mlModels.id)).where(eq(modelPerformanceValidations.orgId, orgId)).groupBy(modelPerformanceValidations.modelId, mlModels.modelType);
        return { result: { summaryByModel: summary, overallStats: { totalModels: summary.length, totalValidations: summary.reduce((sum, s) => sum + Number(s.totalValidations), 0), avgAccuracyAcrossModels: summary.reduce((sum, s) => sum + Number(s.avgAccuracy), 0) / summary.length || 0 } }, metadata: { orgId, timestamp: new Date(), version: "1.0" } };
      }, 300);
      res.json(response);
    } catch (error) { handleError(res, error, "Model Performance Summary"); }
  });

  router.get("/model-drift", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { modelId } = req.query;
      const cacheKey = analyticsCacheKeys.modelDrift(orgId, modelId as string | undefined);
      const response = await cachedAnalytics<ModelDriftListResponse>(cacheKey, async () => {
        const modelFilters = [eq(mlModels.orgId, orgId)];
        if (modelId) { modelFilters.push(eq(mlModels.id, modelId as string)); }
        const models = await db.select().from(mlModels).where(and(...modelFilters));
        const results = [];
        let criticalCount = 0;
        for (const model of models) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const validations = await db.select().from(modelPerformanceValidations).where(and(eq(modelPerformanceValidations.modelId, model.id), gte(modelPerformanceValidations.createdAt, thirtyDaysAgo))).orderBy(sql`${modelPerformanceValidations.createdAt} DESC`).limit(100);
          if (validations.length < 2) { continue; }
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const recent = validations.filter((v) => new Date(v.createdAt || 0) >= sevenDaysAgo);
          const historical = validations.filter((v) => new Date(v.createdAt || 0) < sevenDaysAgo);
          if (recent.length === 0 || historical.length === 0) { continue; }
          const recentAccuracy = recent.filter((v) => v.wasCorrect).length / recent.length;
          const historicalAccuracy = historical.filter((v) => v.wasCorrect).length / historical.length;
          const performanceDrop = historicalAccuracy - recentAccuracy;
          const driftScore = Math.min(1, Math.max(0, performanceDrop * 2));
          let severity: "low" | "medium" | "high" | "critical" = "low";
          if (driftScore >= 0.3) { severity = "critical"; } else if (driftScore >= 0.2) { severity = "high"; } else if (driftScore >= 0.1) { severity = "medium"; }
          if (severity === "critical") {
            criticalCount++;
          }

          if (driftScore >= 0.05) { results.push({ id: model.id, modelId: model.id, modelType: model.modelType || 'unknown', detectedAt: new Date(), driftScore, driftType: 'performance' as const, severity, affectedFeatures: [], performanceDegradation: performanceDrop * 100, recommendedAction: severity === 'critical' ? 'urgent_retrain' as const : severity === 'high' ? 'retrain' as const : 'monitor' as const, explanation: `Model accuracy dropped from ${(historicalAccuracy * 100).toFixed(1)}% to ${(recentAccuracy * 100).toFixed(1)}% over the last 7 days.` }); }
        }
        return { results, metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: 100, hasMore: false, criticalCount } };
      }, 300);
      sendValidatedResponse(res, response, modelDriftListResponseSchema);
    } catch (error) { handleError(res, error, "Model Drift"); }
  });
}
