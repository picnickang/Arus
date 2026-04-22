import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useVessels, useEquipmentList, useEquipmentHealth, useVesselEquipment } from "./useVessels";
import { useWorkOrders } from "@/features/work-orders";
import { exportToJSON } from "@/lib/exportUtils";
import { Vessel, InsertVessel, insertVesselSchema } from "@shared/schema";

interface VesselExportData {
  vessel: Vessel;
  equipment: unknown[];
  crew: unknown[];
}
interface VesselImportResult {
  equipmentCount: number;
  crewCount: number;
}
interface WipeDataResult {
  deletedRecords: number;
}

export function useVesselManagementData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { data: vessels = [], isLoading } = useVessels();
  const { data: workOrders = [] } = useWorkOrders();
  const { data: equipmentHealthRaw = [] } = useEquipmentHealth();
  const { data: equipment = [] } = useEquipmentList();
  const equipmentHealth = Array.isArray(equipmentHealthRaw) ? equipmentHealthRaw : [];
  const { data: vesselEquipment } = useVesselEquipment(
    selectedVessel?.id && isViewDialogOpen ? selectedVessel.id : undefined
  );

  const createVesselMutation = useCreateMutation<InsertVessel>("/api/vessels", {
    successMessage: "Vessel created successfully",
    onSuccess: () => setIsCreateDialogOpen(false),
  });
  const updateVesselMutation = useUpdateMutation<InsertVessel>("/api/vessels", {
    successMessage: "Vessel updated successfully",
    onSuccess: () => {
      setIsEditDialogOpen(false);
      setSelectedVessel(null);
    },
  });
  const deleteVesselMutation = useDeleteMutation("/api/vessels", {
    successMessage: "Vessel deleted successfully",
    invalidateQueries: [["/api/vessels"], ["/api/equipment"], ["/api/work-orders"], ["/api/crew"]],
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
      setSelectedVessel(null);
    },
  });

  const exportVesselMutation = useCustomMutation<string, VesselExportData>({
    mutationFn: (id: string) =>
      apiRequest("GET", `/api/vessels/${id}/export`, undefined, { "x-org-id": "default-org-id" }),
    invalidateKeys: [],
    onSuccess: (data, vesselId: string) => {
      const success = exportToJSON(data, {
        filename: `vessel-${vesselId}-export-${new Date().toISOString().split("T")[0]}.json`,
      });
      if (!success) {
        toast({
          title: "Export Failed",
          description: "No vessel data to export",
          variant: "destructive",
        });
      }
    },
    successMessage: "Vessel exported successfully",
  });

  const importVesselMutation = useCustomMutation<VesselExportData, VesselImportResult>({
    mutationFn: (data: VesselExportData) =>
      apiRequest("POST", `/api/vessels/import`, data, { "x-org-id": "default-org-id" }),
    invalidateKeys: [["/api/vessels"], ["/api/equipment"], ["/api/crew"]],
    onSuccess: (result) =>
      `Imported ${result.equipmentCount} equipment and ${result.crewCount} crew members`,
    successMessage: "Vessel imported successfully",
  });

  const resetDowntimeMutation = useCustomMutation<string, void>({
    mutationFn: (id: string) => apiRequest("POST", `/api/vessels/${id}/reset-downtime`, {}),
    invalidateKeys: [["/api/vessels"]],
    successMessage: "Downtime counter reset successfully",
  });
  const resetOperationMutation = useCustomMutation<string, void>({
    mutationFn: (id: string) => apiRequest("POST", `/api/vessels/${id}/reset-operation`, {}),
    invalidateKeys: [["/api/vessels"]],
    successMessage: "Operation counter reset successfully",
  });
  const wipeVesselDataMutation = useCustomMutation<string, WipeDataResult>({
    mutationFn: (id: string) => apiRequest("POST", `/api/vessels/${id}/wipe-data`, {}),
    invalidateKeys: [
      ["/api/vessels"],
      ["/api/telemetry"],
      ["/api/equipment/health"],
      ["/api/dashboard"],
      ["/api/insights"],
      ["/api/fleet"],
      ["/api/dtc"],
    ],
    onSuccess: (data) => `Deleted ${data.deletedRecords} records`,
    successMessage: "Vessel data wiped successfully",
  });

  const form = useForm<InsertVessel>({
    resolver: zodResolver(insertVesselSchema),
    defaultValues: {
      orgId: "default-org-id",
      name: "",
      vesselClass: "",
      condition: "good",
      onlineStatus: "offline",
      specifications: null,
      operatingParameters: null,
    },
  });
  const editForm = useForm<InsertVessel>({
    resolver: zodResolver(insertVesselSchema),
    defaultValues: {
      orgId: "default-org-id",
      name: "",
      vesselClass: "",
      condition: "good",
      onlineStatus: "offline",
      specifications: null,
      operatingParameters: null,
    },
  });

  const handleCreate = (data: InsertVessel) => createVesselMutation.mutate(data);
  const handleEdit = (vessel: Vessel) => {
    setSelectedVessel(vessel);
    editForm.reset({
      orgId: vessel.orgId,
      name: vessel.name,
      vesselClass: vessel.vesselClass || "",
      condition: vessel.condition || "good",
      onlineStatus: vessel.onlineStatus || "offline",
      specifications: vessel.specifications,
      operatingParameters: vessel.operatingParameters,
      dayRateSgd: vessel.dayRateSgd || "",
    });
    setIsEditDialogOpen(true);
  };
  const handleUpdate = (data: InsertVessel) => {
    if (selectedVessel) {
      const { orgId, ...updateData } = data;
      updateVesselMutation.mutate({ id: selectedVessel.id, data: updateData });
    }
  };
  const handleView = (vessel: Vessel) => {
    setSelectedVessel(vessel);
    setIsViewDialogOpen(true);
  };
  const handleDelete = (vessel: Vessel) => {
    setSelectedVessel(vessel);
    setIsDeleteDialogOpen(true);
  };
  const confirmDelete = () => {
    if (selectedVessel) {
      deleteVesselMutation.mutate(selectedVessel.id);
    }
  };
  const handleExport = (vessel: Vessel) => exportVesselMutation.mutate(vessel.id);

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement)?.files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          importVesselMutation.mutate(data);
        } catch {
          toast({
            title: "Invalid file",
            description: "Please select a valid vessel export JSON file",
            variant: "destructive",
          });
        }
      }
    };
    input.click();
  };

  const handleRefresh = (vessel: Vessel) => {
    queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
    queryClient.invalidateQueries({ queryKey: ["/api/vessels", vessel.id, "equipment"] });
    queryClient.invalidateQueries({ queryKey: ["/api/equipment/health"] });
    queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    toast({ title: "Data refreshed", description: `Updated data for ${vessel.name}` });
  };

  const getVesselEquipment = (vesselName: string) =>
    !Array.isArray(equipmentHealth) ? [] : equipmentHealth.filter((eq) => eq.vessel === vesselName);

  const hasActiveDowntime = (vesselName: string, vesselId: string) =>
    workOrders.some((wo) => {
      const workOrderEquipment = equipment.find((eq) => eq.id === wo.equipmentId);
      if (!workOrderEquipment) {
        return false;
      }
      const belongsToVessel =
        workOrderEquipment.vesselId === vesselId || workOrderEquipment.vesselName === vesselName;
      if (!belongsToVessel) {
        return false;
      }
      const isActive = wo.status === "in_progress" || wo.status === "open";
      const hasDowntime =
        (wo.estimatedDowntimeHours && wo.estimatedDowntimeHours > 0) ||
        (wo.actualDowntimeHours && wo.actualDowntimeHours > 0);
      return isActive && hasDowntime;
    });

  const handleWipeVesselData = () => {
    if (!selectedVessel) {
      return;
    }
    const confirmMessage = `⚠️ DANGER ZONE ⚠️\n\nThis will permanently delete ALL data for ${selectedVessel.name}:\n\n• All telemetry readings\n• All diagnostic trouble codes (DTCs)\n• All insights and predictions\n• All performance metrics\n\nThe vessel and equipment records will remain, but all historical data will be lost.\n\nThis action CANNOT be undone!\n\nType "DELETE" to confirm this destructive action.`;
    const userInput = prompt(confirmMessage);
    if (userInput === "DELETE") {
      wipeVesselDataMutation.mutate(selectedVessel.id);
    } else if (userInput !== null) {
      toast({
        title: "Action cancelled",
        description: "You must type DELETE to confirm",
        variant: "destructive",
      });
    }
  };

  return {
    vessels,
    isLoading,
    selectedVessel,
    setSelectedVessel,
    vesselEquipment,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isViewDialogOpen,
    setIsViewDialogOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    form,
    editForm,
    equipmentHealth,
    createVesselMutation,
    updateVesselMutation,
    deleteVesselMutation,
    exportVesselMutation,
    importVesselMutation,
    resetDowntimeMutation,
    resetOperationMutation,
    wipeVesselDataMutation,
    handleCreate,
    handleEdit,
    handleUpdate,
    handleView,
    handleDelete,
    confirmDelete,
    handleExport,
    handleImport,
    handleRefresh,
    handleWipeVesselData,
    getVesselEquipment,
    hasActiveDowntime,
  };
}
