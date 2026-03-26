# ARUS Frontend — Part 5: Crew (Members, Scheduling, STCW, Rest Hours)
Generated: 2026-03-26T02:38:14Z

### `client/src/components/CrewManagement.tsx` (56 lines)

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, Users, ShipWheel } from "lucide-react";
import { useCrewManagementData, type Crew } from "@/features/crew";

interface VesselOption { id: string; name: string; }
interface SkillItem { id: string; name: string; category?: string; maxLevel: number; description?: string; }

export function CrewAdmin() {
  const { crewForm, setCrewForm, crewSkillForm, setCrewSkillForm, editingSkillId, crew, vessels, skillsCatalog, isLoading, skillForm, createCrewMutation, addSkillMutation, createSkillMutation, updateSkillMutation, deleteSkillMutation, capitalizeNames, handleSubmitCrew, handleAddSkill, onSubmitSkill, handleEditSkill, handleCancelEdit, maritimeRanks, availableRanks, skillCategories, commonSkills } = useCrewManagementData();
  
  // Handler to update both rank display name and roleId when rank is selected
  const handleRankChange = (displayName: string) => {
    const selectedRank = availableRanks.find(r => r.displayName === displayName);
    setCrewForm({ 
      ...crewForm, 
      rank: displayName,
      roleId: selectedRank?.id || ""
    });
  };

  if (isLoading) {return <div className="p-6">Loading crew data...</div>;}

  return (
    <div className="space-y-6">
      <Tabs defaultValue="crew" className="w-full">
        <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="crew" data-testid="tab-crew">Crew Members</TabsTrigger><TabsTrigger value="skills" data-testid="tab-skills">Skills Catalog</TabsTrigger><TabsTrigger value="assign" data-testid="tab-assign">Assign Skills</TabsTrigger></TabsList>

        <TabsContent value="crew" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Add Crew Member</CardTitle><CardDescription>Register new crew members with their maritime qualifications</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmitCrew} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="crew-name">Name</Label><Input id="crew-name" data-testid="input-crew-name" placeholder="Full name" value={crewForm.name} onChange={(e) => setCrewForm({ ...crewForm, name: capitalizeNames(e.target.value) })} required /></div><div><Label htmlFor="crew-rank">Rank</Label><Select value={crewForm.rank} onValueChange={handleRankChange}><SelectTrigger data-testid="select-crew-rank"><SelectValue /></SelectTrigger><SelectContent>{maritimeRanks.map((rank) => <SelectItem key={rank} value={rank}>{rank}</SelectItem>)}</SelectContent></Select></div></div><div className="grid grid-cols-3 gap-4"><div><Label htmlFor="vessel-id">Vessel</Label><Select value={crewForm.vesselId || "_unassigned"} onValueChange={(value) => setCrewForm({ ...crewForm, vesselId: value === "_unassigned" ? "" : value })}><SelectTrigger data-testid="select-vessel-id"><SelectValue placeholder="Select vessel" /></SelectTrigger><SelectContent><SelectItem value="_unassigned">Unassigned</SelectItem>{(vessels as VesselOption[]).filter((v) => v.id).map((vessel) => <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="max-hours">Max hrs/7d</Label><Input id="max-hours" data-testid="input-max-hours" type="number" min="40" max="84" value={crewForm.maxHours7d} onChange={(e) => setCrewForm({ ...crewForm, maxHours7d: Number(e.target.value) })} /></div><div><Label htmlFor="min-rest">Min rest (h)</Label><Input id="min-rest" data-testid="input-min-rest" type="number" min="6" max="12" value={crewForm.minRestH} onChange={(e) => setCrewForm({ ...crewForm, minRestH: Number(e.target.value) })} /></div></div><Button type="submit" data-testid="button-create-crew" disabled={createCrewMutation.isPending} className="w-full">{createCrewMutation.isPending ? "Creating..." : "Add Crew Member"}</Button></form></CardContent></Card>
            <Card><CardHeader><CardTitle>Add Skills</CardTitle><CardDescription>Assign maritime skills and certifications to crew members</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="skill-crew">Select Crew Member</Label><Select value={crewSkillForm.crewId} onValueChange={(value) => setCrewSkillForm({ ...crewSkillForm, crewId: value })}><SelectTrigger data-testid="select-skill-crew"><SelectValue placeholder="Choose crew member" /></SelectTrigger><SelectContent>{crew.map((member: Crew) => <SelectItem key={member.id} value={member.id}>{member.name} ({member.rank})</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="skill-name">Skill</Label><Select value={crewSkillForm.skill} onValueChange={(value) => setCrewSkillForm({ ...crewSkillForm, skill: value })}><SelectTrigger data-testid="select-skill-name"><SelectValue placeholder="Choose skill" /></SelectTrigger><SelectContent>{commonSkills.map((skill) => <SelectItem key={skill} value={skill}>{skill.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="skill-level">Level (1-5)</Label><Select value={crewSkillForm.level.toString()} onValueChange={(value) => setCrewSkillForm({ ...crewSkillForm, level: Number(value) })}><SelectTrigger data-testid="select-skill-level"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map((level) => <SelectItem key={level} value={level.toString()}>Level {level} {level === 1 ? "(Basic)" : level === 5 ? "(Expert)" : ""}</SelectItem>)}</SelectContent></Select></div><Button onClick={handleAddSkill} data-testid="button-add-skill" disabled={addSkillMutation.isPending} className="w-full">{addSkillMutation.isPending ? "Adding..." : "Add Skill"}</Button></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Crew Roster</CardTitle><CardDescription>Complete crew manifest with qualifications and assignments</CardDescription></CardHeader><CardContent><div className="grid gap-4">{crew.map((member: Crew) => <div key={member.id} className="border rounded-lg p-4"><div className="flex items-start justify-between"><div className="space-y-2"><div className="flex items-center gap-3"><h3 className="font-semibold text-lg" data-testid={`text-crew-name-${member.id}`}>{member.name}</h3><Badge variant="outline" data-testid={`badge-rank-${member.id}`}>{member.rank}</Badge>{member.vesselId && <Badge variant="secondary" className="flex items-center gap-1"><ShipWheel className="h-3 w-3" />{member.vesselId}</Badge>}</div><div className="flex gap-6 text-sm text-muted-foreground"><span>Max: {member.maxHours7d}h/week</span><span>Rest: {member.minRestH}h minimum</span><span className={member.active ? "text-green-600" : "text-red-600"}>{member.active ? "Active" : "Inactive"}</span></div>{member.skills.length > 0 && <div className="flex flex-wrap gap-1">{member.skills.map((skill) => <Badge key={skill} variant="outline" className="text-xs">{skill.replace("_", " ")}</Badge>)}</div>}</div></div></div>)}{crew.length === 0 && <div className="text-center text-muted-foreground py-8">No crew members registered yet. Add your first crew member above.</div>}</div></CardContent></Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />{editingSkillId ? "Edit Skill" : "Add Skill"}</CardTitle><CardDescription>Manage the master catalog of skills that can be assigned to crew members</CardDescription></CardHeader><CardContent><Form {...skillForm}><form onSubmit={skillForm.handleSubmit(onSubmitSkill)} className="space-y-4"><FormField control={skillForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Skill Name</FormLabel><FormControl><Input {...field} data-testid="input-skill-name" placeholder="e.g. Watchkeeping" /></FormControl><FormMessage /></FormItem>} /><div className="grid grid-cols-2 gap-4"><FormField control={skillForm.control} name="category" render={({ field }) => <FormItem><FormLabel>Category</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-skill-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl><SelectContent>{skillCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={skillForm.control} name="maxLevel" render={({ field }) => <FormItem><FormLabel>Max Level</FormLabel><Select value={field.value?.toString()} onValueChange={(value) => field.onChange(Number.parseInt(value))}><FormControl><SelectTrigger data-testid="select-skill-max-level"><SelectValue /></SelectTrigger></FormControl><SelectContent>{[1, 2, 3, 4, 5].map((level) => <SelectItem key={level} value={level.toString()}>Level {level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /></div><FormField control={skillForm.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} data-testid="input-skill-description" placeholder="Detailed description of the skill" /></FormControl><FormMessage /></FormItem>} /><div className="flex gap-2"><Button type="submit" data-testid="button-save-skill" disabled={createSkillMutation.isPending || updateSkillMutation.isPending}>{editingSkillId ? "Update Skill" : "Add Skill"}</Button>{editingSkillId && <Button type="button" variant="outline" onClick={handleCancelEdit} data-testid="button-cancel-edit">Cancel</Button>}</div></form></Form></CardContent></Card>
            <Card><CardHeader><CardTitle>Skills Catalog ({skillsCatalog.length})</CardTitle><CardDescription>Available skills in the system</CardDescription></CardHeader><CardContent><div className="space-y-4 max-h-96 overflow-y-auto">{(skillsCatalog as SkillItem[]).map((skill) => <div key={skill.id} className="border rounded p-3"><div className="space-y-2"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><h4 className="font-medium" data-testid={`text-skill-name-${skill.id}`}>{skill.name}</h4>{skill.category && <Badge variant="outline">{skill.category}</Badge>}<Badge variant="secondary">Max Level {skill.maxLevel}</Badge></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handleEditSkill(skill)} data-testid={`button-edit-skill-${skill.id}`}>Edit</Button><Button size="sm" variant="destructive" onClick={() => deleteSkillMutation.mutate(skill.id)} disabled={deleteSkillMutation.isPending} data-testid={`button-delete-skill-${skill.id}`}><Trash2 className="h-4 w-4" /></Button></div></div>{skill.description && <p className="text-sm text-muted-foreground">{skill.description}</p>}</div></div>)}{skillsCatalog.length === 0 && <div className="text-center text-muted-foreground py-8">No skills in catalog yet. Add your first skill above.</div>}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="assign" className="space-y-6">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Assign Skills to Crew</CardTitle><CardDescription>Assign skills from the catalog to crew members with proficiency levels</CardDescription></CardHeader><CardContent><div className="grid grid-cols-4 gap-4"><div><Label htmlFor="assign-crew">Crew Member</Label><Select value={crewSkillForm.crewId} onValueChange={(value) => setCrewSkillForm({ ...crewSkillForm, crewId: value })}><SelectTrigger data-testid="select-assign-crew"><SelectValue placeholder="Select crew member" /></SelectTrigger><SelectContent>{crew.map((member) => <SelectItem key={member.id} value={member.id}>{member.name} ({member.rank})</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="assign-skill">Skill</Label><Select value={crewSkillForm.skill} onValueChange={(value) => setCrewSkillForm({ ...crewSkillForm, skill: value })}><SelectTrigger data-testid="select-assign-skill"><SelectValue placeholder="Select skill" /></SelectTrigger><SelectContent>{(skillsCatalog as SkillItem[]).map((skill) => <SelectItem key={skill.id} value={skill.name}>{skill.name} {skill.category && `(${skill.category})`}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="assign-level">Proficiency Level</Label><Select value={crewSkillForm.level.toString()} onValueChange={(value) => setCrewSkillForm({ ...crewSkillForm, level: Number.parseInt(value) })}><SelectTrigger data-testid="select-assign-level"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map((level) => <SelectItem key={level} value={level.toString()}>Level {level}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button onClick={handleAddSkill} disabled={!crewSkillForm.crewId || !crewSkillForm.skill || addSkillMutation.isPending} data-testid="button-assign-skill">Assign Skill</Button></div></div></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

```

### `client/src/components/CrewScheduler.tsx` (268 lines)

```tsx
import { useShiftPlanning } from "@/features/crew";
import { useEffect } from "react";
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

export function CrewScheduler() {
  const { toast } = useToast();
  const p = useShiftPlanning();

  useEffect(() => {
    console.warn(
      "[DEPRECATED] CrewScheduler component is deprecated. Please use the new SchedulePlanner component instead. " +
      "Enable the 'newSchedulerEnabled' feature flag to use the SmartPAL-style scheduling system."
    );
  }, []);

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
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="border rounded p-3"><div className="text-2xl font-bold text-blue-600">{p.crew.length}</div><div className="text-sm text-muted-foreground">Total Crew</div></div>
                <div className="border rounded p-3"><div className="text-2xl font-bold text-green-600">{p.crew.filter((c: Crew) => c.skills?.includes("watchkeeping")).length}</div><div className="text-sm text-muted-foreground">Watch Qualified</div></div>
                <div className="border rounded p-3"><div className="text-2xl font-bold text-orange-600">{p.shiftTemplates.length}</div><div className="text-sm text-muted-foreground">Shift Templates</div></div>
              </div>
            </div>
            <div>
              <Label className="text-base font-medium">Scheduling Engine</Label>
              <Select value={p.selectedEngine} onValueChange={p.setSelectedEngine}><SelectTrigger data-testid="select-engine"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="greedy">Greedy Algorithm (Fast)</SelectItem><SelectItem value="ortools">OR-Tools Optimizer (Advanced)</SelectItem></SelectContent></Select>
              <p className="text-sm text-gray-600 mt-1">{p.selectedEngine === "greedy" ? "Fast heuristic algorithm for basic scheduling" : "Advanced constraint satisfaction with optimal resource allocation"}</p>
            </div>
            <Collapsible>
              <CollapsibleTrigger asChild><Button variant="outline" className="w-full justify-between" data-testid="toggle-preferences"><div className="flex items-center gap-2"><Settings2 className="h-4 w-4" /><span>Advanced Scheduling Preferences</span></div><ChevronDown className="h-4 w-4" /></Button></CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Priority Weights</Label>
                  <div className="space-y-3">
                    <div><div className="flex justify-between mb-2"><Label className="text-sm">Fairness ({p.preferences.weights.fairness})</Label></div><Slider value={[p.preferences.weights.fairness]} onValueChange={(val) => p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, fairness: val[0] } })} min={0} max={100} step={1} data-testid="slider-fairness" /><p className="text-xs text-muted-foreground mt-1">Balance workload across crew</p></div>
                    <div><div className="flex justify-between mb-2"><Label className="text-sm">Night Shift Weight ({p.preferences.weights.night_over})</Label></div><Slider value={[p.preferences.weights.night_over]} onValueChange={(val) => p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, night_over: val[0] } })} min={0} max={50} step={1} data-testid="slider-night" /><p className="text-xs text-muted-foreground mt-1">Penalty for too many night shifts</p></div>
                    <div><div className="flex justify-between mb-2"><Label className="text-sm">Crew Preferences ({p.preferences.weights.pref_off})</Label></div><Slider value={[p.preferences.weights.pref_off]} onValueChange={(val) => p.setPreferences({ ...p.preferences, weights: { ...p.preferences.weights, pref_off: val[0] } })} min={0} max={50} step={1} data-testid="slider-preferences" /><p className="text-xs text-muted-foreground mt-1">Honor crew day-off requests</p></div>
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
                        <div className="grid grid-cols-2 gap-2"><Input type="datetime-local" value={p.newPortCall.start} onChange={(e) => p.setNewPortCall({ ...p.newPortCall, start: e.target.value })} data-testid="input-port-start" /><Input type="datetime-local" value={p.newPortCall.end} onChange={(e) => p.setNewPortCall({ ...p.newPortCall, end: e.target.value })} data-testid="input-port-end" /></div>
                        <Input type="number" placeholder="Crew Required" value={p.newPortCall.crewRequired} onChange={(e) => p.setNewPortCall({ ...p.newPortCall, crewRequired: Number.parseInt(e.target.value) || 2 })} data-testid="input-port-crew" />
                        <Button onClick={p.handleAddPortCall} className="w-full" data-testid="button-add-port">Add Port Call</Button>
                      </div>
                    </div>
                    <div><h4 className="font-medium mb-2">Existing Port Calls</h4><div className="space-y-2">{(p.allPortCalls as Array<{id: string; port: string; vesselId: string; start: string; end: string; crewRequired: number}>).map((port) => <div key={port.id} className="border rounded p-2"><div className="font-medium">{port.port}</div><div className="text-sm text-gray-600">{port.vesselId} • {new Date(port.start).toLocaleDateString()} - {new Date(port.end).toLocaleDateString()}</div><div className="text-sm">Crew: {port.crewRequired}</div></div>)}</div></div>
                  </div>
                </TabsContent>
                <TabsContent value="drydocks" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">Add Drydock Window</h4>
                      <div className="space-y-2">
                        <Select value={p.newDrydock.vesselId} onValueChange={(val) => p.setNewDrydock({ ...p.newDrydock, vesselId: val })}><SelectTrigger data-testid="select-drydock-vessel"><SelectValue placeholder="Select Vessel" /></SelectTrigger><SelectContent>{(p.vessels as Array<{id: string; name?: string}>).filter((v) => v.id?.trim()).map((v) => <SelectItem key={v.id} value={v.id}>{v.name || v.id}</SelectItem>)}</SelectContent></Select>
                        <Input placeholder="Description" value={p.newDrydock.description} onChange={(e) => p.setNewDrydock({ ...p.newDrydock, description: e.target.value })} data-testid="input-drydock-description" />
                        <div className="grid grid-cols-2 gap-2"><Input type="datetime-local" value={p.newDrydock.start} onChange={(e) => p.setNewDrydock({ ...p.newDrydock, start: e.target.value })} data-testid="input-drydock-start" /><Input type="datetime-local" value={p.newDrydock.end} onChange={(e) => p.setNewDrydock({ ...p.newDrydock, end: e.target.value })} data-testid="input-drydock-end" /></div>
                        <Input type="number" placeholder="Crew Required" value={p.newDrydock.crewRequired} onChange={(e) => p.setNewDrydock({ ...p.newDrydock, crewRequired: Number.parseInt(e.target.value) || 5 })} data-testid="input-drydock-crew" />
                        <Button onClick={p.handleAddDrydock} className="w-full" data-testid="button-add-drydock">Add Drydock Window</Button>
                      </div>
                    </div>
                    <div><h4 className="font-medium mb-2">Existing Drydock Windows</h4><div className="space-y-2">{(p.allDrydockWindows as Array<{id: string; yard: string; vesselId: string; start: string; end: string; crewRequired: number}>).map((dd) => <div key={dd.id} className="border rounded p-2"><div className="font-medium">{dd.yard}</div><div className="text-sm text-gray-600">{dd.vesselId} • {new Date(dd.start).toLocaleDateString()} - {new Date(dd.end).toLocaleDateString()}</div><div className="text-sm">Crew: {dd.crewRequired}</div></div>)}</div></div>
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
                            <FormField control={p.shiftForm.control} name="durationH" render={({ field }) => (<FormItem><FormLabel>Duration (Hours)</FormLabel><FormControl><Input {...field} type="number" min="0.5" max="24" step="0.5" data-testid="input-shift-duration" /></FormControl><FormMessage /></FormItem>)} />
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
                {p.crew.slice(0, 6).map((member: Crew) => (
                  <div key={member.id} role="button" tabIndex={0} className="border rounded p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" data-testid={`crew-member-${member.id}`} onClick={() => toast({ title: "Crew Member", description: `${member.name} (${member.rank}) - Available for scheduling with ${member.skills?.length ?? 0} skills` })} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toast({ title: "Crew Member", description: `${member.name} (${member.rank}) - Available for scheduling with ${member.skills?.length ?? 0} skills` }); } }}>
                    <div className="flex justify-between items-center">
                      <div><div className="font-medium">{member.name}</div><div className="text-sm text-muted-foreground">{member.rank} • {member.maxHours7d}h/week max</div></div>
                      <div className="flex gap-1">{(member.skills ?? []).slice(0, 2).map((skill) => <Badge key={skill} variant="outline" className="text-xs">{skill.replace("_", " ")}</Badge>)}{(member.skills?.length ?? 0) > 2 && <Badge variant="outline" className="text-xs">+{(member.skills?.length ?? 0) - 2}</Badge>}</div>
                    </div>
                  </div>
                ))}
                {p.crew.length > 6 && <div className="text-center text-sm text-muted-foreground py-2">and {p.crew.length - 6} more crew members...</div>}
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
              <div className="mb-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
                <h3 className="text-lg font-medium mb-3">STCW Compliance Summary</h3>
                <div className="mb-3"><span className="text-sm">Overall: </span><Badge variant={p.enhancedScheduleResult.compliance.overall_ok ? "default" : "destructive"}>{p.enhancedScheduleResult.compliance.overall_ok ? "COMPLIANT" : "VIOLATIONS DETECTED"}</Badge></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
                    <thead><tr className="bg-gray-100 dark:bg-gray-700"><th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Crew</th><th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">Status</th><th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">MinRest24h</th><th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">Rest7d</th><th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">Nights/Week</th><th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">Violations</th></tr></thead>
                    <tbody>{p.enhancedScheduleResult.compliance.per_crew.map((crewComp, idx) => (<tr key={`crew-${crewComp.name}-${idx}`} className={crewComp.ok ? "" : "bg-red-50 dark:bg-red-900/20"}><td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{crewComp.name}</td><td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center"><Badge variant={crewComp.ok ? "default" : "destructive"}>{crewComp.ok ? "OK" : "BREACH"}</Badge></td><td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">{crewComp.min_rest_24?.toFixed(1) || "N/A"}h</td><td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">{crewComp.rest_7d?.toFixed(1) || "N/A"}h</td><td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">{crewComp.nights_this_week || 0}</td><td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">{crewComp.violations || 0}</td></tr>))}</tbody>
                  </table>
                </div>
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
                    <div className="max-h-96 overflow-y-auto space-y-2">{p.enhancedScheduleResult.scheduled.filter((a) => { if (p.filterVessel !== "all" && a.vesselId !== p.filterVessel) {return false;} if (p.filterCrew !== "all" && a.crewId !== p.filterCrew) {return false;} if (p.searchQuery) { const s = p.searchQuery.toLowerCase(); const matchesRole = a.role?.toLowerCase().includes(s); const matchesDate = a.date.includes(s); const matchesCrew = p.getCrewName(a.crewId).toLowerCase().includes(s); if (!matchesRole && !matchesDate && !matchesCrew) {return false;} } return true; }).map((a, i) => <div key={i} className="border rounded p-3 bg-gray-50"><div className="flex justify-between items-center"><div><div className="font-medium">{p.getCrewName(a.crewId)}</div><div className="text-sm text-gray-600">{a.role} • {format(new Date(a.date), "MMM d")} • {p.getShiftTime(a.start.slice(11, 19), a.end.slice(11, 19))}</div></div><Badge variant="outline">{a.vesselId || "Fleet"}</Badge></div></div>)}</div>
                  </TabsContent>
                  <TabsContent value="unfilled" className="space-y-3">{p.enhancedScheduleResult.unfilled.length === 0 ? <div className="text-center text-green-600 p-6">All positions successfully filled!</div> : <div className="max-h-96 overflow-y-auto space-y-2">{p.enhancedScheduleResult.unfilled.map((u, i) => <div key={i} className="border rounded p-3 bg-red-50"><div className="flex justify-between items-center"><div><div className="font-medium text-red-700">{u.need} position(s) unfilled</div><div className="text-sm text-gray-600">Day: {u.day} • Shift: {u.shiftId}</div><div className="text-sm text-red-600">Reason: {u.reason}</div></div><AlertTriangle className="h-5 w-5 text-red-500" /></div></div>)}</div>}</TabsContent>
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
              <div className="grid grid-cols-3 gap-4">
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

```

### `client/src/components/CrewDocumentsTab.tsx` (75 lines)

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Edit, Trash2, AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { format } from "date-fns";
import { useCrewDocumentsData, DOCUMENT_TYPES, COMMON_COUNTRIES, type CrewDocument } from "@/features/crew";

interface CrewDocumentsTabProps { crewId: string; crewName: string; }

export function CrewDocumentsTab({ crewId, crewName }: CrewDocumentsTabProps) {
  const { documents, isLoading, form, isFormOpen, setIsFormOpen, isDeleteDialogOpen, setIsDeleteDialogOpen, selectedDoc, isEditing, createMutation, updateMutation, deleteMutation, handleOpenAddForm, handleOpenEditForm, handleCloseForm, handleOpenDeleteDialog, onSubmit, getDocumentTypeLabel, getExpiryStatus } = useCrewDocumentsData(crewId);

  if (isLoading) {return (<Card><CardHeader className="py-4"><Skeleton className="h-6 w-32" /></CardHeader><CardContent><div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></CardContent></Card>);}

  const renderExpiryIcon = (level: string) => level === "expired" || level === "critical" ? <AlertTriangle className="h-3 w-3" /> : level === "warning" ? <AlertCircle className="h-3 w-3" /> : level === "notice" ? <Info className="h-3 w-3" /> : <Check className="h-3 w-3" />;

  return (
    <>
      <Card>
        <CardHeader className="py-4"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Documents ({documents.length})</CardTitle><Button size="sm" onClick={handleOpenAddForm} data-testid="button-add-document"><Plus className="h-4 w-4 mr-1" />Add Document</Button></div></CardHeader>
        <CardContent className="p-0">
          {documents.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Country</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {documents.map((doc: CrewDocument) => { const expiryStatus = getExpiryStatus(doc.expiresAt); return (
                  <TableRow key={doc.id} data-testid={`doc-row-${doc.id}`}>
                    <TableCell className="font-medium">{getDocumentTypeLabel(doc.documentType)}</TableCell>
                    <TableCell className="font-mono text-sm">{doc.documentNumber || "-"}</TableCell>
                    <TableCell>{doc.issuingCountry || "-"}</TableCell>
                    <TableCell>{doc.expiresAt ? format(new Date(doc.expiresAt), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>{expiryStatus && (<Badge variant="secondary" className={`text-xs flex items-center gap-1 w-fit ${expiryStatus.className}`}>{renderExpiryIcon(expiryStatus.level)}{expiryStatus.label}</Badge>)}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditForm(doc)} data-testid={`button-edit-doc-${doc.id}`}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => handleOpenDeleteDialog(doc)} data-testid={`button-delete-doc-${doc.id}`}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                  </TableRow>
                ); })}
              </TableBody>
            </Table>
          ) : (<div className="p-8 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No documents on file</p><p className="text-sm mt-1">Add passport, visa, and other travel documents</p></div>)}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{isEditing ? "Edit Document" : "Add Document"}</DialogTitle><DialogDescription>{isEditing ? `Update document details for ${crewName}` : `Add a new document for ${crewName}`}</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="documentType" render={({ field }) => (<FormItem><FormLabel>Document Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-doc-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{DOCUMENT_TYPES.map((type) => (<SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="documentNumber" render={({ field }) => (<FormItem><FormLabel>Document Number</FormLabel><FormControl><Input {...field} placeholder="e.g., AB1234567" data-testid="input-doc-number" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="issuedAt" render={({ field }) => (<FormItem><FormLabel>Issue Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-doc-issued" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="expiresAt" render={({ field }) => (<FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-doc-expires" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="issuingCountry" render={({ field }) => (<FormItem><FormLabel>Issuing Country</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-doc-country"><SelectValue placeholder="Select country" /></SelectTrigger></FormControl><SelectContent>{COMMON_COUNTRIES.map((country) => (<SelectItem key={country} value={country}>{country}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="issuingAuthority" render={({ field }) => (<FormItem><FormLabel>Issuing Authority</FormLabel><FormControl><Input {...field} placeholder="e.g., Maritime Authority" data-testid="input-doc-authority" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="Additional notes about this document" className="min-h-[60px]" data-testid="input-doc-notes" /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter><Button type="button" variant="outline" onClick={handleCloseForm} data-testid="button-cancel-doc-form">Cancel</Button><Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-doc-form">{createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update Document" : "Add Document"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Document</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this {getDocumentTypeLabel(selectedDoc?.documentType || "")}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-delete-doc">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => selectedDoc && deleteMutation.mutate(selectedDoc.id)} className="bg-red-500 hover:bg-red-600" data-testid="button-confirm-delete-doc">{deleteMutation.isPending ? "Deleting..." : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}

```

### `client/src/components/CrewNotificationSettingsTab.tsx` (255 lines)

```tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Bell, AlertTriangle, FileText, Award, Save, Loader2 } from "lucide-react";

interface CrewNotificationSettingsTabProps {
  crewId: string;
  crewName: string;
  crewEmail?: string | null;
}

interface NotificationSettings {
  crewId: string;
  orgId: string;
  emailAlertsEnabled: boolean;
  certExpiryEmailEnabled: boolean;
  documentExpiryEmailEnabled: boolean;
  complianceEmailEnabled: boolean;
  overrideEmail: string | null;
}

export function CrewNotificationSettingsTab({ 
  crewId, 
  crewName, 
  crewEmail 
}: CrewNotificationSettingsTabProps) {
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<NotificationSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ['/api/crew', crewId, 'notification-settings'],
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<NotificationSettings>) => {
      return apiRequest(`/api/crew/${crewId}/notification-settings`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crew', crewId, 'notification-settings'] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: `Notification preferences for ${crewName} have been updated.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save notification settings.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (field: keyof NotificationSettings, value: boolean) => {
    if (!localSettings) {return;}
    setLocalSettings({ ...localSettings, [field]: value });
    setHasChanges(true);
  };

  const handleOverrideEmailChange = (value: string) => {
    if (!localSettings) {return;}
    setLocalSettings({ ...localSettings, overrideEmail: value || null });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!localSettings) {return;}
    updateMutation.mutate({
      emailAlertsEnabled: localSettings.emailAlertsEnabled,
      certExpiryEmailEnabled: localSettings.certExpiryEmailEnabled,
      documentExpiryEmailEnabled: localSettings.documentExpiryEmailEnabled,
      complianceEmailEnabled: localSettings.complianceEmailEnabled,
      overrideEmail: localSettings.overrideEmail,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const effectiveEmail = localSettings?.overrideEmail || crewEmail;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Email Address</Label>
            </div>
            {effectiveEmail ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {effectiveEmail}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not configured
              </Badge>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="override-email" className="text-sm text-muted-foreground">
              Override Email (optional)
            </Label>
            <Input
              id="override-email"
              type="email"
              placeholder="Send alerts to a different email address"
              value={localSettings?.overrideEmail || ""}
              onChange={(e) => handleOverrideEmailChange(e.target.value)}
              data-testid="input-override-email"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the crew member's primary email address.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-base font-medium">Email Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Master switch for all email notifications
                </p>
              </div>
            </div>
            <Switch
              checked={localSettings?.emailAlertsEnabled ?? true}
              onCheckedChange={(checked) => handleToggle('emailAlertsEnabled', checked)}
              data-testid="switch-email-alerts-enabled"
            />
          </div>

          {localSettings?.emailAlertsEnabled && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Alert Types</h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-blue-500" />
                    <div>
                      <Label className="text-sm">Certification Expiry</Label>
                      <p className="text-xs text-muted-foreground">
                        Alerts when certifications are about to expire
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={localSettings?.certExpiryEmailEnabled ?? true}
                    onCheckedChange={(checked) => handleToggle('certExpiryEmailEnabled', checked)}
                    data-testid="switch-cert-expiry-enabled"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-500" />
                    <div>
                      <Label className="text-sm">Document Expiry</Label>
                      <p className="text-xs text-muted-foreground">
                        Alerts when documents are about to expire
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={localSettings?.documentExpiryEmailEnabled ?? true}
                    onCheckedChange={(checked) => handleToggle('documentExpiryEmailEnabled', checked)}
                    data-testid="switch-document-expiry-enabled"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <div>
                      <Label className="text-sm">Compliance Alerts</Label>
                      <p className="text-xs text-muted-foreground">
                        Alerts for STCW/MLC compliance issues
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={localSettings?.complianceEmailEnabled ?? true}
                    onCheckedChange={(checked) => handleToggle('complianceEmailEnabled', checked)}
                    data-testid="switch-compliance-enabled"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {hasChanges && (
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-notification-settings"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      )}

      {!localSettings?.emailAlertsEnabled && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Email alerts are disabled. Enable the master switch above to configure individual alert types.
        </p>
      )}
    </div>
  );
}

```

### `client/src/components/HoursOfRest.tsx` (152 lines)

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, Calendar, FileCheck } from "lucide-react";
import { useHoursOfRestManagement } from "@/features/crew";

export function HoursOfRest() {
  const {
    crew, crewLoading, restLoading, selectedCrew, setSelectedCrew, selectedYear, setSelectedYear,
    selectedMonth, setSelectedMonth, selectedMonthLabel, handleFileChange, handleImport, importMutation,
    handleCheckCompliance, complianceMutation, handleExportPDF, complianceResult, calendarGrid, months, years,
  } = useHoursOfRestManagement();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rest Data Management</CardTitle>
          <CardDescription>Import, view, and export STCW Hours of Rest data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Import CSV File</Label>
              <Input id="import-file" type="file" accept=".csv" onChange={handleFileChange} data-testid="input-import-file" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleImport} disabled={importMutation.isPending} data-testid="button-import">
                <Upload className="w-4 h-4 mr-2" />{importMutation.isPending ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crew-select">Crew Member</Label>
              <Select value={selectedCrew} onValueChange={setSelectedCrew}>
                <SelectTrigger data-testid="select-crew"><SelectValue placeholder="Select crew member" /></SelectTrigger>
                <SelectContent>
                  {crew.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name} - {member.rank}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year-select">Year</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number.parseInt(v))}>
                <SelectTrigger data-testid="select-year"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((year) => (<SelectItem key={year} value={year.toString()}>{year}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month-select">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger data-testid="select-month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((month) => (<SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end space-x-2">
              <Button onClick={handleCheckCompliance} disabled={!selectedCrew || complianceMutation.isPending} variant="outline" data-testid="button-check-compliance">
                <FileCheck className="w-4 h-4 mr-2" />Check Compliance
              </Button>
              <Button onClick={handleExportPDF} disabled={!selectedCrew} variant="outline" data-testid="button-export-pdf">
                <Download className="w-4 h-4 mr-2" />Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {complianceResult && (
        <Card>
          <CardHeader>
            <CardTitle className={`flex items-center ${complianceResult.compliant ? "text-green-600" : "text-red-600"}`}>
              <FileCheck className="w-5 h-5 mr-2" />Compliance Check Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center" data-testid="text-total-days">
                <div className="text-2xl font-bold">{complianceResult.summary.totalDays}</div>
                <div className="text-sm text-muted-foreground">Total Days</div>
              </div>
              <div className="text-center" data-testid="text-violation-days">
                <div className="text-2xl font-bold text-red-600">{complianceResult.summary.violationDays}</div>
                <div className="text-sm text-muted-foreground">Violation Days</div>
              </div>
              <div className="text-center" data-testid="text-compliance-percentage">
                <div className="text-2xl font-bold text-green-600">{complianceResult.summary.compliancePercentage.toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Compliance</div>
              </div>
            </div>
            {complianceResult.violations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Violations:</h4>
                <div className="space-y-1" data-testid="list-violations">
                  {complianceResult.violations.map((violation) => (
                    <div key={`${violation.date}-${violation.type}`} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                      <strong>{violation.date}</strong> - {violation.type}: {violation.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedCrew && calendarGrid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />Rest Hours Calendar - {selectedMonthLabel} {selectedYear}
            </CardTitle>
            <CardDescription>Daily rest hours visualization (green = compliant ≥10h, red = violation &lt;10h)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1" data-testid="calendar-rest-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="p-2 text-center font-semibold text-sm">{day}</div>
              ))}
              {calendarGrid.map((dayData) => (
                <div key={dayData.day} className={`p-2 text-center text-xs border rounded ${dayData.compliant ? "bg-green-100 border-green-300 text-green-800" : "bg-red-100 border-red-300 text-red-800"}`} title={`${dayData.date}: ${dayData.restHours}h rest`} data-testid={`calendar-day-${dayData.day}`}>
                  <div className="font-semibold">{dayData.day}</div>
                  <div>{dayData.restHours}h</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(crewLoading || restLoading) && (
        <Card>
          <CardContent className="flex items-center justify-center py-6">
            <div className="text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

```

### `client/src/components/HoursOfRestGrid.tsx` (428 lines)

```tsx
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

```

### `client/src/pages/hours-of-rest.tsx` (14 lines)

```tsx
import { HoursOfRestGrid } from "@/components/HoursOfRestGrid";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

export default function HoursOfRestPage() {
  return (
    <PermissionGate resource="rest_hours" action="view" fallback={<PagePermissionDenied />}>
      <div className="min-h-screen">
        <div className="p-6">
          <HoursOfRestGrid />
        </div>
      </div>
    </PermissionGate>
  );
}

```

### `client/src/pages/schedule-planner.tsx` (14 lines)

```tsx
import { SchedulePlanner } from "@/components/scheduling/SchedulePlanner";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

export default function SchedulePlannerPage() {
  return (
    <PermissionGate resource="crew_schedules" action="view" fallback={<PagePermissionDenied />}>
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-hidden">
          <SchedulePlanner />
        </div>
      </div>
    </PermissionGate>
  );
}

```

### `client/src/components/crew/FatigueRiskBadge.tsx` (370 lines)

```tsx
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertTriangle, AlertCircle, Info, CheckCircle, Activity, Moon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type FatigueLevel = "critical" | "high" | "medium" | "low";

export interface FatigueRiskResult {
  crewId: string;
  crewName?: string;
  score: number;
  level: FatigueLevel;
  factors: {
    sleepDebt24h: number;
    sleepDebt7d: number;
    consecutiveNightShifts: number;
    nightWorkRatio: number;
    totalWorkHours7d: number;
    avgDailyRest: number;
  };
  recommendations: string[];
  calculatedAt: string;
}

interface FatigueRiskBadgeProps {
  crewId: string;
  crewName?: string;
  compact?: boolean;
  showScore?: boolean;
  lookbackDays?: number;
  className?: string;
}

// Default fallback config for unknown fatigue levels
const defaultLevelConfig = {
  label: "Unknown",
  color: "text-gray-700 dark:text-gray-400",
  bgColor: "bg-gray-500/20",
  borderColor: "border-gray-500/50",
  icon: Info,
};

const levelConfig: Record<FatigueLevel, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
}> = {
  critical: {
    label: "Critical",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/50",
    icon: AlertCircle,
  },
  high: {
    label: "High",
    color: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/50",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-500/20",
    borderColor: "border-amber-500/50",
    icon: Info,
  },
  low: {
    label: "Low",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/50",
    icon: CheckCircle,
  },
};

// Safe getter for level config with fallback
function getLevelConfig(level: string) {
  return levelConfig[level as FatigueLevel] || defaultLevelConfig;
}

export function FatigueRiskBadge({
  crewId,
  crewName,
  compact = false,
  showScore = true,
  lookbackDays = 14,
  className,
}: FatigueRiskBadgeProps) {
  const { data: fatigueData, isLoading, error } = useQuery<FatigueRiskResult>({
    queryKey: [`/api/hor/fatigue/${crewId}?days=${lookbackDays}`],
    enabled: !!crewId,
    staleTime: 300000,
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1.5", className)} data-testid={`badge-fatigue-loading-${crewId}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {!compact && <span>Fatigue</span>}
      </Badge>
    );
  }

  if (error || !fatigueData) {
    return (
      <Badge variant="outline" className={cn("gap-1.5 text-muted-foreground", className)} data-testid={`badge-fatigue-unavailable-${crewId}`}>
        <Activity className="h-3 w-3" />
        {!compact && <span>N/A</span>}
      </Badge>
    );
  }

  const config = getLevelConfig(fatigueData.level);
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 cursor-pointer transition-colors",
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
      data-testid={`badge-fatigue-${fatigueData.level}-${crewId}`}
    >
      <Icon className="h-3 w-3" />
      {compact ? (
        showScore && <span>{fatigueData.score}</span>
      ) : (
        <span>
          {showScore ? `${config.label} (${fatigueData.score})` : config.label}
        </span>
      )}
    </Badge>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{badge}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <FatigueDetailsContent data={fatigueData} crewName={crewName} />
      </PopoverContent>
    </Popover>
  );
}

interface FatigueDetailsContentProps {
  data: FatigueRiskResult;
  crewName?: string;
}

function FatigueDetailsContent({ data, crewName }: FatigueDetailsContentProps) {
  const config = getLevelConfig(data.level);
  const Icon = config.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-sm">Fatigue Risk Assessment</h4>
          <p className="text-xs text-muted-foreground">
            {crewName || data.crewName || "Crew Member"}
          </p>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium", config.bgColor, config.color)}>
          <Icon className="h-4 w-4" />
          <span>{config.label}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Risk Score</span>
          <span className="font-medium">{data.score}/100</span>
        </div>
        <Progress 
          value={data.score} 
          className={cn("h-2", data.level === "critical" ? "[&>div]:bg-red-500" : 
            data.level === "high" ? "[&>div]:bg-orange-500" :
            data.level === "medium" ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
          )}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h5 className="text-xs font-medium uppercase text-muted-foreground">Contributing Factors</h5>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Night Shifts</p>
              <p className="font-medium">{data.factors.consecutiveNightShifts} consecutive</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Night Work</p>
              <p className="font-medium">{Math.round(data.factors.nightWorkRatio)}%</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Sleep Debt (24h)</p>
              <p className="font-medium">{data.factors.sleepDebt24h.toFixed(1)}h</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Sleep Debt (7d)</p>
              <p className="font-medium">{data.factors.sleepDebt7d.toFixed(1)}h</p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Weekly Work Hours</span>
            <span className="font-medium">{data.factors.totalWorkHours7d.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Avg Daily Rest</span>
            <span className="font-medium">{data.factors.avgDailyRest.toFixed(1)}h</span>
          </div>
        </div>
      </div>

      {data.recommendations.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h5 className="text-xs font-medium uppercase text-muted-foreground">Recommendations</h5>
            <ul className="space-y-1">
              {data.recommendations.map((rec, i) => (
                <li key={`rec-${rec.slice(0, 30)}-${i}`} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="pt-2 text-xs text-muted-foreground text-right">
        Updated: {new Date(data.calculatedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

export function FatigueSummaryCard({
  vesselId,
  vesselName,
}: {
  vesselId: string;
  vesselName?: string;
}) {
  const { data, isLoading, error } = useQuery<{
    vesselId: string;
    lookbackDays: number;
    summary: {
      totalCrew: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      averageScore: number;
      highestRiskCrew: Array<{ crewId: string; crewName?: string; score: number; level: FatigueLevel }>;
    };
    crewFatigue: FatigueRiskResult[];
  }>({
    queryKey: [`/api/hor/fatigue/vessel/${vesselId}`],
    enabled: !!vesselId,
    staleTime: 300000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid={`fatigue-summary-loading-${vesselId}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading fatigue data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-sm text-muted-foreground" data-testid={`fatigue-summary-unavailable-${vesselId}`}>
        Fatigue data unavailable
      </div>
    );
  }

  const { summary } = data;
  const hasRisks = summary.criticalCount > 0 || summary.highCount > 0;

  return (
    <div className="space-y-3" data-testid={`fatigue-summary-${vesselId}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <span>Crew Fatigue Overview</span>
          {vesselName && <span className="text-muted-foreground">- {vesselName}</span>}
        </h4>
        {hasRisks && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {summary.criticalCount + summary.highCount} at risk
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className={cn("rounded-md p-2", summary.criticalCount > 0 ? "bg-red-500/20" : "bg-muted/50")}>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">{summary.criticalCount}</p>
          <p className="text-xs text-muted-foreground">Critical</p>
        </div>
        <div className={cn("rounded-md p-2", summary.highCount > 0 ? "bg-orange-500/20" : "bg-muted/50")}>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{summary.highCount}</p>
          <p className="text-xs text-muted-foreground">High</p>
        </div>
        <div className={cn("rounded-md p-2", summary.mediumCount > 0 ? "bg-amber-500/20" : "bg-muted/50")}>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.mediumCount}</p>
          <p className="text-xs text-muted-foreground">Medium</p>
        </div>
        <div className="rounded-md p-2 bg-green-500/20">
          <p className="text-lg font-bold text-green-600 dark:text-green-400">{summary.lowCount}</p>
          <p className="text-xs text-muted-foreground">Low</p>
        </div>
      </div>

      {summary.highestRiskCrew.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase font-medium">Highest Risk Crew</p>
          <div className="space-y-1">
            {summary.highestRiskCrew.slice(0, 3).map((crew) => (
              <div key={crew.crewId} className="flex items-center justify-between text-sm">
                <span>{crew.crewName || crew.crewId}</span>
                <FatigueRiskBadge crewId={crew.crewId} crewName={crew.crewName} compact showScore />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

```

### `client/src/components/crew/STCWComplianceWidget.tsx` (175 lines)

```tsx
import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Ship, Users, AlertTriangle, CheckCircle, XCircle, Activity, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useSTCWComplianceData, type VesselSummary, type TrendData } from "@/features/crew/hooks/useSTCWComplianceData";

function TrendIcon({ trend }: { trend: "increasing" | "stable" | "decreasing" }) {
  if (trend === "increasing") {return <TrendingUp className="h-4 w-4 text-red-500" />;}
  if (trend === "decreasing") {return <TrendingDown className="h-4 w-4 text-green-500" />;}
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function VesselRow({ vessel, expanded, onToggle }: { vessel: VesselSummary; expanded: boolean; onToggle: () => void }) {
  const hasIssues = vessel.violationCount > 0 || vessel.criticalFatigueCount > 0;
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full" data-testid={`vessel-row-${vessel.vesselId}`}>
        <div className={cn("flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-muted/50", hasIssues && "bg-red-50/50 dark:bg-red-900/10")}>
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Ship className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="font-medium">{vessel.vesselName}</p>
              <p className="text-xs text-muted-foreground">{vessel.totalCrew} crew</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {vessel.criticalFatigueCount > 0 && <Badge variant="destructive" className="gap-1" data-testid={`badge-critical-${vessel.vesselId}`}><XCircle className="h-3 w-3" />{vessel.criticalFatigueCount}</Badge>}
            {vessel.highFatigueCount > 0 && <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300" data-testid={`badge-high-${vessel.vesselId}`}><AlertTriangle className="h-3 w-3" />{vessel.highFatigueCount}</Badge>}
            <div className={cn("w-16 text-right font-medium", vessel.complianceRate >= 95 ? "text-green-600" : vessel.complianceRate >= 80 ? "text-amber-600" : "text-red-600")}>
              {vessel.complianceRate.toFixed(0)}%
            </div>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-10 pr-3 pb-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="p-2 rounded bg-muted/30"><p className="text-muted-foreground text-xs">Compliant</p><p className="font-medium">{vessel.compliantCrew}/{vessel.totalCrew}</p></div>
            <div className="p-2 rounded bg-muted/30"><p className="text-muted-foreground text-xs">Avg Rest/24h</p><p className="font-medium">{vessel.avgRestPer24h.toFixed(1)}h</p></div>
            <div className="p-2 rounded bg-muted/30"><p className="text-muted-foreground text-xs">Violations</p><p className="font-medium text-red-600">{vessel.violationCount}</p></div>
          </div>
          <Link href={`/hours-of-rest?vessel=${vessel.vesselId}`}>
            <Button variant="ghost" size="sm" className="w-full gap-2" data-testid={`link-vessel-hor-${vessel.vesselId}`}>View Hours of Rest<ExternalLink className="h-3 w-3" /></Button>
          </Link>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ComplianceTrendChart({ data }: { data: TrendData; formattedData: Array<{ date: string; complianceRate: number; highFatigueRate: number }> }) {
  const chartData = data.trends.map((t) => ({ ...t, date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) }));
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} formatter={(value: number, name: string) => { if (name === "complianceRate") {return [`${value.toFixed(1)}%`, "Compliance"];} if (name === "highFatigueRate") {return [`${value.toFixed(1)}%`, "High Fatigue"];} return [value, name]; }} />
          <Line type="monotone" dataKey="complianceRate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="complianceRate" />
          <Line type="monotone" dataKey="highFatigueRate" stroke="#f59e0b" strokeWidth={2} dot={false} name="highFatigueRate" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface STCWComplianceWidgetProps {
  lookbackDays?: number;
  prefetchedSummary?: Parameters<typeof useSTCWComplianceData>[0]["prefetchedSummary"];
  prefetchedTrends?: Parameters<typeof useSTCWComplianceData>[0]["prefetchedTrends"];
}

export const STCWComplianceWidget = memo(function STCWComplianceWidget({ lookbackDays = 30, prefetchedSummary, prefetchedTrends }: STCWComplianceWidgetProps) {
  const { summary, trends, isLoadingSummary, isLoadingTrends, summaryError, expandedVessel, toggleVesselExpansion, hasIssues, sortedVessels, formattedChartData } = useSTCWComplianceData({ lookbackDays, prefetchedSummary, prefetchedTrends });

  if (isLoadingSummary) {
    return (
      <Card data-testid="widget-stcw-loading">
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Fleet STCW Compliance</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></CardContent>
      </Card>
    );
  }

  if (summaryError || !summary) {
    return (
      <Card data-testid="widget-stcw-error">
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Fleet STCW Compliance</CardTitle></CardHeader>
        <CardContent><div className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><AlertCircle className="h-5 w-5" /><span>Failed to load compliance data</span></div></CardContent>
      </Card>
    );
  }

  const { fleet, topIssues } = summary;

  return (
    <Card data-testid="widget-stcw-compliance">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Fleet STCW Compliance</CardTitle>
            <CardDescription>{lookbackDays}-day rolling compliance across {fleet.totalVessels} vessels</CardDescription>
          </div>
          {hasIssues && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Attention Required</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/30"><Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{fleet.totalCrew}</p><p className="text-xs text-muted-foreground">Total Crew</p></div>
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20"><CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-600" /><p className="text-2xl font-bold text-green-700 dark:text-green-400">{fleet.overallComplianceRate.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Compliance</p></div>
          <div className={cn("text-center p-3 rounded-lg", fleet.totalViolations > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-muted/30")}><XCircle className={cn("h-5 w-5 mx-auto mb-1", fleet.totalViolations > 0 ? "text-red-600" : "text-muted-foreground")} /><p className={cn("text-2xl font-bold", fleet.totalViolations > 0 && "text-red-700 dark:text-red-400")}>{fleet.totalViolations}</p><p className="text-xs text-muted-foreground">Violations</p></div>
          <div className={cn("text-center p-3 rounded-lg", (fleet.highFatigueCount + fleet.criticalFatigueCount) > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/30")}><Activity className={cn("h-5 w-5 mx-auto mb-1", (fleet.highFatigueCount + fleet.criticalFatigueCount) > 0 ? "text-amber-600" : "text-muted-foreground")} /><p className={cn("text-2xl font-bold", (fleet.highFatigueCount + fleet.criticalFatigueCount) > 0 && "text-amber-700 dark:text-amber-400")}>{fleet.highFatigueCount + fleet.criticalFatigueCount}</p><p className="text-xs text-muted-foreground">High Fatigue</p></div>
        </div>

        {trends && !isLoadingTrends && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Compliance Trends</h4>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><TrendIcon trend={trends.summary.violationTrend} /><span>Violations</span></div>
                <div className="flex items-center gap-1"><TrendIcon trend={trends.summary.fatigueRiskTrend} /><span>Fatigue</span></div>
              </div>
            </div>
            <ComplianceTrendChart data={trends} formattedData={formattedChartData} />
          </div>
        )}

        {sortedVessels.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Vessel Breakdown</h4>
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {sortedVessels.map((vessel) => (
                  <VesselRow key={vessel.vesselId} vessel={vessel} expanded={expandedVessel === vessel.vesselId} onToggle={() => toggleVesselExpansion(vessel.vesselId)} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {topIssues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600 dark:text-red-400">Top Issues Requiring Attention</h4>
            <div className="space-y-2">
              {topIssues.slice(0, 5).map((issue, idx) => (
                <div key={`${issue.crewId}-${idx}`} className={cn("p-2 rounded-lg border text-sm", issue.severity === "critical" ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" : "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800")} data-testid={`issue-${issue.crewId}-${idx}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{issue.crewName}</span>
                    <Badge variant={issue.severity === "critical" ? "destructive" : "outline"} className="text-xs">{issue.issueType.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{issue.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Link href="/hours-of-rest">
            <Button variant="outline" className="w-full gap-2" data-testid="link-hor-dashboard">View Hours of Rest Dashboard<ExternalLink className="h-4 w-4" /></Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
});

```

### `client/src/components/CertificationExpiryAlerts.tsx` (182 lines)

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Check, Clock, FileWarning, Award } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useCertificationExpiryData, type ExpiringCertification } from "@/features/crew/hooks/useCertificationExpiryData";

function getUrgencyIcon(level: string) {
  switch (level) {
    case "critical": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "warning": return <AlertCircle className="h-4 w-4 text-amber-500" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getUrgencyBadge(level: string) {
  switch (level) {
    case "critical": return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    case "warning": return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">Warning</Badge>;
    default: return <Badge variant="secondary" className="text-xs">Notice</Badge>;
  }
}

function CertRow({ cert, onAcknowledge }: { cert: ExpiringCertification; onAcknowledge: (cert: ExpiringCertification) => void }) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        cert.alertAcknowledged ? "bg-muted/50 border-muted" :
        cert.urgencyLevel === "critical" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" :
        cert.urgencyLevel === "warning" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" :
        "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
      }`}
      data-testid={`cert-alert-${cert.id}`}
    >
      <div className="flex items-center gap-3">
        {getUrgencyIcon(cert.urgencyLevel)}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm" data-testid={`text-crew-name-${cert.id}`}>{cert.crewMemberName}</span>
            <span className="text-xs text-muted-foreground">({cert.crewMemberRank})</span>
            {getUrgencyBadge(cert.urgencyLevel)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="font-medium">{cert.cert}</span>
            {cert.certNumber && <span className="ml-2">#{cert.certNumber}</span>}
            <span className="mx-2">•</span>
            <span className="flex items-center gap-1 inline-flex">
              <Clock className="h-3 w-3" />
              {cert.daysUntilExpiry <= 0 ? "Expired" : cert.daysUntilExpiry === 1 ? "Expires tomorrow" : `Expires in ${cert.daysUntilExpiry} days`}
            </span>
            <span className="ml-2 text-muted-foreground">({format(new Date(cert.expiresAt), "MMM d, yyyy")})</span>
          </div>
          {cert.alertAcknowledged && cert.alertAcknowledgedAt && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Acknowledged {formatDistanceToNow(new Date(cert.alertAcknowledgedAt), { addSuffix: true })}
              {cert.alertAcknowledgedNotes && <span className="ml-1 text-muted-foreground">- {cert.alertAcknowledgedNotes}</span>}
            </div>
          )}
        </div>
      </div>
      {!cert.alertAcknowledged && (
        <Button variant="outline" size="sm" onClick={() => onAcknowledge(cert)} className="ml-4" data-testid={`button-acknowledge-${cert.id}`}>
          <Check className="h-3 w-3 mr-1" />Acknowledge
        </Button>
      )}
    </div>
  );
}

export function CertificationExpiryAlertBanner() {
  const {
    data, isLoading, error, isExpanded, setIsExpanded, acknowledgeDialogOpen, setAcknowledgeDialogOpen,
    selectedCert, acknowledgeNotes, setAcknowledgeNotes, handleAcknowledge, confirmAcknowledge, isAcknowledging,
    criticalCount, warningCount,
  } = useCertificationExpiryData();

  if (isLoading) {
    return (
      <Card className="mb-4"><CardHeader className="py-3"><Skeleton className="h-6 w-48" /></CardHeader><CardContent className="py-2"><Skeleton className="h-4 w-full" /></CardContent></Card>
    );
  }

  if (error || !data) {return null;}

  const { certifications, summary } = data;
  if (summary.total === 0) {return null;}

  const alertVariant = criticalCount > 0 ? "destructive" : "default";

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="mb-4">
        <Alert variant={alertVariant} className="border-l-4 border-l-amber-500">
          <FileWarning className="h-5 w-5" />
          <div className="flex-1">
            <AlertTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Certification Expiry Alerts
                <div className="flex gap-1 ml-2">
                  {criticalCount > 0 && <Badge variant="destructive" className="text-xs" data-testid="badge-critical-count">{criticalCount} Critical</Badge>}
                  {warningCount > 0 && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600" data-testid="badge-warning-count">{warningCount} Warning</Badge>}
                </div>
              </span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid="button-toggle-cert-alerts">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm">
              {summary.total} crew certification{summary.total !== 1 ? "s" : ""} expiring within 90 days. Review and acknowledge to ensure Port State Control compliance.
            </AlertDescription>
          </div>
        </Alert>

        <CollapsibleContent className="mt-2">
          <Card>
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Award className="h-4 w-4" />Expiring Certifications ({summary.total})</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                {certifications.map((cert) => <CertRow key={cert.id} cert={cert} onAcknowledge={handleAcknowledge} />)}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Certification Alert</DialogTitle>
            <DialogDescription>
              Acknowledge that you are aware of the upcoming certification expiry for {selectedCert?.crewMemberName}'s {selectedCert?.cert}.
              This does not resolve the issue - ensure renewal actions are taken.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea placeholder="Add notes about actions being taken (optional)" value={acknowledgeNotes} onChange={(e) => setAcknowledgeNotes(e.target.value)} className="min-h-[80px]" data-testid="input-acknowledge-notes" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(false)} data-testid="button-cancel-acknowledge">Cancel</Button>
            <Button onClick={confirmAcknowledge} disabled={isAcknowledging} data-testid="button-confirm-acknowledge">{isAcknowledging ? "Acknowledging..." : "Acknowledge Alert"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CertificationExpiryWidget() {
  const { data, isLoading } = useCertificationExpiryData();

  if (isLoading) {
    return <Card><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>;
  }

  if (!data || data.summary.total === 0) {
    return <Card><CardContent className="pt-6"><div className="flex items-center gap-3 text-green-600"><Check className="h-5 w-5" /><span className="text-sm">All certifications are current</span></div></CardContent></Card>;
  }

  const { summary } = data;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileWarning className="h-4 w-4" />Certification Alerts</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30" data-testid="widget-critical"><div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.critical}</div><div className="text-xs text-muted-foreground">Critical</div></div>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30" data-testid="widget-warning"><div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.warning}</div><div className="text-xs text-muted-foreground">Warning</div></div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30" data-testid="widget-notice"><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.notice}</div><div className="text-xs text-muted-foreground">Notice</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/DocumentExpiryAlerts.tsx` (183 lines)

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Check, Clock, FileText, FileWarning } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useDocumentExpiryData, type ExpiringDocument } from "@/features/crew/hooks/useDocumentExpiryData";

function getUrgencyIcon(level: string) {
  switch (level) {
    case "critical": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "warning": return <AlertCircle className="h-4 w-4 text-amber-500" />;
    default: return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getUrgencyBadge(level: string) {
  switch (level) {
    case "critical": return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    case "warning": return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">Warning</Badge>;
    default: return <Badge variant="secondary" className="text-xs">Notice</Badge>;
  }
}

function DocumentRow({ doc, onAcknowledge, getDocumentTypeLabel }: { doc: ExpiringDocument; onAcknowledge: (doc: ExpiringDocument) => void; getDocumentTypeLabel: (type: string) => string }) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        doc.alertAcknowledged ? "bg-muted/50 border-muted" :
        doc.urgencyLevel === "critical" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" :
        doc.urgencyLevel === "warning" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" :
        "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
      }`}
      data-testid={`doc-alert-${doc.id}`}
    >
      <div className="flex items-center gap-3">
        {getUrgencyIcon(doc.urgencyLevel)}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm" data-testid={`text-doc-crew-name-${doc.id}`}>{doc.crewMemberName}</span>
            <span className="text-xs text-muted-foreground">({doc.crewMemberRank})</span>
            {getUrgencyBadge(doc.urgencyLevel)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="font-medium">{getDocumentTypeLabel(doc.documentType)}</span>
            {doc.documentNumber && <span className="ml-2">#{doc.documentNumber}</span>}
            {doc.issuingCountry && <span className="ml-2">({doc.issuingCountry})</span>}
            <span className="mx-2">•</span>
            <span className="flex items-center gap-1 inline-flex">
              <Clock className="h-3 w-3" />
              {doc.daysUntilExpiry <= 0 ? "Expired" : doc.daysUntilExpiry === 1 ? "Expires tomorrow" : `Expires in ${doc.daysUntilExpiry} days`}
            </span>
            <span className="ml-2 text-muted-foreground">({format(new Date(doc.expiresAt), "MMM d, yyyy")})</span>
          </div>
          {doc.alertAcknowledged && doc.alertAcknowledgedAt && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Acknowledged {formatDistanceToNow(new Date(doc.alertAcknowledgedAt), { addSuffix: true })}
              {doc.alertAcknowledgedNotes && <span className="ml-1 text-muted-foreground">- {doc.alertAcknowledgedNotes}</span>}
            </div>
          )}
        </div>
      </div>
      {!doc.alertAcknowledged && (
        <Button variant="outline" size="sm" onClick={() => onAcknowledge(doc)} className="ml-4" data-testid={`button-acknowledge-doc-${doc.id}`}>
          <Check className="h-3 w-3 mr-1" />Acknowledge
        </Button>
      )}
    </div>
  );
}

export function DocumentExpiryAlertBanner() {
  const {
    data, isLoading, error, isExpanded, setIsExpanded, acknowledgeDialogOpen, setAcknowledgeDialogOpen,
    selectedDoc, acknowledgeNotes, setAcknowledgeNotes, handleAcknowledge, confirmAcknowledge, isAcknowledging,
    criticalCount, warningCount, getDocumentTypeLabel,
  } = useDocumentExpiryData();

  if (isLoading) {
    return (
      <Card className="mb-4"><CardHeader className="py-3"><Skeleton className="h-6 w-48" /></CardHeader><CardContent className="py-2"><Skeleton className="h-4 w-full" /></CardContent></Card>
    );
  }

  if (error || !data) {return null;}

  const { documents, summary } = data;
  if (summary.total === 0) {return null;}

  const alertVariant = criticalCount > 0 ? "destructive" : "default";

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="mb-4">
        <Alert variant={alertVariant} className="border-l-4 border-l-orange-500">
          <FileText className="h-5 w-5" />
          <div className="flex-1">
            <AlertTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Crew Document Expiry Alerts
                <div className="flex gap-1 ml-2">
                  {criticalCount > 0 && <Badge variant="destructive" className="text-xs" data-testid="badge-doc-critical-count">{criticalCount} Critical</Badge>}
                  {warningCount > 0 && <Badge variant="outline" className="text-xs border-amber-500 text-amber-600" data-testid="badge-doc-warning-count">{warningCount} Warning</Badge>}
                </div>
              </span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid="button-toggle-doc-alerts">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </AlertTitle>
            <AlertDescription className="mt-1 text-sm">
              {summary.total} crew document{summary.total !== 1 ? "s" : ""} expiring within 90 days. Review and ensure timely renewal for continued compliance with maritime regulations.
            </AlertDescription>
          </div>
        </Alert>

        <CollapsibleContent className="mt-2">
          <Card>
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" />Expiring Documents ({summary.total})</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                {documents.map((doc) => <DocumentRow key={doc.id} doc={doc} onAcknowledge={handleAcknowledge} getDocumentTypeLabel={getDocumentTypeLabel} />)}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Document Alert</DialogTitle>
            <DialogDescription>
              Acknowledge that you are aware of the upcoming document expiry for {selectedDoc?.crewMemberName}'s {getDocumentTypeLabel(selectedDoc?.documentType || "")}.
              This does not resolve the issue - ensure renewal actions are taken.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea placeholder="Add notes about actions being taken (optional)" value={acknowledgeNotes} onChange={(e) => setAcknowledgeNotes(e.target.value)} className="min-h-[80px]" data-testid="input-doc-acknowledge-notes" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcknowledgeDialogOpen(false)} data-testid="button-cancel-doc-acknowledge">Cancel</Button>
            <Button onClick={confirmAcknowledge} disabled={isAcknowledging} data-testid="button-confirm-doc-acknowledge">{isAcknowledging ? "Acknowledging..." : "Acknowledge Alert"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DocumentExpiryWidget() {
  const { data, isLoading } = useDocumentExpiryData();

  if (isLoading) {
    return <Card><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>;
  }

  if (!data || data.summary.total === 0) {
    return <Card><CardContent className="pt-6"><div className="flex items-center gap-3 text-green-600"><Check className="h-5 w-5" /><span className="text-sm">All crew documents are current</span></div></CardContent></Card>;
  }

  const { summary } = data;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileWarning className="h-4 w-4" />Document Alerts</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30" data-testid="doc-widget-critical"><div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.critical}</div><div className="text-xs text-muted-foreground">Critical</div></div>
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30" data-testid="doc-widget-warning"><div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.warning}</div><div className="text-xs text-muted-foreground">Warning</div></div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30" data-testid="doc-widget-notice"><div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.notice}</div><div className="text-xs text-muted-foreground">Notice</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

```

### `client/src/components/hours-of-rest/utils.ts` (32 lines)

```ts
/**
 * Hours of Rest Grid Utilities
 * 
 * Re-exports shared rest grid utilities for backward compatibility.
 * See @shared/lib/rest-grid-utils.ts for implementation.
 */

export {
  type DayRow,
  type Crew,
  type Vessel,
  type ShiftPattern,
  type GridMeta,
  type ViewMode,
  type SaveStatus,
  MONTHS,
  DEFAULT_PATTERNS,
  createDefaultGridMeta,
  ymd,
  emptyMonth,
  toCSV,
  parseCSV,
  sum24,
  chunks,
  splitOK,
  minRest24Around,
  getSaveStatusBadgeVariant,
  getWeekViewData,
  calculateWeekCount,
  filterCrewByVessel,
  isGridReady,
} from "@shared/lib/rest-grid-utils";

```

