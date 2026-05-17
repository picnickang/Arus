// @ts-nocheck
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Ship,
  Compass,
  Wind,
  Waves,
  Eye,
  Gauge,
  Thermometer,
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
  Lock,
  Plus,
  CloudSun,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/navigation";
import { format } from "date-fns";
import {
  useDeckLogbookData,
  WATCH_PERIODS,
  MANUAL_EVENT_TYPES,
} from "@/features/deck-logbook";
import { PermissionGate } from "@/components/PermissionGate";
import { HourlyLogRow } from "./HourlyLogRow";
import { EventTimelineItem } from "./EventTimelineItem";
import { WatchPeriodCard } from "./WatchPeriodCard";

export default function DeckLogbookPage() {
  const d = useDeckLogbookData();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "new") {
      d.setActiveTab("events");
      d.setNewEventDialogOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (d.loadingVessels) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Deck Logbook" />
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-4">
          {d.isLocked && (
            <Badge className="bg-red-600">
              <Lock className="h-3 w-3 mr-1" />
              Locked
            </Badge>
          )}
          {d.isSigned && !d.isLocked && (
            <Badge className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Signed
            </Badge>
          )}
          {d.isDirty && !d.isLocked && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Unsaved Changes
            </Badge>
          )}
          <PermissionGate resource="deck_logbook" action="export">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={d.exportToPDFHandler}
                disabled={!d.selectedVesselId || !d.deckLogComplete}
                data-testid="button-export-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                onClick={d.exportToExcelHandler}
                disabled={!d.selectedVesselId || !d.deckLogComplete}
                data-testid="button-export-excel"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
            </div>
          </PermissionGate>
          <PermissionGate resource="deck_logbook" action="edit">
            {!d.isLocked && (
              <Button
                onClick={() => d.saveMutation.mutate()}
                disabled={d.saveMutation.isPending || !d.selectedVesselId}
                data-testid="button-save-decklog"
              >
                <Save className="h-4 w-4 mr-2" />
                {d.saveMutation.isPending ? "Saving..." : "Save All"}
              </Button>
            )}
          </PermissionGate>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:w-64">
            <Label>Select Vessel</Label>
            <Select value={d.selectedVesselId} onValueChange={d.setSelectedVesselId}>
              <SelectTrigger data-testid="select-vessel">
                <SelectValue placeholder="Choose a vessel" />
              </SelectTrigger>
              <SelectContent>
                {d.vessels
                  ?.filter((v) => v.orgId === d.orgId && v.id)
                  .map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      <div className="flex items-center gap-2">
                        <Ship className="h-4 w-4" />
                        {vessel.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => d.navigateDate("prev")}
              data-testid="button-prev-date"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <Input
                type="date"
                value={d.selectedDate}
                onChange={(e) => d.setSelectedDate(e.target.value)}
                className="w-40"
                data-testid="input-date"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => d.navigateDate("next")}
              data-testid="button-next-date"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!d.selectedVesselId ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a vessel to view or edit the deck log</p>
            </CardContent>
          </Card>
        ) : d.loadingDeckLog ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <div className="space-y-6">
            <Tabs value={d.activeTab} onValueChange={d.setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="hourly" data-testid="tab-hourly">
                  <Clock className="h-4 w-4 mr-2" />
                  Hourly Log
                </TabsTrigger>
                <TabsTrigger value="events" data-testid="tab-events">
                  <Activity className="h-4 w-4 mr-2" />
                  Events
                  {d.events && d.events.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {d.events.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="summary" data-testid="tab-summary">
                  <Compass className="h-4 w-4 mr-2" />
                  Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="hourly" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Hourly Navigation & Weather Log
                      </CardTitle>
                      <CardDescription>
                        Record course, weather conditions, and observations for each hour (UTC)
                      </CardDescription>
                    </div>
                    {!d.isLocked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => d.autoFillMutation.mutate()}
                        disabled={d.autoFillMutation.isPending || !d.selectedVesselId}
                        data-testid="button-autofill-weather"
                      >
                        {d.autoFillMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Filling...
                          </>
                        ) : (
                          <>
                            <CloudSun className="h-4 w-4 mr-2" />
                            Auto-fill Weather
                          </>
                        )}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16 text-center">Hour</TableHead>
                            <TableHead className="w-20">
                              <div className="flex items-center gap-1">
                                <Compass className="h-3 w-3" />
                                Course
                              </div>
                            </TableHead>
                            <TableHead className="w-24">
                              <div className="flex items-center gap-1">
                                <Wind className="h-3 w-3" />
                                Wind Dir
                              </div>
                            </TableHead>
                            <TableHead className="w-20">Wind Force</TableHead>
                            <TableHead className="w-28">
                              <div className="flex items-center gap-1">
                                <Waves className="h-3 w-3" />
                                Sea State
                              </div>
                            </TableHead>
                            <TableHead className="w-28">
                              <div className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                Visibility
                              </div>
                            </TableHead>
                            <TableHead className="w-24">
                              <div className="flex items-center gap-1">
                                <Gauge className="h-3 w-3" />
                                Baro (mb)
                              </div>
                            </TableHead>
                            <TableHead className="w-20">
                              <div className="flex items-center gap-1">
                                <Thermometer className="h-3 w-3" />
                                Air °C
                              </div>
                            </TableHead>
                            <TableHead className="w-20">Sea °C</TableHead>
                            <TableHead className="min-w-[200px]">Remarks</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from({ length: 24 }, (_, i) => (
                            <HourlyLogRow
                              key={i}
                              hour={i}
                              entry={d.hourlyEntries.get(i) ?? {}}
                              isLocked={d.isLocked}
                              updateHourlyEntry={d.updateHourlyEntry}
                            />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="events" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Event Timeline
                      </CardTitle>
                      <CardDescription>
                        Automated and manual operational events for the day
                      </CardDescription>
                    </div>
                    {!(d.isLocked as any)?.deckLogComplete?.daily?.id && (
                      <Dialog
                        open={d.newEventDialogOpen}
                        onOpenChange={(open) => {
                          d.setNewEventDialogOpen(open);
                          if (!open) {
                            d.eventForm.reset();
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <PermissionGate resource="deck_logbook" action="create">
                            <Button data-testid="button-add-event">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Event
                            </Button>
                          </PermissionGate>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>Add Manual Event</DialogTitle>
                            <DialogDescription>
                              Record a manual operational event in the deck log timeline.
                            </DialogDescription>
                          </DialogHeader>
                          <Form {...d.eventForm}>
                            <form
                              onSubmit={d.eventForm.handleSubmit(d.onSubmitEvent)}
                              className="space-y-4"
                            >
                              <FormField
                                control={d.eventForm.control}
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
                                        {MANUAL_EVENT_TYPES.map((type) => (
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
                                control={d.eventForm.control}
                                name="summary"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Summary</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Brief description of the event"
                                        data-testid="input-event-summary"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormDescription>Minimum 5 characters required</FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={d.eventForm.control}
                                name="details"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Details (Optional)</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="Additional details about the event"
                                        rows={3}
                                        data-testid="textarea-event-details"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={d.eventForm.control}
                                  name="positionLat"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Latitude (Optional)</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.0001"
                                          placeholder="1.2345"
                                          data-testid="input-event-lat"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={d.eventForm.control}
                                  name="positionLon"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Longitude (Optional)</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.0001"
                                          placeholder="103.8765"
                                          data-testid="input-event-lon"
                                          {...field}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <DialogFooter className="pt-4">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    d.setNewEventDialogOpen(false);
                                    d.eventForm.reset();
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={d.createEventMutation.isPending}
                                  data-testid="button-create-event"
                                >
                                  {d.createEventMutation.isPending ? "Creating..." : "Create Event"}
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardHeader>
                  <CardContent>
                    {d.loadingEvents ? (
                      <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : d.sortedEvents.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No events recorded for this day</p>
                        <p className="text-sm mt-2">
                          Events are automatically recorded from telemetry, work orders, and crew
                          changes. You can also add manual events.
                        </p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px] pr-4">
                        <div className="space-y-4">
                          {d.sortedEvents.map((event, index) => (
                            <EventTimelineItem
                              key={event.id}
                              event={event}
                              index={index}
                              isLast={index === d.sortedEvents.length - 1}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="mt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Compass className="h-5 w-5" />
                        Daily Navigation Summary
                      </CardTitle>
                      <CardDescription>
                        Position, distance, and voyage summary for the day
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Noon Position Latitude</Label>
                          <Input
                            value={d.dailySummary.noonPositionLat || ""}
                            onChange={(e) =>
                              d.updateDailySummary("noonPositionLat", e.target.value)
                            }
                            placeholder="01° 17.5' N"
                            disabled={d.isLocked}
                            data-testid="input-noon-lat"
                          />
                        </div>
                        <div>
                          <Label>Noon Position Longitude</Label>
                          <Input
                            value={d.dailySummary.noonPositionLon || ""}
                            onChange={(e) =>
                              d.updateDailySummary("noonPositionLon", e.target.value)
                            }
                            placeholder="103° 51.2' E"
                            disabled={d.isLocked}
                            data-testid="input-noon-lon"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Distance Made (nm)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={d.dailySummary.distanceMade || ""}
                            onChange={(e) => d.updateDailySummary("distanceMade", e.target.value)}
                            placeholder="245.5"
                            disabled={d.isLocked}
                            data-testid="input-distance"
                          />
                        </div>
                        <div>
                          <Label>Distance to Go (nm)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={d.dailySummary.distanceToGo || ""}
                            onChange={(e) => d.updateDailySummary("distanceToGo", e.target.value)}
                            placeholder="1250.0"
                            disabled={d.isLocked}
                            data-testid="input-dtg"
                          />
                        </div>
                        <div>
                          <Label>Average Speed (kn)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={d.dailySummary.avgSpeed || ""}
                            onChange={(e) => d.updateDailySummary("avgSpeed", e.target.value)}
                            placeholder="12.5"
                            disabled={d.isLocked}
                            data-testid="input-avgspeed"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Fuel className="h-5 w-5" />
                        Fuel Consumption
                      </CardTitle>
                      <CardDescription>Daily fuel consumption summary</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>M/E FO (MT)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={d.dailySummary.meFoConsumption || ""}
                            onChange={(e) =>
                              d.updateDailySummary("meFoConsumption", e.target.value)
                            }
                            placeholder="15.5"
                            disabled={d.isLocked}
                            data-testid="input-me-fo"
                          />
                        </div>
                        <div>
                          <Label>A/E DO (MT)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={d.dailySummary.aeDoConsumption || ""}
                            onChange={(e) =>
                              d.updateDailySummary("aeDoConsumption", e.target.value)
                            }
                            placeholder="2.5"
                            disabled={d.isLocked}
                            data-testid="input-ae-do"
                          />
                        </div>
                        <div>
                          <Label>Boiler FO (MT)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={d.dailySummary.boilerFoConsumption || ""}
                            onChange={(e) =>
                              d.updateDailySummary("boilerFoConsumption", e.target.value)
                            }
                            placeholder="1.0"
                            disabled={d.isLocked}
                            data-testid="input-boiler-fo"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>FO ROB (MT)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={d.dailySummary.foRob || ""}
                            onChange={(e) => d.updateDailySummary("foRob", e.target.value)}
                            placeholder="850"
                            disabled={d.isLocked}
                            data-testid="input-fo-rob"
                          />
                        </div>
                        <div>
                          <Label>DO ROB (MT)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={d.dailySummary.doRob || ""}
                            onChange={(e) => d.updateDailySummary("doRob", e.target.value)}
                            placeholder="120"
                            disabled={d.isLocked}
                            data-testid="input-do-rob"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Watch Assignments
                      </CardTitle>
                      <CardDescription>Deck watch assignments for each period</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {WATCH_PERIODS.map((period) => (
                          <WatchPeriodCard
                            key={period}
                            period={period}
                            watch={d.watchAssignments.get(period) ?? {}}
                            isLocked={d.isLocked}
                            updateWatchAssignment={d.updateWatchAssignment}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Remarks
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Label>Master's Remarks</Label>
                          <Textarea
                            value={d.dailySummary.masterRemarks || ""}
                            onChange={(e) => d.updateDailySummary("masterRemarks", e.target.value)}
                            placeholder="Master's notes for the day..."
                            rows={3}
                            disabled={d.isLocked}
                            data-testid="textarea-master-remarks"
                          />
                        </div>
                        <div>
                          <Label>Chief Officer's Remarks</Label>
                          <Textarea
                            value={d.dailySummary.chiefOfficerRemarks || ""}
                            onChange={(e) =>
                              d.updateDailySummary("chiefOfficerRemarks", e.target.value)
                            }
                            placeholder="Chief Officer's notes for the day..."
                            rows={3}
                            disabled={d.isLocked}
                            data-testid="textarea-chief-remarks"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {d.deckLogComplete && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      {d.isSigned?.deckLogComplete.daily.signedByName && (
                        <div className="text-sm text-muted-foreground">
                          Signed by:{" "}
                          <span className="font-medium">
                            {d.deckLogComplete.daily.signedByName}
                          </span>
                          {d.deckLogComplete.daily.signedAt && (
                            <> at {format(new Date(d.deckLogComplete.daily.signedAt), "PPp")}</>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <PermissionGate resource="deck_logbook" action="edit">
                        {!d.isLocked && (
                          <Button
                            variant="outline"
                            onClick={() => d.saveMutation.mutate()}
                            disabled={!d.isDirty || d.saveMutation.isPending}
                            data-testid="button-save-bottom"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {d.saveMutation.isPending ? "Saving..." : "Save Changes"}
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate resource="deck_logbook" action="sign_off">
                        {!d.isSigned && !d.isLocked && (
                          <Button
                            onClick={() => d.signMutation.mutate()}
                            disabled={d.signMutation.isPending}
                            data-testid="button-sign"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            {d.signMutation.isPending ? "Signing..." : "Sign Log"}
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate resource="deck_logbook" action="edit">
                        {d.isSigned && !d.isLocked && (
                          <Button
                            variant="secondary"
                            onClick={() => d.lockMutation.mutate()}
                            disabled={d.lockMutation.isPending}
                            data-testid="button-lock"
                          >
                            <Lock className="h-4 w-4 mr-2" />
                            {d.lockMutation.isPending ? "Locking..." : "Lock Log"}
                          </Button>
                        )}
                      </PermissionGate>
                      {d.isLocked && (
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
        )}
      </div>
    </div>
  );
}
