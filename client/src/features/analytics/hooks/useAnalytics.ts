import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  AnalyticsDashboard,
  FailurePrediction,
  AnomalyDetection,
  ThresholdOptimization,
  TrendPeriod,
} from "../types";

export const analyticsKeys = {
  all: ["/api/analytics"] as const,
  dashboard: (period: TrendPeriod) => [...analyticsKeys.all, "dashboard", period] as const,
  predictions: () => [...analyticsKeys.all, "predictions"] as const,
  anomalies: () => [...analyticsKeys.all, "anomalies"] as const,
  thresholds: () => [...analyticsKeys.all, "thresholds"] as const,
  trends: (equipmentId: string, period: TrendPeriod) =>
    [...analyticsKeys.all, "trends", equipmentId, period] as const,
  mlModels: () => ["/api/analytics/ml-models"] as const,
};

export function useAnalyticsDashboard(period: TrendPeriod = "30d") {
  return useQuery<AnalyticsDashboard>({
    queryKey: analyticsKeys.dashboard(period),
    queryFn: () =>
      apiRequest<AnalyticsDashboard>("GET", `/api/analytics/dashboard?period=${period}`),
    staleTime: 60000,
  });
}

export function useFailurePredictions(equipmentId?: string) {
  return useQuery<FailurePrediction[]>({
    queryKey: [...analyticsKeys.predictions(), equipmentId],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/analytics/failure-predictions${equipmentId ? `?equipmentId=${equipmentId}` : ""}`
      ),
  });
}

export function useAnomalyDetections(filters?: { equipmentId?: string; isAcknowledged?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.equipmentId) {
    params.append("equipmentId", filters.equipmentId);
  }
  if (filters?.isAcknowledged !== undefined) {
    params.append("isAcknowledged", String(filters.isAcknowledged));
  }
  const queryString = params.toString();
  const filterKey = `${filters?.equipmentId ?? "all"}_${filters?.isAcknowledged ?? "all"}`;

  return useQuery<AnomalyDetection[]>({
    queryKey: [...analyticsKeys.anomalies(), filterKey],
    queryFn: () =>
      apiRequest<AnomalyDetection[]>(
        "GET",
        `/api/analytics/anomaly-detections${queryString ? `?${queryString}` : ""}`
      ),
  });
}

export function useThresholdOptimizations(status?: string) {
  return useQuery<ThresholdOptimization[]>({
    queryKey: [...analyticsKeys.thresholds(), status ?? "all"],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/analytics/threshold-optimizations${status ? `?status=${status}` : ""}`
      ),
  });
}

export function useEquipmentTrends(equipmentId: string | undefined, period: TrendPeriod = "30d") {
  return useQuery({
    queryKey: analyticsKeys.trends(equipmentId || "", period),
    queryFn: () => apiRequest("GET", `/api/analytics/trends/${equipmentId}?period=${period}`),
    enabled: !!equipmentId,
  });
}

export function useMLModels(orgId?: string) {
  return useQuery({
    queryKey: [...analyticsKeys.mlModels(), orgId ?? "all"],
    queryFn: () => apiRequest("GET", `/api/analytics/ml-models${orgId ? `?orgId=${orgId}` : ""}`),
  });
}

export function useRunFailurePrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipmentId: string) => {
      return apiRequest("POST", "/api/ml/predict/failure", { equipmentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.predictions() });
    },
  });
}

export function useAcknowledgeAnomaly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/analytics/anomaly-detections/${id}/acknowledge`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.anomalies() });
    },
  });
}

export function useApplyThresholdOptimization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, orgId }: { id: string; orgId: string }) => {
      return apiRequest("PATCH", `/api/analytics/threshold-optimizations/${id}/apply`, { orgId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.thresholds() });
    },
  });
}

export function useRejectThresholdOptimization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("PATCH", `/api/analytics/threshold-optimizations/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.thresholds() });
    },
  });
}
