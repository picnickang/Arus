import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Ship,
  Loader2,
  Settings2,
  Calendar,
  Sparkles,
  Undo2, 
  Clock, 
  Trash2,
  Download,
  GitCompare,
  Check
} from "lucide-react";
import { exportTableToPDF } from "@/lib/exportUtils";
import { format, addDays } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  type SimulatedAssignment,
  type SimulationResult,
  type ApplyResult,
  type SchedulerRun,
  type ScheduleGeneratorPanelProps,
  getAssignmentStatusBadge,
  getInitials,
  getAvatarColor,
  getDeltaIcon
} from "./schedule-generator-types";

export function ScheduleGeneratorPanel({ isOpen, onOpenChange }: ScheduleGeneratorPanelProps) {
  const { toast } = useToast();
  const { currentOrgId } = useOrganization();
  const [days, setDays] = useState(7);
  const [allowUpdateDrafts, setAllowUpdateDrafts] = useState(false);
  const [suggestOnlyMode, setSuggestOnlyMode] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [appliedRunId, setAppliedRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("preview");
  const [configOpen, setConfigOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedVessels, setExpandedVessels] = useState<Set<string>>(new Set());
  
  const [selectedRunsForCompare, setSelectedRunsForCompare] = useState<Set<string>>(new Set());
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  
  const [selectedVesselsForApply, setSelectedVesselsForApply] = useState<Set<string>>(new Set());
  const [applyConfirmModalOpen, setApplyConfirmModalOpen] = useState(false);

  const from = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const to = useMemo(() => format(addDays(new Date(), days), "yyyy-MM-dd"), [days]);

  const simulateMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/schedule/simulate", { from, days, fillUnassignedOnly: !allowUpdateDrafts }),
    onSuccess: (data: SimulationResult) => {
      setSimulationResult(data);
      setAppliedRunId(null);
      setActiveTab("preview");
      const allVesselIds = new Set(data.proposed.map(p => p.vesselId));
      setExpandedVessels(allVesselIds);
      setSelectedVesselsForApply(allVesselIds);
      toast({ title: "Simulation Complete", description: `Generated ${data.stats.proposed} proposals` });
    },
    onError: (error: Error) => toast({ title: "Simulation Failed", description: error.message, variant: "destructive" }),
  });

  const applyMutation = useMutation({
    mutationFn: async (vesselIds?: string[]) => {
      if (!simulationResult) throw new Error("No simulation result to apply");
      return apiRequest("POST", "/api/schedule/apply-draft", { 
        simulationResult, 
        skipCollisions: true,
        vesselIds: vesselIds && vesselIds.length > 0 ? vesselIds : undefined
      });
    },
    onSuccess: (data: ApplyResult) => {
      setAppliedRunId(data.runId);
      queryClient.invalidateQueries({ queryKey: ["/api/crew-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/runs"] });
      setApplyConfirmModalOpen(false);
      toast({ title: "Applied as Drafts", description: `Created ${data.applied} draft assignments` });
    },
    onError: (error: Error) => toast({ title: "Apply Failed", description: error.message, variant: "destructive" }),
  });

  const runsQuery = useQuery<SchedulerRun[]>({
    queryKey: ["/api/schedule/runs"],
  });
  const runs = runsQuery.data || [];

  const revertMutation = useMutation({
    mutationFn: async (runId: string) => apiRequest("POST", `/api/schedule/revert/${runId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/runs"] });
      setAppliedRunId(null);
      toast({ title: "Reverted", description: "Draft assignments have been removed" });
    },
    onError: (error: Error) => toast({ title: "Revert Failed", description: error.message, variant: "destructive" }),
  });

  const clearHistoryMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", "/api/schedule/runs"),
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/runs"] });
      setAppliedRunId(null);
      setSimulationResult(null);
      setSelectedRunsForCompare(new Set());
      toast({ title: "History Cleared", description: `Removed ${data.deleted} run records` });
    },
    onError: (error: Error) => toast({ title: "Clear Failed", description: error.message, variant: "destructive" }),
  });

  const stats = simulationResult?.stats;
  const proposed = simulationResult?.proposed || [];
  const unfilled = simulationResult?.unfilled || [];

  const newAssignments = proposed.filter((a) => a.isNew && !a.wouldCollide);

  const vesselGroups = useMemo(() => {
    const groups = new Map<string, { vesselName: string; assignments: SimulatedAssignment[]; hasCollisions: boolean; warningCount: number }>();
    newAssignments.forEach(a => {
      const existing = groups.get(a.vesselId);
      const hasWarning = a.status === "warning" || !!a.warningReason;
      if (existing) {
        existing.assignments.push(a);
        if (hasWarning) existing.warningCount++;
      } else {
        groups.set(a.vesselId, { 
          vesselName: a.vesselName, 
          assignments: [a], 
          hasCollisions: false,
          warningCount: hasWarning ? 1 : 0
        });
      }
    });
    const collisions = simulationResult?.collisions || [];
    collisions.forEach(c => {
      const vesselId = proposed.find(p => p.crewId === c.proposedCrewId)?.vesselId;
      if (vesselId && groups.has(vesselId)) {
        groups.get(vesselId)!.hasCollisions = true;
      }
    });
    return groups;
  }, [newAssignments, simulationResult?.collisions, proposed]);

  const toggleVessel = (vesselId: string) => {
    const newSet = new Set(expandedVessels);
    if (newSet.has(vesselId)) {
      newSet.delete(vesselId);
    } else {
      newSet.add(vesselId);
    }
    setExpandedVessels(newSet);
  };

  const toggleVesselSelection = (vesselId: string) => {
    const newSet = new Set(selectedVesselsForApply);
    if (newSet.has(vesselId)) {
      newSet.delete(vesselId);
    } else {
      newSet.add(vesselId);
    }
    setSelectedVesselsForApply(newSet);
  };

  const toggleAllVessels = () => {
    if (selectedVesselsForApply.size === vesselGroups.size) {
      setSelectedVesselsForApply(new Set());
    } else {
      setSelectedVesselsForApply(new Set(vesselGroups.keys()));
    }
  };

  const toggleRunSelection = (runId: string) => {
    const newSet = new Set(selectedRunsForCompare);
    if (newSet.has(runId)) {
      newSet.delete(runId);
    } else if (newSet.size < 2) {
      newSet.add(runId);
    } else {
      const firstItem = newSet.values().next().value;
      newSet.delete(firstItem);
      newSet.add(runId);
    }
    setSelectedRunsForCompare(newSet);
  };

  const selectedRunsArray = useMemo(() => {
    const selected = runs.filter(r => selectedRunsForCompare.has(r.id));
    return selected.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [runs, selectedRunsForCompare]);

  const comparisonData = useMemo(() => {
    if (selectedRunsArray.length !== 2) return null;
    const [baseline, candidate] = selectedRunsArray;
    const statsBaseline = baseline.stats || { proposed: 0, unfilled: 0, collisions: 0 };
    const statsCandidate = candidate.stats || { proposed: 0, unfilled: 0, collisions: 0 };
    
    return {
      baseline,
      candidate,
      deltas: {
        proposed: statsCandidate.proposed - statsBaseline.proposed,
        unfilled: statsCandidate.unfilled - statsBaseline.unfilled,
        collisions: statsCandidate.collisions - statsBaseline.collisions,
      }
    };
  }, [selectedRunsArray]);

  const selectedVesselStats = useMemo(() => {
    let totalAssignments = 0;
    let warningCount = 0;
    let collisionCount = 0;
    selectedVesselsForApply.forEach(vesselId => {
      const group = vesselGroups.get(vesselId);
      if (group) {
        totalAssignments += group.assignments.length;
        warningCount += group.warningCount;
        if (group.hasCollisions) collisionCount++;
      }
    });
    return { totalAssignments, warningCount, collisionCount };
  }, [selectedVesselsForApply, vesselGroups]);

  if (!isOpen) {
    return (
      <div className="hidden md:flex border-l bg-muted/30 flex-col items-center p-2">
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(true)} data-testid="button-open-generator">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="mt-2 writing-mode-vertical text-xs text-muted-foreground flex items-center gap-1" style={{ writingMode: 'vertical-rl' }}>
          <Sparkles className="h-3 w-3" />
          Generator
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "border-l flex flex-col bg-background transition-all duration-200",
      isOpen ? "w-80 md:w-96" : "w-0"
    )} data-testid="panel-schedule-generator">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Schedule Generator
        </h3>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7"
          onClick={() => onOpenChange(false)}
          data-testid="button-close-generator"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="justify-start px-3 pt-1 border-b rounded-none bg-transparent h-auto">
          <TabsTrigger 
            value="preview" 
            className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-1.5"
            data-testid="tab-preview"
          >
            Preview
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-1.5"
            data-testid="tab-history"
          >
            History
          </TabsTrigger>
          <TabsTrigger 
            value="unfilled" 
            className="text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-1.5 text-muted-foreground"
            data-testid="tab-unfilled"
          >
            Unfilled
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="history" className="p-3 m-0 space-y-3">
            {runsQuery.isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-history">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No run history yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs h-7"
                    disabled={selectedRunsForCompare.size !== 2}
                    onClick={() => setCompareModalOpen(true)}
                    data-testid="button-compare-runs"
                  >
                    <GitCompare className="h-3 w-3" />
                    Compare ({selectedRunsForCompare.size}/2)
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-destructive hover:text-destructive h-7"
                    onClick={() => clearHistoryMutation.mutate()}
                    disabled={clearHistoryMutation.isPending}
                    data-testid="button-clear-history"
                  >
                    {clearHistoryMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Clear
                  </Button>
                </div>
                {runs.map((run) => (
                  <div 
                    key={run.id} 
                    className={cn(
                      "border rounded-md p-3 space-y-2 transition-colors",
                      selectedRunsForCompare.has(run.id) && "border-primary bg-primary/5"
                    )}
                    data-testid={`card-run-${run.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedRunsForCompare.has(run.id)}
                        onCheckedChange={() => toggleRunSelection(run.id)}
                        data-testid={`checkbox-run-${run.id}`}
                      />
                      <div className="flex items-center justify-between gap-2 flex-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{format(new Date(run.createdAt), "MMM d, h:mm a")}</span>
                        </div>
                        <Badge 
                          className={cn("text-[10px] px-1.5 py-0",
                            run.status === "applied" 
                              ? "bg-green-500/20 text-green-400 border-green-500/30" 
                              : run.status === "cancelled" 
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : run.status === "draft"
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          )}
                        >
                          {run.status}
                        </Badge>
                      </div>
                    </div>
                    {run.stats && (
                      <div className="flex items-center gap-2 text-xs pl-6">
                        <span className="text-green-400">{run.stats.proposed}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-amber-400">{run.stats.unfilled}</span>
                        {run.stats.collisions > 0 && (
                          <>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-red-400">{run.stats.collisions}</span>
                          </>
                        )}
                      </div>
                    )}
                    {(run.status === "applied" || run.status === "draft") && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full gap-1 h-7 text-xs"
                        onClick={() => revertMutation.mutate(run.id)}
                        disabled={revertMutation.isPending}
                        data-testid={`button-revert-${run.id}`}
                      >
                        {revertMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Undo2 className="h-3 w-3" />
                        )}
                        Revert
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="p-3 m-0 space-y-3">
            <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
              <div className="border rounded-md">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover-elevate text-sm" data-testid="trigger-config">
                  <span className="font-medium">Configure</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${configOpen ? '' : '-rotate-90'}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Planning Horizon</Label>
                      <Select value={days.toString()} onValueChange={(v) => setDays(Number.parseInt(v))}>
                        <SelectTrigger data-testid="select-days" className="mt-1 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 days</SelectItem>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {from} to {to}
                    </div>

                    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover-elevate" data-testid="trigger-advanced">
                        <Settings2 className="h-3 w-3" />
                        <span>Advanced</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${advancedOpen ? '' : '-rotate-90'}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch 
                            id="update-drafts" 
                            checked={allowUpdateDrafts} 
                            onCheckedChange={setAllowUpdateDrafts} 
                            data-testid="switch-update-drafts" 
                          />
                          <Label htmlFor="update-drafts" className="text-xs">
                            Update existing drafts
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            id="suggest-only" 
                            checked={suggestOnlyMode} 
                            onCheckedChange={setSuggestOnlyMode} 
                            data-testid="switch-suggest-only" 
                          />
                          <Label htmlFor="suggest-only" className="text-xs">
                            Suggest-only mode
                          </Label>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {simulationResult && (
              <>
                <div className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs" data-testid="badge-generated">
                        {stats?.proposed || 0} generated
                      </Badge>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs" data-testid="badge-unfilled">
                        {stats?.unfilled || 0} unfilled
                      </Badge>
                      {(stats?.collisions || 0) > 0 && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs" data-testid="badge-blocked">
                          {stats?.collisions} blocked
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={async () => {
                        const rows = newAssignments.map(a => [
                          a.vesselName,
                          a.crewName,
                          a.role,
                          format(new Date(a.start), "MMM d, yyyy"),
                          format(new Date(a.end), "MMM d, yyyy"),
                          a.whySelected || "N/A"
                        ]);
                        const success = await exportTableToPDF(
                          {
                            headers: ["Vessel", "Crew", "Role", "Start", "End", "Reason"],
                            rows
                          },
                          {
                            filename: `schedule-proposal-${format(new Date(), "yyyy-MM-dd")}.pdf`,
                            title: "Schedule Proposal",
                            subtitle: `Generated on ${format(new Date(), "MMM d, yyyy 'at' h:mm a")} - ${stats?.proposed || 0} assignments`
                          }
                        );
                        if (success) {
                          toast({ title: "PDF exported successfully" });
                        }
                      }}
                      data-testid="button-export-pdf"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedVesselsForApply.size === vesselGroups.size && vesselGroups.size > 0}
                        onCheckedChange={toggleAllVessels}
                        data-testid="checkbox-select-all-vessels"
                      />
                      <h4 className="font-medium text-sm">Draft Proposals ({vesselGroups.size})</h4>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1 h-7 text-xs"
                      disabled={selectedVesselsForApply.size === 0 || applyMutation.isPending}
                      onClick={() => setApplyConfirmModalOpen(true)}
                      data-testid="button-apply-selected"
                    >
                      <Send className="h-3 w-3" />
                      Apply ({selectedVesselsForApply.size})
                    </Button>
                  </div>
                  
                  {Array.from(vesselGroups.entries()).map(([vesselId, group]) => (
                    <Collapsible 
                      key={vesselId} 
                      open={expandedVessels.has(vesselId)} 
                      onOpenChange={() => toggleVessel(vesselId)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedVesselsForApply.has(vesselId)}
                          onCheckedChange={() => toggleVesselSelection(vesselId)}
                          data-testid={`checkbox-vessel-${vesselId}`}
                        />
                        <CollapsibleTrigger className="flex items-center justify-between flex-1 py-1.5 hover-elevate text-sm" data-testid={`trigger-vessel-${vesselId}`}>
                          <div className="flex items-center gap-1.5">
                            <Ship className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-xs">{group.vesselName}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {group.hasCollisions && (
                              <Badge variant="destructive" className="text-[10px] px-1.5">
                                <XCircle className="h-2.5 w-2.5 mr-0.5" />
                                Conflicts
                              </Badge>
                            )}
                            {group.warningCount > 0 && !group.hasCollisions && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                {group.warningCount}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              {group.assignments.length}
                            </Badge>
                            <ChevronDown className={`h-3 w-3 transition-transform ${expandedVessels.has(vesselId) ? '' : '-rotate-90'}`} />
                          </div>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="space-y-1.5 pl-8 pt-1.5">
                        {group.assignments.map((assignment) => (
                          <div 
                            key={assignment.id}
                            className={`flex items-start gap-2 p-2 rounded-md border border-dashed ${
                              assignment.status === "warning" 
                                ? "border-amber-500/50 bg-amber-500/5" 
                                : "border-cyan-500/50 bg-cyan-500/5"
                            }`}
                            data-testid={`card-assignment-${assignment.id}`}
                          >
                            <Avatar className={`h-6 w-6 ${getAvatarColor(assignment.crewName)}`}>
                              <AvatarFallback className="text-[10px] text-white bg-transparent">
                                {getInitials(assignment.crewName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-xs truncate">{assignment.crewName}</span>
                                {getAssignmentStatusBadge(assignment)}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {assignment.role} | {format(new Date(assignment.start), "MMM d")} - {format(new Date(assignment.end), "MMM d")}
                              </div>
                              {assignment.whySelected && (
                                <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic truncate">
                                  {assignment.whySelected}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1 gap-1 text-xs"
                onClick={() => simulateMutation.mutate()}
                disabled={simulateMutation.isPending}
                data-testid="button-simulate"
              >
                {simulateMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {simulateMutation.isPending ? "Generating..." : "Generate Schedule"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="unfilled" className="p-3 m-0 space-y-3">
            {unfilled.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-unfilled">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All slots filled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unfilled.map((slot, index) => (
                  <div 
                    key={`${slot.day}-${slot.shiftId}-${index}`}
                    className="border rounded-md p-3 space-y-1.5"
                    data-testid={`card-unfilled-${index}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{format(new Date(slot.day), "MMM d, yyyy")}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        Need {slot.need}
                      </Badge>
                    </div>
                    {slot.vesselName && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Ship className="h-3 w-3" />
                        <span>{slot.vesselName}</span>
                      </div>
                    )}
                    <div className="text-xs text-amber-400">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      {slot.reason}
                    </div>
                    {slot.rejectedCrew && slot.rejectedCrew.length > 0 && (
                      <div className="pt-1.5 border-t mt-1.5">
                        <div className="text-[10px] text-muted-foreground mb-1">Rejected candidates:</div>
                        {slot.rejectedCrew.slice(0, 3).map((crew, i) => (
                          <div key={crew.crewId} className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                            <XCircle className="h-2.5 w-2.5 text-red-400" />
                            {crew.crewName}: {crew.reason}
                          </div>
                        ))}
                        {slot.rejectedCrew.length > 3 && (
                          <div className="text-[10px] text-muted-foreground/50">
                            +{slot.rejectedCrew.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <Dialog open={compareModalOpen} onOpenChange={setCompareModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Compare Simulations
            </DialogTitle>
            <DialogDescription>
              Baseline (older) vs Candidate (newer) comparison
            </DialogDescription>
          </DialogHeader>
          
          {comparisonData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-md p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Baseline (Older)</div>
                  <div className="text-sm font-medium">{format(new Date(comparisonData.baseline.createdAt), "MMM d, h:mm a")}</div>
                  <Badge 
                    className={cn("text-[10px]",
                      comparisonData.baseline.status === "applied" 
                        ? "bg-green-500/20 text-green-400 border-green-500/30" 
                        : comparisonData.baseline.status === "draft"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    )}
                  >
                    {comparisonData.baseline.status}
                  </Badge>
                </div>
                <div className="border rounded-md p-3 space-y-1 border-primary/50">
                  <div className="text-xs text-muted-foreground">Candidate (Newer)</div>
                  <div className="text-sm font-medium">{format(new Date(comparisonData.candidate.createdAt), "MMM d, h:mm a")}</div>
                  <Badge 
                    className={cn("text-[10px]",
                      comparisonData.candidate.status === "applied" 
                        ? "bg-green-500/20 text-green-400 border-green-500/30" 
                        : comparisonData.candidate.status === "draft"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    )}
                  >
                    {comparisonData.candidate.status}
                  </Badge>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 text-xs font-medium">Metric</th>
                      <th className="text-center p-2 text-xs font-medium">Baseline</th>
                      <th className="text-center p-2 text-xs font-medium">Candidate</th>
                      <th className="text-center p-2 text-xs font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-2 text-xs">Proposed</td>
                      <td className="p-2 text-center text-xs">{comparisonData.baseline.stats?.proposed || 0}</td>
                      <td className="p-2 text-center text-xs">{comparisonData.candidate.stats?.proposed || 0}</td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-xs">
                          {getDeltaIcon(comparisonData.deltas.proposed, 'proposed')}
                          <span className={comparisonData.deltas.proposed > 0 ? "text-green-400" : comparisonData.deltas.proposed < 0 ? "text-amber-400" : ""}>
                            {comparisonData.deltas.proposed > 0 ? "+" : ""}{comparisonData.deltas.proposed}
                          </span>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2 text-xs">Unfilled</td>
                      <td className="p-2 text-center text-xs">{comparisonData.baseline.stats?.unfilled || 0}</td>
                      <td className="p-2 text-center text-xs">{comparisonData.candidate.stats?.unfilled || 0}</td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-xs">
                          {getDeltaIcon(comparisonData.deltas.unfilled, 'unfilled')}
                          <span className={comparisonData.deltas.unfilled < 0 ? "text-green-400" : comparisonData.deltas.unfilled > 0 ? "text-red-400" : ""}>
                            {comparisonData.deltas.unfilled > 0 ? "+" : ""}{comparisonData.deltas.unfilled}
                          </span>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-t">
                      <td className="p-2 text-xs">Collisions</td>
                      <td className="p-2 text-center text-xs">{comparisonData.baseline.stats?.collisions || 0}</td>
                      <td className="p-2 text-center text-xs">{comparisonData.candidate.stats?.collisions || 0}</td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-xs">
                          {getDeltaIcon(comparisonData.deltas.collisions, 'collisions')}
                          <span className={comparisonData.deltas.collisions < 0 ? "text-green-400" : comparisonData.deltas.collisions > 0 ? "text-red-400" : ""}>
                            {comparisonData.deltas.collisions > 0 ? "+" : ""}{comparisonData.deltas.collisions}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-muted-foreground text-center p-2 border rounded-md bg-muted/30">
                {comparisonData.deltas.proposed >= 0 && comparisonData.deltas.unfilled <= 0 && comparisonData.deltas.collisions <= 0 
                  ? comparisonData.deltas.proposed > 0 || comparisonData.deltas.unfilled < 0 || comparisonData.deltas.collisions < 0
                    ? "Candidate appears to be an improvement"
                    : "Both runs have similar results"
                  : comparisonData.deltas.proposed < 0 && comparisonData.deltas.unfilled >= 0 && comparisonData.deltas.collisions >= 0
                  ? "Baseline appears to have better coverage"
                  : "Mixed results - review individual metrics"}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompareModalOpen(false)} data-testid="button-close-compare">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={applyConfirmModalOpen} onOpenChange={setApplyConfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Apply Drafts to Selected Vessels
            </DialogTitle>
            <DialogDescription>
              Review the assignments before applying
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="text-sm">
              You are about to apply draft assignments to:
            </div>
            
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {Array.from(selectedVesselsForApply).map(vesselId => {
                const group = vesselGroups.get(vesselId);
                if (!group) return null;
                return (
                  <div key={vesselId} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-400" />
                    <Ship className="h-3 w-3 text-muted-foreground" />
                    <span>{group.vesselName}</span>
                    <span className="text-muted-foreground">({group.assignments.length} assignments)</span>
                  </div>
                );
              })}
            </div>

            <div className="border rounded-md p-3 bg-muted/30 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>Total Assignments</span>
                <span className="font-medium text-green-400">{selectedVesselStats.totalAssignments}</span>
              </div>
              {selectedVesselStats.warningCount > 0 && (
                <div className="flex items-center justify-between text-sm text-amber-400">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Soft Warnings
                  </span>
                  <span>{selectedVesselStats.warningCount}</span>
                </div>
              )}
              {selectedVesselStats.collisionCount > 0 && (
                <div className="flex items-center justify-between text-sm text-red-400">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Vessels with Collisions
                  </span>
                  <span>{selectedVesselStats.collisionCount}</span>
                </div>
              )}
            </div>
            
            {selectedVesselsForApply.size === 0 && (
              <div className="text-sm text-destructive text-center">
                Please select at least one vessel to apply
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApplyConfirmModalOpen(false)} data-testid="button-cancel-apply">
              Cancel
            </Button>
            <Button 
              onClick={() => applyMutation.mutate(Array.from(selectedVesselsForApply))}
              disabled={applyMutation.isPending || selectedVesselsForApply.size === 0}
              data-testid="button-confirm-apply"
            >
              {applyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Apply {selectedVesselStats.totalAssignments} Drafts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
