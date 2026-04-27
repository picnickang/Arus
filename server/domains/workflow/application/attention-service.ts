import { randomUUID } from "node:crypto";
import { dbAlertStorage } from "../../../db/alerts/index.js";
import { dbEquipmentStorage } from "../../../db/equipment/index.js";
import { dbInventoryStorage } from "../../../db/inventory/index.js";
import { dbWorkOrderStorage } from "../../../db/workorders/index.js";

export type WorkflowSeverity = "critical" | "warning" | "info" | "success";
export type WorkflowQueueId =
  | "needs_review"
  | "open_work"
  | "due_today"
  | "blocked"
  | "waiting_parts"
  | "ready_to_close"
  | "completed"
  | "overdue";
export type AttentionSourceType =
  | "work_order"
  | "alert"
  | "equipment"
  | "inventory"
  | "handover"
  | "system";

export interface AttentionWorkflowItem {
  id: string;
  type: AttentionSourceType;
  sourceId?: string;
  title: string;
  source: string;
  whyItMatters: string;
  recommendedAction: string;
  owner: string;
  due: string;
  href: string;
  severity: WorkflowSeverity;
  queue: WorkflowQueueId;
  status?: string | null;
  blockerReason?: string | null;
}

export interface AttentionWorkflowQueue {
  id: WorkflowQueueId;
  label: string;
  description: string;
  count: number;
  href: string;
  severity: WorkflowSeverity;
}

export interface AttentionHandoverSummary {
  openAttentionItems: number;
  criticalItems: number;
  blockedJobs: number;
  readyForCloseout: number;
  openWorkOrders: number;
  lowStockParts: number;
  suggestedSummary: string[];
}

export interface AttentionWorkflowResponse {
  generatedAt: string;
  items: AttentionWorkflowItem[];
  queues: AttentionWorkflowQueue[];
  handover: AttentionHandoverSummary;
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return value !== null && typeof value === "object";
}

async function safeCall<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    // Attention aggregation should never block the operator's home screen.
    // Route-level logging captures the request; this keeps one weak domain from breaking all queues.
    return null;
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isClosedStatus(status: unknown): boolean {
  const normalized = String(status ?? "").toLowerCase().replace(/[_-]/g, " ");
  return normalized.includes("complete") || normalized.includes("closed") || normalized.includes("cancel");
}

function isOpenStatus(status: unknown): boolean {
  return !isClosedStatus(status);
}

function isReadyToClose(status: unknown): boolean {
  const normalized = String(status ?? "").toLowerCase().replace(/[_-]/g, " ");
  return normalized.includes("ready") || normalized.includes("verify") || normalized.includes("review");
}

