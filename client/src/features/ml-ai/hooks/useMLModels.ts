import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MLModel, TrainingJob, InsightReport, RULPrediction } from "../types";

export const mlKeys = {
  all: ["/api/ml"] as const,
  models: (orgId?: string) => [...mlKeys.all, "models", orgId] as const,
  modelDetail: (id: string) => [...mlKeys.all, "models", id] as const,
  trainingJobs: () => [...mlKeys.all, "training-jobs"] as const,
  insights: () => ["/api/insights"] as const,
  reports: () => ["/api/insight-reports"] as const,
  rul: (equipmentId?: string) => [...mlKeys.all, "rul", equipmentId] as const,
};

export function useMLModels(orgId?: string) {
  return useQuery<MLModel[]>({
    queryKey: mlKeys.models(orgId ?? "all"),
    queryFn: () => apiRequest("GET", `/api/analytics/ml-models${orgId ? `?orgId=${orgId}` : ""}`),
  });
}

export function useMLModel(id: string | undefined) {
  return useQuery<MLModel>({
    queryKey: mlKeys.modelDetail(id || ""),
    queryFn: () => apiRequest("GET", `/api/ml/models/${id}`),
    enabled: !!id,
  });
}

export function useTrainingJobs() {
  return useQuery<TrainingJob[]>({
    queryKey: mlKeys.trainingJobs(),
    queryFn: () => apiRequest("GET", "/api/ml/training-jobs"),
    refetchInterval: 60000,
  });
}

export function useInsightReports(limit?: number) {
  return useQuery<InsightReport[]>({
    queryKey: [...mlKeys.reports(), limit ?? "all"],
    queryFn: () => apiRequest("GET", `/api/insight-reports${limit ? `?limit=${limit}` : ""}`),
  });
}

export function useRULPredictions(equipmentId?: string) {
  return useQuery<RULPrediction[]>({
    queryKey: mlKeys.rul(equipmentId ?? ""),
    queryFn: () => apiRequest("GET", `/api/equipment/${equipmentId}/rul`),
    enabled: !!equipmentId,
  });
}

export function useStartTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: {
      modelType: string;
      targetMetric: string;
      equipmentType?: string;
      dataWindowDays?: number;
    }) => {
      return apiRequest("POST", "/api/ml/train", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mlKeys.trainingJobs() });
    },
  });
}

export function useCancelTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/ml/training-jobs/${jobId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mlKeys.trainingJobs() });
    },
  });
}

export function useActivateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest("POST", `/api/ml/models/${modelId}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mlKeys.models() });
    },
  });
}

export function useDeprecateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest("POST", `/api/ml/models/${modelId}/deprecate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mlKeys.models() });
    },
  });
}

export function useGenerateInsightReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: { reportType: string; vesselId?: string; periodDays?: number }) => {
      return apiRequest("POST", "/api/insights/generate", config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mlKeys.reports() });
    },
  });
}

export function useRunPrediction() {
  return useMutation({
    mutationFn: async (equipmentId: string) => {
      return apiRequest("POST", "/api/ml/predict/failure", { equipmentId });
    },
  });
}
