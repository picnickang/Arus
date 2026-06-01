import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShipWheel,
  Eye,
  Edit,
  Power,
  MoreHorizontal,
  Trash2,
  UserX,
  UserPlus,
  X,
  KeyRound,
  FileText,
  Bell,
} from "lucide-react";
import { format } from "date-fns";
import {
  CREW_ACCESS_STATUS_LABELS,
  formatRank,
  useUnifiedCrewData,
  type SortField,
  type EmploymentHistoryRecord,
  type CrewListItem,
  type CrewAccessReadiness,
  type CrewAccessReadinessStatus,
} from "@/features/crew";
import type { LifecycleAction } from "./LifecycleDialog";
import { usePermissions } from "@/contexts/PermissionsContext";

type UnifiedCrewData = ReturnType<typeof useUnifiedCrewData>;
type DisplayCrewMember = {
  id: string;
  name: string;
  rank: string;
  vesselId?: string | null;
  active?: boolean;
  onDuty?: boolean;
  skills?: string[];
  maxHours7d?: number;
  minRestH?: number;
  userId?: string | null;
  employmentPeriods?: EmploymentHistoryRecord[];
};

function accessBadgeVariant(
  status: CrewAccessReadinessStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ready":
      return "default";
    case "login_disabled":
    case "no_password_set":
      return "destructive";
    case "temporary_password_issued":
    case "password_change_required":
    case "password_required":
      return "secondary";
    case "no_login":
    case "no_vessel_scope":
    case "no_dashboard":
      return "outline";
    case "fleet_scope_review":
      return "secondary";
    default:
      return "secondary";
  }
}

function accessBadgeClassName(status: CrewAccessReadinessStatus | undefined): string | undefined {
  if (status === "temporary_password_issued" || status === "password_change_required") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }
  return undefined;
}

function accessSummary(access: CrewAccessReadiness | undefined): string {
  if (!access) return "Not checked";
  if (access.status === "ready") {
    const role = access.roleDisplayName ?? "Role";
    const scope = access.vesselScope === "fleet" ? "Fleet" : "Vessel";
    return `${role} · ${scope} scope`;
  }
  return access.reasons[0] ?? "Needs review";
}

function AccessReadinessCell({
  access,
  isLoading,
  hasError,
  memberId,
  onFixAccess,
}: {
  access: CrewAccessReadiness | undefined;
  isLoading: boolean;
  hasError: boolean;
  memberId: string;
  onFixAccess?: () => void;
}) {
  if (isLoading) {
    return <Badge variant="outline">Checking</Badge>;
  }
  if (hasError) {
    return (
      <div className="space-y-1 max-w-[180px]">
        <Badge variant="destructive" data-testid={`badge-access-${memberId}`}>
          Unavailable
        </Badge>
        <p className="text-xs text-muted-foreground">Could not check access</p>
      </div>
    );
  }
  return (
    <div className="space-y-1 max-w-[180px]">
      <Badge
        variant={access ? accessBadgeVariant(access.status) : "secondary"}
        className={accessBadgeClassName(access?.status)}
        title={access?.reasons.join(" ") ?? undefined}
        data-testid={`badge-access-${memberId}`}
      >
        {access ? CREW_ACCESS_STATUS_LABELS[access.status] : "Not checked"}
      </Badge>
      <p className="text-xs text-muted-foreground truncate" title={accessSummary(access)}>
        {accessSummary(access)}
      </p>
      {access && access.status !== "ready" && onFixAccess ? (
        <Button
          type="button"
          size="sm"
          variant="link"
          className="h-auto p-0 text-xs"
          onClick={onFixAccess}
          data-testid={`button-fix-access-${memberId}`}
        >
          Fix access
        </Button>
      ) : null}
    </div>
  );
}

