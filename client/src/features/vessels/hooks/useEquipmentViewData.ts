import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import {
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  useCustomMutation,
} from "@/hooks/useCrudMutations";
import { useToast } from "@/hooks/use-toast";
import { insertSensorConfigSchema, Equipment, SensorConfiguration } from "@shared/schema";
import {
  sensorKeys,
  telemetryKeys,
  operatingParamKeys,
  alertKeys,
  sensorTemplateKeys,
} from "@/utils/queryKeys";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { getLoadDistributionDateRange, createDefaultSensorFormValues } from "../lib/equipmentUtils";

interface SensorTemplate {
  id: string;
  sensorType: string;
  targetUnit?: string;
  gain: number;
  offset: number;
  critHi: number | null;
  critLo: number | null;
  warnHi: number | null;
  warnLo: number | null;
}
interface SensorBundle {
  id: string;
  name: string;
  equipmentType?: string;
  sensors: Array<{ sensorType: string; targetUnit?: string }>;
}
interface AlertItem {
  id: string;
  equipmentId: string;
  severity: string;
  message: string;
  acknowledged: boolean;
}
interface TelemetryReading {
  id: string;
  equipmentId: string;
  sensorType: string;
  value: number;
  timestamp: string;
}
interface OperatingParam {
  id: string;
  equipmentType: string;
  paramName: string;
  minValue?: number;
  maxValue?: number;
}

