import { db } from "../../../db-config.js";
import { equipment, vessels } from "@shared/schema-runtime";
import { eq, and, desc, isNull } from "drizzle-orm";
import { logger } from "../../../utils/logger.js";
import type { EquipmentHubRepository } from "../domain/ports.js";
import { deriveHubHealthFields } from "../domain/hub-health.js";
import type {
  EquipmentHubAggregate,
  ServiceOrderSummary,
  DiagnosticRunSummary,
  ActivityTimelineEvent,
  WorkOrderSummary,
  ActiveAnomaly,
} from "../domain/types.js";
import {
  assessmentText,
  buildNeedsAction,
  buildOperationalContext,
  collectInsightSignals,
  computeRisk,
  computeTrend,
  fetchInsights,
  fetchPdmScores,
  fetchPredictions,
  fetchTelemetry,
  fetchWorkOrders,
  mapAnomalyRow,
  recommendedActionText,
} from "./hub-repository-helpers.js";
import { getActivityTimelineForEquipment } from "./hub-repository-timeline.js";

export class PostgresEquipmentHubRepository implements EquipmentHubRepository {
  async getHubAggregate(orgId: string, equipmentId: string): Promise<EquipmentHubAggregate | null> {
    const [row] = await db
      .select({
        eqId: equipment.id,
        eqName: equipment.name,
        eqType: equipment.type,
        eqVesselId: equipment.vesselId,
        eqVesselName: equipment.vesselName,
        eqOrgId: equipment.orgId,
        vesselName: vessels.name,
        vesselStatus: vessels.onlineStatus,
      })
      .from(equipment)
      .leftJoin(vessels, eq(equipment.vesselId, vessels.id))
      .where(and(eq(equipment.orgId, orgId), eq(equipment.id, equipmentId)));

    if (!row) {
      return null;
    }

    const [
      pdmScores,
      predictions,
      insights,
      telemetryData,
      workOrders,
      serviceOrders,
      diagnosticRuns,
      activityTimeline,
      activeAnomaly,
    ] = await Promise.all([
      fetchPdmScores(orgId, equipmentId),
      fetchPredictions(orgId, equipmentId),
      fetchInsights(orgId, equipmentId),
      fetchTelemetry(orgId, equipmentId),
      fetchWorkOrders(orgId, equipmentId),
      this.getServiceOrdersForEquipment(orgId, equipmentId),
      this.getDiagnosticRuns(orgId, equipmentId),
      this.getActivityTimeline(orgId, equipmentId),
      this.getActiveAnomaly(orgId, equipmentId),
    ]);

    const pred = predictions[0];
    const {
      health: healthScore,
      rul,
      confidence,
    } = deriveHubHealthFields(pdmScores[0]?.healthIdx ?? null, pred ?? null);
    const risk = computeRisk(healthScore ?? 100);
    const telemetry =
      telemetryData.length > 0 ? telemetryData : healthScore == null ? [] : [healthScore];
    const trend = computeTrend(telemetry);

    const signals = collectInsightSignals(insights);

    const prediction = pred?.failureMode
      ? `${pred.failureMode} — ${risk === "critical" ? `replace within ${rul ?? "—"} days` : risk === "warning" ? "monitor closely" : "continue normal operations"}`
      : healthScore == null
        ? "No PdM score recorded yet"
        : "Operating within normal parameters";

    const completedWO = workOrders.find((wo) => wo.status === "completed") as
      | (WorkOrderSummary & { actualEndDate?: string | Date | null })
      | undefined;
    const rawLastService = completedWO?.actualEndDate ?? completedWO?.completedAt ?? null;
    const lastService: string | null =
      rawLastService == null
        ? null
        : rawLastService instanceof Date
          ? rawLastService.toISOString()
          : String(rawLastService);
    const nextDue =
      workOrders.find(
        (wo) => wo.status === "scheduled" || wo.status === "pending" || wo.status === "open"
      )?.createdAt || null;

    const hasPdm = pdmScores.length > 0;
    const hasPred = predictions.length > 0;
    const dataAvailability: "full" | "partial" | "unavailable" =
      hasPdm && hasPred ? "full" : hasPdm || hasPred ? "partial" : "unavailable";

    const operationalContext = buildOperationalContext(row.vesselStatus);

    const needsAction = buildNeedsAction(risk, rul ?? 365, workOrders, serviceOrders, equipmentId);

    return {
      id: row.eqId,
      name: row.eqName,
      vessel: row.vesselName || row.eqVesselName || "Unassigned",
      vesselId: row.eqVesselId || "unassigned",
      type: row.eqType || "General",
      health: healthScore == null ? null : Math.round(healthScore),
      rul,
      risk,
      confidence,
      prediction,
      trend,
      signals: signals.slice(0, 10),
      telemetry,
      lastService,
      nextDue,
      dataAvailability,
      assessment:
        healthScore == null
          ? "No live health score for this equipment yet — PdM scoring has not run. Work orders, service history and diagnostics below are real records; health, risk and remaining-life figures will populate once scoring produces data."
          : assessmentText(risk, Math.round(healthScore), rul ?? 365, prediction),
      recommendedAction:
        healthScore == null
          ? "Verify telemetry/sensor mapping for this equipment so PdM scoring can run, or trigger a diagnostic from the Diagnostics section."
          : recommendedActionText(risk, rul ?? 365),
      operationalContext,
      needsAction,
      activeAnomaly,
      workOrders,
      serviceOrders,
      diagnosticRuns,
      activityTimeline,
    };
  }