function FormerAccessRiskCell({
  d,
  memberId,
}: {
  d: UnifiedCrewData;
  memberId: string;
}) {
  if (d.formerAccessRisksLoading) {
    return <Badge variant="outline">Checking</Badge>;
  }
  if (d.formerAccessRisksError) {
    return <Badge variant="destructive">Risk unknown</Badge>;
  }
  const risk = d.formerAccessRiskByCrewId.get(memberId);
  if (!risk) {
    return <Badge variant="secondary">Not assessed</Badge>;
  }
  return (
    <div className="space-y-1 max-w-[200px]">
      <Badge variant={risk.hasAccessRisk ? "destructive" : "secondary"}>
        {risk.hasAccessRisk ? "Access risk" : "Access revoked"}
      </Badge>
      <p className="text-xs text-muted-foreground truncate" title={risk.reasons.join(" ")}>
        {risk.reasons[0]}
      </p>
    </div>
  );
}

function DocumentReadinessBadge() {
  return (
    <Badge variant="outline" className="gap-1 text-xs font-normal">
      <FileText className="h-3 w-3" />
      Docs not assessed
    </Badge>
  );
}

function AlertReadinessBadge() {
  return (
    <Badge variant="outline" className="gap-1 text-xs font-normal">
      <Bell className="h-3 w-3" />
      Alerts not assessed
    </Badge>
  );
}

