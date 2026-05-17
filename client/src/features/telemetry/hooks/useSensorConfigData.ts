import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCreateMutation, useUpdateMutation, useDeleteMutation } from "@/hooks/useCrudMutations";
import type { SensorConfiguration } from "@shared/schema";

interface EquipmentItem {
  id: string;
  name?: string;
  vesselId?: string;
}
interface VesselItem {
  id: string;
  name: string;
}

export interface SensorConfigFormData {
  equipmentId: string;
  sensorType: string;
  enabled: boolean;
  gain: number;
  offset: number;
  minValid: number | null;
  maxValid: number | null;
  deadband: number | null;
  critHi: number | null;
  critLo: number | null;
  warnHi: number | null;
  warnLo: number | null;
  hysteresis: number | null;
  emaAlpha: number | null;
  orgId: string;
}
export const defaultSensorConfigFormData: SensorConfigFormData = {
  equipmentId: "",
  sensorType: "",
  enabled: true,
  gain: 1,
  offset: 0,
  minValid: null,
  maxValid: null,
  deadband: null,
  critHi: null,
  critLo: null,
  warnHi: null,
  warnLo: null,
  hysteresis: 0,
  emaAlpha: null,
  orgId: "default-org-id",
};
export const commonSensorTypes = [
  "temperature",
  "pressure",
  "voltage",
  "current",
  "frequency",
  "vibration",
  "flow_rate",
  "level",
  "rpm",
  "power",
  "efficiency",
];

export function useSensorConfigData() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<SensorConfigFormData>(defaultSensorConfigFormData);
  const [editingConfig, setEditingConfig] = useState<SensorConfiguration | null>(null);
  const [sortColumn, setSortColumn] = useState<string>("equipment");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: equipment = [] } = useQuery<EquipmentItem[]>({ queryKey: ["/api/equipment"] });
  const { data: vessels = [] } = useQuery<VesselItem[]>({ queryKey: ["/api/vessels"] });
  const {
    data: sensorConfigs = [],
    isLoading,
    refetch,
  } = useQuery<SensorConfiguration[]>({ queryKey: ["/api/sensor-configs"] });
  const { data: sensorStatus = [] } = useQuery<
    Array<{
      id: string;
      status: "online" | "offline";
      lastTelemetry: string | null;
      lastValue: number | null;
    }>
  >({ queryKey: ["/api/sensor-configs/status"] });

  const createConfigMutation = useCreateMutation<SensorConfigFormData>("/api/sensor-configs", {
    successMessage: "Sensor configuration created successfully",
    invalidateKeys: ["/api/sensor-configs/status"],
    onSuccess: () => {
      setIsDialogOpen(false);
      setFormData(defaultSensorConfigFormData);
    },
  });
  const updateConfigMutation = useUpdateMutation<SensorConfigFormData>("/api/sensor-configs", {
    successMessage: "Sensor configuration updated successfully",
    invalidateKeys: ["/api/sensor-configs/status"],
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingConfig(null);
      setFormData(defaultSensorConfigFormData);
    },
  });
  const deleteConfigMutation = useDeleteMutation("/api/sensor-configs", {
    successMessage: "Sensor configuration deleted successfully",
    invalidateKeys: ["/api/sensor-configs/status"],
  });

  const handleCreate = () => {
    setEditingConfig(null);
    setFormData(defaultSensorConfigFormData);
    setIsDialogOpen(true);
  };
  const handleEdit = (config: SensorConfiguration) => {
    setEditingConfig(config);
    setFormData({
      equipmentId: config.equipmentId,
      sensorType: config.sensorType,
      enabled: config.enabled ?? true,
      gain: config.gain ?? 1,
      offset: config.offset ?? 0,
      minValid: config.minValid,
      maxValid: config.maxValid,
      deadband: config.deadband,
      critHi: config.critHi,
      critLo: config.critLo,
      warnHi: config.warnHi,
      warnLo: config.warnLo,
      hysteresis: config.hysteresis,
      emaAlpha: config.emaAlpha,
      orgId: config.orgId,
    });
    setIsDialogOpen(true);
  };
  const handleSave = () => {
    if (editingConfig) {
      updateConfigMutation.mutate({ id: editingConfig.id, data: formData });
    } else {
      createConfigMutation.mutate(formData);
    }
  };
  const handleDelete = (id: string) => {
    deleteConfigMutation.mutate(id);
  };
  const handleFieldChange = (
    field: keyof SensorConfigFormData,
    value: SensorConfigFormData[keyof SensorConfigFormData]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingConfig(null);
      setFormData(defaultSensorConfigFormData);
    }
  };
  const handleRefresh = () => {
    toast({ title: "Refreshing configurations...", description: "Fetching latest sensor data" });
    refetch();
    setTimeout(() => {
      toast({ title: "Configurations refreshed", description: "Sensor configurations updated" });
    }, 500);
  };

  const getVesselName = (equipmentId: string) => {
    const equipmentItem = equipment.find((e) => e.id === equipmentId);
    if (!equipmentItem?.vesselId) {
      return "No vessel";
    }
    const vessel = vessels.find((v) => v.id === equipmentItem.vesselId);
    return vessel?.name || "Unknown vessel";
  };
  const getEquipmentName = (equipmentId: string) => {
    const equipmentItem = equipment.find((e) => e.id === equipmentId);
    return equipmentItem?.name || equipmentId;
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedSensorConfigs = [...sensorConfigs].sort((a, b) => {
    let aValue: string;
    let bValue: string;
    switch (sortColumn) {
      case "sensorType":
        aValue = a.sensorType;
        bValue = b.sensorType;
        break;
      case "vessel":
        aValue = getVesselName(a.equipmentId);
        bValue = getVesselName(b.equipmentId);
        break;
      case "equipment":
        aValue = getEquipmentName(a.equipmentId);
        bValue = getEquipmentName(b.equipmentId);
        break;
      case "status": {
        const statusA = sensorStatus.find((s) => s.id === a.id)?.status || "offline";
        const statusB = sensorStatus.find((s) => s.id === b.id)?.status || "offline";
        aValue = statusA;
        bValue = statusB;
        break;
      }
      default:
        return 0;
    }
    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });

  const onlineCount = sensorStatus.filter((s) => s.status === "online").length;
  const offlineCount = sensorStatus.filter((s) => s.status === "offline").length;

  return {
    equipment,
    vessels,
    sensorConfigs,
    sensorStatus,
    isLoading,
    sortedSensorConfigs,
    onlineCount,
    offlineCount,
    isDialogOpen,
    formData,
    editingConfig,
    sortColumn,
    sortDirection,
    createConfigMutation,
    updateConfigMutation,
    deleteConfigMutation,
    handleCreate,
    handleEdit,
    handleSave,
    handleDelete,
    handleFieldChange,
    handleDialogClose,
    handleRefresh,
    handleSort,
    getVesselName,
    getEquipmentName,
  };
}
