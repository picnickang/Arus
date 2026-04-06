import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ServiceRequest, SRFilters } from "../types";

export const srKeys = {
  all: ["/api/service-requests"] as const,
  list: (filters?: SRFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.workOrderId) params.set("workOrderId", filters.workOrderId);
    if (filters?.sortBy) params.set("sortBy", filters.sortBy);
    const qs = params.toString();
    return ["/api/service-requests", qs ? `?${qs}` : ""] as const;
  },
  detail: (id: string) => ["/api/service-requests", id] as const,
  forWorkOrder: (woId: string) => ["/api/work-orders", woId, "service-requests"] as const,
};

export function useServiceRequests(filters: SRFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.workOrderId) params.set("workOrderId", filters.workOrderId);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  const qs = params.toString();

  return useQuery<ServiceRequest[]>({
    queryKey: srKeys.list(filters),
    queryFn: () => apiRequest("GET", `/api/service-requests${qs ? `?${qs}` : ""}`),
  });
}

export function useWorkOrderServiceRequests(workOrderId: string | null | undefined) {
  return useQuery<{ workOrderId: string; serviceRequests: ServiceRequest[]; count: number }>({
    queryKey: srKeys.forWorkOrder(workOrderId || ""),
    queryFn: () => apiRequest("GET", `/api/work-orders/${workOrderId}/service-requests`),
    enabled: !!workOrderId,
    staleTime: 30000,
  });
}

export function useCreateServiceRequest() {
  return useMutation({
    mutationFn: ({ workOrderId, data }: { workOrderId: string; data: { title: string; description?: string; urgency?: string; estimatedCost?: number } }) =>
      apiRequest("POST", `/api/work-orders/${workOrderId}/service-requests`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: srKeys.all });
      queryClient.invalidateQueries({ queryKey: srKeys.forWorkOrder(variables.workOrderId) });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
  });
}

export function useReviewServiceRequest() {
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/service-requests/${id}/review`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: srKeys.all });
    },
  });
}

export function useApproveServiceRequest() {
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/service-requests/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: srKeys.all });
    },
  });
}

export function useRejectServiceRequest() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiRequest("POST", `/api/service-requests/${id}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: srKeys.all });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
  });
}

export function useConvertServiceRequest() {
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: { serviceProviderId: string; scope?: string; estimatedCost?: number; scheduledStartDate?: string; scheduledEndDate?: string };
    }) => apiRequest("POST", `/api/service-requests/${id}/convert`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: srKeys.all });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-orders"] });
    },
  });
}
