import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  AttentionHandoverSummary,
  AttentionItem,
  AttentionWorkflowResponse,
  WorkflowQueue,
  WorkflowWorkOrderRecord,
  WorkflowSeverity,
} from "./types";

interface AttentionSummary {
  overdueWorkOrders?: number;
  unacknowledgedAlerts?: number;
  highRiskEquipment?: number;
  newSinceLastVisit?: {
    newAlerts?: number;
    newWorkOrders?: number;
    completedWorkOrders?: number;
  };
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeWorkOrders(data: unknown): WorkflowWorkOrderRecord[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      id:
        typeof item["id"] === "string" || typeof item["id"] === "number"
          ? item["id"]
          : String(Math.random()),
      title: typeof item["title"] === "string" ? item["title"] : undefined,
      status: typeof item["status"] === "string" ? item["status"] : undefined,
      priority:
        typeof item["priority"] === "number" || typeof item["priority"] === "string"
          ? item["priority"]
          : null,
      dueDate: typeof item["dueDate"] === "string" ? item["dueDate"] : null,
      blockedReason: typeof item["blockedReason"] === "string" ? item["blockedReason"] : null,
      assignedCrewId: typeof item["assignedCrewId"] === "string" ? item["assignedCrewId"] : null,
      assignedToName: typeof item["assignedToName"] === "string" ? item["assignedToName"] : null,
      equipmentName: typeof item["equipmentName"] === "string" ? item["equipmentName"] : null,
      equipment:
        item["equipment"] && typeof item["equipment"] === "object"
          ? {
              name:
                typeof (item["equipment"] as { name?: unknown }).name === "string"
                  ? (item["equipment"] as { name: string }).name
                  : null,
            }
          : null,
    }));
}

