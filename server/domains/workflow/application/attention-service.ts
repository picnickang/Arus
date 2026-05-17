import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AttentionWorkflowSources } from "../domain/ports.js";

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

export type AttentionSourceHealthStatus = "ok" | "failed" | "not_configured";

export interface AttentionSourceHealth {
  workOrders: AttentionSourceHealthStatus;
  alerts: AttentionSourceHealthStatus;
  equipment: AttentionSourceHealthStatus;
  inventory: AttentionSourceHealthStatus;
  errors?: Record<string, string>;
}

export interface BlockerResolutionSummary {
  status: "updated" | "waiting" | "unblocked" | "deferred";
  owner?: string;
  eta?: string;
  note?: string;
  savedAt: string;
}

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
  lastResolution?: BlockerResolutionSummary | null;
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
  waitingOnParts: number;
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
  sources: AttentionSourceHealth;
}

export interface HandoverRecord {
  id: string;
  orgId: string;
  note: string;
  watchLabel?: string;
  generatedSummary: string;
  itemIds: string[];
  authorId?: string;
  status: "draft" | "shared" | "acknowledged";
  savedAt: string;
}

export interface BlockerResolutionRecord {
  id: string;
  orgId: string;
  itemId: string;
  workOrderId?: string;
  inventoryItemId?: string;
  blockerType: string;
  reason: string;
  owner?: string;
  eta?: string;
  status: "updated" | "waiting" | "unblocked" | "deferred";
  note?: string;
  savedAt: string;
  authorId?: string;
}

export interface IssueReportRecord {
  id: string;
  orgId: string;
  severity: "critical" | "high" | "medium" | "low";
  summary: string;
  vessel?: string;
  equipment?: string;
  location?: string;
  impact?: string;
  evidenceNote?: string;
  owner?: string;
  dueDate?: string;
  target: "work_order" | "finding" | "log_note" | "handover";
  suggestedHref: string;
  status: "draft" | "submitted";
  createdAt: string;
  authorId?: string;
}

type WorkflowState = {
  handovers: HandoverRecord[];
  blockerResolutions: BlockerResolutionRecord[];
  issueReports: IssueReportRecord[];
};

type RecordLike = Record<string, unknown>;

type SafeCallResult<T> = {
  data: T | null;
  status: AttentionSourceHealthStatus;
  error?: string;
};

const WORKFLOW_DATA_DIR = process.env.ARUS_WORKFLOW_DATA_DIR || path.resolve(process.cwd(), "data", "workflow");
const WORKFLOW_STATE_FILE = path.join(WORKFLOW_DATA_DIR, "attention-workflow-state.json");

function emptyState(): WorkflowState {
  return { handovers: [], blockerResolutions: [], issueReports: [] };
}

