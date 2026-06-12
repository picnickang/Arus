import type { WorkOrderSummary } from "../domain/types.js";

export type EquipmentIntelligenceRisk = "critical" | "warning" | "low";

export function computeRisk(health: number): EquipmentIntelligenceRisk {
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

export function statusFromRisk(risk: EquipmentIntelligenceRisk): string {
  if (risk === "critical") {
    return "critical";
  }
  if (risk === "warning") {
    return "warning";
  }
  return "operational";
}

interface SignalObject {
  description?: string;
}

function isSignalObject(value: unknown): value is SignalObject {
  return typeof value === "object" && value !== null && "description" in value;
}

export function parseSignalEntry(entry: unknown): string {
  if (typeof entry === "string") {
    return entry;
  }
  if (isSignalObject(entry) && typeof entry.description === "string") {
    return entry.description;
  }
  return String(entry);
}

export function recommendedActionText(risk: string, rul: number): string {
  if (risk === "critical") {
    return `replace within ${rul} days`;
  }
  if (risk === "warning") {
    return "monitor closely";
  }
  return "continue normal operations";
}

export function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    return "today";
  }
  if (days === 1) {
    return "1 day ago";
  }
  return `${days} days ago`;
}

export interface WorkOrderSummaryRow {
  id: string;
  description: string | null;
  status: string;
  createdAt: Date | string | null;
  completedAt: Date | string | null;
  assignedCrewId: string | null;
  assignmentStatus: string | null;
  assignmentResponseReason: string | null;
  assignmentRespondedAt: Date | string | null;
}

export function mapWorkOrderSummaryRow(row: WorkOrderSummaryRow): WorkOrderSummary {
  return {
    id: row.id,
    title: row.description || "Work Order",
    status: row.status,
    createdAt: row.createdAt ? (new Date(row.createdAt).toISOString().split("T")[0] ?? "") : "",
    completedAt: row.completedAt
      ? (new Date(row.completedAt).toISOString().split("T")[0] ?? null)
      : null,
    assignedCrewId: row.assignedCrewId ?? null,
    assignmentStatus: row.assignmentStatus ?? null,
    assignmentResponseReason: row.assignmentResponseReason ?? null,
    assignmentRespondedAt: row.assignmentRespondedAt
      ? new Date(row.assignmentRespondedAt).toISOString()
      : null,
  };
}
