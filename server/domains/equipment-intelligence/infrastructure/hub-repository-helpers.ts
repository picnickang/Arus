import { db } from "../../../db-config.js";
import { actionableInsights, failurePredictions } from "@shared/schema-runtime";
import { and, desc, eq } from "drizzle-orm";
import type {
  ActiveAnomaly,
  NeedsActionItem,
  OperationalContext,
  ServiceOrderSummary,
  WorkOrderSummary,
} from "../domain/types.js";

export function computeRisk(health: number): "critical" | "warning" | "low" {
  if (health < 40) {
    return "critical";
  }
  if (health < 70) {
    return "warning";
  }
  return "low";
}

export function computeTrend(telemetry: number[]): "declining" | "stable" | "improving" {
  if (telemetry.length < 2) {
    return "stable";
  }
  const first = telemetry.slice(0, Math.ceil(telemetry.length / 2));
  const second = telemetry.slice(Math.ceil(telemetry.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
  const diff = avgSecond - avgFirst;
  if (diff < -3) {
    return "declining";
  }
  if (diff > 3) {
    return "improving";
  }
  return "stable";
}

export function recommendedActionText(risk: string, rul: number): string {
  if (risk === "critical") {
    return `Schedule immediate maintenance. Estimated window: ${rul} days. Create a work order and ensure spare parts are available.`;
  }
  if (risk === "warning") {
    return "Monitor closely. Plan maintenance for next scheduled port call. Check parts availability.";
  }
  return "No action required. Continue normal operating schedule.";
}

export function assessmentText(
  risk: string,
  health: number,
  rul: number,
  prediction: string
): string {
  if (risk === "critical") {
    return `This equipment requires urgent attention. Health score is ${health}% with an estimated ${rul} days of remaining useful life. ${prediction}`;
  }
  if (risk === "warning") {
    return `This equipment shows early signs of degradation. Health score is ${health}% with ${rul} days of remaining useful life. Proactive maintenance is recommended to avoid unplanned downtime.`;
  }
  return `This equipment is operating normally. Health score is ${health}% with ${rul} days of remaining useful life. No immediate action is needed.`;
}

export function collectInsightSignals(insights: Array<{ supportingSignals?: unknown }>): string[] {
  const signals: string[] = [];
  for (const ins of insights) {
    const raw = ins.supportingSignals;
    if (raw == null) {
      continue;
    }
    if (typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          signals.push(...parsed.map(parseSignalEntry).filter((s) => typeof s === "string"));
        } else {
          signals.push(raw);
        }
      } catch {
        signals.push(raw);
      }
    } else if (Array.isArray(raw)) {
      signals.push(...raw.map(parseSignalEntry).filter((s) => typeof s === "string"));
    } else {
      signals.push(parseSignalEntry(raw));
    }
  }
  return signals;
}

export function mapAnomalyRow(row: {
  id: number;
  anomalyType: string | null;
  sensorType: string;
  severity: string;
  detectionTimestamp: Date | string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | string | null;
}): ActiveAnomaly {
  return {
    id: row.id,
    anomalyType: row.anomalyType,
    sensorType: row.sensorType,
    severity: row.severity,
    detectedAt: row.detectionTimestamp
      ? new Date(row.detectionTimestamp).toISOString()
      : new Date().toISOString(),
    acknowledged: row.acknowledgedAt != null,
    acknowledgedBy: row.acknowledgedBy,
    acknowledgedAt: row.acknowledgedAt ? new Date(row.acknowledgedAt).toISOString() : null,
  };
}

export function buildOperationalContext(vesselStatus: string | null): OperationalContext {
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

export function buildNeedsAction(
  risk: "critical" | "warning" | "low",
  rul: number,
  workOrders: WorkOrderSummary[],
  serviceOrders: ServiceOrderSummary[],
  equipmentId: string
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
      {
        id: `na-review-${equipmentId}`,
        type: "work_order",
        title: "Review maintenance history",
        urgency: "low",
        link: `/equipment/${equipmentId}#work-orders`,
      },
      {
        id: `na-parts-${equipmentId}`,
        type: "parts",
        title: "Verify spare parts inventory",
        urgency: "low",
        link: `/inventory?equipmentId=${equipmentId}`,
      },
      {
        id: `na-schedule-${equipmentId}`,
        type: "prediction",
        title: "Check next scheduled maintenance",
        urgency: "low",
        link: `/pdm-dashboard?equipmentId=${equipmentId}`,
      },
    ];
    for (const d of defaults) {
      if (items.length >= 3) {
        break;
      }
      if (!items.some((i) => i.id === d.id)) {
        items.push(d);
      }
    }
  }

  return items.slice(0, 5);
}

export async function fetchPdmScores(orgId: string, equipmentId: string) {
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

export async function fetchPredictions(orgId: string, equipmentId: string) {
  return db
    .select()
    .from(failurePredictions)
    .where(
      and(eq(failurePredictions.orgId, orgId), eq(failurePredictions.equipmentId, equipmentId))
    )
    .orderBy(desc(failurePredictions.predictionTimestamp))
    .limit(5);
}

export async function fetchInsights(orgId: string, equipmentId: string) {
  return db
    .select()
    .from(actionableInsights)
    .where(
      and(eq(actionableInsights.orgId, orgId), eq(actionableInsights.equipmentId, equipmentId))
    )
    .orderBy(desc(actionableInsights.createdAt))
    .limit(10);
}

export async function fetchTelemetry(orgId: string, equipmentId: string): Promise<number[]> {
  try {
    const { pdmScoreLogs } = await import("@shared/schema-runtime");
    const rows = await db
      .select({ healthIdx: pdmScoreLogs.healthIdx })
      .from(pdmScoreLogs)
      .where(and(eq(pdmScoreLogs.orgId, orgId), eq(pdmScoreLogs.equipmentId, equipmentId)))
      .orderBy(pdmScoreLogs.ts)
      .limit(20);
    return rows.map((r) => Math.round(r.healthIdx ?? 0)).slice(-9);
  } catch {
    return [];
  }
}

export async function fetchWorkOrders(
  orgId: string,
  equipmentId: string
): Promise<WorkOrderSummary[]> {
  try {
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

    return rows.map((r) => ({
      id: r.id,
      title: r.description || "Work Order",
      status: r.status,
      createdAt: r.createdAt ? (new Date(r.createdAt).toISOString().split("T")[0] ?? "") : "",
      completedAt: r.completedAt
        ? (new Date(r.completedAt).toISOString().split("T")[0] ?? null)
        : null,
      assignedCrewId: r.assignedCrewId ?? null,
      assignmentStatus: r.assignmentStatus ?? null,
      assignmentResponseReason: r.assignmentResponseReason ?? null,
      assignmentRespondedAt: r.assignmentRespondedAt
        ? new Date(r.assignmentRespondedAt).toISOString()
        : null,
    }));
  } catch {
    return [];
  }
}

function parseSignalEntry(entry: unknown): string {
  if (typeof entry === "string") {
    return entry;
  }
  if (typeof entry === "object" && entry !== null && "description" in entry) {
    return String((entry as { description: unknown }).description);
  }
  return String(entry);
}
