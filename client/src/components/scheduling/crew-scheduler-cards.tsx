import type { useShiftPlanning } from "@/features/crew";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Clock,
  Ship,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import type { SelectShiftTemplate } from "@shared/schema";
import {
  CREW_CERTIFICATION_TYPES,
  getCertLabel,
  QualificationBridge,
  type SchedulerCrew,
} from "./crew-scheduler-qualification";

export type ShiftPlanning = ReturnType<typeof useShiftPlanning>;

export {
  CREW_CERTIFICATION_TYPES,
  getCertLabel,
  QualificationBridge,
} from "./crew-scheduler-qualification";
export type { CrewCert, SchedulerCrew } from "./crew-scheduler-qualification";

export function calcDuration(start: string, end: string): number {
  if (!start || !end) {
    return 0;
  }
  const [sh = 0, sm = 0] = start.split(":").map(Number);
  const [eh = 0, em = 0] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) {
    mins += 24 * 60;
  }
  return Math.round((mins / 60) * 10) / 10;
}

export function SchedulingConfigCard({
  p,
  toast,
  showAllCrew,
  setShowAllCrew,
}: {
  p: ShiftPlanning;
  toast: (args: { title: string; description?: string }) => void;
  showAllCrew: boolean;
  setShowAllCrew: (v: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduling Configuration</CardTitle>
        <CardDescription>View shift templates and crew constraints</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="shifts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="shifts">Shift Templates</TabsTrigger>
            <TabsTrigger value="crew">Crew Status</TabsTrigger>
          </TabsList>
          <TabsContent value="shifts" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Shift Templates</h3>
              <Dialog open={p.isShiftDialogOpen} onOpenChange={p.setIsShiftDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-shift">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Shift Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {p.editingShiftId ? "Edit Shift Template" : "Add Shift Template"}
                    </DialogTitle>
                    <DialogDescription>
                      Configure shift timing, requirements, and crew assignments
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...p.shiftForm}>
                    <form
                      onSubmit={p.shiftForm.handleSubmit(p.onSubmitShift)}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={p.shiftForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  data-testid="input-shift-role"
                                  placeholder="e.g. Navigation Watch"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={p.shiftForm.control}
                          name="vesselId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vessel (Optional)</FormLabel>
                              <Select
                                value={field.value || "none"}
                                onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-shift-vessel">
                                    <SelectValue placeholder="Select Vessel" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">None (All Vessels)</SelectItem>
                                  {(p.vessels as Array<{ id: string; name?: string }>)
                                    .filter((v) => v.id?.trim())
                                    .map((v) => (
                                      <SelectItem key={v.id} value={v.id}>
                                        {v.name || v.id}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={p.shiftForm.control}
                          name="start"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Time</FormLabel>
                              <FormControl>
                                <Input {...field} type="time" data-testid="input-shift-start" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={p.shiftForm.control}
                          name="end"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Time</FormLabel>
                              <FormControl>
                                <Input {...field} type="time" data-testid="input-shift-end" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={p.shiftForm.control}
                          name="durationH"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Duration (Hours)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  min="0.5"
                                  max="24"
                                  step="0.5"
                                  readOnly
                                  className="bg-muted"
                                  data-testid="input-shift-duration"
                                />
                              </FormControl>
                              <FormMessage>
                                <span className="text-xs text-muted-foreground">
                                  Auto-calculated from start/end
                                </span>
                              </FormMessage>
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={p.shiftForm.control}
                          name="requiredSkills"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Required Skills (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  data-testid="input-shift-skills"
                                  placeholder="e.g. watchkeeping, navigation"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={p.shiftForm.control}
                          name="rankMin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Rank (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  data-testid="input-shift-rank"
                                  placeholder="e.g. Second Officer"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={p.shiftForm.control}
                        name="certRequired"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Required Certification (Optional)</FormLabel>
                            <Select
                              value={field.value || "none"}
                              onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-shift-cert">
                                  <SelectValue placeholder="No certification required" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">No certification required</SelectItem>
                                {CREW_CERTIFICATION_TYPES.map((ct) => (
                                  <SelectItem key={ct.value} value={ct.value}>
                                    {ct.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={p.handleCancelShiftEdit}
                          data-testid="button-cancel-shift"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={
                            p.createShiftMutation.isPending || p.updateShiftMutation.isPending
                          }
                          data-testid="button-save-shift"
                        >
                          {p.editingShiftId ? "Update" : "Create"} Shift
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {p.isLoadingShifts ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading shift templates...
                </div>
              ) : p.shiftTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No shift templates defined yet</p>
                  <p className="text-sm">Add your first shift template to get started</p>
                </div>
              ) : (
                p.shiftTemplates.map((shift: SelectShiftTemplate) => (
                  <div
                    key={shift.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    data-testid={`shift-template-${shift.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{shift.role}</h4>
                          {shift.vesselId && (
                            <Badge variant="outline" className="text-xs">
                              <Ship className="h-3 w-3 mr-1" />
                              {shift.vesselId}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {shift.start} - {shift.end} ({shift.durationH}h)
                            </span>
                          </div>
                          {(shift.requiredSkills || shift.rankMin || shift.certRequired) && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {shift.requiredSkills && (
                                <Badge variant="secondary" className="text-xs">
                                  Skills: {shift.requiredSkills}
                                </Badge>
                              )}
                              {shift.rankMin && (
                                <Badge variant="secondary" className="text-xs">
                                  Rank: {shift.rankMin}
                                </Badge>
                              )}
                              {shift.certRequired && (
                                <Badge variant="secondary" className="text-xs">
                                  Cert: {getCertLabel(shift.certRequired)}
                                </Badge>
                              )}
                            </div>
                          )}
                          {shift.certRequired && (
                            <QualificationBridge
                              certRequired={shift.certRequired}
                              crew={p.crew}
                              certifications={p.certifications}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => p.handleEditShift(shift)}
                          data-testid={`button-edit-shift-${shift.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => p.deleteShiftMutation.mutate(shift.id)}
                          disabled={p.deleteShiftMutation.isPending}
                          data-testid={`button-delete-shift-${shift.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
          <TabsContent value="crew" className="space-y-3 mt-4">
            {p.crew.slice(0, showAllCrew ? p.crew.length : 6).map((member: SchedulerCrew) => (
              <div
                key={member.id}
                role="button"
                tabIndex={0}
                className="border rounded p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid={`crew-member-${member.id}`}
                onClick={() =>
                  toast({
                    title: "Crew Member",
                    description: `${member.name} (${member.rank}) - Available for scheduling with ${member.skills?.length ?? 0} skills`,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toast({
                      title: "Crew Member",
                      description: `${member.name} (${member.rank}) - Available for scheduling with ${member.skills?.length ?? 0} skills`,
                    });
                  }
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{member.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {member.rank} • {member.maxHours7d}h/week max
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(member.skills ?? []).slice(0, 2).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill.replace("_", " ")}
                      </Badge>
                    ))}
                    {(member.skills?.length ?? 0) > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{(member.skills?.length ?? 0) - 2}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {p.crew.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowAllCrew(!showAllCrew)}
                data-testid="button-toggle-crew-list"
              >
                {showAllCrew ? "Show fewer" : `Show all ${p.crew.length} crew members`}
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
