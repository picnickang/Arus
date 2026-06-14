import { useState, useMemo } from "react";
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
  type SortField,
  type SortDirection,
  type CrewFormData,
  type SkillFormData,
  type FormerCrewAccessRiskFilter,
  type CrewProfileTab,
  crewFormSchema,
  skillFormSchema,
  createDefaultCrewFormValues,
  createDefaultSkillFormValues,
  calculateCrewStats,
  prepareCrewExportData,
  getVesselNameById,
  buildRoleLookup,
  MARITIME_RANKS,
} from "../lib/crewManagementUtils";
import {
  useCrewAccessIndexes,
  useCrewAccessQueries,
  useCrewReferenceData,
  useCrewRosterFilters,
  uploadCrewPhoto,
} from "./useUnifiedCrewDataParts";

export type { PermissionRoleOption } from "./useUnifiedCrewDataParts";

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
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);

  const {
    crew,
    vessels,
    crewRoles,
    permissionRoles,
    crewLoading,
    vesselsLoading,
    crewRolesLoading,
  } = useCrewReferenceData();
  const {
    accessReadiness,
    accessReadinessLoading,
    accessReadinessError,
    formerAccessRisks,
    formerAccessRisksLoading,
    formerAccessRisksError,
  } = useCrewAccessQueries(accessReadinessEnabled);

  const crewForm = useForm<CrewFormData, unknown, CrewFormData>({
    resolver: zodResolver(crewFormSchema),
    defaultValues: createDefaultCrewFormValues(),
  });
  const skillForm = useForm<SkillFormData, unknown, SkillFormData>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: createDefaultSkillFormValues(),
  });

  const notifyPhotoUploadFailure = (description: string) => {
    toast({
      title: "Photo not saved",
      description,
      variant: "destructive",
    });
  };

  const createCrewMutation = useCreateMutation<CrewFormData, CrewListItem>("/api/crew", {
    invalidateKeys: ["/api/crew"],
    successMessage: "Crew member created successfully",
    onSuccess: (created) => {
      setOnboardingCrew(created);
      crewForm.reset();
      setIsAddCrewDialogOpen(false);
      if (pendingPhotoFile && created?.id) {
        void uploadCrewPhoto(created.id, pendingPhotoFile, notifyPhotoUploadFailure);
      }
      setPendingPhotoFile(null);
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
      return apiRequest("POST", `/api/crew/${crewId}/toggle-duty`);
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
    // Empty Select values arrive as "" — coerce optional text fields to
    // undefined so we never send "" for the reports_to FK (which would 23503)
    // or store blank codes/types.
    const cleaned: CrewFormData = {
      ...data,
      crewCode: data.crewCode?.trim() ? data.crewCode.trim() : undefined,
      status: data.status || undefined,
      employmentType: data.employmentType || undefined,
      reportsToId: data.reportsToId || undefined,
      department: data.department || undefined,
      watchKeeping: data.watchKeeping || undefined,
      roleId: data.roleId || undefined,
    };
    if (editingCrew) {
      // On edit, send explicit null (not undefined) for cleared optional fields
      // so the backend actually clears them — undefined would omit the key and
      // leave the previously stored value untouched. This is what makes the
      // suggested app access (roleId) overridable/clearable.
      updateCrewMutation.mutate({
        id: editingCrew.id,
        data: {
          ...cleaned,
          department: data.department?.trim() ? data.department : null,
          watchKeeping: data.watchKeeping?.trim() ? data.watchKeeping : null,
          roleId: data.roleId?.trim() ? data.roleId : null,
        },
      });
    } else {
      createCrewMutation.mutate(cleaned);
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
      department: member.department || "",
      watchKeeping: member.watchKeeping || "",
      roleId: member.roleId || "",
      vesselId: member.vesselId,
      crewCode: member.crewCode || "",
      status: member.status || "active",
      employmentType: member.employmentType || "",
      reportsToId: member.reportsToId || "",
      rotationOnDays: member.rotationOnDays ?? undefined,
      rotationOffDays: member.rotationOffDays ?? undefined,
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
    setPendingPhotoFile(null);
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
  // Always build a lookup — buildRoleLookup falls back to legacy constants when
  // the role list is empty, so roster grouping/sorting works before the API
  // responds and stays identical to the previous hardcoded behaviour.
  const roleLookup = useMemo(() => buildRoleLookup(crewRoles), [crewRoles]);
  // Options for the rank/role dropdowns + filters: managed role names when
  // available, otherwise the legacy constants.
  const rankOptions = useMemo(
    () => (crewRoles.length > 0 ? crewRoles.map((r) => r.name) : [...MARITIME_RANKS]),
    [crewRoles]
  );
  const {
    accessReadinessByCrewId,
    formerAccessRiskByCrewId,
    formerAccessRiskCounts,
    accessStatusCounts,
  } = useCrewAccessIndexes(accessReadiness, formerAccessRisks);
  const { filteredAndSortedCrew, getFilteredSortedCrew, activeFilterCount } = useCrewRosterFilters({
    crew,
    debouncedSearchTerm,
    searchTerm,
    selectedVessel,
    selectedRank,
    selectedStatus,
    selectedSkill,
    selectedAccessStatus,
    selectedFormerAccessRisk,
    accessReadinessEnabled,
    accessReadinessByCrewId,
    formerAccessRiskByCrewId,
    sortField,
    sortDirection,
    getVesselName,
    roleLookupSortIndex: roleLookup.sortIndex,
  });

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
  const handleExportCSV = (rows: CrewListItem[] = filteredAndSortedCrew, label = "crew-roster") => {
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
    crewRoles,
    crewRolesLoading,
    permissionRoles,
    roleLookup,
    rankOptions,
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
    pendingPhotoFile,
    setPendingPhotoFile,
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
