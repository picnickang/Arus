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

export function useUnifiedCrewData() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVessel, setSelectedVessel] = useState<string>("all");
  const [selectedRank, setSelectedRank] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedSkill, setSelectedSkill] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [isAddCrewDialogOpen, setIsAddCrewDialogOpen] = useState(false);
  const [isEditCrewDialogOpen, setIsEditCrewDialogOpen] = useState(false);
  const [isAddSkillDialogOpen, setIsAddSkillDialogOpen] = useState(false);
  const [isViewProfileDialogOpen, setIsViewProfileDialogOpen] = useState(false);
  const [viewingCrew, setViewingCrew] = useState<CrewListItem | null>(null);
  const [editingCrew, setEditingCrew] = useState<CrewListItem | null>(null);
  const [skillAssignmentCrewId, setSkillAssignmentCrewId] = useState<string>("");

  const { data: crew = [], isLoading: crewLoading } = useQuery<CrewListItem[]>({
    queryKey: ["/api/crew"],
  });
  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<VesselListItem[]>({
    queryKey: ["/api/vessels"],
  });

  const crewForm = useForm<CrewFormData>({
    resolver: zodResolver(crewFormSchema),
    defaultValues: createDefaultCrewFormValues(),
  });
  const skillForm = useForm<SkillFormData>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: createDefaultSkillFormValues(),
  });

  const createCrewMutation = useCreateMutation("/api/crew", {
    invalidateKeys: ["/api/crew"],
    successMessage: "Crew member created successfully",
    onSuccess: () => {
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
  const toggleDutyMutation = useCustomMutation({
    // @ts-ignore -- bulk-silence
    mutationFn: async (crewId: string) => {
      const { apiRequest } = await import("@/lib/queryClient");
      return apiRequest("POST", `/api/crew/${crewId}/toggle-duty`);
    },
    invalidateKeys: ["/api/crew"],
    onSuccess: (response: { message?: string }) => {
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
  const handleViewProfile = (member: CrewListItem) => {
    setViewingCrew(member);
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
  };

  const getVesselName = (vesselId: string) => getVesselNameById(vessels, vesselId);
  const stats = useMemo(() => calculateCrewStats(crew), [crew]);
  const filteredAndSortedCrew = useMemo(() => {
    const filtered = filterCrew(crew, {
      searchTerm: debouncedSearchTerm,
      selectedVessel,
      selectedRank,
      selectedStatus,
      selectedSkill,
    });
    return sortCrew(filtered, sortField, sortDirection, getVesselName);
  }, [
    crew,
    debouncedSearchTerm,
    selectedVessel,
    selectedRank,
    selectedStatus,
    selectedSkill,
    sortField,
    sortDirection,
    vessels,
  ]);
  const activeFilterCount = useMemo(
    () =>
      countActiveFilters({
        searchTerm,
        selectedVessel,
        selectedRank,
        selectedStatus,
        selectedSkill,
      }),
    [searchTerm, selectedVessel, selectedRank, selectedStatus, selectedSkill]
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedVessel("all");
    setSelectedRank("all");
    setSelectedStatus("all");
    setSelectedSkill("all");
  };
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  const handleExportCSV = () => {
    const exportData = prepareCrewExportData(filteredAndSortedCrew, getVesselName);
    // @ts-ignore -- bulk-silence
    const success = exportToCSV(exportData, {
      filename: `crew-roster-${new Date().toISOString().split("T")[0]}.csv`,
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
    sortField,
    sortDirection,
    handleSort,
    isAddCrewDialogOpen,
    setIsAddCrewDialogOpen,
    isEditCrewDialogOpen,
    isAddSkillDialogOpen,
    isViewProfileDialogOpen,
    viewingCrew,
    editingCrew,
    skillAssignmentCrewId,
    crew,
    crewLoading,
    vessels,
    vesselsLoading,
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
    getVesselName,
    stats,
    filteredAndSortedCrew,
    activeFilterCount,
    clearFilters,
    handleExportCSV,
    getAvailableVessels,
  };
}
