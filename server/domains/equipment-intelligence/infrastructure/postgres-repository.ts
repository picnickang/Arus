import { db } from "../../../db-config.js";
import { equipment, vessels, failurePredictions, actionableInsights } from "@shared/schema-runtime";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { logger } from "../../../utils/logger.js";
import { deriveHubHealthFields } from "../domain/hub-health.js";
import type { EquipmentIntelligenceRepository } from "../domain/ports.js";
import {
  computeRisk,
  computeTrend,
  mapWorkOrderSummaryRow,
  parseSignalEntry,
  recommendedActionText,
  statusFromRisk,
  timeAgo,
} from "./postgres-repository-helpers.js";
import type {
  FleetSummary,
  FleetSummaryVessel,
  EquipmentRiskItem,
  EquipmentDetailData,
  WorkOrderSummary,
  SystemDetails,
} from "../domain/types.js";

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
      // A score row with a null healthIdx is no score — never default to 100.
      if (score.healthIdx != null && !healthMap.has(score.equipmentId)) {
        healthMap.set(score.equipmentId, score.healthIdx);
      }
    }

    const vesselMap = new Map<string, FleetSummaryVessel>();
    const scoredTotals = new Map<string, { sum: number; count: number }>();

    for (const row of allEquipment) {
      const vId = row.eq.vesselId || "unassigned";
      const vName = row.vesselName || row.eq.vesselName || "Unassigned";
      const healthScore = healthMap.get(row.eq.id) ?? null;

      if (!vesselMap.has(vId)) {
        vesselMap.set(vId, {
          id: vId,
          name: vName,
          equipment: 0,
          critical: 0,
          warning: 0,
          healthy: 0,
          noData: 0,
          avgHealth: null,
        });
        scoredTotals.set(vId, { sum: 0, count: 0 });
      }
      const vessel = vesselMap.get(vId)!;
      vessel.equipment++;
      if (healthScore == null) {
        vessel.noData++;
        continue;
      }
      const risk = computeRisk(healthScore);
      if (risk === "critical") {
        vessel.critical++;
      } else if (risk === "warning") {
        vessel.warning++;
      } else {
        vessel.healthy++;
      }
      const totals = scoredTotals.get(vId)!;
      totals.sum += healthScore;
      totals.count++;
    }

    const vArr = Array.from(vesselMap.values()).map((v) => {
      const totals = scoredTotals.get(v.id)!;
      return {
        ...v,
        avgHealth: totals.count > 0 ? Math.round(totals.sum / totals.count) : null,
      };
    });

    const totalEquipment = allEquipment.length;
    const criticalCount = vArr.reduce((s, v) => s + v.critical, 0);
    const warningCount = vArr.reduce((s, v) => s + v.warning, 0);
    const healthyCount = vArr.reduce((s, v) => s + v.healthy, 0);
    const noDataCount = vArr.reduce((s, v) => s + v.noData, 0);
    const scoredCount = totalEquipment - noDataCount;
    const fleetHealth =
      scoredCount > 0
        ? Math.round(Array.from(scoredTotals.values()).reduce((s, t) => s + t.sum, 0) / scoredCount)
        : null;

    const pdmDataAvailable = pdmScores.length > 0;

    return {
      fleetHealth,
      vessels: vArr.filter((v) => v.id !== "unassigned"),
      totalEquipment,
      criticalCount,
      warningCount,
      healthyCount,
      noDataCount,
      dataStatus: pdmDataAvailable ? ("ok" as const) : ("degraded" as const),
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
      if (score.healthIdx != null && !healthMap.has(score.equipmentId)) {
        healthMap.set(score.equipmentId, score.healthIdx);
      }
    }

    const predictions = await this.fetchPredictions(orgId);
    const predMap = new Map<string, (typeof predictions)[0]>();
    for (const p of predictions) {
      if (
        !predMap.has(p.equipmentId) ||
        (p.predictionTimestamp &&
          (!predMap.get(p.equipmentId)!.predictionTimestamp ||
            p.predictionTimestamp > predMap.get(p.equipmentId)!.predictionTimestamp!))
      ) {
        predMap.set(p.equipmentId, p);
      }
    }

    const insights = await this.fetchInsights(orgId);
    const insightMap = new Map<string, string[]>();
    for (const ins of insights) {
      if (!ins.equipmentId) {
        continue;
      }
      const existing = insightMap.get(ins.equipmentId) || [];
      if (ins.supportingSignals) {
        try {
          const signals = JSON.parse(String(ins.supportingSignals));
          if (Array.isArray(signals)) {
            existing.push(...signals.map(parseSignalEntry));
          }
        } catch {
          existing.push(String(ins.supportingSignals));
        }
      }
      insightMap.set(ins.equipmentId, existing.slice(0, 5));
    }

    const telemetryMap = await this.fetchTelemetrySummaries(
      orgId,
      allEquipment.map((e) => e.eq.id)
    );
    const hasPdmData = pdmScores.length > 0;
    const hasPredictions = predictions.length > 0;

    return allEquipment.map((row) => {
      const pred = predMap.get(row.eq.id) ?? null;
      // Same honest derivation as the equipment hub: no score row → null,
      // never a fabricated 100 / 365 d / 85%.
      const { health, rul, confidence } = deriveHubHealthFields(
        healthMap.get(row.eq.id) ?? null,
        pred
      );
      const risk = computeRisk(health ?? 100);
      const telemetry = telemetryMap.get(row.eq.id) || (health == null ? [] : [health]);
      const trend = computeTrend(telemetry);
      const signals = insightMap.get(row.eq.id) || [];

      const hasEquipmentPdm = healthMap.has(row.eq.id);
      const dataAvailability: "full" | "partial" | "unavailable" =
        hasEquipmentPdm && hasPredictions
          ? "full"
          : hasPdmData || hasPredictions
            ? "partial"
            : "unavailable";

      return {
        id: row.eq.id,
        name: row.eq.name,
        vessel: row.vesselName || row.eq.vesselName || "Unassigned",
        vesselId: row.eq.vesselId || "unassigned",
        health: health == null ? null : Math.round(health),
        rul,
        risk,
        status: statusFromRisk(risk),
        type: row.eq.type || "General",
        prediction: pred?.failureMode
          ? `${pred.failureMode} — ${recommendedActionText(risk, rul ?? 365)}`
          : health == null
            ? "No PdM score recorded yet"
            : dataAvailability === "unavailable"
              ? "No prediction data available"
              : risk === "low"
                ? "Operating within normal parameters"
                : "Monitoring — data analysis in progress",
        confidence,
        trend,
        lastService: null,
        nextDue: null,
        telemetry,
        signals,
        dataAvailability,
      };
    });
  }

  async getEquipmentDetail(
    orgId: string,
    equipmentId: string
  ): Promise<EquipmentDetailData | null> {
    const [row] = await db
      .select({
        eq: equipment,
        vesselName: vessels.name,
      })
      .from(equipment)
      .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
      .where(and(eq(equipment.orgId, orgId), eq(equipment.id, equipmentId)));

    if (!row) {
      return null;
    }

    const pdmScores = await this.fetchPdmScores(orgId, equipmentId);
    const predictions = await this.fetchPredictions(orgId, equipmentId);
    const pred = predictions[0];

    const {
      health: healthScore,
      rul,
      confidence,
    } = deriveHubHealthFields(pdmScores[0]?.healthIdx ?? null, pred ?? null);
    const risk = computeRisk(healthScore ?? 100);

    const insights = await this.fetchInsights(orgId, equipmentId);
    const signals: string[] = [];
    for (const ins of insights) {
      if (ins.supportingSignals) {
        try {
          const parsed: unknown[] = JSON.parse(String(ins.supportingSignals));
          if (Array.isArray(parsed)) {
            signals.push(...parsed.map(parseSignalEntry));
          }
        } catch {
          signals.push(String(ins.supportingSignals));
        }
      }
    }

    const telemetryMap = await this.fetchTelemetrySummaries(orgId, [equipmentId]);
    const telemetry = telemetryMap.get(equipmentId) || (healthScore == null ? [] : [healthScore]);
    const trend = computeTrend(telemetry);

    const workOrders = await this.getWorkOrdersForEquipment(orgId, equipmentId);

    const hasPdm = pdmScores.length > 0;
    const hasPred = predictions.length > 0;
    const dataAvailability: "full" | "partial" | "unavailable" =
      hasPdm && hasPred ? "full" : hasPdm || hasPred ? "partial" : "unavailable";

    return {
      id: row.eq.id,
      name: row.eq.name,
      vessel: row.vesselName || row.eq.vesselName || "Unassigned",
      vesselId: row.eq.vesselId || "unassigned",
      type: row.eq.type || "General",
      health: healthScore == null ? null : Math.round(healthScore),
      rul,
      risk,
      confidence,
      prediction: pred?.failureMode
        ? `${pred.failureMode} — ${recommendedActionText(risk, rul ?? 365)}`
        : healthScore == null
          ? "No PdM score recorded yet"
          : dataAvailability === "unavailable"
            ? "No prediction data available"
            : "Operating within normal parameters",
      trend,
      signals: signals.slice(0, 10),
      telemetry,
      lastService: ((): string | null => {
        const last = workOrders.find((wo) => wo.status === "completed") as
          | { actualEndDate?: Date | string | null }
          | undefined;
        const v = last?.actualEndDate;
        if (!v) {
          return null;
        }
        return v instanceof Date ? v.toISOString() : v;
      })(),
      nextDue:
        workOrders.find(
          (wo) => wo.status === "scheduled" || wo.status === "pending" || wo.status === "open"
        )?.createdAt || null,
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
        completedAt: workOrders.actualEndDate,
        assignedCrewId: workOrders.assignedCrewId,
        assignmentStatus: workOrders.assignmentStatus,
        assignmentResponseReason: workOrders.assignmentResponseReason,
        assignmentRespondedAt: workOrders.assignmentRespondedAt,
      })
      .from(workOrders)
      .where(and(eq(workOrders.equipmentId, equipmentId), eq(workOrders.orgId, orgId)))
      .orderBy(desc(workOrders.createdAt))
      .limit(20);

    return rows.map(mapWorkOrderSummaryRow);
  }

  async getSystemDetails(orgId: string): Promise<SystemDetails> {
    const { mlModels } = await import("@shared/schema-runtime");
    const models = await db
      .select({
        status: mlModels.status,
        createdAt: mlModels.createdAt,
      })
      .from(mlModels)
      .where(eq(mlModels.orgId, orgId))
      .limit(10);
    const healthyCount = models.filter(
      (m) => m.status === "active" || m.status === "deployed"
    ).length;
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
          and(eq(equipmentTelemetry.orgId, orgId), sql`${equipmentTelemetry.ts} >= ${recentCutoff}`)
        );

      if (sensorResult) {
        sensorsOnline = `${Number(sensorResult.activeCount)} reporting (24h)`;
      }
    } catch {
      sensorsOnline = "No telemetry data";
    }

    return {
      modelStatus:
        healthyCount === totalCount && totalCount > 0
          ? "All models healthy"
          : totalCount === 0
            ? "No models configured"
            : `${healthyCount}/${totalCount} active`,
      lastTraining: models[0]?.createdAt
        ? timeAgo(new Date(models[0].createdAt))
        : "No training data",
      inferenceLatency: models.length > 0 ? `${models.length} active` : "No models deployed",
      dataQuality,
      sensorsOnline,
    };
  }

  private async fetchPdmScores(orgId: string, equipmentId?: string) {
    const { pdmScoreLogs } = await import("@shared/schema-runtime");
    const conditions = [eq(pdmScoreLogs.orgId, orgId)];
    if (equipmentId) {
      conditions.push(eq(pdmScoreLogs.equipmentId, equipmentId));
    }
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
    if (equipmentId) {
      conditions.push(eq(failurePredictions.equipmentId, equipmentId));
    }
    return db
      .select()
      .from(failurePredictions)
      .where(and(...conditions))
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(equipmentId ? 5 : 200);
  }

  private async fetchInsights(orgId: string, equipmentId?: string) {
    const conditions = [eq(actionableInsights.orgId, orgId)];
    if (equipmentId) {
      conditions.push(eq(actionableInsights.equipmentId, equipmentId));
    }
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
    if (equipmentIds.length === 0) {
      return result;
    }

    try {
      const { pdmScoreLogs } = await import("@shared/schema-runtime");
      const rows = await db
        .select({
          equipmentId: pdmScoreLogs.equipmentId,
          healthIdx: pdmScoreLogs.healthIdx,
        })
        .from(pdmScoreLogs)
        .where(and(eq(pdmScoreLogs.orgId, orgId), inArray(pdmScoreLogs.equipmentId, equipmentIds)))
        .orderBy(pdmScoreLogs.ts)
        .limit(equipmentIds.length * 20);

      for (const row of rows) {
        const existing = result.get(row.equipmentId) || [];
        existing.push(Math.round(row.healthIdx ?? 0));
        result.set(row.equipmentId, existing);
      }

      for (const [key, values] of result.entries()) {
        result.set(key, values.slice(-9));
      }
    } catch (error) {
      logger.warn(
        "[EquipmentIntelligence] Failed to fetch telemetry summaries — sparklines will be empty",
        undefined,
        { error: String(error) }
      );
    }

    return result;
  }

}
