import { useRef } from "react";
import { useLocation } from "wouter";
import {
  Users,
  UserCheck,
  PlaneTakeoff,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Plus,
  FileUp,
  ClipboardCheck,
  UserCog,
  ShieldAlert,
  CalendarCheck,
  Clock,
  Shield,
  ListChecks,
  Network,
} from "lucide-react";

export type AttentionUrgency = "critical" | "warning" | "notice";

export interface CrewAttentionItem {
  id: string;
  kind: "cert" | "doc" | "task";
  crewName: string;
  label: string;
  daysUntilExpiry: number;
  urgency: AttentionUrgency;
  href: string;
}

interface SummaryCounts {
  current: number;
  onDuty: number;
  onLeave: number;
  /** Combined cert/doc + task feed size (drives the "Needs attention" tile). */
  attention: number;
  /** Cert/doc-only count for the "Review alerts" CTA → /certificates. */
  complianceAttention: number;
  former: number;
  taskActive: number;
  taskOverdue: number;
}

interface CrewRegistryLandingProps {
  counts: SummaryCounts;
  attentionItems: CrewAttentionItem[];
  expiryLoading: boolean;
  canCreate: boolean;
  canManageDocs: boolean;
  isAdmin: boolean;
  canUseSafety: boolean;
  canViewTasks: boolean;
  onOpenCurrent: (status?: "all" | "on_duty" | "off_duty") => void;
  onOpenFormer: () => void;
  onOpenOrgChart: () => void;
  onOpenTasks: () => void;
  onAddCrew: () => void;
  onOpenAccess: () => void;
  onOpenSafety: () => void;
}

const URGENCY_TONE: Record<AttentionUrgency, string> = {
  critical: "bg-rose-500/15 text-rose-300",
  warning: "bg-amber-500/15 text-amber-300",
  notice: "bg-sky-500/15 text-sky-300",
};

function CounterTile({
  icon,
  value,
  label,
  tone,
  onClick,
  testId,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  tone: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ops-card flex items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:border-sky-500/40"
      data-testid={testId}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-white">{value}</p>
        <p className="mt-1 text-sm font-medium text-slate-200">{label}</p>
      </div>
    </button>
  );
}

