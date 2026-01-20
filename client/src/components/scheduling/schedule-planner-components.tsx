import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, Ship, Users, AlertTriangle, Sparkles,
  CheckCircle2, Clock, Shield, RefreshCw, CloudOff, AlertCircle,
  User, Move, ChevronRight as ChevronRightIcon
} from "lucide-react";
import { format, isToday, isSameDay, parseISO } from "date-fns";
import {
  type ScheduleAssignment,
  type ConstraintResult,
  type AiSuggestion,
  type DateRangePreset,
  type SyncStatus,
  type CrewMember,
  type Vessel,
  type FatigueRiskLevel,
  type FatigueResult
} from "@/features/crew/hooks/useSchedulePlannerData";
import { type ProjectionViolation } from "@/features/crew/hooks/useHoRSync";
import { cn } from "@/lib/utils";
import {
  getRoleColor,
  DRAG_THRESHOLD_PX,
  MOBILE_LONG_PRESS_MS,
  type DragState,
} from "./schedule-planner-utils";
import { FatigueRiskBadge, DetailsTab, ConstraintsTab, SuggestionsTab } from "./schedule-planner-tabs";

export interface DragCompliancePreview {
  canAssign: boolean;
  violations: ProjectionViolation[];
  projectedRestHours: number;
  isLoading: boolean;
}

export function SyncStatusIndicator({ status, pendingCount = 0 }: { status: SyncStatus; pendingCount?: number }) {
  switch (status) {
    case "up_to_date":
      return (
        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400" data-testid="sync-status-up-to-date">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Up to date</span>
        </div>
      );
    case "syncing":
      return (
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400" data-testid="sync-status-syncing">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">
            {pendingCount > 0 ? `Syncing ${pendingCount} pending` : "Syncing"}
          </span>
        </div>
      );
    case "offline":
      return (
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400" data-testid="sync-status-offline">
          <CloudOff className="h-4 w-4" />
          <span className="text-sm">
            {pendingCount > 0 ? `Offline (${pendingCount} pending)` : "Offline"}
          </span>
        </div>
      );
    case "error":
      return (
        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400" data-testid="sync-status-error">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Sync Error</span>
        </div>
      );
  }
}

