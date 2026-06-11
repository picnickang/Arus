import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays, subDays, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import type { Vessel } from "@shared/schema";
import {
  type EngineLogDaily,
  type EngineLogHourly,
  type EngineLogGenerator,
  type EngineLogWatch,
  type EngineLogEvent,
  type ManualEngineEventFormValues,
  normalizeHourlyEntry,
  exportEngineToPDF,
  exportEngineToExcel,
  manualEngineEventFormSchema,
  createDefaultManualEventFormValues,
} from "@/features/engine-logbook";

interface EngineLogComplete {
  daily: EngineLogDaily;
  hourly: EngineLogHourly[];
  generators: EngineLogGenerator[];
  watches: EngineLogWatch[];
}
interface AutoFillResult {
  mainEngine: { hoursProcessed: number; totalFieldsPopulated: number; totalAnomalies: number };
  generators: { anomalies: number };
}
interface NotifyResult {
  message: string;
  sent: number;
  total: number;
  logs?: Array<{ vesselId: string; vesselName: string; logDate: string }>;
  errors?: string[];
}

export function useEngineLogbookData() {
  const { currentOrgId: orgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [hourlyEntries, setHourlyEntries] = useState<Map<number, Partial<EngineLogHourly>>>(
    new Map()
  );
  const [generatorEntries, setGeneratorEntries] = useState<
    Map<string, Partial<EngineLogGenerator>>
  >(new Map());
  const [dailySummary, setDailySummary] = useState<Partial<EngineLogDaily>>({});
  const [watchAssignments, setWatchAssignments] = useState<Map<string, Partial<EngineLogWatch>>>(
    new Map()
  );
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("hourly");
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false);

  const eventForm = useForm<ManualEngineEventFormValues, unknown, ManualEngineEventFormValues>({
    resolver: zodResolver(manualEngineEventFormSchema),
    defaultValues: createDefaultManualEventFormValues(),
  });

  const { data: vessels, isLoading: loadingVessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
    enabled: !!orgId,
  });
  const selectedVessel = useMemo(
    () => vessels?.find((v) => v.id === selectedVesselId),
    [vessels, selectedVesselId]
  );

  const {
    data: engineLogComplete,
    isLoading: loadingEngineLog,
    refetch: refetchEngineLog,
  } = useQuery<EngineLogComplete | null>({
    queryKey: ["/api/logbook/engine/vessel", selectedVesselId, "date", selectedDate],
    enabled: !!selectedVesselId && !!selectedDate,
  });

  const {
    data: events,
    isLoading: loadingEvents,
    refetch: refetchEvents,
  } = useQuery<EngineLogEvent[]>({
    queryKey: ["/api/logbook/engine/daily", engineLogComplete?.daily?.id, "events"],
    enabled: !!engineLogComplete?.daily?.id,
  });

  useEffect(() => {
    if (engineLogComplete) {
      const newHourlyMap = new Map<number, Partial<EngineLogHourly>>();
      engineLogComplete.hourly.forEach((entry) =>
        newHourlyMap.set(
          entry.hour,
          normalizeHourlyEntry(entry as object as Parameters<typeof normalizeHourlyEntry>[0])
        )
      );
      setHourlyEntries(newHourlyMap);
      setDailySummary({ ...engineLogComplete.daily });
      const newGenMap = new Map<string, Partial<EngineLogGenerator>>();
      engineLogComplete.generators.forEach((gen) =>
        newGenMap.set(`${gen.generatorNumber}-${gen.hour}`, { ...gen })
      );
      setGeneratorEntries(newGenMap);
      const newWatchMap = new Map<string, Partial<EngineLogWatch>>();
      engineLogComplete.watches.forEach((watch) =>
        newWatchMap.set(watch.watchPeriod, { ...watch })
      );
      setWatchAssignments(newWatchMap);
      setIsDirty(false);
    }
  }, [engineLogComplete]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!engineLogComplete?.daily.id) {
        return;
      }
      await apiRequest("PATCH", `/api/logbook/engine/daily/${engineLogComplete.daily.id}`, {
        ...dailySummary,
      });
      const hourlyArray = Array.from(hourlyEntries.entries()).map(([hour, entry]) => ({
        ...entry,
        dailyLogId: engineLogComplete.daily.id,
        hour,
      }));
      if (hourlyArray.length > 0) {
        await apiRequest("PUT", "/api/logbook/engine/hourly/bulk", { entries: hourlyArray });
      }
      const genArray = Array.from(generatorEntries.entries()).map(([key, entry]) => {
        const [genNum, hour] = key.split("-").map(Number);
        return { ...entry, dailyLogId: engineLogComplete.daily.id, generatorNumber: genNum, hour };
      });
      if (genArray.length > 0) {
        await apiRequest("PUT", "/api/logbook/engine/generator/bulk", { entries: genArray });
      }
      for (const [period, watch] of watchAssignments) {
        if (watch.chiefEngineerName || watch.secondEngineerName) {
          await apiRequest("PUT", "/api/logbook/engine/watch", {
            ...watch,
            dailyLogId: engineLogComplete.daily.id,
            watchPeriod: period,
          });
        }
      }
    },
    onSuccess: () => {
      toast({
        title: "Engine log saved",
        description: "All entries have been saved successfully.",
      });
      setIsDirty(false);
      refetchEngineLog();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save engine log entries.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    },
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!engineLogComplete?.daily.id) {
        return;
      }
      await saveMutation.mutateAsync();
      await apiRequest("POST", `/api/logbook/engine/daily/${engineLogComplete.daily.id}/sign`, {
        signedByCrewId: "current-user",
        signedByName: "Chief Engineer",
        signedByRank: "Chief Engineer",
      });
    },
    onSuccess: () => {
      toast({
        title: "Engine log signed",
        description: "The engine log has been officially signed.",
      });
      refetchEngineLog();
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to sign engine log.", variant: "destructive" });
      console.error("Sign error:", error);
    },
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!engineLogComplete?.daily.id) {
        return;
      }
      await apiRequest("POST", `/api/logbook/engine/daily/${engineLogComplete.daily.id}/lock`, {
        lockedByUserId: "current-user",
        lockedByUserName: "Current User",
      });
    },
    onSuccess: () => {
      toast({
        title: "Log locked",
        description: "The engine log has been locked and is now immutable.",
      });
      refetchEngineLog();
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to lock engine log.", variant: "destructive" });
      console.error("Lock error:", error);
    },
  });

  const autoFillMutation = useMutation({
    mutationFn: async (): Promise<AutoFillResult> => {
      if (!selectedVesselId || !selectedDate) {
        throw new Error("Vessel and date required");
      }
      return await apiRequest("POST", "/api/logbook/engine/autofill", {
        vesselId: selectedVesselId,
        logDate: selectedDate,
        overwriteManual: false,
      });
    },
    onSuccess: (result) => {
      const { mainEngine, generators } = result;
      const totalFields = mainEngine.totalFieldsPopulated,
        totalAnomalies = mainEngine.totalAnomalies + generators.anomalies;
      if (totalFields === 0) {
        toast({
          title: "No telemetry data",
          description: "No telemetry data found for this date.",
          variant: "default",
        });
      } else {
        toast({
          title: "Auto-fill complete",
          description: `Populated ${totalFields} fields from ${mainEngine.hoursProcessed} hours of telemetry.${totalAnomalies > 0 ? ` Found ${totalAnomalies} anomalies.` : ""}`,
        });
      }
      queryClient.invalidateQueries({
        queryKey: ["/api/logbook/engine/vessel", selectedVesselId, "date", selectedDate],
      });
      refetchEngineLog();
    },
    onError: () => {
      toast({
        title: "Auto-fill failed",
        description: "Could not auto-fill from telemetry data.",
        variant: "destructive",
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: ManualEngineEventFormValues) => {
      if (!engineLogComplete?.daily?.id || !selectedVesselId) {
        return;
      }
      await apiRequest("POST", `/api/logbook/engine/events`, {
        vesselId: selectedVesselId,
        dayId: engineLogComplete.daily.id,
        eventType: data.eventType,
        source: "manual",
        summary: data.summary,
        details: data.details || undefined,
        equipmentId: data.equipmentId || undefined,
        meRpm: data.meRpm,
        meLoad: data.meLoad,
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast({ title: "Event created", description: "The event has been added to the timeline." });
      setNewEventDialogOpen(false);
      eventForm.reset();
      refetchEvents();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create event.", variant: "destructive" });
    },
  });

  const notifyUnsignedMutation = useMutation({
    mutationFn: async (): Promise<NotifyResult> =>
      await apiRequest("POST", "/api/logbook/engine/notify-unsigned", {
        vesselId: selectedVesselId || undefined,
        daysBack: 7,
      }),
    onSuccess: (result) => {
      toast({
        title: result.sent === 0 && result.total === 0 ? "No unsigned logs" : "Notifications sent",
        description:
          result.sent === 0 && result.total === 0 ? "All engine logs are signed." : result.message,
      });
    },
    onError: () => {
      toast({
        title: "Notification failed",
        description: "Could not send notifications.",
        variant: "destructive",
      });
    },
  });

  const onSubmitEvent = (data: ManualEngineEventFormValues) => createEventMutation.mutate(data);

  const exportToPDFHandler = async () => {
    if (!selectedVessel || !engineLogComplete) {
      toast({
        title: "No data",
        description: "Please select a vessel and date first.",
        variant: "destructive",
      });
      return;
    }
    try {
      await exportEngineToPDF({
        vesselName: selectedVessel.name,
        date: selectedDate,
        dailySummary,
        hourlyEntries,
      });
      toast({ title: "PDF exported", description: "Engine log exported to PDF successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to export PDF.", variant: "destructive" });
    }
  };

  const exportToExcelHandler = async () => {
    if (!selectedVessel || !engineLogComplete) {
      toast({
        title: "No data",
        description: "Please select a vessel and date first.",
        variant: "destructive",
      });
      return;
    }
    try {
      await exportEngineToExcel({
        vesselName: selectedVessel.name,
        date: selectedDate,
        dailySummary,
        hourlyEntries,
        generatorEntries,
      });
      toast({ title: "Excel exported", description: "Engine log exported to Excel successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to export Excel.", variant: "destructive" });
    }
  };

  const updateHourlyEntry = (
    hour: number,
    field: string,
    value: string | number | boolean | null | undefined
  ) => {
    setHourlyEntries((prev) => {
      const newMap = new Map(prev);
      newMap.set(hour, { ...newMap.get(hour), [field]: value });
      return newMap;
    });
    setIsDirty(true);
  };
  const updateGeneratorEntry = (
    genNum: number,
    hour: number,
    field: string,
    value: string | number | boolean | null | undefined
  ) => {
    const key = `${genNum}-${hour}`;
    setGeneratorEntries((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, { ...newMap.get(key), [field]: value });
      return newMap;
    });
    setIsDirty(true);
  };
  const updateDailySummary = (
    field: string,
    value: string | number | boolean | null | undefined
  ) => {
    setDailySummary((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };
  const updateWatchAssignment = (period: string, field: string, value: string) => {
    setWatchAssignments((prev) => {
      const newMap = new Map(prev);
      newMap.set(period, { ...newMap.get(period), [field]: value });
      return newMap;
    });
    setIsDirty(true);
  };

  const goToPreviousDay = () =>
    setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"));
  const goToNextDay = () =>
    setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"));

  const isLocked = engineLogComplete?.daily?.status === "locked";
  const isSigned = !!engineLogComplete?.daily?.signedAt;

  return {
    orgId,
    selectedVesselId,
    setSelectedVesselId,
    selectedDate,
    setSelectedDate,
    hourlyEntries,
    generatorEntries,
    dailySummary,
    watchAssignments,
    isDirty,
    activeTab,
    setActiveTab,
    newEventDialogOpen,
    setNewEventDialogOpen,
    eventForm,
    vessels,
    loadingVessels,
    selectedVessel,
    engineLogComplete,
    loadingEngineLog,
    refetchEngineLog,
    events,
    loadingEvents,
    refetchEvents,
    saveMutation,
    signMutation,
    lockMutation,
    autoFillMutation,
    createEventMutation,
    notifyUnsignedMutation,
    onSubmitEvent,
    exportToPDFHandler,
    exportToExcelHandler,
    updateHourlyEntry,
    updateGeneratorEntry,
    updateDailySummary,
    updateWatchAssignment,
    goToPreviousDay,
    goToNextDay,
    isLocked,
    isSigned,
  };
}
export type EngineLogbookHookReturn = ReturnType<typeof useEngineLogbookData>;
