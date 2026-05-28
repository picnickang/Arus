import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { isVesselRole } from "@/lib/briefing-redirect";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/navigation/PageHeader";
import { NavigationCard } from "@/components/navigation/NavigationCard";
import { QuickActions } from "@/components/shared/QuickActions";
import { AttentionBanner } from "@/components/shared/AttentionBanner";
import { PendingApprovalsBanner } from "@/components/shared/PendingApprovalsBanner";
import { QuickWorkOrderSheet } from "@/components/work-orders/QuickWorkOrderSheet";
import { homePageGroups, type HomePageGroup } from "@/config/navigationConfig";
import { trackPageVisit, getLastVisitTime, recordVisitTime } from "@/lib/pageTracking";
import {
  ChevronRight,
  History,
  Plus,
  Flag,
  CheckCircle2,
  Bell,
  Ship,
  Clock,
  ShieldAlert,
  Wrench,
  AlertTriangle,
  Sparkles,
  Users,
  ClipboardList,
  Activity,
} from "lucide-react";
import { ROLES, ROLE_STORAGE_KEY } from "@/config/roles";
import { WorkflowCommandCenter } from "@/features/workflow/components/WorkflowCommandCenter";
import { RoleTodayPanel } from "@/features/workflow/components/RoleTodayPanel";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import type { RoleConfig } from "@/config/roles";
import {
  getPortalForRole,
  getPrimaryCategoriesForRole,
} from "@/application/navigation/role-navigation-policy";
import { Button } from "@/components/ui/button";
import { SwitchPortalButton } from "@/components/navigation/SwitchPortalButton";
import {
  useUserDashboardViewModel,
  type ActiveAlertSlot,
  type CurrentVesselSlot,
  type SafetyNoticeSlot,
  type ShiftStatusSlot,
  type UpcomingMaintenanceSlot,
} from "@/application/user-dashboard/user-dashboard-view-model";
import { useDashboardSummary } from "@/features/analytics/hooks/useDashboardSummary";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";

export { trackPageVisit };
export type { RoleConfig };

const STORAGE_KEY = ROLE_STORAGE_KEY;

