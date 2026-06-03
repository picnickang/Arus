import { useLocation } from "wouter";
import {
  Users,
  UserX,
  FileWarning,
  BellRing,
  ArrowRight,
  Plus,
  FileUp,
  ClipboardCheck,
} from "lucide-react";

interface SummaryCounts {
  current: number;
  former: number;
  expiring: number;
  alerts: number;
}

interface CrewRegistryLandingProps {
  counts: SummaryCounts;
  expiryLoading: boolean;
  canCreate: boolean;
  canManageDocs: boolean;
  onOpenCurrent: () => void;
  onOpenFormer: () => void;
  onAddCrew: () => void;
  onReviewAlerts: () => void;
}

function SummaryTile({
  icon,
  value,
  label,
  hint,
  tone,
  testId,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  hint: string;
  tone: string;
  testId: string;
}) {
  return (
    <div className="ops-card flex items-center gap-3 rounded-2xl p-3" data-testid={testId}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-white">{value}</p>
        <p className="mt-1 text-sm font-medium text-slate-200">{label}</p>
        <p className="truncate text-[11px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export function CrewRegistryLanding({
  counts,
  expiryLoading,
  canCreate,
  canManageDocs,
  onOpenCurrent,
  onOpenFormer,
  onAddCrew,
  onReviewAlerts,
}: CrewRegistryLandingProps) {
  const [, setLocation] = useLocation();
  const expiryValue = expiryLoading ? "…" : counts.expiring;
  const alertsValue = expiryLoading ? "…" : counts.alerts;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Crew Management</h2>
        <p className="text-sm text-slate-400">Choose crew status first, then manage rosters.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryTile
          icon={<Users className="h-5 w-5 text-sky-300" />}
          value={counts.current}
          label="Current"
          hint="At sea / assigned"
          tone="bg-sky-500/15"
          testId="tile-current-count"
        />
        <SummaryTile
          icon={<UserX className="h-5 w-5 text-slate-300" />}
          value={counts.former}
          label="Former"
          hint="Archived records"
          tone="bg-white/[0.06]"
          testId="tile-former-count"
        />
        <SummaryTile
          icon={<FileWarning className="h-5 w-5 text-amber-300" />}
          value={expiryValue}
          label="Expiring"
          hint="Docs ≤ 30 days"
          tone="bg-amber-500/15"
          testId="tile-expiring-count"
        />
        <SummaryTile
          icon={<BellRing className="h-5 w-5 text-rose-300" />}
          value={alertsValue}
          label="Alerts"
          hint="Need review"
          tone="bg-rose-500/15"
          testId="tile-alerts-count"
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Higher-level crew split
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={onOpenCurrent}
            className="ops-card flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:border-sky-500/40"
            data-testid="card-open-current"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15">
              <Users className="h-5 w-5 text-sky-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Current Crew</p>
              <p className="text-xs text-slate-400">
                {counts.current} active • open the live roster, sort by role or vessel
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={onOpenFormer}
            className="ops-card flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors hover:border-white/30"
            data-testid="card-open-former"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06]">
              <UserX className="h-5 w-5 text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Former Crew</p>
              <p className="text-xs text-slate-400">
                {counts.former} archived • review history and rehire status
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fast actions
        </p>
        <div className="grid grid-cols-3 gap-3">
          {canCreate ? (
            <button
              type="button"
              onClick={onAddCrew}
              className="ops-card flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition-colors hover:border-sky-500/40"
              data-testid="action-add-crew"
            >
              <Plus className="h-5 w-5 text-sky-300" />
              <span className="text-xs font-medium text-white">Add crew</span>
              <span className="text-[10px] text-slate-500">New profile</span>
            </button>
          ) : (
            <div className="ops-card flex flex-col items-center gap-1 rounded-2xl p-3 text-center opacity-50">
              <Plus className="h-5 w-5 text-slate-500" />
              <span className="text-xs font-medium text-slate-400">Add crew</span>
              <span className="text-[10px] text-slate-600">No access</span>
            </div>
          )}
          {canManageDocs ? (
            <button
              type="button"
              onClick={() => setLocation("/compliance-consolidated")}
              className="ops-card flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition-colors hover:border-sky-500/40"
              data-testid="action-upload-docs"
            >
              <FileUp className="h-5 w-5 text-emerald-300" />
              <span className="text-xs font-medium text-white">Upload docs</span>
              <span className="text-[10px] text-slate-500">Certificates</span>
            </button>
          ) : (
            <div className="ops-card flex flex-col items-center gap-1 rounded-2xl p-3 text-center opacity-50">
              <FileUp className="h-5 w-5 text-slate-500" />
              <span className="text-xs font-medium text-slate-400">Upload docs</span>
              <span className="text-[10px] text-slate-600">No access</span>
            </div>
          )}
          <button
            type="button"
            onClick={onReviewAlerts}
            className="ops-card relative flex flex-col items-center gap-1 rounded-2xl p-3 text-center transition-colors hover:border-sky-500/40"
            data-testid="action-review-alerts"
          >
            <ClipboardCheck className="h-5 w-5 text-amber-300" />
            <span className="text-xs font-medium text-white">Review alerts</span>
            <span className="text-[10px] text-slate-500">Expiring docs</span>
            {!expiryLoading && counts.alerts > 0 && (
              <span
                className="absolute right-2 top-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500/90 px-1 text-[10px] font-semibold text-white"
                data-testid="badge-alerts-count"
              >
                {counts.alerts}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
