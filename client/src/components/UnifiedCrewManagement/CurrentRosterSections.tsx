import type { ReactNode } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, KeyRound } from "lucide-react";
import { formatRank, type CrewListItem } from "@/features/crew";
import type { LifecycleAction } from "./LifecycleDialog";
import {
  CrewAvatar,
  CrewActionsMenu,
  StatusPill,
  type CrewRowPermissions,
  type UnifiedCrewData,
} from "./crew-roster-shared";

interface CurrentCrewRowProps {
  d: UnifiedCrewData;
  member: CrewListItem;
  expiringCrewIds: Set<string>;
  needsActionCrewIds: Set<string>;
  expiryLoaded: boolean;
  openLifecycle: (
    action: LifecycleAction,
    crewId: string,
    crewName: string,
    vesselName?: string,
    contractPenalty?: number
  ) => void;
  perms: CrewRowPermissions;
}

export function CurrentCrewRow({
  d,
  member,
  expiringCrewIds,
  needsActionCrewIds,
  expiryLoaded,
  openLifecycle,
  perms,
}: CurrentCrewRowProps) {
  const vesselName = d.getVesselName(member.vesselId ?? "") || "Unassigned";
  const access = d.accessReadinessEnabled ? d.accessReadinessByCrewId.get(member.id) : undefined;
  const hasExpiring = expiringCrewIds.has(member.id);
  const needsDocs = needsActionCrewIds.has(member.id);
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
      data-testid={`row-crew-${member.id}`}
    >
      <CrewAvatar name={member.name} id={member.id} photoPath={member.photoPath} />
      <button
        type="button"
        onClick={() => d.handleViewProfile(member)}
        className="min-w-0 flex-1 text-left"
        data-testid={`button-open-crew-${member.id}`}
      >
        <p
          className="truncate text-sm font-semibold text-white"
          data-testid={`text-crew-name-${member.id}`}
        >
          {member.name}
        </p>
        <p className="truncate text-xs text-slate-400">
          {formatRank(member.rank)} • {vesselName}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <StatusPill
            tone={member.onDuty ? "success" : "neutral"}
            testId={`pill-duty-${member.id}`}
          >
            {member.onDuty ? "On Duty" : "Off Duty"}
          </StatusPill>
          {!member.vesselId && (
            <StatusPill tone="info" testId={`pill-relief-${member.id}`}>
              Relief
            </StatusPill>
          )}
          {needsDocs && (
            <StatusPill tone="danger" testId={`pill-docs-missing-${member.id}`}>
              Docs missing
            </StatusPill>
          )}
          {hasExpiring ? (
            <StatusPill tone="warning" testId={`pill-compliance-${member.id}`}>
              Docs expiring
            </StatusPill>
          ) : (
            expiryLoaded &&
            !needsDocs && (
              <StatusPill tone="success" testId={`pill-compliance-${member.id}`}>
                Docs OK
              </StatusPill>
            )
          )}
          {member.contractEndDate && (
            <StatusPill tone="neutral" testId={`pill-contract-${member.id}`}>
              Ends {format(new Date(member.contractEndDate), "MMM d")}
            </StatusPill>
          )}
          {d.accessReadinessEnabled && access && access.status !== "ready" && (
            <StatusPill tone="danger" testId={`pill-access-${member.id}`}>
              <KeyRound className="h-3 w-3" /> Access
            </StatusPill>
          )}
        </div>
      </button>
      <CrewActionsMenu
        d={d}
        member={member}
        isFormerView={false}
        openLifecycle={openLifecycle}
        perms={perms}
      />
    </div>
  );
}

interface GroupSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  tone?: "info" | "warning";
  children: ReactNode;
}

export function GroupSection({
  id,
  title,
  subtitle,
  count,
  collapsed,
  onToggle,
  tone = "info",
  children,
}: GroupSectionProps) {
  const toneClass =
    tone === "warning" ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300";
  return (
    <div className="ops-card overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        data-testid={`group-header-${id}`}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{count}</span>
      </button>
      {!collapsed && <div className="space-y-2 px-3 pb-3">{children}</div>}
    </div>
  );
}
