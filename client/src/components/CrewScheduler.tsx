import { useShiftPlanning } from "@/features/crew";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Calendar, ChevronDown, Clock, AlertTriangle, CheckCircle, Ship, Plus, Edit, Trash2, Settings2, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import FairnessViz from "./FairnessViz";
import type { SelectShiftTemplate } from "@shared/schema";

interface Crew { id: string; name: string; rank: string; vesselId?: string; maxHours7d: number; minRestH: number; active: boolean; skills: string[]; }

function calcDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
}

export function CrewScheduler() {
  const { toast } = useToast();
  const p = useShiftPlanning();
  const [showAllCrew, setShowAllCrew] = useState(false);

  const startVal = p.shiftForm.watch("start");
  const endVal = p.shiftForm.watch("end");
  useEffect(() => {
    if (startVal && endVal) {
      const dur = calcDuration(startVal, endVal);
      if (dur > 0) p.shiftForm.setValue("durationH", dur);
    }
  }, [startVal, endVal]);

  if (p.isLoadingCrew) {return <div className="p-6">Loading crew data...</div>;}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end"><Badge variant="outline">Intelligent Planning</Badge></div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Schedule Planning</CardTitle><CardDescription>Configure date range and generate optimal crew assignments</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium">Planning Period</Label>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={() => p.selectDayRange(7)} data-testid="button-7-days" className="flex-1">Next 7 Days</Button>
                <Button variant="outline" onClick={() => p.selectDayRange(14)} data-testid="button-14-days" className="flex-1">Next 14 Days</Button>
                <Button variant="outline" onClick={() => p.selectDayRange(30)} data-testid="button-30-days" className="flex-1">Next 30 Days</Button>
              </div>
              {p.selectedDays.length > 0 && <p className="text-sm text-muted-foreground mt-2">{p.selectedDays.length} days selected: {format(new Date(p.selectedDays[0]), "MMM d")} - {format(new Date(p.selectedDays[p.selectedDays.length - 1]), "MMM d")}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium">Available Resources</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="border rounded p-3"><div className="text-2xl font-bold text-blue-600">{p.crew.length}</div><div className="text-sm text-muted-foreground">Total Crew</div></div>
                <div className="border rounded p-3"><div className="text-2xl font-bold text-green-600">{p.crew.filter((c: Crew) => c.skills?.includes("watchkeeping")).length}</div><div className="text-sm text-muted-foreground">Watch Qualified</div></div>
                <div className="border rounded p-3"><div className="text-2xl font-bold text-orange-600">{p.shiftTemplates.length}</div><div className="text-sm text-muted-foreground">Shift Templates</div></div>
              </div>
            </div>
            <div>
              <Label className="text-base font-medium">Scheduling Engine</Label>
              <Select value={p.selectedEngine} onValueChange={p.setSelectedEngine}><SelectTrigger data-testid="select-engine"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="greedy">Greedy Algorithm (Fast)</SelectItem><SelectItem value="ortools">OR-Tools Optimizer (Advanced)</SelectItem></SelectContent></Select>
              <p className="text-sm text-muted-foreground mt-1">{p.selectedEngine === "greedy" ? "Fast heuristic algorithm for basic scheduling" : "Advanced constraint satisfaction with optimal resource allocation"}</p>
            </div>
            <Collapsible>
              <CollapsibleTrigger asChild><Button variant="outline" className="w-full justify-between" data-testid="toggle-preferences"><div className="flex items-center gap-2"><Settings2 className="h-4 w-4" /><span>Advanced Scheduling Preferences</span></div><ChevronDown className="h-4 w-4" /></Button></CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Priority Weights</Label>
                  <div className="space-y-3">
                    <div><div className="flex justify-between items-center mb-2"><Label className="text-sm">Fairness</Label><Input type="number" value={p.preferences.weights.fairness} onChange={(e) => { const v = Math.min(100, Math.max(0, Number(e.target.value) || 0)); p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, fairness: v } }); }} className="w-16 h-7 text-xs text-right" min={0} max={100} data-testid="input-fairness" /></div><Slider value={[p.preferences.weights.fairness]} onValueChange={(val) => p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, fairness: val[0] } })} min={0} max={100} step={1} data-testid="slider-fairness" /><p className="text-xs text-muted-foreground mt-1">Balance workload across crew</p></div>
                    <div><div className="flex justify-between items-center mb-2"><Label className="text-sm">Night Shift Weight</Label><Input type="number" value={p.preferences.weights.night_over} onChange={(e) => { const v = Math.min(50, Math.max(0, Number(e.target.value) || 0)); p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, night_over: v } }); }} className="w-16 h-7 text-xs text-right" min={0} max={50} data-testid="input-night" /></div><Slider value={[p.preferences.weights.night_over]} onValueChange={(val) => p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, night_over: val[0] } })} min={0} max={50} step={1} data-testid="slider-night" /><p className="text-xs text-muted-foreground mt-1">Penalty for too many night shifts</p></div>
                    <div><div className="flex justify-between items-center mb-2"><Label className="text-sm">Crew Preferences</Label><Input type="number" value={p.preferences.weights.pref_off} onChange={(e) => { const v = Math.min(50, Math.max(0, Number(e.target.value) || 0)); p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, pref_off: v } }); }} className="w-16 h-7 text-xs text-right" min={0} max={50} data-testid="input-preferences" /></div><Slider value={[p.preferences.weights.pref_off]} onValueChange={(val) => p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, pref_off: val[0] } })} min={0} max={50} step={1} data-testid="slider-preferences" /><p className="text-xs text-muted-foreground mt-1">Honor crew day-off requests</p></div>
                  </div>
                </div>
                <div className="space-y-3"><Label className="text-sm font-medium">Rules</Label><div className="flex items-center gap-3"><Label className="text-sm">Max Nights per Week:</Label><Input type="number" value={p.preferences.rules.max_nights_per_week} onChange={(e) => p.setPreferences({ ...p.preferences, rules: { ...p.preferences.rules, max_nights_per_week: Number.parseInt(e.target.value) || 4 } })} className="w-20" min={0} max={7} data-testid="input-max-nights" /></div></div>
              </CollapsibleContent>
            </Collapsible>
            <div className="flex items-center gap-2"><input type="checkbox" checked={p.showConstraints} onChange={(e) => p.setShowConstraints(e.target.checked)} data-testid="checkbox-show-constraints" /><Label>Manage Vessel Constraints</Label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={p.validateSTCW} onChange={(e) => p.setValidateSTCW(e.target.checked)} data-testid="checkbox-validate-stcw" /><Label>Validate STCW Compliance</Label></div>
            <div className="flex gap-2">
              <Button onClick={p.handlePlanSchedule} disabled={p.selectedDays.length === 0 || p.planScheduleMutation.isPending} className="flex-1" data-testid="button-generate-schedule" variant="outline">{p.planScheduleMutation.isPending ? "Planning..." : "Basic Schedule"}</Button>
              <Button onClick={p.handleEnhancedPlanSchedule} disabled={p.selectedDays.length === 0 || p.enhancedScheduleMutation.isPending} className="flex-1" data-testid="button-generate-enhanced-schedule">{p.enhancedScheduleMutation.isPending ? "Optimizing..." : "Enhanced Schedule"}</Button>
            </div>
            {p.selectedDays.length === 0 && <p className="text-sm text-muted-foreground text-center">Click one of the planning period buttons above to select dates</p>}
          </CardContent>
        </Card>

        {p.showConstraints && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2"><Ship className="h-5 w-5" />Vessel Constraints Management</CardTitle><CardDescription>Manage port calls, drydock windows, and operational constraints</CardDescription></CardHeader>
            <CardContent>
              <Tabs defaultValue="portcalls" className="w-full">
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="portcalls">Port Calls</TabsTrigger><TabsTrigger value="drydocks">Drydock Windows</TabsTrigger></TabsList>
                <TabsContent value="portcalls" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">Add Port Call</h4>
                      <div className="space-y-2">
                        <Select value={p.newPortCall.vesselId} onValueChange={(val) => p.setNewPortCall({ ...p.newPortCall, vesselId: val })}><SelectTrigger data-testid="select-port-vessel"><SelectValue placeholder="Select Vessel" /></SelectTrigger><SelectContent>{(p.vessels as Array<{id: string; name?: string}>).filter((v) => v.id?.trim()).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.id}</SelectItem>)}</SelectContent></Select>
                        <Input placeholder="Port Name" value={p.newPortCall.port} onChange={(e) => p.setNewPortCall({ ...p.newPortCall, port: e.target.value })} data-testid="input-port-name" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1"><Label className="text-xs">Start</Label><Input type="datetime-local" value={p.newPortCall.start} onChange={(e) => p.setNewPortCall({ ...p.newPortCall, start: e.target.value })} data-testid="input-port-start" /></div>
                          <div className="space-y-1"><Label className="text-xs">End</Label><Input type="datetime-local" value={p.newPortCall.end} onChange={(e) => p.setNewPortCall({ ...p.newPortCall, end: e.target.value })} min={p.newPortCall.start || undefined} data-testid="input-port-end" /></div>
                        </div>
                        {p.newPortCall.start && p.newPortCall.end && p.newPortCall.end < p.newPortCall.start && <p className="text-xs text-destructive">End date must be after start date</p>}
                        <Input type="number" placeholder="Crew Required" value={p.newPortCall.crewRequired} onChange={(e) => p.setNewPortCall({ ...p.newPortCall, crewRequired: Number.parseInt(e.target.value) || 2 })} data-testid="input-port-crew" />
                        <Button onClick={p.handleAddPortCall} className="w-full" disabled={!!(p.newPortCall.start && p.newPortCall.end && p.newPortCall.end < p.newPortCall.start)} data-testid="button-add-port">Add Port Call</Button>
                      </div>
                    </div>
                    <div><h4 className="font-medium mb-2">Existing Port Calls</h4><div className="space-y-2">{(p.allPortCalls as Array<{id: string; port: string; vesselId: string; start: string; end: string; crewRequired: number}>).map((port) => <div key={port.id} className="border rounded p-2"><div className="font-medium">{port.port}</div><div className="text-sm text-muted-foreground">{port.vesselId} • {new Date(port.start).toLocaleDateString()} - {new Date(port.end).toLocaleDateString()}</div><div className="text-sm">Crew: {port.crewRequired}</div></div>)}</div></div>
                  </div>
                </TabsContent>
                <TabsContent value="drydocks" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">Add Drydock Window</h4>
                      <div className="space-y-2">
                        <Select value={p.newDrydock.vesselId} onValueChange={(val) => p.setNewDrydock({ ...p.newDrydock, vesselId: val })}><SelectTrigger data-testid="select-drydock-vessel"><SelectValue placeholder="Select Vessel" /></SelectTrigger><SelectContent>{(p.vessels as Array<{id: string; name?: string}>).filter((v) => v.id?.trim()).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.id}</SelectItem>)}</SelectContent></Select>
                        <Input placeholder="Description" value={p.newDrydock.description} onChange={(e) => p.setNewDrydock({ ...p.newDrydock, description: e.target.value })} data-testid="input-drydock-description" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1"><Label className="text-xs">Start</Label><Input type="datetime-local" value={p.newDrydock.start} onChange={(e) => p.setNewDrydock({ ...p.newDrydock, start: e.target.value })} data-testid="input-drydock-start" /></div>
                          <div className="space-y-1"><Label className="text-xs">End</Label><Input type="datetime-local" value={p.newDrydock.end} onChange={(e) => p.setNewDrydock({ ...p.newDrydock, end: e.target.value })} min={p.newDrydock.start || undefined} data-testid="input-drydock-end" /></div>
                        </div>
                        {p.newDrydock.start && p.newDrydock.end && p.newDrydock.end < p.newDrydock.start && <p className="text-xs text-destructive">End date must be after start date</p>}
                        <Input type="number" placeholder="Crew Required" value={p.newDrydock.crewRequired} onChange={(e) => p.setNewDrydock({ ...p.newDrydock, crewRequired: Number.parseInt(e.target.value) || 5 })} data-testid="input-drydock-crew" />
                        <Button onClick={p.handleAddDrydock} className="w-full" disabled={!!(p.newDrydock.start && p.newDrydock.end && p.newDrydock.end < p.newDrydock.start)} data-testid="button-add-drydock">Add Drydock Window</Button>
                      </div>
                    </div>
                    <div><h4 className="font-medium mb-2">Existing Drydock Windows</h4><div className="space-y-2">{(p.allDrydockWindows as Array<{id: string; yard: string; vesselId: string; start: string; end: string; crewRequired: number}>).map((dd) => <div key={dd.id} className="border rounded p-2"><div className="font-medium">{dd.yard}</div><div className="text-sm text-muted-foreground">{dd.vesselId} • {new Date(dd.start).toLocaleDateString()} - {new Date(dd.end).toLocaleDateString()}</div><div className="text-sm">Crew: {dd.crewRequired}</div></div>)}</div></div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Scheduling Configuration</CardTitle><CardDescription>View shift templates and crew constraints</CardDescription></CardHeader>
          <CardContent>
            <Tabs defaultValue="shifts" className="w-full">
              <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="shifts">Shift Templates</TabsTrigger><TabsTrigger value="crew">Crew Status</TabsTrigger></TabsList>
              <TabsContent value="shifts" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Shift Templates</h3>
                  <Dialog open={p.isShiftDialogOpen} onOpenChange={p.setIsShiftDialogOpen}>
                    <DialogTrigger asChild><Button data-testid="button-add-shift"><Plus className="h-4 w-4 mr-2" />Add Shift Template</Button></DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader><DialogTitle>{p.editingShiftId ? "Edit Shift Template" : "Add Shift Template"}</DialogTitle><DialogDescription>Configure shift timing, requirements, and crew assignments</DialogDescription></DialogHeader>
                      <Form {...p.shiftForm}>
                        <form onSubmit={p.shiftForm.handleSubmit(p.onSubmitShift)} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={p.shiftForm.control} name="role" render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><FormControl><Input {...field} data-testid="input-shift-role" placeholder="e.g. Navigation Watch" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={p.shiftForm.control} name="vesselId" render={({ field }) => (<FormItem><FormLabel>Vessel (Optional)</FormLabel><Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}><FormControl><SelectTrigger data-testid="select-shift-vessel"><SelectValue placeholder="Select Vessel" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None (All Vessels)</SelectItem>{(p.vessels as Array<{id: string; name?: string}>).filter((v) => v.id?.trim()).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.id}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <FormField control={p.shiftForm.control} name="start" render={({ field }) => (<FormItem><FormLabel>Start Time</FormLabel><FormControl><Input {...field} type="time" data-testid="input-shift-start" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={p.shiftForm.control} name="end" render={({ field }) => (<FormItem><FormLabel>End Time</FormLabel><FormControl><Input {...field} type="time" data-testid="input-shift-end" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={p.shiftForm.control} name="durationH" render={({ field }) => (<FormItem><FormLabel>Duration (Hours)</FormLabel><FormControl><Input {...field} type="number" min="0.5" max="24" step="0.5" readOnly className="bg-muted" data-testid="input-shift-duration" /></FormControl><FormMessage><span className="text-xs text-muted-foreground">Auto-calculated from start/end</span></FormMessage></FormItem>)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={p.shiftForm.control} name="requiredSkills" render={({ field }) => (<FormItem><FormLabel>Required Skills (Optional)</FormLabel><FormControl><Input {...field} data-testid="input-shift-skills" placeholder="e.g. watchkeeping, navigation" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={p.shiftForm.control} name="rankMin" render={({ field }) => (<FormItem><FormLabel>Minimum Rank (Optional)</FormLabel><FormControl><Input {...field} data-testid="input-shift-rank" placeholder="e.g. Second Officer" /></FormControl><FormMessage /></FormItem>)} />
                          </div>
                          <FormField control={p.shiftForm.control} name="certRequired" render={({ field }) => (<FormItem><FormLabel>Required Certification (Optional)</FormLabel><FormControl><Input {...field} data-testid="input-shift-cert" placeholder="e.g. STCW, BOSIET" /></FormControl><FormMessage /></FormItem>)} />
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={p.handleCancelShiftEdit} data-testid="button-cancel-shift">Cancel</Button>
                            <Button type="submit" disabled={p.createShiftMutation.isPending || p.updateShiftMutation.isPending} data-testid="button-save-shift">{p.editingShiftId ? "Update" : "Create"} Shift</Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="space-y-3">
                  {p.isLoadingShifts ? <div className="text-center py-4 text-muted-foreground">Loading shift templates...</div> : p.shiftTemplates.length === 0 ? <div className="text-center py-8 text-muted-foreground"><Clock className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No shift templates defined yet</p><p className="text-sm">Add your first shift template to get started</p></div> : p.shiftTemplates.map((shift: SelectShiftTemplate) => (
                    <div key={shift.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors" data-testid={`shift-template-${shift.id}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2"><h4 className="font-medium">{shift.role}</h4>{shift.vesselId && <Badge variant="outline" className="text-xs"><Ship className="h-3 w-3 mr-1" />{shift.vesselId}</Badge>}</div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-4"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{shift.start} - {shift.end} ({shift.durationH}h)</span></div>
                            {(shift.requiredSkills || shift.rankMin || shift.certRequired) && <div className="flex flex-wrap gap-1 mt-2">{shift.requiredSkills && <Badge variant="secondary" className="text-xs">Skills: {shift.requiredSkills}</Badge>}{shift.rankMin && <Badge variant="secondary" className="text-xs">Rank: {shift.rankMin}</Badge>}{shift.certRequired && <Badge variant="secondary" className="text-xs">Cert: {shift.certRequired}</Badge>}</div>}
                          </div>
                        </div>
                        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => p.handleEditShift(shift)} data-testid={`button-edit-shift-${shift.id}`}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => p.deleteShiftMutation.mutate(shift.id)} disabled={p.deleteShiftMutation.isPending} data-testid={`button-delete-shift-${shift.id}`}><Trash2 className="h-4 w-4" /></Button></div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="crew" className="space-y-3 mt-4">
                {p.crew.slice(0, showAllCrew ? p.crew.length : 6).map((member: Crew) => (
                  <div key={member.id} role="button" tabIndex={0} className="border rounded p-3 cursor-pointer hover:bg-muted/50 transition-colors" data-testid={`crew-member-${member.id}`} onClick={() => toast({ title: "Crew Member", description: `${member.name} (${member.rank}) - Available for scheduling with ${member.skills?.length ?? 0} skills` })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toast({ title: "Crew Member", description: `${member.name} (${member.rank}) - Available for scheduling with ${member.skills?.length ?? 0} skills` }); } }}>
                    <div className="flex justify-between items-center">
                      <div><div className="font-medium">{member.name}</div><div className="text-sm text-muted-foreground">{member.rank} • {member.maxHours7d}h/week max</div></div>
                      <div className="flex gap-1">{(member.skills ?? []).slice(0, 2).map((skill) => <Badge key={skill} variant="outline" className="text-xs">{skill.replace("_", " ")}</Badge>)}{(member.skills?.length ?? 0) > 2 && <Badge variant="outline" className="text-xs">+{(member.skills?.length ?? 0) - 2}</Badge>}</div>
                    </div>
                  </div>
                ))}
                {p.crew.length > 6 && <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllCrew(!showAllCrew)} data-testid="button-toggle-crew-list">{showAllCrew ? "Show fewer" : `Show all ${p.crew.length} crew members`}</Button>}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {p.enhancedScheduleResult && (
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" />Enhanced Schedule Results<Badge variant="outline">{p.enhancedScheduleResult.engine.toUpperCase()}</Badge></CardTitle><CardDescription>Advanced optimization results using {p.enhancedScheduleResult.engine} engine</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center border rounded p-3"><div className="text-2xl font-bold text-blue-600">{p.enhancedScheduleResult.summary.scheduledAssignments}</div><div className="text-sm text-muted-foreground">Scheduled</div></div>
              <div className="text-center border rounded p-3"><div className="text-2xl font-bold text-green-600">{(() => { const totalUnfilled = p.enhancedScheduleResult.unfilled.reduce((sum, u) => sum + u.need, 0); const total = p.enhancedScheduleResult.summary.scheduledAssignments + totalUnfilled; return total > 0 ? ((p.enhancedScheduleResult.summary.scheduledAssignments / total) * 100).toFixed(1) : 0; })()}%</div><div className="text-sm text-muted-foreground">Coverage</div></div>
              <div className="text-center border rounded p-3"><div className="text-2xl font-bold text-orange-600">{p.enhancedScheduleResult.unfilled.reduce((sum, u) => sum + u.need, 0)}</div><div className="text-sm text-muted-foreground">Unfilled</div></div>
              <div className="text-center border rounded p-3"><div className="text-2xl font-bold text-purple-600">{p.enhancedScheduleResult.summary.totalShifts}</div><div className="text-sm text-muted-foreground">Total Shifts</div></div>
            </div>
            <div className="mb-6"><FairnessViz scheduled={p.enhancedScheduleResult.scheduled} crew={p.crew} /></div>
            {p.enhancedScheduleResult?.compliance && (
              <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                <h3 className="text-lg font-medium mb-3">STCW Compliance Summary</h3>
                <div className="mb-3"><span className="text-sm">Overall: </span><Badge variant={p.enhancedScheduleResult.compliance.overall_ok ? "default" : "destructive"}>{p.enhancedScheduleResult.compliance.overall_ok ? "COMPLIANT" : "VIOLATIONS DETECTED"}</Badge></div>
                <div className="overflow-x-auto">
                  <p className="text-xs text-muted-foreground mb-2 sm:hidden">Scroll horizontally to see all columns</p>
                  <table className="w-full text-sm border-collapse border border-border">
                    <thead><tr className="bg-muted"><th scope="col" className="border border-border px-2 py-1 text-left">Crew</th><th scope="col" className="border border-border px-2 py-1 text-center">Status</th><th scope="col" className="border border-border px-2 py-1 text-center">MinRest24h</th><th scope="col" className="border border-border px-2 py-1 text-center">Rest7d</th><th scope="col" className="border border-border px-2 py-1 text-center">Nights/Week</th><th scope="col" className="border border-border px-2 py-1 text-center">Violations</th></tr></thead>
                    <tbody>{p.enhancedScheduleResult.compliance.per_crew.map((crewComp, idx) => (<tr key={`crew-${crewComp.name}-${idx}`} className={crewComp.ok ? "" : "bg-red-50 dark:bg-red-900/20"}><td className="border border-border px-2 py-1">{crewComp.name}</td><td className="border border-border px-2 py-1 text-center"><Badge variant={crewComp.ok ? "default" : "destructive"}>{crewComp.ok ? "OK" : "BREACH"}</Badge></td><td className="border border-border px-2 py-1 text-center">{crewComp.min_rest_24?.toFixed(1) || "N/A"}h</td><td className="border border-border px-2 py-1 text-center">{crewComp.rest_7d?.toFixed(1) || "N/A"}h</td><td className="border border-border px-2 py-1 text-center">{crewComp.nights_this_week || 0}</td><td className="border border-border px-2 py-1 text-center">{crewComp.violations || 0}</td></tr>))}</tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3" data-testid="text-stcw-disclaimer">STCW compliance results shown here are projected and simulated based on the current schedule. They are advisory only and do not constitute official compliance verification. Always verify with your designated person ashore (DPA) and flag state requirements.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2"><Filter className="h-4 w-4" /><Label className="text-sm font-medium">Filters:</Label></div>
              <Select value={p.filterVessel} onValueChange={p.setFilterVessel}><SelectTrigger className="w-[180px]" data-testid="filter-vessel"><SelectValue placeholder="All Vessels" /></SelectTrigger><SelectContent><SelectItem value="all">All Vessels</SelectItem>{p.vessels.filter((v) => v.id?.trim()).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.id}</SelectItem>)}</SelectContent></Select>
              <Select value={p.filterCrew} onValueChange={p.setFilterCrew}><SelectTrigger className="w-[180px]" data-testid="filter-crew"><SelectValue placeholder="All Crew" /></SelectTrigger><SelectContent><SelectItem value="all">All Crew</SelectItem>{p.crew.map((m: Crew) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Search by role or date..." value={p.searchQuery} onChange={(e) => p.setSearchQuery(e.target.value)} className="w-[220px]" data-testid="input-search" />
              {(p.filterVessel !== "all" || p.filterCrew !== "all" || p.searchQuery) && <Button variant="ghost" size="sm" onClick={p.clearFilters} data-testid="button-clear-filters">Clear Filters</Button>}
            </div>
            <Collapsible open={p.isEnhancedDetailsOpen} onOpenChange={p.setIsEnhancedDetailsOpen}>
              <CollapsibleTrigger asChild><Button variant="outline" className="w-full mb-4"><ChevronDown className="h-4 w-4 mr-2" />{p.isEnhancedDetailsOpen ? "Hide" : "Show"} Detailed Schedule</Button></CollapsibleTrigger>
              <CollapsibleContent className="space-y-4">
                <Tabs defaultValue="assignments" className="w-full">
                  <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="assignments">Assignments</TabsTrigger><TabsTrigger value="unfilled">Unfilled Positions</TabsTrigger></TabsList>
                  <TabsContent value="assignments" className="space-y-3">
                    <div className="max-h-96 overflow-y-auto space-y-2">{p.enhancedScheduleResult.scheduled.filter((a) => { if (p.filterVessel !== "all" && a.vesselId !== p.filterVessel) {return false;} if (p.filterCrew !== "all" && a.crewId !== p.filterCrew) {return false;} if (p.searchQuery) { const s = p.searchQuery.toLowerCase(); const matchesRole = a.role?.toLowerCase().includes(s); const matchesDate = a.date.includes(s); const matchesCrew = p.getCrewName(a.crewId).toLowerCase().includes(s); if (!matchesRole && !matchesDate && !matchesCrew) {return false;} } return true; }).map((a, i) => <div key={i} className="border rounded p-3 bg-muted/30"><div className="flex justify-between items-center"><div><div className="font-medium">{p.getCrewName(a.crewId)}</div><div className="text-sm text-muted-foreground">{a.role} • {format(new Date(a.date), "MMM d")} • {p.getShiftTime(a.start.slice(11, 19), a.end.slice(11, 19))}</div></div><Badge variant="outline">{a.vesselId ? p.getVesselName(a.vesselId) : "Fleet"}</Badge></div></div>)}</div>
                  </TabsContent>
                  <TabsContent value="unfilled" className="space-y-3">{p.enhancedScheduleResult.unfilled.length === 0 ? <div className="text-center text-green-600 p-6">All positions successfully filled!</div> : <div className="max-h-96 overflow-y-auto space-y-2">{p.enhancedScheduleResult.unfilled.map((u, i) => <div key={i} className="border rounded p-3 bg-red-50"><div className="flex justify-between items-center"><div><div className="font-medium text-red-700">{u.need} position(s) unfilled</div><div className="text-sm text-muted-foreground">Day: {u.day} • Shift: {u.shiftId}</div><div className="text-sm text-red-600">Reason: {u.reason}</div></div><AlertTriangle className="h-5 w-5 text-red-500" /></div></div>)}</div>}</TabsContent>
                </Tabs>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {p.scheduleResult && !p.enhancedScheduleResult && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" />Schedule Results<Badge variant={p.scheduleResult.unfilled.length > 0 ? "destructive" : "default"}>{p.scheduleResult.scheduled} Scheduled</Badge></CardTitle><CardDescription>{p.scheduleResult.message}</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded"><div className="text-2xl font-bold text-green-600">{p.scheduleResult.scheduled}</div><div className="text-sm text-muted-foreground">Shifts Scheduled</div></div>
                <div className="text-center p-4 border rounded"><div className="text-2xl font-bold text-red-600">{p.scheduleResult.unfilled.reduce((sum, u) => sum + u.need, 0)}</div><div className="text-sm text-muted-foreground">Unfilled Positions</div></div>
                <div className="text-center p-4 border rounded"><div className="text-2xl font-bold text-blue-600">{(() => { const totalUnfilled = p.scheduleResult.unfilled.reduce((sum, u) => sum + u.need, 0); const total = p.scheduleResult.scheduled + totalUnfilled; return total > 0 ? Math.round((p.scheduleResult.scheduled / total) * 100) : 0; })()}%</div><div className="text-sm text-muted-foreground">Coverage Rate</div></div>
              </div>
              {p.scheduleResult.unfilled.length > 0 && (
                <div className="border border-yellow-200 bg-yellow-50 rounded p-4">
                  <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-5 w-5 text-yellow-600" /><span className="font-medium text-yellow-800">Unfilled Positions</span></div>
                  <div className="space-y-1">{p.scheduleResult.unfilled.map((u) => <div key={`unfilled-${u.day}-${u.shiftId}`} className="text-sm text-yellow-700">{format(new Date(u.day), "MMM d")}: {u.shiftId} - {u.need} position(s) ({u.reason})</div>)}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
