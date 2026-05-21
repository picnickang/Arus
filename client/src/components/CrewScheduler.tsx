import { useShiftPlanning } from "@/features/crew";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import {
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Ship,
  Settings2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  SchedulingConfigCard,
  calcDuration,
  CREW_CERTIFICATION_TYPES,
  getCertLabel,
} from "./scheduling/crew-scheduler-cards";
import type { SchedulerCrew } from "./scheduling/crew-scheduler-cards";
import { EnhancedScheduleResultsCard } from "./scheduling/enhanced-schedule-results-card";

export { CREW_CERTIFICATION_TYPES, getCertLabel };


export function CrewScheduler() {
  const { toast } = useToast();
  const p = useShiftPlanning();
  const [showAllCrew, setShowAllCrew] = useState(false);

  const startVal = p.shiftForm.watch("start");
  const endVal = p.shiftForm.watch("end");
  useEffect(() => {
    if (startVal && endVal) {
      const dur = calcDuration(startVal, endVal);
      if (dur > 0) {
        p.shiftForm.setValue("durationH", dur);
      }
    }
  }, [startVal, endVal]);

  if (p.isLoadingCrew) {
    return <div className="p-6">Loading crew data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Badge variant="outline">Intelligent Planning</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedule Planning
            </CardTitle>
            <CardDescription>
              Configure date range and generate optimal crew assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium">Planning Period</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  onClick={() => p.selectDayRange(7)}
                  data-testid="button-7-days"
                  className="flex-1"
                >
                  Next 7 Days
                </Button>
                <Button
                  variant="outline"
                  onClick={() => p.selectDayRange(14)}
                  data-testid="button-14-days"
                  className="flex-1"
                >
                  Next 14 Days
                </Button>
                <Button
                  variant="outline"
                  onClick={() => p.selectDayRange(30)}
                  data-testid="button-30-days"
                  className="flex-1"
                >
                  Next 30 Days
                </Button>
              </div>
              {p.selectedDays.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {p.selectedDays.length} days selected:{" "}
                  {format(new Date(p.selectedDays[0]), "MMM d")} -{" "}
                  {format(new Date(p.selectedDays[p.selectedDays.length - 1]), "MMM d")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium">Available Resources</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="border rounded p-3">
                  <div className="text-2xl font-bold text-blue-600">{p.crew.length}</div>
                  <div className="text-sm text-muted-foreground">Total SchedulerCrew</div>
                </div>
                <div className="border rounded p-3">
                  <div className="text-2xl font-bold text-green-600">
                    {p.crew.filter((c: SchedulerCrew) => c.skills?.includes("watchkeeping")).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Watch Qualified</div>
                </div>
                <div className="border rounded p-3">
                  <div className="text-2xl font-bold text-orange-600">
                    {p.shiftTemplates.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Shift Templates</div>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-base font-medium">Scheduling Engine</Label>
              <Select value={p.selectedEngine} onValueChange={p.setSelectedEngine}>
                <SelectTrigger data-testid="select-engine">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="greedy">Greedy Algorithm (Fast)</SelectItem>
                  <SelectItem value="ortools">OR-Tools Optimizer (Advanced)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                {p.selectedEngine === "greedy"
                  ? "Fast heuristic algorithm for basic scheduling"
                  : "Advanced constraint satisfaction with optimal resource allocation"}
              </p>
            </div>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  data-testid="toggle-preferences"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    <span>Advanced Scheduling Preferences</span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Priority Weights</Label>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm">Fairness</Label>
                        <Input
                          type="number"
                          value={p.preferences.weights.fairness}
                          onChange={(e) => {
                            const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            p.setPreferences({
                              ...p.preferences,
                              weights: { ...p.preferences.weights, fairness: v },
                            });
                          }}
                          className="w-16 h-7 text-xs text-right"
                          min={0}
                          max={100}
                          data-testid="input-fairness"
                        />
                      </div>
                      <Slider
                        value={[p.preferences.weights.fairness]}
                        onValueChange={(val) =>
                          p.setPreferences({
                            ...p.preferences,
                            weights: { ...p.preferences.weights, fairness: val[0] },
                          })
                        }
                        min={0}
                        max={100}
                        step={1}
                        data-testid="slider-fairness"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Balance workload across crew
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm">Night Shift Weight</Label>
                        <Input
                          type="number"
                          value={p.preferences.weights.night_over}
                          onChange={(e) => {
                            const v = Math.min(50, Math.max(0, Number(e.target.value) || 0));
                            p.setPreferences({
                              ...p.preferences,
                              weights: { ...p.preferences.weights, night_over: v },
                            });
                          }}
                          className="w-16 h-7 text-xs text-right"
                          min={0}
                          max={50}
                          data-testid="input-night"
                        />
                      </div>
                      <Slider
                        value={[p.preferences.weights.night_over]}
                        onValueChange={(val) =>
                          p.setPreferences({
                            ...p.preferences,
                            weights: { ...p.preferences.weights, night_over: val[0] },
                          })
                        }
                        min={0}
                        max={50}
                        step={1}
                        data-testid="slider-night"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Penalty for too many night shifts
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-sm">SchedulerCrew Preferences</Label>
                        <Input
                          type="number"
                          value={p.preferences.weights.pref_off}
                          onChange={(e) => {
                            const v = Math.min(50, Math.max(0, Number(e.target.value) || 0));
                            p.setPreferences({
                              ...p.preferences,
                              weights: { ...p.preferences.weights, pref_off: v },
                            });
                          }}
                          className="w-16 h-7 text-xs text-right"
                          min={0}
                          max={50}
                          data-testid="input-preferences"
                        />
                      </div>
                      <Slider
                        value={[p.preferences.weights.pref_off]}
                        onValueChange={(val) =>
                          p.setPreferences({
                            ...p.preferences,
                            weights: { ...p.preferences.weights, pref_off: val[0] },
                          })
                        }
                        min={0}
                        max={50}
                        step={1}
                        data-testid="slider-preferences"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Honor crew day-off requests
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Rules</Label>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm">Max Nights per Week:</Label>
                    <Input
                      type="number"
                      value={p.preferences.rules.max_nights_per_week}
                      onChange={(e) =>
                        p.setPreferences({
                          ...p.preferences,
                          rules: {
                            ...p.preferences.rules,
                            max_nights_per_week: Number.parseInt(e.target.value) || 4,
                          },
                        })
                      }
                      className="w-20"
                      min={0}
                      max={7}
                      data-testid="input-max-nights"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.showConstraints}
                onChange={(e) => p.setShowConstraints(e.target.checked)}
                data-testid="checkbox-show-constraints"
              />
              <Label>Manage Vessel Constraints</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.validateSTCW}
                onChange={(e) => p.setValidateSTCW(e.target.checked)}
                data-testid="checkbox-validate-stcw"
              />
              <Label>Validate STCW Compliance</Label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={p.handlePlanSchedule}
                disabled={p.selectedDays.length === 0 || p.planScheduleMutation.isPending}
                className="flex-1"
                data-testid="button-generate-schedule"
                variant="outline"
              >
                {p.planScheduleMutation.isPending ? "Planning..." : "Basic Schedule"}
              </Button>
              <Button
                onClick={p.handleEnhancedPlanSchedule}
                disabled={p.selectedDays.length === 0 || p.enhancedScheduleMutation.isPending}
                className="flex-1"
                data-testid="button-generate-enhanced-schedule"
              >
                {p.enhancedScheduleMutation.isPending ? "Optimizing..." : "Enhanced Schedule"}
              </Button>
            </div>
            {p.selectedDays.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Click one of the planning period buttons above to select dates
              </p>
            )}
          </CardContent>
        </Card>

        {p.showConstraints && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Vessel Constraints Management
              </CardTitle>
              <CardDescription>
                Manage port calls, drydock windows, and operational constraints
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="portcalls" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="portcalls">Port Calls</TabsTrigger>
                  <TabsTrigger value="drydocks">Drydock Windows</TabsTrigger>
                </TabsList>
                <TabsContent value="portcalls" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">Add Port Call</h4>
                      <div className="space-y-2">
                        <Select
                          value={p.newPortCall.vesselId}
                          onValueChange={(val) =>
                            p.setNewPortCall({ ...p.newPortCall, vesselId: val })
                          }
                        >
                          <SelectTrigger data-testid="select-port-vessel">
                            <SelectValue placeholder="Select Vessel" />
                          </SelectTrigger>
                          <SelectContent>
                            {(p.vessels as Array<{ id: string; name?: string }>)
                              .filter((v) => v.id?.trim())
                              .map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name || v.id}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Port Name"
                          value={p.newPortCall.port}
                          onChange={(e) =>
                            p.setNewPortCall({ ...p.newPortCall, port: e.target.value })
                          }
                          data-testid="input-port-name"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Start</Label>
                            <Input
                              type="datetime-local"
                              value={p.newPortCall.start}
                              onChange={(e) =>
                                p.setNewPortCall({ ...p.newPortCall, start: e.target.value })
                              }
                              data-testid="input-port-start"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">End</Label>
                            <Input
                              type="datetime-local"
                              value={p.newPortCall.end}
                              onChange={(e) =>
                                p.setNewPortCall({ ...p.newPortCall, end: e.target.value })
                              }
                              min={p.newPortCall.start || undefined}
                              data-testid="input-port-end"
                            />
                          </div>
                        </div>
                        {p.newPortCall.start &&
                          p.newPortCall.end &&
                          p.newPortCall.end < p.newPortCall.start && (
                            <p className="text-xs text-destructive">
                              End date must be after start date
                            </p>
                          )}
                        <Input
                          type="number"
                          placeholder="Crew Required"
                          value={p.newPortCall.crewRequired}
                          onChange={(e) =>
                            p.setNewPortCall({
                              ...p.newPortCall,
                              crewRequired: Number.parseInt(e.target.value) || 2,
                            })
                          }
                          data-testid="input-port-crew"
                        />
                        <Button
                          onClick={p.handleAddPortCall}
                          className="w-full"
                          disabled={
                            !!(
                              p.newPortCall.start &&
                              p.newPortCall.end &&
                              p.newPortCall.end < p.newPortCall.start
                            )
                          }
                          data-testid="button-add-port"
                        >
                          Add Port Call
                        </Button>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Existing Port Calls</h4>
                      <div className="space-y-2">
                        {(
                          p.allPortCalls as Array<{
                            id: string;
                            port: string;
                            vesselId: string;
                            start: string;
                            end: string;
                            crewRequired: number;
                          }>
                        ).map((port) => (
                          <div key={port.id} className="border rounded p-2">
                            <div className="font-medium">{port.port}</div>
                            <div className="text-sm text-muted-foreground">
                              {port.vesselId} • {new Date(port.start).toLocaleDateString()} -{" "}
                              {new Date(port.end).toLocaleDateString()}
                            </div>
                            <div className="text-sm">SchedulerCrew: {port.crewRequired}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="drydocks" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">Add Drydock Window</h4>
                      <div className="space-y-2">
                        <Select
                          value={p.newDrydock.vesselId}
                          onValueChange={(val) =>
                            p.setNewDrydock({ ...p.newDrydock, vesselId: val })
                          }
                        >
                          <SelectTrigger data-testid="select-drydock-vessel">
                            <SelectValue placeholder="Select Vessel" />
                          </SelectTrigger>
                          <SelectContent>
                            {(p.vessels as Array<{ id: string; name?: string }>)
                              .filter((v) => v.id?.trim())
                              .map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name || v.id}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Description"
                          value={p.newDrydock.description}
                          onChange={(e) =>
                            p.setNewDrydock({ ...p.newDrydock, description: e.target.value })
                          }
                          data-testid="input-drydock-description"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Start</Label>
                            <Input
                              type="datetime-local"
                              value={p.newDrydock.start}
                              onChange={(e) =>
                                p.setNewDrydock({ ...p.newDrydock, start: e.target.value })
                              }
                              data-testid="input-drydock-start"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">End</Label>
                            <Input
                              type="datetime-local"
                              value={p.newDrydock.end}
                              onChange={(e) =>
                                p.setNewDrydock({ ...p.newDrydock, end: e.target.value })
                              }
                              min={p.newDrydock.start || undefined}
                              data-testid="input-drydock-end"
                            />
                          </div>
                        </div>
                        {p.newDrydock.start &&
                          p.newDrydock.end &&
                          p.newDrydock.end < p.newDrydock.start && (
                            <p className="text-xs text-destructive">
                              End date must be after start date
                            </p>
                          )}
                        <Input
                          type="number"
                          placeholder="Crew Required"
                          value={p.newDrydock.crewRequired}
                          onChange={(e) =>
                            p.setNewDrydock({
                              ...p.newDrydock,
                              crewRequired: Number.parseInt(e.target.value) || 5,
                            })
                          }
                          data-testid="input-drydock-crew"
                        />
                        <Button
                          onClick={p.handleAddDrydock}
                          className="w-full"
                          disabled={
                            !!(
                              p.newDrydock.start &&
                              p.newDrydock.end &&
                              p.newDrydock.end < p.newDrydock.start
                            )
                          }
                          data-testid="button-add-drydock"
                        >
                          Add Drydock Window
                        </Button>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Existing Drydock Windows</h4>
                      <div className="space-y-2">
                        {(
                          p.allDrydockWindows as unknown as Array<{
                            id: string;
                            yard: string;
                            vesselId: string;
                            start: string;
                            end: string;
                            crewRequired: number;
                          }>
                        ).map((dd) => (
                          <div key={dd.id} className="border rounded p-2">
                            <div className="font-medium">{dd.yard}</div>
                            <div className="text-sm text-muted-foreground">
                              {dd.vesselId} • {new Date(dd.start).toLocaleDateString()} -{" "}
                              {new Date(dd.end).toLocaleDateString()}
                            </div>
                            <div className="text-sm">SchedulerCrew: {dd.crewRequired}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <SchedulingConfigCard
          p={p}
          toast={toast}
          showAllCrew={showAllCrew}
          setShowAllCrew={setShowAllCrew}
        />
      </div>

      <EnhancedScheduleResultsCard p={p} />

      {p.scheduleResult && !p.enhancedScheduleResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Schedule Results
              <Badge variant={p.scheduleResult.unfilled.length > 0 ? "destructive" : "default"}>
                {p.scheduleResult.scheduled} Scheduled
              </Badge>
            </CardTitle>
            <CardDescription>{p.scheduleResult.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded">
                  <div className="text-2xl font-bold text-green-600">
                    {p.scheduleResult.scheduled}
                  </div>
                  <div className="text-sm text-muted-foreground">Shifts Scheduled</div>
                </div>
                <div className="text-center p-4 border rounded">
                  <div className="text-2xl font-bold text-red-600">
                    {p.scheduleResult.unfilled.reduce((sum, u) => sum + u.need, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Unfilled Positions</div>
                </div>
                <div className="text-center p-4 border rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {(() => {
                      const totalUnfilled = p.scheduleResult.unfilled.reduce(
                        (sum, u) => sum + u.need,
                        0
                      );
                      const total = p.scheduleResult.scheduled + totalUnfilled;
                      return total > 0 ? Math.round((p.scheduleResult.scheduled / total) * 100) : 0;
                    })()}
                    %
                  </div>
                  <div className="text-sm text-muted-foreground">Coverage Rate</div>
                </div>
              </div>
              {p.scheduleResult.unfilled.length > 0 && (
                <div className="border border-yellow-200 bg-yellow-50 rounded p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">Unfilled Positions</span>
                  </div>
                  <div className="space-y-1">
                    {p.scheduleResult.unfilled.map((u) => (
                      <div
                        key={`unfilled-${u.day}-${u.shiftId}`}
                        className="text-sm text-yellow-700"
                      >
                        {format(new Date(u.day), "MMM d")}: {u.shiftId} - {u.need} position(s) (
                        {u.reason})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