function ActionTile({
  icon,
  label,
  hint,
  onClick,
  enabled = true,
  badgeCount,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick?: () => void;
  enabled?: boolean;
  badgeCount?: number | undefined;
  testId: string;
}) {
  if (!enabled) {
    return (
      <div
        className="ops-card flex flex-col items-center gap-1 rounded-2xl p-3 text-center opacity-50"
        data-testid={testId}
      >
        {icon}
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-[10px] text-slate-600">No access</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="ops-card relative flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition-colors hover:border-sky-500/40"
      data-testid={testId}
    >
      {icon}
      <span className="text-xs font-medium text-white">{label}</span>
      <span className="text-[10px] text-slate-500">{hint}</span>
      {typeof badgeCount === "number" && badgeCount > 0 && (
        <span
          className="absolute right-2 top-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500/90 px-1 text-[10px] font-semibold text-white"
          data-testid={`${testId}-badge`}
        >
          {badgeCount}
        </span>
      )}
    </button>
  );
}

function Cluster({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={testId}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function AttentionRow({
  item,
  onOpen,
}: {
  item: CrewAttentionItem;
  onOpen: (item: CrewAttentionItem) => void;
}) {
  const days = item.daysUntilExpiry;
  const daysLabel =
    item.kind === "task"
      ? days < 0
        ? `Overdue ${Math.abs(days)}d`
        : "Blocked"
      : days < 0
        ? `Expired ${Math.abs(days)}d ago`
        : `${days}d left`;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="ops-card flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:border-sky-500/40"
      data-testid={`attention-row-${item.id}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${URGENCY_TONE[item.urgency]}`}
      >
        {item.kind === "cert" ? (
          <Shield className="h-4 w-4" />
        ) : item.kind === "task" ? (
          <ListChecks className="h-4 w-4" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{item.crewName}</p>
        <p className="truncate text-xs text-slate-400">{item.label}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${URGENCY_TONE[item.urgency]}`}
      >
        {daysLabel}
      </span>
    </button>
  );
}

export function CrewRegistryLanding({
  counts,
  attentionItems,
  expiryLoading,
  canCreate,
  canManageDocs,
  isAdmin,
  canUseSafety,
  canViewTasks,
  onOpenCurrent,
  onOpenFormer,
  onOpenOrgChart,
  onOpenTasks,
  onAddCrew,
  onOpenAccess,
  onOpenSafety,
}: CrewRegistryLandingProps) {
  const [, setLocation] = useLocation();
  // Every item (incl. tasks via `/crew-management?taskId=…`) carries a real
  // href, so a row click deep-links straight to the relevant detail.
  const openAttention = (item: CrewAttentionItem) => {
    setLocation(item.href);
  };
  const attentionValue = expiryLoading ? "…" : counts.attention;
  const showAdminCluster = isAdmin || canUseSafety;
  const attentionRef = useRef<HTMLDivElement>(null);
  const scrollToAttention = () =>
    attentionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const counters = (
    <div className="grid grid-cols-2 gap-3" key="counters">
      <CounterTile
        icon={<Users className="h-5 w-5 text-sky-300" />}
        value={counts.current}
        label="Current"
        tone="bg-sky-500/15"
        onClick={() => onOpenCurrent("all")}
        testId="tile-current-count"
      />
      <CounterTile
        icon={<UserCheck className="h-5 w-5 text-emerald-300" />}
        value={counts.onDuty}
        label="On duty"
        tone="bg-emerald-500/15"
        onClick={() => onOpenCurrent("on_duty")}
        testId="tile-onduty-count"
      />
      <CounterTile
        icon={<PlaneTakeoff className="h-5 w-5 text-amber-300" />}
        value={counts.onLeave}
        label="On leave"
        tone="bg-amber-500/15"
        onClick={() => onOpenCurrent("off_duty")}
        testId="tile-onleave-count"
      />
      <CounterTile
        icon={<AlertTriangle className="h-5 w-5 text-rose-300" />}
        value={attentionValue}
        label="Needs attention"
        tone="bg-rose-500/15"
        onClick={scrollToAttention}
        testId="tile-attention-count"
      />
    </div>
  );

  const rosterBlock = (
    <div className="space-y-2" key="roster">
      <button
        type="button"
        onClick={() => onOpenCurrent("all")}
        className="ops-card flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:border-sky-500/40"
        data-testid="card-open-current"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15">
          <Users className="h-5 w-5 text-sky-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Open current roster</p>
          <p className="text-xs text-slate-400">{counts.current} active • sort by role or vessel</p>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </button>
      {canViewTasks && (
        <button
          type="button"
          onClick={onOpenTasks}
          className="ops-card flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:border-sky-500/40"
          data-testid="card-open-tasks"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15">
            <ListChecks className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Open tasks</p>
            <p className="text-xs text-slate-400" data-testid="text-task-tile-counts">
              {counts.taskActive} active
              {counts.taskOverdue > 0 ? ` • ${counts.taskOverdue} overdue` : ""}
            </p>
          </div>
          {counts.taskOverdue > 0 && (
            <span
              className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500/90 px-1 text-[10px] font-semibold text-white"
              data-testid="badge-task-overdue"
            >
              {counts.taskOverdue}
            </span>
          )}
        </button>
      )}
      <button
        type="button"
        onClick={onOpenOrgChart}
        className="ops-card flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:border-sky-500/40"
        data-testid="card-open-orgchart"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15">
          <Network className="h-5 w-5 text-violet-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Org chart</p>
          <p className="text-xs text-slate-400">Reporting lines &amp; chain of command</p>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </button>
      <button
        type="button"
        onClick={onOpenFormer}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-200"
        data-testid="link-open-former"
      >
        View former crew ({counts.former}) <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );

  const hasComplianceItems = attentionItems.some((item) => item.kind !== "task");
  const attention = (
    <div key="attention" ref={attentionRef}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Needs attention
        </p>
        {!expiryLoading && attentionItems.length > 0 && (
          <button
            type="button"
            onClick={() => (hasComplianceItems ? setLocation("/logs/compliance") : onOpenTasks())}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
            data-testid="button-attention-view-all"
          >
            View all <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {expiryLoading ? (
        <div
          className="ops-card rounded-2xl p-4 text-sm text-slate-400"
          data-testid="attention-loading"
        >
          Checking what needs attention…
        </div>
      ) : attentionItems.length === 0 ? (
        <div
          className="ops-card rounded-2xl p-4 text-sm text-slate-400"
          data-testid="attention-empty"
        >
          Nothing needs your attention right now.
        </div>
      ) : (
        <div className="space-y-2" data-testid="attention-list">
          {attentionItems.slice(0, 6).map((item) => (
            <AttentionRow key={item.id} item={item} onOpen={openAttention} />
          ))}
        </div>
      )}
    </div>
  );

  const crewCluster = (
    <Cluster title="Crew" testId="cluster-crew" key="crew">
      <ActionTile
        icon={<Plus className="h-5 w-5 text-sky-300" />}
        label="Add crew"
        hint="New profile"
        onClick={onAddCrew}
        enabled={canCreate}
        testId="action-add-crew"
      />
      <ActionTile
        icon={<FileUp className="h-5 w-5 text-emerald-300" />}
        label="Upload docs"
        hint="Pick a crew member"
        onClick={() => onOpenCurrent("all")}
        enabled={canManageDocs}
        testId="action-upload-docs"
      />
      <ActionTile
        icon={<ClipboardCheck className="h-5 w-5 text-amber-300" />}
        label="Review alerts"
        hint="Expiring docs"
        onClick={() => setLocation("/certificates")}
        badgeCount={expiryLoading ? undefined : counts.complianceAttention}
        testId="action-review-alerts"
      />
    </Cluster>
  );

  const adminCluster = showAdminCluster ? (
    <Cluster title="Admin" testId="cluster-admin" key="admin">
      {isAdmin && (
        <ActionTile
          icon={<UserCog className="h-5 w-5 text-sky-300" />}
          label="Access & Permissions"
          hint="Accounts, roles & dashboards"
          onClick={onOpenAccess}
          testId="action-access-permissions"
        />
      )}
      {canUseSafety && (
        <ActionTile
          icon={<ShieldAlert className="h-5 w-5 text-rose-300" />}
          label="Safety"
          hint="Bulletins & alarms"
          onClick={onOpenSafety}
          testId="action-safety"
        />
      )}
    </Cluster>
  ) : null;

  const gotoCluster = (
    <Cluster title="Go to" testId="cluster-goto" key="goto">
      <ActionTile
        icon={<CalendarCheck className="h-5 w-5 text-sky-300" />}
        label="Scheduling"
        hint="SmartPAL"
        onClick={() => setLocation("/crew-scheduler")}
        testId="action-scheduling"
      />
      <ActionTile
        icon={<Clock className="h-5 w-5 text-emerald-300" />}
        label="Hours of Rest"
        hint="STCW"
        onClick={() => setLocation("/hours-of-rest")}
        testId="action-hours-of-rest"
      />
      <ActionTile
        icon={<Shield className="h-5 w-5 text-amber-300" />}
        label="Compliance"
        hint="Certs & docs"
        onClick={() => setLocation("/logs/compliance")}
        testId="action-compliance"
      />
    </Cluster>
  );

  const clusterMap: Record<string, React.ReactNode> = {
    crew: crewCluster,
    admin: adminCluster,
    goto: gotoCluster,
  };
  const clusterOrder = isAdmin ? ["admin", "crew", "goto"] : ["crew", "admin", "goto"];
  const fastActions = (
    <div className="space-y-4" key="actions" data-testid="fast-actions">
      {clusterOrder.map((id) => clusterMap[id]).filter(Boolean)}
    </div>
  );

  // Role-aware ordering: admins see the action clusters promoted above the
  // attention list; everyone else leads with what needs attention.
  const tail = isAdmin ? [fastActions, attention] : [attention, fastActions];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Crew</h2>
        <p className="text-sm text-slate-400">
          Your roster, compliance, and crew tools in one place.
        </p>
      </div>
      {counters}
      {rosterBlock}
      {tail}
    </div>
  );
}
