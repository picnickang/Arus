import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import {
  CREW_ACCESS_STATUS_LABELS,
  FORMER_ACCESS_RISK_LABELS,
  MARITIME_RANKS,
  type CrewAccessReadinessStatus,
  type FormerCrewAccessRiskFilter,
  useUnifiedCrewData,
} from "@/features/crew";

type UnifiedCrewData = ReturnType<typeof useUnifiedCrewData>;

const ACCESS_STATUS_OPTIONS: CrewAccessReadinessStatus[] = [
  "ready",
  "no_login",
  "login_disabled",
  "no_password_set",
  "temporary_password_issued",
  "password_change_required",
  "password_required",
  "no_vessel_scope",
  "no_dashboard",
  "fleet_scope_review",
];
const FORMER_ACCESS_RISK_OPTIONS: FormerCrewAccessRiskFilter[] = [
  "all",
  "linked_login",
  "login_enabled",
  "vessel_access",
  "hub_access",
];

export function RosterFilters({
  d,
  rosterView,
  visibleCount,
  totalCount,
}: {
  d: UnifiedCrewData;
  rosterView: "active" | "former";
  visibleCount: number;
  totalCount: number;
}) {
  const showDutyFilter = rosterView === "active";
  const showActiveAccessFilter = rosterView === "active" && d.accessReadinessEnabled;
  const showFormerAccessRiskFilter = rosterView === "former" && d.accessReadinessEnabled;
  const visibleFilterCount =
    d.activeFilterCount +
    (showFormerAccessRiskFilter && d.selectedFormerAccessRisk !== "all" ? 1 : 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Search & Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, rank, or skill..."
              value={d.searchTerm}
              onChange={(e) => d.setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-crew"
            />
          </div>
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
              <SelectValue placeholder="All Ranks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ranks</SelectItem>
              {MARITIME_RANKS.map((rank) => (
                <SelectItem key={rank} value={rank}>
                  {rank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showDutyFilter && (
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
          )}
          {showActiveAccessFilter && (
            <Select value={d.selectedAccessStatus} onValueChange={d.setSelectedAccessStatus}>
              <SelectTrigger data-testid="select-access-readiness-filter">
                <SelectValue placeholder="All Access" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Access</SelectItem>
                {ACCESS_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {CREW_ACCESS_STATUS_LABELS[status]} ({d.accessStatusCounts[status]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showFormerAccessRiskFilter && (
            <Select
              value={d.selectedFormerAccessRisk}
              onValueChange={(value) =>
                d.setSelectedFormerAccessRisk(value as FormerCrewAccessRiskFilter)
              }
            >
              <SelectTrigger data-testid="select-former-access-risk-filter">
                <SelectValue placeholder="Former access risk" />
              </SelectTrigger>
              <SelectContent>
                {FORMER_ACCESS_RISK_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {FORMER_ACCESS_RISK_LABELS[option]}
                    {option !== "all"
                      ? ` (${d.formerAccessRiskCounts[option] ?? 0})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {showFormerAccessRiskFilter && (
          <p className="text-xs text-muted-foreground">
            Former Crew uses access-risk review filters, not active crew readiness states.
          </p>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground" data-testid="text-result-count">
            Showing {visibleCount} of {totalCount} {rosterView === "active" ? "active" : "former"} crew
            {visibleFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {visibleFilterCount} filter{visibleFilterCount > 1 ? "s" : ""}
              </Badge>
            )}
          </p>
          {visibleFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={d.clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
