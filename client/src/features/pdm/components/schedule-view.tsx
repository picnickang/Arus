import { useState, useCallback, useEffect, useMemo } from "react";
import {
  format,
  addDays,
  differenceInDays,
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { useLocation, useSearch } from "wouter";
import {
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Ship,
  Wrench,
  Activity,
  TrendingUp,
  Settings,
  Download,
  Filter,
  RefreshCw,
  MoveHorizontal,
  ExternalLink,
  WifiOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePdmSchedule, useCreateWorkOrderFromRisk, usePdmFilterOptions } from "@/features/pdm";
import type {
  PdmScheduledTask,
  ScheduleKpis,
  BlockReason,
  RiskLevel,
  ScheduleFilters,
} from "@/features/pdm";

const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  capacity: "Capacity Limit",
  parts_lead_time: "Parts Lead Time",
  vessel_unavailable: "Vessel Unavailable",
  telemetry_stale: "Stale Telemetry",
  insufficient_confidence: "Low Confidence",
  scheduling_conflict: "Schedule Conflict",
};

const SEVERITY_COLORS: Record<RiskLevel, string> = {
  critical: "bg-red-500 dark:bg-red-600",
  high: "bg-orange-500 dark:bg-orange-600",
  medium: "bg-yellow-500 dark:bg-yellow-600",
  low: "bg-green-500 dark:bg-green-600",
};

const SEVERITY_BADGE_VARIANTS: Record<RiskLevel, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

function getWeekDateRange(weekOffset: number = 0) {
  const today = new Date();
  const start = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  const end = endOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  return { start, end };
}

function formatWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) {
    return "This Week";
  }
  if (weekOffset === 1) {
    return "Next Week";
  }
  if (weekOffset === -1) {
    return "Last Week";
  }
  const { start, end } = getWeekDateRange(weekOffset);
  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
}

interface ScheduleKPIStripProps {
  kpis: ScheduleKpis | undefined;
  isLoading: boolean;
  onScheduledClick?: () => void;
  onUnassignedClick?: () => void;
}

