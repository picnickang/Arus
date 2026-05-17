import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useCustomMutation,
} from "@/hooks/useCrudMutations";
import { useCrewList, useShiftTemplates } from "@/features/crew";
import { useVessels } from "@/features/vessels";
import type { SelectShiftTemplate } from "@shared/schema";
import {
  type SchedulePlanResponse,
  type EnhancedSchedulePlanResponse,
  type SchedulingPreferences,
  type ShiftFormData,
  DEFAULT_SCHEDULING_PREFERENCES,
  generateDayRange,
  parseEnhancedScheduleResponse,
  calculateCoverage,
  saveProposedRowsToStorage,
  getShiftTimeRange,
  shiftFormSchema,
  createDefaultShiftFormValues,
  createDefaultPortCall,
  createDefaultDrydock,
} from "@/features/crew";

interface Crew {
  id: string;
  name: string;
  rank: string;
  vesselId?: string;
  maxHours7d: number;
  minRestH: number;
  active: boolean;
  skills: string[];
}
interface PortCall {
  id: string;
  vesselId: string;
  port: string;
  start: string;
  end: string;
  crewRequired: number;
}
interface DrydockWindow {
  id: string;
  vesselId: string;
  description: string;
  start: string;
  end: string;
  crewRequired: number;
}
interface CrewCertification {
  id: string;
  crewId: string;
  cert: string;
  expiresAt: string;
  issuedBy?: string;
}
interface VesselData {
  id: string;
  name: string;
}
interface LeaveData {
  id: string;
  crewId: string;
  start: string;
  end: string;
  type: string;
}
interface SchedulePlanPayload {
  days: string[];
  shifts: SelectShiftTemplate[];
  crew: Crew[];
  leaves: LeaveData[];
  existing: unknown[];
}
interface EnhancedSchedulePayload {
  engine: string;
  days: string[];
  shifts: SelectShiftTemplate[];
  crew: Crew[];
  leaves: LeaveData[];
  portCalls: PortCall[];
  drydocks: DrydockWindow[];
  certifications: Record<string, CrewCertification[]>;
  preferences: SchedulingPreferences;
  validate_stcw: boolean;
}