function CrewMobileCard({
  d,
  member,
  isFormerView,
  openLifecycle,
  canManageAccess,
  canManageCrew,
}: {
  d: UnifiedCrewData;
  member: DisplayCrewMember;
  isFormerView: boolean;
  openLifecycle: (action: LifecycleAction, crewId: string, crewName: string) => void;
  canManageAccess: boolean;
  canManageCrew: boolean;
}) {
  const access = d.accessReadinessByCrewId.get(member.id);
  return (
    <Card data-testid={`card-crew-mobile-${member.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium truncate">{member.name}</p>
            <p className="text-sm text-muted-foreground">{formatRank(member.rank)}</p>
          </div>
          <Badge variant={member.active ? "default" : "secondary"}>
            {member.active ? "Active" : "Former"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Vessel</p>
            <p className="font-medium">{d.getVesselName(member.vesselId ?? "") || "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Duty</p>
            <Badge variant={member.onDuty ? "default" : "outline"}>
              {member.onDuty ? "On Duty" : "Off Duty"}
            </Badge>
          </div>
        </div>
        {!isFormerView && d.accessReadinessEnabled && (
          <div className="space-y-2">
            <AccessReadinessCell
              access={access}
              isLoading={d.accessReadinessLoading}
              hasError={d.accessReadinessError}
              memberId={member.id}
              onFixAccess={
                canManageAccess
                  ? () => d.handleViewProfile(member as CrewListItem, "access")
                  : undefined
              }
            />
            <div className="flex flex-wrap gap-1">
              <DocumentReadinessBadge />
              <AlertReadinessBadge />
            </div>
          </div>
        )}
        {isFormerView && d.accessReadinessEnabled && (
          <FormerAccessRiskCell d={d} memberId={member.id} />
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => d.handleViewProfile(member as CrewListItem)}
            data-testid={`button-mobile-view-${member.id}`}
          >
            View
          </Button>
          {!isFormerView && canManageAccess && d.accessReadinessEnabled && access?.status !== "ready" && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => d.handleViewProfile(member as CrewListItem, "access")}
              data-testid={`button-mobile-fix-access-${member.id}`}
            >
              Fix Access
            </Button>
          )}
          {isFormerView && canManageCrew && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => openLifecycle("reinstate", member.id, member.name)}
              data-testid={`button-mobile-reinstate-${member.id}`}
            >
              Reinstate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function RosterTable({
  d,
  isFormerView,
  formerLoading,
  displayCrew,
  openLifecycle,
}: {
  d: UnifiedCrewData;
  isFormerView: boolean;
  formerLoading: boolean;
  displayCrew: DisplayCrewMember[];
  openLifecycle: (action: LifecycleAction, crewId: string, crewName: string) => void;
}) {
  const getSortIcon = (field: SortField) => {
    if (d.sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return d.sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  const getAriaSort = (field: SortField): "ascending" | "descending" | "none" => {
    if (d.sortField !== field) {
      return "none";
    }
    return d.sortDirection === "asc" ? "ascending" : "descending";
  };
  const regularColumnCount = d.accessReadinessEnabled ? 9 : 8;
  const { canEdit, canDelete, hasPermission } = usePermissions();
  const canManageCrew = canEdit("crew_members");
  const canDeleteCrew = canDelete("crew_members");
  const canManageAccess =
    hasPermission("permission_management", "edit") || hasPermission("crew_members", "edit");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isFormerView ? "Former Crew" : "Crew Roster"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 md:hidden">
          {isFormerView && formerLoading ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              Loading former crew...
            </div>
          ) : displayCrew.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              {isFormerView
                ? "No former crew members found."
                : d.activeFilterCount > 0
                  ? "No crew members match your filters."
                  : "No crew members found. Add your first crew member above."}
            </div>
          ) : (
            displayCrew.map((member) => (
              <CrewMobileCard
                key={member.id}
                d={d}
                member={member}
                isFormerView={isFormerView}
                openLifecycle={openLifecycle}
                canManageAccess={canManageAccess}
                canManageCrew={canManageCrew}
              />
            ))
          )}
        </div>
        <div className="hidden md:block rounded-md border overflow-x-auto">
          <Table className={d.accessReadinessEnabled ? "min-w-[980px]" : "min-w-[800px]"}>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => d.handleSort("name")}
                  aria-sort={getAriaSort("name")}
                >
                  <div className="flex items-center">Name{getSortIcon("name")}</div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => d.handleSort("rank")}
                  aria-sort={getAriaSort("rank")}
                >
                  <div className="flex items-center">Rank{getSortIcon("rank")}</div>
                </TableHead>
                {!isFormerView && (
                  <>
                    <TableHead
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => d.handleSort("vessel")}
                      aria-sort={getAriaSort("vessel")}
                    >
                      <div className="flex items-center">Vessel{getSortIcon("vessel")}</div>
                    </TableHead>
                    <TableHead>Skills</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => d.handleSort("status")}
                      aria-sort={getAriaSort("status")}
                    >
                      <div className="flex items-center">Status{getSortIcon("status")}</div>
                    </TableHead>
                    {d.accessReadinessEnabled && <TableHead>Readiness</TableHead>}
                    <TableHead
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => d.handleSort("duty")}
                      aria-sort={getAriaSort("duty")}
                    >
                      <div className="flex items-center">Duty{getSortIcon("duty")}</div>
                    </TableHead>
                    <TableHead>Hours</TableHead>
                  </>
                )}
                {isFormerView && (
                  <>
                    <TableHead>Employment Periods</TableHead>
                    <TableHead>Last End Date</TableHead>
                    {d.accessReadinessEnabled && <TableHead>Access Risk</TableHead>}
                  </>
                )}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFormerView && formerLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={isFormerView ? (d.accessReadinessEnabled ? 6 : 5) : regularColumnCount}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Loading former crew...
                  </TableCell>
                </TableRow>
              ) : displayCrew.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isFormerView ? (d.accessReadinessEnabled ? 6 : 5) : regularColumnCount}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {isFormerView
                      ? "No former crew members found."
                      : d.activeFilterCount > 0
                        ? "No crew members match your filters."
                        : "No crew members found. Add your first crew member above."}
                  </TableCell>
                </TableRow>
              ) : (
                displayCrew.map((member) => (
                  <TableRow key={member.id} data-testid={`row-crew-${member.id}`}>
                    <TableCell
                      className="font-medium"
                      data-testid={`text-crew-name-${member.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{member.name}</span>
                        {!isFormerView &&
                          (member.userId ? (
                            <Badge
                              variant="outline"
                              className="gap-1 text-xs font-normal"
                              data-testid={`badge-has-login-${member.id}`}
                            >
                              <KeyRound className="h-3 w-3" />
                              Login
                            </Badge>
                          ) : (
                            <span
                              className="text-xs text-muted-foreground"
                              data-testid={`text-no-login-${member.id}`}
                            >
                              No login
                            </span>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatRank(member.rank)}</Badge>
                    </TableCell>
                    {!isFormerView && (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ShipWheel className="h-3 w-3 text-muted-foreground" />
                            <span>{d.getVesselName(member.vesselId ?? "") || "Unassigned"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {member.skills?.slice(0, 2).map((skill: string) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {(member.skills?.length ?? 0) > 2 && member.skills && (
                              <Badge variant="secondary" className="text-xs">
                                +{member.skills.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.active ? "default" : "secondary"}>
                            {member.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        {d.accessReadinessEnabled && (
                          <TableCell>
                            <AccessReadinessCell
                              access={d.accessReadinessByCrewId.get(member.id)}
                              isLoading={d.accessReadinessLoading}
                              hasError={d.accessReadinessError}
                              memberId={member.id}
                              onFixAccess={
                                canManageAccess
                                  ? () => d.handleViewProfile(member as CrewListItem, "access")
                                  : undefined
                              }
                            />
                            <div className="mt-2 flex flex-wrap gap-1">
                              <DocumentReadinessBadge />
                              <AlertReadinessBadge />
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={member.onDuty ? "default" : "outline"}>
                            {member.onDuty ? "On Duty" : "Off Duty"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {member.maxHours7d}h/wk
                          </span>
                        </TableCell>
                      </>
                    )}
                    {isFormerView && (
                      <>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {member.employmentPeriods && member.employmentPeriods.length > 0 ? (
                              member.employmentPeriods.map(
                                (period: EmploymentHistoryRecord) => (
                                  <div
                                    key={period.id}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {period.terminationType === "retired"
                                        ? "Retired"
                                        : "Cancelled"}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {format(new Date(period.startDate), "MMM yyyy")} -{" "}
                                      {period.endDate
                                        ? format(new Date(period.endDate), "MMM yyyy")
                                        : "Present"}
                                    </span>
                                  </div>
                                )
                              )
                            ) : (
                              <span className="text-muted-foreground text-xs">No history</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.employmentPeriods?.[0]?.endDate
                            ? format(
                                new Date(member.employmentPeriods[0].endDate),
                                "MMM d, yyyy"
                              )
                            : "-"}
                        </TableCell>
                        {d.accessReadinessEnabled && (
                          <TableCell>
                            <FormerAccessRiskCell d={d} memberId={member.id} />
                          </TableCell>
                        )}
                      </>
                    )}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-crew-actions-${member.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!isFormerView && (
                            <>
                              {d.accessReadinessEnabled && canManageAccess && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    d.handleViewProfile(member as CrewListItem, "access")
                                  }
                                  data-testid={`action-access-${member.id}`}
                                >
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  {member.userId ? "Review Access" : "Set Up Access"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => d.handleViewProfile(member as CrewListItem)}
                                data-testid={`action-view-${member.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              {canManageCrew && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => d.handleEditCrew(member as CrewListItem)}
                                    data-testid={`action-edit-${member.id}`}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => d.handleToggleDuty(member.id)}
                                    data-testid={`action-toggle-duty-${member.id}`}
                                  >
                                    <Power className="h-4 w-4 mr-2" />
                                    {member.onDuty ? "End Duty" : "Start Duty"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openLifecycle("retire", member.id, member.name)}
                                    data-testid={`action-retire-${member.id}`}
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Retire
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openLifecycle("cancel", member.id, member.name)}
                                    className="text-destructive"
                                    data-testid={`action-cancel-${member.id}`}
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel Contract
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                          {isFormerView && (
                            <>
                              <DropdownMenuItem
                                onClick={() => d.handleViewProfile(member as CrewListItem)}
                                data-testid={`action-view-${member.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              {canManageCrew && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    openLifecycle("reinstate", member.id, member.name)
                                  }
                                  data-testid={`action-reinstate-${member.id}`}
                                >
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Reinstate
                                </DropdownMenuItem>
                              )}
                              {canDeleteCrew && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openLifecycle("delete", member.id, member.name)}
                                    className="text-destructive"
                                    data-testid={`action-delete-${member.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Record
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
