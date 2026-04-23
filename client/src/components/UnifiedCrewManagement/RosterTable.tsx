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
} from "lucide-react";
import { format } from "date-fns";
import {
  formatRank,
  type SortField,
  type EmploymentHistoryRecord,
} from "@/features/crew";
import type { LifecycleAction } from "./LifecycleDialog";

export function RosterTable({
  d,
  isFormerView,
  formerLoading,
  displayCrew,
  openLifecycle,
}: {
  d: any;
  isFormerView: boolean;
  formerLoading: boolean;
  displayCrew: any[];
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isFormerView ? "Former Crew" : "Crew Roster"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[800px]">
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
                  </>
                )}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFormerView && formerLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={isFormerView ? 5 : 8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Loading former crew...
                  </TableCell>
                </TableRow>
              ) : displayCrew.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isFormerView ? 5 : 8}
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
                displayCrew.map((member: any) => (
                  <TableRow key={member.id} data-testid={`row-crew-${member.id}`}>
                    <TableCell
                      className="font-medium"
                      data-testid={`text-crew-name-${member.id}`}
                    >
                      {member.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatRank(member.rank)}</Badge>
                    </TableCell>
                    {!isFormerView && (
                      <>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <ShipWheel className="h-3 w-3 text-muted-foreground" />
                            <span>{d.getVesselName(member.vesselId) || "Unassigned"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {member.skills?.slice(0, 2).map((skill: string) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {member.skills?.length > 2 && (
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
                        <TableCell>
                          <Badge variant={member.onDuty ? "destructive" : "outline"}>
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
                            {member.employmentPeriods?.length > 0 ? (
                              member.employmentPeriods.map(
                                (period: EmploymentHistoryRecord) => (
                                  <div
                                    key={period.id}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <Badge
                                      variant={
                                        period.terminationType === "retired"
                                          ? "secondary"
                                          : "destructive"
                                      }
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
                              <DropdownMenuItem
                                onClick={() => d.handleViewProfile(member)}
                                data-testid={`action-view-${member.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => d.handleEditCrew(member)}
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
                          {isFormerView && (
                            <>
                              <DropdownMenuItem
                                onClick={() => d.handleViewProfile(member)}
                                data-testid={`action-view-${member.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  openLifecycle("reinstate", member.id, member.name)
                                }
                                data-testid={`action-reinstate-${member.id}`}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Reinstate
                              </DropdownMenuItem>
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