  async getActiveAnomaly(orgId: string, equipmentId: string): Promise<ActiveAnomaly | null> {
    try {
      const { anomalyDetections } = await import("@shared/schema-runtime");
      if (!anomalyDetections) {
        return null;
      }
      const [row] = await db
        .select({
          id: anomalyDetections.id,
          anomalyType: anomalyDetections.anomalyType,
          sensorType: anomalyDetections.sensorType,
          severity: anomalyDetections.severity,
          detectionTimestamp: anomalyDetections.detectionTimestamp,
          acknowledgedBy: anomalyDetections.acknowledgedBy,
          acknowledgedAt: anomalyDetections.acknowledgedAt,
        })
        .from(anomalyDetections)
        .where(
          and(eq(anomalyDetections.equipmentId, equipmentId), eq(anomalyDetections.orgId, orgId))
        )
        .orderBy(desc(anomalyDetections.detectionTimestamp))
        .limit(1);
      if (!row) {
        return null;
      }
      return mapAnomalyRow(row);
    } catch (error) {
      logger.warn("[EquipmentHub]", "Failed to fetch active anomaly", { error: String(error) });
      return null;
    }
  }

  async acknowledgeAnomaly(
    orgId: string,
    equipmentId: string,
    acknowledgedBy: string
  ): Promise<ActiveAnomaly | null> {
    const { anomalyDetections } = await import("@shared/schema-runtime");
    if (!anomalyDetections) {
      return null;
    }
    const [target] = await db
      .select({ id: anomalyDetections.id })
      .from(anomalyDetections)
      .where(
        and(
          eq(anomalyDetections.equipmentId, equipmentId),
          eq(anomalyDetections.orgId, orgId),
          isNull(anomalyDetections.acknowledgedAt)
        )
      )
      .orderBy(desc(anomalyDetections.detectionTimestamp))
      .limit(1);
    if (!target) {
      return null;
    }
    const [updated] = await db
      .update(anomalyDetections)
      .set({ acknowledgedBy, acknowledgedAt: new Date() })
      .where(and(eq(anomalyDetections.id, target.id), eq(anomalyDetections.orgId, orgId)))
      .returning({
        id: anomalyDetections.id,
        anomalyType: anomalyDetections.anomalyType,
        sensorType: anomalyDetections.sensorType,
        severity: anomalyDetections.severity,
        detectionTimestamp: anomalyDetections.detectionTimestamp,
        acknowledgedBy: anomalyDetections.acknowledgedBy,
        acknowledgedAt: anomalyDetections.acknowledgedAt,
      });
    if (!updated) {
      return null;
    }
    return mapAnomalyRow(updated);
  }