function isDueToday(dueDate: unknown, now = new Date()): boolean {
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

function isOverdue(dueDate: unknown, status: unknown, now = new Date()): boolean {
  const due = asDate(dueDate);
  if (!due || isClosedStatus(status)) {
    return false;
  }
  return due.getTime() < now.getTime() && !isDueToday(due, now);
}

function severityForPriority(priority: unknown): WorkflowSeverity {
  const normalized = String(priority ?? "").toLowerCase();
  if (priority === 1 || normalized === "1" || normalized === "critical" || normalized === "urgent") {
    return "critical";
  }
  if (priority === 2 || normalized === "2" || normalized === "high") {
    return "warning";
  }
  return "info";
}

function dateLabel(value: unknown): string {
  const date = asDate(value);
  if (!date) {
    return "No due date";
  }
  return date.toISOString().slice(0, 10);
}

function getEquipmentName(workOrder: RecordLike): string {
  const direct = asString(workOrder.equipmentName) || asString(workOrder.equipmentId);
  const equipment = workOrder.equipment;
  if (direct) {
    return direct;
  }
  if (isRecord(equipment)) {
    return asString(equipment.name) || "Unassigned equipment";
  }
  return "Unassigned equipment";
}

function workOrderTitle(workOrder: RecordLike): string {
  return asString(workOrder.title) || asString(workOrder.description) || `Work order ${asString(workOrder.id) ?? "unknown"}`;
}

function blockerQueue(reason: string | null): WorkflowQueueId {
  return reason?.toLowerCase().includes("part") ? "waiting_parts" : "blocked";
}

export class AttentionWorkflowService {
  async getWorkflow(orgId: string): Promise<AttentionWorkflowResponse> {
    const [alertData, workOrderData, equipmentData, lowStockData] = await Promise.all([
      safeCall("alerts", () => dbAlertStorage.getAlertNotifications(false, orgId)),
      safeCall("work-orders", () => dbWorkOrderStorage.getWorkOrders(undefined, orgId)),
      safeCall("equipment", () => dbEquipmentStorage.getEquipmentRegistry(orgId)),
      safeCall("low-stock", () => dbInventoryStorage.getLowStockParts(orgId)),
    ]);

    const alerts = Array.isArray(alertData) ? alertData.filter(isRecord) : [];
    const workOrders = Array.isArray(workOrderData) ? workOrderData.filter(isRecord) : [];
    const equipment = Array.isArray(equipmentData) ? equipmentData.filter(isRecord) : [];
    const lowStock = Array.isArray(lowStockData) ? lowStockData.filter(isRecord) : [];
    const now = new Date();

    const openWorkOrders = workOrders.filter((wo) => isOpenStatus(wo.status));
    const completedWorkOrders = workOrders.filter((wo) => isClosedStatus(wo.status));
    const blockedWorkOrders = openWorkOrders.filter((wo) => Boolean(asString(wo.blockedReason)));
    const waitingParts = blockedWorkOrders.filter((wo) => asString(wo.blockedReason)?.toLowerCase().includes("part"));
    const dueToday = openWorkOrders.filter((wo) => isDueToday(wo.dueDate, now));
    const overdue = openWorkOrders.filter((wo) => isOverdue(wo.dueDate, wo.status, now));
    const readyToClose = openWorkOrders.filter((wo) => isReadyToClose(wo.status));
    const highRiskEquipment = equipment.filter((eq) => {
      const risk = String(eq.riskLevel ?? eq.risk ?? "").toLowerCase();
      return risk === "high" || risk === "critical";
    });

    const items: AttentionWorkflowItem[] = [];

    if (alerts.length > 0) {
      items.push({
        id: "alerts-unacknowledged",
        type: "alert",
        title: `${alerts.length} unacknowledged alert${alerts.length === 1 ? "" : "s"}`,
        source: "Operations alerts",
        whyItMatters: "Unacknowledged alerts can hide operational changes from the next watch.",
        recommendedAction: "Acknowledge, assign, or convert confirmed alerts into findings.",
        owner: "Watch Officer",
        due: "Before handover",
        href: "/dashboard?tab=alerts",
        severity: alerts.length > 3 ? "critical" : "warning",
        queue: "needs_review",
        status: "needs_review",
      });
    }

    highRiskEquipment.slice(0, 6).forEach((eq) => {
      const id = asString(eq.id) ?? asString(eq.equipmentId) ?? asString(eq.name) ?? randomUUID();
      const risk = String(eq.riskLevel ?? eq.risk ?? "high").toLowerCase();
      items.push({
        id: `equipment-risk-${id}`,
        type: "equipment",
        sourceId: id,
        title: `${asString(eq.name) ?? "Equipment"} risk is ${risk}`,
        source: "Equipment intelligence",
        whyItMatters: "High-risk equipment should be converted into an inspection, maintenance, or deferment decision.",
        recommendedAction: "Review evidence and create an inspection work order where needed.",
        owner: "Chief Engineer",
        due: risk === "critical" ? "Now" : "Within 24 hours",
        href: `/equipment-intelligence?equipmentId=${encodeURIComponent(id)}`,
        severity: risk === "critical" ? "critical" : "warning",
        queue: "needs_review",
        status: risk,
      });
    });

    overdue.slice(0, 8).forEach((wo) => {
      const id = asString(wo.id) ?? randomUUID();
      items.push({
        id: `wo-overdue-${id}`,
        type: "work_order",
        sourceId: id,
        title: workOrderTitle(wo),
        source: getEquipmentName(wo),
        whyItMatters: "This work is overdue and may create safety, reliability, or audit exposure.",
        recommendedAction: "Escalate, assign an owner, complete, or defer with a reason.",
        owner: asString(wo.assignedToName) || asString(wo.assignedCrewId) || "Chief Engineer",
        due: dateLabel(wo.dueDate),
        href: `/work-orders?id=${encodeURIComponent(id)}&workflow=overdue`,
        severity: "critical",
        queue: "overdue",
        status: asString(wo.status) ?? null,
      });
    });

    blockedWorkOrders.slice(0, 8).forEach((wo) => {
      const id = asString(wo.id) ?? randomUUID();
      const reason = asString(wo.blockedReason) ?? "Missing blocker reason";
      const queue = blockerQueue(reason);
      items.push({
        id: `wo-blocked-${id}`,
        type: "work_order",
        sourceId: id,
        title: workOrderTitle(wo),
        source: getEquipmentName(wo),
        whyItMatters: `Blocked because: ${reason}`,
        recommendedAction: queue === "waiting_parts" ? "Check stock, create purchase request, or update part ETA." : "Resolve blocker or update owner/ETA.",
        owner: asString(wo.assignedToName) || asString(wo.assignedCrewId) || "Assigned owner",
        due: dateLabel(wo.dueDate),
        href: `/work-orders?id=${encodeURIComponent(id)}&workflow=resolve-blocker`,
        severity: "critical",
        queue,
        status: asString(wo.status) ?? null,
        blockerReason: reason,
      });
    });

    dueToday.slice(0, 8).forEach((wo) => {
      const id = asString(wo.id) ?? randomUUID();
      if (items.some((item) => item.sourceId === id && item.type === "work_order")) {
        return;
      }
      items.push({
        id: `wo-due-today-${id}`,
        type: "work_order",
        sourceId: id,
        title: workOrderTitle(wo),
        source: getEquipmentName(wo),
        whyItMatters: "Due today and should be completed or deferred before handover.",
        recommendedAction: "Complete, assign, or defer with a reason.",
        owner: asString(wo.assignedToName) || asString(wo.assignedCrewId) || "Assigned owner",
        due: "Today",
        href: `/work-orders?id=${encodeURIComponent(id)}&workflow=due-today`,
        severity: severityForPriority(wo.priority),
        queue: "due_today",
        status: asString(wo.status) ?? null,
      });
    });

    readyToClose.slice(0, 8).forEach((wo) => {
      const id = asString(wo.id) ?? randomUUID();
      if (items.some((item) => item.sourceId === id && item.type === "work_order")) {
        return;
      }
      items.push({
        id: `wo-closeout-${id}`,
        type: "work_order",
        sourceId: id,
        title: workOrderTitle(wo),
        source: getEquipmentName(wo),
        whyItMatters: "The job appears ready for verification or supervisor closeout.",
        recommendedAction: "Review evidence, request corrections, or close the work order.",
        owner: "Supervisor",
        due: dateLabel(wo.dueDate),
        href: `/work-orders?id=${encodeURIComponent(id)}&workflow=closeout`,
        severity: "info",
        queue: "ready_to_close",
        status: asString(wo.status) ?? null,
      });
    });

    lowStock.slice(0, 6).forEach((part) => {
      const id = asString(part.id) ?? asString(part.partId) ?? randomUUID();
      const name = asString(part.name) || asString(part.partName) || asString(part.partNo) || "Part";
      items.push({
        id: `low-stock-${id}`,
        type: "inventory",
        sourceId: id,
        title: `${name} is low stock`,
        source: "Inventory",
        whyItMatters: "Low stock can block maintenance work or extend downtime.",
        recommendedAction: "Review consumption, reorder point, and purchase request status.",
        owner: "Logistics",
        due: "Before next maintenance window",
        href: `/inventory-management?partId=${encodeURIComponent(id)}&workflow=low-stock`,
        severity: "warning",
        queue: "waiting_parts",
        status: "low_stock",
      });
    });

    const sortedItems = items.sort((a, b) => {
      const rank: Record<WorkflowSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
      return rank[a.severity] - rank[b.severity];
    });

    const queueCount = (queueId: WorkflowQueueId): number =>
      queueId === "open_work"
        ? sortedItems.filter((item) => item.type === "work_order").length
        : queueId === "completed"
          ? completedWorkOrders.length
          : sortedItems.filter((item) => item.queue === queueId).length;

    const queues: AttentionWorkflowQueue[] = [
      {
        id: "needs_review",
        label: "Needs Review",
        description: "Alerts, findings, or equipment risk that need triage.",
        count: queueCount("needs_review"),
        href: "/attention-inbox?queue=needs_review",
        severity: queueCount("needs_review") > 0 ? "warning" : "success",
      },
      {
        id: "open_work",
        label: "Open Work Attention",
        description: "Active jobs that need due-date, blocker, overdue, or closeout attention.",
        count: queueCount("open_work"),
        href: "/attention-inbox?queue=open_work",
        severity: queueCount("open_work") > 0 ? "info" : "success",
      },
      {
        id: "due_today",
        label: "Due Today",
        description: "Jobs that should be completed before handover.",
        count: dueToday.length,
        href: "/attention-inbox?queue=due_today",
        severity: dueToday.length > 0 ? "warning" : "success",
      },
      {
        id: "blocked",
        label: "Blocked",
        description: "Work held by vendor, approval, weather, crew, or missing information.",
        count: blockedWorkOrders.length,
        href: "/attention-inbox?queue=blocked",
        severity: blockedWorkOrders.length > 0 ? "critical" : "success",
      },
      {
        id: "waiting_parts",
        label: "Waiting on Parts",
        description: "Jobs and stock issues needing logistics action.",
        count: waitingParts.length + lowStock.length,
        href: "/attention-inbox?queue=waiting_parts",
        severity: waitingParts.length + lowStock.length > 0 ? "warning" : "success",
      },
      {
        id: "ready_to_close",
        label: "Ready to Close",
        description: "Work requiring verification or supervisor closeout.",
        count: readyToClose.length,
        href: "/attention-inbox?queue=ready_to_close",
        severity: readyToClose.length > 0 ? "info" : "success",
      },
      {
        id: "completed",
        label: "Recently Completed",
        description: "Recently completed or closed work orders.",
        count: completedWorkOrders.length,
        href: "/work-orders?status=completed",
        severity: "success",
      },
      {
        id: "overdue",
        label: "Overdue",
        description: "Past-due work that needs escalation or deferment.",
        count: overdue.length,
        href: "/attention-inbox?queue=overdue",
        severity: overdue.length > 0 ? "critical" : "success",
      },
    ];

    const handover: AttentionHandoverSummary = {
      openAttentionItems: sortedItems.length,
      criticalItems: sortedItems.filter((item) => item.severity === "critical").length,
      blockedJobs: blockedWorkOrders.length,
      readyForCloseout: readyToClose.length,
      openWorkOrders: openWorkOrders.length,
      lowStockParts: lowStock.length,
      suggestedSummary: sortedItems.slice(0, 5).map((item) => `${item.title}: ${item.recommendedAction}`),
    };

    return {
      generatedAt: now.toISOString(),
      items: sortedItems,
      queues,
      handover,
    };
  }
}

export const attentionWorkflowService = new AttentionWorkflowService();