export function MobileCrewRosterDrawer({
  crew,
  vessels,
  isOpen,
  onClose,
  onSelectCrew,
}: {
  crew: CrewMember[];
  vessels: Vessel[];
  isOpen: boolean;
  onClose: () => void;
  onSelectCrew: (crewMember: CrewMember) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<string | null>(null);
  const [availabilityFilter, setAvailabilityFilter] = useState<string | null>(null);

  const uniqueRanks = useMemo(() => {
    const ranks = new Set<string>();
    crew.forEach(c => ranks.add(c.rank));
    return Array.from(ranks).sort();
  }, [crew]);

  const filteredCrew = useMemo(() => {
    return crew.filter(c => {
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (rankFilter && c.rank !== rankFilter) return false;
      if (availabilityFilter) {
        const status = c.availability || (c.onLeave ? "leave" : "available");
        if (status !== availabilityFilter) return false;
      }
      return c.active;
    });
  }, [crew, searchQuery, rankFilter, availabilityFilter]);

  const getVesselName = (vesselId?: string) => {
    if (!vesselId) return "Unassigned";
    const vessel = vessels.find(v => v.id === vesselId);
    return vessel?.name || "Unknown Vessel";
  };

  const getAvailabilityBadge = (member: CrewMember) => {
    const status = member.availability || (member.onLeave ? "leave" : "available");
    switch (status) {
      case "available":
        return <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">Available</Badge>;
      case "on_duty":
        return <Badge variant="outline" className="text-blue-600 border-blue-600 text-[10px]">On Duty</Badge>;
      case "leave":
        return <Badge variant="outline" className="text-amber-600 border-amber-600 text-[10px]">On Leave</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">Pending</Badge>;
      default:
        return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[70vh] p-0 rounded-t-xl">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Crew Roster
          </SheetTitle>
        </SheetHeader>

        <div className="p-3 border-b space-y-3">
          <Input
            placeholder="Search crew by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
            data-testid="input-crew-search"
          />
          <div className="flex gap-2">
            <Select value={rankFilter || "__all__"} onValueChange={(v) => setRankFilter(v === "__all__" ? null : v)}>
              <SelectTrigger className="flex-1 h-9" data-testid="select-rank-filter">
                <SelectValue placeholder="All Ranks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Ranks</SelectItem>
                {uniqueRanks.map(rank => (
                  <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={availabilityFilter || "__all__"} onValueChange={(v) => setAvailabilityFilter(v === "__all__" ? null : v)}>
              <SelectTrigger className="flex-1 h-9" data-testid="select-availability-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="on_duty">On Duty</SelectItem>
                <SelectItem value="leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="h-[calc(70vh-180px)]">
          {filteredCrew.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <User className="h-8 w-8 mb-2" />
              <p className="text-sm">No crew members found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredCrew.map(member => (
                <button
                  key={member.id}
                  className="w-full text-left p-3 hover-elevate active-elevate-2 flex items-center gap-3"
                  onClick={() => {
                    onSelectCrew(member);
                    onClose();
                  }}
                  data-testid={`crew-item-${member.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={cn("text-white text-xs", getRoleColor(member.rank))}>
                      {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{member.name}</span>
                      {getAvailabilityBadge(member)}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{member.rank}</span>
                      <span className="text-muted-foreground/50">|</span>
                      <span className="truncate">{getVesselName(member.vesselId)}</span>
                    </div>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground text-center">
          {filteredCrew.length} of {crew.filter(c => c.active).length} crew members
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DateRangeSelector({
  preset,
  onPresetChange,
  onNavigate,
  onToday,
  startDate,
  endDate,
}: {
  preset: DateRangePreset;
  onPresetChange: (p: DateRangePreset) => void;
  onNavigate: (dir: "prev" | "next") => void;
  onToday: () => void;
  startDate: Date;
  endDate: Date;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center border rounded-md">
        <Button variant="ghost" size="sm" onClick={() => onNavigate("prev")} data-testid="button-prev-range">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onToday} data-testid="button-today">
          Today
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onNavigate("next")} data-testid="button-next-range">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1 border rounded-md">
        {(["2w", "1m", "3m"] as DateRangePreset[]).map(p => (
          <Button
            key={p}
            variant={preset === p ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onPresetChange(p)}
            data-testid={`button-range-${p}`}
          >
            {p}
          </Button>
        ))}
      </div>
      <div className="text-sm font-medium" data-testid="text-date-range">
        {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
      </div>
    </div>
  );
}

export function TimelineHeader({ days, isMobile = false }: { days: Date[]; isMobile?: boolean }) {
  return (
    <div className="flex border-b sticky top-0 z-20 bg-background">
      <div className={cn(
        "shrink-0 border-r bg-background p-2 md:p-3 font-medium text-xs md:text-sm sticky left-0 z-30",
        isMobile ? "w-28" : "w-48"
      )}>
        Vessels
      </div>
      <div className="flex-1 flex">
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 p-1 md:p-2 text-center border-r",
              isMobile ? "min-w-[32px]" : "min-w-[40px]",
              isToday(day) && "bg-primary/5"
            )}
          >
            <div className="text-[10px] md:text-xs font-medium">{format(day, isMobile ? "E" : "EEE")}</div>
            <div className={cn(
              "text-[10px] md:text-xs",
              isToday(day) ? "text-primary font-semibold" : "text-muted-foreground"
            )}>
              {format(day, isMobile ? "d" : "MMM d")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DragGhostPreview({
  crewName,
  canAssign,
  isLoading,
  projectedRestHours,
  position,
}: {
  crewName: string;
  canAssign: boolean;
  isLoading: boolean;
  projectedRestHours?: number;
  position: { x: number; y: number };
}) {
  return (
    <div
      className={cn(
        "fixed z-[9999] pointer-events-none select-none",
        "bg-primary text-primary-foreground rounded-md px-3 py-2 shadow-lg",
        "flex items-center gap-2 text-sm font-medium",
        "animate-in fade-in-0 zoom-in-95 duration-100"
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
      }}
      data-testid="drag-ghost-preview"
    >
      <Move className="h-3 w-3 shrink-0 opacity-60" />
      <span className="truncate max-w-[120px]">{crewName}</span>
      {isLoading ? (
        <RefreshCw className="h-3 w-3 animate-spin shrink-0" />
      ) : (
        <div className={cn(
          "w-3 h-3 rounded-full shrink-0",
          canAssign ? "bg-green-400" : "bg-red-400"
        )} />
      )}
      {!isLoading && projectedRestHours !== undefined && (
        <span className="text-xs opacity-80">
          {projectedRestHours}h rest
        </span>
      )}
    </div>
  );
}

export function ComplianceTab({
  fatigue
}: {
  assignment: ScheduleAssignment;
  fatigue?: FatigueResult;
}) {
  const getComplianceStatus = () => {
    if (!fatigue) return { status: "UNKNOWN", color: "text-muted-foreground", bg: "bg-muted" };
    switch (fatigue.riskLevel) {
      case "critical":
        return { status: "NON-COMPLIANT", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" };
      case "high":
        return { status: "AT RISK", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" };
      case "medium":
        return { status: "CAUTION", color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30" };
      case "low":
        return { status: "LEGAL", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" };
      default:
        return { status: "UNKNOWN", color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  const compliance = getComplianceStatus();

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="p-4 space-y-4">
        <div className={cn("p-4 rounded-md", compliance.bg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="font-medium">STCW Compliance Status</span>
            </div>
            <Badge className={cn("font-bold", compliance.color, compliance.bg)}>
              {compliance.status}
            </Badge>
          </div>
        </div>

        {fatigue ? (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fatigue Risk Level</span>
                  <FatigueRiskBadge riskLevel={fatigue.riskLevel} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Rest Hour Metrics (14-day lookback)</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Avg Rest/24h</p>
                      <p className="font-medium">{fatigue.metrics.avgRestPer24h?.toFixed(1) || "N/A"}h <span className="text-xs text-muted-foreground">(min: 10h)</span></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Rest/7d</p>
                      <p className="font-medium">{fatigue.metrics.avgRestPer7d?.toFixed(1) || "N/A"}h <span className="text-xs text-muted-foreground">(max work: 77h)</span></p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sleep Debt (24h)</p>
                      <p className={cn("font-medium", fatigue.metrics.sleepDebt24h > 2 ? "text-red-500" : "")}>{fatigue.metrics.sleepDebt24h?.toFixed(1) || 0}h</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sleep Debt (7d)</p>
                      <p className={cn("font-medium", fatigue.metrics.sleepDebt7d > 10 ? "text-red-500" : "")}>{fatigue.metrics.sleepDebt7d?.toFixed(1) || 0}h</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {fatigue.factors.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Contributing Factors</p>
                  <ul className="space-y-1">
                    {fatigue.factors.map((factor, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {fatigue.recommendations.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Recommendations</p>
                  <ul className="space-y-1">
                    {fatigue.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Regulations Applied: MLC 2006, STCW 2010</p>
              <p>Requirements: Min 10h rest/24h, Max 77h work/7d</p>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No rest hour data available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Rest hours need to be recorded for compliance tracking
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

export function AssignmentDrawerContent({
  assignment,
  activeTab,
  onTabChange,
  violations,
  suggestions,
  fatigue,
  onApplySuggestion,
  onApplyChanges,
  onClose,
  isSaving,
  isSuggestionsLoading = false,
}: {
  assignment: ScheduleAssignment;
  activeTab: "details" | "constraints" | "suggestions" | "compliance";
  onTabChange: (tab: "details" | "constraints" | "suggestions" | "compliance") => void;
  violations: ConstraintResult[];
  suggestions: AiSuggestion[];
  fatigue?: FatigueResult;
  onApplySuggestion: (crewId: string) => void;
  onApplyChanges: () => void;
  onClose: () => void;
  isSaving: boolean;
  isSuggestionsLoading?: boolean;
}) {
  const hardCount = violations.filter(v => v.severity === "HARD").length;
  const softCount = violations.filter(v => v.severity === "SOFT").length;

  return (
    <>
      <Tabs value={activeTab} onValueChange={v => onTabChange(v as typeof activeTab)} className="flex-1">
        <TabsList className="w-full justify-start rounded-none border-b h-auto p-0">
          <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary" data-testid="tab-details">
            Details
          </TabsTrigger>
          <TabsTrigger value="constraints" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary gap-1" data-testid="tab-constraints">
            Constraints
            {(hardCount > 0 || softCount > 0) && (
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                hardCount > 0 ? "bg-red-500 text-white" : "bg-amber-500 text-white"
              )}>
                {hardCount + softCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary" data-testid="tab-suggestions">
            AI
          </TabsTrigger>
          <TabsTrigger value="compliance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary" data-testid="tab-compliance">
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex-1 mt-0">
          <DetailsTab assignment={assignment} />
        </TabsContent>

        <TabsContent value="constraints" className="flex-1 mt-0">
          <ConstraintsTab violations={violations} />
        </TabsContent>

        <TabsContent value="suggestions" className="flex-1 mt-0">
          <SuggestionsTab suggestions={suggestions} onApply={onApplySuggestion} isPending={isSuggestionsLoading} />
        </TabsContent>

        <TabsContent value="compliance" className="flex-1 mt-0">
          <ComplianceTab assignment={assignment} fatigue={fatigue} />
        </TabsContent>
      </Tabs>

      <div className="p-4 border-t flex gap-2">
        <Button variant="outline" onClick={onClose} className="flex-1" data-testid="button-cancel-drawer">
          Cancel
        </Button>
        <Button onClick={onApplyChanges} className="flex-1" disabled={isSaving} data-testid="button-apply-changes">
          {isSaving ? "Saving..." : "Apply Changes"}
        </Button>
      </div>
    </>
  );
}

export function AssignmentBlock({
  assignment,
  startOffset,
  duration,
  totalDays,
  onClick,
  hardViolations,
  softViolations,
  fatigueRisk,
  isMobile = false,
  onPointerDragStart,
  isDragging = false,
  dragCompliancePreview,
  isLongPressActive = false,
}: {
  assignment: ScheduleAssignment;
  startOffset: number;
  duration: number;
  totalDays: number;
  onClick: () => void;
  hardViolations: number;
  softViolations: number;
  fatigueRisk?: FatigueRiskLevel;
  isMobile?: boolean;
  onPointerDragStart?: (e: React.PointerEvent, assignment: ScheduleAssignment) => void;
  isDragging?: boolean;
  dragCompliancePreview?: DragCompliancePreview | null;
  isLongPressActive?: boolean;
}) {
  const leftPercent = (startOffset / totalDays) * 100;
  const widthPercent = (duration / totalDays) * 100;
  const roleColor = getRoleColor(assignment.role);
  const isDraft = assignment.status === "draft";
  const isGeneratedDraft = isDraft && (assignment.source === "generator" || !!assignment.generatedByRunId);
  const [showMobileTooltip, setShowMobileTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasDragStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isDragging) return;

    pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    hasDragStartedRef.current = false;

    if (isMobile) {
      longPressTimerRef.current = setTimeout(() => {
        if (pointerDownRef.current && !hasDragStartedRef.current) {
          hasDragStartedRef.current = true;
          pointerDownRef.current = null;
          onPointerDragStart?.(e, assignment);
        }
      }, MOBILE_LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerDownRef.current || hasDragStartedRef.current || isDragging) return;

    const deltaX = Math.abs(e.clientX - pointerDownRef.current.x);
    const deltaY = Math.abs(e.clientY - pointerDownRef.current.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (isMobile) {
      if (distance > DRAG_THRESHOLD_PX) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        pointerDownRef.current = null;
      }
    } else {
      if (distance > DRAG_THRESHOLD_PX && !hasDragStartedRef.current) {
        hasDragStartedRef.current = true;
        pointerDownRef.current = null;
        onPointerDragStart?.(e, assignment);
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    const wasClick = pointerDownRef.current && !hasDragStartedRef.current;
    const elapsed = pointerDownRef.current ? Date.now() - pointerDownRef.current.time : 0;

    pointerDownRef.current = null;

    if (wasClick && elapsed < 300) {
      if (isMobile) {
        setShowMobileTooltip(!showMobileTooltip);
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = setTimeout(() => setShowMobileTooltip(false), 3000);
      }
      onClick();
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    pointerDownRef.current = null;
    hasDragStartedRef.current = false;
  };

  const hasViolations = hardViolations > 0 || softViolations > 0;
  const hasHardViolations = hardViolations > 0;

  const blockContent = (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={cn(
        "absolute top-1 rounded-md flex items-center gap-1 text-white text-xs font-medium shadow-sm hover-elevate active-elevate-2 transition-all cursor-grab overflow-hidden select-none touch-none",
        roleColor,
        isDraft && !isGeneratedDraft && "opacity-80 border-2 border-dashed border-white/50",
        isGeneratedDraft && "opacity-90 border-2 border-dashed border-amber-300",
        isMobile ? "h-12 px-1.5" : "h-10 px-2",
        isDragging && "opacity-50 cursor-grabbing ring-2 ring-white/50",
        isLongPressActive && "ring-2 ring-white animate-pulse",
        hasHardViolations && "hover:ring-2 hover:ring-red-500 hover:ring-offset-1 hover:ring-offset-background",
        hasViolations && !hasHardViolations && "hover:ring-2 hover:ring-amber-400 hover:ring-offset-1 hover:ring-offset-background"
      )}
      style={{
        left: `${leftPercent}%`,
        width: `calc(${widthPercent}% - 4px)`,
        minWidth: isMobile ? "48px" : "60px",
      }}
      data-testid={`assignment-block-${assignment.id}`}
      data-assignment-id={assignment.id}
    >
      {!isMobile && (
        <Move className="h-3 w-3 shrink-0 opacity-60" />
      )}
      {fatigueRisk && <FatigueRiskBadge riskLevel={fatigueRisk} compact />}
      {isGeneratedDraft && <Sparkles className="h-3 w-3 shrink-0 text-amber-300" />}
      <span className="truncate flex-1 text-left">{assignment.crewName}</span>
      {dragCompliancePreview && !dragCompliancePreview.isLoading && (
        <span className={cn(
          "w-2 h-2 rounded-full shrink-0",
          dragCompliancePreview.canAssign ? "bg-green-400" : "bg-red-400"
        )} />
      )}
      {(hardViolations > 0 || softViolations > 0) && !dragCompliancePreview && (
        <div className="flex items-center gap-0.5 shrink-0">
          {hardViolations > 0 && (
            <span className={cn(
              "flex items-center justify-center rounded-full bg-red-600",
              isMobile ? "w-5 h-5 text-[11px]" : "w-4 h-4 text-[10px]"
            )}>
              {hardViolations}
            </span>
          )}
          {softViolations > 0 && (
            <span className={cn(
              "flex items-center justify-center rounded-full bg-amber-500",
              isMobile ? "w-5 h-5 text-[11px]" : "w-4 h-4 text-[10px]"
            )}>
              {softViolations}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="relative">
        {blockContent}
        {showMobileTooltip && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-popover text-popover-foreground border rounded-md shadow-lg p-2 z-50 min-w-[160px]"
            style={{ left: `${leftPercent + widthPercent / 2}%` }}
          >
            <p className="font-medium text-sm">{assignment.crewName}</p>
            <p className="text-xs text-muted-foreground">{assignment.role}</p>
            <p className="text-xs mt-1">{format(parseISO(assignment.startDate), "MMM d")} - {format(parseISO(assignment.endDate), "MMM d")}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {blockContent}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{assignment.crewName}</p>
          <p className="text-xs text-muted-foreground">{assignment.role}</p>
          <p className="text-xs">{format(parseISO(assignment.startDate), "MMM d")} - {format(parseISO(assignment.endDate), "MMM d")}</p>
          {fatigueRisk && (
            <div className="flex items-center gap-1 pt-1 border-t">
              <span className="text-xs text-muted-foreground">Fatigue:</span>
              <FatigueRiskBadge riskLevel={fatigueRisk} />
            </div>
          )}
          {(hardViolations > 0 || softViolations > 0) && (
            <div className="flex gap-2 pt-1 border-t">
              {hardViolations > 0 && <span className="text-xs text-red-500">{hardViolations} hard constraint(s)</span>}
              {softViolations > 0 && <span className="text-xs text-amber-500">{softViolations} soft warning(s)</span>}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function VesselRow({
  vessel,
  assignments,
  timelineDays,
  calculateBlockPosition,
  getConstraintSummary,
  getCrewFatigue,
  onAssignmentClick,
  onEmptyCellClick,
  isMobile = false,
  onPointerDragStart,
  dragState,
  dragCompliancePreview,
  dragTargetVesselId,
  dragTargetDate,
}: {
  vessel: { id: string; name: string; type?: string };
  assignments: ScheduleAssignment[];
  timelineDays: Date[];
  calculateBlockPosition: (a: ScheduleAssignment) => { startOffset: number; duration: number };
  getConstraintSummary: (a: ScheduleAssignment) => { hard: number; soft: number };
  getCrewFatigue: (crewId: string) => FatigueResult | undefined;
  onAssignmentClick: (id: string) => void;
  onEmptyCellClick: (vesselId: string, vesselName: string, date: Date) => void;
  isMobile?: boolean;
  onPointerDragStart?: (e: React.PointerEvent, assignment: ScheduleAssignment) => void;
  dragState?: DragState | null;
  dragCompliancePreview?: DragCompliancePreview | null;
  dragTargetVesselId?: string | null;
  dragTargetDate?: Date | null;
}) {
  const totalDays = timelineDays.length;
  const uniqueRoles = useMemo(() => {
    const roles = new Set(assignments.map(a => a.role));
    return Array.from(roles);
  }, [assignments]);

  const assignmentsByRole = useMemo(() => {
    const map: Record<string, ScheduleAssignment[]> = {};
    for (const role of uniqueRoles) {
      map[role] = assignments.filter(a => a.role === role);
    }
    return map;
  }, [assignments, uniqueRoles]);

  const isRowHighlighted = dragState && dragTargetVesselId === vessel.id;

  return (
    <div className={cn("border-b transition-colors", isRowHighlighted && "bg-primary/5")} data-testid={`vessel-row-${vessel.id}`}>
      <div className="flex">
        <div className={cn(
          "shrink-0 border-r bg-muted/30 p-2 md:p-3 sticky left-0 z-10",
          isMobile ? "w-28" : "w-48"
        )}>
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-xs md:text-sm truncate">{vessel.name}</p>
              {vessel.type && !isMobile && <p className="text-xs text-muted-foreground">{vessel.type}</p>}
            </div>
          </div>
          {!isMobile && (
            <div className="mt-2 space-y-1">
              {uniqueRoles.slice(0, 3).map(role => (
                <div key={role} className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", getRoleColor(role))} />
                  <span className="text-xs text-muted-foreground truncate">{role}</span>
                </div>
              ))}
              {uniqueRoles.length > 3 && (
                <span className="text-xs text-muted-foreground">+{uniqueRoles.length - 3} more</span>
              )}
            </div>
          )}
        </div>
        <div className={cn("flex-1 relative", isMobile ? "min-h-[80px]" : "min-h-[100px]")}>
          <div className="absolute inset-0 flex">
            {timelineDays.map((day, i) => {
              const isCellTarget = dragState &&
                dragTargetVesselId === vessel.id &&
                dragTargetDate &&
                isSameDay(day, dragTargetDate);

              return (
                <div
                  key={i}
                  onClick={() => !dragState && onEmptyCellClick(vessel.id, vessel.name, day)}
                  className={cn(
                    "flex-1 border-r hover-elevate transition-colors cursor-pointer",
                    isMobile ? "min-w-[32px]" : "min-w-[40px]",
                    isToday(day) && "bg-primary/5",
                    isCellTarget && "bg-primary/20 ring-2 ring-inset ring-primary/50"
                  )}
                  data-testid={`cell-${vessel.id}-${format(day, "yyyy-MM-dd")}`}
                  aria-label={`Add assignment on ${format(day, "MMM d")} for ${vessel.name}`}
                />
              );
            })}
          </div>
          <div className="relative p-1 space-y-1 pointer-events-none">
            {Object.entries(assignmentsByRole).map(([role, roleAssignments], rowIndex) => (
              <div key={role} className={cn("relative", isMobile ? "h-14" : "h-12")} style={{ marginTop: rowIndex > 0 ? "2px" : 0 }}>
                {roleAssignments.map(assignment => {
                  const pos = calculateBlockPosition(assignment);
                  const summary = getConstraintSummary(assignment);
                  const fatigue = getCrewFatigue(assignment.crewId);
                  const isBeingDragged = dragState?.assignmentId === assignment.id;
                  return (
                    <div key={assignment.id} className="pointer-events-auto">
                      <AssignmentBlock
                        assignment={assignment}
                        startOffset={pos.startOffset}
                        duration={pos.duration}
                        totalDays={totalDays}
                        onClick={() => onAssignmentClick(assignment.id)}
                        hardViolations={summary.hard}
                        softViolations={summary.soft}
                        fatigueRisk={fatigue?.riskLevel}
                        isMobile={isMobile}
                        onPointerDragStart={onPointerDragStart}
                        isDragging={isBeingDragged}
                        dragCompliancePreview={isBeingDragged ? dragCompliancePreview : null}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            {assignments.length === 0 && (
              <div className={cn("flex items-center justify-center text-xs text-muted-foreground pointer-events-none", isMobile ? "h-14" : "h-12")}>
                Tap a date to add assignment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
