import type {
  AttentionSourceHealth,
  BlockerResolutionRecord,
  BlockerResolutionSummary,
  IssueReportRecord,
  RecordLike,
  SafeCallResult,
  WorkflowQueueId,
  WorkflowSeverity,
} from "./attention-types.js";

export function latestBy<T>(items: T[], dateGetter: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(dateGetter(a) || 0).getTime();
    const bTime = new Date(dateGetter(b) || 0).getTime();
    return bTime - aTime;
  });
}

export function isRecord(value: unknown): value is RecordLike {
  return value !== null && typeof value === "object";
}

export async function safeCall<T>(
  label: string,
  fn: () => Promise<T>
): Promise<SafeCallResult<T>> {
  try {
    return { data: await fn(), status: "ok" };
  } catch (error) {
    // Attention aggregation should never block the operator's home screen.
    // The source-health metadata lets the UI show partial data rather than silently undercounting.
    return {
      data: null,
      status: "failed",
      error: error instanceof Error ? error.message : `${label} unavailable`,
    };
  }
}

export function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function cleanString(value: unknown, fallback = ""): string {
  return asString(value)?.trim() || fallback;
}

export function asDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isClosedStatus(status: unknown): boolean {
  const normalized = String(status ?? "")
    .toLowerCase()
    .replace(/[_-]/g, " ");
  return (
    normalized.includes("complete") ||
    normalized.includes("closed") ||
    normalized.includes("cancel")
  );
}

export function isOpenStatus(status: unknown): boolean {
  return !isClosedStatus(status);
}

export function isReadyToClose(status: unknown): boolean {
  const normalized = String(status ?? "")
    .toLowerCase()
    .replace(/[_-]/g, " ");
  return (
    normalized.includes("ready") || normalized.includes("verify") || normalized.includes("review")
  );
}

export function isDueToday(dueDate: unknown, now = new Date()): boolean {
  const due = asDate(dueDate);
  if (!due) {
    return false;
  }
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function isOverdue(dueDate: unknown, status: unknown, now = new Date()): boolean {
  const due = asDate(dueDate);
  if (!due || isClosedStatus(status)) {
    return false;
  }
  return due.getTime() < now.getTime() && !isDueToday(due, now);
}

export function severityForPriority(priority: unknown): WorkflowSeverity {
  const normalized = String(priority ?? "").toLowerCase();
  if (
    priority === 1 ||
    normalized === "1" ||
    normalized === "critical" ||
    normalized === "urgent"
  ) {
    return "critical";
  }
  if (priority === 2 || normalized === "2" || normalized === "high") {
    return "warning";
  }
  return "info";
}

export function dateLabel(value: unknown): string {
  const date = asDate(value);
  if (!date) {
    return "No due date";
  }
  return date.toISOString().slice(0, 10);
}

export function getEquipmentName(workOrder: RecordLike): string {
  const direct = asString(workOrder["equipmentName"]) || asString(workOrder["equipmentId"]);
  const equipment = workOrder["equipment"];
  if (direct) {
    return direct;
  }
  if (isRecord(equipment)) {
    return asString(equipment["name"]) || "Unassigned equipment";
  }
  return "Unassigned equipment";
}

export function workOrderTitle(workOrder: RecordLike): string {
  return (
    asString(workOrder["title"]) ||
    asString(workOrder["description"]) ||
    `Work order ${asString(workOrder["id"]) ?? "unknown"}`
  );
}

export function isPartsBlocker(reason: string | null | undefined): boolean {
  const normalized = reason?.toLowerCase() ?? "";
  return (
    normalized.includes("part") || normalized.includes("stock") || normalized.includes("inventory")
  );
}

export function blockerQueue(reason: string | null): WorkflowQueueId {
  return isPartsBlocker(reason) ? "waiting_parts" : "blocked";
}

export function sourceHealth(results: {
  workOrders: SafeCallResult<unknown>;
  alerts: SafeCallResult<unknown>;
  equipment: SafeCallResult<unknown>;
  inventory: SafeCallResult<unknown>;
}): AttentionSourceHealth {
  const errors: Record<string, string> = {};
  for (const [key, result] of Object.entries(results)) {
    if (result.error) {
      errors[key] = result.error;
    }
  }
  return {
    workOrders: results.workOrders.status,
    alerts: results.alerts.status,
    equipment: results.equipment.status,
    inventory: results.inventory.status,
    ...(Object.keys(errors).length ? { errors } : {}),
  };
}

export function resolutionSummary(
  record: BlockerResolutionRecord | undefined
): BlockerResolutionSummary | null {
  if (!record) {
    return null;
  }
  return {
    status: record.status,
    owner: record.owner,
    eta: record.eta,
    note: record.note,
    savedAt: record.savedAt,
  };
}

export function issueHref(target: IssueReportRecord["target"], issueId: string): string {
  if (target === "work_order") {
    return `/work-orders?action=create&flow=report-issue&issueId=${encodeURIComponent(issueId)}`;
  }
  if (target === "finding") {
    return `/findings?action=create&flow=report-issue&issueId=${encodeURIComponent(issueId)}`;
  }
  if (target === "log_note") {
    return `/logs/deck?flow=report-issue&issueId=${encodeURIComponent(issueId)}`;
  }
  return `/attention-inbox?view=handover&issueId=${encodeURIComponent(issueId)}`;
}