export function useEquipmentViewData(
  equipment: Equipment | null,
  isOpen: boolean,
  onEquipmentUpdated?: () => void
) {
  const { toast } = useToast();
  const [isSensorDialogOpen, setIsSensorDialogOpen] = useState(false);
  const [isAssignSensorDialogOpen, setIsAssignSensorDialogOpen] = useState(false);
  const [isApplyBundleDialogOpen, setIsApplyBundleDialogOpen] = useState(false);
  const [editingSensor, setEditingSensor] = useState<SensorConfiguration | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedBundleId, setSelectedBundleId] = useState<string>("");

  const loadDistributionDateRange = useMemo(() => getLoadDistributionDateRange(), []);
  const sensorForm = useForm({
    resolver: zodResolver(insertSensorConfigSchema),
    defaultValues: createDefaultSensorFormValues(equipment?.id || ""),
  });

  const { data: sensorConfigs = [] } = useQuery<SensorConfiguration[]>({
    queryKey: sensorKeys.byEquipment(equipment?.id || ""),
    queryFn: () =>
      apiRequest<SensorConfiguration[]>("GET", `/api/sensor-config?equipmentId=${equipment?.id}`),
    enabled: !!equipment?.id && isOpen,
    staleTime: 10000,
  });
  const { data: sensorStatus = [] } = useVisibilityPolling<
    Array<{
      id: string;
      equipmentId: string;
      sensorType: string;
      status: "online" | "offline";
      lastTelemetry: string | null;
      lastValue: number | null;
      enabled: boolean;
    }>
  >({
    queryKey: sensorKeys.status(equipment?.id),
    queryFn: () => apiRequest("GET", `/api/sensor-configs/status?equipmentId=${equipment?.id}`),
    enabled: !!equipment?.id && isOpen,
    interval: 10000,
    staleTime: 5000,
  });
  const { data: allSensorConfigs = [] } = useQuery<SensorConfiguration[]>({
    queryKey: sensorKeys.lists(),
    queryFn: () => apiRequest<SensorConfiguration[]>("GET", "/api/sensor-configs"),
    enabled: isAssignSensorDialogOpen,
  });
  const { data: sensorTemplates = [] } = useQuery<SensorTemplate[]>({
    queryKey: sensorTemplateKeys.list(equipment?.type),
    queryFn: async () => {
      const url = equipment?.type
        ? `/api/sensor-templates?equipmentType=${equipment.type}`
        : "/api/sensor-templates";
      return apiRequest("GET", url);
    },
    enabled: isSensorDialogOpen,
  });
  const { data: sensorBundles = [] } = useQuery<SensorBundle[]>({
    queryKey: ["/api/sensor-bundles", equipment?.type],
    queryFn: async () => {
      const url = equipment?.type
        ? `/api/sensor-bundles?equipmentType=${equipment.type}`
        : "/api/sensor-bundles";
      return apiRequest("GET", url);
    },
    enabled: isApplyBundleDialogOpen,
  });
  const { data: equipmentAlerts = [] } = useQuery<AlertItem[]>({
    queryKey: alertKeys.operatingCondition(equipment?.id, false),
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/operating-condition-alerts?equipmentId=${equipment?.id}&acknowledged=false`
      ),
    enabled: !!equipment?.id && isOpen,
  });
  const { data: equipmentTelemetry = [] } = useQuery<TelemetryReading[]>({
    queryKey: telemetryKeys.latest({
      ...(equipment?.id !== undefined && { equipmentId: equipment.id }),
      limit: 20,
    }),
    queryFn: () => apiRequest("GET", `/api/telemetry/latest?equipmentId=${equipment?.id}&limit=20`),
    enabled: !!equipment?.id && isOpen,
  });
  const { data: operatingParams = [] } = useQuery<OperatingParam[]>({
    queryKey: operatingParamKeys.byEquipmentType(equipment?.type || ""),
    queryFn: () =>
      apiRequest<OperatingParam[]>(
        "GET",
        `/api/operating-parameters?equipmentType=${equipment?.type}`
      ),
    enabled: !!equipment?.type && isOpen,
  });

  const handleMutationError = (error: unknown, title: string) => {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "An unexpected error occurred";
    toast({ title, description: message, variant: "destructive" });
  };

  const createSensorMutation = useCreateMutation("/api/sensor-configs", {
    successMessage: "Sensor configuration created successfully",
    invalidateQueries: [
      ["/api/sensor-config", equipment?.id],
      ["/api/sensor-configs"],
      ["/api/sensor-configs/status", equipment?.id],
    ],
    onSuccess: () => {
      setIsSensorDialogOpen(false);
      setEditingSensor(null);
      sensorForm.reset();
      onEquipmentUpdated?.();
    },
    onError: (error) => handleMutationError(error, "Error creating sensor configuration"),
  });
  const updateSensorMutation = useUpdateMutation("/api/sensor-configs", {
    successMessage: "Sensor configuration updated successfully",
    invalidateQueries: [
      ["/api/sensor-config", equipment?.id],
      ["/api/sensor-configs"],
      ["/api/sensor-configs/status", equipment?.id],
    ],
    onSuccess: () => {
      setIsSensorDialogOpen(false);
      setEditingSensor(null);
      sensorForm.reset();
      onEquipmentUpdated?.();
    },
    onError: (error) => handleMutationError(error, "Error updating sensor configuration"),
  });
  const deleteSensorMutation = useDeleteMutation("/api/sensor-configs", {
    successMessage: "Sensor configuration deleted successfully",
    invalidateQueries: [
      ["/api/sensor-config", equipment?.id],
      ["/api/sensor-configs"],
      ["/api/sensor-configs/status", equipment?.id],
    ],
    onError: (error) => handleMutationError(error, "Error deleting sensor configuration"),
  });
  const assignSensorMutation = useCreateMutation("/api/sensor-configs", {
    successMessage: "Sensor configuration assigned successfully",
    invalidateQueries: [
      ["/api/sensor-config", equipment?.id],
      ["/api/sensor-configs"],
      ["/api/sensor-configs/status", equipment?.id],
    ],
    onSuccess: () => {
      setIsAssignSensorDialogOpen(false);
      onEquipmentUpdated?.();
    },
    onError: (error) => handleMutationError(error, "Error assigning sensor configuration"),
  });
  const applyBundleMutation = useCustomMutation<{ equipmentId: string; bundleId: string }>({
    mutationFn: (data) =>
      apiRequest("POST", `/api/equipment/${data.equipmentId}/apply-bundle`, {
        bundleId: data.bundleId,
      }),
    invalidateKeys: [["/api/sensor-config", equipment?.id], ["/api/sensor-configs"]],
    successMessage: "Sensor bundle applied successfully",
    onSuccess: () => {
      setIsApplyBundleDialogOpen(false);
      setSelectedBundleId("");
      onEquipmentUpdated?.();
    },
    onError: (error) => handleMutationError(error, "Error applying sensor bundle"),
  });

  const handleAddSensor = () => {
    setEditingSensor(null);
    sensorForm.reset(createDefaultSensorFormValues(equipment?.id || ""));
    setIsSensorDialogOpen(true);
  };
  const handleEditSensor = (sensor: SensorConfiguration) => {
    setEditingSensor(sensor);
    sensorForm.reset({
      equipmentId: sensor.equipmentId,
      sensorType: sensor.sensorType,
      targetUnit: sensor.targetUnit || "",
      gain: sensor.gain ?? undefined,
      offset: sensor.offset ?? undefined,
      enabled: sensor.enabled ?? undefined,
      notes: sensor.notes || "",
      critHi: sensor.critHi,
      critLo: sensor.critLo,
      warnHi: sensor.warnHi,
      warnLo: sensor.warnLo,
    });
    setIsSensorDialogOpen(true);
  };
  const handleDeleteSensor = (sensor: SensorConfiguration) => {
    if (
      confirm(
        `Are you sure you want to delete the sensor configuration for "${sensor.sensorType}"?`
      )
    ) {
      deleteSensorMutation.mutate(sensor.id);
    }
  };
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = sensorTemplates.find((t) => t.id === templateId);
    if (template) {
      sensorForm.setValue("sensorType", template.sensorType);
      sensorForm.setValue("targetUnit", template.targetUnit || "");
      sensorForm.setValue("gain", template.gain);
      sensorForm.setValue("offset", template.offset);
      sensorForm.setValue("critHi", template.critHi);
      sensorForm.setValue("critLo", template.critLo);
      sensorForm.setValue("warnHi", template.warnHi);
      sensorForm.setValue("warnLo", template.warnLo);
    }
  };
  const handleAssignExistingSensor = () => {
    setIsAssignSensorDialogOpen(true);
  };
  const handleAssignSensor = (sourceConfig: SensorConfiguration) => {
    if (!equipment) {
      return;
    }
    assignSensorMutation.mutate({
      equipmentId: equipment.id,
      sensorType: sourceConfig.sensorType,
      targetUnit: sourceConfig.targetUnit,
      gain: sourceConfig.gain,
      offset: sourceConfig.offset,
      enabled: sourceConfig.enabled,
      notes: sourceConfig.notes,
      critHi: sourceConfig.critHi,
      critLo: sourceConfig.critLo,
      warnHi: sourceConfig.warnHi,
      warnLo: sourceConfig.warnLo,
    });
  };
  const onSensorSubmit = (data: Record<string, unknown>) => {
    if (editingSensor) {
      updateSensorMutation.mutate({ id: editingSensor.id, data });
    } else {
      createSensorMutation.mutate(data);
    }
  };
  const closeSensorDialog = () => {
    setIsSensorDialogOpen(false);
    setEditingSensor(null);
    sensorForm.reset();
  };
  const handleApplyBundle = () => {
    if (!equipment || !selectedBundleId) {
      return;
    }
    applyBundleMutation.mutate({ equipmentId: equipment.id, bundleId: selectedBundleId });
  };
  const closeApplyBundleDialog = () => {
    setIsApplyBundleDialogOpen(false);
    setSelectedBundleId("");
  };

  return {
    isSensorDialogOpen,
    setIsSensorDialogOpen,
    isAssignSensorDialogOpen,
    setIsAssignSensorDialogOpen,
    isApplyBundleDialogOpen,
    setIsApplyBundleDialogOpen,
    editingSensor,
    selectedTemplateId,
    selectedBundleId,
    setSelectedBundleId,
    loadDistributionDateRange,
    sensorForm,
    sensorConfigs,
    sensorStatus,
    allSensorConfigs,
    sensorTemplates,
    sensorBundles,
    equipmentAlerts,
    equipmentTelemetry,
    operatingParams,
    createSensorMutation,
    updateSensorMutation,
    deleteSensorMutation,
    assignSensorMutation,
    applyBundleMutation,
    handleAddSensor,
    handleEditSensor,
    handleDeleteSensor,
    handleTemplateSelect,
    handleAssignExistingSensor,
    handleAssignSensor,
    onSensorSubmit,
    closeSensorDialog,
    handleApplyBundle,
    closeApplyBundleDialog,
  };
}