function ScheduleKPIStrip({
  kpis,
  isLoading,
  onScheduledClick,
  onUnassignedClick,
}: ScheduleKPIStripProps) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-44 flex-shrink-0" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Scheduled This Week",
      value: kpis?.tasksScheduledThisWeek ?? 0,
      subtitle: kpis?.scheduledDateRange ?? "",
      icon: Calendar,
      color: "bg-blue-600 dark:bg-blue-700",
      onClick: onScheduledClick,
      testId: "kpi-scheduled",
    },
    {
      title: "Unassigned High-Risk",
      value: kpis?.unassignedHighRiskCount ?? 0,
      subtitle: kpis?.unassignedUrgency ?? "",
      icon: AlertTriangle,
      color: "bg-red-600 dark:bg-red-700",
      onClick: onUnassignedClick,
      testId: "kpi-unassigned",
    },
    {
      title: "Expected Downtime",
      value: `${kpis?.expectedDowntimeForecastHours ?? 0} hrs`,
      subtitle: `$${((kpis?.expectedDowntimeForecastCost ?? 0) / 1000).toFixed(0)}k ${kpis?.forecastPeriod ?? ""}`,
      icon: Clock,
      color: "bg-yellow-500 dark:bg-yellow-600",
      testId: "kpi-downtime",
    },
    {
      title: "Avoided Downtime",
      value: `${kpis?.avoidedDowntimeHours ?? 0} hrs`,
      subtitle: `$${((kpis?.avoidedDowntimeCost ?? 0) / 1000).toFixed(0)}k ${kpis?.avoidedPeriod ?? ""}`,
      icon: CheckCircle2,
      color: "bg-green-600 dark:bg-green-700",
      testId: "kpi-avoided",
    },
  ];

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-2">
        {cards.map((card, idx) => (
          <button
            key={idx}
            onClick={card.onClick}
            disabled={!card.onClick}
            className={`${card.color} text-white rounded-lg p-3 min-w-[170px] flex-shrink-0 text-left ${card.onClick ? "cursor-pointer hover-elevate active-elevate-2" : ""}`}
            data-testid={card.testId}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs opacity-90">{card.title}</p>
              <card.icon className="h-4 w-4 opacity-75" />
            </div>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
            <p className="text-xs opacity-80 truncate">{card.subtitle}</p>
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function RulGauge({ p10, p50, p90 }: { p10: number; p50: number; p90: number }) {
  const maxDays = Math.max(p90, 30);
  const p10Pct = (p10 / maxDays) * 100;
  const p50Pct = (p50 / maxDays) * 100;
  const p90Pct = (p90 / maxDays) * 100;

  const getColor = (days: number) => {
    if (days <= 7) {
      return "bg-red-500";
    }
    if (days <= 14) {
      return "bg-orange-500";
    }
    if (days <= 21) {
      return "bg-yellow-500";
    }
    return "bg-green-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>P10: {p10}d</span>
        <span className="font-medium">P50: {p50}d</span>
        <span>P90: {p90}d</span>
      </div>
      <div className="relative h-4 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-red-200 dark:bg-red-900/50"
          style={{ left: `${p10Pct}%`, width: `${p90Pct - p10Pct}%` }}
        />
        <div
          className={`absolute h-full w-1 ${getColor(p50)}`}
          style={{ left: `${p50Pct}%`, transform: "translateX(-50%)" }}
        />
        <div
          className="absolute h-full w-0.5 bg-muted-foreground/50"
          style={{ left: `${p10Pct}%` }}
        />
        <div
          className="absolute h-full w-0.5 bg-muted-foreground/50"
          style={{ left: `${p90Pct}%` }}
        />
      </div>
      <div className="text-xs text-center text-muted-foreground">RUL Confidence Bands (days)</div>
    </div>
  );
}

interface FilterBarProps {
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  vesselId: string;
  onVesselChange: (id: string) => void;
  equipmentType: string;
  onEquipmentTypeChange: (type: string) => void;
  maxTasksPerDay: number;
  onMaxTasksChange: (value: number) => void;
  autoPopulate: boolean;
  onAutoPopulateChange: (enabled: boolean) => void;
  vessels: Array<{ id: string; name: string }>;
  equipmentTypes: string[];
  isLoading: boolean;
}

function FilterBar({
  weekOffset,
  onWeekChange,
  vesselId,
  onVesselChange,
  equipmentType,
  onEquipmentTypeChange,
  maxTasksPerDay,
  onMaxTasksChange,
  autoPopulate,
  onAutoPopulateChange,
  vessels,
  equipmentTypes,
  isLoading,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onWeekChange(weekOffset - 1)}
          data-testid="btn-prev-week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-sm font-medium min-w-[100px] text-center">
          {formatWeekLabel(weekOffset)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onWeekChange(weekOffset + 1)}
          data-testid="btn-next-week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Select value={vesselId} onValueChange={onVesselChange} disabled={isLoading}>
        <SelectTrigger className="w-[160px]" data-testid="select-vessel">
          <Ship className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="All Vessels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Vessels</SelectItem>
          {vessels.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={equipmentType} onValueChange={onEquipmentTypeChange} disabled={isLoading}>
        <SelectTrigger className="w-[160px]" data-testid="select-equipment-type">
          <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="All Equipment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Equipment</SelectItem>
          {equipmentTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
        <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Max</span>
        <Slider
          value={[maxTasksPerDay]}
          onValueChange={(vals) => onMaxTasksChange(vals[0])}
          min={1}
          max={5}
          step={1}
          disabled={isLoading}
          className="w-20"
          data-testid="slider-max-tasks"
        />
        <span className="text-sm font-medium w-4 text-center" data-testid="text-max-tasks-value">
          {maxTasksPerDay}
        </span>
      </div>

      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
        <Switch
          id="auto-populate"
          checked={autoPopulate}
          onCheckedChange={onAutoPopulateChange}
          disabled={isLoading}
          data-testid="switch-auto-populate"
        />
        <Label htmlFor="auto-populate" className="text-xs cursor-pointer whitespace-nowrap">
          Auto-populate
        </Label>
      </div>
    </div>
  );
}

function TelemetryStaleWarning({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm">
        Telemetry delayed on {count} vessel{count > 1 ? "s" : ""}; schedule confidence may be
        reduced.
      </span>
    </div>
  );
}

function EmptyScheduleState({ hasBlockedTasks }: { hasBlockedTasks: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/30 rounded-lg">
      <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="font-medium text-lg mb-2">
        {hasBlockedTasks ? "No Tasks Scheduled" : "No PdM Tasks"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        {hasBlockedTasks
          ? "Tasks exist but none could be scheduled for this period. Check the blocked tasks section below for details."
          : "No predictive maintenance tasks found for the current filters and date range."}
      </p>
    </div>
  );
}

function GanttScheduleView({
  tasks,
  vessels,
  dateRange,
  onSelectTask,
  isLoading,
}: {
  tasks: PdmScheduledTask[];
  vessels: Array<{ id: string; name: string }>;
  dateRange: { start: string | Date; end: string | Date };
  onSelectTask: (task: PdmScheduledTask) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const startDate =
    typeof dateRange.start === "string" ? parseISO(dateRange.start) : dateRange.start;
  const endDate = typeof dateRange.end === "string" ? parseISO(dateRange.end) : dateRange.end;
  const totalDays = differenceInDays(endDate, startDate) + 1;
  const dates = Array.from({ length: totalDays }, (_, i) => addDays(startDate, i));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const vesselIds = new Set(tasks.map((t) => t.vesselId));
  const displayVessels = vessels.filter((v) => vesselIds.has(v.id));

  if (displayVessels.length === 0 && tasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Maintenance Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            <div className="flex border-b">
              <div className="w-36 flex-shrink-0 p-2 font-medium text-sm border-r bg-muted">
                Vessel
              </div>
              <div className="flex flex-1">
                {dates.map((date, idx) => {
                  const isToday = date.getTime() === today.getTime();
                  return (
                    <div
                      key={idx}
                      className={`flex-1 min-w-[60px] p-1 text-center text-xs border-r ${isToday ? "bg-primary/10 font-medium" : ""}`}
                    >
                      <div className="text-muted-foreground">{format(date, "EEE")}</div>
                      <div className={isToday ? "text-primary" : ""}>{format(date, "d MMM")}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {displayVessels.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No vessels with scheduled tasks
              </div>
            ) : (
              displayVessels.map((vessel) => {
                const vesselTasks = tasks.filter((t) => t.vesselId === vessel.id);

                const tasksByDate = new Map<string, PdmScheduledTask[]>();
                vesselTasks.forEach((task) => {
                  const taskDate = task.scheduledDate
                    ? typeof task.scheduledDate === "string"
                      ? parseISO(task.scheduledDate)
                      : task.scheduledDate
                    : typeof task.schedulingWindow.preferredDate === "string"
                      ? parseISO(task.schedulingWindow.preferredDate)
                      : task.schedulingWindow.preferredDate;
                  const dateKey = format(taskDate, "yyyy-MM-dd");
                  const existing = tasksByDate.get(dateKey) || [];
                  existing.push(task);
                  tasksByDate.set(dateKey, existing);
                });

                const maxTasksPerDay = Math.max(
                  1,
                  ...Array.from(tasksByDate.values()).map((t) => t.length)
                );
                const TASK_BAR_HEIGHT = 28;
                const TASK_BAR_GAP = 4;
                const ROW_PADDING = 8;
                const rowHeight = Math.max(
                  56,
                  maxTasksPerDay * TASK_BAR_HEIGHT +
                    (maxTasksPerDay - 1) * TASK_BAR_GAP +
                    ROW_PADDING
                );

                return (
                  <div
                    key={vessel.id}
                    className="flex border-b last:border-b-0"
                    style={{ minHeight: `${rowHeight}px` }}
                  >
                    <div className="w-36 flex-shrink-0 p-2 border-r bg-muted/50 flex items-center gap-2">
                      <Ship className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate">{vessel.name}</span>
                    </div>
                    <div className="flex flex-1 relative">
                      {dates.map((date, idx) => {
                        const isToday = date.getTime() === today.getTime();
                        return (
                          <div
                            key={idx}
                            className={`flex-1 min-w-[60px] border-r relative ${isToday ? "bg-primary/5" : ""}`}
                          />
                        );
                      })}

                      {vesselTasks.map((task) => {
                        const taskDate = task.scheduledDate
                          ? typeof task.scheduledDate === "string"
                            ? parseISO(task.scheduledDate)
                            : task.scheduledDate
                          : typeof task.schedulingWindow.preferredDate === "string"
                            ? parseISO(task.schedulingWindow.preferredDate)
                            : task.schedulingWindow.preferredDate;

                        if (!isWithinInterval(taskDate, { start: startDate, end: endDate })) {
                          return null;
                        }

                        const dateKey = format(taskDate, "yyyy-MM-dd");
                        const tasksOnDate = tasksByDate.get(dateKey) || [];
                        const taskIndex = tasksOnDate.findIndex((t) => t.id === task.id);
                        const topOffset =
                          ROW_PADDING / 2 + taskIndex * (TASK_BAR_HEIGHT + TASK_BAR_GAP);

                        const dayOffset = differenceInDays(taskDate, startDate);
                        const leftPct = (dayOffset / totalDays) * 100;
                        const widthPct = Math.max(8, (1 / totalDays) * 100);

                        return (
                          <button
                            key={task.id}
                            onClick={() => onSelectTask(task)}
                            className={`absolute ${SEVERITY_COLORS[task.severity]} text-white text-xs rounded-md px-2 py-0.5 truncate hover-elevate active-elevate-2 cursor-pointer z-10`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              top: `${topOffset}px`,
                              height: `${TASK_BAR_HEIGHT}px`,
                              minWidth: "50px",
                              maxWidth: "150px",
                            }}
                            data-testid={`task-chip-${task.id}`}
                          >
                            <div className="font-medium truncate leading-tight">
                              {task.failureMode}
                            </div>
                            <div className="opacity-80 truncate text-[10px] leading-tight">
                              {task.estimatedDowntimeHours}h
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface BlockedTasksSectionProps {
  tasks: PdmScheduledTask[];
  onSelectTask: (task: PdmScheduledTask) => void;
  isLoading: boolean;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
}

function BlockedTasksSection({
  tasks,
  onSelectTask,
  isLoading,
  isExpanded,
  onExpandChange,
}: BlockedTasksSectionProps) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onExpandChange}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button
              className="flex items-center justify-between w-full text-left hover-elevate rounded-lg -m-2 p-2"
              data-testid="toggle-blocked-tasks"
            >
              <CardTitle className="text-base flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Blocked / Unassigned Tasks ({tasks.length})
              </CardTitle>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-0">
            <ScrollArea className="max-h-64">
              <div className="divide-y">
                {tasks.map((task) => {
                  const latestFinish =
                    typeof task.schedulingWindow.latestFinish === "string"
                      ? parseISO(task.schedulingWindow.latestFinish)
                      : task.schedulingWindow.latestFinish;

                  return (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="w-full p-3 flex items-center justify-between gap-3 hover-elevate text-left"
                      data-testid={`blocked-task-${task.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-10 rounded-full ${SEVERITY_COLORS[task.severity]}`}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{task.equipmentName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {task.vesselName} - {task.failureMode}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Must finish by: {format(latestFinish, "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={SEVERITY_BADGE_VARIANTS[task.severity]} className="text-xs">
                          {task.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {task.blockReason ? BLOCK_REASON_LABELS[task.blockReason] : "Blocked"}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface MoveTaskDialogProps {
  task: PdmScheduledTask | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newDate: Date, isOverride: boolean) => void;
}

function MoveTaskDialog({ task, isOpen, onClose, onConfirm }: MoveTaskDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isOverride, setIsOverride] = useState(false);

  useEffect(() => {
    if (task && isOpen) {
      const preferredDate =
        typeof task.schedulingWindow.preferredDate === "string"
          ? task.schedulingWindow.preferredDate
          : task.schedulingWindow.preferredDate.toISOString().split("T")[0];
      setSelectedDate(preferredDate);
      setIsOverride(false);
    }
  }, [task, isOpen]);

  if (!task) {
    return null;
  }

  const earliestStart =
    typeof task.schedulingWindow.earliestStart === "string"
      ? parseISO(task.schedulingWindow.earliestStart)
      : task.schedulingWindow.earliestStart;
  const latestFinish =
    typeof task.schedulingWindow.latestFinish === "string"
      ? parseISO(task.schedulingWindow.latestFinish)
      : task.schedulingWindow.latestFinish;

  const handleDateChange = (dateStr: string) => {
    setSelectedDate(dateStr);
    const date = parseISO(dateStr);
    const needsOverride = date < earliestStart || date > latestFinish;
    setIsOverride(needsOverride);
  };

  const handleConfirm = () => {
    onConfirm(parseISO(selectedDate), isOverride);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveHorizontal className="h-5 w-5" />
            Move Task
          </DialogTitle>
          <DialogDescription>
            {task.equipmentName} - {task.failureMode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allowed Window:</span>
            </div>
            <div className="flex justify-between">
              <span>Earliest:</span>
              <span>{format(earliestStart, "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Latest:</span>
              <span>{format(latestFinish, "MMM d, yyyy")}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
              data-testid="input-move-date"
            />
          </div>

          {isOverride && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Selected date is outside the recommended window. This will be marked as an override.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="btn-confirm-move">
            {isOverride ? "Move with Override" : "Move Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TaskDetailPanelProps {
  task: PdmScheduledTask | null;
  isOpen: boolean;
  onClose: () => void;
  onMoveTask: (task: PdmScheduledTask) => void;
}

function TaskDetailPanel({ task, isOpen, onClose, onMoveTask }: TaskDetailPanelProps) {
  const createWoMutation = useCreateWorkOrderFromRisk();

  if (!task) {
    return null;
  }

  const handleCreateWorkOrder = async () => {
    await createWoMutation.mutateAsync(task.alertId);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {task.equipmentName}
          </SheetTitle>
          <SheetDescription>
            {task.vesselName} - {task.equipmentType}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_BADGE_VARIANTS[task.severity]}>
              {task.severity.toUpperCase()}
            </Badge>
            <Badge variant={task.status === "blocked" ? "destructive" : "secondary"}>
              {task.status.replace("_", " ").toUpperCase()}
            </Badge>
            {task.workOrderId && (
              <Badge variant="outline" className="gap-1">
                WO Linked <ExternalLink className="h-3 w-3" />
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Failure Mode</h4>
            <p className="text-sm text-muted-foreground">{task.failureMode}</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              RUL Estimate
            </h4>
            <RulGauge p10={task.rulP10Days} p50={task.rulP50Days} p90={task.rulP90Days} />
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Confidence Score
            </h4>
            <div className="flex items-center gap-2">
              <Progress value={task.confidence} className="flex-1" />
              <span className="text-sm font-medium">{task.confidence}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Est. Downtime</div>
              <div className="font-medium">{task.estimatedDowntimeHours} hours</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground">Est. Cost</div>
              <div className="font-medium">${task.estimatedCost.toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduling Window
            </h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Earliest Start:</span>
                <span>
                  {format(
                    typeof task.schedulingWindow.earliestStart === "string"
                      ? parseISO(task.schedulingWindow.earliestStart)
                      : task.schedulingWindow.earliestStart,
                    "MMM d, yyyy"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preferred Date:</span>
                <span className="font-medium">
                  {format(
                    typeof task.schedulingWindow.preferredDate === "string"
                      ? parseISO(task.schedulingWindow.preferredDate)
                      : task.schedulingWindow.preferredDate,
                    "MMM d, yyyy"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latest Finish:</span>
                <span>
                  {format(
                    typeof task.schedulingWindow.latestFinish === "string"
                      ? parseISO(task.schedulingWindow.latestFinish)
                      : task.schedulingWindow.latestFinish,
                    "MMM d, yyyy"
                  )}
                </span>
              </div>
              {task.scheduledDate && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Scheduled:</span>
                  <span className="font-medium text-primary">
                    {format(
                      typeof task.scheduledDate === "string"
                        ? parseISO(task.scheduledDate)
                        : task.scheduledDate,
                      "MMM d, yyyy"
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {task.blockReason && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-medium text-sm text-red-700 dark:text-red-400">Block Reason</h4>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                {BLOCK_REASON_LABELS[task.blockReason]}
              </p>
              {task.blockDetails && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">{task.blockDetails}</p>
              )}
            </div>
          )}

          {task.recommendedActions.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Recommended Actions
              </h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                {task.recommendedActions.map((action, idx) => (
                  <li key={idx}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4 border-t">
            {task.status !== "wo_created" && (
              <Button
                onClick={handleCreateWorkOrder}
                disabled={createWoMutation.isPending}
                className="w-full"
                data-testid="btn-create-wo"
              >
                <Wrench className="h-4 w-4 mr-2" />
                {createWoMutation.isPending ? "Creating..." : "Create Work Order"}
              </Button>
            )}
            {task.status !== "blocked" && (
              <Button
                variant="outline"
                onClick={() => onMoveTask(task)}
                className="w-full"
                data-testid="btn-move-task"
              >
                <MoveHorizontal className="h-4 w-4 mr-2" />
                Move Task
              </Button>
            )}
            <Button variant="ghost" asChild className="w-full">
              <a href={`/pdm/equipment/${task.equipmentId}`} data-testid="link-view-alert">
                <ExternalLink className="h-4 w-4 mr-2" />
                View PdM Alert
              </a>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
      <XCircle className="h-12 w-12 text-red-500 mb-4" />
      <h3 className="font-medium text-lg mb-2">Failed to Load Schedule</h3>
      <p className="text-sm text-muted-foreground mb-4">
        There was an error loading the maintenance schedule. Please try again.
      </p>
      <Button onClick={onRetry} variant="outline" data-testid="btn-retry">
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}

export function ScheduleView() {
  const search = useSearch();
  const [, setLocation] = useLocation();

  const params = useMemo(() => new URLSearchParams(search), [search]);
  const initialWeekOffset = parseInt(params.get("week") || "0", 10);
  const initialVesselId = params.get("vesselId") || "all";
  const initialEquipmentType = params.get("equipmentType") || "all";
  const initialTaskId = params.get("taskId") || null;

  const initialMaxTasks = parseInt(params.get("maxTasks") || "3", 10);

  const initialAutoPopulate = params.get("autoPopulate") !== "false";

  const [weekOffset, setWeekOffset] = useState(initialWeekOffset);
  const [vesselId, setVesselId] = useState(initialVesselId);
  const [equipmentType, setEquipmentType] = useState(initialEquipmentType);
  const [maxTasksPerDay, setMaxTasksPerDay] = useState(initialMaxTasks);
  const [autoPopulate, setAutoPopulate] = useState(initialAutoPopulate);
  const [selectedTask, setSelectedTask] = useState<PdmScheduledTask | null>(null);
  const [moveTask, setMoveTask] = useState<PdmScheduledTask | null>(null);
  const [blockedPanelExpanded, setBlockedPanelExpanded] = useState(true);

  const { start, end } = getWeekDateRange(weekOffset);

  const filters: ScheduleFilters = useMemo(
    () => ({
      vesselIds: vesselId !== "all" ? [vesselId] : undefined,
      equipmentTypes: equipmentType !== "all" ? [equipmentType] : undefined,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      maxTasksPerVesselPerDay: maxTasksPerDay,
      autoPopulate,
    }),
    [vesselId, equipmentType, start, end, maxTasksPerDay, autoPopulate]
  );

  const { data, isLoading, isError, refetch } = usePdmSchedule(filters);
  const { data: filterOptions, isLoading: filterOptionsLoading } = usePdmFilterOptions();

  const updateUrl = useCallback(
    (
      newWeek: number,
      newVessel: string,
      newEquipType: string,
      newMaxTasks: number,
      newAutoPopulate: boolean
    ) => {
      const newParams = new URLSearchParams();
      if (newWeek !== 0) {
        newParams.set("week", newWeek.toString());
      }
      if (newVessel !== "all") {
        newParams.set("vesselId", newVessel);
      }
      if (newEquipType !== "all") {
        newParams.set("equipmentType", newEquipType);
      }
      if (newMaxTasks !== 3) {
        newParams.set("maxTasks", newMaxTasks.toString());
      }
      if (!newAutoPopulate) {
        newParams.set("autoPopulate", "false");
      }
      const queryString = newParams.toString();
      setLocation(queryString ? `?${queryString}` : "", { replace: true });
    },
    [setLocation]
  );

  const handleWeekChange = useCallback(
    (offset: number) => {
      setWeekOffset(offset);
      updateUrl(offset, vesselId, equipmentType, maxTasksPerDay, autoPopulate);
    },
    [vesselId, equipmentType, maxTasksPerDay, autoPopulate, updateUrl]
  );

  const handleVesselChange = useCallback(
    (id: string) => {
      setVesselId(id);
      updateUrl(weekOffset, id, equipmentType, maxTasksPerDay, autoPopulate);
    },
    [weekOffset, equipmentType, maxTasksPerDay, autoPopulate, updateUrl]
  );

  const handleEquipmentTypeChange = useCallback(
    (type: string) => {
      setEquipmentType(type);
      updateUrl(weekOffset, vesselId, type, maxTasksPerDay, autoPopulate);
    },
    [weekOffset, vesselId, maxTasksPerDay, autoPopulate, updateUrl]
  );

  const handleMaxTasksChange = useCallback(
    (value: number) => {
      setMaxTasksPerDay(value);
      updateUrl(weekOffset, vesselId, equipmentType, value, autoPopulate);
    },
    [weekOffset, vesselId, equipmentType, autoPopulate, updateUrl]
  );

  const handleAutoPopulateChange = useCallback(
    (enabled: boolean) => {
      setAutoPopulate(enabled);
      updateUrl(weekOffset, vesselId, equipmentType, maxTasksPerDay, enabled);
    },
    [weekOffset, vesselId, equipmentType, maxTasksPerDay, updateUrl]
  );

  useEffect(() => {
    if (initialTaskId && data) {
      const task = [...(data.scheduledTasks || []), ...(data.blockedTasks || [])].find(
        (t) => t.id === initialTaskId
      );
      if (task) {
        setSelectedTask(task);
      }
    }
  }, [initialTaskId, data]);

  const handleExportCsv = async () => {
    try {
      const exportParams = new URLSearchParams();
      exportParams.set("format", "csv");
      if (filters.vesselIds?.length) {
        exportParams.set("vesselIds", filters.vesselIds.join(","));
      }
      if (filters.equipmentTypes?.length) {
        exportParams.set("equipmentTypes", filters.equipmentTypes.join(","));
      }
      if (filters.startDate) {
        exportParams.set("startDate", filters.startDate);
      }
      if (filters.endDate) {
        exportParams.set("endDate", filters.endDate);
      }

      const response = await fetch(`/api/pdm/export/schedule?${exportParams.toString()}`, {
        credentials: "same-origin",
        headers: { Accept: "text/csv" },
      });
      if (!response.ok) {
        throw new Error("Export failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pdm-schedule-${format(start, "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export schedule:", error);
    }
  };

  const handleMoveConfirm = (_newDate: Date, _isOverride: boolean) => {
    // TODO(arus-pdm): Wire to schedule-update mutation. Currently the dialog
    // closes without persisting the move — the persistence layer will be
    // added when the schedule-write API is finalized.
    setMoveTask(null);
  };

  const handleKpiScheduledClick = useCallback(() => {
    setBlockedPanelExpanded(false);
  }, []);

  const handleKpiUnassignedClick = useCallback(() => {
    setBlockedPanelExpanded(true);
  }, []);

  const telemetryStaleCount = useMemo(() => {
    return (data?.blockedTasks || []).filter((t) => t.blockReason === "telemetry_stale").length;
  }, [data?.blockedTasks]);

  const hasScheduledTasks = (data?.scheduledTasks?.length ?? 0) > 0;
  const hasBlockedTasks = (data?.blockedTasks?.length ?? 0) > 0;

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <FilterBar
          weekOffset={weekOffset}
          onWeekChange={handleWeekChange}
          vesselId={vesselId}
          onVesselChange={handleVesselChange}
          equipmentType={equipmentType}
          onEquipmentTypeChange={handleEquipmentTypeChange}
          maxTasksPerDay={maxTasksPerDay}
          onMaxTasksChange={handleMaxTasksChange}
          autoPopulate={autoPopulate}
          onAutoPopulateChange={handleAutoPopulateChange}
          vessels={filterOptions?.vessels ?? []}
          equipmentTypes={filterOptions?.equipmentTypes ?? []}
          isLoading={filterOptionsLoading}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="flex-shrink-0"
          data-testid="btn-export-schedule"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <TelemetryStaleWarning count={telemetryStaleCount} />

      <ScheduleKPIStrip
        kpis={data?.kpis}
        isLoading={isLoading}
        onScheduledClick={hasScheduledTasks ? handleKpiScheduledClick : undefined}
        onUnassignedClick={hasBlockedTasks ? handleKpiUnassignedClick : undefined}
      />

      {!isLoading && !hasScheduledTasks ? (
        <EmptyScheduleState hasBlockedTasks={hasBlockedTasks} />
      ) : (
        <GanttScheduleView
          tasks={data?.scheduledTasks ?? []}
          vessels={filterOptions?.vessels ?? data?.vessels ?? []}
          dateRange={data?.dateRange ?? { start, end }}
          onSelectTask={setSelectedTask}
          isLoading={isLoading}
        />
      )}

      <BlockedTasksSection
        tasks={data?.blockedTasks ?? []}
        onSelectTask={setSelectedTask}
        isLoading={isLoading}
        isExpanded={blockedPanelExpanded}
        onExpandChange={setBlockedPanelExpanded}
      />

      <TaskDetailPanel
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onMoveTask={setMoveTask}
      />

      <MoveTaskDialog
        task={moveTask}
        isOpen={!!moveTask}
        onClose={() => setMoveTask(null)}
        onConfirm={handleMoveConfirm}
      />
    </div>
  );
}

export default ScheduleView;
