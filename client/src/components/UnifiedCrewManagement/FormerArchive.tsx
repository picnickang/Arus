import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  ChevronDown,
  ChevronRight,
  UserCheck,
  UserX,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatRank,
  groupCrewByRole,
  deriveRehireStatus,
  type RehireStatusKey,
  type FormerCrewMember,
  type EmploymentHistoryRecord,
  type CrewListItem,
} from "@/features/crew";
import type { LifecycleAction } from "./LifecycleDialog";
import {
  CrewAvatar,
  CrewActionsMenu,
  StatusPill,
  type PillTone,
  type UnifiedCrewData,
  type CrewRowPermissions,
} from "./crew-roster-shared";

type ArchiveSort = "last_role" | "last_vessel" | "end_date";
type RehireFilter = "all" | RehireStatusKey;

interface DerivedFormer {
  member: FormerCrewMember;
  lastRole: string;
  lastVesselId: string | null;
  endDate: string | null;
  rehireKey: RehireStatusKey;
  rehireLabel: string;
}

const REHIRE_TONE: Record<RehireStatusKey, PillTone> = {
  rehire_ok: "success",
  review: "warning",
  no_rehire: "danger",
};

function latestPeriod(
  periods: EmploymentHistoryRecord[] | undefined,
): EmploymentHistoryRecord | undefined {
  if (!periods || periods.length === 0) {
    return undefined;
  }
  return [...periods].sort((a, b) => {
    const aTime = a.endDate ? new Date(a.endDate).getTime() : 0;
    const bTime = b.endDate ? new Date(b.endDate).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function FormerCrewRow({
  d,
  derived,
  openLifecycle,
  getVesselName,
  perms,
}: {
  d: UnifiedCrewData;
  derived: DerivedFormer;
  openLifecycle: (action: LifecycleAction, crewId: string, crewName: string) => void;
  getVesselName: (vesselId: string) => string;
  perms: CrewRowPermissions;
}) {
  const { member } = derived;
  const vesselName = derived.lastVesselId ? getVesselName(derived.lastVesselId) : "No vessel";
  const endedLabel = derived.endDate ? format(new Date(derived.endDate), "yyyy") : "—";
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
      data-testid={`row-crew-${member.id}`}
    >
      <CrewAvatar name={member.name} id={member.id} photoPath={member.photoPath} />
      <button
        type="button"
        onClick={() => d.handleViewProfile(member as unknown as CrewListItem)}
        className="min-w-0 flex-1 text-left"
        data-testid={`button-open-crew-${member.id}`}
      >
        <p className="truncate text-sm font-semibold text-white" data-testid={`text-crew-name-${member.id}`}>
          {member.name}
        </p>
        <p className="truncate text-xs text-slate-400">
          {formatRank(derived.lastRole)} • {vesselName} • ended {endedLabel}
        </p>
      </button>
      <StatusPill tone={REHIRE_TONE[derived.rehireKey]} testId={`pill-rehire-${member.id}`}>
        {derived.rehireLabel}
      </StatusPill>
      <CrewActionsMenu
        d={d}
        member={member as unknown as CrewListItem}
        isFormerView
        openLifecycle={openLifecycle}
        perms={perms}
      />
    </div>
  );
}

export function FormerArchive({
  d,
  formerCrew,
  formerLoading,
  currentCount,
  openLifecycle,
  onSwitchToCurrent,
  perms,
  canExport,
}: {
  d: UnifiedCrewData;
  formerCrew: FormerCrewMember[];
  formerLoading: boolean;
  currentCount: number;
  openLifecycle: (action: LifecycleAction, crewId: string, crewName: string) => void;
  onSwitchToCurrent: () => void;
  perms: CrewRowPermissions;
  canExport: boolean;
}) {
  const [sortBy, setSortBy] = useState<ArchiveSort>("last_role");
  const [rehireFilter, setRehireFilter] = useState<RehireFilter>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const getVesselName = d.getVesselName;

  const derived: DerivedFormer[] = useMemo(() => {
    return formerCrew.map((member) => {
      const period = latestPeriod(member.employmentPeriods);
      const rehire = deriveRehireStatus(period);
      return {
        member,
        lastRole: period?.rank ?? member.rank,
        lastVesselId: period?.vesselId ?? member.vesselId ?? null,
        endDate: period?.endDate ?? null,
        rehireKey: rehire.key,
        rehireLabel: rehire.label,
      };
    });
  }, [formerCrew]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return derived.filter((row) => {
      if (rehireFilter !== "all" && row.rehireKey !== rehireFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      const vesselName = row.lastVesselId ? getVesselName(row.lastVesselId) : "";
      return (
        row.member.name.toLowerCase().includes(term) ||
        formatRank(row.lastRole).toLowerCase().includes(term) ||
        vesselName.toLowerCase().includes(term)
      );
    });
  }, [derived, rehireFilter, search, getVesselName]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "last_vessel":
          return (a.lastVesselId ? getVesselName(a.lastVesselId) : "").localeCompare(
            b.lastVesselId ? getVesselName(b.lastVesselId) : "",
          );
        case "end_date": {
          const aTime = a.endDate ? new Date(a.endDate).getTime() : 0;
          const bTime = b.endDate ? new Date(b.endDate).getTime() : 0;
          return bTime - aTime;
        }
        case "last_role":
        default: {
          const roleCmp = formatRank(a.lastRole).localeCompare(formatRank(b.lastRole));
          return roleCmp !== 0 ? roleCmp : a.member.name.localeCompare(b.member.name);
        }
      }
    });
  }, [filtered, sortBy, getVesselName]);

  const groups = useMemo(
    () => groupCrewByRole(sorted.map((row) => ({ ...row, rank: row.lastRole }))),
    [sorted],
  );

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

  const SORT_CHIPS: { key: ArchiveSort; label: string }[] = [
    { key: "last_role", label: "Last role" },
    { key: "last_vessel", label: "Last vessel" },
    { key: "end_date", label: "End date" },
  ];
  const REHIRE_CHIPS: { key: RehireFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "rehire_ok", label: "Rehire OK" },
    { key: "review", label: "Review" },
    { key: "no_rehire", label: "No rehire" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={onSwitchToCurrent}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.04]"
          data-testid="tab-active-roster"
        >
          <UserCheck className="mr-1.5 inline h-4 w-4" />
          Current Crew ({currentCount})
        </button>
        <button
          type="button"
          className="rounded-xl bg-slate-200/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow"
          data-testid="tab-former-roster"
          aria-pressed="true"
        >
          <UserX className="mr-1.5 inline h-4 w-4" />
          Former Crew
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400" data-testid="text-former-count">
          {derived.length} former records • last role and vessel retained
        </p>
        {canExport && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
            onClick={() =>
              d.handleExportCSV(
                sorted.map((row) => row.member) as unknown as CrewListItem[],
                "former-crew-roster",
              )
            }
            data-testid="button-export-csv"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Search former crew records..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-white/10 bg-white/[0.03] pl-10 text-white placeholder:text-slate-500"
          data-testid="input-search-former"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Sort</span>
        {SORT_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setSortBy(chip.key)}
            className={
              sortBy === chip.key
                ? "rounded-full bg-sky-500/90 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
            }
            data-testid={`chip-sort-${chip.key}`}
            aria-pressed={sortBy === chip.key}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Rehire</span>
        {REHIRE_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setRehireFilter(chip.key)}
            className={
              rehireFilter === chip.key
                ? "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200"
                : "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.06]"
            }
            data-testid={`chip-rehire-${chip.key}`}
            aria-pressed={rehireFilter === chip.key}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        Rehire status is derived from each record&apos;s termination type and contract penalty —
        there is no dedicated rehire-eligibility field yet.
      </p>

      {formerLoading ? (
        <div className="ops-card rounded-2xl p-8 text-center text-sm text-slate-400">
          Loading former crew…
        </div>
      ) : sorted.length === 0 ? (
        <div className="ops-card rounded-2xl p-8 text-center text-sm text-slate-400">
          {derived.length === 0
            ? "No former crew records."
            : "No records match your search or filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((bucket) => {
            const id = `former-${bucket.group}`;
            return (
              <div key={id} className="ops-card overflow-hidden rounded-2xl">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    data-testid={`group-header-${id}`}
                    aria-expanded={!collapsed.has(id)}
                  >
                    {collapsed.has(id) ? (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="truncate text-sm font-semibold text-white">{bucket.group}</span>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-300">
                      {bucket.members.length}
                    </span>
                  </button>
                  {canExport && (
                    <button
                      type="button"
                      onClick={() =>
                        d.handleExportCSV(
                          bucket.members.map((row) => row.member) as unknown as CrewListItem[],
                          `former-${bucket.group.toLowerCase().replace(/\s+/g, "-")}`,
                        )
                      }
                      className="text-xs font-medium text-sky-300 hover:text-sky-200"
                      data-testid={`button-export-group-${id}`}
                    >
                      Export
                    </button>
                  )}
                </div>
                {!collapsed.has(id) && (
                  <div className="space-y-2 px-3 pb-3">
                    {bucket.members.map((row) => (
                      <FormerCrewRow
                        key={row.member.id}
                        d={d}
                        derived={row}
                        openLifecycle={openLifecycle}
                        getVesselName={getVesselName}
                        perms={perms}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
