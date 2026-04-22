import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  TelemetryReading,
  SensorConfiguration,
  SensorState,
  SensorTemplate,
  DeviceHeartbeat,
} from "../types";

export const telemetryKeys = {
  all: ["/api/telemetry"] as const,
  readings: (equipmentId: string, sensorType?: string) =>
    [...telemetryKeys.all, "readings", equipmentId, sensorType] as const,
  latest: (equipmentId: string) => [...telemetryKeys.all, "latest", equipmentId] as const,
  configs: () => ["/api/sensor-configurations"] as const,
  configDetail: (id: string) => [...telemetryKeys.configs(), id] as const,
  states: (equipmentId?: string) => ["/api/sensor-states", equipmentId] as const,
  templates: () => ["/api/sensor-templates"] as const,
  heartbeats: () => ["/api/heartbeats"] as const,
};

export function useTelemetryReadings(
  equipmentId: string | undefined,
  sensorType?: string,
  hours: number = 24
) {
  return useQuery<TelemetryReading[]>({
    queryKey: [...telemetryKeys.readings(equipmentId || "", sensorType), hours],
    queryFn: () => {
      const params = new URLSearchParams({ hours: String(hours) });
      if (sensorType) {
        params.append("sensorType", sensorType);
      }
      return apiRequest("GET", `/api/telemetry/readings/${equipmentId}?${params}`);
    },
    enabled: !!equipmentId,
    refetchInterval: 120000,
  });
}

export function useLatestTelemetry(equipmentId: string | undefined) {
  return useQuery<Record<string, TelemetryReading>>({
    queryKey: telemetryKeys.latest(equipmentId || ""),
    queryFn: () => apiRequest("GET", `/api/telemetry/latest/${equipmentId}`),
    enabled: !!equipmentId,
    refetchInterval: 60000,
  });
}

export function useSensorConfigurations(equipmentId?: string) {
  return useQuery<SensorConfiguration[]>({
    queryKey: [...telemetryKeys.configs(), equipmentId ?? "all"],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/sensor-configurations${equipmentId ? `?equipmentId=${equipmentId}` : ""}`
      ),
  });
}

export function useSensorStates(equipmentId?: string) {
  return useQuery<SensorState[]>({
    queryKey: telemetryKeys.states(equipmentId ?? "all"),
    queryFn: () =>
      apiRequest("GET", `/api/sensor-states${equipmentId ? `?equipmentId=${equipmentId}` : ""}`),
    refetchInterval: 60000,
  });
}

export function useSensorTemplates() {
  return useQuery<SensorTemplate[]>({
    queryKey: telemetryKeys.templates(),
    queryFn: () => apiRequest("GET", "/api/sensor-templates"),
  });
}

export function useDeviceHeartbeats(limit?: number) {
  return useQuery<DeviceHeartbeat[]>({
    queryKey: [...telemetryKeys.heartbeats(), limit ?? "all"],
    queryFn: () => apiRequest("GET", `/api/heartbeats${limit ? `?limit=${limit}` : ""}`),
    refetchInterval: 120000,
  });
}

export function useCreateSensorConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<SensorConfiguration, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/sensor-configurations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: telemetryKeys.configs() });
    },
  });
}

export function useUpdateSensorConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<SensorConfiguration> & { id: string }) => {
      return apiRequest("PATCH", `/api/sensor-configurations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: telemetryKeys.configs() });
    },
  });
}

export function useApplySensorTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      templateId,
      equipmentId,
    }: {
      templateId: string;
      equipmentId: string;
    }) => {
      return apiRequest("POST", `/api/sensor-templates/${templateId}/apply`, { equipmentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: telemetryKeys.configs() });
    },
  });
}

export function useCreateSensorTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<SensorTemplate, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/sensor-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: telemetryKeys.templates() });
    },
  });
}