async function readWorkflowState(): Promise<WorkflowState> {
  try {
    const raw = await readFile(WORKFLOW_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<WorkflowState>;
    return {
      handovers: Array.isArray(parsed.handovers) ? parsed.handovers : [],
      blockerResolutions: Array.isArray(parsed.blockerResolutions) ? parsed.blockerResolutions : [],
      issueReports: Array.isArray(parsed.issueReports) ? parsed.issueReports : [],
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return emptyState();
    }
    throw error;
  }
}

async function writeWorkflowState(state: WorkflowState): Promise<void> {
  await mkdir(WORKFLOW_DATA_DIR, { recursive: true });
  await writeFile(WORKFLOW_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function latestBy<T>(items: T[], dateGetter: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(dateGetter(a) || 0).getTime();
    const bTime = new Date(dateGetter(b) || 0).getTime();
    return bTime - aTime;
  });
}

function isRecord(value: unknown): value is RecordLike {
  return value !== null && typeof value === "object";
}

async function safeCall<T>(label: string, fn: () => Promise<T>): Promise<SafeCallResult<T>> {
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

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function cleanString(value: unknown, fallback = ""): string {
  return asString(value)?.trim() || fallback;
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

function isPartsBlocker(reason: string | null | undefined): boolean {
  const normalized = reason?.toLowerCase() ?? "";
  return normalized.includes("part") || normalized.includes("stock") || normalized.includes("inventory");
}

function blockerQueue(reason: string | null): WorkflowQueueId {
  return isPartsBlocker(reason) ? "waiting_parts" : "blocked";
}

function sourceHealth(results: {
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

function resolutionSummary(record: BlockerResolutionRecord | undefined): BlockerResolutionSummary | null {
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

function issueHref(target: IssueReportRecord["target"], issueId: string): string {
  if (target === "work_order") return `/work-orders?action=create&flow=report-issue&issueId=${encodeURIComponent(issueId)}`;
  if (target === "finding") return `/findings?action=create&flow=report-issue&issueId=${encodeURIComponent(issueId)}`;
  if (target === "log_note") return `/logs/deck?flow=report-issue&issueId=${encodeURIComponent(issueId)}`;
  return `/attention-inbox?view=handover&issueId=${encodeURIComponent(issueId)}`;
}

export class AttentionWorkflowService {
  constructor(private readonly sources: AttentionWorkflowSources) {}

  async getWorkflow(orgId: string): Promise<AttentionWorkflowResponse> {
    const [alertResult, workOrderResult, equipmentResult, lowStockResult, workflowState] = await Promise.all([
      safeCall("alerts", () => this.sources.alerts.getAlertNotifications(orgId)),
      safeCall("work-orders", () => this.sources.workOrders.getWorkOrders(orgId)),
      safeCall("equipment", () => this.sources.equipment.getEquipmentRegistry(orgId)),
      safeCall("low-stock", () => this.sources.inventory.getLowStockParts(orgId)),
      readWorkflowState(),
    ]);

    const alertData = alertResult.data;
    const workOrderData = workOrderResult.data;
    const equipmentData = equipmentResult.data;
    const lowStockData = lowStockResult.data;

    const alerts = Array.isArray(alertData) ? alertData.filter(isRecord) : [];
    const workOrders = Array.isArray(workOrderData) ? workOrderData.filter(isRecord) : [];
    const equipment = Array.isArray(equipmentData) ? equipmentData.filter(isRecord) : [];
    const lowStock = Array.isArray(lowStockData) ? lowStockData.filter(isRecord) : [];
    const now = new Date();

    const latestResolutions = new Map<string, BlockerResolutionRecord>();
    latestBy(
      workflowState.blockerResolutions.filter((record) => record.orgId === orgId),
      (record) => record.savedAt
    ).forEach((record) => {
      const key = record.workOrderId || record.inventoryItemId || record.itemId;
      if (key && !latestResolutions.has(key)) {
        latestResolutions.set(key, record);
      }
    });

    const openWorkOrders = workOrders.filter((wo) => isOpenStatus(wo.status));
    const completedWorkOrders = workOrders.filter((wo) => isClosedStatus(wo.status));
    const blockedWorkOrders = openWorkOrders.filter((wo) => Boolean(asString(wo.blockedReason)));
    const waitingParts = blockedWorkOrders.filter((wo) => isPartsBlocker(asString(wo.blockedReason)));
    const nonPartsBlocked = blockedWorkOrders.filter((wo) => !isPartsBlocker(asString(wo.blockedReason)));
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
      const lastResolution = resolutionSummary(latestResolutions.get(id));
      if (lastResolution?.status === "unblocked") {
        return;
      }
      items.push({
        id: `wo-blocked-${id}`,
        type: "work_order",
        sourceId: id,
        title: workOrderTitle(wo),
        source: getEquipmentName(wo),
        whyItMatters: `Blocked because: ${reason}`,
        recommendedAction:
          queue === "waiting_parts"
            ? "Check stock, create purchase request, or update part ETA."
            : "Resolve blocker or update owner/ETA.",
        owner: lastResolution?.owner || asString(wo.assignedToName) || asString(wo.assignedCrewId) || "Assigned owner",
        due: lastResolution?.eta || dateLabel(wo.dueDate),
        href: `/work-orders?id=${encodeURIComponent(id)}&workflow=resolve-blocker`,
        // @ts-ignore -- bulk-silence
        severity: lastResolution?.status === "unblocked" ? "info" : "critical",
        queue,
        status: asString(wo.status) ?? null,
        blockerReason: reason,
        lastResolution,
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
      const lastResolution = resolutionSummary(latestResolutions.get(id));
      if (lastResolution?.status === "unblocked") {
        return;
      }
      items.push({
        id: `low-stock-${id}`,
        type: "inventory",
        sourceId: id,
        title: `${name} is low stock`,
        source: "Inventory",
        whyItMatters: "Low stock can block maintenance work or extend downtime.",
        recommendedAction: "Review consumption, reorder point, and purchase request status.",
        owner: lastResolution?.owner || "Logistics",
        due: lastResolution?.eta || "Before next maintenance window",
        href: `/inventory-management?partId=${encodeURIComponent(id)}&workflow=low-stock`,
        // @ts-ignore -- bulk-silence
        severity: lastResolution?.status === "unblocked" ? "info" : "warning",
        queue: "waiting_parts",
        status: "low_stock",
        lastResolution,
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
        count: queueCount("due_today"),
        href: "/attention-inbox?queue=due_today",
        severity: queueCount("due_today") > 0 ? "warning" : "success",
      },
      {
        id: "blocked",
        label: "Blocked",
        description: "Work held by vendor, approval, weather, crew, or missing information.",
        count: nonPartsBlocked.length,
        href: "/attention-inbox?queue=blocked",
        severity: nonPartsBlocked.length > 0 ? "critical" : "success",
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
        count: queueCount("ready_to_close"),
        href: "/attention-inbox?queue=ready_to_close",
        severity: queueCount("ready_to_close") > 0 ? "info" : "success",
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
        count: queueCount("overdue"),
        href: "/attention-inbox?queue=overdue",
        severity: queueCount("overdue") > 0 ? "critical" : "success",
      },
    ];

    const handover: AttentionHandoverSummary = {
      openAttentionItems: sortedItems.length,
      criticalItems: sortedItems.filter((item) => item.severity === "critical").length,
      blockedJobs: nonPartsBlocked.length,
      waitingOnParts: waitingParts.length + lowStock.length,
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
      sources: sourceHealth({
        alerts: alertResult,
        workOrders: workOrderResult,
        equipment: equipmentResult,
        inventory: lowStockResult,
      }),
    };
  }

  async getLatestHandover(orgId: string): Promise<HandoverRecord | null> {
    const state = await readWorkflowState();
    return latestBy(
      state.handovers.filter((record) => record.orgId === orgId),
      (record) => record.savedAt
    )[0] ?? null;
  }

  async listHandovers(orgId: string, limit = 20): Promise<HandoverRecord[]> {
    const state = await readWorkflowState();
    return latestBy(
      state.handovers.filter((record) => record.orgId === orgId),
      (record) => record.savedAt
    ).slice(0, limit);
  }

  async saveHandover(
    orgId: string,
    input: { note: unknown; watchLabel?: unknown; generatedSummary?: unknown; itemIds?: unknown; status?: unknown },
    authorId?: string
  ): Promise<HandoverRecord> {
    const state = await readWorkflowState();
    const record: HandoverRecord = {
      id: randomUUID(),
      orgId,
      note: cleanString(input.note),
      watchLabel: cleanString(input.watchLabel) || undefined,
      generatedSummary: cleanString(input.generatedSummary),
      itemIds: Array.isArray(input.itemIds) ? input.itemIds.map((item) => String(item)).slice(0, 50) : [],
      authorId,
      status: input.status === "shared" || input.status === "acknowledged" ? input.status : "draft",
      savedAt: new Date().toISOString(),
    };
    state.handovers = [record, ...state.handovers].slice(0, 200);
    await writeWorkflowState(state);
    return record;
  }

  async saveBlockerResolution(
    orgId: string,
    input: {
      itemId?: unknown;
      workOrderId?: unknown;
      inventoryItemId?: unknown;
      blockerType?: unknown;
      reason?: unknown;
      owner?: unknown;
      eta?: unknown;
      status?: unknown;
      note?: unknown;
    },
    authorId?: string
  ): Promise<BlockerResolutionRecord> {
    const status = ["updated", "waiting", "unblocked", "deferred"].includes(String(input.status))
      ? (String(input.status) as BlockerResolutionRecord["status"])
      : "updated";
    const state = await readWorkflowState();
    const record: BlockerResolutionRecord = {
      id: randomUUID(),
      orgId,
      itemId: cleanString(input.itemId, cleanString(input.workOrderId, cleanString(input.inventoryItemId, "unknown"))),
      workOrderId: cleanString(input.workOrderId) || undefined,
      inventoryItemId: cleanString(input.inventoryItemId) || undefined,
      blockerType: cleanString(input.blockerType, "Information needed"),
      reason: cleanString(input.reason, "No reason provided"),
      owner: cleanString(input.owner) || undefined,
      eta: cleanString(input.eta) || undefined,
      status,
      note: cleanString(input.note) || undefined,
      savedAt: new Date().toISOString(),
      authorId,
    };
    state.blockerResolutions = [record, ...state.blockerResolutions].slice(0, 500);
    await writeWorkflowState(state);
    return record;
  }

  async reportIssue(
    orgId: string,
    input: {
      severity?: unknown;
      summary?: unknown;
      vessel?: unknown;
      equipment?: unknown;
      location?: unknown;
      impact?: unknown;
      evidenceNote?: unknown;
      owner?: unknown;
      dueDate?: unknown;
      target?: unknown;
      status?: unknown;
    },
    authorId?: string
  ): Promise<IssueReportRecord> {
    const severity = ["critical", "high", "medium", "low"].includes(String(input.severity))
      ? (String(input.severity) as IssueReportRecord["severity"])
      : "medium";
    const target = ["work_order", "finding", "log_note", "handover"].includes(String(input.target))
      ? (String(input.target) as IssueReportRecord["target"])
      : "work_order";
    const id = randomUUID();
    const state = await readWorkflowState();
    const record: IssueReportRecord = {
      id,
      orgId,
      severity,
      summary: cleanString(input.summary, "Untitled issue"),
      vessel: cleanString(input.vessel) || undefined,
      equipment: cleanString(input.equipment) || undefined,
      location: cleanString(input.location) || undefined,
      impact: cleanString(input.impact) || undefined,
      evidenceNote: cleanString(input.evidenceNote) || undefined,
      owner: cleanString(input.owner) || undefined,
      dueDate: cleanString(input.dueDate) || undefined,
      target,
      suggestedHref: issueHref(target, id),
      status: input.status === "submitted" ? "submitted" : "draft",
      createdAt: new Date().toISOString(),
      authorId,
    };
    state.issueReports = [record, ...state.issueReports].slice(0, 500);
    await writeWorkflowState(state);
    return record;
  }
}

export function createAttentionWorkflowService(
  sources: AttentionWorkflowSources
): AttentionWorkflowService {
  return new AttentionWorkflowService(sources);
}
