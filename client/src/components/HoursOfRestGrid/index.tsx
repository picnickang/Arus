import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Upload,
  Download,
  FileCheck,
  Palette,
  Undo,
  Redo,
  Save,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  AlertTriangle,
  TrendingUp,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Smartphone,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FatigueRiskBadge } from "@/components/crew/FatigueRiskBadge";
import { useToast } from "@/hooks/use-toast";
import { type Crew, type Vessel, MONTHS, useHoursOfRestData } from "@/features/crew";
import { GRID_COLS, HDR_H_LINE, HDR_H_TOTAL, HOURS } from "./constants";
import { GridRow } from "./GridRow";
import { MobileDayCard } from "./MobileDayCard";

export function HoursOfRestGrid() {
  const {
    meta,
    setMeta,
    rows,
    csv,
    setCsv,
    mode,
    setMode,
    history,
    historyIndex,
    saveStatus,
    viewMode,
    setViewMode,
    weekOffset,
    setWeekOffset,
    selectedDay,
    setSelectedDay,
    liveCheck,
    setLiveCheck,
    showSummary,
    setShowSummary,
    customRestStart,
    setCustomRestStart,
    customRestEnd,
    setCustomRestEnd,
    monthsToCopy,
    setMonthsToCopy,
    monthsToRemove,
    setMonthsToRemove,
    isDragging,
    crew,
    vessels,
    filteredCrew,
    isVesselSelected,
    isReadyForActions,
    compliance,
    summaryStats,
    displayRows,
    undo,
    redo,
    startDrag,
    onDrag,
    exportCSV,
    importCSV,
    clearAll,
    applyCustomRestToAllDays,
    copyMonthToYear,
    removeMonths,
    upload,
    runCheck,
    exportPdf,
    loadFromProposedPlan,
  } = useHoursOfRestData();

  const { toast } = useToast();

  const selectedCrewMember = React.useMemo(
    () => crew.find((c) => c.id === meta.crew_id),
    [crew, meta.crew_id]
  );
  const selectedCrewName = selectedCrewMember?.name;

  const weekCount = Math.ceil(rows.length / 7);
  const maxWeekOffset = Math.max(0, weekCount - 1);

  const complianceOffset = viewMode === "week" ? weekOffset * 7 : 0;

  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "unsaved") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  const prevSaveStatus = React.useRef(saveStatus);
  React.useEffect(() => {
    if (prevSaveStatus.current === "saving" && saveStatus === "saved") {
      toast({
        title: "Rest hours saved",
        description: `Saved for ${selectedCrewName ?? "crew member"} — ${meta.month} ${meta.year}`,
      });
    }
    prevSaveStatus.current = saveStatus;
  }, [saveStatus, selectedCrewName, meta.month, meta.year, toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        {saveStatus === "saved" && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <Save className="w-3 h-3 mr-1" />
            Saved
          </Badge>
        )}
        {saveStatus === "saving" && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            Saving...
          </Badge>
        )}
        {saveStatus === "unsaved" && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Unsaved changes
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
          <CardDescription>
            Select vessel and crew member to view or edit their hours of rest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="vessel-select"
                className="text-base font-semibold flex items-center gap-2"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">
                  1
                </span>
                Select Vessel
              </Label>
              <Select
                value={meta.vessel_id || "all"}
                onValueChange={(value) => setMeta({ ...meta, vessel_id: value, crew_id: "" })}
              >
                <SelectTrigger data-testid="select-vessel-grid" className="h-11">
                  <SelectValue placeholder="Choose a vessel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vessels (includes unassigned crew)</SelectItem>
                  {vessels
                    .filter((v: Vessel) => v.id)
                    .map((vessel: Vessel) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name} ({vessel.type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {!isVesselSelected && (
                <p className="text-sm text-muted-foreground">
                  Select a vessel or "All Vessels" to view crew members
                </p>
              )}
            </div>

            {/* Step 2 — Crew */}
            <div className="space-y-2">
              <Label
                htmlFor="crew-select"
                className="text-base font-semibold flex items-center gap-2"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">
                  2
                </span>
                Select Crew Member
              </Label>
              <Select
                value={meta.crew_id}
                onValueChange={(value) => setMeta({ ...meta, crew_id: value })}
                disabled={!isVesselSelected}
              >
                <SelectTrigger
                  data-testid="select-crew-grid"
                  className={`h-11 ${!isVesselSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <SelectValue
                    placeholder={!isVesselSelected ? "Select vessel first" : "Choose a crew member"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredCrew.map((member: Crew) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} - {member.rank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isVesselSelected && (
                <p className="text-sm text-muted-foreground">
                  Crew selection will be available after choosing a vessel
                </p>
              )}
              {isVesselSelected && filteredCrew.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No crew members found for this vessel
                </p>
              )}
            </div>

            {/* Step 3 — Time period */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">
                  3
                </span>
                Select Time Period
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-normal">Month</Label>
                  <Select
                    value={meta.month}
                    onValueChange={(value) => setMeta({ ...meta, month: value })}
                  >
                    <SelectTrigger data-testid="select-month-grid">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.label} value={m.label}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-normal">Year</Label>
                  <Input
                    type="number"
                    placeholder="Year"
                    value={meta.year || new Date().getFullYear()}
                    onChange={(e) =>
                      setMeta({ ...meta, year: Number(e.target.value) || new Date().getFullYear() })
                    }
                    data-testid="input-year-grid"
                  />
                </div>
              </div>
            </div>

            {isReadyForActions && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Ready to edit hours of rest for{" "}
                      <strong>{selectedCrewName ?? "Selected Crew Member"}</strong> ({meta.month}{" "}
                      {meta.year})
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Fatigue Risk:</span>
                    <FatigueRiskBadge crewId={meta.crew_id} crewName={selectedCrewName} showScore />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showSummary && isReadyForActions && (
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <CardTitle>Compliance Summary</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowSummary(false)}>
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>Month overview and compliance statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Compliance Rate</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {summaryStats.complianceRate}%
                </p>
                <Progress
                  value={Number.parseFloat(summaryStats.complianceRate)}
                  className="mt-2 h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryStats.compliantDays}/{summaryStats.totalDays} days
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Avg Rest/Day</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {summaryStats.avgRest}h
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {summaryStats.totalRest}h this month
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Violations</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {summaryStats.violations}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summaryStats.criticalViolations} critical (&lt;8h)
                </p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Longest Work</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {summaryStats.longestWork}h
                </p>
                <p className="text-xs text-muted-foreground mt-1">Continuous period</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {!showSummary && isReadyForActions && (
        <Button variant="outline" size="sm" onClick={() => setShowSummary(true)} className="w-full">
          <ChevronDown className="w-4 h-4 mr-2" />
          Show Compliance Summary
        </Button>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>View & Edit Controls</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  data-testid="button-view-month"
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Month
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setViewMode("week");
                    setWeekOffset(0);
                  }}
                  data-testid="button-view-week"
                >
                  <ListChecks className="w-4 h-4 mr-1" />
                  Week
                </Button>
                <Button
                  variant={viewMode === "mobile" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("mobile")}
                  data-testid="button-view-mobile"
                >
                  <Smartphone className="w-4 h-4 mr-1" />
                  Mobile
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        title="Undo (Ctrl+Z)"
                        data-testid="button-undo"
                      >
                        <Undo className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {historyIndex <= 0
                        ? "Nothing to undo"
                        : `Undo (${historyIndex} step${historyIndex !== 1 ? "s" : ""} available)`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        title="Redo (Ctrl+Y)"
                        data-testid="button-redo"
                      >
                        <Redo className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {historyIndex >= history.length - 1
                        ? "Nothing to redo"
                        : `Redo (${history.length - 1 - historyIndex} step${history.length - 1 - historyIndex !== 1 ? "s" : ""} available)`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "week" && (
            <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-lg">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                disabled={weekOffset === 0}
                data-testid="button-prev-week"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Week
              </Button>
              <span className="font-medium" data-testid="text-week-indicator">
                Week {weekOffset + 1} of {weekCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(Math.min(maxWeekOffset, weekOffset + 1))}
                disabled={weekOffset >= maxWeekOffset}
                data-testid="button-next-week"
              >
                Next Week
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="live-check"
                checked={liveCheck}
                onCheckedChange={setLiveCheck}
                data-testid="switch-live-check"
              />
              <Label htmlFor="live-check" className="text-sm">
                Live compliance check
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <CardTitle>Custom Rest Schedule</CardTitle>
            </div>
          </div>
          <CardDescription>
            Define rest periods and apply to days, months, or entire year
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Rest Period Time Range</Label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">From:</Label>
                  <Input
                    type="time"
                    value={customRestStart}
                    onChange={(e) => setCustomRestStart(e.target.value)}
                    className="w-32"
                    data-testid="input-rest-start-time"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
                  <Input
                    type="time"
                    value={customRestEnd}
                    onChange={(e) => setCustomRestEnd(e.target.value)}
                    className="w-32"
                    data-testid="input-rest-end-time"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: 20:00 to 06:00 for night rest
              </p>
            </div>

            <div className="pt-3 border-t">
              <Label className="text-sm font-medium mb-2 block">Apply to Current Month</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={applyCustomRestToAllDays}
                  className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900"
                  data-testid="button-apply-rest-all-days"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy to All Days of {meta.month}
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t">
              <Label className="text-sm font-medium mb-2 block">Copy Month to Entire Year</Label>
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                    This will copy the current month's schedule ({meta.month} {meta.year}) to all
                    selected months of the year
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {MONTHS.map((month) => (
                      <label
                        key={month.label}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={monthsToCopy.includes(month.label)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMonthsToCopy([...monthsToCopy, month.label]);
                            } else {
                              setMonthsToCopy(monthsToCopy.filter((m) => m !== month.label));
                            }
                          }}
                          className="rounded"
                          data-testid={`checkbox-copy-${month.label.toLowerCase()}`}
                        />
                        <span>{month.label.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={copyMonthToYear}
                    disabled={monthsToCopy.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-copy-month-to-year"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy to {monthsToCopy.length} Selected Month(s)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMonthsToCopy(MONTHS.map((m) => m.label))}
                    data-testid="button-select-all-months-copy"
                  >
                    Select All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMonthsToCopy([])}
                    data-testid="button-clear-months-copy"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <Label className="text-sm font-medium mb-2 block">Clear Month Data</Label>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-800 dark:text-red-200 mb-2">
                    Select months to clear their rest schedule data
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {MONTHS.map((month) => (
                      <label
                        key={month.label}
                        className="flex items-center gap-2 text-xs cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={monthsToRemove.includes(month.label)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMonthsToRemove([...monthsToRemove, month.label]);
                            } else {
                              setMonthsToRemove(monthsToRemove.filter((m) => m !== month.label));
                            }
                          }}
                          className="rounded"
                          data-testid={`checkbox-remove-${month.label.toLowerCase()}`}
                        />
                        <span>{month.label.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={removeMonths}
                  disabled={monthsToRemove.length === 0}
                  data-testid="button-remove-months"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Clear {monthsToRemove.length} Selected Month(s)
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-md">
        <CardHeader className="bg-muted/50 border-b">
          <CardTitle className="text-lg font-semibold">Editing Tools</CardTitle>
          <CardDescription>
            Click cells to toggle, or use paint mode to drag and fill multiple cells
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <Palette className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <Label className="font-semibold block mb-1">Smart Toggle Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Click to toggle individual cells, or click and drag to toggle multiple cells.
                    Cells automatically switch to their opposite state:{" "}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                      REST → WORK
                    </span>{" "}
                    or{" "}
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-rose-400 rounded-full" />
                      WORK → REST
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Save & Verify</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={upload}
                    size="default"
                    disabled={!isReadyForActions}
                    className={`shadow-md transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed bg-muted hover:bg-muted text-muted-foreground" : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg"}`}
                    data-testid="button-upload-grid"
                    title={
                      !isReadyForActions
                        ? "Select vessel and crew member first"
                        : "Save rest data to database"
                    }
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Save to Database
                  </Button>
                  <Button
                    onClick={runCheck}
                    variant="outline"
                    size="default"
                    disabled={!isReadyForActions}
                    className={`transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed border-border text-muted-foreground" : "border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-950"}`}
                    data-testid="button-check-grid"
                    title={
                      !isReadyForActions
                        ? "Select vessel and crew member first"
                        : "Check STCW compliance"
                    }
                  >
                    <FileCheck className="w-4 h-4 mr-2" />
                    Check Compliance
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Data Management</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={loadFromProposedPlan}
                    variant="outline"
                    size="sm"
                    disabled={!isReadyForActions}
                    className={`transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed border-border text-muted-foreground" : "border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 dark:text-indigo-400 dark:border-indigo-600 dark:hover:bg-indigo-950"}`}
                    data-testid="button-load-proposed-plan"
                    title={
                      !isReadyForActions
                        ? "Select vessel and crew member first"
                        : "Load from crew schedule"
                    }
                  >
                    <FileCheck className="w-4 h-4 mr-2" />
                    Load from Schedule
                  </Button>
                  <Button
                    onClick={exportPdf}
                    variant="outline"
                    size="sm"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400 dark:text-purple-400 dark:border-purple-600 dark:hover:bg-purple-950 transition-all duration-200"
                    data-testid="button-export-pdf-grid"
                    title="Generate PDF report"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button
                    onClick={exportCSV}
                    variant="outline"
                    size="sm"
                    className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-400 dark:text-cyan-400 dark:border-cyan-600 dark:hover:bg-cyan-950 transition-all duration-200"
                    data-testid="button-export-csv"
                    title="Export to CSV file"
                  >
                    Export CSV
                  </Button>
                  <Button
                    onClick={importCSV}
                    variant="outline"
                    size="sm"
                    className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-400 dark:text-teal-400 dark:border-teal-600 dark:hover:bg-teal-950 transition-all duration-200"
                    data-testid="button-import-csv"
                    title="Import from CSV file"
                  >
                    Import CSV
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="transition-all duration-200"
                        data-testid="button-clear-all"
                        title="Clear all hours in the grid"
                      >
                        Clear All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear all rest hours?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear all rest hours for{" "}
                          <strong>{selectedCrewMember?.name ?? "this crew member"}</strong> in{" "}
                          <strong>
                            {meta.month} {meta.year}
                          </strong>
                          .
                          <br />
                          You can immediately undo this with the Undo button.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={clearAll}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Clear All Hours
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg border">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">
                  Minimum hours of rest (STCW A-VIII/1 · MLC A2.3)
                </h4>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>
                    A minimum of{" "}
                    <span className="font-medium">10 hours of rest in any 24-hour period</span>.
                  </li>
                  <li>
                    A minimum of{" "}
                    <span className="font-medium">77 hours of rest in any 7-day period</span>.
                  </li>
                  <li>
                    Hours of rest may be divided into{" "}
                    <span className="font-medium">no more than two periods</span>, one of which
                    shall be <span className="font-medium">at least 6 hours</span> in length, and
                    the intervals between consecutive periods of rest shall{" "}
                    <span className="font-medium">not exceed 14 hours</span>.
                  </li>
                  <li>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      Night hours (20:00–06:00)
                    </span>{" "}
                    are visually indicated on the grid.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "mobile" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              Day-by-Day View
            </CardTitle>
            <CardDescription>
              Optimized for mobile devices — tap time blocks to edit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {displayRows.map((r, ri) => (
              <MobileDayCard
                key={r.date}
                r={r}
                ri={ri}
                c={compliance[ri]}
                isDragging={isDragging}
                startDrag={startDrag}
                onDrag={onDrag}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {viewMode !== "mobile" && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-muted/50 border-b">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Rest Hours Grid
            </CardTitle>
            <CardDescription>
              Click to toggle cells, drag to paint.{" "}
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-emerald-200 dark:bg-emerald-800 rounded border" /> REST
              </span>{" "}
              •{" "}
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 bg-rose-200 dark:bg-rose-800 rounded border" /> WORK
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 px-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">Key:</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700" />
                REST
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded bg-rose-100 dark:bg-rose-900 border border-rose-300 dark:border-rose-700" />
                WORK
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded border-2 border-indigo-300 dark:border-indigo-600" />
                Night (20:00–06:00)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 h-1 rounded bg-rose-500" />
                Violation row
              </span>
              <span className="ml-auto italic">Click or drag to toggle cells</span>
            </div>
            <div
              className="overflow-x-auto bg-background rounded-lg border shadow-inner"
              data-testid="rest-hours-grid"
            >
              <div
                className="sticky top-0 z-10"
                style={{ display: "grid", gridTemplateColumns: GRID_COLS, alignItems: "center" }}
              >
                <div className="bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 px-3 py-2 font-medium text-sm">
                  Date
                </div>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-r border-slate-300 dark:border-slate-600 text-center font-mono font-semibold transition-colors hover:bg-slate-300"
                    style={{ height: HDR_H_TOTAL, lineHeight: HDR_H_LINE, fontSize: 11 }}
                  >
                    {String(h).padStart(2, "0")}
                  </div>
                ))}
                <div className="bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 text-center font-medium text-xs px-2 py-2">
                  Rest/24h
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 text-center font-medium text-xs px-2 py-2">
                  Min24h
                </div>
              </div>

              {displayRows.filter(Boolean).map((r, ri) => {
                const actualIndex = complianceOffset + ri;
                return (
                  <GridRow
                    key={r.date}
                    r={r}
                    actualIndex={actualIndex}
                    c={compliance[actualIndex]}
                    isSelected={selectedDay === actualIndex}
                    liveCheck={liveCheck}
                    startDrag={startDrag}
                    onDrag={onDrag}
                    setSelectedDay={setSelectedDay}
                  />
                );
              })}
            </div>
            {selectedDay !== null && compliance[selectedDay] && (
              <div
                className="mt-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
                data-testid="selected-day-stats"
              >
                <span className="font-semibold text-blue-800 dark:text-blue-200">
                  {displayRows[selectedDay - complianceOffset]?.date ?? rows[selectedDay]?.date}
                </span>
                <span
                  className={
                    compliance[selectedDay].restTotal >= 10
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400"
                  }
                >
                  Rest: <strong>{compliance[selectedDay].restTotal}h</strong>
                  {compliance[selectedDay].restTotal < 10 && " ⚠ (min 10h)"}
                </span>
                <span
                  className={
                    compliance[selectedDay].minRest24 >= 10
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400"
                  }
                >
                  24h window: <strong>{compliance[selectedDay].minRest24.toFixed(1)}h</strong>
                </span>
                <span
                  className={
                    compliance[selectedDay].splitOK
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400"
                  }
                >
                  Block split:{" "}
                  <strong>{compliance[selectedDay].splitOK ? "OK" : "Violated"}</strong>
                </span>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Dismiss day detail"
                  data-testid="button-dismiss-day-stats"
                >
                  ✕
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "CSV" && (
        <Card>
          <CardHeader>
            <CardTitle>CSV Data</CardTitle>
            <CardDescription>Edit raw CSV data (date,h0..h23)</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              className="h-40 font-mono text-sm"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              data-testid="textarea-csv"
            />
            <div className="flex gap-2 mt-2">
              <Button onClick={importCSV} size="sm" data-testid="button-import-csv-modal">
                Import & Apply
              </Button>
              <Button onClick={() => setMode("GRID")} variant="outline" size="sm">
                Back to Grid
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
