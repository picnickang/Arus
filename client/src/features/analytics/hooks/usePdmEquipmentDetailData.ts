import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSensorBaselines, useLiveTelemetryInvalidation } from "./useSensorBaselines";

export interface EquipmentDetail {
  id: string;
  name: string;
  type: string;
  vesselName?: string;
  status?: string;
  isActive?: boolean;
  location?: string;
}
export interface PdmHealthData {
  equipmentId: string;
  healthScore: number;
  rul: number | null;
  rulUncertainty: number | null;
  status: "healthy" | "warning" | "critical" | "unknown";
  pFail30d: number;
  aiSummary: string | null;
  lastUpdated: string;
  confidence: "high" | "medium" | "low";
}
export interface PdmEquipmentTelemetryReading {
  id: string;
  /** Server field is `ts` (EquipmentTelemetry row shape) — this was
   *  declared `timestamp` and every reading parsed as Invalid Date. */
  ts: string;
  sensorType: string;
  value: number;
  unit: string;
}
export interface SensorConfig {
  id: string;
  equipmentId: string;
  sensorType: string;
  targetUnit?: string;
  unit?: string;
  enabled?: boolean;
  notes?: string;
}

export const SENSOR_COLORS: Record<string, string> = {
  temperature: "hsl(0, 84%, 60%)",
  pressure: "hsl(220, 70%, 50%)",
  vibration: "hsl(142, 70%, 45%)",
  flow_rate: "hsl(38, 92%, 50%)",
  oil_quality: "hsl(280, 70%, 50%)",
  rpm: "hsl(180, 70%, 45%)",
  current: "hsl(330, 70%, 50%)",
  voltage: "hsl(60, 70%, 45%)",
};

export function usePdmEquipmentDetailData(equipmentIdOverride?: string) {
  const params = useParams<{ equipmentId: string }>();
  const [, setLocation] = useLocation();
  const equipmentId = equipmentIdOverride ?? params.equipmentId;

  const {
    data: equipment,
    isLoading: isLoadingEquipment,
    error: equipmentError,
  } = useQuery<EquipmentDetail>({
    queryKey: [`/api/equipment/${equipmentId}`],
    enabled: !!equipmentId,
  });
  const {
    data: healthData,
    isLoading: isLoadingHealth,
    error: healthError,
  } = useQuery<PdmHealthData>({
    queryKey: [`/api/pdm/health/${equipmentId}`],
    enabled: !!equipmentId,
  });

  const handleBack = () => setLocation("/equipment-intelligence");
  const handleCreateWorkOrder = () =>
    setLocation(`/work-orders?action=create&equipmentId=${equipmentId}`);
  const handleViewWorkOrders = () => setLocation(`/work-orders?equipmentId=${equipmentId}`);
  const retryEquipment = () =>
    queryClient.invalidateQueries({ queryKey: [`/api/equipment/${equipmentId}`] });
  const retryHealth = () =>
    queryClient.invalidateQueries({ queryKey: [`/api/pdm/health/${equipmentId}`] });

  const healthScore = healthData?.healthScore ?? 0;
  const healthStatus = healthData?.status ?? "unknown";
  const rul = healthData?.rul ?? null;
  const rulUncertainty = healthData?.rulUncertainty ?? null;
  const confidence = healthData?.confidence ?? "low";

  return {
    equipmentId,
    equipment,
    healthData,
    isLoadingEquipment,
    isLoadingHealth,
    equipmentError,
    healthError,
    handleBack,
    handleCreateWorkOrder,
    handleViewWorkOrders,
    retryEquipment,
    retryHealth,
    healthScore,
    healthStatus,
    rul,
    rulUncertainty,
    confidence,
  };
}

