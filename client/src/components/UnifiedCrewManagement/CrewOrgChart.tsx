import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Network } from "lucide-react";
import { formatRank, type CrewListItem } from "@/features/crew";
import { CrewAvatar, StatusPill, type UnifiedCrewData } from "./crew-roster-shared";
import { buildReportingTree, makeMemberComparator } from "./reportingTree";

function OrgNode({
  member,
  childrenByParent,
  sortMembers,
  d,
  ancestors,
}: {
  member: CrewListItem;
  childrenByParent: Map<string, CrewListItem[]>;
  sortMembers: (members: CrewListItem[]) => CrewListItem[];
  d: UnifiedCrewData;
  ancestors: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // `ancestors` is an extra runtime guard: even if a cycle slipped through, a
  // node never renders itself as its own descendant.
  const rawChildren = ancestors.has(member.id) ? [] : (childrenByParent.get(member.id) ?? []);
  const children = useMemo(() => sortMembers(rawChildren), [rawChildren, sortMembers]);
  const hasChildren = children.length > 0;
  const vesselName = d.getVesselName(member.vesselId ?? "") || "Unassigned";

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
        data-testid={`orgnode-${member.id}`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-white"
            data-testid={`orgnode-toggle-${member.id}`}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand reports" : "Collapse reports"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}
        <CrewAvatar name={member.name} id={member.id} photoPath={member.photoPath} />
        <button
          type="button"
          onClick={() => d.handleViewProfile(member)}
          className="min-w-0 flex-1 text-left"
          data-testid={`orgnode-open-${member.id}`}
        >
          <p
            className="truncate text-sm font-semibold text-white"
            data-testid={`orgnode-name-${member.id}`}
          >
            {member.name}
          </p>
          <p className="truncate text-xs text-slate-400">
            {formatRank(member.rank)} • {vesselName}
          </p>
        </button>
        {hasChildren && (
          <StatusPill tone="info" testId={`orgnode-reports-${member.id}`}>
            {children.length} {children.length === 1 ? "report" : "reports"}
          </StatusPill>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="ml-3 space-y-2 border-l border-white/[0.08] pl-3">
          {children.map((child) => (
            <OrgNode
              key={child.id}
              member={child}
              childrenByParent={childrenByParent}
              sortMembers={sortMembers}
              d={d}
              ancestors={new Set(ancestors).add(member.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CrewOrgChart({ d }: { d: UnifiedCrewData }) {
  const activeCrew = useMemo(() => d.crew.filter((c) => c.active), [d.crew]);

  const sortMembers = useMemo(() => makeMemberComparator(d.roleLookup.sortIndex), [d.roleLookup]);

  const { roots, childrenByParent } = useMemo(() => buildReportingTree(activeCrew), [activeCrew]);
  const sortedRoots = useMemo(() => sortMembers(roots), [roots, sortMembers]);

  return (
    <div className="space-y-4" data-testid="crew-org-chart">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
          <Network className="h-5 w-5 text-violet-300" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">Org chart</h2>
          <p className="text-sm text-slate-400">
            Reporting lines across {activeCrew.length} active crew. Tap a name to open their
            profile.
          </p>
        </div>
      </div>

      {activeCrew.length === 0 ? (
        <div
          className="ops-card rounded-2xl p-8 text-center text-sm text-slate-400"
          data-testid="org-chart-empty"
        >
          No active crew to chart yet.
        </div>
      ) : (
        <div className="space-y-3" data-testid="org-chart-roots">
          {sortedRoots.map((member) => (
            <div key={member.id} className="ops-card rounded-2xl p-3">
              <OrgNode
                member={member}
                childrenByParent={childrenByParent}
                sortMembers={sortMembers}
                d={d}
                ancestors={new Set<string>()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
