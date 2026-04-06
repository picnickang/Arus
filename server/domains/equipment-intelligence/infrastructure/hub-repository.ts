import { db } from "../../../db-config.js";
import { equipment, vessels, failurePredictions, actionableInsights } from "@shared/schema-runtime";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { logger } from "../../../utils/logger.js";
import type { EquipmentHubRepository } from "../domain/ports.js";
import type {
  EquipmentHubAggregate,
  ServiceOrderSummary,
  DiagnosticRunSummary,
  ActivityTimelineEvent,
  WorkOrderSummary,
  OperationalContext,
  NeedsActionItem,
} from "../domain/types.js";

function computeRisk(health: number): "critical" | "warning" | "low" {
  if (health < 40) return "critical";
  if (health < 70) return "warning";
  return "low";
}

function computeTrend(telemetry: number[]): "declining" | "stable" | "improving" {
  if (telemetry.length < 2) return "stable";
  const first = telemetry.slice(0, Math.ceil(telemetry.length / 2));
  const second = telemetry.slice(Math.ceil(telemetry.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const diff = avgSecond - avgFirst;
  if (diff < -3) return "declining";
  if (diff > 3) return "improving";
  return "stable";
}

function recommendedActionText(risk: string, rul: number): string {
  if (risk === "critical") return `Schedule immediate maintenance. Estimated window: ${rul} days. Create a work order and ensure spare parts are available.`;
  if (risk === "warning") return "Monitor closely. Plan maintenance for next scheduled port call. Check parts availability.";
  return "No action required. Continue normal operating schedule.";
}

function assessmentText(risk: string, health: number, rul: number, prediction: string): string {
  if (risk === "critical") {
    return `This equipment requires urgent attention. Health score is ${health}% with an estimated ${rul} days of remaining useful life. ${prediction}`;
  }
  if (risk === "warning") {
    return `This equipment shows early signs of degradation. Health score is ${health}% with ${rul} days of remaining useful life. Proactive maintenance is recommended to avoid unplanned downtime.`;
  }
  return `This equipment is operating normally. Health score is ${health}% with ${rul} days of remaining useful life. No immediate action is needed.`;
}

function parseSignalEntry(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry !== null && "description" in entry) {
    return String((entry as { description: unknown }).description);
  }
  return String(entry);
}

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

    if (!row) return null;

    const [pdmScores, predictions, insights, telemetryData, workOrders, serviceOrders, diagnosticRuns, activityTimeline] = await Promise.all([
      this.fetchPdmScores(orgId, equipmentId),
      this.fetchPredictions(orgId, equipmentId),
      this.fetchInsights(orgId, equipmentId),
      this.fetchTelemetry(orgId, equipmentId),
      this.fetchWorkOrders(orgId, equipmentId),
      this.getServiceOrdersForEquipment(orgId, equipmentId),
      this.getDiagnosticRuns(orgId, equipmentId),
      this.getActivityTimeline(orgId, equipmentId),
    ]);

    const healthScore = pdmScores[0]?.healthIdx ?? 100;
    const risk = computeRisk(healthScore);
    const pred = predictions[0];
    const telemetry = telemetryData.length > 0 ? telemetryData : [healthScore];
    const trend = computeTrend(telemetry);

    const signals: string[] = [];
    for (const ins of insights) {
      if (ins.supportingSignals) {
        try {
          const parsed: unknown[] = JSON.parse(ins.supportingSignals);
          if (Array.isArray(parsed)) signals.push(...parsed.map(parseSignalEntry));
        } catch {
          signals.push(ins.supportingSignals);
        }
      }
    }

    const rul = pred?.remainingUsefulLife ?? 365;
    const confidence = pred ? Math.round((pred.failureProbability ?? 0.85) * 100) : 85;
    const prediction = pred?.failureMode
      ? `${pred.failureMode} — ${risk === "critical" ? `replace within ${rul} days` : risk === "warning" ? "monitor closely" : "continue normal operations"}`
      : "Operating within normal parameters";

    const lastService = workOrders.find((wo) => wo.status === "completed")?.completedAt || null;
    const nextDue = workOrders.find((wo) => wo.status === "scheduled" || wo.status === "pending" || wo.status === "open")?.createdAt || null;

    const hasPdm = pdmScores.length > 0;
    const hasPred = predictions.length > 0;
    const dataAvailability: "full" | "partial" | "unavailable" =
      hasPdm && hasPred ? "full" : (hasPdm || hasPred) ? "partial" : "unavailable";

    const operationalContext = this.buildOperationalContext(row.vesselStatus);

    const needsAction = this.buildNeedsAction(risk, rul, workOrders, serviceOrders, equipmentId);

    return {
      id: row.eqId,
      name: row.eqName,
      vessel: row.vesselName || row.eqVesselName || "Unassigned",
      vesselId: row.eqVesselId || "unassigned",
      type: row.eqType || "General",
      health: Math.round(healthScore),
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
      assessment: assessmentText(risk, Math.round(healthScore), rul, prediction),
      recommendedAction: recommendedActionText(risk, rul),
      operationalContext,
      needsAction,
      workOrders,
      serviceOrders,
      diagnosticRuns,
      activityTimeline,
    };
  }

  async getServiceOrdersForEquipment(orgId: string, equipmentId: string): Promise<ServiceOrderSummary[]> {
    try {
      const { serviceOrders, workOrders, suppliers } = await import("@shared/schema-runtime");
      if (!serviceOrders) return [];
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
        eta: r.eta ? new Date(r.eta).toISOString().split("T")[0] : null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "",
      }));
    } catch (error) {
      logger.warn("[EquipmentHub] Failed to fetch service orders", { error: String(error) });
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
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "",
      }));
    } catch (error) {
      logger.warn("[EquipmentHub] Failed to fetch diagnostic runs", { error: String(error) });
      return [];
    }
  }

  async saveDiagnosticRun(orgId: string, equipmentId: string, analysisType: string, results: unknown, summary: string): Promise<DiagnosticRunSummary> {
    const { diagnosticRuns } = await import("@shared/schema-runtime");
    if (!diagnosticRuns) {
      return {
        id: `diag-${Date.now()}`,
        analysisType,
        status: "completed",
        summary,
        createdAt: new Date().toISOString().split("T")[0],
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

    return {
      id: row.id,
      analysisType: row.analysisType,
      status: row.status,
      summary: row.summary,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString().split("T")[0] : "",
    };
  }

  async getActivityTimeline(orgId: string, equipmentId: string): Promise<ActivityTimelineEvent[]> {
    const events: ActivityTimelineEvent[] = [];

    try {
      const { workOrders } = await import("@shared/schema-runtime");
      const woRows = await db
        .select({
          id: workOrders.id,
          description: workOrders.description,
          status: workOrders.status,
          createdAt: workOrders.createdAt,
        })
        .from(workOrders)
        .where(and(eq(workOrders.equipmentId, equipmentId), eq(workOrders.orgId, orgId)))
        .orderBy(desc(workOrders.createdAt))
        .limit(10);

      for (const wo of woRows) {
        events.push({
          id: `wo-${wo.id}`,
          type: "work_order",
          title: `Work Order: ${wo.description || "Maintenance task"}`,
          description: `Status: ${wo.status}`,
          timestamp: wo.createdAt ? new Date(wo.createdAt).toISOString() : new Date().toISOString(),
          severity: wo.status === "open" ? "warning" : "info",
        });
      }
    } catch { /* ignore */ }

    try {
      const predRows = await db
        .select()
        .from(failurePredictions)
        .where(and(eq(failurePredictions.equipmentId, equipmentId), eq(failurePredictions.orgId, orgId)))
        .orderBy(desc(failurePredictions.predictionTimestamp))
        .limit(5);

      for (const pred of predRows) {
        events.push({
          id: `pred-${pred.id}`,
          type: "prediction",
          title: `Prediction: ${pred.failureMode || "Failure analysis"}`,
          description: pred.remainingUsefulLife ? `RUL: ${pred.remainingUsefulLife} days` : null,
          timestamp: pred.predictionTimestamp ? new Date(pred.predictionTimestamp).toISOString() : new Date().toISOString(),
          severity: (pred.remainingUsefulLife ?? 365) < 14 ? "critical" : (pred.remainingUsefulLife ?? 365) < 30 ? "warning" : "info",
        });
      }
    } catch { /* ignore */ }

    try {
      const { diagnosticRuns } = await import("@shared/schema-runtime");
      if (diagnosticRuns) {
        const diagRows = await db
          .select({
            id: diagnosticRuns.id,
            analysisType: diagnosticRuns.analysisType,
            summary: diagnosticRuns.summary,
            createdAt: diagnosticRuns.createdAt,
          })
          .from(diagnosticRuns)
          .where(and(eq(diagnosticRuns.equipmentId, equipmentId), eq(diagnosticRuns.orgId, orgId)))
          .orderBy(desc(diagnosticRuns.createdAt))
          .limit(5);

        for (const diag of diagRows) {
          events.push({
            id: `diag-${diag.id}`,
            type: "diagnostic",
            title: `Diagnostic: ${diag.analysisType}`,
            description: diag.summary,
            timestamp: diag.createdAt ? new Date(diag.createdAt).toISOString() : new Date().toISOString(),
            severity: "info",
          });
        }
      }
    } catch { /* ignore */ }

    try {
      const { anomalyDetections } = await import("@shared/schema-runtime");
      if (anomalyDetections) {
        const anomalyRows = await db
          .select({
            id: anomalyDetections.id,
            sensorType: anomalyDetections.sensorType,
            anomalyType: anomalyDetections.anomalyType,
            severity: anomalyDetections.severity,
            detectedValue: anomalyDetections.detectedValue,
            expectedValue: anomalyDetections.expectedValue,
            detectionTimestamp: anomalyDetections.detectionTimestamp,
          })
          .from(anomalyDetections)
          .where(and(eq(anomalyDetections.equipmentId, equipmentId), eq(anomalyDetections.orgId, orgId)))
          .orderBy(desc(anomalyDetections.detectionTimestamp))
          .limit(5);

        for (const anomaly of anomalyRows) {
          const deviation = anomaly.detectedValue && anomaly.expectedValue
            ? `Detected: ${anomaly.detectedValue}, Expected: ${anomaly.expectedValue}`
            : null;
          events.push({
            id: `anomaly-${anomaly.id}`,
            type: "telemetry_anomaly",
            title: `Anomaly: ${anomaly.anomalyType || anomaly.sensorType}`,
            description: deviation,
            timestamp: anomaly.detectionTimestamp ? new Date(anomaly.detectionTimestamp).toISOString() : new Date().toISOString(),
            severity: anomaly.severity === "high" ? "critical" : anomaly.severity === "medium" ? "warning" : "info",
          });
        }
      }
    } catch { /* ignore */ }

    try {
      const { serviceOrders, workOrders: woTable } = await import("@shared/schema-runtime");
      if (serviceOrders && woTable) {
        const soRows = await db
          .select({
            id: serviceOrders.id,
            soNumber: serviceOrders.soNumber,
            status: serviceOrders.status,
            createdAt: serviceOrders.createdAt,
          })
          .from(serviceOrders)
          .innerJoin(woTable, eq(serviceOrders.workOrderId, woTable.id))
          .where(and(eq(woTable.equipmentId, equipmentId), eq(serviceOrders.orgId, orgId)))
          .orderBy(desc(serviceOrders.createdAt))
          .limit(5);

        for (const so of soRows) {
          events.push({
            id: `so-${so.id}`,
            type: "procurement",
            title: `Service Order: SO ${so.soNumber}`,
            description: `Status: ${so.status}`,
            timestamp: so.createdAt ? new Date(so.createdAt).toISOString() : new Date().toISOString(),
            severity: so.status === "draft" ? "info" : so.status === "sent" ? "warning" : "info",
          });
        }
      }
    } catch { /* ignore */ }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events.slice(0, 20);
  }

  private buildOperationalContext(vesselStatus: string | null): OperationalContext {
    // TODO: Integrate with vessel voyage/route service for nextPort + nextPortEta
    // TODO: Query inventory service for real parts availability per equipment
    // TODO: Derive maintenance window from crew scheduling + vessel route plan
    return {
      vesselStatus: vesselStatus || "Unknown",
      nextPort: null,
      nextPortEta: null,
      partsAvailability: "unknown",
      maintenanceWindow: null,
    };
  }

  private buildNeedsAction(
    risk: "critical" | "warning" | "low",
    rul: number,
    workOrders: WorkOrderSummary[],
    serviceOrders: ServiceOrderSummary[],
    equipmentId: string,
  ): NeedsActionItem[] {
    const items: NeedsActionItem[] = [];

    if (risk === "critical") {
      items.push({
        id: `na-risk-${equipmentId}`,
        type: "prediction",
        title: `Critical risk — ${rul} days RUL`,
        urgency: "high",
        link: `/equipment/${equipmentId}#assessment`,
      });
    } else if (risk === "warning") {
      items.push({
        id: `na-risk-${equipmentId}`,
        type: "prediction",
        title: `Warning — monitor health trend`,
        urgency: "medium",
        link: `/equipment/${equipmentId}#assessment`,
      });
    }

    const openWOs = workOrders.filter((wo) => wo.status === "open" || wo.status === "pending");
    if (openWOs.length > 0) {
      items.push({
        id: `na-wo-${equipmentId}`,
        type: "work_order",
        title: `${openWOs.length} open work order${openWOs.length > 1 ? "s" : ""}`,
        urgency: risk === "critical" ? "high" : "medium",
        link: `/work-orders?equipmentId=${equipmentId}`,
      });
    }

    const pendingSOs = serviceOrders.filter((so) => so.status === "draft" || so.status === "sent");
    if (pendingSOs.length > 0) {
      items.push({
        id: `na-so-${equipmentId}`,
        type: "parts",
        title: `${pendingSOs.length} pending service order${pendingSOs.length > 1 ? "s" : ""}`,
        urgency: "medium",
        link: `/service-orders`,
      });
    }

    if (items.length < 3) {
      const defaults: NeedsActionItem[] = [
        { id: `na-review-${equipmentId}`, type: "work_order", title: "Review maintenance history", urgency: "low", link: `/equipment/${equipmentId}#work-orders` },
        { id: `na-parts-${equipmentId}`, type: "parts", title: "Verify spare parts inventory", urgency: "low", link: `/inventory?equipmentId=${equipmentId}` },
        { id: `na-schedule-${equipmentId}`, type: "prediction", title: "Check next scheduled maintenance", urgency: "low", link: `/pdm-dashboard?equipmentId=${equipmentId}` },
      ];
      for (const d of defaults) {
        if (items.length >= 3) break;
        if (!items.some((i) => i.id === d.id)) items.push(d);
      }
    }

    return items.slice(0, 5);
  }

  private async fetchPdmScores(orgId: string, equipmentId: string) {
    try {
      const { pdmScoreLogs } = await import("@shared/schema-runtime");
      return db
        .select({
          equipmentId: pdmScoreLogs.equipmentId,
          healthIdx: pdmScoreLogs.healthIdx,
          ts: pdmScoreLogs.ts,
        })
        .from(pdmScoreLogs)
        .where(and(eq(pdmScoreLogs.orgId, orgId), eq(pdmScoreLogs.equipmentId, equipmentId)))
        .orderBy(desc(pdmScoreLogs.ts))
        .limit(20);
    } catch {
      return [];
    }
  }

  private async fetchPredictions(orgId: string, equipmentId: string) {
    return db
      .select()
      .from(failurePredictions)
      .where(and(eq(failurePredictions.orgId, orgId), eq(failurePredictions.equipmentId, equipmentId)))
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(5);
  }

  private async fetchInsights(orgId: string, equipmentId: string) {
    return db
      .select()
      .from(actionableInsights)
      .where(and(eq(actionableInsights.orgId, orgId), eq(actionableInsights.equipmentId, equipmentId)))
      .orderBy(desc(actionableInsights.createdAt))
      .limit(10);
  }

  private async fetchTelemetry(orgId: string, equipmentId: string): Promise<number[]> {
    try {
      const { pdmScoreLogs } = await import("@shared/schema-runtime");
      const rows = await db
        .select({ healthIdx: pdmScoreLogs.healthIdx })
        .from(pdmScoreLogs)
        .where(and(eq(pdmScoreLogs.orgId, orgId), eq(pdmScoreLogs.equipmentId, equipmentId)))
        .orderBy(pdmScoreLogs.ts)
        .limit(20);
      return rows.map((r) => Math.round(r.healthIdx)).slice(-9);
    } catch {
      return [];
    }
  }

  private async fetchWorkOrders(orgId: string, equipmentId: string): Promise<WorkOrderSummary[]> {
    try {
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
    } catch {
      return [];
    }
  }
}
