import { randomUUID } from "node:crypto";
import type { AttentionWorkflowSources } from "../domain/ports.js";
import {
  asString,
  blockerQueue,
  dateLabel,
  getEquipmentName,
  isClosedStatus,
  isDueToday,
  isOpenStatus,
  isOverdue,
  isPartsBlocker,
  isReadyToClose,
  isRecord,
  latestBy,
  resolutionSummary,
  safeCall,
  severityForPriority,
  sourceHealth,
  workOrderTitle,
} from "./attention-helpers.js";
import { readWorkflowState } from "./attention-state.js";
import type {
  AttentionHandoverSummary,
  AttentionWorkflowItem,
  AttentionWorkflowQueue,
  AttentionWorkflowResponse,
  BlockerResolutionRecord,
  WorkflowQueueId,
  WorkflowSeverity,
} from "./attention-types.js";

export async function buildAttentionWorkflow(
  sources: AttentionWorkflowSources,
  orgId: string
): Promise<AttentionWorkflowResponse> {
  const [alertResult, workOrderResult, equipmentResult, lowStockResult, workflowState] =
    await Promise.all([
      safeCall("alerts", () => sources.alerts.getAlertNotifications(orgId)),
      safeCall("work-orders", () => sources.workOrders.getWorkOrders(orgId)),
      safeCall("equipment", () => sources.equipment.getEquipmentRegistry(orgId)),
      safeCall("low-stock", () => sources.inventory.getLowStockParts(orgId)),
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

  const openWorkOrders = workOrders.filter((wo) => isOpenStatus(wo["status"]));
  const completedWorkOrders = workOrders.filter((wo) => isClosedStatus(wo["status"]));
  const blockedWorkOrders = openWorkOrders.filter((wo) => Boolean(asString(wo["blockedReason"])));
  const waitingParts = blockedWorkOrders.filter((wo) =>
    isPartsBlocker(asString(wo["blockedReason"]))
  );
  const nonPartsBlocked = blockedWorkOrders.filter(
    (wo) => !isPartsBlocker(asString(wo["blockedReason"]))
  );
  const dueToday = openWorkOrders.filter((wo) => isDueToday(wo["dueDate"], now));
  const overdue = openWorkOrders.filter((wo) => isOverdue(wo["dueDate"], wo["status"], now));
  const readyToClose = openWorkOrders.filter((wo) => isReadyToClose(wo["status"]));
  const highRiskEquipment = equipment.filter((eq) => {
    const risk = String(eq["riskLevel"] ?? eq["risk"] ?? "").toLowerCase();
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
      href: "/attention-inbox",
      severity: alerts.length > 3 ? "critical" : "warning",
      queue: "needs_review",
      status: "needs_review",
    });
  }

  highRiskEquipment.slice(0, 6).forEach((eq) => {
    const id =
      asString(eq["id"]) ?? asString(eq["equipmentId"]) ?? asString(eq["name"]) ?? randomUUID();
    const risk = String(eq["riskLevel"] ?? eq["risk"] ?? "high").toLowerCase();
    items.push({
      id: `equipment-risk-${id}`,
      type: "equipment",
      sourceId: id,
      title: `${asString(eq["name"]) ?? "Equipment"} risk is ${risk}`,
      source: "Equipment intelligence",
      whyItMatters:
        "High-risk equipment should be converted into an inspection, maintenance, or deferment decision.",
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
    const id = asString(wo["id"]) ?? randomUUID();
    items.push({
      id: `wo-overdue-${id}`,
      type: "work_order",
      sourceId: id,
      title: workOrderTitle(wo),
      source: getEquipmentName(wo),
      whyItMatters: "This work is overdue and may create safety, reliability, or audit exposure.",
      recommendedAction: "Escalate, assign an owner, complete, or defer with a reason.",
      owner: asString(wo["assignedToName"]) || asString(wo["assignedCrewId"]) || "Chief Engineer",
      due: dateLabel(wo["dueDate"]),
      href: `/work-orders?id=${encodeURIComponent(id)}&workflow=overdue`,
      severity: "critical",
      queue: "overdue",
      status: asString(wo["status"]) ?? null,
    });
  });

  blockedWorkOrders.slice(0, 8).forEach((wo) => {
    const id = asString(wo["id"]) ?? randomUUID();
    const reason = asString(wo["blockedReason"]) ?? "Missing blocker reason";
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
      owner:
        lastResolution?.owner ||
        asString(wo["assignedToName"]) ||
        asString(wo["assignedCrewId"]) ||
        "Assigned owner",
      due: lastResolution?.eta || dateLabel(wo["dueDate"]),
      href: `/work-orders?id=${encodeURIComponent(id)}&workflow=resolve-blocker`,
      severity:
        (lastResolution?.status as string | undefined) === "unblocked" ? "info" : "critical",
      queue,
      status: asString(wo["status"]) ?? null,
      blockerReason: reason,
      lastResolution,
    });
  });

  dueToday.slice(0, 8).forEach((wo) => {
    const id = asString(wo["id"]) ?? randomUUID();
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
      owner: asString(wo["assignedToName"]) || asString(wo["assignedCrewId"]) || "Assigned owner",
      due: "Today",
      href: `/work-orders?id=${encodeURIComponent(id)}&workflow=due-today`,
      severity: severityForPriority(wo["priority"]),
      queue: "due_today",
      status: asString(wo["status"]) ?? null,
    });
  });

  readyToClose.slice(0, 8).forEach((wo) => {
    const id = asString(wo["id"]) ?? randomUUID();
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
      due: dateLabel(wo["dueDate"]),
      href: `/work-orders?id=${encodeURIComponent(id)}&workflow=closeout`,
      severity: "info",
      queue: "ready_to_close",
      status: asString(wo["status"]) ?? null,
    });
  });

  lowStock.slice(0, 6).forEach((part) => {
    const id = asString(part["id"]) ?? asString(part["partId"]) ?? randomUUID();
    const name =
      asString(part["name"]) || asString(part["partName"]) || asString(part["partNo"]) || "Part";
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
      href: `/logistics?tab=inventory&partId=${encodeURIComponent(id)}&workflow=low-stock`,
      severity: (lastResolution?.status as string | undefined) === "unblocked" ? "info" : "warning",
      queue: "waiting_parts",
      status: "low_stock",
      lastResolution,
    });
  });

  const sortedItems = items.sort((a, b) => {
    const rank: Record<WorkflowSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      success: 3,
    };
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
    suggestedSummary: sortedItems
      .slice(0, 5)
      .map((item) => `${item.title}: ${item.recommendedAction}`),
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
