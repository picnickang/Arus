import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  SystemSettings,
  IntegrationConfig,
  AuditEvent,
  TransportSettings,
  StorageConfig,
} from "../types";

export const settingsKeys = {
  all: ["/api/settings"] as const,
  system: () => [...settingsKeys.all, "system"] as const,
  integrations: () => [...settingsKeys.all, "integrations"] as const,
  audit: () => ["/api/admin/audit"] as const,
  transport: () => ["/api/transport-settings"] as const,
  storage: () => ["/api/storage/config"] as const,
};

export function useSystemSettings(category?: string) {
  return useQuery<SystemSettings[]>({
    queryKey: [...settingsKeys.system(), category ?? "all"],
    queryFn: () => apiRequest<SystemSettings[]>("GET", `/api/settings${category ? `?category=${category}` : ""}`),
  });
}

export function useIntegrationConfigs() {
  return useQuery<IntegrationConfig[]>({
    queryKey: settingsKeys.integrations(),
    queryFn: () => apiRequest<IntegrationConfig[]>("GET", "/api/integrations"),
  });
}

export function useAuditEvents(filters?: {
  eventType?: string;
  entityType?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.eventType) {
    params.append("eventType", filters.eventType);
  }
  if (filters?.entityType) {
    params.append("entityType", filters.entityType);
  }
  if (filters?.limit) {
    params.append("limit", String(filters.limit));
  }
  const queryString = params.toString();
  const filterKey = `${filters?.eventType ?? "all"}_${filters?.entityType ?? "all"}_${filters?.limit ?? "all"}`;

  return useQuery<AuditEvent[]>({
    queryKey: [...settingsKeys.audit(), filterKey],
    queryFn: () => apiRequest<AuditEvent[]>("GET", `/api/admin/audit${queryString ? `?${queryString}` : ""}`),
  });
}

export function useTransportSettings() {
  return useQuery<TransportSettings>({
    queryKey: settingsKeys.transport(),
    queryFn: () => apiRequest<TransportSettings>("GET", "/api/transport-settings"),
  });
}

export function useStorageConfig() {
  return useQuery<StorageConfig>({
    queryKey: settingsKeys.storage(),
    queryFn: () => apiRequest<StorageConfig>("GET", "/api/storage/config"),
  });
}

export function useUpdateSystemSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      return apiRequest("PUT", `/api/settings/${encodeURIComponent(key)}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.system() });
    },
  });
}

export function useUpdateIntegrationConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<IntegrationConfig> & { id: string }) => {
      return apiRequest("PATCH", `/api/integrations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.integrations() });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: async (integrationId: string) => {
      return apiRequest("POST", `/api/integrations/${integrationId}/test`);
    },
  });
}

export function useSyncIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      return apiRequest("POST", `/api/integrations/${integrationId}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.integrations() });
    },
  });
}

export function useUpdateTransportSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<TransportSettings>) => {
      return apiRequest("PUT", "/api/transport-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.transport() });
    },
  });
}

export function useUpdateStorageConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<StorageConfig>) => {
      return apiRequest("POST", "/api/storage/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.storage() });
    },
  });
}

export function useTestStorageConfig() {
  return useMutation({
    mutationFn: async (config: Partial<StorageConfig>) => {
      return apiRequest("POST", "/api/storage/config/test", config);
    },
  });
}
