/**
 * Analytics Routes - Equipment Health and RUL Predictions
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import { equipmentHealthResponseSchema, rulBatchResponseSchema, type EquipmentHealthResponse, type RulBatchResponse } from "../../../shared/analytics-types";
import { storage } from "../../storage";
import { getOrgId, sendValidatedResponse, handleError } from "./helpers.js";

type EquipmentHealthItem = {
  id: string;
  name: string | null;
  type: string | null;
  vesselId: string | null;
  status: string;
  healthIndex: number;
};

type WorkOrderItem = {
  id: string;
  equipmentId: string;
  status: string;
  createdAt: Date;
  actualEndDate?: Date | null;
  plannedStartDate?: Date | null;
};

type AlertItem = {
  id: string;
  equipmentId: string;
  acknowledged: boolean;
};

function mapCondition(status: string, healthIndex: number): "excellent" | "good" | "fair" | "poor" | "critical" {
  if (status === "healthy") {return healthIndex >= 80 ? "excellent" : "good";}
  if (status === "warning") {return healthIndex >= 50 ? "fair" : "poor";}
  if (status === "critical") {return "critical";}
  return "fair";
}

function mapRiskLevel(status: string, healthIndex: number): "low" | "medium" | "high" | "critical" {
  if (status === "healthy") {return "low";}
  if (status === "warning") {return healthIndex >= 50 ? "medium" : "high";}
  if (status === "critical") {return "critical";}
  return "medium";
}

function mapEquipmentToHealthResult(
  eq: EquipmentHealthItem,
  allWorkOrders: WorkOrderItem[],
  allAlerts: AlertItem[],
  vesselMap: Map<string, string>
) {
  const equipmentWorkOrders = allWorkOrders
    .filter(wo => wo.equipmentId === eq.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastCompleted = equipmentWorkOrders.find(wo => wo.status === "completed");
  const nextScheduled = equipmentWorkOrders.find(wo => wo.status === "open" || wo.status === "in_progress");
  const equipmentAlerts = allAlerts.filter(a => a.equipmentId === eq.id && !a.acknowledged);
  return {
    id: eq.id,
    name: eq.name || "Unknown Equipment",
    type: eq.type || "Unknown",
    vesselId: eq.vesselId || null,
    vesselName: eq.vesselId ? vesselMap.get(eq.vesselId) : undefined,
    condition: mapCondition(eq.status, eq.healthIndex),
    healthScore: eq.healthIndex,
    riskLevel: mapRiskLevel(eq.status, eq.healthIndex),
    lastMaintenanceDate: lastCompleted?.actualEndDate ? new Date(lastCompleted.actualEndDate) : null,
    nextMaintenanceDate: nextScheduled?.plannedStartDate ? new Date(nextScheduled.plannedStartDate) : null,
    alertCount: equipmentAlerts.length,
    operatingHours: 0,
    telemetryStatus: "active" as const,
  };
}

type PdmScoreItem = {
  equipmentId: string;
  predictedDueDate?: Date | null;
  pFail30d?: number | null;
  healthIdx?: number | null;
  ts?: Date | null;
};

type EquipmentRegistryItem = {
  id: string;
  name: string;
  orgId: string;
};

function calculateRemainingDays(predictedDueDate: Date | null | undefined): number {
  if (!predictedDueDate) {return 30;}
  const now = new Date();
  return Math.max(0, Math.ceil((new Date(predictedDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function mapRiskFromProbability(failProb: number): "low" | "medium" | "high" | "critical" {
  if (failProb >= 0.75) {return "critical";}
  if (failProb >= 0.5) {return "high";}
  if (failProb >= 0.25) {return "medium";}
  return "low";
}

function mapPdmScoreToRulResult(score: PdmScoreItem, equipmentMap: Map<string, EquipmentRegistryItem>) {
  const equip = equipmentMap.get(score.equipmentId);
  const remainingDays = calculateRemainingDays(score.predictedDueDate);
  const failProb = score.pFail30d ?? 0;
  const riskLevel = mapRiskFromProbability(failProb);
  const recs = riskLevel === "critical"
    ? ["Schedule immediate inspection", "Prepare replacement parts"]
    : riskLevel === "high"
      ? ["Monitor closely", "Plan maintenance within 2 weeks"]
      : [];
  return {
    equipmentId: score.equipmentId,
    equipmentName: equip?.name || "Unknown Equipment",
    remainingDays,
    confidence: Math.max(0.5, 1 - failProb * 0.5),
    riskLevel,
    dataQuality: score.healthIdx ? Math.min(1, score.healthIdx / 100) : 0.7,
    predictionDate: score.ts || new Date(),
    methodology: "ml-hybrid" as const,
    contributingFactors: [],
    maintenanceRecommendations: recs,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string): boolean { return UUID_REGEX.test(id); }

export function mountHealthMetricsRoutes(router: Router) {
  router.get("/equipment-health", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) return;
      const { equipmentId } = req.query;
      const cacheKey = analyticsCacheKeys.equipmentHealth(orgId, equipmentId as string | undefined);
      const response = await cachedAnalytics<EquipmentHealthResponse>(cacheKey, async () => {
        const rawHealthData = await storage.getEquipmentHealth(orgId, undefined, equipmentId as string | undefined);
        const healthData = rawHealthData.filter(eq => isValidUuid(eq.id));
        const [allWorkOrders, rawAlerts, vesselList] = await Promise.all([
          storage.getWorkOrders(undefined, orgId),
          storage.getAlertNotifications(undefined),
          storage.getVessels(orgId),
        ]);
        const vesselMap = new Map(vesselList.map(v => [v.id, v.name]));
        const orgEquipmentIds = new Set(healthData.map(eq => eq.id));
        const allAlerts = rawAlerts.filter(a => orgEquipmentIds.has(a.equipmentId));
        const results = healthData.map(eq => mapEquipmentToHealthResult(eq, allWorkOrders, allAlerts, vesselMap));
        return { results, metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: 100, hasMore: false } };
      }, 300);
      sendValidatedResponse(res, response, equipmentHealthResponseSchema);
    } catch (error) {
      handleError(res, error, "Equipment Health");
    }
  });

  router.get("/rul-predictions", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) return;
      const { equipmentId } = req.query;
      const cacheKey = analyticsCacheKeys.rulPredictions(orgId, equipmentId as string | undefined);
      const response = await cachedAnalytics<RulBatchResponse>(cacheKey, async () => {
        const pdmScores = await storage.getPdmScores(equipmentId as string | undefined, orgId);
        const equipmentList = await storage.getEquipmentRegistry(orgId);
        const equipmentMap = new Map(equipmentList.map(e => [e.id, e]));
        const orgPdmScores = pdmScores.filter(s => equipmentMap.get(s.equipmentId)?.orgId === orgId);
        const results = orgPdmScores.map(score => mapPdmScoreToRulResult(score, equipmentMap));
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
            requestedCount: equipmentId ? 1 : orgPdmScores.length,
            successCount: results.length,
            failedCount: 0,
          },
        };
      }, 300);
      sendValidatedResponse(res, response, rulBatchResponseSchema);
    } catch (error) {
      handleError(res, error, "RUL Predictions");
    }
  });
}
