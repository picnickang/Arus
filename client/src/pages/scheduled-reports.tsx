import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calendar, Mail, FileText, Clock, Play, Trash2, Eye, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/navigation";
import type { ReportSchedule } from "@shared/schema/scheduled-reports";

const REPORT_TYPES = [
  { id: "fleet_health", name: "Fleet Health Summary" },
  { id: "maintenance_due", name: "Maintenance Due Report" },
  { id: "inventory_status", name: "Inventory Status Report" },
  { id: "crew_compliance", name: "Crew Compliance Report" },
  { id: "cost_summary", name: "Cost Summary Report" },
] as const;

const FREQUENCIES = [
  { id: "daily", name: "Daily", cron: "0 8 * * *" },
  { id: "weekly", name: "Weekly", cron: "0 8 * * 1" },
  { id: "monthly", name: "Monthly", cron: "0 8 1 * *" },
] as const;

const FORMATS = [
  { id: "pdf", name: "PDF" },
  { id: "csv", name: "CSV" },
  { id: "json", name: "JSON" },
] as const;

const createScheduleFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  reportType: z.enum([
    "fleet_health",
    "maintenance_due",
    "inventory_status",
    "crew_compliance",
    "cost_summary",
  ]),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  format: z.enum(["pdf", "csv", "json"]),
  recipients: z.string().min(1, "At least one recipient is required"),
  enabled: z.boolean(),
});

type CreateScheduleForm = z.infer<typeof createScheduleFormSchema>;