export function useOverviewTabData(equipmentId: string, healthData?: PdmHealthData) {
  const { currentOrgId } = useOrganization();
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("24h");
  const hoursMap = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };

  const { data: telemetryHistory, isLoading: isLoadingTelemetry } = useQuery<
    PdmEquipmentTelemetryReading[]
  >({
    queryKey: ["/api/telemetry/history-multi", equipmentId, timeRange, currentOrgId],
    queryFn: async () => {
      const sensorTypes = ["temperature", "pressure", "vibration", "flow_rate", "oil_quality"];
      const hours = hoursMap[timeRange];
      const results = await Promise.all(
        sensorTypes.map(async (sensorType) => {
          try {
            // apiRequest attaches the in-memory session token — a raw
            // fetch() here is unauthenticated and 401s silently, which
            // rendered this chart permanently empty.
            return await apiRequest<PdmEquipmentTelemetryReading[]>(
              "GET",
              `/api/telemetry/history/${equipmentId}/${sensorType}?hours=${hours}`
            );
          } catch {
            return [];
          }
        })
      );
      return results.flat();
    },
    refetchInterval: 60_000,
  });

  const sensorData = useMemo(() => {
    if (!telemetryHistory?.length) {
      return [];
    }
    const grouped: Record<
      string,
      { sensorType: string; unit: string; data: { timestamp: Date; value: number }[] }
    > = {};
    telemetryHistory.forEach((reading) => {
      let group = grouped[reading.sensorType];
      if (!group) {
        group = {
          sensorType: reading.sensorType,
          unit: reading.unit || "",
          data: [],
        };
        grouped[reading.sensorType] = group;
      }
      group.data.push({
        timestamp: new Date(reading.ts),
        value: reading.value,
      });
    });
    return Object.values(grouped).map((sensor) => ({
      ...sensor,
      color: SENSOR_COLORS[sensor.sensorType] || "hsl(var(--primary))",
      data: sensor.data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    }));
  }, [telemetryHistory]);

  // Expected operating envelope per sensor (median ± 2σ band behind the
  // live series) + live-push chart refresh; see useSensorBaselines.ts.
  const baselines = useSensorBaselines(equipmentId);
  useLiveTelemetryInvalidation(equipmentId);

  const defaultSummary =
    healthData?.aiSummary ||
    `Equipment is currently ${healthData?.status || "operating"}. Health score: ${healthData?.healthScore ?? 0}%. Continue monitoring for optimal performance.`;
  return { timeRange, setTimeRange, sensorData, baselines, isLoadingTelemetry, defaultSummary };
}

