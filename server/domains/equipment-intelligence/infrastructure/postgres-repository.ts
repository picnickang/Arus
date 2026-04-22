import { db } from "../../../db-config.js";
import { equipment, vessels, failurePredictions, actionableInsights } from "@shared/schema-runtime";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { logger } from "../../../utils/logger.js";
import type { EquipmentIntelligenceRepository } from "../domain/ports.js";
import type {
  FleetSummary,
  FleetSummaryVessel,
  EquipmentRiskItem,
  EquipmentDetailData,
  WorkOrderSummary,
  SystemDetails,
} from "../domain/types.js";

function computeRisk(health: number): "critical" | "warning" | "low" {
  if (health < 40) {return "critical";}
  if (health < 70) {return "warning";}
  return "low";
}

function computeTrend(telemetry: number[]): "declining" | "stable" | "improving" {
  if (telemetry.length < 2) {return "stable";}
  const first = telemetry.slice(0, Math.ceil(telemetry.length / 2));
  const second = telemetry.slice(Math.ceil(telemetry.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const diff = avgSecond - avgFirst;
  if (diff < -3) {return "declining";}
  if (diff > 3) {return "improving";}
  return "stable";
}

function statusFromRisk(risk: "critical" | "warning" | "low"): string {
  if (risk === "critical") {return "critical";}
  if (risk === "warning") {return "warning";}
  return "operational";
}

interface SignalObject {
  description?: string;
}

function isSignalObject(value: unknown): value is SignalObject {
  return typeof value === "object" && value !== null && "description" in value;
}

function parseSignalEntry(entry: unknown): string {
  if (typeof entry === "string") {return entry;}
  if (isSignalObject(entry) && typeof entry.description === "string") {return entry.description;}
  return String(entry);
}

interface MlModelRow {
  status: string | null;
  createdAt: Date | string | null;
}

export class PostgresEquipmentIntelligenceRepository implements EquipmentIntelligenceRepository {
  async getFleetSummary(orgId: string): Promise<FleetSummary> {
    const allEquipment = await db
      .select({
        eq: equipment,
        vesselName: vessels.name,
        vesselDbId: vessels.id,
      })
      .from(equipment)
      .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
      .where(eq(equipment.orgId, orgId));

    const pdmScores = await this.fetchPdmScores(orgId);
    const healthMap = new Map<string, number>();
    for (const score of pdmScores) {
      if (!healthMap.has(score.equipmentId)) {
        healthMap.set(score.equipmentId, score.healthIdx);
      }
    }

    const vesselMap = new Map<string, FleetSummaryVessel>();

    for (const row of allEquipment) {
      const vId = row.eq.vesselId || "unassigned";
      const vName = row.vesselName || row.eq.vesselName || "Unassigned";
      const healthScore = healthMap.get(row.eq.id) ?? 100;
      const risk = computeRisk(healthScore);

      if (!vesselMap.has(vId)) {
        vesselMap.set(vId, {
          id: vId,
          name: vName,
          equipment: 0,
          critical: 0,
          warning: 0,
          healthy: 0,
          avgHealth: 0,
        });
      }
      const vessel = vesselMap.get(vId)!;
      vessel.equipment++;
      if (risk === "critical") {vessel.critical++;}
      else if (risk === "warning") {vessel.warning++;}
      else {vessel.healthy++;}
      vessel.avgHealth += healthScore;
    }

    const vArr = Array.from(vesselMap.values()).map((v) => ({
      ...v,
      avgHealth: v.equipment > 0 ? Math.round(v.avgHealth / v.equipment) : 100,
    }));

    const totalEquipment = allEquipment.length;
    const criticalCount = vArr.reduce((s, v) => s + v.critical, 0);
    const warningCount = vArr.reduce((s, v) => s + v.warning, 0);
    const healthyCount = vArr.reduce((s, v) => s + v.healthy, 0);
    const fleetHealth =
      totalEquipment > 0
        ? Math.round(vArr.reduce((s, v) => s + v.avgHealth * v.equipment, 0) / totalEquipment)
        : 100;

    const pdmDataAvailable = pdmScores.length > 0;

    return {
      fleetHealth,
      vessels: vArr.filter((v) => v.id !== "unassigned"),
      totalEquipment,
      criticalCount,
      warningCount,
      healthyCount,
      dataStatus: pdmDataAvailable ? "ok" as const : "degraded" as const,
    };
  }

  async getEquipmentRiskList(orgId: string): Promise<EquipmentRiskItem[]> {
    const allEquipment = await db
      .select({
        eq: equipment,
        vesselName: vessels.name,
      })
      .from(equipment)
      .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
      .where(eq(equipment.orgId, orgId));

    const pdmScores = await this.fetchPdmScores(orgId);
    const healthMap = new Map<string, number>();
    for (const score of pdmScores) {
      if (!healthMap.has(score.equipmentId)) {
        healthMap.set(score.equipmentId, score.healthIdx);
      }
    }

    const predictions = await this.fetchPredictions(orgId);
    const predMap = new Map<string, typeof predictions[0]>();
    for (const p of predictions) {
      if (!predMap.has(p.equipmentId) || (p.predictionTimestamp && (!predMap.get(p.equipmentId)!.predictionTimestamp || p.predictionTimestamp > predMap.get(p.equipmentId)!.predictionTimestamp!))) {
        predMap.set(p.equipmentId, p);
      }
    }

    const insights = await this.fetchInsights(orgId);
    const insightMap = new Map<string, string[]>();
    for (const ins of insights) {
      if (!ins.equipmentId) {continue;}
      const existing = insightMap.get(ins.equipmentId) || [];
      if (ins.supportingSignals) {
        try {
          const signals = JSON.parse(ins.supportingSignals);
          if (Array.isArray(signals)) {
            existing.push(...signals.map(parseSignalEntry));
          }
        } catch {
          existing.push(ins.supportingSignals);
        }
      }
      insightMap.set(ins.equipmentId, existing.slice(0, 5));
    }

    const telemetryMap = await this.fetchTelemetrySummaries(orgId, allEquipment.map((e) => e.eq.id));
    const hasPdmData = pdmScores.length > 0;
    const hasPredictions = predictions.length > 0;

    return allEquipment.map((row) => {
      const healthScore = healthMap.get(row.eq.id) ?? 100;
      const pred = predMap.get(row.eq.id);
      const risk = computeRisk(healthScore);
      const telemetry = telemetryMap.get(row.eq.id) || [healthScore];
      const trend = computeTrend(telemetry);
      const signals = insightMap.get(row.eq.id) || [];

      const hasEquipmentPdm = healthMap.has(row.eq.id);
      const dataAvailability: "full" | "partial" | "unavailable" =
        hasEquipmentPdm && hasPredictions ? "full" : (hasPdmData || hasPredictions) ? "partial" : "unavailable";

      return {
        id: row.eq.id,
        name: row.eq.name,
        vessel: row.vesselName || row.eq.vesselName || "Unassigned",
        vesselId: row.eq.vesselId || "unassigned",
        health: Math.round(healthScore),
        rul: pred?.remainingUsefulLife ?? 365,
        risk,
        status: statusFromRisk(risk),
        type: row.eq.type || row.eq.equipmentType || "General",
        prediction: pred?.failureMode
          ? `${pred.failureMode} — ${this.recommendedActionText(risk, pred.remainingUsefulLife ?? 365)}`
          : dataAvailability === "unavailable"
            ? "No prediction data available"
            : risk === "low"
              ? "Operating within normal parameters"
              : "Monitoring — data analysis in progress",
        confidence: pred ? Math.round((pred.failureProbability ?? 0.85) * 100) : 85,
        trend,
        lastService: null,
        nextDue: null,
        telemetry,
        signals,
        dataAvailability,
      };
    });
  }

  async getEquipmentDetail(orgId: string, equipmentId: string): Promise<EquipmentDetailData | null> {
    const [row] = await db
      .select({
        eq: equipment,
        vesselName: vessels.name,
      })
      .from(equipment)
      .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
      .where(and(eq(equipment.orgId, orgId), eq(equipment.id, equipmentId)));

    if (!row) {return null;}

    const pdmScores = await this.fetchPdmScores(orgId, equipmentId);
    const healthScore = pdmScores[0]?.healthIdx ?? 100;
    const risk = computeRisk(healthScore);

    const predictions = await this.fetchPredictions(orgId, equipmentId);
    const pred = predictions[0];

    const insights = await this.fetchInsights(orgId, equipmentId);
    const signals: string[] = [];
    for (const ins of insights) {
      if (ins.supportingSignals) {
        try {
          const parsed: unknown[] = JSON.parse(ins.supportingSignals);
          if (Array.isArray(parsed)) {
            signals.push(...parsed.map(parseSignalEntry));
          }
        } catch {
          signals.push(ins.supportingSignals);
        }
      }
    }

    const telemetryMap = await this.fetchTelemetrySummaries(orgId, [equipmentId]);
    const telemetry = telemetryMap.get(equipmentId) || [healthScore];
    const trend = computeTrend(telemetry);

    const workOrders = await this.getWorkOrdersForEquipment(orgId, equipmentId);

    const hasPdm = pdmScores.length > 0;
    const hasPred = predictions.length > 0;
    const dataAvailability: "full" | "partial" | "unavailable" =
      hasPdm && hasPred ? "full" : (hasPdm || hasPred) ? "partial" : "unavailable";

    return {
      id: row.eq.id,
      name: row.eq.name,
      vessel: row.vesselName || row.eq.vesselName || "Unassigned",
      vesselId: row.eq.vesselId || "unassigned",
      type: row.eq.type || row.eq.equipmentType || "General",
      health: Math.round(healthScore),
      rul: pred?.remainingUsefulLife ?? 365,
      risk,
      confidence: pred ? Math.round((pred.failureProbability ?? 0.85) * 100) : 85,
      prediction: pred?.failureMode
        ? `${pred.failureMode} — ${this.recommendedActionText(risk, pred.remainingUsefulLife ?? 365)}`
        : dataAvailability === "unavailable"
          ? "No prediction data available"
          : "Operating within normal parameters",
      trend,
      signals: signals.slice(0, 10),
      telemetry,
      lastService: workOrders.find((wo) => wo.status === "completed")?.completedAt || null,
      nextDue: workOrders.find((wo) => wo.status === "scheduled" || wo.status === "pending" || wo.status === "open")?.createdAt || null,
      workOrders,
      dataAvailability,
    };
  }

  async getWorkOrdersForEquipment(orgId: string, equipmentId: string): Promise<WorkOrderSummary[]> {
    const { workOrders } = await import("@shared/schema-runtime");
    const rows = await db
      .select({
        id: workOrders.id,
        description: workOrders.description,
        status: workOrders.status,
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
      })
      .from(workOrders)
      .where(and(eq(workOrders.equipmentId, equipmentId), eq(workOrders.orgId, orgId)))
      .orderBy(desc(workOrders.createdAt))
      .limit(20);

    return rows.map((r) => ({
      id: r.id,
      title: r.description || "Work Order",
      status: r.status,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "",
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString().split("T")[0] : null,
    }));
  }

  async getSystemDetails(orgId: string): Promise<SystemDetails> {
    const { mlModels } = await import("@shared/schema-runtime");
    const models: MlModelRow[] = await db
      .select({
        status: mlModels.status,
        createdAt: mlModels.createdAt,
      })
      .from(mlModels)
      .where(eq(mlModels.orgId, orgId))
      .limit(10);
    const healthyCount = models.filter((m) => m.status === "active" || m.status === "deployed").length;
    const totalCount = models.length || 1;

    let dataQuality = "No validation data";
    try {
      const { modelPerformanceValidations } = await import("@shared/schema-runtime");
      const [accuracyResult] = await db
        .select({
          avgAccuracy: sql<number>`COALESCE(AVG(${modelPerformanceValidations.accuracyScore}), 0)`,
          validationCount: sql<number>`COUNT(*)`,
        })
        .from(modelPerformanceValidations)
        .where(eq(modelPerformanceValidations.orgId, orgId));

      if (accuracyResult && Number(accuracyResult.validationCount) > 0) {
        dataQuality = `${(Number(accuracyResult.avgAccuracy) * 100).toFixed(1)}% accuracy`;
      }
    } catch {
      dataQuality = "No validation data";
    }

    let sensorsOnline = "No telemetry data";
    try {
      const { equipmentTelemetry } = await import("@shared/schema-runtime");
      const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [sensorResult] = await db
        .select({
          activeCount: sql<number>`COUNT(DISTINCT ${equipmentTelemetry.equipmentId})`,
        })
        .from(equipmentTelemetry)
        .where(
          and(
            eq(equipmentTelemetry.orgId, orgId),
            sql`${equipmentTelemetry.ts} >= ${recentCutoff}`
          )
        );

      if (sensorResult) {
        sensorsOnline = `${Number(sensorResult.activeCount)} reporting (24h)`;
      }
    } catch {
      sensorsOnline = "No telemetry data";
    }

    return {
      modelStatus: healthyCount === totalCount && totalCount > 0
        ? "All models healthy"
        : totalCount === 0
          ? "No models configured"
          : `${healthyCount}/${totalCount} active`,
      lastTraining: models[0]?.createdAt
        ? this.timeAgo(new Date(models[0].createdAt))
        : "No training data",
      inferenceLatency: models.length > 0 ? `${models.length} active` : "No models deployed",
      dataQuality,
      sensorsOnline,
    };
  }

  private async fetchPdmScores(orgId: string, equipmentId?: string) {
    const { pdmScoreLogs } = await import("@shared/schema-runtime");
    const conditions = [eq(pdmScoreLogs.orgId, orgId)];
    if (equipmentId) {conditions.push(eq(pdmScoreLogs.equipmentId, equipmentId));}
    return db
      .select({
        equipmentId: pdmScoreLogs.equipmentId,
        healthIdx: pdmScoreLogs.healthIdx,
        ts: pdmScoreLogs.ts,
      })
      .from(pdmScoreLogs)
      .where(and(...conditions))
      .orderBy(desc(pdmScoreLogs.ts))
      .limit(equipmentId ? 20 : 500);
  }

  private async fetchPredictions(orgId: string, equipmentId?: string) {
    const conditions = [eq(failurePredictions.orgId, orgId)];
    if (equipmentId) {conditions.push(eq(failurePredictions.equipmentId, equipmentId));}
    return db
      .select()
      .from(failurePredictions)
      .where(and(...conditions))
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(equipmentId ? 5 : 200);
  }

  private async fetchInsights(orgId: string, equipmentId?: string) {
    const conditions = [eq(actionableInsights.orgId, orgId)];
    if (equipmentId) {conditions.push(eq(actionableInsights.equipmentId, equipmentId));}
    return db
      .select()
      .from(actionableInsights)
      .where(and(...conditions))
      .orderBy(desc(actionableInsights.createdAt))
      .limit(equipmentId ? 10 : 200);
  }

  private async fetchTelemetrySummaries(
    orgId: string,
    equipmentIds: string[]
  ): Promise<Map<string, number[]>> {
    const result = new Map<string, number[]>();
    if (equipmentIds.length === 0) {return result;}

    try {
      const { pdmScoreLogs } = await import("@shared/schema-runtime");
      const rows = await db
        .select({
          equipmentId: pdmScoreLogs.equipmentId,
          healthIdx: pdmScoreLogs.healthIdx,
        })
        .from(pdmScoreLogs)
        .where(
          and(
            eq(pdmScoreLogs.orgId, orgId),
            inArray(pdmScoreLogs.equipmentId, equipmentIds)
          )
        )
        .orderBy(pdmScoreLogs.ts)
        .limit(equipmentIds.length * 20);

      for (const row of rows) {
        const existing = result.get(row.equipmentId) || [];
        existing.push(Math.round(row.healthIdx));
        result.set(row.equipmentId, existing);
      }

      for (const [key, values] of result.entries()) {
        result.set(key, values.slice(-9));
      }
    } catch (error) {
      logger.warn("[EquipmentIntelligence] Failed to fetch telemetry summaries — sparklines will be empty", { error: String(error) });
    }

    return result;
  }

  private recommendedActionText(risk: string, rul: number): string {
    if (risk === "critical") {return `replace within ${rul} days`;}
    if (risk === "warning") {return "monitor closely";}
    return "continue normal operations";
  }

  private timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {return "today";}
    if (days === 1) {return "1 day ago";}
    return `${days} days ago`;
  }
}
