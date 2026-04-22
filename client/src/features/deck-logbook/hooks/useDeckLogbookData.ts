import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays, subDays, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import type {
  Vessel,
  DeckLogDaily,
  DeckLogHourly,
  DeckLogWatch,
  DeckLogEvent,
} from "@shared/schema";
import {
  SEA_STATES,
  VISIBILITY_CODES,
  exportDeckToPDF,
  exportDeckToExcel,
  manualEventFormSchema,
  getEventTypeConfig,
  createDefaultManualEventFormValues,
  type ManualEventFormValues,
} from "@/features/deck-logbook";

interface DeckLogComplete {
  daily: DeckLogDaily;
  hourly: DeckLogHourly[];
  watches: DeckLogWatch[];
}

export function useDeckLogbookData() {
  const { currentOrgId: _orgId } = useOrganization();
  const { toast } = useToast();
  const _queryClient = useQueryClient();

  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [hourlyEntries, setHourlyEntries] = useState<Map<number, Partial<DeckLogHourly>>>(
    new Map()
  );
  const [dailySummary, setDailySummary] = useState<Partial<DeckLogDaily>>({});
  const [watchAssignments, setWatchAssignments] = useState<Map<string, Partial<DeckLogWatch>>>(
    new Map()
  );
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState("hourly");
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false);

  const eventForm = useForm<ManualEventFormValues>({
    resolver: zodResolver(manualEventFormSchema),
    defaultValues: createDefaultManualEventFormValues(),
  });

  const { data: vessels, isLoading: loadingVessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });
  const selectedVessel = vessels?.find((v) => v.id === selectedVesselId);

  const {
    data: deckLogComplete,
    isLoading: loadingDeckLog,
    refetch: refetchDeckLog,
  } = useQuery<DeckLogComplete | null>({
    queryKey: ["/api/logbook/deck/vessel", selectedVesselId, "date", selectedDate],
    enabled: !!selectedVesselId && !!selectedDate,
  });

  const {
    data: events,
    isLoading: loadingEvents,
    refetch: refetchEvents,
  } = useQuery<DeckLogEvent[]>({
    queryKey: ["/api/logbook/deck/daily", deckLogComplete?.daily?.id, "events"],
    enabled: !!deckLogComplete?.daily?.id,
  });

  useMemo(() => {
    if (deckLogComplete) {
      const newHourlyMap = new Map<number, Partial<DeckLogHourly>>();
      deckLogComplete.hourly.forEach((entry) => newHourlyMap.set(entry.hour, entry));
      setHourlyEntries(newHourlyMap);
      setDailySummary(deckLogComplete.daily);
      const newWatchMap = new Map<string, Partial<DeckLogWatch>>();
      deckLogComplete.watches.forEach((watch) => newWatchMap.set(watch.watchPeriod, watch));
      setWatchAssignments(newWatchMap);
      setIsDirty(false);
    }
  }, [deckLogComplete]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!deckLogComplete?.daily.id) {
        return;
      }
      await apiRequest("PATCH", `/api/logbook/deck/daily/${deckLogComplete.daily.id}`, {
        ...dailySummary,
      });
      const hourlyArray = Array.from(hourlyEntries.entries()).map(([hour, entry]) => ({
        ...entry,
        dailyLogId: deckLogComplete.daily.id,
        hour,
      }));
      if (hourlyArray.length > 0) {
        await apiRequest("PUT", "/api/logbook/deck/hourly/bulk", { entries: hourlyArray });
      }
      for (const [period, watch] of watchAssignments) {
        if (watch.officerName || watch.helmName) {
          await apiRequest("PUT", "/api/logbook/deck/watch", {
            ...watch,
            dailyLogId: deckLogComplete.daily.id,
            watchPeriod: period,
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Deck log saved", description: "All entries have been saved successfully." });
      setIsDirty(false);
      refetchDeckLog();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save deck log entries.",
        variant: "destructive",
      });
    },
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!deckLogComplete?.daily.id) {
        return;
      }
      await saveMutation.mutateAsync();
      await apiRequest("POST", `/api/logbook/deck/daily/${deckLogComplete.daily.id}/sign`, {
        signedByCrewId: "current-user",
        signedByName: "Officer of the Watch",
        signedByRank: "Chief Officer",
      });
    },
    onSuccess: () => {
      toast({ title: "Deck log signed", description: "The deck log has been officially signed." });
      refetchDeckLog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to sign deck log.", variant: "destructive" });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!deckLogComplete?.daily.id) {
        return;
      }
      await apiRequest("POST", `/api/logbook/deck/daily/${deckLogComplete.daily.id}/lock`, {
        lockedByUserName: "Current User",
      });
    },
    onSuccess: () => {
      toast({
        title: "Log locked",
        description: "The deck log has been locked and is now immutable.",
      });
      refetchDeckLog();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to lock deck log.", variant: "destructive" });
    },
  });

  const autoFillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVesselId) {
        return { filledCount: 0 };
      }
      const result = await apiRequest("POST", "/api/stormgeo/autofill-daily", {
        vesselId: selectedVesselId,
        logDate: selectedDate,
        skipExisting: true,
      });
      if (result.success && result.results) {
        const newEntries = new Map(hourlyEntries);
        let actualFillCount = 0;
        for (const [hourStr, data] of Object.entries(result.results)) {
          const hour = Number.parseInt(hourStr);
          const existingEntry = hourlyEntries.get(hour) ?? {};
          const hasManualData =
            existingEntry.windDirection ||
            existingEntry.windForce ||
            existingEntry.seaState ||
            existingEntry.barometer;
          if (hasManualData) {
            continue;
          }
          const fields = (data as { fields: Record<string, unknown> }).fields;
          const seaStateIndex = fields.seaState as number | undefined;
          const updatedEntry = {
            ...existingEntry,
            windDirection: (fields.windDirection as string) || existingEntry.windDirection,
            windForce:
              fields.windForceBeaufort === undefined
                ? existingEntry.windForce
                : String(fields.windForceBeaufort),
            seaState:
              seaStateIndex !== undefined && seaStateIndex >= 0 && seaStateIndex < SEA_STATES.length
                ? SEA_STATES[seaStateIndex]
                : existingEntry.seaState,
            barometer: (fields.barometer as number) || existingEntry.barometer,
            airTemp: (fields.airTemperature as number) || existingEntry.airTemp,
            seaTemp: (fields.seaTemperature as number) || existingEntry.seaTemp,
            visibility:
              fields.visibility === undefined
                ? existingEntry.visibility
                : VISIBILITY_CODES.find((v) => v.includes(String(fields.visibility))) ||
                  existingEntry.visibility,
          };
          newEntries.set(hour, updatedEntry);
          actualFillCount++;
        }

        if (actualFillCount > 0) {
          setHourlyEntries(newEntries);
          setIsDirty(true);
        }
        return { filledCount: actualFillCount };
      }
      return { filledCount: 0 };
    },
    onSuccess: (data) => {
      if (data?.filledCount > 0) {
        toast({
          title: "Weather data filled",
          description: `Filled ${data.filledCount} hours with weather data from StormGeo.`,
        });
      } else {
        toast({
          title: "No data available",
          description: "No StormGeo weather data found for this date.",
          variant: "default",
        });
      }
    },
    onError: () => {
      toast({
        title: "Auto-fill failed",
        description: "Could not retrieve weather data.",
        variant: "destructive",
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: ManualEventFormValues) => {
      if (!deckLogComplete?.daily?.id || !selectedVesselId) {
        return;
      }
      await apiRequest("POST", `/api/logbook/deck/events`, {
        vesselId: selectedVesselId,
        dayId: deckLogComplete.daily.id,
        eventType: data.eventType,
        source: "manual",
        summary: data.summary,
        details: data.details || undefined,
        positionLat: data.positionLat,
        positionLon: data.positionLon,
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

  const onSubmitEvent = (data: ManualEventFormValues) => createEventMutation.mutate(data);
  const normalizeEventsForExport = (evts: typeof events) =>
    evts
      ? evts.map((e) => ({
          ...e,
          positionLat: e.positionLat ?? (e as unknown as { latitude?: number }).latitude,
          positionLon: e.positionLon ?? (e as unknown as { longitude?: number }).longitude,
        }))
      : [];

  const exportToPDFHandler = async () => {
    if (!selectedVessel || !deckLogComplete) {
      toast({
        title: "No data",
        description: "Please select a vessel and date first.",
        variant: "destructive",
      });
      return;
    }
    try {
      exportDeckToPDF({
        vesselName: selectedVessel.name,
        date: selectedDate,
        dailySummary,
        hourlyEntries,
        watchAssignments,
        events: normalizeEventsForExport(events),
        daily: deckLogComplete.daily,
        getEventTypeConfig,
      });
      toast({
        title: "PDF exported",
        description: "Complete deck log has been downloaded as PDF.",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not export to PDF.",
        variant: "destructive",
      });
    }
  };

  const exportToExcelHandler = () => {
    if (!selectedVessel || !deckLogComplete) {
      toast({
        title: "No data",
        description: "Please select a vessel and date first.",
        variant: "destructive",
      });
      return;
    }
    try {
      exportDeckToExcel({
        vesselName: selectedVessel.name,
        date: selectedDate,
        dailySummary,
        hourlyEntries,
        watchAssignments,
        events: normalizeEventsForExport(events),
        daily: deckLogComplete.daily,
        getEventTypeConfig,
      });
      toast({
        title: "Excel exported",
        description: "Complete deck log has been downloaded as Excel workbook.",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not export to Excel.",
        variant: "destructive",
      });
    }
  };

  const updateHourlyEntry = (hour: number, field: string, value: string | number) => {
    setHourlyEntries((prev) => {
      const newMap = new Map(prev);
      newMap.set(hour, { ...newMap.get(hour), [field]: value });
      return newMap;
    });
    setIsDirty(true);
  };
  const updateDailySummary = (field: string, value: string | number) => {
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
  const navigateDate = (direction: "prev" | "next") => {
    const current = parseISO(selectedDate);
    setSelectedDate(
      format(direction === "prev" ? subDays(current, 1) : addDays(current, 1), "yyyy-MM-dd")
    );
  };

  const isLocked = deckLogComplete?.daily?.lockedAt != null;
  const isSigned = deckLogComplete?.daily?.status === "signed";
  const sortedEvents = useMemo(
    () =>
      events
        ? [...events].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        : [],
    [events]
  );

  return {
    orgId: _orgId,
    selectedVesselId,
    setSelectedVesselId,
    selectedDate,
    setSelectedDate,
    hourlyEntries,
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
    deckLogComplete,
    loadingDeckLog,
    refetchDeckLog,
    events,
    loadingEvents,
    refetchEvents,
    sortedEvents,
    saveMutation,
    signMutation,
    lockMutation,
    autoFillMutation,
    createEventMutation,
    onSubmitEvent,
    exportToPDFHandler,
    exportToExcelHandler,
    updateHourlyEntry,
    updateDailySummary,
    updateWatchAssignment,
    navigateDate,
    isLocked,
    isSigned,
  };
}

export type DeckLogbookHookReturn = ReturnType<typeof useDeckLogbookData>;
