import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ShipWheel,
  UserCheck,
  UserX,
  Plus,
  Download,
  X,
  KeyRound,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatRank,
  groupCrewByRoleWith,
  groupCrewByVessel,
  type CrewListItem,
} from "@/features/crew";
import { CrewRoleManager } from "./CrewRoleManager";
import type { LifecycleAction } from "./LifecycleDialog";
import {
  CrewAvatar,
  CrewActionsMenu,
  StatusPill,
  type UnifiedCrewData,
  type CrewRowPermissions,
} from "./crew-roster-shared";

type GroupMode = "role" | "vessel" | "name";

interface CurrentRosterProps {
  d: UnifiedCrewData;
  formerCount: number;
  expiringCrewIds: Set<string>;
  needsActionCrewIds: Set<string>;
  expiryLoaded: boolean;
  openLifecycle: (
    action: LifecycleAction,
    crewId: string,
    crewName: string,
    vesselName?: string,
    contractPenalty?: number,
  ) => void;
  onSwitchToFormer: () => void;
  perms: CrewRowPermissions;
  canExport: boolean;
  canCreate: boolean;
  onAddCrew: () => void;
}

function CurrentCrewRow({
  d,
  member,
  expiringCrewIds,
  needsActionCrewIds,
  expiryLoaded,
  openLifecycle,
  perms,
}: {
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
    contractPenalty?: number,
  ) => void;
  perms: CrewRowPermissions;
}) {
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
        <p className="truncate text-sm font-semibold text-white" data-testid={`text-crew-name-${member.id}`}>
          {member.name}
        </p>
        <p className="truncate text-xs text-slate-400">
          {formatRank(member.rank)} • {vesselName}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <StatusPill tone={member.onDuty ? "success" : "neutral"} testId={`pill-duty-${member.id}`}>
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

function GroupSection({
  id,
  title,
  subtitle,
  count,
  collapsed,
  onToggle,
  tone = "info",
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  tone?: "info" | "warning";
  children: React.ReactNode;
}) {
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
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>
          {count}
        </span>
      </button>
      {!collapsed && <div className="space-y-2 px-3 pb-3">{children}</div>}
    </div>
  );
}