function PreviewModal({ scheduleId, reportType }: { scheduleId: string; reportType: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/scheduled-reports/schedules/${scheduleId}/preview`);
    },
    onError: () => {
      toast({
        title: "Preview unavailable",
        description: "Failed to generate report preview.",
        variant: "destructive",
      });
    },
  });

  const handleOpen = () => {
    setIsOpen(true);
    previewMutation.mutate();
  };

  const getReportTypeName = (id: string) => REPORT_TYPES.find((t) => t.id === id)?.name || id;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleOpen}
        data-testid={`button-preview-${scheduleId}`}
      >
        <Eye className="w-3 h-3 mr-1" />
        Preview
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Report Preview</DialogTitle>
            <DialogDescription>{getReportTypeName(reportType)}</DialogDescription>
          </DialogHeader>
          {previewMutation.isPending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Generating preview...</span>
            </div>
          ) : previewMutation.isError ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Preview could not be generated.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => previewMutation.mutate()}
                data-testid="button-retry-preview"
              >
                Retry
              </Button>
            </div>
          ) : previewMutation.isSuccess ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-1" data-testid="preview-content">
                <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(previewMutation.data, null, 2)}
                </pre>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ScheduledReports() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const pollingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    return () => {
      pollingTimersRef.current.forEach((timer) => clearInterval(timer));
      pollingTimersRef.current.clear();
    };
  }, []);

  const form = useForm<CreateScheduleForm>({
    resolver: zodResolver(createScheduleFormSchema),
    defaultValues: {
      name: "",
      reportType: "fleet_health",
      frequency: "weekly",
      format: "pdf",
      recipients: "",
      enabled: true,
    },
  });

  const { data: schedulesResponse, isLoading } = useQuery<{ data: ReportSchedule[] }>({
    queryKey: ["/api/scheduled-reports/schedules"],
  });

  const schedules = schedulesResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: CreateScheduleForm) => {
      const cronExpr = FREQUENCIES.find((f) => f.id === data.frequency)?.cron || "0 8 * * *";
      const recipientList = data.recipients
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);

      return apiRequest("POST", "/api/scheduled-reports/schedules", {
        name: data.name,
        reportType: data.reportType,
        frequency: data.frequency,
        cronExpression: cronExpr,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        format: data.format,
        recipients: recipientList,
        vesselIds: null,
        enabled: data.enabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports/schedules"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Schedule created", description: "Your report schedule has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create schedule.", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/scheduled-reports/schedules/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports/schedules"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports/schedules"] });
      toast({
        title: "Toggle failed",
        description: "Could not update schedule status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const pollForCompletion = useCallback(
    (scheduleId: string, initialLastRunAt: string | null) => {
      const existingTimer = pollingTimersRef.current.get(scheduleId);
      if (existingTimer) {
        clearInterval(existingTimer);
      }

      let elapsed = 0;
      const interval = 5000;
      const maxWait = 120000;

      const timer = setInterval(async () => {
        elapsed += interval;
        if (elapsed >= maxWait) {
          clearInterval(timer);
          pollingTimersRef.current.delete(scheduleId);
          return;
        }
        try {
          await queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports/schedules"] });
          const fresh = queryClient.getQueryData<{ data: ReportSchedule[] }>([
            "/api/scheduled-reports/schedules",
          ]);
          const updated = fresh?.data?.find((s) => s.id === scheduleId);
          if (updated?.lastRunAt && (updated.lastRunAt as any) !== initialLastRunAt) {
            clearInterval(timer);
            pollingTimersRef.current.delete(scheduleId);
            toast({
              title: "Report ready",
              description: `"${updated.name}" has finished generating.`,
            });
          }
        } catch {
          // polling error, will retry
        }
      }, interval);

      pollingTimersRef.current.set(scheduleId, timer);
    },
    [toast]
  );

  const runNowMutation = useMutation({
    mutationFn: async (schedule: { id: string; lastRunAt: string | null }) => {
      await apiRequest("POST", `/api/scheduled-reports/schedules/${schedule.id}/run`);
      return schedule;
    },
    onSuccess: (schedule) => {
      toast({ title: "Report generating", description: "Your report is being generated." });
      pollForCompletion(schedule.id, schedule.lastRunAt);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run report.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/scheduled-reports/schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-reports/schedules"] });
      toast({ title: "Schedule deleted", description: "Your report schedule has been deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete schedule.", variant: "destructive" });
    },
  });

  const handleSubmit = (data: CreateScheduleForm) => {
    createMutation.mutate(data);
  };

  const getReportTypeName = (id: string) => {
    return REPORT_TYPES.find((t) => t.id === id)?.name || id;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) {
      return "Never";
    }
    return new Date(date).toLocaleString();
  };

  return (
    <div className="container mx-auto" data-testid="page-scheduled-reports">
      <PageHeader title="Scheduled Reports" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-muted-foreground">Automate report generation and delivery</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-schedule">
                <Plus className="w-4 h-4 mr-2" />
                New Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Report Schedule</DialogTitle>
                <DialogDescription>
                  Set up automated report generation and delivery.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-schedule-name"
                            placeholder="Weekly Fleet Health Report"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reportType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Report Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-report-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REPORT_TYPES.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-frequency">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {FREQUENCIES.map((freq) => (
                                <SelectItem key={freq.id} value={freq.id}>
                                  {freq.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="format"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Format</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-format">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {FORMATS.map((fmt) => (
                                <SelectItem key={fmt.id} value={fmt.id}>
                                  {fmt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="recipients"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipients (comma-separated emails)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-recipients"
                            placeholder="admin@company.com, ops@company.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      data-testid="button-submit-schedule"
                    >
                      {createMutation.isPending ? "Creating..." : "Create Schedule"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No scheduled reports</h3>
              <p className="text-muted-foreground mb-4">
                Create your first automated report schedule.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first">
                <Plus className="w-4 h-4 mr-2" />
                Create Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {schedules.map((schedule) => (
              <Card key={schedule.id} data-testid={`card-schedule-${schedule.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle
                        className="text-base truncate"
                        data-testid={`text-schedule-name-${schedule.id}`}
                      >
                        {schedule.name}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {getReportTypeName(schedule.reportType)}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: schedule.id, enabled: checked })
                      }
                      data-testid={`switch-enabled-${schedule.id}`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      <Clock className="w-3 h-3 mr-1" />
                      {schedule.frequency}
                    </Badge>
                    <Badge variant="outline">
                      <FileText className="w-3 h-3 mr-1" />
                      {schedule.format.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">
                      <Mail className="w-3 h-3 mr-1" />
                      {schedule.recipients?.length || 0}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Last run: {formatDate(schedule.lastRunAt)}</p>
                    <p>Next run: {formatDate(schedule.nextRunAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        runNowMutation.mutate({ id: schedule.id, lastRunAt: schedule.lastRunAt as any })
                      }
                      disabled={runNowMutation.isPending}
                      data-testid={`button-run-${schedule.id}`}
                    >
                      {runNowMutation.isPending ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3 mr-1" />
                      )}
                      Run Now
                    </Button>
                    <PreviewModal scheduleId={schedule.id} reportType={schedule.reportType} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-delete-${schedule.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove "{schedule.name}" and stop all future
                            report deliveries. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(schedule.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-${schedule.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
