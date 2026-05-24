/**
 * Analytics Routes - ML Models, Performance, and Drift
 *
 * Read-model views for the analytics hub:
 *   GET /api/analytics/ml-models, model-performance, model-drift
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import {
  mlModelListResponseSchema,
  mlModelResponseSchema,
  modelPerformanceListResponseSchema,
  modelDriftListResponseSchema,
} from "../../../shared/analytics-types";
import { db } from "../../db";
import { mlModels, modelPerformanceValidations } from "../../../shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getOrgId, sendValidatedResponse, handleError } from "./helpers.js";

export function mountModelGovernanceRoutes(router: Router) {
  router.get("/ml-models", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) {
        return;
      }
      const { modelType, status } = req.query;
      const cacheKey = analyticsCacheKeys.mlModels(orgId, modelType as string | undefined);
      const response = await cachedAnalytics(
        cacheKey,
        async () => {
          const filters = [eq(mlModels.orgId, orgId)];
          if (modelType) {
            filters.push(eq(mlModels.type, modelType as string));
          }
          if (status) {
            filters.push(eq(mlModels.status, String(status)));
          }
          const models = await db
            .select()
            .from(mlModels)
            .where(and(...filters))
            .orderBy(sql`${mlModels.trainedOn} DESC`);
          return {
            results: models,
            metadata: {
              orgId,
              timestamp: new Date(),
              version: "1.0",
              total: models.length,
              page: 1,
              pageSize: Math.max(models.length, 1),
              hasMore: false,
            },
          };
        },
        300
      );
      sendValidatedResponse(res, response, mlModelListResponseSchema);
    } catch (error) {
      handleError(res, error, "ML Models List");
    }
  });

  router.get("/ml-models/:id", async (req: Request, res: Response) => {
    const orgId = getOrgId(req, res);
    if (!orgId) {
      return;
    }
    try {
      const { id } = req.params;
      const cacheKey = `${orgId}:ml-model:${id}`;
      const response = await cachedAnalytics(
        cacheKey,
        async () => {
          const [model] = await db
            .select()
            .from(mlModels)
            .where(and(eq(mlModels.id, id), eq(mlModels.orgId, orgId)))
            .limit(1);
          if (!model) {
            throw new Error("Model not found");
          }
          return { result: model, metadata: { orgId, timestamp: new Date(), version: "1.0" } };
        },
        180
      );
      sendValidatedResponse(res, response, mlModelResponseSchema);
    } catch (error) {
      if (error instanceof Error && error.message === "Model not found") {
        res
          .status(404)
          .json({
            error: { code: "NOT_FOUND", message: "ML model not found" },
            metadata: { orgId, timestamp: new Date(), version: "1.0" },
          });
      } else {
        handleError(res, error, "ML Model");
      }
    }
  });

  router.get("/model-performance", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) {
        return;
      }
      const { modelId } = req.query;
      const cacheKey = analyticsCacheKeys.modelPerformance(orgId, modelId as string | undefined);
      const response = await cachedAnalytics(
        cacheKey,
        async () => {
          const filters = [eq(modelPerformanceValidations.orgId, orgId)];
          if (modelId) {
            filters.push(eq(modelPerformanceValidations.modelId, modelId as string));
          }
          const results = await db
            .select()
            .from(modelPerformanceValidations)
            .where(and(...filters))
            .orderBy(sql`${modelPerformanceValidations.validatedAt} DESC`)
            .limit(100);
          return {
            results,
            metadata: {
              orgId,
              timestamp: new Date(),
              version: "1.0",
              total: results.length,
              page: 1,
              pageSize: Math.max(results.length, 1),
              hasMore: false,
            },
          };
        },
        240
      );
      sendValidatedResponse(res, response, modelPerformanceListResponseSchema);
    } catch (error) {
      handleError(res, error, "Model Performance");
    }
  });

  router.get("/model-performance/summary", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) {
        return;
      }
      const cacheKey = `${orgId}:model-performance:summary`;
      const response = await cachedAnalytics(
        cacheKey,
        async () => {
          // Aggregate per-validation accuracy (real column on
          // model_performance_validations) joined with the model row to
          // expose precision/recall/f1 from ml_models. The legacy
          // implementation referenced accuracy/precision/recall/f1Score
          // on modelPerformanceValidations which do not exist on that
          // table — those numerics live on ml_models.
          const summary = await db
            .select({
              modelId: modelPerformanceValidations.modelId,
              modelType: mlModels.type,
              avgAccuracy: sql<number>`COALESCE(AVG(${modelPerformanceValidations.accuracyScore}), 0)`,
              avgPrecision: sql<number>`COALESCE(MAX(${mlModels.precision}), 0)`,
              avgRecall: sql<number>`COALESCE(MAX(${mlModels.recall}), 0)`,
              avgF1Score: sql<number>`COALESCE(MAX(${mlModels.f1Score}), 0)`,
              totalValidations: sql<number>`COUNT(*)`,
              lastValidation: sql<Date>`MAX(${modelPerformanceValidations.validatedAt})`,
            })
            .from(modelPerformanceValidations)
            .innerJoin(mlModels, eq(modelPerformanceValidations.modelId, mlModels.id))
            .where(eq(modelPerformanceValidations.orgId, orgId))
            .groupBy(modelPerformanceValidations.modelId, mlModels.type);
          if (summary.length === 0) {
            return {
              result: {
                summaryByModel: [],
                overallStats: { totalModels: 0, totalValidations: 0, avgAccuracyAcrossModels: 0 },
              },
              metadata: { orgId, timestamp: new Date(), version: "1.0" },
            };
          }
          return {
            result: {
              summaryByModel: summary,
              overallStats: {
                totalModels: summary.length,
                totalValidations: summary.reduce((sum, s) => sum + Number(s.totalValidations), 0),
                avgAccuracyAcrossModels:
                  summary.reduce((sum, s) => sum + Number(s.avgAccuracy), 0) / summary.length || 0,
              },
            },
            metadata: { orgId, timestamp: new Date(), version: "1.0" },
          };
        },
        300
      );
      res.json(response);
    } catch (error) {
      handleError(res, error, "Model Performance Summary");
    }
  });

  router.get("/model-drift", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) {
        return;
      }
      const { modelId } = req.query;
      const cacheKey = analyticsCacheKeys.modelDrift(orgId, modelId as string | undefined);
      const response = await cachedAnalytics(
        cacheKey,
        async () => {
          const modelFilters = [eq(mlModels.orgId, orgId)];
          if (modelId) {
            modelFilters.push(eq(mlModels.id, modelId as string));
          }
          const models = await db
            .select()
            .from(mlModels)
            .where(and(...modelFilters));
          const results = [];
          let criticalCount = 0;
          for (const model of models) {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const validations = await db
              .select()
              .from(modelPerformanceValidations)
              .where(
                and(
                  eq(modelPerformanceValidations.modelId, model.id),
                  gte(modelPerformanceValidations.createdAt, thirtyDaysAgo)
                )
              )
              .orderBy(sql`${modelPerformanceValidations.createdAt} DESC`)
              .limit(100);
            if (validations.length < 2) {
              continue;
            }
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const recent = validations.filter((v) => new Date(v.createdAt || 0) >= sevenDaysAgo);
            const historical = validations.filter((v) => new Date(v.createdAt || 0) < sevenDaysAgo);
            if (recent.length === 0 || historical.length === 0) {
              continue;
            }
            // Real drift signal: average accuracy_score (range 0..1) over
            // the recent vs. historical window. Replaces a legacy
            // `wasCorrect` boolean that does not exist on this table.
            const avgAccuracy = (rows: typeof validations): number => {
              const scored = rows
                .map((r) => r.accuracyScore)
                .filter((s): s is number => typeof s === "number" && Number.isFinite(s));
              if (scored.length === 0) {
                return 0;
              }
              return scored.reduce((sum, s) => sum + s, 0) / scored.length;
            };
            const recentAccuracy = avgAccuracy(recent);
            const historicalAccuracy = avgAccuracy(historical);
            const performanceDrop = historicalAccuracy - recentAccuracy;
            const driftScore = Math.min(1, Math.max(0, performanceDrop * 2));
            let severity: "low" | "medium" | "high" | "critical" = "low";
            if (driftScore >= 0.3) {
              severity = "critical";
            } else if (driftScore >= 0.2) {
              severity = "high";
            } else if (driftScore >= 0.1) {
              severity = "medium";
            }
            if (severity === "critical") {
              criticalCount++;
            }

            if (driftScore >= 0.05) {
              results.push({
                id: model.id,
                modelId: model.id,
                modelType: model.type || "unknown",
                detectedAt: new Date(),
                driftScore,
                driftType: "performance" as const,
                severity,
                affectedFeatures: [],
                performanceDegradation: performanceDrop * 100,
                recommendedAction:
                  severity === "critical"
                    ? ("urgent_retrain" as const)
                    : severity === "high"
                      ? ("retrain" as const)
                      : ("monitor" as const),
                explanation: `Model accuracy dropped from ${(historicalAccuracy * 100).toFixed(1)}% to ${(recentAccuracy * 100).toFixed(1)}% over the last 7 days.`,
              });
            }
          }
          return {
            results,
            metadata: {
              orgId,
              timestamp: new Date(),
              version: "1.0",
              total: results.length,
              page: 1,
              pageSize: 100,
              hasMore: false,
              criticalCount,
            },
          };
        },
        300
      );
      sendValidatedResponse(res, response, modelDriftListResponseSchema);
    } catch (error) {
      handleError(res, error, "Model Drift");
    }
  });
}