export function CurrentRoster({
  d,
  formerCount,
  expiringCrewIds,
  needsActionCrewIds,
  expiryLoaded,
  openLifecycle,
  onSwitchToFormer,
  perms,
  canExport,
  canCreate,
  onAddCrew,
}: CurrentRosterProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>("role");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const activeCrew = useMemo(() => d.crew.filter((c) => c.active), [d.crew]);
  const displayCrew = d.getFilteredSortedCrew(activeCrew, {
    includeStatusFilter: true,
    includeAccessFilter: d.accessReadinessEnabled,
  });

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const groupByLabel =
    groupMode === "role" ? "role" : groupMode === "vessel" ? "vessel" : "name";

  const roleGroups = useMemo(
    () => (groupMode === "role" ? groupCrewByRoleWith(displayCrew, d.roleLookup) : []),
    [groupMode, displayCrew, d.roleLookup],
  );
  const vesselGroups = useMemo(
    () => (groupMode === "vessel" ? groupCrewByVessel(displayCrew, d.getVesselName) : []),
    [groupMode, displayCrew, d.getVesselName],
  );

  const GROUP_CHIPS: { mode: GroupMode; label: string }[] = [
    { mode: "role", label: "Role" },
    { mode: "vessel", label: "Vessel" },
    { mode: "name", label: "Name" },
  ];

  return (
    <div className="space-y-4">
      {/* status toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.03] p-1">
        <button
          type="button"
          className="rounded-xl bg-sky-500/90 px-4 py-2 text-sm font-semibold text-white shadow"
          data-testid="tab-active-roster"
          aria-pressed="true"
        >
          <UserCheck className="mr-1.5 inline h-4 w-4" />
          Current Crew
        </button>
        <button
          type="button"
          onClick={onSwitchToFormer}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.04]"
          data-testid="tab-former-roster"
        >
          <UserX className="mr-1.5 inline h-4 w-4" />
          Former Crew ({formerCount})
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400" data-testid="text-result-count">
          {displayCrew.length} active crew • grouped by {groupByLabel}
        </p>
        <div className="flex items-center gap-2">
          {canExport && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
              onClick={() => d.handleExportCSV(displayCrew, "active-crew-roster")}
              data-testid="button-export-csv"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
          )}
          <CrewRoleManager canManage={perms.canManageCrew} />
          {canCreate && (
            <Button
              size="sm"
              className="h-8"
              onClick={onAddCrew}
              data-testid="button-add-crew"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Crew
            </Button>
          )}
        </div>
      </div>

      {/* search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Search crew, role, vessel..."
          value={d.searchTerm}
          onChange={(e) => d.setSearchTerm(e.target.value)}
          className="border-white/10 bg-white/[0.03] pl-10 text-white placeholder:text-slate-500"
          data-testid="input-search-crew"
        />
      </div>

      {/* group-by chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Group roster by</span>
        {GROUP_CHIPS.map((chip) => (
          <button
            key={chip.mode}
            type="button"
            onClick={() => setGroupMode(chip.mode)}
            className={
              groupMode === chip.mode
                ? "rounded-full bg-sky-500/90 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
            }
            data-testid={`chip-group-${chip.mode}`}
            aria-pressed={groupMode === chip.mode}
          >
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={
            d.activeFilterCount > 0
              ? "ml-auto rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300"
              : "ml-auto rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
          }
          data-testid="button-toggle-filters"
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="mr-1 inline h-3 w-3" />
          Filter{d.activeFilterCount > 0 ? ` (${d.activeFilterCount})` : ""}
        </button>
      </div>

      {filtersOpen && (
        <div className="ops-card grid grid-cols-1 gap-3 rounded-2xl p-3 sm:grid-cols-3">
          <Select value={d.selectedVessel} onValueChange={d.setSelectedVessel}>
            <SelectTrigger data-testid="select-vessel-filter">
              <SelectValue placeholder="All Vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {d.vessels
                .filter((v) => v.active)
                .map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={d.selectedRank} onValueChange={d.setSelectedRank}>
            <SelectTrigger data-testid="select-rank-filter">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {d.rankOptions.map((rank) => (
                <SelectItem key={rank} value={rank}>
                  {rank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={d.selectedStatus} onValueChange={d.setSelectedStatus}>
            <SelectTrigger data-testid="select-status-filter">
              <SelectValue placeholder="Duty Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Duty States</SelectItem>
              <SelectItem value="on_duty">On Duty</SelectItem>
              <SelectItem value="off_duty">Off Duty</SelectItem>
            </SelectContent>
          </Select>
          {d.activeFilterCount > 0 && (
            <div className="sm:col-span-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={d.clearFilters}
                className="text-slate-300 hover:text-white"
                data-testid="button-clear-filters"
              >
                <X className="mr-1 h-4 w-4" /> Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* roster body */}
      {displayCrew.length === 0 ? (
        <div className="ops-card rounded-2xl p-8 text-center text-sm text-slate-400">
          {d.activeFilterCount > 0
            ? "No crew match your filters."
            : "No active crew yet. Add your first crew member."}
        </div>
      ) : groupMode === "name" ? (
        <div className="space-y-2">
          {displayCrew.map((member) => (
            <CurrentCrewRow
              key={member.id}
              d={d}
              member={member}
              expiringCrewIds={expiringCrewIds}
              needsActionCrewIds={needsActionCrewIds}
              expiryLoaded={expiryLoaded}
              openLifecycle={openLifecycle}
              perms={perms}
            />
          ))}
        </div>
      ) : groupMode === "role" ? (
        <div className="space-y-3">
          {roleGroups.map((bucket) => {
            const id = `role-${bucket.group}`;
            return (
              <GroupSection
                key={id}
                id={id}
                title={bucket.group}
                count={bucket.members.length}
                collapsed={collapsed.has(id)}
                onToggle={() => toggleGroup(id)}
              >
                {bucket.members.map((member) => (
                  <CurrentCrewRow
                    key={member.id}
                    d={d}
                    member={member}
                    expiringCrewIds={expiringCrewIds}
                    needsActionCrewIds={needsActionCrewIds}
                    expiryLoaded={expiryLoaded}
                    openLifecycle={openLifecycle}
                    perms={perms}
                  />
                ))}
              </GroupSection>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {vesselGroups.map((bucket) => {
            const id = `vessel-${bucket.vesselId}`;
            return (
              <GroupSection
                key={id}
                id={id}
                title={bucket.vesselName}
                subtitle={
                  bucket.isReliefPool ? "Relief / unassigned crew" : `${bucket.members.length} assigned`
                }
                count={bucket.members.length}
                collapsed={collapsed.has(id)}
                onToggle={() => toggleGroup(id)}
                tone={bucket.isReliefPool ? "warning" : "info"}
              >
                {bucket.members.map((member) => (
                  <CurrentCrewRow
                    key={member.id}
                    d={d}
                    member={member}
                    expiringCrewIds={expiringCrewIds}
                    needsActionCrewIds={needsActionCrewIds}
                    expiryLoaded={expiryLoaded}
                    openLifecycle={openLifecycle}
                    perms={perms}
                  />
                ))}
              </GroupSection>
            );
          })}
        </div>
      )}

      {!d.accessReadinessEnabled && (
        <p className="flex items-center gap-1 text-[11px] text-slate-500">
          <ShipWheel className="h-3 w-3" /> Tap a crew member to open their full profile.
        </p>
      )}
    </div>
  );
}
