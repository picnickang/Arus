import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AttentionItem, WorkflowQueue, WorkOrderRecord, WorkflowSeverity } from "./types";

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

function normalizeWorkOrders(data: unknown): WorkOrderRecord[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" || typeof item.id === "number" ? item.id : String(Math.random()),
      title: typeof item.title === "string" ? item.title : undefined,
      status: typeof item.status === "string" ? item.status : undefined,
      priority:
        typeof item.priority === "number" || typeof item.priority === "string" ? item.priority : null,
      dueDate: typeof item.dueDate === "string" ? item.dueDate : null,
      blockedReason: typeof item.blockedReason === "string" ? item.blockedReason : null,
      equipmentName: typeof item.equipmentName === "string" ? item.equipmentName : null,
      equipment:
        item.equipment && typeof item.equipment === "object"
          ? { name: typeof (item.equipment as { name?: unknown }).name === "string" ? (item.equipment as { name: string }).name : null }
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
  return normalized.includes("ready") || normalized.includes("verify") || normalized.includes("review");
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

export function useOperationalWorkflow() {
  const { data: summary } = useQuery<AttentionSummary>({
    queryKey: ["/api/home/attention-summary"],
    refetchInterval: 60000,
  });

  const { data: workOrdersRaw } = useQuery<unknown>({
    queryKey: ["/api/work-orders", { status: "open" }],
    refetchInterval: 60000,
  });

  const workOrders = useMemo(() => normalizeWorkOrders(workOrdersRaw), [workOrdersRaw]);

  const queues = useMemo<WorkflowQueue[]>(() => {
    const overdue = numeric(summary?.overdueWorkOrders);
    const alerts = numeric(summary?.unacknowledgedAlerts);
    const highRisk = numeric(summary?.highRiskEquipment);
    const blocked = workOrders.filter((item) => Boolean(item.blockedReason)).length;
    const dueToday = workOrders.filter((item) => isDueToday(item.dueDate)).length;
    const readyToClose = workOrders.filter((item) => isReadyToClose(item.status)).length;
    const completed = numeric(summary?.newSinceLastVisit?.completedWorkOrders);

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
        id: "assigned",
        label: "Assigned to Me",
        description: "Open work assigned to the current user.",
        count: workOrders.length,
        href: "/work-orders?assignedToMe=true",
        severity: workOrders.length > 0 ? "info" : "success",
      },
      {
        id: "due_today",
        label: "Due Today",
        description: "Jobs that should be completed before handover.",
        count: dueToday,
        href: "/work-orders?due=today",
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
        count: workOrders.filter((item) => item.blockedReason?.toLowerCase().includes("part")).length,
        href: "/inventory-management?filter=work-order-blockers",
        severity: "warning",
      },
      {
        id: "ready_to_close",
        label: "Ready to Close",
        description: "Work requiring verification or supervisor closeout.",
        count: readyToClose,
        href: "/work-orders?status=ready-to-close",
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
        href: "/work-orders?status=overdue",
        severity: overdue > 0 ? "critical" : "success",
      },
    ];
  }, [summary, workOrders]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    const overdue = numeric(summary?.overdueWorkOrders);
    if (overdue > 0) {
      items.push({
        id: "overdue-work-orders",
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
        title: `${highRisk} high-risk equipment item${highRisk === 1 ? "" : "s"}`,
        source: "PdM / Equipment",
        whyItMatters: "Risk scores should be converted into inspection or maintenance decisions.",
        recommendedAction: "Open equipment intelligence and create an inspection work order where needed.",
        owner: "Chief Engineer",
        due: "Within 24 hours",
        href: "/pdm-dashboard",
        severity: "warning",
      });
    }

    const alerts = numeric(summary?.unacknowledgedAlerts);
    if (alerts > 0) {
      items.push({
        id: "unacknowledged-alerts",
        title: `${alerts} unacknowledged alert${alerts === 1 ? "" : "s"}`,
        source: "Operations",
        whyItMatters: "Unacknowledged alerts can hide real operational changes from the next watch.",
        recommendedAction: "Acknowledge, assign, or convert confirmed alerts into findings.",
        owner: "Watch Officer",
        due: "Before handover",
        href: "/dashboard?tab=alerts",
        severity: "warning",
      });
    }

    workOrders
      .filter((item) => Boolean(item.blockedReason) || isDueToday(item.dueDate) || isReadyToClose(item.status))
      .slice(0, 8)
      .forEach((item) => {
        const equipment = item.equipmentName || item.equipment?.name || "Unassigned equipment";
        const blocked = Boolean(item.blockedReason);
        items.push({
          id: `work-order-${item.id}`,
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
          owner: "Assigned owner",
          due: item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "No due date",
          href: `/work-orders?id=${item.id}`,
          severity: blocked ? "critical" : severityForPriority(item.priority),
        });
      });

    return items;
  }, [summary, workOrders]);

  return {
    queues,
    attentionItems,
    workOrders,
    hasLiveData: Boolean(summary) || workOrders.length > 0,
  };
}
