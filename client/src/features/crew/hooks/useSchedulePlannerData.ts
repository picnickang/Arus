import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  addDays,
  addWeeks,
  addMonths,
  format,
  startOfWeek,
  eachDayOfInterval,
  differenceInDays,
  parseISO,
  startOfDay,
} from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Pending operation for offline-first sync
interface PendingOperation {
  id: string;
  type: "create" | "update" | "delete";
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

export interface ScheduleAssignment {
  id: string;
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName: string;
  startDate: string;
  endDate: string;
  role: string;
  status: "draft" | "confirmed" | "published";
  shiftPattern?: string;
  notes?: string;
  constraints?: ConstraintResult[];
  source?: "manual" | "generator" | null;
  generatedByRunId?: string | null;
}

export interface PlannerCrewMember {
  id: string;
  name: string;
  rank: string;
  vesselId?: string;
  skills: string[];
  active: boolean;
  certifications?: string[];
  onLeave?: boolean;
  leaveStart?: string;
  leaveEnd?: string;
  availability?: "available" | "on_duty" | "leave" | "pending";
}

export interface PlannerVessel {
  id: string;
  name: string;
  type?: string;
  crewRequirements?: { role: string; count: number }[];
}

export interface ConstraintResult {
  severity: "HARD" | "SOFT";
  code: string;
  message: string;
  affectedIds?: { crewId?: string; assignmentId?: string; vesselId?: string };
}

export interface AiSuggestion {
  id: string;
  suggestedCrewId: string;
  suggestedCrewName: string;
  suggestedCrewRank?: string;
  reason: string;
  score: number;
  constraints: string[];
  availability?: "available" | "on_duty" | "leave";
  certStatus?: "valid" | "expiring" | "expired";
  badgeCode?: string;
}

export type FatigueRiskLevel = "low" | "medium" | "high" | "critical";

export interface FatigueResult {
  crewId: string;
  crewName: string;
  riskLevel: FatigueRiskLevel;
  score: number;
  metrics: {
    sleepDebt24h: number;
    sleepDebt7d: number;
    consecutiveNightShifts: number;
    timeSinceLastFullRest: number;
    nightWorkRatio: number;
    avgRestPer24h: number;
    avgRestPer7d: number;
  };
  factors: string[];
  recommendations: string[];
}

export type DateRangePreset = "2w" | "1m" | "3m";
export type SyncStatus = "up_to_date" | "syncing" | "offline" | "error";

function getDateRangeFromPreset(start: Date, preset: DateRangePreset): Date {
  switch (preset) {
    case "2w":
      return addWeeks(start, 2);
    case "1m":
      return addMonths(start, 1);
    case "3m":
      return addMonths(start, 3);
    default:
      return addWeeks(start, 2);
  }
}

const STORAGE_KEY = "arus-schedule-planner-filters";

function loadPersistedFilters(): { vesselId: string | null; preset: DateRangePreset } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return {
          vesselId: parsed.vesselId || null,
          preset: ["2w", "1m", "3m"].includes(parsed.preset) ? parsed.preset : "2w",
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function persistFilters(vesselId: string | null, preset: DateRangePreset) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ vesselId, preset }));
  } catch {
    // Ignore storage errors
  }
}

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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("up_to_date");
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist filters to localStorage when they change
  useEffect(() => {
    persistFilters(selectedVesselId, dateRangePreset);
  }, [selectedVesselId, dateRangePreset]);

  // Compute sync status from pending operations and network state
  const computedSyncStatus = useMemo((): SyncStatus => {
    if (!navigator.onLine) {
      return "offline";
    }
    if (pendingOperations.length > 0) {
      return "syncing";
    }
    return syncStatus;
  }, [syncStatus, pendingOperations.length]);

  // Track pending operations count for display
  const pendingCount = pendingOperations.length;

  // Flush pending operations when coming online
  useEffect(() => {
    const handleOnline = () => {
      if (pendingOperations.length > 0) {
        setSyncStatus("syncing");
        // Trigger re-sync of pending operations
        flushPendingOperations();
      } else {
        setSyncStatus("up_to_date");
      }
    };
    const handleOffline = () => setSyncStatus("offline");

    if (!navigator.onLine) {
      setSyncStatus("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [pendingOperations.length]);

  // Add operation to pending queue
  const addPendingOperation = useCallback(
    (op: Omit<PendingOperation, "id" | "timestamp" | "retryCount">) => {
      const newOp: PendingOperation = {
        ...op,
        id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };
      setPendingOperations((prev) => [...prev, newOp]);
      return newOp.id;
    },
    []
  );

  // Remove operation from pending queue
  const removePendingOperation = useCallback((opId: string) => {
    setPendingOperations((prev) => prev.filter((op) => op.id !== opId));
  }, []);

  // Flush pending operations (called when coming back online)
  const flushPendingOperations = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }

    // Copy current operations to flush and clear the queue atomically
    let operationsToFlush: PendingOperation[] = [];
    setPendingOperations((prev) => {
      operationsToFlush = [...prev];
      return [];
    });

    if (operationsToFlush.length === 0) {
      return;
    }

    const failedOps: PendingOperation[] = [];

    for (const op of operationsToFlush) {
      try {
        if (op.type === "create") {
          await apiRequest("/api/crew-extensions/assignments", {
            method: "POST",
            body: JSON.stringify(op.payload),
          });
        } else if (op.type === "update") {
          await apiRequest(`/api/crew-extensions/assignments/${op.payload.id}`, {
            method: "PATCH",
            body: JSON.stringify(op.payload.data),
          });
        } else if (op.type === "delete") {
          await apiRequest(`/api/crew-extensions/assignments/${op.payload.id}`, {
            method: "DELETE",
          });
        }
      } catch (error) {
        // Increment retry count, max 3 retries
        if (op.retryCount < 3) {
          failedOps.push({ ...op, retryCount: op.retryCount + 1 });
        } else {
          toast({
            title: "Sync Failed",
            description: "Some changes could not be saved. Please try again.",
            variant: "destructive",
          });
        }
      }
    }

    // Re-add failed ops back to queue
    if (failedOps.length > 0) {
      setPendingOperations((prev) => [...prev, ...failedOps]);
    }

    // Invalidate queries and update status
    queryClient.invalidateQueries({ queryKey: ["/api/crew-extensions/assignments"] });

    // Check final state after all operations
    setPendingOperations((prev) => {
      if (prev.length === 0) {
        setSyncStatus("up_to_date");
      }
      return prev;
    });
  }, [queryClient, toast]);

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
            const response = await fetch(`/api/hor/fatigue/${crewId}?days=14`);
            if (!response.ok) {
              return null;
            }
            const data = await response.json();
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

  const openAssignmentDrawer = (assignmentId: string) => {
    setSelectedAssignmentId(assignmentId);
    setIsDrawerOpen(true);
    setDrawerTab("details");
  };

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
