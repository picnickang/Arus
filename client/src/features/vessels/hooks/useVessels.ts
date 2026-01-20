import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Vessel, Equipment, Device } from "../types";

export const vesselKeys = {
  all: ["/api/vessels"] as const,
  lists: () => [...vesselKeys.all] as const,
  detail: (id: string) => [...vesselKeys.all, id] as const,
  equipment: (vesselId: string) => [...vesselKeys.all, vesselId, "equipment"] as const,
  devices: (vesselId: string) => [...vesselKeys.all, vesselId, "devices"] as const,
};

export const equipmentKeys = {
  all: ["/api/equipment"] as const,
  list: () => [...equipmentKeys.all] as const,
  detail: (id: string) => [...equipmentKeys.all, id] as const,
  health: () => [...equipmentKeys.all, "health"] as const,
  telemetry: (equipmentId: string) => [...equipmentKeys.all, equipmentId, "telemetry"] as const,
};

export const deviceKeys = {
  all: ["/api/devices"] as const,
  list: () => [...deviceKeys.all] as const,
  detail: (id: string) => [...deviceKeys.all, id] as const,
};

export function useVessels() {
  return useQuery<Vessel[]>({
    queryKey: vesselKeys.lists(),
    queryFn: () => apiRequest("GET", "/api/vessels"),
  });
}

export function useVessel(id: string | undefined) {
  return useQuery<Vessel>({
    queryKey: vesselKeys.detail(id || ""),
    queryFn: () => apiRequest("GET", `/api/vessels/${id}`),
    enabled: !!id,
  });
}

export function useVesselEquipment(vesselId: string | undefined) {
  return useQuery<Equipment[]>({
    queryKey: vesselKeys.equipment(vesselId || ""),
    queryFn: () => apiRequest("GET", `/api/vessels/${vesselId}/equipment`),
    enabled: !!vesselId,
  });
}

export function useEquipmentList() {
  return useQuery<Equipment[]>({
    queryKey: equipmentKeys.list(),
    queryFn: () => apiRequest("GET", "/api/equipment"),
  });
}

export function useEquipment(id: string | undefined) {
  return useQuery<Equipment>({
    queryKey: equipmentKeys.detail(id || ""),
    queryFn: () => apiRequest("GET", `/api/equipment/${id}`),
    enabled: !!id,
  });
}

export function useEquipmentHealth() {
  return useQuery<Array<Equipment & { healthScore: number }>>({
    queryKey: equipmentKeys.health(),
    queryFn: () => apiRequest("GET", "/api/equipment/health"),
  });
}

export function useDevices() {
  return useQuery<Device[]>({
    queryKey: deviceKeys.list(),
    queryFn: () => apiRequest("GET", "/api/devices"),
  });
}

export function useCreateVessel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<Vessel, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/vessels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vesselKeys.all });
    },
  });
}

export function useUpdateVessel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Vessel> & { id: string }) => {
      return apiRequest("PATCH", `/api/vessels/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vesselKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: vesselKeys.lists() });
    },
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<Equipment, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/equipment", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
      queryClient.invalidateQueries({ queryKey: vesselKeys.equipment(variables.vesselId) });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Equipment> & { id: string }) => {
      return apiRequest("PATCH", `/api/equipment/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
    },
  });
}

export function useExportVesselData() {
  return useMutation({
    mutationFn: async (vesselId: string) => {
      return apiRequest("GET", `/api/vessels/${vesselId}/export`);
    },
  });
}

export function useImportVesselData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/vessels/import", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vesselKeys.all });
    },
  });
}
