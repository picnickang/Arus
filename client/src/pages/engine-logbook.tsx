import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Ship,
  Gauge,
  Save,
  FileText,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Activity,
  Fuel,
  Bell,
  Lock,
  Plus,
  Zap,
  Droplets,
  CircleDot,
} from "lucide-react";
import { PageHeader } from "@/components/navigation";
import { format } from "date-fns";
import {
  useEngineLogbookData,
  WATCH_PERIODS,
  GENERATOR_NUMBERS,
  MANUAL_ENGINE_EVENT_TYPES,
  type EngineLogEvent,
} from "@/features/engine-logbook";
import { PermissionGate } from "@/components/PermissionGate";
import {
  EngineHourlyRow,
  GeneratorIntervalRow,
  EngineEventItem,
  EngineWatchCard,
} from "@/components/engine-logbook/row-components";


export default function EngineLogbookPage() {
  const e = useEngineLogbookData();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      e.setActiveTab("events");
      e.setNewEventDialogOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (e.loadingVessels) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <PageHeader title="Engine Logbook" />
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => e.autoFillMutation.mutate()}
            disabled={
              !e.selectedVesselId || !e.selectedDate || e.isLocked || e.autoFillMutation.isPending
            }
            data-testid="button-autofill"
          >
            <Zap className="h-4 w-4 mr-2" />
            {e.autoFillMutation.isPending ? "Filling..." : "Auto-Fill from Telemetry"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => e.notifyUnsignedMutation.mutate()}
            disabled={e.notifyUnsignedMutation.isPending}
            data-testid="button-notify-unsigned"
          >
            <Bell className="h-4 w-4 mr-2" />
            {e.notifyUnsignedMutation.isPending ? "Sending..." : "Notify Unsigned"}
          </Button>
          <PermissionGate resource="engine_logbook" action="export">
            <Button
              variant="outline"
              size="sm"
              onClick={e.exportToPDFHandler}
              disabled={!e.engineLogComplete}
              data-testid="button-export-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={e.exportToExcelHandler}
              disabled={!e.engineLogComplete}
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </PermissionGate>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Ship className="h-5 w-5 text-muted-foreground" />
                  <Select value={e.selectedVesselId} onValueChange={e.setSelectedVesselId}>
                    <SelectTrigger className="w-[200px]" data-testid="select-vessel">
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      {e.vessels
                        ?.filter((v) => v.orgId === e.orgId && v.id)
                        .map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e.goToPreviousDay}
                    data-testid="button-prev-day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <Input
                      type="date"
                      value={e.selectedDate}
                      onChange={(ev) => e.setSelectedDate(ev.target.value)}
                      className="w-[160px]"
                      data-testid="input-date"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e.goToNextDay}
                    data-testid="button-next-day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {e.engineLogComplete?.daily && (
                  <>
                    <Badge variant={e.isLocked ? "secondary" : e.isSigned ? "default" : "outline"}>
                      {e.isLocked ? (
                        <>
                          <Lock className="h-3 w-3 mr-1" /> Locked
                        </>
                      ) : e.isSigned ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Signed
                        </>
                      ) : (
                        <>
                          <FileText className="h-3 w-3 mr-1" /> Draft
                        </>
                      )}
                    </Badge>
                    {e.isDirty && (
                      <Badge variant="outline" className="text-yellow-600">
                        <AlertCircle className="h-3 w-3 mr-1" /> Unsaved
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {!e.selectedVesselId ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Ship className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a Vessel</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Choose a vessel from the dropdown above to view or edit its engine room logbook
                entries.
              </p>
            </CardContent>
          </Card>
        ) : e.loadingEngineLog ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Tabs value={e.activeTab} onValueChange={e.setActiveTab}>
            <TabsList className="flex w-full overflow-x-auto">
              <TabsTrigger value="hourly" data-testid="tab-hourly">
                <Clock className="h-4 w-4 mr-2" />
                Hourly Log
              </TabsTrigger>
              <TabsTrigger value="generators" data-testid="tab-generators">
                <Zap className="h-4 w-4 mr-2" />
                Generators
              </TabsTrigger>
              <TabsTrigger value="events" data-testid="tab-events">
                <Activity className="h-4 w-4 mr-2" />
                Events
              </TabsTrigger>
              <TabsTrigger value="watches" data-testid="tab-watches">
                <Users className="h-4 w-4 mr-2" />
                Watches
              </TabsTrigger>
              <TabsTrigger value="summary" data-testid="tab-summary">
                <FileText className="h-4 w-4 mr-2" />
                Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hourly" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5" />
                    Main Engine Hourly Readings
                  </CardTitle>
                  <CardDescription>Record hourly main engine parameters</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16 sticky left-0 bg-background">Hour</TableHead>
                          <TableHead className="w-20">RPM</TableHead>
                          <TableHead className="w-20">Load %</TableHead>
                          <TableHead className="w-20">F.Rack</TableHead>
                          <TableHead className="w-24">Exh.T °C</TableHead>
                          <TableHead className="w-24">Scav.P</TableHead>
                          <TableHead className="w-24">Cool.In</TableHead>
                          <TableHead className="w-24">Cool.Out</TableHead>
                          <TableHead className="w-24">LO.P</TableHead>
                          <TableHead className="w-24">LO.T</TableHead>
                          <TableHead className="w-24">TC RPM</TableHead>
                          <TableHead className="w-24">FO.T</TableHead>
                          <TableHead>Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: 24 }, (_, i) => (
                          <EngineHourlyRow
                            key={i}
                            hour={i}
                            entry={e.hourlyEntries.get(i) ?? {}}
                            isLocked={e.isLocked}
                            updateHourlyEntry={e.updateHourlyEntry}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="generators" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Diesel Generator Log
                  </CardTitle>
                  <CardDescription>Record generator performance at key intervals</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {GENERATOR_NUMBERS.map((genNum) => (
                      <div key={genNum} className="mb-6">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <CircleDot className="h-4 w-4" />
                          Diesel Generator {genNum}
                        </h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Hour</TableHead>
                              <TableHead>Load kW</TableHead>
                              <TableHead>Voltage V</TableHead>
                              <TableHead>Freq Hz</TableHead>
                              <TableHead>Exh.T °C</TableHead>
                              <TableHead>LO Press</TableHead>
                              <TableHead>Cool.T</TableHead>
                              <TableHead>Run Hrs</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[0, 6, 12, 18].map((hour) => (
                              <GeneratorIntervalRow
                                key={`${genNum}-${hour}`}
                                genNum={genNum}
                                hour={hour}
                                entry={e.generatorEntries.get(`${genNum}-${hour}`) ?? {}}
                                isLocked={e.isLocked}
                                updateGeneratorEntry={e.updateGeneratorEntry}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Engine Room Events Timeline
                      </CardTitle>
                      <CardDescription>Automated and manual event log entries</CardDescription>
                    </div>
                    <Dialog open={e.newEventDialogOpen} onOpenChange={e.setNewEventDialogOpen}>
                      <DialogTrigger asChild>
                        <PermissionGate resource="engine_logbook" action="create">
                          <Button size="sm" disabled={e.isLocked} data-testid="button-add-event">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Event
                          </Button>
                        </PermissionGate>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Add Engine Room Event</DialogTitle>
                          <DialogDescription>
                            Record a manual event in the engine room log
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...e.eventForm}>
                          <form
                            onSubmit={e.eventForm.handleSubmit(e.onSubmitEvent)}
                            className="space-y-4"
                          >
                            <FormField
                              control={e.eventForm.control}
                              name="eventType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Event Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-event-type">
                                        <SelectValue placeholder="Select event type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {MANUAL_ENGINE_EVENT_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                          {type.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={e.eventForm.control}
                              name="summary"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Summary</FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Brief description"
                                      data-testid="input-event-summary"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={e.eventForm.control}
                              name="details"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Details (Optional)</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      placeholder="Additional details..."
                                      rows={3}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={e.eventForm.control}
                                name="meRpm"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>ME RPM</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="text" placeholder="RPM" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={e.eventForm.control}
                                name="meLoad"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>ME Load %</FormLabel>
                                    <FormControl>
                                      <Input {...field} type="text" placeholder="Load %" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => e.setNewEventDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={e.createEventMutation.isPending}
                                data-testid="button-submit-event"
                              >
                                {e.createEventMutation.isPending ? "Creating..." : "Create Event"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {e.loadingEvents ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : e.events && e.events.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {e.events
                          .sort(
                            (a, b) =>
                              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                          )
                          .map((event: EngineLogEvent) => (
                            <EngineEventItem key={event.id} event={event} />
                          ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Activity className="h-12 w-12 mb-4 opacity-50" />
                      <p>No events recorded for this day</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="watches" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Engine Room Watch Assignments
                  </CardTitle>
                  <CardDescription>
                    Record engineering watch personnel for each period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {WATCH_PERIODS.map((period) => (
                      <EngineWatchCard
                        key={period}
                        period={period}
                        watch={e.watchAssignments.get(period) ?? {}}
                        isLocked={e.isLocked}
                        updateWatchAssignment={e.updateWatchAssignment}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="h-5 w-5" />
                      Main Engine Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Running Hours</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={e.dailySummary.meRunningHours ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "meRunningHours",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-running-hours"
                        />
                      </div>
                      <div>
                        <Label>Revolutions</Label>
                        <Input
                          type="number"
                          value={e.dailySummary.meRevolutions ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "meRevolutions",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-revolutions"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Avg RPM</Label>
                        <Input
                          type="number"
                          value={e.dailySummary.avgMeRpm ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "avgMeRpm",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-avg-rpm"
                        />
                      </div>
                      <div>
                        <Label>Avg Load %</Label>
                        <Input
                          type="number"
                          value={e.dailySummary.avgMeLoad ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "avgMeLoad",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-avg-load"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Fuel className="h-5 w-5" />
                      Fuel & Oil Consumption
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>FO (MT)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={e.dailySummary.foConsumption ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "foConsumption",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-fo"
                        />
                      </div>
                      <div>
                        <Label>DO (MT)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={e.dailySummary.doConsumption ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "doConsumption",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-do"
                        />
                      </div>
                      <div>
                        <Label>LO (L)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={e.dailySummary.loConsumption ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "loConsumption",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-lo"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Droplets className="h-5 w-5" />
                      Fresh Water
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Produced (MT)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={e.dailySummary.fwProduced ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "fwProduced",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-fw-produced"
                        />
                      </div>
                      <div>
                        <Label>Consumed (MT)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={e.dailySummary.fwConsumed ?? ""}
                          onChange={(ev) =>
                            e.updateDailySummary(
                              "fwConsumed",
                              ev.target.value ? Number(ev.target.value) : undefined
                            )
                          }
                          disabled={e.isLocked}
                          data-testid="input-summary-fw-consumed"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Engineering Remarks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Chief Engineer Remarks</Label>
                      <Textarea
                        value={e.dailySummary.chiefEngineerRemarks ?? ""}
                        onChange={(ev) =>
                          e.updateDailySummary("chiefEngineerRemarks", ev.target.value)
                        }
                        rows={3}
                        disabled={e.isLocked}
                        data-testid="input-summary-chief-remarks"
                      />
                    </div>
                    <div>
                      <Label>Second Engineer Remarks</Label>
                      <Textarea
                        value={e.dailySummary.secondEngineerRemarks ?? ""}
                        onChange={(ev) =>
                          e.updateDailySummary("secondEngineerRemarks", ev.target.value)
                        }
                        rows={3}
                        disabled={e.isLocked}
                        data-testid="input-summary-second-remarks"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {e.selectedVesselId && e.engineLogComplete && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {e.isSigned && e.engineLogComplete.daily.signedByName && (
                    <div className="text-sm text-muted-foreground">
                      Signed by:{" "}
                      <span className="font-medium">{e.engineLogComplete.daily.signedByName}</span>
                      {e.engineLogComplete.daily.signedAt && (
                        <> at {format(new Date(e.engineLogComplete.daily.signedAt), "PPp")}</>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <PermissionGate resource="engine_logbook" action="edit">
                    <Button
                      variant="outline"
                      onClick={() => e.saveMutation.mutate()}
                      disabled={!e.isDirty || e.isLocked || e.saveMutation.isPending}
                      data-testid="button-save"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {e.saveMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </PermissionGate>
                  <PermissionGate resource="engine_logbook" action="sign_off">
                    {!e.isSigned && !e.isLocked && (
                      <Button
                        variant="default"
                        onClick={() => e.signMutation.mutate()}
                        disabled={e.signMutation.isPending}
                        data-testid="button-sign"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {e.signMutation.isPending ? "Signing..." : "Sign Log"}
                      </Button>
                    )}
                  </PermissionGate>
                  <PermissionGate resource="engine_logbook" action="edit">
                    {e.isSigned && !e.isLocked && (
                      <Button
                        variant="secondary"
                        onClick={() => e.lockMutation.mutate()}
                        disabled={e.lockMutation.isPending}
                        data-testid="button-lock"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        {e.lockMutation.isPending ? "Locking..." : "Lock Log"}
                      </Button>
                    )}
                  </PermissionGate>
                  {e.isLocked && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Immutable Record
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
