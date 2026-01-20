import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { AlertConfiguration, AlertNotification, AlertThreshold } from "../types";

export const alertKeys = {
  all: ["/api/alerts"] as const,
  configurations: () => [...alertKeys.all, "configurations"] as const,
  notifications: () => [...alertKeys.all, "notifications"] as const,
  thresholds: () => ["/api/alert-settings/thresholds"] as const,
  unacknowledged: () => [...alertKeys.notifications(), "unacknowledged"] as const,
};

export function useAlertConfigurations(equipmentId?: string) {
  return useQuery<AlertConfiguration[]>({
    queryKey: [...alertKeys.configurations(), equipmentId ?? "all"],
    queryFn: () => apiRequest("GET", `/api/alerts/configurations${equipmentId ? `?equipmentId=${equipmentId}` : ""}`),
  });
}

export function useAlertNotifications(filters?: { severity?: string; isAcknowledged?: boolean; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.severity) {params.append("severity", filters.severity);}
  if (filters?.isAcknowledged !== undefined) {params.append("isAcknowledged", String(filters.isAcknowledged));}
  if (filters?.limit) {params.append("limit", String(filters.limit));}
  const queryString = params.toString();
  const filterKey = `${filters?.severity ?? "all"}_${filters?.isAcknowledged ?? "all"}_${filters?.limit ?? "all"}`;
  
  return useQuery<AlertNotification[]>({
    queryKey: [...alertKeys.notifications(), filterKey],
    queryFn: () => apiRequest("GET", `/api/alerts/notifications${queryString ? `?${queryString}` : ""}`),
  });
}

export function useUnacknowledgedAlerts() {
  return useQuery<AlertNotification[]>({
    queryKey: alertKeys.unacknowledged(),
    queryFn: () => apiRequest("GET", "/api/alerts/notifications?isAcknowledged=false"),
    refetchInterval: 120000,
  });
}

export function useAlertThresholds() {
  return useQuery<AlertThreshold[]>({
    queryKey: alertKeys.thresholds(),
    queryFn: () => apiRequest("GET", "/api/alert-settings/thresholds"),
  });
}

export function useCreateAlertConfiguration() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<AlertConfiguration, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/alerts/configurations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.configurations() });
    },
  });
}

export function useUpdateAlertConfiguration() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AlertConfiguration> & { id: string }) => {
      return apiRequest("PATCH", `/api/alerts/configurations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.configurations() });
    },
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/alerts/notifications/${id}/acknowledge`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.notifications() });
    },
  });
}

export function useAcknowledgeAllAlerts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/alerts/notifications/acknowledge-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.notifications() });
    },
  });
}

export function useDeleteAllAlerts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/alerts/all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.notifications() });
    },
  });
}

export function useUpdateAlertThreshold() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ key, ...data }: AlertThreshold) => {
      return apiRequest("PUT", `/api/alert-settings/thresholds/${encodeURIComponent(key)}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.thresholds() });
    },
  });
}
