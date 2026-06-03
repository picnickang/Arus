import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useCustomMutation,
} from "@/hooks/useCrudMutations";
import { useDebounce } from "@/hooks/useDebounce";
import { exportToCSV } from "@/lib/exportUtils";
import {
  type CrewListItem,
  type VesselListItem,
  type SortField,
  type SortDirection,
  type CrewFormData,
  type SkillFormData,
  type CrewAccessReadiness,
  type CrewAccessReadinessStatus,
  type FormerCrewAccessRisk,
  type FormerCrewAccessRiskFilter,
  type CrewProfileTab,
  crewFormSchema,
  skillFormSchema,
  createDefaultCrewFormValues,
  createDefaultSkillFormValues,
  calculateCrewStats,
  filterCrew,
  sortCrew,
  countActiveFilters,
  prepareCrewExportData,
  getVesselNameById,
} from "../lib/crewManagementUtils";

interface UseUnifiedCrewDataOptions {
  accessReadinessEnabled?: boolean;
}

export function useUnifiedCrewData(options: UseUnifiedCrewDataOptions = {}) {
  const { toast } = useToast();
  const accessReadinessEnabled = options.accessReadinessEnabled ?? false;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedRank, setSelectedRank] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedSkill, setSelectedSkill] = useState<string>("all");
  const [selectedAccessStatus, setSelectedAccessStatus] = useState<string>("all");
  const [selectedFormerAccessRisk, setSelectedFormerAccessRisk] =
    useState<FormerCrewAccessRiskFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [isAddCrewDialogOpen, setIsAddCrewDialogOpen] = useState(false);
  const [isEditCrewDialogOpen, setIsEditCrewDialogOpen] = useState(false);
  const [isAddSkillDialogOpen, setIsAddSkillDialogOpen] = useState(false);
  const [isViewProfileDialogOpen, setIsViewProfileDialogOpen] = useState(false);
  const [viewingCrew, setViewingCrew] = useState<CrewListItem | null>(null);
  const [editingCrew, setEditingCrew] = useState<CrewListItem | null>(null);
  const [onboardingCrew, setOnboardingCrew] = useState<CrewListItem | null>(null);
  const [skippedLoginCrewIds, setSkippedLoginCrewIds] = useState<Set<string>>(new Set());
  const [profileInitialTab, setProfileInitialTab] = useState<CrewProfileTab>("details");
  const [skillAssignmentCrewId, setSkillAssignmentCrewId] = useState<string>("");

  const { data: crew = [], isLoading: crewLoading } = useQuery<CrewListItem[]>({
    queryKey: ["/api/crew"],
  });
  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<VesselListItem[]>({
    queryKey: ["/api/vessels"],
  });
  const {
    data: accessReadiness = [],
    isLoading: accessReadinessLoading,
    isError: accessReadinessError,
  } = useQuery<CrewAccessReadiness[]>({
    queryKey: ["/api/admin/crew/access-readiness"],
    enabled: accessReadinessEnabled,
    retry: false,
  });
  const {
    data: formerAccessRisks = [],
    isLoading: formerAccessRisksLoading,
    isError: formerAccessRisksError,
  } = useQuery<FormerCrewAccessRisk[]>({
    queryKey: ["/api/admin/crew/former-access-risks"],
    enabled: accessReadinessEnabled,
    retry: false,
  });

  const crewForm = useForm<CrewFormData, unknown, CrewFormData>({
    resolver: zodResolver(crewFormSchema),
    defaultValues: createDefaultCrewFormValues(),
  });
  const skillForm = useForm<SkillFormData, unknown, SkillFormData>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: createDefaultSkillFormValues(),
  });

  const createCrewMutation = useCreateMutation<CrewFormData, CrewListItem>("/api/crew", {
    invalidateKeys: ["/api/crew"],
    successMessage: "Crew member created successfully",
    onSuccess: (created) => {
      setOnboardingCrew(created);
      crewForm.reset();
      setIsAddCrewDialogOpen(false);
    },
  });
  const updateCrewMutation = useUpdateMutation("/api/crew", {
    invalidateKeys: ["/api/crew"],
    successMessage: "Crew member updated successfully",
    onSuccess: () => {
      setIsEditCrewDialogOpen(false);
      setEditingCrew(null);
      crewForm.reset();
    },
  });
  const deleteCrewMutation = useDeleteMutation("/api/crew", {
    invalidateKeys: ["/api/crew"],
    successMessage: "Crew member removed successfully",
  });
  const toggleDutyMutation = useCustomMutation<string, { message?: string }>({
    mutationFn: async (crewId: string) => {
      const { apiRequest } = await import("@/lib/queryClient");
      return apiRequest("POST", `/api/crew/${crewId}/toggle-duty`) as Promise<{ message?: string }>;
    },
    invalidateKeys: ["/api/crew"],
    onSuccess: (response) => {
      toast({
        title: "Duty Status Updated",
        description: response.message || "Duty status toggled successfully",
      });
    },
  });
  const reassignMutation = useUpdateMutation("/api/crew", {
    invalidateKeys: ["/api/crew"],
    successMessage: "Crew reassigned successfully",
  });
  const addSkillMutation = useCustomMutation({
    mutationFn: async (data: SkillFormData) => {
      const response = await fetch(
        `/api/crew/${data.crewId}/skills/${encodeURIComponent(data.skill)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: data.level }),
        }
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    invalidateKeys: ["/api/crew"],
    successMessage: "Skill added successfully",
    onSuccess: () => {
      skillForm.reset();
      setIsAddSkillDialogOpen(false);
      setSkillAssignmentCrewId("");
    },
  });

  const onSubmitCrew = (data: CrewFormData) => {
    if (editingCrew) {
      updateCrewMutation.mutate({ id: editingCrew.id, data });
    } else {
      createCrewMutation.mutate(data);
    }
  };
  const onSubmitSkill = (data: SkillFormData) => {
    addSkillMutation.mutate(data);
  };
  const handleEditCrew = (member: CrewListItem) => {
    setEditingCrew(member);
    crewForm.reset({
      name: member.name,
      rank: member.rank,
      vesselId: member.vesselId,
      maxHours7d: member.maxHours7d,
      minRestH: member.minRestH,
      hourlyRate: member.hourlyRate,
      email: member.email || "",
      phone: member.phone || "",
      address: member.address || "",
      emergencyContactName: member.emergencyContactName || "",
      emergencyContactPhone: member.emergencyContactPhone || "",
      startDate: member.startDate ? member.startDate.split("T")[0] : "",
      contractEndDate: member.contractEndDate ? member.contractEndDate.split("T")[0] : "",
      contractPenalty: member.contractPenalty,
    });
    setIsEditCrewDialogOpen(true);
  };
  const handleAddSkillClick = (crewId: string) => {
    setSkillAssignmentCrewId(crewId);
    skillForm.setValue("crewId", crewId);
    setIsAddSkillDialogOpen(true);
  };
  const handleToggleDuty = (crewId: string) => {
    toggleDutyMutation.mutate(crewId);
  };
  const handleReassign = (crewId: string, vesselId: string) => {
    if (!vesselId) {
      toast({ title: "Please select a vessel", variant: "destructive" });
      return;
    }
    reassignMutation.mutate({ id: crewId, data: { vesselId } });
  };
  const handleDeleteCrew = (crewId: string) => {
    deleteCrewMutation.mutate(crewId);
  };
  const handleViewProfile = (member: CrewListItem, initialTab: CrewProfileTab = "details") => {
    setViewingCrew(member);
    setProfileInitialTab(initialTab);
    setIsViewProfileDialogOpen(true);
  };
  const closeCrewDialog = () => {
    setIsAddCrewDialogOpen(false);
    setIsEditCrewDialogOpen(false);
    setEditingCrew(null);
    crewForm.reset();
  };
  const closeSkillDialog = () => {
    setIsAddSkillDialogOpen(false);
    setSkillAssignmentCrewId("");
    skillForm.reset();
  };
  const closeProfileDialog = () => {
    setIsViewProfileDialogOpen(false);
    setViewingCrew(null);
    setProfileInitialTab("details");
  };
  const closeOnboardingDialog = () => setOnboardingCrew(null);
  const skipOnboardingLogin = () => {
    if (!onboardingCrew) {
      return;
    }
    setSkippedLoginCrewIds((previous) => new Set(previous).add(onboardingCrew.id));
  };
  const openOnboardingProfileTab = (tab: CrewProfileTab) => {
    if (!onboardingCrew) {
      return;
    }
    setViewingCrew(onboardingCrew);
    setProfileInitialTab(tab);
    setIsViewProfileDialogOpen(true);
    setOnboardingCrew(null);
  };

  const getVesselName = (vesselId: string) => getVesselNameById(vessels, vesselId);
  const stats = useMemo(() => calculateCrewStats(crew), [crew]);
  const accessReadinessByCrewId = useMemo(() => {
    const map = new Map<string, CrewAccessReadiness>();
    for (const item of accessReadiness) {
      map.set(item.crewId, item);
    }
    return map;
  }, [accessReadiness]);
  const formerAccessRiskByCrewId = useMemo(() => {
    const map = new Map<string, FormerCrewAccessRisk>();
    for (const item of formerAccessRisks) {
      map.set(item.crewId, item);
    }
    return map;
  }, [formerAccessRisks]);
  const formerAccessRiskCounts = useMemo(
    () => ({
      linked_login: formerAccessRisks.filter((risk) => risk.hasLinkedLogin).length,
      login_enabled: formerAccessRisks.filter((risk) => risk.loginEnabled).length,
      vessel_access: formerAccessRisks.filter((risk) => risk.vesselAccessCount > 0).length,
      hub_access: formerAccessRisks.filter((risk) => risk.hubAdmin).length,
    }),
    [formerAccessRisks],
  );
  const accessStatusCounts = useMemo(() => {
    const counts: Record<CrewAccessReadinessStatus, number> = {
      ready: 0,
      no_login: 0,
      login_disabled: 0,
      no_password_set: 0,
      temporary_password_issued: 0,
      password_change_required: 0,
      password_required: 0,
      no_vessel_scope: 0,
      no_dashboard: 0,
      fleet_scope_review: 0,
    };
    for (const item of accessReadiness) {
      counts[item.status] += 1;
    }
    return counts;
  }, [accessReadiness]);
  const filteredAndSortedCrew = useMemo(() => {
    let filtered = filterCrew(crew, {
      searchTerm: debouncedSearchTerm,
      selectedVessel,
      selectedRank,
      selectedStatus,
      selectedSkill,
    });
    if (accessReadinessEnabled && selectedAccessStatus !== "all") {
      filtered = filtered.filter(
        (member) => accessReadinessByCrewId.get(member.id)?.status === selectedAccessStatus,
      );
    }
    return sortCrew(filtered, sortField, sortDirection, getVesselName);
  }, [
    crew,
    debouncedSearchTerm,
    selectedVessel,
    selectedRank,
    selectedStatus,
    selectedSkill,
    selectedAccessStatus,
    accessReadinessEnabled,
    accessReadinessByCrewId,
    sortField,
    sortDirection,
    vessels,
  ]);
  const getFilteredSortedCrew = (
    baseCrew: CrewListItem[],
    options: {
      includeStatusFilter?: boolean;
      includeAccessFilter?: boolean;
      includeFormerAccessRiskFilter?: boolean;
    } = {},
  ) => {
    const includeStatusFilter = options.includeStatusFilter ?? true;
    const includeAccessFilter = options.includeAccessFilter ?? accessReadinessEnabled;
    const includeFormerAccessRiskFilter = options.includeFormerAccessRiskFilter ?? false;
    let filtered = filterCrew(baseCrew, {
      searchTerm: debouncedSearchTerm,
      selectedVessel,
      selectedRank,
      selectedStatus: includeStatusFilter ? selectedStatus : "all",
      selectedSkill,
      getVesselName,
    });
    if (includeAccessFilter && selectedAccessStatus !== "all") {
      filtered = filtered.filter(
        (member) => accessReadinessByCrewId.get(member.id)?.status === selectedAccessStatus,
      );
    }
    if (includeFormerAccessRiskFilter && selectedFormerAccessRisk !== "all") {
      filtered = filtered.filter((member) => {
        const risk = formerAccessRiskByCrewId.get(member.id);
        if (!risk) return false;
        switch (selectedFormerAccessRisk) {
          case "linked_login":
            return risk.hasLinkedLogin;
          case "login_enabled":
            return risk.loginEnabled;
          case "vessel_access":
            return risk.vesselAccessCount > 0;
          case "hub_access":
            return risk.hubAdmin;
          default:
            return true;
        }
      });
    }
    return sortCrew(filtered, sortField, sortDirection, getVesselName);
  };
  const activeFilterCount = useMemo(
    () =>
      countActiveFilters({
        searchTerm,
        selectedVessel,
        selectedRank,
        selectedStatus,
        selectedSkill,
        selectedAccessStatus: accessReadinessEnabled ? selectedAccessStatus : "all",
      }),
    [
      searchTerm,
      selectedVessel,
      selectedRank,
      selectedStatus,
      selectedSkill,
      selectedAccessStatus,
      accessReadinessEnabled,
    ]
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedVessel("all");
    setSelectedRank("all");
    setSelectedStatus("all");
    setSelectedSkill("all");
    setSelectedAccessStatus("all");
    setSelectedFormerAccessRisk("all");
  };
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  const handleExportCSV = (
    rows: CrewListItem[] = filteredAndSortedCrew,
    label = "crew-roster",
  ) => {
    const exportData = prepareCrewExportData(rows, getVesselName);
    const success = exportToCSV(exportData as object as Parameters<typeof exportToCSV>[0], {
      filename: `${label}-${new Date().toISOString().split("T")[0]}.csv`,
      columns: [
        "name",
        "rank",
        "vessel",
        "status",
        "dutyStatus",
        "maxHoursWeek",
        "minRestH",
        "skills",
      ],
      headers: {
        name: "Name",
        rank: "Rank",
        vessel: "Vessel",
        status: "Status",
        dutyStatus: "Duty Status",
        maxHoursWeek: "Max Hours/Week",
        minRestH: "Min Rest (h)",
        skills: "Skills",
      },
    });
    if (success) {
      toast({ title: "CSV exported successfully" });
    } else {
      toast({ title: "No Data", description: "No crew data to export", variant: "destructive" });
    }
  };
  const getAvailableVessels = (currentVesselId: string) =>
    vessels.filter((v) => v.active && v.id !== currentVesselId);

  return {
    searchTerm,
    setSearchTerm,
    selectedVessel,
    setSelectedVessel,
    selectedRank,
    setSelectedRank,
    selectedStatus,
    setSelectedStatus,
    selectedSkill,
    setSelectedSkill,
    selectedAccessStatus,
    setSelectedAccessStatus,
    selectedFormerAccessRisk,
    setSelectedFormerAccessRisk,
    sortField,
    sortDirection,
    handleSort,
    isAddCrewDialogOpen,
    setIsAddCrewDialogOpen,
    isEditCrewDialogOpen,
    isAddSkillDialogOpen,
    isViewProfileDialogOpen,
    viewingCrew,
    onboardingCrew,
    profileInitialTab,
    editingCrew,
    skillAssignmentCrewId,
    crew,
    crewLoading,
    vessels,
    vesselsLoading,
    accessReadinessEnabled,
    accessReadiness,
    accessReadinessLoading,
    accessReadinessError,
    accessReadinessByCrewId,
    accessStatusCounts,
    formerAccessRisks,
    formerAccessRisksLoading,
    formerAccessRisksError,
    formerAccessRiskByCrewId,
    formerAccessRiskCounts,
    skippedLoginCrewIds,
    crewForm,
    skillForm,
    createCrewMutation,
    updateCrewMutation,
    deleteCrewMutation,
    toggleDutyMutation,
    addSkillMutation,
    onSubmitCrew,
    onSubmitSkill,
    handleEditCrew,
    handleAddSkillClick,
    handleToggleDuty,
    handleReassign,
    handleDeleteCrew,
    handleViewProfile,
    closeCrewDialog,
    closeSkillDialog,
    closeProfileDialog,
    closeOnboardingDialog,
    skipOnboardingLogin,
    openOnboardingProfileTab,
    getVesselName,
    stats,
    filteredAndSortedCrew,
    getFilteredSortedCrew,
    activeFilterCount,
    clearFilters,
    handleExportCSV,
    getAvailableVessels,
  };
}
