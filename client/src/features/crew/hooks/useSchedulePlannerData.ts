import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  addDays,
  format,
  startOfWeek,
  eachDayOfInterval,
  differenceInDays,
  parseISO,
  startOfDay,
} from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  getDateRangeFromPreset,
  loadPersistedFilters,
  persistFilters,
} from "./useSchedulePlannerFilters";
import { useSchedulePlannerSync } from "./useSchedulePlannerSync";
import type {
  AiSuggestion,
  ConstraintResult,
  DateRangePreset,
  FatigueResult,
  PlannerCrewMember,
  PlannerVessel,
  ScheduleAssignment,
} from "./useSchedulePlannerDataTypes";

export type {
  AiSuggestion,
  ConstraintResult,
  DateRangePreset,
  FatigueResult,
  FatigueRiskLevel,
  PlannerCrewMember,
  PlannerVessel,
  ScheduleAssignment,
  SyncStatus,
} from "./useSchedulePlannerDataTypes";

export function useSchedulePlannerData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load persisted filters on initial mount
  const persistedFilters = useMemo(() => loadPersistedFilters(), []);

  const [dateRangeStart, setDateRangeStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>(
    persistedFilters?.preset || "2w"
  );
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(
    persistedFilters?.vesselId || null
  );
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<
    "details" | "constraints" | "suggestions" | "compliance"
  >("details");
  const {
    addPendingOperation,
    flushPendingOperations,
    pendingCount,
    setSyncStatus,
    syncStatus: computedSyncStatus,
  } = useSchedulePlannerSync();

  // Persist filters to localStorage when they change
  useEffect(() => {
    persistFilters(selectedVesselId, dateRangePreset);
  }, [selectedVesselId, dateRangePreset]);

  const dateRangeEnd = useMemo(
    () => getDateRangeFromPreset(dateRangeStart, dateRangePreset),
    [dateRangeStart, dateRangePreset]
  );

  const timelineDays = useMemo(() => {
    return eachDayOfInterval({ start: dateRangeStart, end: addDays(dateRangeEnd, -1) });
  }, [dateRangeStart, dateRangeEnd]);

  const { data: vessels = [], isLoading: isLoadingVessels } = useQuery<PlannerVessel[]>({
    queryKey: ["/api/vessels"],
  });

  const { data: schedulingSettings } = useQuery<{
    ruleThresholds: {
      maxOnboardDays: number;
      minRestHours: number;
      certExpiryWarningDays: number;
      overlapBufferHours: number;
    };
    ruleEnforcement: Record<string, "HARD" | "SOFT">;
  }>({
    queryKey: ["/api/scheduling-settings"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: crew = [], isLoading: isLoadingCrew } = useQuery<PlannerCrewMember[]>({
    queryKey: ["/api/crew"],
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery<
    ScheduleAssignment[]
  >({
    queryKey: [
      "/api/crew-extensions/assignments",
      {
        from: format(dateRangeStart, "yyyy-MM-dd"),
        to: format(dateRangeEnd, "yyyy-MM-dd"),
        vesselId: selectedVesselId,
      },
    ],
  });

  const selectedAssignment = useMemo(() => {
    if (!selectedAssignmentId) {
      return null;
    }
    return assignments.find((a) => a.id === selectedAssignmentId) || null;
  }, [selectedAssignmentId, assignments]);

  const { data: constraintViolations = [] } = useQuery<ConstraintResult[]>({
    queryKey: ["/api/crew-extensions/scheduler/constraints", selectedAssignmentId],
    enabled: !!selectedAssignmentId && isDrawerOpen,
  });

  const { data: aiSuggestions = [] } = useQuery<AiSuggestion[]>({
    queryKey: ["/api/crew-extensions/scheduler/suggestions", selectedAssignmentId],
    enabled: !!selectedAssignmentId && isDrawerOpen && drawerTab === "suggestions",
  });

  // Fetch fatigue data for crew in current assignments
  const crewIdsInAssignments = useMemo(() => {
    const ids = new Set(assignments.map((a) => a.crewId));
    return Array.from(ids);
  }, [assignments]);

  const { data: fatigueData = {} } = useQuery<Record<string, FatigueResult>>({
    queryKey: ["/api/hor/fatigue/batch", crewIdsInAssignments],
    queryFn: async () => {
      if (crewIdsInAssignments.length === 0) {
        return {};
      }

      // Fetch fatigue for each crew member in parallel
      const results = await Promise.all(
        crewIdsInAssignments.map(async (crewId) => {
          try {
            const data = await apiRequest<FatigueResult>(
              "GET",
              `/api/hor/fatigue/${crewId}?days=14`
            );
            return { crewId, data };
          } catch {
            return null;
          }
        })
      );

      // Build a map of crewId -> FatigueResult
      const fatigueMap: Record<string, FatigueResult> = {};
      for (const result of results) {
        if (result?.data) {
          fatigueMap[result.crewId] = result.data;
        }
      }
      return fatigueMap;
    },
    enabled: crewIdsInAssignments.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get fatigue for a specific crew member
  const getCrewFatigue = useCallback(
    (crewId: string): FatigueResult | undefined => {
      return fatigueData[crewId];
    },
    [fatigueData]
  );

  const filteredVessels = useMemo(() => {
    if (!selectedVesselId) {
      return vessels;
    }
    return vessels.filter((v) => v.id === selectedVesselId);
  }, [vessels, selectedVesselId]);

  const getAssignmentsForVessel = useCallback(
    (vesselId: string): ScheduleAssignment[] => {
      return assignments.filter((a) => a.vesselId === vesselId);
    },
    [assignments]
  );

  const calculateBlockPosition = useCallback(
    (assignment: ScheduleAssignment) => {
      const start = startOfDay(parseISO(assignment.startDate));
      const end = startOfDay(parseISO(assignment.endDate));
      const rangeStart = startOfDay(dateRangeStart);
      const rangeEnd = startOfDay(dateRangeEnd);

      const effectiveStart = start < rangeStart ? rangeStart : start;
      const effectiveEnd = end > rangeEnd ? rangeEnd : end;

      const startOffset = differenceInDays(effectiveStart, rangeStart);
      const duration = differenceInDays(effectiveEnd, effectiveStart) + 1;

      return {
        startOffset: Math.max(0, startOffset),
        duration: Math.max(1, duration),
        startsBeforeRange: start < rangeStart,
        endsAfterRange: end > rangeEnd,
      };
    },
    [dateRangeStart, dateRangeEnd]
  );

  const getConstraintSummary = useCallback(
    (assignment: ScheduleAssignment): { hard: number; soft: number } => {
      const constraints = assignment.constraints || [];
      return {
        hard: constraints.filter((c) => c.severity === "HARD").length,
        soft: constraints.filter((c) => c.severity === "SOFT").length,
      };
    },
    []
  );

  const navigateRange = (direction: "prev" | "next") => {
    const days = dateRangePreset === "2w" ? 14 : dateRangePreset === "1m" ? 30 : 90;
    setDateRangeStart((prev) => addDays(prev, direction === "next" ? days : -days));
  };

  const goToToday = () => {
    setDateRangeStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  // Stable so memoized rows (VesselRow) don't re-render when the planner does.
  const openAssignmentDrawer = useCallback((assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setIsDrawerOpen(true);
    setDrawerTab("details");
  }, []);

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedAssignmentId(null);
  };

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: Partial<ScheduleAssignment>) => {
      if (!navigator.onLine) {
        addPendingOperation({ type: "create", payload: data });
        return { id: `temp-${Date.now()}`, ...data };
      }
      setSyncStatus("syncing");
      return apiRequest("POST", "/api/crew-extensions/assignments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-extensions/assignments"] });
      toast({
        title: "Assignment Created",
        description: "Crew assignment has been created successfully.",
      });
      setSyncStatus("up_to_date");
    },
    onError: (_, data) => {
      if (!navigator.onLine) {
        addPendingOperation({ type: "create", payload: data });
        toast({ title: "Saved Offline", description: "Will sync when back online." });
      } else {
        toast({
          title: "Error",
          description: "Failed to create assignment.",
          variant: "destructive",
        });
        setSyncStatus("error");
      }
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ScheduleAssignment> }) => {
      if (!navigator.onLine) {
        addPendingOperation({ type: "update", payload: { id, data } });
        return { id, ...data };
      }
      setSyncStatus("syncing");
      return apiRequest("PATCH", `/api/crew-extensions/assignments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-extensions/assignments"] });
      toast({ title: "Assignment Updated", description: "Crew assignment has been updated." });
      setSyncStatus("up_to_date");
    },
    onError: (_, variables) => {
      if (!navigator.onLine) {
        addPendingOperation({ type: "update", payload: variables });
        toast({ title: "Saved Offline", description: "Will sync when back online." });
      } else {
        toast({
          title: "Error",
          description: "Failed to update assignment.",
          variant: "destructive",
        });
        setSyncStatus("error");
      }
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!navigator.onLine) {
        addPendingOperation({ type: "delete", payload: { id } });
        return { success: true };
      }
      setSyncStatus("syncing");
      return apiRequest("DELETE", `/api/crew-extensions/assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-extensions/assignments"] });
      closeDrawer();
      toast({ title: "Assignment Deleted", description: "Crew assignment has been removed." });
      setSyncStatus("up_to_date");
    },
    onError: (_, id) => {
      if (!navigator.onLine) {
        addPendingOperation({ type: "delete", payload: { id } });
        toast({ title: "Saved Offline", description: "Will sync when back online." });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete assignment.",
          variant: "destructive",
        });
        setSyncStatus("error");
      }
    },
  });

  const applySuggestionMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      suggestedCrewId,
    }: {
      assignmentId: string;
      suggestedCrewId: string;
    }) => {
      setSyncStatus("syncing");
      return apiRequest("POST", `/api/crew-extensions/scheduler/apply-suggestion`, {
        assignmentId,
        suggestedCrewId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-extensions/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crew-extensions/scheduler/suggestions"] });
      toast({ title: "Suggestion Applied", description: "Crew member has been assigned." });
      setSyncStatus("up_to_date");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply suggestion.", variant: "destructive" });
      setSyncStatus("error");
    },
  });

  const publishScheduleMutation = useMutation({
    mutationFn: async (scope: { vesselId?: string; from: string; to: string }) => {
      setSyncStatus("syncing");
      return apiRequest("POST", `/api/crew-extensions/scheduler/publish`, scope);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-extensions/assignments"] });
      toast({ title: "Schedule Published", description: "Notifications have been sent." });
      setSyncStatus("up_to_date");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to publish schedule.", variant: "destructive" });
      setSyncStatus("error");
    },
  });

  // Roster reassignment - update crew's vesselId
  const reassignCrewToVesselMutation = useMutation({
    mutationFn: async ({ crewId, vesselId }: { crewId: string; vesselId: string }) => {
      setSyncStatus("syncing");
      return apiRequest("PATCH", `/api/crew/${crewId}`, { vesselId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
      toast({
        title: "Roster Updated",
        description: "Crew member has been reassigned to the vessel.",
      });
      setSyncStatus("up_to_date");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update roster.", variant: "destructive" });
      setSyncStatus("error");
    },
  });

  const draftCount = useMemo(
    () => assignments.filter((a) => a.status === "draft").length,
    [assignments]
  );

  return {
    dateRangeStart,
    dateRangeEnd,
    dateRangePreset,
    setDateRangePreset,
    setDateRangeStart,
    timelineDays,
    vessels,
    filteredVessels,
    crew,
    assignments,
    draftCount,
    selectedVesselId,
    setSelectedVesselId,
    selectedAssignment,
    selectedAssignmentId,
    isDrawerOpen,
    drawerTab,
    setDrawerTab,
    constraintViolations,
    aiSuggestions,
    syncStatus: computedSyncStatus,
    pendingCount,
    schedulingSettings,
    isLoadingVessels,
    isLoadingCrew,
    isLoadingAssignments,
    getAssignmentsForVessel,
    calculateBlockPosition,
    getConstraintSummary,
    navigateRange,
    goToToday,
    openAssignmentDrawer,
    closeDrawer,
    createAssignmentMutation,
    updateAssignmentMutation,
    deleteAssignmentMutation,
    applySuggestionMutation,
    publishScheduleMutation,
    reassignCrewToVesselMutation,
    flushPendingOperations,
    fatigueData,
    getCrewFatigue,
  };
}
