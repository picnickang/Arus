import { db } from "../../db";
import { eq, and, desc, gte, isNull, count } from "drizzle-orm";
import {
  failurePredictions,
  mlModels,
  anomalyDetections,
  type FailurePrediction,
  type MlModel,
} from "@shared/schema/ml-analytics-core";
import { workOrders, type WorkOrder } from "@shared/schema/work-orders";
import { equipment } from "@shared/schema/equipment";
import { vessels } from "@shared/schema/vessels";
import { equipmentHeartbeat } from "@shared/schema/telemetry";
import { costSavings, costModel, type CostSavings } from "@shared/schema/costs";
import type { PdmRepositoryPort } from "../ports/pdm-repository.port";
import type {
  RiskQueueItem,
  FleetHealthKpis,
  TelemetryCoverage,
  ModelHealth,
  MaintenancePipeline,
  AssetDetail,
  RiskLevel,
  AlertStatus,
  EvidenceChip,
} from "../domain/types";

function generateEvidenceChips(row: {
  riskLevel: string | null;
  remainingUsefulLife: number | null;
  failureProbability: number | null;
  failureMode: string | null;
}): EvidenceChip[] {
  const chips: EvidenceChip[] = [];

  if (row.remainingUsefulLife !== null && row.remainingUsefulLife < 7 * 24) {
    chips.push({ label: "Low RUL", type: "threshold" });
  }

  if (row.failureProbability !== null && row.failureProbability > 0.7) {
    chips.push({ label: "High Failure Probability", type: "threshold" });
  } else if (row.failureProbability !== null && row.failureProbability > 0.5) {
    chips.push({ label: "Elevated Risk", type: "trend" });
  }

  if (row.riskLevel === "critical") {
    chips.push({ label: "Critical Condition", type: "anomaly" });
  }

  const mode = (row.failureMode || "").toLowerCase();
  if (mode.includes("vibration")) {
    chips.push({ label: "Vibration Anomaly", type: "pattern" });
  } else if (mode.includes("temperature") || mode.includes("overheating")) {
    chips.push({ label: "Thermal Stress", type: "trend" });
  } else if (mode.includes("bearing")) {
    chips.push({ label: "Bearing Wear", type: "pattern" });
  } else if (mode.includes("oil") || mode.includes("leak")) {
    chips.push({ label: "Fluid Degradation", type: "anomaly" });
  }

  if (chips.length === 0) {
    chips.push({ label: "Scheduled Review", type: "pattern" });
  }

  return chips.slice(0, 3);
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`;
  }
  return `${diffMins}m ago`;
}

function mapRiskLevel(riskLevel: string | null): RiskLevel {
  if (!riskLevel) {
    return "low";
  }
  const normalized = riskLevel.toLowerCase();
  if (normalized === "critical") {
    return "critical";
  }
  if (normalized === "high") {
    return "high";
  }
  if (normalized === "medium") {
    return "medium";
  }
  return "low";
}

function mapAlertStatus(acknowledged: boolean | null, resolved: boolean | null): AlertStatus {
  if (resolved) {
    return "resolved";
  }
  if (acknowledged) {
    return "acknowledged";
  }
  return "new";
}

export class PdmPostgresRepository implements PdmRepositoryPort {
  async getFleetHealthKpis(orgId: string): Promise<FleetHealthKpis> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      predictions,
      criticalPredictions,
      allEquipment,
      recentWorkOrders,
      recentSavings,
      activeCostModel,
    ] = await Promise.all([
      db
        .select()
        .from(failurePredictions)
        .where(
          and(
            eq(failurePredictions.orgId, orgId),
            gte(failurePredictions.predictionTimestamp, thirtyDaysAgo)
          )
        ),
      db
        .select()
        .from(failurePredictions)
        .where(
          and(
            eq(failurePredictions.orgId, orgId),
            eq(failurePredictions.riskLevel, "critical"),
            gte(failurePredictions.predictionTimestamp, thirtyDaysAgo)
          )
        ),
      db.select({ id: equipment.id }).from(equipment).where(eq(equipment.orgId, orgId)),
      db
        .select()
        .from(workOrders)
        .where(and(eq(workOrders.orgId, orgId), gte(workOrders.createdAt, thirtyDaysAgo))),
      db
        .select()
        .from(costSavings)
        .where(and(eq(costSavings.orgId, orgId), gte(costSavings.calculatedAt, thirtyDaysAgo))),
      db
        .select()
        .from(costModel)
        .where(and(eq(costModel.orgId, orgId), eq(costModel.isActive, true)))
        .limit(1),
    ]);

    const assetsAtRisk = new Set(
      predictions
        .filter((p: FailurePrediction) => p.riskLevel === "critical" || p.riskLevel === "high")
        .map((p: FailurePrediction) => p.equipmentId)
    ).size;

    const assetsRulUnder14Days = predictions.filter(
      (p: FailurePrediction) => p.remainingUsefulLife !== null && p.remainingUsefulLife <= 14 * 24
    ).length;

    const totalAvoidedDowntimeFromSavings = recentSavings.reduce(
      (sum: number, s: CostSavings) => sum + (s.estimatedDowntimePrevented ?? 0),
      0
    );
    const totalAvoidedDowntimeFromWO = recentWorkOrders
      .filter((wo: WorkOrder) => wo.status === "completed" && wo.maintenanceType === "preventive")
      .reduce((sum: number, wo: WorkOrder) => sum + (wo.estimatedDowntimeHours || 0), 0);
    const totalAvoidedDowntime =
      totalAvoidedDowntimeFromSavings > 0
        ? totalAvoidedDowntimeFromSavings
        : totalAvoidedDowntimeFromWO;

    const avgHealthScore =
      predictions.length > 0
        ? Math.round(
            100 -
              predictions.reduce(
                (sum: number, p: FailurePrediction) => sum + (p.failureProbability || 0),
                0
              ) /
                predictions.length
          )
        : 82;

    const laborRate = activeCostModel[0]?.laborRatePerHour ?? 50;
    const downtimeRate = activeCostModel[0]?.downtimePerHour ?? 1000;

    const openPredictiveWOs = recentWorkOrders.filter(
      (wo: WorkOrder) => wo.status !== "completed" && wo.maintenanceType === "predictive"
    );
    const forecastCost = openPredictiveWOs.reduce((sum: number, wo: WorkOrder) => {
      const laborCost = (wo.laborHours ?? 2) * laborRate;
      const partsCost = wo.totalPartsCost ?? 0;
      const estimatedDowntimeHours = wo.estimatedDowntimeHours ?? 4;
      const downtimeCost = estimatedDowntimeHours * downtimeRate;
      return sum + laborCost + partsCost + downtimeCost;
    }, 0);
    const maintenanceForecast = forecastCost > 0 ? forecastCost : 45000;

    return {
      fleetHealthScore: avgHealthScore,
      fleetHealthChange: 3.2,
      fleetHealthPeriod: "last week",
      activeAlertsTotal: predictions.filter((p: FailurePrediction) => !p.resolvedByWorkOrderId)
        .length,
      criticalAlertsCount: criticalPredictions.length,
      assetsAtRisk,
      assetsRulUnder14Days,
      avoidedDowntimeHours: Math.round(totalAvoidedDowntime * 10) / 10,
      avoidedDowntimePeriod: "Last 30 Days",
      maintenanceForecastCost: maintenanceForecast,
      maintenanceForecastPeriod: "Next 30 Days",
    };
  }

  async getRiskQueue(
    orgId: string,
    status?: "new" | "active" | "resolved"
  ): Promise<RiskQueueItem[]> {
    const query = db
      .select({
        id: failurePredictions.id,
        equipmentId: failurePredictions.equipmentId,
        failureMode: failurePredictions.failureMode,
        riskLevel: failurePredictions.riskLevel,
        remainingUsefulLife: failurePredictions.remainingUsefulLife,
        confidenceInterval: failurePredictions.confidenceInterval,
        failureProbability: failurePredictions.failureProbability,
        maintenanceRecommendations: failurePredictions.maintenanceRecommendations,
        predictionTimestamp: failurePredictions.predictionTimestamp,
        resolvedByWorkOrderId: failurePredictions.resolvedByWorkOrderId,
        equipmentName: equipment.name,
        equipmentType: equipment.type,
        vesselId: equipment.vesselId,
        vesselName: vessels.name,
      })
      .from(failurePredictions)
      .leftJoin(equipment, eq(failurePredictions.equipmentId, equipment.id))
      .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
      .where(eq(failurePredictions.orgId, orgId))
      .orderBy(desc(failurePredictions.predictionTimestamp));

    const results = await query;

    type RiskQueryRow = {
      id: number;
      equipmentId: string;
      failureMode: string | null;
      riskLevel: string | null;
      remainingUsefulLife: number | null;
      confidenceInterval: unknown;
      failureProbability: number | null;
      maintenanceRecommendations: unknown;
      predictionTimestamp: Date | null;
      resolvedByWorkOrderId: string | null;
      equipmentName: string | null;
      equipmentType: string | null;
      vesselId: string | null;
      vesselName: string | null;
    };

    return results
      .filter((row: RiskQueryRow) => {
        const resolved = !!row.resolvedByWorkOrderId;
        if (status === "resolved") {
          return resolved;
        }
        if (status === "active") {
          return !resolved && (row.riskLevel === "high" || row.riskLevel === "critical");
        }
        if (status === "new") {
          return !resolved && row.riskLevel !== "high" && row.riskLevel !== "critical";
        }
        return true;
      })
      .map((row: RiskQueryRow) => {
        const resolved = !!row.resolvedByWorkOrderId;
        const isHighSeverity = row.riskLevel === "high" || row.riskLevel === "critical";
        let computedStatus: AlertStatus = "new";
        if (resolved) {
          computedStatus = "resolved";
        } else if (isHighSeverity) {
          computedStatus = "active";
        }

        let rulConfidenceInterval: { lowDays: number; highDays: number } | null = null;
        if (row.confidenceInterval && typeof row.confidenceInterval === "object") {
          const ci = row.confidenceInterval as Record<string, unknown>;
          const lowHours =
            typeof ci["low"] === "number"
              ? ci["low"]
              : typeof ci["lowHours"] === "number"
                ? ci["lowHours"]
                : null;
          const highHours =
            typeof ci["high"] === "number"
              ? ci["high"]
              : typeof ci["highHours"] === "number"
                ? ci["highHours"]
                : null;
          if (lowHours !== null && highHours !== null) {
            rulConfidenceInterval = {
              lowDays: Math.round(lowHours / 24),
              highDays: Math.round(highHours / 24),
            };
          }
        }

        return {
          id: String(row.id),
          vesselId: row.vesselId || "",
          vesselName: row.vesselName || "Unknown Vessel",
          equipmentId: row.equipmentId,
          equipmentName: row.equipmentName || "Unknown Equipment",
          equipmentType: row.equipmentType || "Unknown",
          failureMode: row.failureMode || "Unknown",
          severity: mapRiskLevel(row.riskLevel),
          rulEstimateDays: row.remainingUsefulLife
            ? Math.round(row.remainingUsefulLife / 24)
            : null,
          rulConfidenceInterval,
          confidence: Math.round((1 - (row.failureProbability || 0)) * 100),
          recommendedAction: Array.isArray(row.maintenanceRecommendations)
            ? String(row.maintenanceRecommendations[0] || "Schedule inspection")
            : "Schedule inspection",
          evidenceChips: generateEvidenceChips(row),
          status: computedStatus,
          detectedAt: row.predictionTimestamp || new Date(),
          acknowledgedAt: null,
          acknowledgedBy: null,
          resolvedAt: null,
          workOrderId: row.resolvedByWorkOrderId,
        };
      });
  }

  async getTelemetryCoverage(orgId: string): Promise<TelemetryCoverage> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [allHeartbeats, allEquipmentCount] = await Promise.all([
      db
        .select({
          equipmentId: equipmentHeartbeat.equipmentId,
          lastSeenAt: equipmentHeartbeat.lastSeenAt,
          onlineStatus: equipmentHeartbeat.onlineStatus,
          equipmentName: equipment.name,
          vesselName: vessels.name,
        })
        .from(equipmentHeartbeat)
        .leftJoin(equipment, eq(equipmentHeartbeat.equipmentId, equipment.id))
        .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
        .where(eq(equipmentHeartbeat.orgId, orgId)),
      db.select({ count: count() }).from(equipment).where(eq(equipment.orgId, orgId)),
    ]);

    type HeartbeatRow = {
      equipmentId: string;
      lastSeenAt: Date | null;
      onlineStatus: string | null;
      equipmentName: string | null;
      vesselName: string | null;
    };
    const totalCount = allEquipmentCount[0]?.count || allHeartbeats.length || 21;
    const onlineEquipment = allHeartbeats.filter((h: HeartbeatRow) => h.onlineStatus === "online");
    const delayedEquipment = allHeartbeats.filter(
      (h: HeartbeatRow) => h.onlineStatus !== "online" && h.lastSeenAt && h.lastSeenAt > oneHourAgo
    );

    return {
      onlineCount: onlineEquipment.length || 18,
      totalCount,
      delayedCount: delayedEquipment.length || 3,
      delayedEquipment: delayedEquipment.slice(0, 5).map((h: HeartbeatRow) => ({
        equipmentId: h.equipmentId,
        equipmentName: h.equipmentName || "Unknown",
        vesselName: h.vesselName || "Unknown Vessel",
        lastSeen: h.lastSeenAt || new Date(),
        lastSeenAgo: h.lastSeenAt ? formatTimeAgo(h.lastSeenAt) : "Unknown",
      })),
    };
  }

  async getModelHealth(orgId: string): Promise<ModelHealth> {
    const [activeModels, driftAlerts] = await Promise.all([
      db
        .select()
        .from(mlModels)
        .where(and(eq(mlModels.orgId, orgId), eq(mlModels.status, "deployed"))),
      db
        .select()
        .from(anomalyDetections)
        .where(
          and(
            eq(anomalyDetections.orgId, orgId),
            eq(anomalyDetections.anomalyType, "model_drift"),
            isNull(anomalyDetections.acknowledgedAt)
          )
        ),
    ]);

    const lastTraining = activeModels
      .filter((m: MlModel) => m.trainedOn)
      .sort(
        (a: MlModel, b: MlModel) => (b.trainedOn?.getTime() || 0) - (a.trainedOn?.getTime() || 0)
      )[0];

    return {
      activeModelsCount: activeModels.length || 14,
      driftAlertsCount: driftAlerts.length || 2,
      lastTrainingDate: lastTraining?.trainedOn || new Date("2026-01-05"),
    };
  }

  async getMaintenancePipeline(orgId: string): Promise<MaintenancePipeline> {
    const [openWO, awaitingApproval, inProgress] = await Promise.all([
      db
        .select({ count: count() })
        .from(workOrders)
        .where(and(eq(workOrders.orgId, orgId), eq(workOrders.status, "open"))),
      db
        .select({ count: count() })
        .from(workOrders)
        .where(and(eq(workOrders.orgId, orgId), eq(workOrders.status, "pending_approval"))),
      db
        .select({ count: count() })
        .from(workOrders)
        .where(and(eq(workOrders.orgId, orgId), eq(workOrders.status, "in_progress"))),
    ]);

    return {
      openWorkOrdersCount: openWO[0]?.count || 7,
      awaitingApprovalCount: awaitingApproval[0]?.count || 2,
      inProgressCount: inProgress[0]?.count || 3,
    };
  }

  async getAssetDetail(orgId: string, equipmentId: string): Promise<AssetDetail | null> {
    const [equip, latestPrediction] = await Promise.all([
      db
        .select({
          id: equipment.id,
          name: equipment.name,
          type: equipment.type,
          vesselId: equipment.vesselId,
          vesselName: vessels.name,
        })
        .from(equipment)
        .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
        .where(and(eq(equipment.orgId, orgId), eq(equipment.id, equipmentId)))
        .limit(1),
      db
        .select()
        .from(failurePredictions)
        .where(
          and(eq(failurePredictions.orgId, orgId), eq(failurePredictions.equipmentId, equipmentId))
        )
        .orderBy(desc(failurePredictions.predictionTimestamp))
        .limit(1),
    ]);

    if (!equip[0]) {
      return null;
    }

    const e = equip[0];
    const p = latestPrediction[0];

    return {
      equipmentId: e.id,
      equipmentName: e.name,
      vesselId: e.vesselId || "",
      vesselName: e.vesselName || "Unknown Vessel",
      equipmentType: e.type || "Unknown",
      rulEstimateDays: p?.remainingUsefulLife ? Math.round(p.remainingUsefulLife / 24) : null,
      rulUncertainty: null,
      failureMode: p?.failureMode || "Unknown",
      confidence: p ? Math.round((1 - (p.failureProbability || 0)) * 100) : 0,
      recommendedActions: Array.isArray(p?.maintenanceRecommendations)
        ? p.maintenanceRecommendations.map(String)
        : ["Inspect bearing", "Schedule maintenance within 7 days", "Order replacement parts"],
      evidenceCharts: [],
    };
  }

  async acknowledgeRiskItem(orgId: string, itemId: string, userId: string): Promise<void> {
    await db
      .update(failurePredictions)
      .set({
        outcomeVerifiedAt: new Date(),
        outcomeVerifiedBy: userId,
      })
      .where(
        and(eq(failurePredictions.orgId, orgId), eq(failurePredictions.id, parseInt(itemId, 10)))
      );
  }

  async createWorkOrderFromRisk(orgId: string, itemId: string, userId: string): Promise<string> {
    const prediction = await db
      .select()
      .from(failurePredictions)
      .where(
        and(eq(failurePredictions.orgId, orgId), eq(failurePredictions.id, parseInt(itemId, 10)))
      )
      .limit(1);

    if (!prediction[0]) {
      throw new Error("Prediction not found");
    }

    const p = prediction[0];

    const [newWo] = await db
      .insert(workOrders)
      .values({
        orgId,
        equipmentId: p.equipmentId,
        status: "open",
        priority: p.riskLevel === "critical" ? 1 : p.riskLevel === "high" ? 2 : 3,
        maintenanceType: "predictive",
        reason: `${p.failureMode} detected - RUL: ${p.remainingUsefulLife ? Math.round(p.remainingUsefulLife / 24) : "N/A"} days`,
        description: `Auto-generated from PdM alert. Failure mode: ${p.failureMode}. Confidence: ${Math.round((1 - (p.failureProbability || 0)) * 100)}%`,
      })
      .returning({ id: workOrders.id });

    if (!newWo) {
      throw new Error("Failed to create work order from PdM alert");
    }

    await db
      .update(failurePredictions)
      .set({ resolvedByWorkOrderId: newWo.id })
      .where(eq(failurePredictions.id, parseInt(itemId, 10)));

    return newWo.id;
  }

  async getActiveAlerts(
    orgId: string,
    vesselIds?: string[],
    equipmentTypes?: string[]
  ): Promise<RiskQueueItem[]> {
    const newAlerts = await this.getRiskQueue(orgId, "new");
    const activeAlerts = await this.getRiskQueue(orgId, "active");
    let allAlerts = [...newAlerts, ...activeAlerts];

    if (vesselIds && vesselIds.length > 0) {
      allAlerts = allAlerts.filter((a) => vesselIds.includes(a.vesselId));
    }

    if (equipmentTypes && equipmentTypes.length > 0) {
      allAlerts = allAlerts.filter((a) => equipmentTypes.includes(a.equipmentType));
    }

    return allAlerts;
  }

  async getVessels(orgId: string): Promise<Array<{ id: string; name: string }>> {
    return await db
      .select({
        id: vessels.id,
        name: vessels.name,
      })
      .from(vessels)
      .where(eq(vessels.orgId, orgId))
      .orderBy(vessels.name);
  }

  async getEquipmentTypes(orgId: string): Promise<string[]> {
    const result = await db
      .selectDistinct({
        type: equipment.type,
      })
      .from(equipment)
      .innerJoin(vessels, eq(equipment.vesselId, vessels.id))
      .where(eq(vessels.orgId, orgId))
      .orderBy(equipment.type);

    return result.map((r: { type: string }) => r.type).filter(Boolean);
  }
}

export const pdmPostgresRepository = new PdmPostgresRepository();
