import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Grid, Upload, Download, FileCheck, Palette, Undo, Redo, Save, Clock, Calendar,
  ChevronLeft, ChevronRight, Copy, AlertTriangle, TrendingUp, ListChecks, ChevronDown, ChevronUp, Smartphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FatigueRiskBadge } from "@/components/crew/FatigueRiskBadge";
import { type Crew, type Vessel, MONTHS, chunks, useHoursOfRestData } from "@/features/crew";

export function HoursOfRestGrid() {
  const {
    meta, setMeta, rows, csv, setCsv, mode, setMode,
    history, historyIndex, saveStatus, viewMode, setViewMode, weekOffset, setWeekOffset,
    selectedDay, setSelectedDay, liveCheck, setLiveCheck, showSummary, setShowSummary,
    customRestStart, setCustomRestStart, customRestEnd, setCustomRestEnd,
    monthsToCopy, setMonthsToCopy, monthsToRemove, setMonthsToRemove, isDragging,
    crew, vessels, filteredCrew, isVesselSelected, isReadyForActions,
    compliance, summaryStats, displayRows,
    undo, redo, startDrag, onDrag, exportCSV, importCSV, clearAll,
    applyCustomRestToAllDays, copyMonthToYear, removeMonths, upload, runCheck, exportPdf, loadFromProposedPlan,
  } = useHoursOfRestData();

  const cell = 18, hourW = 24, hdrH = 26;
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        {saveStatus === "saved" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><Save className="w-3 h-3 mr-1" />Saved</Badge>}
        {saveStatus === "saving" && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="w-3 h-3 mr-1 animate-spin" />Saving...</Badge>}
        {saveStatus === "unsaved" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><AlertTriangle className="w-3 h-3 mr-1" />Unsaved changes</Badge>}
      </div>

      <Card>
        <CardHeader><CardTitle>Setup</CardTitle><CardDescription>Select vessel and crew member to view or edit their hours of rest</CardDescription></CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="vessel-select" className="text-base font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">1</span>
                Select Vessel
              </Label>
              <Select value={meta.vessel_id || "all"} onValueChange={(value) => setMeta({ ...meta, vessel_id: value, crew_id: "" })}>
                <SelectTrigger data-testid="select-vessel-grid" className="h-11"><SelectValue placeholder="Choose a vessel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vessels (includes unassigned crew)</SelectItem>
                  {vessels.filter((v: Vessel) => v.id).map((vessel: Vessel) => <SelectItem key={vessel.id} value={vessel.id}>{vessel.name} ({vessel.type})</SelectItem>)}
                </SelectContent>
              </Select>
              {!isVesselSelected && <p className="text-sm text-muted-foreground flex items-start gap-2"><span>Select a vessel or "All Vessels" to view crew members</span></p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="crew-select" className="text-base font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">2</span>
                Select Crew Member
              </Label>
              <Select value={meta.crew_id} onValueChange={(value) => setMeta({ ...meta, crew_id: value })} disabled={!isVesselSelected}>
                <SelectTrigger data-testid="select-crew-grid" className={`h-11 ${!isVesselSelected ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <SelectValue placeholder={!isVesselSelected ? "Select vessel first" : "Choose a crew member"} />
                </SelectTrigger>
                <SelectContent>{filteredCrew.map((member: Crew) => <SelectItem key={member.id} value={member.id}>{member.name} - {member.rank}</SelectItem>)}</SelectContent>
              </Select>
              {!isVesselSelected && <p className="text-sm text-muted-foreground">Crew selection will be available after choosing a vessel</p>}
              {isVesselSelected && filteredCrew.length === 0 && <p className="text-sm text-amber-600 dark:text-amber-400">No crew members found for this vessel</p>}
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">3</span>
                Select Time Period
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-normal">Month</Label>
                  <Select value={meta.month} onValueChange={(value) => setMeta({ ...meta, month: value })}>
                    <SelectTrigger data-testid="select-month-grid"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m) => <SelectItem key={m.label} value={m.label}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-normal">Year</Label>
                  <Input type="number" placeholder="Year" value={meta.year || 2025} onChange={(e) => setMeta({ ...meta, year: Number(e.target.value) || 2025 })} data-testid="input-year-grid" />
                </div>
              </div>
            </div>

            {isReadyForActions && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <span className="text-lg">✓</span>
                    <span>Ready to edit hours of rest for <strong>{crew.find((c) => c.id === meta.crew_id)?.name}</strong> ({meta.month} {meta.year})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Fatigue Risk:</span>
                    <FatigueRiskBadge crewId={meta.crew_id} crewName={crew.find((c) => c.id === meta.crew_id)?.name} showScore />
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
              <div className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" /><CardTitle>Compliance Summary</CardTitle></div>
              <Button variant="ghost" size="sm" onClick={() => setShowSummary(false)}><ChevronUp className="w-4 h-4" /></Button>
            </div>
            <CardDescription>Month overview and compliance statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Compliance Rate</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{summaryStats.complianceRate}%</p>
                <Progress value={Number.parseFloat(summaryStats.complianceRate)} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">{summaryStats.compliantDays}/{summaryStats.totalDays} days</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Avg Rest/Day</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summaryStats.avgRest}h</p>
                <p className="text-xs text-muted-foreground mt-1">Total: {summaryStats.totalRest}h this month</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Violations</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{summaryStats.violations}</p>
                <p className="text-xs text-muted-foreground mt-1">{summaryStats.criticalViolations} critical (&lt;8h)</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg">
                <p className="text-sm text-muted-foreground">Longest Work</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{summaryStats.longestWork}h</p>
                <p className="text-xs text-muted-foreground mt-1">Continuous period</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!showSummary && isReadyForActions && (
        <Button variant="outline" size="sm" onClick={() => setShowSummary(true)} className="w-full">
          <ChevronDown className="w-4 h-4 mr-2" />Show Summary Dashboard
        </Button>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>View & Edit Controls</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button variant={viewMode === "month" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("month")} data-testid="button-view-month"><Calendar className="w-4 h-4 mr-1" />Month</Button>
                <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" onClick={() => { setViewMode("week"); setWeekOffset(0); }} data-testid="button-view-week"><ListChecks className="w-4 h-4 mr-1" />Week</Button>
                <Button variant={viewMode === "mobile" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("mobile")} data-testid="button-view-mobile"><Smartphone className="w-4 h-4 mr-1" />Mobile</Button>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)" data-testid="button-undo"><Undo className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)" data-testid="button-redo"><Redo className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "week" && (
            <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))} disabled={weekOffset === 0}><ChevronLeft className="w-4 h-4" />Previous Week</Button>
              <span className="font-medium">Week {weekOffset + 1} of {Math.ceil(rows.length / 7)}</span>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset(Math.min(Math.floor(rows.length / 7), weekOffset + 1))} disabled={weekOffset >= Math.floor(rows.length / 7)}>Next Week<ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch id="live-check" checked={liveCheck} onCheckedChange={setLiveCheck} />
              <Label htmlFor="live-check" className="text-sm">Live compliance check</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Custom Rest Schedule</CardTitle>
          <CardDescription>Define rest periods and apply to days, months, or entire year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Rest Period Time Range</Label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">From:</Label>
                  <Input type="time" value={customRestStart} onChange={(e) => setCustomRestStart(e.target.value)} className="w-32" data-testid="input-rest-start-time" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
                  <Input type="time" value={customRestEnd} onChange={(e) => setCustomRestEnd(e.target.value)} className="w-32" data-testid="input-rest-end-time" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Example: 20:00 to 06:00 for night rest</p>
            </div>

            <div className="pt-3 border-t">
              <Label className="text-sm font-medium mb-2 block">Apply to Current Month</Label>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={applyCustomRestToAllDays} className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900" data-testid="button-apply-rest-all-days">
                  <Copy className="w-3 h-3 mr-1" />Copy to All Days of {meta.month}
                </Button>
              </div>
            </div>

            <div className="pt-3 border-t">
              <Label className="text-sm font-medium mb-2 block">Copy Month to Entire Year</Label>
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">This will copy the current month's schedule ({meta.month} {meta.year}) to all selected months of the year</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {MONTHS.map((month) => (
                      <label key={month.label} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={monthsToCopy.includes(month.label)} onChange={(e) => { if (e.target.checked) { setMonthsToCopy([...monthsToCopy, month.label]); } else { setMonthsToCopy(monthsToCopy.filter((m) => m !== month.label)); } }} className="rounded" />
                        <span>{month.label.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={copyMonthToYear} disabled={monthsToCopy.length === 0} className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-copy-month-to-year"><Copy className="w-3 h-3 mr-1" />Copy to {monthsToCopy.length} Selected Month(s)</Button>
                  <Button size="sm" variant="outline" onClick={() => setMonthsToCopy(MONTHS.map((m) => m.label))}>Select All</Button>
                  <Button size="sm" variant="outline" onClick={() => setMonthsToCopy([])}>Clear</Button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <Label className="text-sm font-medium mb-2 block">Clear Month Data</Label>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-800 dark:text-red-200 mb-2">Select months to clear their rest schedule data</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {MONTHS.map((month) => (
                      <label key={month.label} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={monthsToRemove.includes(month.label)} onChange={(e) => { if (e.target.checked) { setMonthsToRemove([...monthsToRemove, month.label]); } else { setMonthsToRemove(monthsToRemove.filter((m) => m !== month.label)); } }} className="rounded" />
                        <span>{month.label.slice(0, 3)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={removeMonths} disabled={monthsToRemove.length === 0} data-testid="button-remove-months"><AlertTriangle className="w-3 h-3 mr-1" />Clear {monthsToRemove.length} Selected Month(s)</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-700 shadow-md">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">Editing Tools</CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">Click cells to toggle, or use paint mode to drag and fill multiple cells</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-950 rounded-lg border border-slate-200 dark:border-slate-600">
              <div className="flex items-start gap-3">
                <Palette className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <Label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Smart Toggle Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Click to toggle individual cells, or click and drag to toggle multiple cells. Cells automatically switch to their opposite state:{" "}
                    <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-400 rounded-full"></span>REST → WORK</span> or{" "}
                    <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-400 rounded-full"></span>WORK → REST</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Save & Verify</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={upload} size="default" disabled={!isReadyForActions} className={`shadow-md transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400 text-gray-200" : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg"}`} data-testid="button-upload-grid" title={!isReadyForActions ? "Select vessel and crew member first" : "Save rest data to database"}><Upload className="w-4 h-4 mr-2" />Save to Database</Button>
                  <Button onClick={runCheck} variant="outline" size="default" disabled={!isReadyForActions} className={`transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-500" : "border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-950"}`} data-testid="button-check-grid" title={!isReadyForActions ? "Select vessel and crew member first" : "Check STCW compliance"}><FileCheck className="w-4 h-4 mr-2" />Check Compliance</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Data Management</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={loadFromProposedPlan} variant="outline" size="sm" disabled={!isReadyForActions} className={`transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed border-gray-300 text-gray-500" : "border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 dark:text-indigo-400 dark:border-indigo-600 dark:hover:bg-indigo-950"}`} data-testid="button-load-proposed-plan" title={!isReadyForActions ? "Select vessel and crew member first" : "Load from crew schedule"}><FileCheck className="w-4 h-4 mr-2" />Load from Schedule</Button>
                  <Button onClick={exportPdf} variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400 dark:text-purple-400 dark:border-purple-600 dark:hover:bg-purple-950 transition-all duration-200" data-testid="button-export-pdf-grid" title="Generate PDF report"><Download className="w-4 h-4 mr-2" />Export PDF</Button>
                  <Button onClick={exportCSV} variant="outline" size="sm" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-400 dark:text-cyan-400 dark:border-cyan-600 dark:hover:bg-cyan-950 transition-all duration-200" data-testid="button-export-csv" title="Export to CSV file">Export CSV</Button>
                  <Button onClick={importCSV} variant="outline" size="sm" className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-400 dark:text-teal-400 dark:border-teal-600 dark:hover:bg-teal-950 transition-all duration-200" data-testid="button-import-csv" title="Import from CSV file">Import CSV</Button>
                  <Button onClick={clearAll} variant="outline" size="sm" className="border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 dark:text-slate-400 dark:border-slate-600 dark:hover:bg-slate-800 transition-all duration-200" data-testid="button-clear-all" title="Clear all hours in the grid">Clear All</Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><FileCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm mb-1">STCW Maritime Compliance Rules</h4>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <li>• <span className="font-medium">Minimum 10 hours</span> rest in any 24-hour period</li>
                  <li>• <span className="font-medium">Minimum 77 hours</span> rest in any 7-day period</li>
                  <li>• <span className="font-medium">Maximum 2 rest blocks</span> per day with one ≥6 hours</li>
                  <li>• <span className="text-indigo-600 dark:text-indigo-400">Night hours (20:00-06:00)</span> have visual indicators</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "mobile" ? (
        <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
            <CardTitle className="text-xl font-semibold text-slate-800 dark:text-slate-200">Day-by-Day View</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">Optimized for mobile devices - tap time blocks to edit</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {displayRows.map((r, ri) => {
              const c = compliance[ri];
              const restChunks = chunks(r);
              return (
                <div key={r.date} className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{new Date(r.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</h4>
                      <p className="text-xs text-muted-foreground">{r.date}</p>
                    </div>
                    <Badge variant={c.dayOK ? "default" : "destructive"} className="ml-2">{c.dayOK ? "✓ Compliant" : "✗ Violation"}</Badge>
                  </div>
                  <div className="relative h-12 bg-slate-100 dark:bg-slate-800 rounded-lg mb-3 overflow-hidden">
                    {restChunks.map(([start, end], idx) => {
                      const isRest = (r as Record<string, number | string>)[`h${start}`] === 1;
                      const width = ((end - start) / 24) * 100;
                      const left = (start / 24) * 100;
                      return <div key={`chunk-${start}-${end}`} className={`absolute h-full ${isRest ? "bg-emerald-400" : "bg-rose-400"}`} style={{ left: `${left}%`, width: `${width}%` }} title={`${isRest ? "REST" : "WORK"} ${start}:00-${end}:00`} />;
                    })}
                    <div className="absolute inset-0 grid grid-cols-24">
                      {hours.map((h) => <button key={h} onMouseDown={() => startDrag(ri, h)} onMouseEnter={() => isDragging && onDrag(ri, h)} className="border-l border-slate-300 dark:border-slate-600 first:border-l-0 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors" />)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded"><p className="text-muted-foreground">Rest Total</p><p className={`font-semibold ${c.restTotal >= 10 ? "text-emerald-600" : "text-rose-600"}`}>{c.restTotal}h</p></div>
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded"><p className="text-muted-foreground">Min 24h</p><p className={`font-semibold ${c.minRest24 >= 10 ? "text-emerald-600" : "text-rose-600"}`}>{c.minRest24.toFixed(0)}h</p></div>
                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded"><p className="text-muted-foreground">Blocks</p><p className={`font-semibold ${c.splitOK ? "text-emerald-600" : "text-rose-600"}`}>{restChunks.filter(([a]) => (r as Record<string, number | string>)[`h${a}`] === 1).length}</p></div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
            <CardTitle className="text-xl font-semibold text-slate-800 dark:text-slate-200">Rest Hours Grid</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Click to toggle cells, drag to paint.{" "}
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-emerald-200 dark:bg-emerald-800 rounded border"></span> REST</span> •{" "}
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-rose-200 dark:bg-rose-800 rounded border"></span> WORK</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner" data-testid="rest-hours-grid">
              <div className="sticky top-0 z-10" style={{ display: "grid", gridTemplateColumns: `110px repeat(24, ${hourW}px) 75px 75px`, alignItems: "center" }}>
                <div className="bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 px-3 py-2 font-medium text-slate-700 dark:text-slate-300">Date</div>
                {hours.map((h) => <div key={h} className="bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border-r border-slate-300 dark:border-slate-600 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700" style={{ height: hdrH + 6, lineHeight: `${hdrH + 6}px`, fontSize: 11 }}>{String(h).padStart(2, "0")}</div>)}
                <div className="bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 text-center font-medium text-slate-700 dark:text-slate-300 px-2 py-2 text-xs">Rest/24h</div>
                <div className="bg-slate-100 dark:bg-slate-800 text-center font-medium text-slate-700 dark:text-slate-300 px-2 py-2 text-xs">Min24h</div>
              </div>

              {displayRows.map((r, ri) => {
                const c = compliance[viewMode === "week" ? weekOffset * 7 + ri : ri];
                const dayOK = c?.dayOK;
                const actualIndex = viewMode === "week" ? weekOffset * 7 + ri : ri;
                return (
                  <div key={r.date} role="button" tabIndex={0} className={`group hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors ${selectedDay === actualIndex ? "bg-blue-50 dark:bg-blue-950" : ""}`} onClick={() => setSelectedDay(actualIndex)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDay(actualIndex); } }}>
                    <div style={{ display: "grid", gridTemplateColumns: `110px repeat(24, ${hourW}px) 75px 75px` }}>
                      <div className={`bg-slate-50 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 px-3 py-2 flex items-center justify-center font-mono font-medium text-slate-700 dark:text-slate-300 ${!dayOK && liveCheck ? "border-l-4 border-l-rose-500" : ""}`}><span className="text-xs">{r.date.slice(8, 10)}</span></div>
                      {hours.map((h) => {
                        const v = (r as Record<string, number | string>)[`h${h}`] || 0;
                        const isRest = v === 1;
                        const isNightHour = h >= 20 || h < 6;
                        return (
                          <div key={h} onMouseDown={(e) => { e.preventDefault(); startDrag(actualIndex, h); }} onMouseEnter={() => onDrag(actualIndex, h)}
                            className={`border-r border-b border-slate-200 dark:border-slate-700 cursor-crosshair transition-all duration-150 hover:scale-105 hover:z-10 hover:shadow-md ${isRest ? "bg-emerald-100 dark:bg-emerald-900 hover:bg-emerald-200 dark:hover:bg-emerald-800" : "bg-rose-100 dark:bg-rose-900 hover:bg-rose-200 dark:hover:bg-rose-800"} ${isNightHour ? "ring-1 ring-inset ring-indigo-300 dark:ring-indigo-600" : ""}`}
                            style={{ width: hourW, height: cell + 2, position: "relative" }} data-testid={`grid-cell-${actualIndex}-${h}`} title={`${isRest ? "REST" : "WORK"} at ${String(h).padStart(2, "0")}:00${isNightHour ? " (Night)" : ""}`}>
                            {isRest && <div className="absolute inset-0 flex items-center justify-center opacity-20"><div className="w-1 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full"></div></div>}
                          </div>
                        );
                      })}
                      <div className={`border-r border-b border-slate-200 dark:border-slate-700 text-center flex items-center justify-center font-mono font-semibold ${c.restTotal >= 10 ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300"}`} style={{ fontSize: 11 }}>{c.restTotal}</div>
                      <div className={`border-b border-slate-200 dark:border-slate-700 text-center flex items-center justify-center font-mono font-semibold ${c.minRest24 >= 10 ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300"}`} style={{ fontSize: 11 }}>{c.minRest24.toFixed(0)}</div>
                    </div>
                    <div className={`h-1 transition-all duration-300 ${dayOK ? "bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-sm" : "bg-gradient-to-r from-rose-400 to-rose-600 shadow-sm"}`} style={{ marginBottom: 2 }}><div className={`h-full w-full ${dayOK ? "animate-pulse" : ""}`}></div></div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "CSV" && (
        <Card>
          <CardHeader><CardTitle>CSV Data</CardTitle><CardDescription>Edit raw CSV data (date,h0..h23)</CardDescription></CardHeader>
          <CardContent>
            <textarea className="w-full h-40 p-2 border rounded-md font-mono text-sm" value={csv} onChange={(e) => setCsv(e.target.value)} data-testid="textarea-csv" />
            <div className="flex gap-2 mt-2">
              <Button onClick={importCSV} size="sm" data-testid="button-import-csv-modal">Import & Apply</Button>
              <Button onClick={() => setMode("GRID")} variant="outline" size="sm">Back to Grid</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