function RoleSelector({ onSelect }: { onSelect: (roleId: string) => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center mb-8">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-welcome-title">
          Welcome to ARUS
        </h1>
        <p className="text-muted-foreground">
          Choose your role to customize your home screen. You can change this anytime in Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
        {Object.values(ROLES).map((role) => {
          const Icon = role.icon;
          return (
            <button
              key={role.id}
              onClick={() => onSelect(role.id)}
              data-testid={`button-role-${role.id}`}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border
                         bg-card hover:border-primary hover:bg-primary/5 transition-all
                         text-left cursor-pointer touch-target"
            >
              <Icon className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-semibold text-sm">{role.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{role.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSelect("default")}
        data-testid="button-skip-role"
        className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip — show all categories
      </button>
    </div>
  );
}

function useAttentionItems() {
  const lastVisit = getLastVisitTime();

  const { data: summary } = useQuery<{
    overdueWorkOrders: number;
    unacknowledgedAlerts: number;
    highRiskEquipment: number;
    newSinceLastVisit?: {
      newAlerts: number;
      newWorkOrders: number;
      completedWorkOrders: number;
    };
  }>({
    queryKey: ["/api/home/attention-summary", lastVisit ? { since: lastVisit } : {}],
    refetchInterval: 60000,
  });

  const attentionItems = useMemo(() => {
    if (!summary) {
      return [];
    }
    const items: Array<{ label: string; count: number; severity: string; href: string }> = [];

    if (summary.overdueWorkOrders > 0) {
      items.push({
        label: "Overdue work orders",
        count: summary.overdueWorkOrders,
        severity: "critical",
        href: "/maint?tab=work-orders&status=overdue",
      });
    }
    if (summary.unacknowledgedAlerts > 0) {
      items.push({
        label: "Unacknowledged alerts",
        count: summary.unacknowledgedAlerts,
        severity: "warning",
        href: "/attention-inbox",
      });
    }
    if (summary.highRiskEquipment > 0) {
      items.push({
        label: "High-risk equipment",
        count: summary.highRiskEquipment,
        severity: "warning",
        href: "/pdm-dashboard",
      });
    }

    return items;
  }, [summary]);

  return { attentionItems, sinceLastVisit: summary?.newSinceLastVisit };
}

function SinceLastVisit({
  data,
}: {
  data: { newAlerts: number; newWorkOrders: number; completedWorkOrders: number };
}) {
  const total = data.newAlerts + data.newWorkOrders + data.completedWorkOrders;
  if (total === 0) {
    return null;
  }

  return (
    <div className="mb-6 p-4 rounded-lg border bg-card" data-testid="section-since-last-visit">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Since Your Last Visit</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.newAlerts > 0 && (
          <div className="text-center p-2 rounded bg-yellow-500/10">
            <div className="text-lg font-bold text-yellow-600" data-testid="text-new-alerts">
              {data.newAlerts}
            </div>
            <div className="text-xs text-muted-foreground">New Alerts</div>
          </div>
        )}
        {data.newWorkOrders > 0 && (
          <div className="text-center p-2 rounded bg-blue-500/10">
            <div className="text-lg font-bold text-blue-600" data-testid="text-new-work-orders">
              {data.newWorkOrders}
            </div>
            <div className="text-xs text-muted-foreground">New Work Orders</div>
          </div>
        )}
        {data.completedWorkOrders > 0 && (
          <div className="text-center p-2 rounded bg-green-500/10">
            <div
              className="text-lg font-bold text-green-600"
              data-testid="text-completed-work-orders"
            >
              {data.completedWorkOrders}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MyTask {
  id: string;
  title?: string;
  priority?: number;
  dueDate?: string | null;
  status?: string;
  equipmentName?: string | null;
  vesselName?: string | null;
  equipment?: { name?: string | null } | null;
}

interface MyTasksProps {
  /**
   * Optional empty-state node to render when the user has no open
   * work orders. When omitted, the section is hidden entirely
   * (legacy admin-portal behaviour). The user portal passes a calmer
   * "you're all caught up" affordance.
   */
  emptyState?: import("react").ReactNode;
}

function MyTasks({ emptyState }: MyTasksProps = {}) {
  const { data: myWorkOrders } = useQuery<MyTask[]>({
    queryKey: ["/api/work-orders", { assignedToMe: "true", status: "open" }],
    refetchInterval: 60000,
  });

  const [, setLocation] = useLocation();
  const tasks: MyTask[] = Array.isArray(myWorkOrders) ? myWorkOrders.slice(0, 5) : [];

  if (tasks.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">My Tasks</h2>
        <button
          onClick={() => setLocation("/maint?tab=work-orders&assignedToMe=true")}
          data-testid="link-view-all-tasks"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => setLocation(`/maint?tab=work-orders&id=${task.id}`)}
            data-testid={`button-task-${task.id}`}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border
                       bg-card hover:border-primary/50 transition-colors text-left touch-target"
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                task.priority === 1
                  ? "bg-destructive"
                  : task.priority === 2
                    ? "bg-yellow-500"
                    : "bg-muted-foreground"
              )}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{task.title}</div>
              <div className="text-xs text-muted-foreground">
                {task.equipmentName || task.equipment?.name || "Unassigned equipment"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex-shrink-0">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CurrentVesselCard({ vessel }: { vessel: CurrentVesselSlot | undefined }) {
  if (!vessel) {
    return (
      <div
        className="rounded-lg border bg-card p-4"
        data-testid="card-current-vessel-empty"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Ship className="h-4 w-4" />
          No vessel assigned yet.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4" data-testid="card-current-vessel">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Ship className="h-3.5 w-3.5" /> Current Vessel
      </div>
      <div className="mt-1 text-base font-semibold" data-testid="text-current-vessel-name">
        {vessel.name}
      </div>
    </div>
  );
}

function ShiftStatusCard({ shift }: { shift: ShiftStatusSlot }) {
  const hours = Math.floor(shift.remainingMinutes / 60);
  const minutes = shift.remainingMinutes % 60;
  return (
    <div className="rounded-lg border bg-card p-4" data-testid="card-shift-status">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> My Shift
      </div>
      <div className="mt-1 text-base font-semibold">{shift.windowLabel}</div>
      <div className="mt-1 text-xs text-muted-foreground" data-testid="text-shift-remaining">
        {shift.label === "On duty"
          ? `${hours}h ${minutes}m remaining`
          : "Off duty"}
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${shift.progressPercent}%` }}
        />
      </div>
    </div>
  );
}

function ActiveAlertsCard({ alerts }: { alerts: ActiveAlertSlot[] }) {
  if (alerts.length === 0) {
    return (
      <div
        className="rounded-lg border bg-card p-4"
        data-testid="card-active-alerts-empty"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" /> Active Alerts
        </div>
        <div className="mt-2 text-sm text-muted-foreground">No active alerts.</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4" data-testid="card-active-alerts">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" /> Active Alerts
      </div>
      <ul className="mt-2 space-y-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className="flex items-start justify-between gap-2 text-sm"
            data-testid={`row-active-alert-${a.id}`}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{a.title}</div>
              {a.source && (
                <div className="truncate text-xs text-muted-foreground">{a.source}</div>
              )}
            </div>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
                a.severity === "critical" || a.severity === "high"
                  ? "bg-destructive/10 text-destructive"
                  : a.severity === "medium"
                    ? "bg-yellow-500/10 text-yellow-600"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {a.severity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SafetyNoticesCard({ notices }: { notices: SafetyNoticeSlot[] }) {
  if (notices.length === 0) {
    return (
      <div
        className="rounded-lg border bg-card p-4"
        data-testid="card-safety-notices-empty"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" /> Safety Notices
        </div>
        <div className="mt-2 text-sm text-muted-foreground">No safety notices.</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4" data-testid="card-safety-notices">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" /> Safety Notices
      </div>
      <ul className="mt-2 space-y-2">
        {notices.map((n) => (
          <li
            key={n.id}
            className="text-sm"
            data-testid={`row-safety-notice-${n.id}`}
          >
            <div className="truncate font-medium">{n.title}</div>
            {n.postedAt && (
              <div className="text-xs text-muted-foreground">
                {new Date(n.postedAt).toLocaleDateString()}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpcomingMaintenanceCard({
  items,
  onViewAll,
}: {
  items: UpcomingMaintenanceSlot[];
  onViewAll: () => void;
}) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border bg-card p-4"
        data-testid="card-upcoming-maintenance-empty"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" /> Upcoming Maintenance
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Nothing scheduled in the next 7 days.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4" data-testid="card-upcoming-maintenance">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" /> Upcoming Maintenance
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-primary hover:underline"
          data-testid="link-user-view-maintenance"
        >
          View schedule
        </button>
      </div>
      <ul className="mt-2 space-y-2">
        {items.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-2 text-sm"
            data-testid={`row-upcoming-maintenance-${m.id}`}
          >
            <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
            <span className="text-xs text-muted-foreground">
              {m.scheduledDate.toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AIFleetSummaryCard() {
  const [, setLocation] = useLocation();
  const { metrics, equipmentHealth, insightsSnapshot } = useDashboardSummary();

  const fleetHealth = metrics?.fleetHealth ?? 0;
  const openWorkOrders = metrics?.openWorkOrders ?? 0;
  const criticalEquipmentCount = (equipmentHealth ?? []).filter(
    (eq) => (eq.healthIndex ?? 100) < 40,
  ).length;

  const parts: string[] = [];
  if (fleetHealth >= 80) {
    parts.push("Fleet health is stable.");
  } else if (fleetHealth >= 60) {
    parts.push("Fleet health is below target — some equipment needs attention.");
  } else {
    parts.push(
      "Fleet health is degraded — multiple equipment items require immediate action.",
    );
  }
  if (criticalEquipmentCount > 0) {
    parts.push(
      `${criticalEquipmentCount} equipment item${criticalEquipmentCount > 1 ? "s" : ""} ${criticalEquipmentCount > 1 ? "are" : "is"} in critical condition.`,
    );
  }
  if (openWorkOrders > 0) {
    parts.push(`${openWorkOrders} work order${openWorkOrders > 1 ? "s" : ""} open.`);
  }
  if (insightsSnapshot?.summary) {
    parts.push(insightsSnapshot.summary);
  }
  if (parts.length <= 2) {
    parts.push("No anomalies detected in the last 24 hours.");
  }

  return (
    <section className="mb-6" data-testid="section-ai-fleet-summary">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        AI Summary
      </h2>
      <div
        className="ops-card ops-card-info p-4"
        data-testid="card-ai-fleet-summary"
      >
        <p
          className="text-sm leading-relaxed text-foreground"
          data-testid="text-ai-fleet-summary"
        >
          {parts.join(" ")}
        </p>
        <button
          type="button"
          onClick={() => setLocation("/maint?tab=equipment-intelligence")}
          className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
          data-testid="link-ai-fleet-summary-details"
        >
          View Equipment Intelligence <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </section>
  );
}

interface RecentActivityItem {
  id: string;
  time: string;
  message: string;
  type: "telemetry" | "work-order" | "prediction";
  severity?: "critical" | "warning" | "info";
}

type RecentActivityFilter = "all" | "work-order" | "telemetry" | "prediction";

const RECENT_ACTIVITY_FILTER_KEY = "arus:home:recent-activity-filter";

const RECENT_ACTIVITY_TABS: ReadonlyArray<{
  value: RecentActivityFilter;
  label: string;
  emptyMessage: string;
}> = [
  {
    value: "all",
    label: "All",
    emptyMessage: "No recent activity. Events will appear here as they occur.",
  },
  {
    value: "work-order",
    label: "Work Orders",
    emptyMessage: "No new work order activity in the last 24 hours.",
  },
  {
    value: "telemetry",
    label: "Alerts",
    emptyMessage: "No new alerts in the last 24 hours.",
  },
  {
    value: "prediction",
    label: "Equipment",
    emptyMessage: "No equipment health issues right now.",
  },
];

function RecentActivityFeed() {
  const { workOrders, equipmentHealth, operatingAlerts } = useDashboardSummary();
  const [filter, setFilter] = useState<RecentActivityFilter>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const stored = window.sessionStorage.getItem(RECENT_ACTIVITY_FILTER_KEY);
      if (
        stored === "all" ||
        stored === "work-order" ||
        stored === "telemetry" ||
        stored === "prediction"
      ) {
        return stored;
      }
    } catch {
      // ignore
    }
    return "all";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(RECENT_ACTIVITY_FILTER_KEY, filter);
    } catch {
      // ignore
    }
  }, [filter]);

  const items: RecentActivityItem[] = [];

  for (const wo of (workOrders ?? []).slice(0, 6)) {
    const created = wo.createdAt;
    if (!created) continue;
    const label =
      wo.status === "completed"
        ? "Completed"
        : wo.status === "in_progress"
          ? "Started"
          : "Created";
    items.push({
      id: `wo-${wo.id}`,
      time: created,
      message: `${label}: ${wo.title ?? wo.workOrderNumber ?? wo.id}`,
      type: "work-order",
      severity:
        wo.priority === 2 || wo.priority === "high" ? "warning" : "info",
    });
  }

  for (const alert of (operatingAlerts ?? []).slice(0, 4)) {
    if (!alert.createdAt) continue;
    items.push({
      id: `alert-${alert.id}`,
      time: alert.createdAt,
      message: `Alert: operating threshold exceeded${alert.equipmentId ? ` — ${alert.equipmentId}` : ""}`,
      type: "telemetry",
      severity: alert.severity === "critical" ? "critical" : "warning",
    });
  }

  for (const eq of (equipmentHealth ?? [])
    .filter((e) => (e.healthIndex ?? 100) < 40)
    .slice(0, 4)) {
    items.push({
      id: `eq-${eq.id}`,
      time: new Date().toISOString(),
      message: `Equipment health: ${eq.name ?? eq.id} at ${eq.healthIndex}%${eq.vesselName ? ` — ${eq.vesselName}` : ""}`,
      type: "prediction",
      severity: (eq.healthIndex ?? 100) < 30 ? "critical" : "warning",
    });
  }

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);
  const visible = filtered.slice(0, 12);
  const activeTab =
    RECENT_ACTIVITY_TABS.find((t) => t.value === filter) ?? RECENT_ACTIVITY_TABS[0];

  const typeDot: Record<RecentActivityItem["type"], string> = {
    telemetry: "bg-blue-500",
    "work-order": "bg-amber-500",
    prediction: "bg-purple-500",
  };
  const severityText: Record<NonNullable<RecentActivityItem["severity"]>, string> = {
    critical: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-foreground",
  };

  return (
    <section className="mb-6" data-testid="section-recent-activity">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recent Activity
      </h2>
      <div
        role="tablist"
        aria-label="Filter recent activity"
        className="mb-3 inline-flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        data-testid="tabs-recent-activity-filter"
      >
        {RECENT_ACTIVITY_TABS.map((tab) => {
          const isActive = tab.value === filter;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(tab.value)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`tab-recent-activity-${tab.value}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <div
          className="rounded-lg border bg-card p-4 text-center text-xs text-muted-foreground"
          data-testid="empty-recent-activity"
        >
          {activeTab.emptyMessage}
        </div>
      ) : (
        <div className="rounded-lg border bg-card px-4">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 border-b border-border/40 py-2.5 last:border-0"
              data-testid={`row-recent-activity-${item.id}`}
            >
              <div
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  typeDot[item.type],
                )}
              />
              <p
                className={cn(
                  "min-w-0 flex-1 text-sm",
                  item.severity ? severityText[item.severity] : "text-foreground",
                )}
              >
                {item.message}
              </p>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                {(() => {
                  try {
                    return formatDistanceToNow(new Date(item.time), {
                      addSuffix: true,
                    });
                  } catch {
                    return "Recently";
                  }
                })()}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function greetingForNow(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function UserPortalHome({
  role,
  roleLabel,
  onSwitchRole,
}: {
  role: string;
  roleLabel: string | undefined;
  onSwitchRole: () => void;
}) {
  const [, setLocation] = useLocation();
  const { attentionItems, sinceLastVisit } = useAttentionItems();
  const vm = useUserDashboardViewModel();
  const greeting = greetingForNow(new Date());

  return (
    <div
      className="ops-surface ops-safe-bottom min-h-screen pb-24 md:pb-6"
      data-testid="shell-user-portal"
    >
      <PageHeader
        title="ARUS"
        subtitle={roleLabel ?? "User Portal"}
        showHome={false}
        showBack={true}
        onBack={onSwitchRole}
      />

      <div className="mx-auto w-full max-w-3xl px-4 pt-3 md:px-6 lg:max-w-5xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="text-xs uppercase tracking-wide text-muted-foreground"
              data-testid="text-user-greeting-label"
            >
              {greeting},
            </div>
            <div
              className="truncate text-xl font-semibold text-foreground sm:text-2xl"
              data-testid="text-user-greeting-name"
            >
              {roleLabel ?? "Crew Member"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Stay safe out there.
            </div>
          </div>
          <SwitchPortalButton />
        </div>

        {attentionItems.length > 0 ? (
          <AttentionBanner items={attentionItems} className="mb-4" />
        ) : (
          <div
            className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3"
            data-testid="empty-attention"
          >
            <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <div className="text-sm font-medium">No active alerts</div>
              <div className="text-xs text-muted-foreground">
                We'll surface anything urgent here.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <CurrentVesselCard vessel={vm.currentVessel} />
          <ShiftStatusCard shift={vm.shiftStatus} />
        </div>

        <RoleTodayPanel roleId={role} />
        {sinceLastVisit && <SinceLastVisit data={sinceLastVisit} />}

        <MyTasks
          emptyState={
            <div
              className="mb-6 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3"
              data-testid="empty-my-tasks"
            >
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">You're all caught up</div>
                <div className="text-xs text-muted-foreground">
                  No open work orders assigned to you.
                </div>
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-3 mb-4">
          <ActiveAlertsCard alerts={vm.activeAlerts} />
          <SafetyNoticesCard notices={vm.safetyNotices} />
          <UpcomingMaintenanceCard
            items={vm.upcomingMaintenance}
            onViewAll={() => setLocation("/maint?tab=schedules")}
          />
        </div>

        <div
          className="mt-2 rounded-lg border border-dashed bg-card p-6 text-center"
          data-testid="card-user-feedback-cta"
        >
          <Flag className="h-6 w-6 text-primary mx-auto mb-2" />
          <h3 className="text-sm font-semibold mb-1">Spot something off?</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Submit feedback or flag a concern for the team.
          </p>
          <Button
            onClick={() => setLocation("/feedback")}
            data-testid="button-user-open-feedback"
          >
            Submit Feedback / Flag
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [role, setRole] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [quickWoOpen, setQuickWoOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { attentionItems, sinceLastVisit } = useAttentionItems();
  const roleConfig = role ? ROLES[role] : null;

  const { data: vessels } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
    enabled: isVesselRole(),
    staleTime: 5 * 60 * 1000,
  });
  const homeVesselId = isVesselRole() && vessels?.length ? vessels[0]?.id : undefined;

  useEffect(() => {
    if (role) {
      recordVisitTime();
    }
  }, [role]);

  // When no role is stored, route the user through the portal-login
  // landing page rather than the in-place RoleSelector. Portal-login
  // is the single canonical entry surface (Admin Portal / User Portal)
  // and writes the role hint via the nav-storage adapter — keeping
  // `/` reserved for the authenticated home experience.
  useEffect(() => {
    if (!role) {
      setLocation("/portal-login");
    }
  }, [role, setLocation]);

  const handleSelectRole = (roleId: string) => {
    localStorage.setItem(STORAGE_KEY, roleId);
    setRole(roleId);
  };

  // Retain the inline RoleSelector path as a fallback only if the
  // redirect hasn't committed yet (first paint). Wouter's setLocation
  // is synchronous in practice, so this renders for at most one frame.
  if (!role) {
    return <RoleSelector onSelect={handleSelectRole} />;
  }

  const portal = getPortalForRole(role);

  // User portal: re-skinned per UI Align Phase 4 (preview panel 2 /
  // mobile panel 9). Cards bind to the view-model in
  // client/src/application/user-dashboard. The page renders only —
  // it does not call useQuery directly and contains no RBAC checks.
  // Empty-state ids `empty-attention` / `empty-my-tasks` are
  // preserved verbatim because other surfaces and tests key off them.
  if (portal === "user") {
    return <UserPortalHome role={role} roleLabel={roleConfig?.label} onSwitchRole={() => {
      localStorage.removeItem(STORAGE_KEY);
      setRole(null);
    }} />;
  }

  // Admin portal: anchor the home-grid to the same 5 categories the
  // BottomNav and policy surface, instead of the legacy 8-group dump.
  // UI Align Phase 3 + 3B: re-skinned as the dark operational
  // command-center (preview panel 2). KPI counts reuse the existing
  // `useAttentionItems` query (`/api/home/attention-summary`) — no
  // new backend endpoints. The 5 module shortcut tiles are sourced
  // from `getPrimaryCategoriesForRole(role)` (single policy source).
  const policyCategoryIds = getPrimaryCategoriesForRole(role).map((c) => c.id);
  const pinnedGroupIds =
    policyCategoryIds.length > 0
      ? policyCategoryIds
      : (roleConfig?.pinnedGroups ?? homePageGroups.map((g) => g.id));
  const pinnedGroups = pinnedGroupIds
    .map((id) => homePageGroups.find((g) => g.id === id))
    .filter((g): g is HomePageGroup => g !== undefined);
  const otherGroups = homePageGroups.filter((g) => !pinnedGroupIds.includes(g.id));

  const kpiOverdueWO = attentionItems.find((i) => i.label === "Overdue work orders")?.count ?? 0;
  const kpiCriticalAlerts = attentionItems.find((i) => i.label === "Unacknowledged alerts")?.count ?? 0;
  const kpiAtRisk = attentionItems.find((i) => i.label === "High-risk equipment")?.count ?? 0;
  const elevatedRisk = kpiCriticalAlerts > 0 || kpiAtRisk > 0 || kpiOverdueWO >= 5;

  return (
    <div
      className="ops-surface ops-safe-bottom min-h-screen pb-24 md:pb-6"
      data-testid="shell-admin-command-center"
    >
      <PageHeader
        title="Command Center"
        subtitle={roleConfig?.label ?? "System Admin"}
        showHome={false}
        showBack={true}
        onBack={() => {
          localStorage.removeItem(STORAGE_KEY);
          setRole(null);
        }}
      />

      <PendingApprovalsBanner />

      <div className="mx-auto w-full max-w-3xl px-4 pt-3 md:px-6 lg:max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          {elevatedRisk ? (
            <OpsStatusPill
              label="ELEVATED RISK"
              severity="warning"
              testId="pill-elevated-risk"
            />
          ) : (
            <OpsStatusPill
              label="NOMINAL"
              severity="success"
              testId="pill-nominal-risk"
            />
          )}
          <SwitchPortalButton />
        </div>

        {/* Mobile-first 2x2 KPI grid → tablet/desktop expand to 4 across.
            All values come from the existing attention-summary query. */}
        <div
          className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"
          data-testid="grid-admin-kpis"
        >
          <OpsMetricCard
            label="Critical Alerts"
            value={kpiCriticalAlerts}
            severity={kpiCriticalAlerts > 0 ? "critical" : "neutral"}
            icon={<AlertTriangle className="h-4 w-4" />}
            testId="kpi-critical-alerts"
          />
          <OpsMetricCard
            label="Work Orders"
            value={kpiOverdueWO}
            severity={kpiOverdueWO > 0 ? "warning" : "info"}
            hint="Needs action"
            icon={<ClipboardList className="h-4 w-4" />}
            testId="kpi-work-orders"
          />
          <OpsMetricCard
            label="At-Risk Assets"
            value={kpiAtRisk}
            severity={kpiAtRisk > 0 ? "critical" : "neutral"}
            icon={<Activity className="h-4 w-4" />}
            testId="kpi-at-risk-assets"
          />
          <OpsMetricCard
            label="Crew Issues"
            value={sinceLastVisit?.newAlerts ?? 0}
            severity={(sinceLastVisit?.newAlerts ?? 0) > 0 ? "warning" : "neutral"}
            icon={<Users className="h-4 w-4" />}
            testId="kpi-crew-issues"
          />
        </div>

        {/* AI Recommendation strip — links into the existing AI hub. */}
        <button
          type="button"
          onClick={() => setLocation("/findings")}
          className="ops-card ops-card-info mb-4 flex w-full items-center gap-3 p-4 text-left"
          data-testid="card-ai-recommendation"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide text-sky-300/80">
              AI Recommendation
            </div>
            <div className="truncate text-sm font-semibold text-foreground">
              Open the AI copilot for prioritised actions
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Critical Attention list — reuses AttentionBanner items. */}
        {attentionItems.length > 0 && (
          <section className="mb-4" data-testid="section-critical-attention">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Critical Attention
              </h2>
              <button
                type="button"
                onClick={() => setLocation("/attention-inbox")}
                className="text-xs text-sky-300 hover:underline"
                data-testid="link-view-all-attention"
              >
                View all
              </button>
            </div>
            <ul className="space-y-2">
              {attentionItems.slice(0, 4).map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <button
                    type="button"
                    onClick={() => setLocation(item.href)}
                    className={cn(
                      "ops-card flex w-full items-center justify-between gap-3 p-3 text-left",
                      item.severity === "critical" && "ops-card-critical",
                      item.severity === "warning" && "ops-card-warning",
                    )}
                    data-testid={`row-critical-attention-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {item.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <RoleTodayPanel roleId={role} />

        <WorkflowCommandCenter roleId={role} />

        {roleConfig && <QuickActions actions={roleConfig.quickActions} className="mb-6" />}

        {sinceLastVisit && <SinceLastVisit data={sinceLastVisit} />}

        <MyTasks />

        <AIFleetSummaryCard />

        <RecentActivityFeed />

        {/* Module shortcuts — the 5 policy categories. Mobile: 2-col,
            tablet: 3-col, desktop: 5-col so the row matches the
            policy and BottomNav surface 1:1. */}
        <section className="mb-6" data-testid="section-module-shortcuts">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Modules
          </h2>
          <div
            className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
            data-testid="grid-module-shortcuts"
          >
            {pinnedGroups.map((group) => {
              const first = group.items[0];
              if (!first) return null;
              return (
                <NavigationCard
                  key={group.id}
                  name={group.name}
                  href={first.href}
                  icon={first.icon}
                  description={first.description}
                />
              );
            })}
          </div>
        </section>

        {/* Pinned-group detail (each group's items as a sub-grid). */}
        <div className="space-y-6">
          {pinnedGroups.map((group) => (
            <div key={group.id}>
              <h2 className="mb-3 text-sm font-semibold text-foreground">{group.name}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((item) => (
                  <NavigationCard
                    key={item.href}
                    name={item.name}
                    href={item.href}
                    icon={item.icon}
                    description={item.description}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {otherGroups.length > 0 && (
          <details className="mt-8">
            <summary
              className="mb-3 cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground"
              data-testid="button-more-categories"
            >
              More categories ({otherGroups.length})
            </summary>
            <div className="mt-3 space-y-6">
              {otherGroups.map((group) => (
                <div key={group.id}>
                  <h2 className="mb-3 text-sm font-semibold text-foreground">{group.name}</h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {group.items.map((item) => (
                      <NavigationCard
                        key={item.href}
                        name={item.name}
                        href={item.href}
                        icon={item.icon}
                        description={item.description}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <button
        onClick={() => setQuickWoOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-40"
        aria-label="Quick Work Order"
        data-testid="button-quick-wo"
      >
        <Plus className="h-6 w-6" />
      </button>

      <QuickWorkOrderSheet
        open={quickWoOpen}
        onClose={() => setQuickWoOpen(false)}
        vesselId={homeVesselId}
      />
    </div>
  );
}
