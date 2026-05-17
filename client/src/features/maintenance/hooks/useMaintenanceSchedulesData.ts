// @ts-nocheck
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMaintenanceSchedules, useUpcomingMaintenance } from "./useMaintenance";
import { useEquipmentList } from "@/features/vessels";
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useCrudMutations";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { MaintenanceSchedule, InsertMaintenanceSchedule } from "@shared/schema";

export function useMaintenanceSchedulesData() {
  const { toast } = useToast();

  const [selectedSchedule, setSelectedSchedule] = useState<MaintenanceSchedule | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<MaintenanceSchedule>>({});
  const [createForm, setCreateForm] = useState<
    Partial<InsertMaintenanceSchedule> & { scheduledDate?: Date | string }
  >({
    equipmentId: "",
    scheduledDate: "",
    maintenanceType: "preventive",
    priority: 2,
    description: "",
  });
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [viewType, setViewType] = useState<"calendar" | "list">("calendar");

  const { data: schedules, isLoading, error } = useMaintenanceSchedules();
  const { data: equipment } = useEquipmentList();
  const { data: upcomingSchedules } = useUpcomingMaintenance(7);

  const createMutation = useCreateMutation<InsertMaintenanceSchedule>(
    "/api/maintenance-schedules",
    {
      successMessage: "✓ Schedule created successfully",
      onSuccess: () => {
        setCreateModalOpen(false);
        setCreateForm({
          equipmentId: "",
          scheduledDate: "",
          maintenanceType: "preventive",
          priority: 2,
          description: "",
        });
      },
    }
  );
  const updateMutation = useUpdateMutation<Partial<InsertMaintenanceSchedule>>(
    "/api/maintenance-schedules",
    {
      successMessage: "✓ Schedule updated successfully",
      onSuccess: () => {
        setEditModalOpen(false);
        setSelectedSchedule(null);
        setEditForm({});
      },
    }
  );
  const deleteMutation = useDeleteMutation("/api/maintenance-schedules", {
    successMessage: "✓ Schedule deleted successfully",
  });

  const getEquipmentName = (equipmentId: string) => {
    const eq = equipment?.find((e) => e.id === equipmentId);
    return eq?.name || equipmentId;
  };

  const handleViewSchedule = (schedule: MaintenanceSchedule) => {
    setSelectedSchedule(schedule);
    setViewModalOpen(true);
  };
  const handleEditSchedule = (schedule: MaintenanceSchedule) => {
    setSelectedSchedule(schedule);
    setEditForm({
      equipmentId: schedule.equipmentId,
      scheduledDate:
        typeof schedule.scheduledDate === "string"
          ? schedule.scheduledDate
          : new Date(schedule.scheduledDate).toISOString().slice(0, 16),
      maintenanceType: schedule.maintenanceType,
      priority: schedule.priority,
      status: schedule.status,
      description: schedule.description,
      assignedTo: schedule.assignedTo,
    });
    setEditModalOpen(true);
  };
  const handleDeleteSchedule = (schedule: MaintenanceSchedule) => {
    const equipmentName = getEquipmentName(schedule.equipmentId);
    if (confirm(`Delete maintenance schedule for "${equipmentName}"? This cannot be undone.`)) {
      deleteMutation.mutate(schedule.id);
    }
  };

  const handleCreateSubmit = () => {
    if (!createForm.equipmentId || !createForm.scheduledDate || !createForm.maintenanceType) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    const payload: InsertMaintenanceSchedule = {
      ...createForm,
      orgId: getCurrentOrgId(),
      scheduledDate: new Date(createForm.scheduledDate),
      equipmentId: createForm.equipmentId,
      maintenanceType: createForm.maintenanceType,
      priority: createForm.priority || 2,
    };
    createMutation.mutate(payload);
  };

  const handleEditSubmit = () => {
    if (
      !selectedSchedule ||
      !editForm.equipmentId ||
      !editForm.scheduledDate ||
      !editForm.maintenanceType
    ) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    const updates = {
      ...editForm,
      scheduledDate: editForm.scheduledDate ? new Date(editForm.scheduledDate) : undefined,
    };
    updateMutation.mutate({
      id: selectedSchedule.id,
      updates: updates as Partial<InsertMaintenanceSchedule>,
    });
  };

  const filteredSchedules = useMemo(() => {
    let filtered = Array.isArray(schedules) ? (schedules as MaintenanceSchedule[]) : [];
    if (searchText) {
      filtered = filtered.filter(
        (schedule) =>
          getEquipmentName(schedule.equipmentId).toLowerCase().includes(searchText.toLowerCase()) ||
          (schedule.description &&
            schedule.description.toLowerCase().includes(searchText.toLowerCase())) ||
          (schedule.assignedTo &&
            schedule.assignedTo.toLowerCase().includes(searchText.toLowerCase()))
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((schedule) => schedule.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      filtered = filtered.filter(
        (schedule) => schedule.priority === Number.parseInt(priorityFilter)
      );
    }
    return filtered.sort(
      (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );
  }, [schedules, searchText, statusFilter, priorityFilter, equipment]);

  const getStatusBadge = (status: string) => {
    const styles = {
      scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
      in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      completed: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30",
      cancelled: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/30",
    };
    return {
      className: `border ${styles[status as keyof typeof styles] || styles.scheduled}`,
      label: status.replace("_", " "),
    };
  };

  const getPriorityBadge = (priority: number) => {
    const config = {
      1: {
        label: "High",
        className: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
      },
      2: {
        label: "Medium",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      },
      3: {
        label: "Low",
        className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
      },
    };
    const p = config[priority as keyof typeof config] || config[2];
    return { className: `border ${p.className}`, label: p.label };
  };

  return {
    schedules,
    isLoading,
    error,
    equipment,
    upcomingSchedules,
    selectedSchedule,
    setSelectedSchedule,
    viewModalOpen,
    setViewModalOpen,
    editModalOpen,
    setEditModalOpen,
    createModalOpen,
    setCreateModalOpen,
    editForm,
    setEditForm,
    createForm,
    setCreateForm,
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    viewType,
    setViewType,
    createMutation,
    updateMutation,
    deleteMutation,
    getEquipmentName,
    handleViewSchedule,
    handleEditSchedule,
    handleDeleteSchedule,
    handleCreateSubmit,
    handleEditSubmit,
    filteredSchedules,
    getStatusBadge,
    getPriorityBadge,
  };
}
