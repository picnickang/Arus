/**
 * UI Align Phase 6 — Maintenance Module Overview (panel 5).
 *
 * Thin overview wrapper: WO status chips with live counts, recent
 * work-order list, "New Work Order" CTA. All deep-link routes
 * (/work-orders, /maintenance-schedules, /maintenance-templates,
 * /equipment-intelligence) continue to work independently — this
 * page only adds the top summary layer.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Wrench,
  Calendar,
  FileSpreadsheet,
  Brain,
  Plus,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkOrderSummary {
  total?: number;
  open?: number;
  openCount?: number;
  inProgress?: number;
  inProgressCount?: number;
  planned?: number;
  plannedCount?: number;
  completed?: number;
  completedCount?: number;
  overdue?: number;
  overdueCount?: number;
}

interface WorkOrderRow {
  id: string;
  workOrderNumber?: string | null;
  title?: string | null;
  vesselName?: string | null;
  priority?: string | null;
  status?: string | null;
  scheduledDate?: string | null;
  dueDate?: string | null;
}

const STATUS_TONE = {
  open: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  planned: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  overdue: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
} as const;

const PRIORITY_TONE: Record<string, string> = {
  high: "text-rose-600",
  critical: "text-rose-600",
  medium: "text-amber-600",
  low: "text-slate-500",
};

function statusTone(status: string | null | undefined): string {
  if (status && status in STATUS_TONE) {
    return STATUS_TONE[status as keyof typeof STATUS_TONE];
  }
  return STATUS_TONE.planned;
}

function StatusChip({
  label,
  count,
  tone,
  testId,
}: {
  label: string;
  count: number;
  tone: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-lg border bg-card p-3 flex items-center justify-between"
      data-testid={testId}
    >
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {label}
        </div>
        <div className="text-2xl font-bold mt-0.5">{count}</div>
      </div>
      <Badge className={tone} variant="outline">
        {label}
      </Badge>
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function MaintenanceHub() {
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery<WorkOrderSummary>({
    queryKey: ["/api/work-orders/summary"],
    staleTime: 60_000,
  });

  const {
    data: workOrders = [],
    isLoading: woLoading,
    error: woError,
  } = useQuery<WorkOrderRow[]>({
    queryKey: ["/api/work-orders"],
    staleTime: 60_000,
  });

  const openCount = summary?.openCount ?? summary?.open ?? 0;
  const inProgressCount = summary?.inProgressCount ?? summary?.inProgress ?? 0;
  const plannedCount = summary?.plannedCount ?? summary?.planned ?? 0;
  const completedCount = summary?.completedCount ?? summary?.completed ?? 0;
  const overdueCount = summary?.overdueCount ?? summary?.overdue ?? 0;

  const recent = workOrders.slice(0, 10);

  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="maintenance-hub-overview">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Maintenance — Work Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Active work orders, schedules, and predictive insights across the fleet.
          </p>
        </div>
        <Link href="/maint?tab=work-orders&action=create">
          <Button data-testid="button-new-work-order" className="gap-2">
            <Plus className="h-4 w-4" /> New Work Order
          </Button>
        </Link>
      </div>

      {summaryError && (
        <div
          className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm"
          data-testid="maintenance-summary-error"
        >
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <span>Could not load work-order summary. Counts may be incomplete.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="maintenance-status-chips">
        {summaryLoading ? (
          [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)
        ) : (
          <>
            <StatusChip
              label="Open"
              count={openCount}
              tone={statusTone("open")}
              testId="status-chip-open"
            />
            <StatusChip
              label="In Progress"
              count={inProgressCount}
              tone={statusTone("in_progress")}
              testId="status-chip-in-progress"
            />
            <StatusChip
              label="Planned"
              count={plannedCount}
              tone={statusTone("planned")}
              testId="status-chip-planned"
            />
            <StatusChip
              label="Completed"
              count={completedCount}
              tone={statusTone("completed")}
              testId="status-chip-completed"
            />
            <StatusChip
              label="Overdue"
              count={overdueCount}
              tone={statusTone("overdue")}
              testId="status-chip-overdue"
            />
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h2 className="text-sm font-semibold">Recent work orders</h2>
            <Link href="/maint?tab=work-orders">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                data-testid="button-view-all-work-orders"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {woLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : woError ? (
            <div
              className="p-6 text-sm text-muted-foreground"
              data-testid="maintenance-list-error"
            >
              Could not load work orders. Try again shortly.
            </div>
          ) : recent.length === 0 ? (
            <div
              className="p-6 text-sm text-muted-foreground"
              data-testid="empty-work-orders"
            >
              No work orders yet. Create one to get started.
            </div>
          ) : (
            <ul className="divide-y" data-testid="list-recent-work-orders">
              {recent.map((wo) => {
                const tone = statusTone(wo.status);
                const priorityTone = wo.priority ? PRIORITY_TONE[wo.priority] ?? "" : "";
                return (
                  <li key={wo.id} data-testid={`row-work-order-${wo.id}`}>
                    <Link
                      href={`/work-orders?id=${encodeURIComponent(wo.id)}`}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-accent/40 transition-colors"
                    >
                      <div className="text-xs font-mono text-muted-foreground w-20 shrink-0">
                        {wo.workOrderNumber ?? wo.id.slice(0, 8)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {wo.title ?? "Untitled work order"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {wo.vesselName ?? "—"}
                        </div>
                      </div>
                      {wo.priority && (
                        <span className={`text-xs font-semibold uppercase ${priorityTone}`}>
                          {wo.priority}
                        </span>
                      )}
                      {wo.status && (
                        <Badge variant="outline" className={tone}>
                          {wo.status.replace(/_/g, " ")}
                        </Badge>
                      )}
                      <div className="text-xs text-muted-foreground w-24 text-right shrink-0">
                        {formatDate(wo.scheduledDate ?? wo.dueDate ?? null)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Jump to</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="maintenance-jump-grid">
          <JumpCard href="/maint?tab=work-orders" icon={Wrench} label="Work Orders" testId="jump-work-orders" />
          <JumpCard href="/maint?tab=schedules" icon={Calendar} label="Schedules" testId="jump-schedules" />
          <JumpCard
            href="/maint?tab=templates"
            icon={FileSpreadsheet}
            label="Templates"
            testId="jump-templates"
          />
          <JumpCard
            href="/maint?tab=equipment-intelligence"
            icon={Brain}
            label="Equipment Intelligence"
            testId="jump-equipment-intelligence"
          />
        </div>
      </div>
    </div>
  );
}

function JumpCard({
  href,
  icon: Icon,
  label,
  testId,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  testId: string;
}) {
  return (
    <Link href={href}>
      <Card
        className="hover:bg-accent/40 transition-colors cursor-pointer"
        data-testid={testId}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="h-5 w-5 text-primary shrink-0" />
          <span className="text-sm font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
