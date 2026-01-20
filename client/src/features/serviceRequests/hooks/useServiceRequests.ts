import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ServiceRequest, SRFilters } from "../types";

function normalizeFilters(filters: SRFilters = {}): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = { work_order_type: "service_request" };
  if (filters.status) {
    result.status = filters.status;
  }

  if (filters.priority) {
    result.priority = filters.priority;
  }

  if (filters.vesselId) {
    result.vesselId = filters.vesselId;
  }

  if (filters.equipmentId) {
    result.equipmentId = filters.equipmentId;
  }

  if (filters.search) {
    result.search = filters.search;
  }
  return result;
}

export const srKeys = {
  all: ["/api/work-orders"] as const,
  list: (filters?: SRFilters) => ["/api/work-orders", normalizeFilters(filters)] as const,
  detail: (id: string) => [`/api/work-orders/${id}`] as const,
};

export function useServiceRequests(filters: SRFilters = {}) {
  return useQuery<ServiceRequest[]>({
    queryKey: srKeys.list(filters),
  });
}

export function useServiceRequest(id: string | undefined) {
  return useQuery<ServiceRequest>({
    queryKey: id ? srKeys.detail(id) : ["__disabled__"],
    enabled: !!id,
  });
}

export function useCreateServiceRequest() {
  return useMutation({
    mutationFn: (data: Partial<ServiceRequest>) =>
      apiRequest("POST", "/api/work-orders", { ...data, workOrderType: "service_request" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: srKeys.all }),
  });
}

export function useUpdateServiceRequest() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServiceRequest> }) =>
      apiRequest("PATCH", `/api/work-orders/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: srKeys.all }),
  });
}

export function useCreateServiceOrderFromSR() {
  return useMutation({
    mutationFn: ({ workOrderId, data }: { workOrderId: string; data: { serviceProviderId: string; scope: string } }) =>
      apiRequest("POST", `/api/work-orders/${workOrderId}/service-orders`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: srKeys.all });
      queryClient.invalidateQueries({ queryKey: ["/api/service-orders"] });
    },
  });
}

export function useCreatePRFromSR() {
  return useMutation({
    mutationFn: ({ workOrderId, data }: { workOrderId: string; data: { requestedBy: string } }) =>
      apiRequest("POST", `/api/work-orders/${workOrderId}/purchase-requests`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: srKeys.all });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
    },
  });
}
