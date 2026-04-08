import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Edit, Trash2, Search, X, Download, UserCheck, ArrowUpDown, ArrowUp, ArrowDown, ShipWheel, Eye, MoreHorizontal, UserX, UserPlus, Calendar, Power, ChevronDown, ChevronRight, User, DollarSign, Phone, FileText } from "lucide-react";
import { CertificationExpiryAlertBanner } from "@/components/CertificationExpiryAlerts";
import { DocumentExpiryAlertBanner } from "@/components/DocumentExpiryAlerts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveCrewStats, FormerCrewStats, CrewViewDialogContent } from "@/components/unified-crew-components";
import { MARITIME_RANKS, COMMON_SKILLS, capitalizeNames, formatRank, type SortField, useUnifiedCrewData, useFormerCrew, useRetireCrew, useCancelContract, useReinstateCrew, useDeleteFormerCrew, type EmploymentHistoryRecord } from "@/features/crew";
import { format } from "date-fns";

export function UnifiedCrewManagement() {
  const d = useUnifiedCrewData();
  const [rosterView, setRosterView] = useState<"active" | "former">("active");
  const [lifecycleDialogOpen, setLifecycleDialogOpen] = useState(false);
  const [contactSectionOpen, setContactSectionOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<"retire" | "cancel" | "reinstate" | "delete" | null>(null);
  const [lifecycleCrewId, setLifecycleCrewId] = useState<string | null>(null);
  const [lifecycleCrewName, setLifecycleCrewName] = useState<string>("");
  const [lifecycleNotes, setLifecycleNotes] = useState("");
  const [applyPenalty, setApplyPenalty] = useState(false);

  const { data: formerCrew = [], isLoading: formerLoading } = useFormerCrew();
  const retireMutation = useRetireCrew();
  const cancelMutation = useCancelContract();
  const reinstateMutation = useReinstateCrew();
  const deleteMutation = useDeleteFormerCrew();

  const getSortIcon = (field: SortField) => {
    if (d.sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return d.sortDirection === "asc" ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const getAriaSort = (field: SortField): "ascending" | "descending" | "none" => {
    if (d.sortField !== field) return "none";
    return d.sortDirection === "asc" ? "ascending" : "descending";
  };

  const openLifecycleDialog = (action: "retire" | "cancel" | "reinstate" | "delete", crewId: string, crewName: string) => {
    setLifecycleAction(action);
    setLifecycleCrewId(crewId);
    setLifecycleCrewName(crewName);
    setLifecycleNotes("");
    setApplyPenalty(false);
    setLifecycleDialogOpen(true);
  };

  const closeLifecycleDialog = () => {
    setLifecycleDialogOpen(false);
    setLifecycleAction(null);
    setLifecycleCrewId(null);
    setLifecycleCrewName("");
    setLifecycleNotes("");
    setApplyPenalty(false);
  };

  const handleLifecycleAction = () => {
    if (!lifecycleCrewId || !lifecycleAction) return;

    switch (lifecycleAction) {
      case "retire":
        retireMutation.mutate({ crewId: lifecycleCrewId, notes: lifecycleNotes || undefined }, { onSuccess: closeLifecycleDialog });
        break;
      case "cancel":
        cancelMutation.mutate({ crewId: lifecycleCrewId, notes: lifecycleNotes || undefined, applyPenalty }, { onSuccess: closeLifecycleDialog });
        break;
      case "reinstate":
        reinstateMutation.mutate({ crewId: lifecycleCrewId, notes: lifecycleNotes || undefined }, { onSuccess: closeLifecycleDialog });
        break;
      case "delete":
        deleteMutation.mutate(lifecycleCrewId, { onSuccess: closeLifecycleDialog });
        break;
    }
  };

  const getLifecycleDialogTitle = () => {
    switch (lifecycleAction) {
      case "retire": return "Retire Crew Member";
      case "cancel": return "Cancel Contract";
      case "reinstate": return "Reinstate Crew Member";
      case "delete": return "Delete Former Crew Record";
      default: return "";
    }
  };

  const getLifecycleDialogDescription = () => {
    switch (lifecycleAction) {
      case "retire": return `${lifecycleCrewName} will be moved to the former crew roster.`;
      case "cancel": return `${lifecycleCrewName}'s contract will be terminated and they will be moved to the former crew roster.`;
      case "reinstate": return `${lifecycleCrewName} will be restored to the active crew roster.`;
      case "delete": return `This will permanently delete ${lifecycleCrewName}'s record. This action cannot be undone.`;
      default: return "";
    }
  };

  const isLifecyclePending = retireMutation.isPending || cancelMutation.isPending || reinstateMutation.isPending || deleteMutation.isPending;

  if (d.crewLoading) {
    return <div className="p-6">Loading crew data...</div>;
  }

  const activeCrewOnly = d.filteredAndSortedCrew.filter((c) => c.active);
  const displayCrew = rosterView === "active" ? activeCrewOnly : formerCrew;
  const isFormerView = rosterView === "former";

  return (
    <div className="space-y-6">
      <CertificationExpiryAlertBanner />
      <DocumentExpiryAlertBanner />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={rosterView} onValueChange={(v) => setRosterView(v as "active" | "former")} className="w-auto">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active-roster">
              <UserCheck className="h-4 w-4 mr-2" />
              Active Roster ({d.crew.filter((c) => c.active).length})
            </TabsTrigger>
            <TabsTrigger value="former" data-testid="tab-former-roster">
              <UserX className="h-4 w-4 mr-2" />
              Former Crew ({formerCrew.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button onClick={d.handleExportCSV} variant="outline" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
          {!isFormerView && (
            <Button onClick={() => d.setIsAddCrewDialogOpen(true)} data-testid="button-add-crew">
              <Plus className="h-4 w-4 mr-2" />Add Crew Member
            </Button>
          )}
        </div>
      </div>

      {!isFormerView && <ActiveCrewStats stats={d.stats} />}
      {isFormerView && <FormerCrewStats count={formerCrew.length} />}

      {!isFormerView && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search & Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                  {d.vessels.filter((v) => v.active).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
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
                    <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={d.selectedStatus} onValueChange={d.setSelectedStatus}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                  <SelectItem value="on_duty">On Duty</SelectItem>
                  <SelectItem value="off_duty">Off Duty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground" data-testid="text-result-count">
                Showing {d.filteredAndSortedCrew.length} of {d.crew.length} crew members
                {d.activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">{d.activeFilterCount} filter{d.activeFilterCount > 1 ? "s" : ""}</Badge>
                )}
              </p>
              {d.activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={d.clearFilters}>
                  <X className="h-4 w-4 mr-1" />Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isFormerView ? "Former Crew" : "Crew Roster"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-accent" onClick={() => d.handleSort("name")} aria-sort={getAriaSort("name")}>
                    <div className="flex items-center">Name{getSortIcon("name")}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-accent" onClick={() => d.handleSort("rank")} aria-sort={getAriaSort("rank")}>
                    <div className="flex items-center">Rank{getSortIcon("rank")}</div>
                  </TableHead>
                  {!isFormerView && (
                    <>
                      <TableHead className="cursor-pointer hover:bg-accent" onClick={() => d.handleSort("vessel")} aria-sort={getAriaSort("vessel")}>
                        <div className="flex items-center">Vessel{getSortIcon("vessel")}</div>
                      </TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead className="cursor-pointer hover:bg-accent" onClick={() => d.handleSort("status")} aria-sort={getAriaSort("status")}>
                        <div className="flex items-center">Status{getSortIcon("status")}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-accent" onClick={() => d.handleSort("duty")} aria-sort={getAriaSort("duty")}>
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
                {(isFormerView && formerLoading) ? (
                  <TableRow>
                    <TableCell colSpan={isFormerView ? 5 : 8} className="text-center py-8 text-muted-foreground">
                      Loading former crew...
                    </TableCell>
                  </TableRow>
                ) : displayCrew.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isFormerView ? 5 : 8} className="text-center py-8 text-muted-foreground">
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
                      <TableCell className="font-medium" data-testid={`text-crew-name-${member.id}`}>
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
                                <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                              ))}
                              {member.skills?.length > 2 && (
                                <Badge variant="secondary" className="text-xs">+{member.skills.length - 2}</Badge>
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
                            <span className="text-sm text-muted-foreground">{member.maxHours7d}h/wk</span>
                          </TableCell>
                        </>
                      )}
                      {isFormerView && (
                        <>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {member.employmentPeriods?.length > 0 ? (
                                member.employmentPeriods.map((period: EmploymentHistoryRecord) => (
                                  <div key={period.id} className="flex items-center gap-2 text-xs">
                                    <Badge variant={period.terminationType === "retired" ? "secondary" : "destructive"} className="text-xs">
                                      {period.terminationType === "retired" ? "Retired" : "Cancelled"}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {format(new Date(period.startDate), "MMM yyyy")} - {period.endDate ? format(new Date(period.endDate), "MMM yyyy") : "Present"}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">No history</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.employmentPeriods?.[0]?.endDate ? format(new Date(member.employmentPeriods[0].endDate), "MMM d, yyyy") : "-"}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-crew-actions-${member.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!isFormerView && (
                              <>
                                <DropdownMenuItem onClick={() => d.handleViewProfile(member)} data-testid={`action-view-${member.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => d.handleEditCrew(member)} data-testid={`action-edit-${member.id}`}>
                                  <Edit className="h-4 w-4 mr-2" />Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => d.handleToggleDuty(member.id)} data-testid={`action-toggle-duty-${member.id}`}>
                                  <Power className="h-4 w-4 mr-2" />{member.onDuty ? "End Duty" : "Start Duty"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openLifecycleDialog("retire", member.id, member.name)} data-testid={`action-retire-${member.id}`}>
                                  <UserX className="h-4 w-4 mr-2" />Retire
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openLifecycleDialog("cancel", member.id, member.name)} className="text-destructive" data-testid={`action-cancel-${member.id}`}>
                                  <X className="h-4 w-4 mr-2" />Cancel Contract
                                </DropdownMenuItem>
                              </>
                            )}
                            {isFormerView && (
                              <>
                                <DropdownMenuItem onClick={() => d.handleViewProfile(member)} data-testid={`action-view-${member.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />View Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openLifecycleDialog("reinstate", member.id, member.name)} data-testid={`action-reinstate-${member.id}`}>
                                  <UserPlus className="h-4 w-4 mr-2" />Reinstate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openLifecycleDialog("delete", member.id, member.name)} className="text-destructive" data-testid={`action-delete-${member.id}`}>
                                  <Trash2 className="h-4 w-4 mr-2" />Delete Record
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

      <ResponsiveDialog
        open={lifecycleDialogOpen}
        onOpenChange={(open) => { if (!open) closeLifecycleDialog(); }}
        title={getLifecycleDialogTitle()}
        description={getLifecycleDialogDescription()}
        footer={
          <div className="flex gap-2 w-full">
            <Button type="button" variant="outline" onClick={closeLifecycleDialog} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              variant={lifecycleAction === "delete" || lifecycleAction === "cancel" ? "destructive" : "default"}
              onClick={handleLifecycleAction}
              disabled={isLifecyclePending}
              className="flex-1"
              data-testid="button-confirm-lifecycle"
            >
              {isLifecyclePending ? "Processing..." : lifecycleAction === "delete" ? "Delete Permanently" : "Confirm"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {lifecycleAction !== "delete" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={lifecycleNotes}
                onChange={(e) => setLifecycleNotes(e.target.value)}
                placeholder="Add any notes about this action..."
                data-testid="input-lifecycle-notes"
              />
            </div>
          )}
          {lifecycleAction === "cancel" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="applyPenalty"
                checked={applyPenalty}
                onCheckedChange={(checked) => setApplyPenalty(checked === true)}
                data-testid="checkbox-apply-penalty"
              />
              <label htmlFor="applyPenalty" className="text-sm font-medium leading-none cursor-pointer">
                Apply contract penalty (if configured)
              </label>
            </div>
          )}
          {lifecycleAction === "delete" && (
            <div className="bg-destructive/10 p-3 rounded-md">
              <p className="text-sm text-destructive">
                This action is permanent and cannot be undone. All employment history for this crew member will also be deleted.
              </p>
            </div>
          )}
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={d.isAddCrewDialogOpen || d.isEditCrewDialogOpen}
        onOpenChange={(open) => { if (!open) d.closeCrewDialog(); }}
        title={d.editingCrew ? "Edit Crew Member" : "Add New Crew Member"}
        description={d.editingCrew ? "Update crew member information" : "Register a new crew member with maritime qualifications"}
        footer={
          <div className="flex gap-2 w-full">
            <Button type="button" variant="outline" onClick={d.closeCrewDialog} className="flex-1">Cancel</Button>
            <Button
              type="submit"
              onClick={d.crewForm.handleSubmit(d.onSubmitCrew)}
              disabled={d.createCrewMutation.isPending || d.updateCrewMutation.isPending}
              className="flex-1"
              data-testid="button-save-crew"
            >
              {d.editingCrew ? "Update" : "Add"} Crew Member
            </Button>
          </div>
        }
      >
        <Form {...d.crewForm}>
          <form className="space-y-5">
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><User className="h-4 w-4" />Personal Information</h4>
              <div className="space-y-4">
                <FormField
                  control={d.crewForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Full name"
                          onChange={(e) => field.onChange(capitalizeNames(e.target.value))}
                          data-testid="input-crew-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={d.crewForm.control}
                    name="rank"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rank</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-crew-rank">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MARITIME_RANKS.map((rank) => (
                              <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={d.crewForm.control}
                    name="vesselId"
                    render={({ field }) => {
                      const activeVessels = d.vessels.filter((v) => v.active);
                      return (
                        <FormItem>
                          <FormLabel>Vessel (Optional)</FormLabel>
                          <Select
                            value={field.value || "_unassigned"}
                            onValueChange={(v) => field.onChange(v === "_unassigned" ? "" : v)}
                            disabled={d.vesselsLoading}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-crew-vessel">
                                <SelectValue placeholder={d.vesselsLoading ? "Loading vessels..." : "Select vessel"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="_unassigned">Unassigned</SelectItem>
                              {activeVessels.map((v) => (
                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4" />Assignment & Pay</h4>
              <div className="space-y-4">
                <FormField
                  control={d.crewForm.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Salary (SGD)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 45.00"
                          data-testid="input-hourly-rate"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? Number.parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={d.crewForm.control}
                    name="maxHours7d"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Hours/Week</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            data-testid="input-max-hours"
                            onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 72)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={d.crewForm.control}
                    name="minRestH"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Rest Hours</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            data-testid="input-min-rest"
                            onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 10)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <Collapsible open={contactSectionOpen} onOpenChange={setContactSectionOpen}>
                <CollapsibleTrigger className="w-full flex items-center justify-between" data-testid="toggle-contact-section">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Phone className="h-4 w-4" />Contact & Emergency</h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>{contactSectionOpen ? "Hide" : "Show"}</span>
                    {contactSectionOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4">
                  <FormField
                    control={d.crewForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (for alert notifications)</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="email@example.com" data-testid="input-crew-email" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">Used for certification and document expiry alerts</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={d.crewForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+65 9123 4567" data-testid="input-crew-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={d.crewForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Home address" data-testid="input-crew-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="border-t pt-3 mt-2">
                    <h5 className="text-xs font-medium text-muted-foreground mb-3">Emergency Contact</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={d.crewForm.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Emergency contact name" data-testid="input-emergency-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={d.crewForm.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="+65 9123 4567" data-testid="input-emergency-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" />Contract Dates</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={d.crewForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Start Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={d.crewForm.control}
                    name="contractEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract End Date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-contract-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={d.crewForm.control}
                  name="contractPenalty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Cancellation Penalty (SGD)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 5000.00"
                          data-testid="input-contract-penalty"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? Number.parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </form>
        </Form>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={d.isAddSkillDialogOpen}
        onOpenChange={(open) => { if (!open) d.closeSkillDialog(); }}
        title="Add Skill to Crew Member"
        description="Assign a maritime skill or certification"
        footer={
          <div className="flex gap-2 w-full">
            <Button type="button" variant="outline" onClick={d.closeSkillDialog} className="flex-1">Cancel</Button>
            <Button
              type="submit"
              onClick={d.skillForm.handleSubmit(d.onSubmitSkill)}
              disabled={d.addSkillMutation.isPending}
              className="flex-1"
              data-testid="button-save-skill"
            >
              Add Skill
            </Button>
          </div>
        }
      >
        <Form {...d.skillForm}>
          <form className="space-y-4">
            {d.skillAssignmentCrewId ? (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">Assigning skill to:</p>
                <p className="text-lg font-semibold">{d.crew.find((c) => c.id === d.skillAssignmentCrewId)?.name || "Unknown"}</p>
              </div>
            ) : (
              <FormField
                control={d.skillForm.control}
                name="crewId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Crew Member</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-skill-crew">
                          <SelectValue placeholder="Select crew member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {d.crew.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name} ({formatRank(member.rank)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={d.skillForm.control}
              name="skill"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skill</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-skill-name">
                        <SelectValue placeholder="Select skill" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMON_SKILLS.map((skill) => (
                        <SelectItem key={skill} value={skill}>
                          {skill.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={d.skillForm.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proficiency Level</FormLabel>
                  <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(Number.parseInt(v))}>
                    <FormControl>
                      <SelectTrigger data-testid="select-skill-level">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <SelectItem key={level} value={level.toString()}>
                          Level {level} {level === 1 ? "(Basic)" : level === 5 ? "(Expert)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={d.isViewProfileDialogOpen}
        onOpenChange={(open) => { if (!open) d.closeProfileDialog(); }}
        title={d.viewingCrew ? `${d.viewingCrew.name}` : "Crew Profile"}
        description={d.viewingCrew ? `${formatRank(d.viewingCrew.rank)} - View and manage crew member details` : ""}
        className="max-w-2xl"
      >
        {d.viewingCrew && <CrewViewDialogContent crew={d.viewingCrew} vessels={d.vessels} />}
      </ResponsiveDialog>
    </div>
  );
}
