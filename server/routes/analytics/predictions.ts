/**
 * Analytics Routes - Failure Predictions and Anomalies
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import { failurePredictionListResponseSchema, anomalyDetectionListResponseSchema, type FailurePredictionListResponse, type AnomalyDetectionListResponse } from "../../../shared/analytics-types";
import { db } from "../../db";
import { anomalyDetections, failurePredictions } from "../../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "../../storage";
import { getOrgId, sendValidatedResponse, handleError, toFailurePredictionUuid } from "./helpers.js";

type MaintRecRaw = { action?: string; priority?: string } | null;
type MaintRec = { action: string; priority: "low" | "medium" | "high" | "urgent" };

function parseMaintenanceRecs(raw: unknown): MaintRec[] {
  if (!raw) {return [];}
  if (Array.isArray(raw)) {
    return raw.map((rec: MaintRecRaw) => ({
      action: rec?.action || "Schedule inspection",
      priority: (rec?.priority as MaintRec["priority"]) || "medium",
    }));
  }
  if (typeof raw === "object") {
    const rec = raw as MaintRecRaw;
    return [{ action: rec?.action || "Schedule inspection", priority: (rec?.priority as MaintRec["priority"]) || "medium" }];
  }
  return [];
}

type EquipmentRegistryItem = { id: string; name: string; equipmentType?: string };
type FailurePredictionRow = typeof failurePredictions.$inferSelect;

function mapPredictionToResult(p: FailurePredictionRow, equipmentMap: Map<string, EquipmentRegistryItem>) {
  const equip = equipmentMap.get(p.equipmentId);
  const ciRaw = p.confidenceInterval as { lower?: number; upper?: number } | null;
  const ciParsed = ciRaw ?? { lower: 0.7, upper: 0.95 };
  const costImpactRaw = p.costImpact as { estimatedRepairCost?: number; estimatedDowntime?: number; revenueImpact?: number } | null;
  const maintRecs = parseMaintenanceRecs(p.maintenanceRecommendations);
  return {
    id: toFailurePredictionUuid(p.id),
    equipmentId: p.equipmentId,
    equipmentName: equip?.name || "Unknown Equipment",
    equipmentType: equip?.equipmentType || "General",
    predictionDate: p.predictionTimestamp || new Date(),
    failureProbability: p.failureProbability,
    predictedFailureDate: p.predictedFailureDate,
    remainingUsefulLife: p.remainingUsefulLife ?? 30,
    confidenceInterval: { lower: ciParsed.lower ?? 0.7, upper: ciParsed.upper ?? 0.95 },
    failureMode: p.failureMode || "Unknown",
    riskLevel: p.riskLevel as "low" | "medium" | "high" | "critical",
    maintenanceRecommendations: maintRecs,
    costImpact: {
      estimatedRepairCost: costImpactRaw?.estimatedRepairCost ?? 0,
      estimatedDowntime: costImpactRaw?.estimatedDowntime ?? 0,
      revenueImpact: costImpactRaw?.revenueImpact ?? 0,
    },
    modelUsed: p.modelId || "hybrid-ensemble-v1",
    modelConfidence: 0.85,
  };
}

export function mountPredictionsRoutes(router: Router) {
  router.get("/anomalies", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      const { equipmentId, severity } = req.query;
      const cacheKey = analyticsCacheKeys.anomalies(orgId, equipmentId as string | undefined, severity as string | undefined);
      const response = await cachedAnalytics<AnomalyDetectionListResponse>(cacheKey, async () => {
        const filters = [eq(anomalyDetections.orgId, orgId)];
        if (equipmentId) {filters.push(eq(anomalyDetections.equipmentId, equipmentId as string));}
        if (severity) {filters.push(eq(anomalyDetections.severity, severity as any));}
        const results = await db.select().from(anomalyDetections).where(and(...filters)).orderBy(sql`${anomalyDetections.detectionTimestamp} DESC`).limit(100);
        const unacknowledged = results.filter(r => !r.acknowledgedAt).length;
        const critical = results.filter(r => r.severity === "critical").length;
        return {
          results,
          metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: Math.max(results.length, 1), hasMore: false, unacknowledgedCount: unacknowledged, criticalCount: critical },
        };
      }, 120);
      sendValidatedResponse(res, response, anomalyDetectionListResponseSchema);
    } catch (error) {
      handleError(res, error, "Anomalies");
    }
  });

  router.get("/failure-predictions", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      const { equipmentId, riskLevel } = req.query;
      const cacheKey = analyticsCacheKeys.failurePredictions(orgId, equipmentId as string | undefined, riskLevel as string | undefined);
      const response = await cachedAnalytics<FailurePredictionListResponse>(cacheKey, async () => {
        const filters = [eq(failurePredictions.orgId, orgId)];
        if (equipmentId) {filters.push(eq(failurePredictions.equipmentId, equipmentId as string));}
        if (riskLevel) {filters.push(eq(failurePredictions.riskLevel, riskLevel as any));}
        const predictions = await db.select().from(failurePredictions).where(and(...filters)).orderBy(sql`${failurePredictions.predictionTimestamp} DESC`).limit(100);
        const equipmentIds = [...new Set(predictions.map(p => p.equipmentId))];
        const equipmentData = equipmentIds.length > 0 ? await storage.getEquipmentRegistry(orgId) : [];
        const equipmentMap = new Map(equipmentData.map(e => [e.id, e]));
        const results = predictions.map(p => mapPredictionToResult(p, equipmentMap));
        const highRisk = results.filter(r => r.riskLevel === "high").length;
        const criticalRisk = results.filter(r => r.riskLevel === "critical").length;
        return {
          results,
          metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: Math.max(results.length, 1), hasMore: false, highRiskCount: highRisk, criticalRiskCount: criticalRisk },
        };
      }, 180);
      sendValidatedResponse(res, response, failurePredictionListResponseSchema);
    } catch (error) {
      handleError(res, error, "Failure Predictions");
    }
  });
}