  async getServiceOrdersForEquipment(
    orgId: string,
    equipmentId: string
  ): Promise<ServiceOrderSummary[]> {
    try {
      const { serviceOrders, workOrders, suppliers } = await import("@shared/schema-runtime");
      if (!serviceOrders) {
        return [];
      }
      const rows = await db
        .select({
          soId: serviceOrders.id,
          soNumber: serviceOrders.soNumber,
          status: serviceOrders.status,
          vendorName: suppliers.name,
          eta: serviceOrders.scheduledEndDate,
          createdAt: serviceOrders.createdAt,
          woEquipmentId: workOrders.equipmentId,
        })
        .from(serviceOrders)
        .innerJoin(workOrders, eq(serviceOrders.workOrderId, workOrders.id))
        .leftJoin(suppliers, eq(serviceOrders.serviceProviderId, suppliers.id))
        .where(and(eq(workOrders.equipmentId, equipmentId), eq(serviceOrders.orgId, orgId)))
        .orderBy(desc(serviceOrders.createdAt))
        .limit(10);

      return rows.map((r) => ({
        id: r.soId,
        title: `SO ${r.soNumber}`,
        status: r.status,
        vendorName: r.vendorName,
        eta: r.eta ? (new Date(r.eta).toISOString().split("T")[0] ?? null) : null,
        createdAt: r.createdAt ? (new Date(r.createdAt).toISOString().split("T")[0] ?? "") : "",
      }));
    } catch (error) {
      logger.warn("[EquipmentHub]", "Failed to fetch service orders", { error: String(error) });
      return [];
    }
  }

  async getDiagnosticRuns(orgId: string, equipmentId: string): Promise<DiagnosticRunSummary[]> {
    try {
      const { diagnosticRuns } = await import("@shared/schema-runtime");
      const rows = await db
        .select({
          id: diagnosticRuns.id,
          analysisType: diagnosticRuns.analysisType,
          status: diagnosticRuns.status,
          summary: diagnosticRuns.summary,
          createdAt: diagnosticRuns.createdAt,
        })
        .from(diagnosticRuns)
        .where(and(eq(diagnosticRuns.equipmentId, equipmentId), eq(diagnosticRuns.orgId, orgId)))
        .orderBy(desc(diagnosticRuns.createdAt))
        .limit(10);

      return rows.map((r) => ({
        id: r.id,
        analysisType: r.analysisType,
        status: r.status,
        summary: r.summary,
        createdAt: r.createdAt ? (new Date(r.createdAt).toISOString().split("T")[0] ?? "") : "",
      }));
    } catch (error) {
      logger.warn("[EquipmentHub]", "Failed to fetch diagnostic runs", { error: String(error) });
      return [];
    }
  }

  async saveDiagnosticRun(
    orgId: string,
    equipmentId: string,
    analysisType: string,
    results: unknown,
    summary: string
  ): Promise<DiagnosticRunSummary> {
    const { diagnosticRuns } = await import("@shared/schema-runtime");
    if (!diagnosticRuns) {
      return {
        id: `diag-${Date.now()}`,
        analysisType,
        status: "completed",
        summary,
        createdAt: new Date().toISOString().split("T")[0] ?? "",
      };
    }
    const [row] = await db
      .insert(diagnosticRuns)
      .values({
        orgId,
        equipmentId,
        analysisType,
        results,
        summary,
        status: "completed",
      })
      .returning({
        id: diagnosticRuns.id,
        analysisType: diagnosticRuns.analysisType,
        status: diagnosticRuns.status,
        summary: diagnosticRuns.summary,
        createdAt: diagnosticRuns.createdAt,
      });
    if (!row) {
      throw new Error("saveDiagnosticRun: no row returned");
    }

    return {
      id: row.id,
      analysisType: row.analysisType,
      status: row.status,
      summary: row.summary,
      createdAt: row.createdAt ? (new Date(row.createdAt).toISOString().split("T")[0] ?? "") : "",
    };
  }

  async getActivityTimeline(orgId: string, equipmentId: string): Promise<ActivityTimelineEvent[]> {
    return getActivityTimelineForEquipment(orgId, equipmentId);
  }
}