export interface UseShiftPlanningReturn {
  selectedDays: string[];
  setSelectedDays: (days: string[]) => void;
  selectDayRange: (days: number) => void;
  scheduleResult: SchedulePlanResponse | null;
  enhancedScheduleResult: EnhancedSchedulePlanResponse | null;
  isEnhancedDetailsOpen: boolean;
  setIsEnhancedDetailsOpen: (open: boolean) => void;
  isBasicDetailsOpen: boolean;
  setIsBasicDetailsOpen: (open: boolean) => void;
  selectedEngine: string;
  setSelectedEngine: (engine: string) => void;
  filterVessel: string;
  setFilterVessel: (vessel: string) => void;
  filterCrew: string;
  setFilterCrew: (crew: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showConstraints: boolean;
  setShowConstraints: (show: boolean) => void;
  validateSTCW: boolean;
  setValidateSTCW: (validate: boolean) => void;
  portCalls: PortCall[];
  drydockWindows: DrydockWindow[];
  newPortCall: ReturnType<typeof createDefaultPortCall>;
  setNewPortCall: (pc: ReturnType<typeof createDefaultPortCall>) => void;
  newDrydock: ReturnType<typeof createDefaultDrydock>;
  setNewDrydock: (dd: ReturnType<typeof createDefaultDrydock>) => void;
  preferences: SchedulingPreferences;
  setPreferences: (prefs: SchedulingPreferences) => void;
  editingShiftId: string | null;
  setEditingShiftId: (id: string | null) => void;
  isShiftDialogOpen: boolean;
  setIsShiftDialogOpen: (open: boolean) => void;
  shiftForm: ReturnType<typeof useForm<ShiftFormData>>;
  crew: Crew[];
  isLoadingCrew: boolean;
  shiftTemplates: SelectShiftTemplate[];
  isLoadingShifts: boolean;
  vessels: VesselData[];
  allPortCalls: PortCall[];
  allDrydockWindows: DrydockWindow[];
  certifications: CrewCertification[];
  leaves: LeaveData[];
  isLoadingLeaves: boolean;
  createShiftMutation: ReturnType<typeof useCreateMutation>;
  updateShiftMutation: ReturnType<typeof useUpdateMutation>;
  deleteShiftMutation: ReturnType<typeof useDeleteMutation>;
  planScheduleMutation: ReturnType<typeof useCustomMutation>;
  enhancedScheduleMutation: ReturnType<typeof useCustomMutation>;
  addPortCallMutation: ReturnType<typeof useCreateMutation>;
  addDrydockMutation: ReturnType<typeof useCreateMutation>;
  onSubmitShift: (data: ShiftFormData) => void;
  handleEditShift: (shift: SelectShiftTemplate) => void;
  handleCancelShiftEdit: () => void;
  handlePlanSchedule: () => void;
  handleEnhancedPlanSchedule: () => void;
  handleAddPortCall: () => void;
  handleAddDrydock: () => void;
  getShiftTime: (start: string, end: string) => string;
  getCrewName: (crewId: string) => string;
  getVesselName: (vesselId: string) => string;
  clearFilters: () => void;
}

export function useShiftPlanning(): UseShiftPlanningReturn {
  const { toast } = useToast();
  const _queryClient = useQueryClient();

  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [scheduleResult, setScheduleResult] = useState<SchedulePlanResponse | null>(null);
  const [enhancedScheduleResult, setEnhancedScheduleResult] =
    useState<EnhancedSchedulePlanResponse | null>(null);
  const [isEnhancedDetailsOpen, setIsEnhancedDetailsOpen] = useState(true);
  const [isBasicDetailsOpen, setIsBasicDetailsOpen] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState<string>("greedy");
  const [filterVessel, setFilterVessel] = useState<string>("all");
  const [filterCrew, setFilterCrew] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showConstraints, setShowConstraints] = useState(false);
  const [validateSTCW, setValidateSTCW] = useState(false);
  const [portCalls, _setPortCalls] = useState<PortCall[]>([]);
  const [drydockWindows, _setDrydockWindows] = useState<DrydockWindow[]>([]);
  const [newPortCall, setNewPortCall] = useState(createDefaultPortCall());
  const [newDrydock, setNewDrydock] = useState(createDefaultDrydock());
  const [preferences, setPreferences] = useState<SchedulingPreferences>(
    DEFAULT_SCHEDULING_PREFERENCES
  );
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);

  const shiftForm = useForm<ShiftFormData>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: createDefaultShiftFormValues(),
  });

  const { data: crewRaw = [], isLoading: isLoadingCrew } = useCrewList();
  const crew = crewRaw as unknown as Crew[];
  const { data: shiftTemplatesRaw = [], isLoading: isLoadingShifts } = useShiftTemplates();
  const shiftTemplates = shiftTemplatesRaw as unknown as SelectShiftTemplate[];
  const { data: vesselsRaw = [] } = useVessels();
  const vessels = vesselsRaw as unknown as VesselData[];

  const { data: allPortCalls = [] } = useQuery<PortCall[]>({
    queryKey: ["/api/port-calls"],
    staleTime: 300000,
    refetchInterval: 300000,
  });
  const { data: allDrydockWindows = [] } = useQuery<DrydockWindow[]>({
    queryKey: ["/api/drydock-windows"],
    staleTime: 300000,
    refetchInterval: 300000,
  });
  const { data: certifications = [] } = useQuery<CrewCertification[]>({
    queryKey: ["/api/crew/certifications"],
    staleTime: 300000,
    refetchInterval: 300000,
  });
  const { data: leaves = [], isLoading: isLoadingLeaves } = useQuery<LeaveData[]>({
    queryKey: ["/api/crew/leave"],
    queryFn: () => apiRequest("GET", "/api/crew/leave") as Promise<LeaveData[]>,
    staleTime: 120000,
    refetchInterval: 120000,
  });

  const createShiftMutation = useCreateMutation("/api/shifts", {
    invalidateKeys: ["/api/shifts"],
    successMessage: "Shift template created",
    errorMessage: "Failed to create shift",
    onSuccess: () => {
      shiftForm.reset();
      setIsShiftDialogOpen(false);
    },
  });
  const updateShiftMutation = useUpdateMutation("/api/shifts", {
    invalidateKeys: ["/api/shifts"],
    successMessage: "Shift template updated",
    errorMessage: "Failed to update shift",
    onSuccess: () => {
      setEditingShiftId(null);
      shiftForm.reset();
      setIsShiftDialogOpen(false);
    },
  });
  const deleteShiftMutation = useDeleteMutation("/api/shifts", {
    invalidateKeys: ["/api/shifts"],
    successMessage: "Shift template deleted",
    errorMessage: "Failed to delete shift",
  });

  const planScheduleMutation = useCustomMutation<SchedulePlanPayload, SchedulePlanResponse>({
    mutationFn: async (data: SchedulePlanPayload) =>
      apiRequest("POST", "/api/crew/schedule/plan", data) as Promise<SchedulePlanResponse>,
    invalidateKeys: ["/api/crew/assignments"],
    onSuccess: (data: SchedulePlanResponse) => {
      setScheduleResult(data);
      toast({
        title:
          data.unfilled.length > 0
            ? "Schedule completed with gaps"
            : "Schedule planned successfully",
        description:
          data.unfilled.length > 0
            ? `${data.scheduled} shifts scheduled, ${data.unfilled.length} unfilled`
            : data.message,
        variant: data.unfilled.length > 0 ? "destructive" : "default",
      });
    },
    onError: () => {
      const watchQualified = crew.filter((c: Crew) => c.skills?.includes("watchkeeping")).length;
      toast({
        title: "Unable to create schedule",
        variant: "destructive",
        description: `Need crew with 'watchkeeping' skills. ${watchQualified} of ${crew.length} crew are watch-qualified.`,
      });
    },
  });

  const enhancedScheduleMutation = useCustomMutation<EnhancedSchedulePayload, EnhancedSchedulePlanResponse>({
    mutationFn: async (data: EnhancedSchedulePayload) =>
      apiRequest("POST", "/api/crew/schedule/plan-enhanced", data) as Promise<EnhancedSchedulePlanResponse>,
    invalidateKeys: ["/api/crew/assignments"],
    onSuccess: (data: EnhancedSchedulePlanResponse) => {
      try {
        const safeData = parseEnhancedScheduleResponse(data);
        saveProposedRowsToStorage(safeData.compliance);
        setEnhancedScheduleResult(safeData);
        const coveragePercent = calculateCoverage(safeData.summary);
        toast({
          title: "Enhanced Schedule Generated",
          description: `${safeData.summary.scheduledAssignments} assignments with ${coveragePercent.toFixed(1)}% coverage using ${safeData.engine} engine`,
        });
      } catch (error) {
        toast({
          title: "Response Processing Failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) =>
      toast({
        title: "Enhanced Scheduling Failed",
        description: error.message || "Failed to generate enhanced schedule",
        variant: "destructive",
      }),
  });

  const addPortCallMutation = useCreateMutation("/api/port-calls", {
    invalidateKeys: ["/api/port-calls"],
    successMessage: "Port call added",
    errorMessage: "Failed to add port call",
    onSuccess: () => setNewPortCall(createDefaultPortCall()),
  });
  const addDrydockMutation = useCreateMutation("/api/drydock-windows", {
    invalidateKeys: ["/api/drydock-windows"],
    successMessage: "Drydock window added",
    errorMessage: "Failed to add drydock",
    onSuccess: () => setNewDrydock(createDefaultDrydock()),
  });

  const selectDayRange = (days: number) => setSelectedDays(generateDayRange(days));

  const onSubmitShift = (data: ShiftFormData) => {
    if (editingShiftId) {
      updateShiftMutation.mutate({ id: editingShiftId, data });
    } else {
      createShiftMutation.mutate(data);
    }
  };
  const handleEditShift = (shift: SelectShiftTemplate) => {
    setEditingShiftId(shift.id);
    shiftForm.reset({
      vesselId: shift.vesselId || "",
      equipmentId: shift.equipmentId || "",
      role: shift.role,
      start: shift.start,
      end: shift.end,
      durationH: shift.durationH,
      requiredSkills: shift.requiredSkills || "",
      rankMin: shift.rankMin || "",
      certRequired: shift.certRequired || "",
    });
    setIsShiftDialogOpen(true);
  };
  const handleCancelShiftEdit = () => {
    setEditingShiftId(null);
    shiftForm.reset();
    setIsShiftDialogOpen(false);
  };

  const handlePlanSchedule = () => {
    if (selectedDays.length === 0) {
      toast({
        title: "No days selected",
        description: "Please select the date range for scheduling",
        variant: "destructive",
      });
      return;
    }
    if (isLoadingLeaves) {
      toast({
        title: "Loading leave data",
        description: "Please wait for leave data to load",
        variant: "destructive",
      });
      return;
    }
    planScheduleMutation.mutate({
      days: selectedDays,
      shifts: shiftTemplates,
      crew,
      leaves,
      existing: [],
    });
  };

  const handleEnhancedPlanSchedule = () => {
    if (selectedDays.length === 0) {
      toast({
        title: "No days selected",
        description: "Please select the date range for scheduling",
        variant: "destructive",
      });
      return;
    }
    if (isLoadingLeaves) {
      toast({
        title: "Loading leave data",
        description: "Please wait for leave data to load",
        variant: "destructive",
      });
      return;
    }
    enhancedScheduleMutation.mutate({
      engine: selectedEngine,
      days: selectedDays,
      shifts: shiftTemplates,
      crew,
      leaves,
      portCalls,
      drydocks: drydockWindows,
      certifications: certifications.reduce(
        (acc: Record<string, CrewCertification[]>, cert: CrewCertification) => {
          (acc[cert.crewId] ||= []).push(cert);
          return acc;
        },
        {}
      ),
      preferences,
      validate_stcw: validateSTCW,
    });
  };

  const handleAddPortCall = () => {
    if (!newPortCall.vesselId || !newPortCall.port || !newPortCall.start || !newPortCall.end) {
      toast({ title: "Please fill all port call fields", variant: "destructive" });
      return;
    }
    if (newPortCall.end < newPortCall.start) {
      toast({
        title: "Invalid date range",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    addPortCallMutation.mutate({
      vesselId: newPortCall.vesselId,
      port: newPortCall.port,
      start: newPortCall.start,
      end: newPortCall.end,
    });
  };

  const handleAddDrydock = () => {
    if (!newDrydock.vesselId || !newDrydock.description || !newDrydock.start || !newDrydock.end) {
      toast({ title: "Please fill all drydock fields", variant: "destructive" });
      return;
    }
    if (newDrydock.end < newDrydock.start) {
      toast({
        title: "Invalid date range",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }
    addDrydockMutation.mutate({
      vesselId: newDrydock.vesselId,
      yard: newDrydock.description,
      start: newDrydock.start,
      end: newDrydock.end,
    });
  };

  const getShiftTime = (start: string, end: string) => getShiftTimeRange(start, end);
  const getCrewName = (crewId: string) => {
    const member = crew.find((c: Crew) => c.id === crewId);
    return member ? `${member.name} (${member.rank})` : "Unknown Crew";
  };
  const getVesselName = (vesselId: string) => {
    const vessel = vessels.find((v: VesselData) => v.id === vesselId);
    return vessel ? vessel.name : "Fleet";
  };
  const clearFilters = () => {
    setFilterVessel("all");
    setFilterCrew("all");
    setSearchQuery("");
  };

  return {
    selectedDays,
    setSelectedDays,
    selectDayRange,
    scheduleResult,
    enhancedScheduleResult,
    isEnhancedDetailsOpen,
    setIsEnhancedDetailsOpen,
    isBasicDetailsOpen,
    setIsBasicDetailsOpen,
    selectedEngine,
    setSelectedEngine,
    filterVessel,
    setFilterVessel,
    filterCrew,
    setFilterCrew,
    searchQuery,
    setSearchQuery,
    showConstraints,
    setShowConstraints,
    validateSTCW,
    setValidateSTCW,
    portCalls,
    drydockWindows,
    newPortCall,
    setNewPortCall,
    newDrydock,
    setNewDrydock,
    preferences,
    setPreferences,
    editingShiftId,
    setEditingShiftId,
    isShiftDialogOpen,
    setIsShiftDialogOpen,
    shiftForm,
    crew,
    isLoadingCrew,
    shiftTemplates,
    isLoadingShifts,
    vessels,
    allPortCalls,
    allDrydockWindows,
    certifications,
    leaves,
    isLoadingLeaves,
    createShiftMutation,
    updateShiftMutation,
    deleteShiftMutation,
    planScheduleMutation,
    enhancedScheduleMutation,
    addPortCallMutation,
    addDrydockMutation,
    onSubmitShift,
    handleEditShift,
    handleCancelShiftEdit,
    handlePlanSchedule,
    handleEnhancedPlanSchedule,
    handleAddPortCall,
    handleAddDrydock,
    getShiftTime,
    getCrewName,
    getVesselName,
    clearFilters,
  };
}