export function useSensorsTabData(equipmentId: string) {
  const { toast } = useToast();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedSensorIds, setSelectedSensorIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const {
    data: sensorConfigs,
    isLoading,
    isFetching,
  } = useQuery<SensorConfig[]>({ queryKey: ["/api/sensor-config", { equipmentId }] });
  const { data: equipment } = useQuery<EquipmentDetail>({
    queryKey: [`/api/equipment/${equipmentId}`],
  });

  useEffect(() => {
    if (!sensorConfigs || selectedSensorIds.length === 0) {
      return;
    }
    const validIds = new Set(sensorConfigs.map((s) => s.id));
    const invalidSelections = selectedSensorIds.filter((id) => !validIds.has(id));
    if (invalidSelections.length > 0) {
      setSelectedSensorIds((prev) => prev.filter((id) => validIds.has(id)));
      toast({
        title: "Selection updated",
        description: `${invalidSelections.length} sensor(s) no longer available and were deselected`,
      });
    }
  }, [sensorConfigs, selectedSensorIds, toast]);

  const deleteMutation = useMutation({
    mutationFn: async (sensorIds: string[]) => {
      if (sensorIds.length === 0) {
        throw new Error("No sensors selected");
      }
      const results = await Promise.allSettled(
        sensorIds.map((id) => apiRequest("DELETE", `/api/sensor-configs/${id}`))
      );
      const successes = results.filter((r) => r.status === "fulfilled").length;
      const failures = results.filter((r) => r.status === "rejected");
      return { successes, failures, total: sensorIds.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensor-config"] });
      toast({
        variant: data.failures.length > 0 && data.successes === 0 ? "destructive" : "default",
        title:
          data.failures.length === 0
            ? "Sensors deleted"
            : data.successes > 0
              ? "Partially deleted"
              : "Delete failed",
        description:
          data.failures.length === 0
            ? `Successfully deleted ${data.successes} sensor(s)`
            : `${data.successes} deleted, ${data.failures.length} failed`,
      });
      setSelectedSensorIds([]);
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete sensors",
      });
    },
  });

  const enableMutation = useMutation({
    mutationFn: async (sensorIds: string[]) => {
      if (!sensorConfigs || sensorConfigs.length === 0) {
        throw new Error("Sensor configuration data not available");
      }
      if (sensorIds.length === 0) {
        throw new Error("No sensors selected");
      }
      const sensors = sensorConfigs.filter((s) => sensorIds.includes(s.id));
      if (sensors.length === 0) {
        throw new Error("Selected sensors not found");
      }
      const results = await Promise.allSettled(
        sensors.map((sensor) =>
          apiRequest("PUT", `/api/sensor-configs/${sensor.equipmentId}/${sensor.sensorType}`, {
            enabled: true,
          })
        )
      );
      const successes = results.filter((r) => r.status === "fulfilled").length;
      const failures = results.filter((r) => r.status === "rejected");
      return { successes, failures, total: sensors.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensor-config"] });
      toast({
        variant: data.failures.length > 0 && data.successes === 0 ? "destructive" : "default",
        title:
          data.failures.length === 0
            ? "Sensors enabled"
            : data.successes > 0
              ? "Partially enabled"
              : "Enable failed",
        description:
          data.failures.length === 0
            ? `Successfully enabled ${data.successes} sensor(s)`
            : `${data.successes} enabled, ${data.failures.length} failed`,
      });
      setSelectedSensorIds([]);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Enable failed",
        description: error instanceof Error ? error.message : "Failed to enable sensors",
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (sensorIds: string[]) => {
      if (!sensorConfigs || sensorConfigs.length === 0) {
        throw new Error("Sensor configuration data not available");
      }
      if (sensorIds.length === 0) {
        throw new Error("No sensors selected");
      }
      const sensors = sensorConfigs.filter((s) => sensorIds.includes(s.id));
      if (sensors.length === 0) {
        throw new Error("Selected sensors not found");
      }
      const results = await Promise.allSettled(
        sensors.map((sensor) =>
          apiRequest("PUT", `/api/sensor-configs/${sensor.equipmentId}/${sensor.sensorType}`, {
            enabled: false,
          })
        )
      );
      const successes = results.filter((r) => r.status === "fulfilled").length;
      const failures = results.filter((r) => r.status === "rejected");
      return { successes, failures, total: sensors.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensor-config"] });
      toast({
        variant: data.failures.length > 0 && data.successes === 0 ? "destructive" : "default",
        title:
          data.failures.length === 0
            ? "Sensors disabled"
            : data.successes > 0
              ? "Partially disabled"
              : "Disable failed",
        description:
          data.failures.length === 0
            ? `Successfully disabled ${data.successes} sensor(s)`
            : `${data.successes} disabled, ${data.failures.length} failed`,
      });
      setSelectedSensorIds([]);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Disable failed",
        description: error instanceof Error ? error.message : "Failed to disable sensors",
      });
    },
  });

  const handleWizardSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/sensor-config"] });
    queryClient.invalidateQueries({ queryKey: [`/api/equipment/${equipmentId}`] });
    setIsWizardOpen(false);
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked && sensorConfigs) {
      setSelectedSensorIds(sensorConfigs.map((s) => s.id));
    } else {
      setSelectedSensorIds([]);
    }
  };
  const handleSelectSensor = (sensorId: string, checked: boolean) => {
    if (checked) {
      setSelectedSensorIds([...selectedSensorIds, sensorId]);
    } else {
      setSelectedSensorIds(selectedSensorIds.filter((id) => id !== sensorId));
    }
  };
  const handleBulkDelete = () => {
    if (selectedSensorIds.length === 0) {
      toast({
        title: "No sensors selected",
        description: "Please select at least one sensor to delete",
      });
      return;
    }
    setDeleteDialogOpen(true);
  };
  const confirmDelete = () => {
    deleteMutation.mutate(selectedSensorIds);
  };

  const selectedSensors = sensorConfigs?.filter((s) => selectedSensorIds.includes(s.id)) ?? [];
  const isBulkOperationDisabled =
    isFetching || deleteMutation.isPending || enableMutation.isPending || disableMutation.isPending;

  return {
    isWizardOpen,
    setIsWizardOpen,
    selectedSensorIds,
    setSelectedSensorIds,
    deleteDialogOpen,
    setDeleteDialogOpen,
    sensorConfigs,
    equipment,
    isLoading,
    isFetching,
    deleteMutation,
    enableMutation,
    disableMutation,
    handleWizardSuccess,
    handleSelectAll,
    handleSelectSensor,
    handleBulkDelete,
    confirmDelete,
    selectedSensors,
    isBulkOperationDisabled,
  };
}

export interface AnomalyDetectionItem {
  id: string;
  sensorKind?: string;
  severity?: string;
  description?: string;
}

export interface MaintenanceHistoryWorkOrder {
  id: string;
  reason?: string;
  description?: string;
  status?: string;
  maintenanceType?: string;
}

export function useAnomaliesTabData(equipmentId: string) {
  const { data: anomalies, isLoading } = useQuery<AnomalyDetectionItem[]>({
    queryKey: ["/api/analytics/anomaly-detections", { equipmentId }],
  });
  return { anomalies, isLoading };
}

export function useMaintenanceHistoryTabData(equipmentId: string) {
  const { data: workOrders, isLoading } = useQuery<MaintenanceHistoryWorkOrder[]>({
    queryKey: ["/api/work-orders", { equipmentId }],
  });
  return { workOrders, isLoading };
}
