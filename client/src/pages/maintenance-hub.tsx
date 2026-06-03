/**
 * Maintenance hub overview (Figma 1:1418).
 *
 * Mobile-first operational overview: a 2x2 grid of live stat tiles
 * (Active WOs, Equipment Alerts, Due Inspections, Preventive Tasks)
 * over a "Maintenance Modules" list that deep-links to the existing
 * canonical pages. Every count is backed by a real endpoint — no
 * mock data. The page owns no RBAC; hub gating lives in
 * role-navigation-policy.ts and the route guards.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  AlertTriangle,
  ShieldCheck,
  CalendarClock,
  Brain,
  Boxes,
  Gauge,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkOrderSummary {
  total?: number;
  open?: number;
  openCount?: number;
  overdue?: number;
  overdueCount?: number;
}

interface AlertRow {
  acknowledged?: boolean | null;
  isAcknowledged?: boolean | null;
}

interface PdmDashboard {
  kpis?: { fleetHealthScore?: number | null } | null;
}

/**
 * Normalise a list-shaped API response to its item count. Tolerates a
 * bare array or a common envelope (`{ data | findings | items: [] }`)
 * so a backend shape tweak does not silently zero a tile.
 */
function countItems(data: unknown): number {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (data && typeof data === "object") {
    for (const key of ["data", "findings", "items", "results"] as const) {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value.length;
      }
    }
  }
  return 0;
}

function StatTile({
  icon: Icon,
  label,
  value,
  loading,
  error,
  tone,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  loading: boolean;
  error: boolean;
  tone: string;
  testId: string;
}) {
  return (
    <div className="ops-card p-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        {loading ? (
          <Skeleton className="h-8 w-10" />
        ) : (
          <span
            className="text-3xl font-bold leading-none tabular-nums"
            data-testid={`${testId}-value`}
          >
            {error ? "—" : value}
          </span>
        )}
      </div>
      <div className="mt-3 text-sm font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function ModuleRow({
  icon: Icon,
  href,
  title,
  subtitle,
  meta,
  metaLoading,
  testId,
}: {
  icon: LucideIcon;
  href: string;
  title: string;
  subtitle: string;
  meta?: string | null;
  metaLoading?: boolean;
  testId: string;
}) {
  return (
    <Link href={href}>
      <div
        className="ops-card flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-white/5"
        data-testid={testId}
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {metaLoading ? (
          <Skeleton className="h-5 w-10" />
        ) : meta != null ? (
          <span
            className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground"
            data-testid={`${testId}-meta`}
          >
            {meta}
          </span>
        ) : null}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}

export default function MaintenanceHub() {
  const summaryQ = useQuery<WorkOrderSummary>({
    queryKey: ["/api/work-orders/summary"],
    staleTime: 60_000,
  });
  const alertsQ = useQuery<AlertRow[]>({
    queryKey: ["/api/alerts"],
    staleTime: 60_000,
  });
  const inspectionsQ = useQuery<unknown>({
    queryKey: ["/api/compliance/findings", { status: "open" }],
    staleTime: 60_000,
  });
  const schedulesQ = useQuery<unknown>({
    queryKey: ["/api/maintenance-schedules"],
    staleTime: 60_000,
  });
  const pdmQ = useQuery<PdmDashboard>({
    queryKey: ["/api/pdm/dashboard"],
    staleTime: 60_000,
  });

  const activeWos = summaryQ.data?.open ?? summaryQ.data?.openCount ?? 0;
  const equipmentAlerts = Array.isArray(alertsQ.data)
    ? alertsQ.data.filter((a) => !(a.acknowledged ?? a.isAcknowledged)).length
    : 0;
  const dueInspections = countItems(inspectionsQ.data);
  const preventiveTasks = countItems(schedulesQ.data);

  const rawHealth = pdmQ.data?.kpis?.fleetHealthScore;
  const healthPct =
    pdmQ.isLoading || pdmQ.isError || rawHealth == null
      ? null
      : `${Math.round(rawHealth)}%`;

  const anyError =
    summaryQ.isError ||
    alertsQ.isError ||
    inspectionsQ.isError ||
    schedulesQ.isError ||
    pdmQ.isError;

  return (
    <div
      className="ops-surface ops-safe-bottom min-h-screen px-4 pt-5 md:px-6 lg:px-8"
      data-testid="shell-maintenance-hub"
    >
      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl">
        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-maintenance-title">
            Maintenance
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Overview &amp; operational insights</p>
        </header>

        {anyError && (
          <div
            className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm"
            data-testid="maintenance-data-error"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
            <span>Some live counts could not be loaded and may be incomplete.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3" data-testid="grid-maintenance-stats">
          <StatTile
            icon={ClipboardList}
            label="Active WOs"
            value={activeWos}
            loading={summaryQ.isLoading}
            error={summaryQ.isError}
            tone="bg-blue-500/15 text-blue-400"
            testId="tile-active-wos"
          />
          <StatTile
            icon={AlertTriangle}
            label="Equipment Alerts"
            value={equipmentAlerts}
            loading={alertsQ.isLoading}
            error={alertsQ.isError}
            tone="bg-rose-500/15 text-rose-400"
            testId="tile-equipment-alerts"
          />
          <StatTile
            icon={ShieldCheck}
            label="Due Inspections"
            value={dueInspections}
            loading={inspectionsQ.isLoading}
            error={inspectionsQ.isError}
            tone="bg-amber-500/15 text-amber-400"
            testId="tile-due-inspections"
          />
          <StatTile
            icon={CalendarClock}
            label="Preventive Tasks"
            value={preventiveTasks}
            loading={schedulesQ.isLoading}
            error={schedulesQ.isError}
            tone="bg-emerald-500/15 text-emerald-400"
            testId="tile-preventive-tasks"
          />
        </div>

        <section className="mt-7">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Maintenance Modules
          </h2>
          <div className="space-y-3" data-testid="list-maintenance-modules">
            <ModuleRow
              icon={Gauge}
              href="/pdm-platform"
              title="Overview"
              subtitle="Fleet health &amp; predictive insights"
              meta={healthPct}
              metaLoading={pdmQ.isLoading}
              testId="module-overview"
            />
            <ModuleRow
              icon={Boxes}
              href="/equipment"
              title="Equipment / Assets"
              subtitle="Browse equipment and assets"
              testId="module-equipment"
            />
            <ModuleRow
              icon={Brain}
              href="/equipment-intelligence"
              title="Equipment Intelligence"
              subtitle="AI health, predictions &amp; recommendations"
              testId="module-equipment-intelligence"
            />
            <ModuleRow
              icon={ClipboardList}
              href="/work-orders"
              title="Work Orders"
              subtitle="Active and completed jobs"
              meta={summaryQ.isError ? null : String(activeWos)}
              metaLoading={summaryQ.isLoading}
              testId="module-work-orders"
            />
            <ModuleRow
              icon={CalendarClock}
              href="/maintenance"
              title="Preventive Maintenance"
              subtitle="Scheduled maintenance tasks"
              meta={schedulesQ.isError ? null : String(preventiveTasks)}
              metaLoading={schedulesQ.isLoading}
              testId="module-preventive"
            />
            <ModuleRow
              icon={ShieldCheck}
              href="/logs/compliance"
              title="Inspections"
              subtitle="Compliance findings and checks"
              meta={inspectionsQ.isError ? null : String(dueInspections)}
              metaLoading={inspectionsQ.isLoading}
              testId="module-inspections"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