function isDueToday(dueDate: string | null | undefined): boolean {
  if (!dueDate) {
    return false;
  }
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function isReadyToClose(status: string | undefined): boolean {
  const normalized = status?.toLowerCase().replace(/[_-]/g, " ") ?? "";
  return (
    normalized.includes("ready") || normalized.includes("verify") || normalized.includes("review")
  );
}

function isCompleted(status: string | undefined): boolean {
  const normalized = status?.toLowerCase() ?? "";
  return normalized.includes("complete") || normalized.includes("closed");
}

function severityForPriority(priority: string | number | null | undefined): WorkflowSeverity {
  if (priority === 1 || priority === "1" || String(priority).toLowerCase() === "critical") {
    return "critical";
  }
  if (priority === 2 || priority === "2" || String(priority).toLowerCase() === "high") {
    return "warning";
  }
  return "info";
}

const emptyHandover: AttentionHandoverSummary = {
  openAttentionItems: 0,
  criticalItems: 0,
  blockedJobs: 0,
  readyForCloseout: 0,
  openWorkOrders: 0,
  lowStockParts: 0,
  waitingOnParts: 0,
  suggestedSummary: [],
};

function fallbackQueues(
  summary: AttentionSummary | undefined,
  workOrders: WorkflowWorkOrderRecord[]
): WorkflowQueue[] {
  const overdue = numeric(summary?.overdueWorkOrders);
  const alerts = numeric(summary?.unacknowledgedAlerts);
  const highRisk = numeric(summary?.highRiskEquipment);
  const blocked = workOrders.filter((item) => Boolean(item.blockedReason)).length;
  const dueToday = workOrders.filter((item) => isDueToday(item.dueDate)).length;
  const readyToClose = workOrders.filter((item) => isReadyToClose(item.status)).length;
  const completed = numeric(summary?.newSinceLastVisit?.completedWorkOrders);
  const waitingParts = workOrders.filter((item) =>
    item.blockedReason?.toLowerCase().includes("part")
  ).length;
  const openWorkAttention = workOrders.filter(
    (item) => Boolean(item.blockedReason) || isDueToday(item.dueDate) || isReadyToClose(item.status)
  ).length;

  return [
    {
      id: "needs_review",
      label: "Needs Review",
      description: "Alerts, findings, or equipment risk that need triage.",
      count: alerts + highRisk,
      href: "/attention-inbox?queue=needs_review",
      severity: alerts + highRisk > 0 ? "warning" : "success",
    },
    {
      id: "open_work",
      label: "Open Work Attention",
      description: "Active jobs that need due-date, blocker, or closeout attention.",
      count: openWorkAttention,
      href: "/attention-inbox?queue=open_work",
      severity: openWorkAttention > 0 ? "info" : "success",
    },
    {
      id: "due_today",
      label: "Due Today",
      description: "Jobs that should be completed before handover.",
      count: dueToday,
      href: "/attention-inbox?queue=due_today",
      severity: dueToday > 0 ? "warning" : "success",
    },
    {
      id: "blocked",
      label: "Blocked",
      description: "Work held by parts, vendors, approvals, or missing information.",
      count: blocked,
      href: "/attention-inbox?queue=blocked",
      severity: blocked > 0 ? "critical" : "success",
    },
    {
      id: "waiting_parts",
      label: "Waiting on Parts",
      description: "Jobs likely to need logistics action.",
      count: waitingParts,
      href: "/attention-inbox?queue=waiting_parts",
      severity: waitingParts > 0 ? "warning" : "success",
    },
    {
      id: "ready_to_close",
      label: "Ready to Close",
      description: "Work requiring verification or supervisor closeout.",
      count: readyToClose,
      href: "/attention-inbox?queue=ready_to_close",
      severity: readyToClose > 0 ? "info" : "success",
    },
    {
      id: "completed",
      label: "Recently Completed",
      description: "Completed work since the last visit.",
      count: completed,
      href: "/work-orders?status=completed",
      severity: "success",
    },
    {
      id: "overdue",
      label: "Overdue",
      description: "Past-due work that needs escalation or deferment.",
      count: overdue,
      href: "/attention-inbox?queue=overdue",
      severity: overdue > 0 ? "critical" : "success",
    },
  ];
}

function fallbackAttentionItems(
  summary: AttentionSummary | undefined,
  workOrders: WorkflowWorkOrderRecord[]
): AttentionItem[] {
  const items: AttentionItem[] = [];

  const overdue = numeric(summary?.overdueWorkOrders);
  if (overdue > 0) {
    items.push({
      id: "overdue-work-orders",
      type: "work_order",
      queue: "overdue",
      title: `${overdue} overdue work order${overdue === 1 ? "" : "s"}`,
      source: "Maintenance",
      whyItMatters: "Past-due work can create safety, reliability, or audit exposure.",
      recommendedAction: "Review, assign an owner, or defer with a reason.",
      owner: "Chief Engineer",
      due: "Now",
      href: "/work-orders?status=overdue",
      severity: "critical",
    });
  }

  const highRisk = numeric(summary?.highRiskEquipment);
  if (highRisk > 0) {
    items.push({
      id: "high-risk-equipment",
      type: "equipment",
      queue: "needs_review",
      title: `${highRisk} high-risk equipment item${highRisk === 1 ? "" : "s"}`,
      source: "PdM / Equipment",
      whyItMatters: "Risk scores should be converted into inspection or maintenance decisions.",
      recommendedAction:
        "Open equipment intelligence and create an inspection work order where needed.",
      owner: "Chief Engineer",
      due: "Within 24 hours",
      href: "/equipment-intelligence",
      severity: "warning",
    });
  }

  const alerts = numeric(summary?.unacknowledgedAlerts);
  if (alerts > 0) {
    items.push({
      id: "unacknowledged-alerts",
      type: "alert",
      queue: "needs_review",
      title: `${alerts} unacknowledged alert${alerts === 1 ? "" : "s"}`,
      source: "Operations",
      whyItMatters: "Unacknowledged alerts can hide real operational changes from the next watch.",
      recommendedAction: "Acknowledge, assign, or convert confirmed alerts into findings.",
      owner: "Watch Officer",
      due: "Before handover",
      href: "/attention-inbox",
      severity: "warning",
    });
  }

  workOrders
    .filter(
      (item) =>
        Boolean(item.blockedReason) || isDueToday(item.dueDate) || isReadyToClose(item.status)
    )
    .slice(0, 8)
    .forEach((item) => {
      const equipment = item.equipmentName || item.equipment?.name || "Unassigned equipment";
      const blocked = Boolean(item.blockedReason);
      const queue = blocked
        ? item.blockedReason?.toLowerCase().includes("part")
          ? "waiting_parts"
          : "blocked"
        : isReadyToClose(item.status)
          ? "ready_to_close"
          : "due_today";
      items.push({
        id: `work-order-${item.id}`,
        type: "work_order",
        sourceId: String(item.id),
        queue,
        title: item.title || `Work order ${item.id}`,
        source: equipment,
        whyItMatters: blocked
          ? `Blocked because: ${item.blockedReason}`
          : isDueToday(item.dueDate)
            ? "Due today and should be resolved or deferred before handover."
            : "Ready for verification or supervisor closeout.",
        recommendedAction: blocked
          ? "Resolve blocker, order parts, or update ETA."
          : isReadyToClose(item.status)
            ? "Verify evidence and close the work order."
            : "Complete or defer with a reason.",
        owner: item.assignedToName || item.assignedCrewId || "Assigned owner",
        due: item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "No due date",
        href: `/work-orders?id=${item.id}`,
        severity: blocked ? "critical" : severityForPriority(item.priority),
        status: item.status ?? null,
        blockerReason: item.blockedReason ?? null,
      });
    });

  return items;
}

export function useOperationalWorkflow() {
  const { data: workflow } = useQuery<AttentionWorkflowResponse>({
    queryKey: ["/api/attention/items"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: summary } = useQuery<AttentionSummary>({
    queryKey: ["/api/home/attention-summary"],
    refetchInterval: 60000,
    enabled: !workflow,
  });

  const { data: workOrdersRaw } = useQuery<unknown>({
    queryKey: ["/api/work-orders", { status: "open" }],
    refetchInterval: 60000,
    enabled: !workflow,
  });

  const workOrders = useMemo(() => normalizeWorkOrders(workOrdersRaw), [workOrdersRaw]);
  const fallbackItems = useMemo(
    () => fallbackAttentionItems(summary, workOrders),
    [summary, workOrders]
  );
  const fallbackQueueData = useMemo(
    () => fallbackQueues(summary, workOrders),
    [summary, workOrders]
  );

  const handover = useMemo<AttentionHandoverSummary>(() => {
    if (workflow?.handover) {
      return workflow.handover;
    }
    return {
      ...emptyHandover,
      openAttentionItems: fallbackItems.length,
      criticalItems: fallbackItems.filter((item) => item.severity === "critical").length,
      blockedJobs: fallbackItems.filter((item) => item.queue === "blocked").length,
      waitingOnParts: fallbackItems.filter((item) => item.queue === "waiting_parts").length,
      readyForCloseout: fallbackItems.filter((item) => item.queue === "ready_to_close").length,
      openWorkOrders: workOrders.length,
      suggestedSummary: fallbackItems
        .slice(0, 5)
        .map((item) => `${item.title}: ${item.recommendedAction}`),
    };
  }, [workflow, fallbackItems, workOrders.length]);

  return {
    queues: workflow?.queues ?? fallbackQueueData,
    attentionItems: workflow?.items ?? fallbackItems,
    workOrders,
    handover,
    generatedAt: workflow?.generatedAt,
    hasLiveData: Boolean(workflow) || Boolean(summary) || workOrders.length > 0,
    usingAggregatedWorkflow: Boolean(workflow),
    sources: workflow?.sources,
  };
}
