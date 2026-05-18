import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ServiceOrder, SOFilters, SOEvent } from "../types";

function normalizeFilters(filters: SOFilters = {}): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  if (filters.status) {
    result.status = filters.status;
  }

  if (filters.serviceProviderId) {
    result.serviceProviderId = filters.serviceProviderId;
  }

  if (filters.workOrderId) {
    result.workOrderId = filters.workOrderId;
  }

  if (filters.dateFrom) {
    result.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    result.dateTo = filters.dateTo;
  }
  return result;
}

export const soKeys = {
  all: ["/api/service-orders"] as const,
  list: (filters?: SOFilters) => ["/api/service-orders", normalizeFilters(filters)] as const,
  detail: (id: string) => [`/api/service-orders/${id}`] as const,
  events: (id: string) => [`/api/service-orders/${id}/events`] as const,
};

export function useServiceOrders(filters: SOFilters = {}) {
  return useQuery<ServiceOrder[]>({
    queryKey: soKeys.list(filters),
  });
}

export function useServiceOrder(id: string | undefined) {
  return useQuery<ServiceOrder>({
    queryKey: id ? soKeys.detail(id) : ["__disabled__"],
    enabled: !!id,
  });
}

export function useServiceOrderEvents(soId: string | undefined) {
  return useQuery<SOEvent[]>({
    queryKey: soId ? soKeys.events(soId) : ["__disabled__"],
    enabled: !!soId,
  });
}

export function useCreateServiceOrder() {
  return useMutation({
    mutationFn: (data: Partial<ServiceOrder>) => apiRequest("POST", "/api/service-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soKeys.all });
    },
  });
}

export function useUpdateServiceOrder() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ServiceOrder> }) =>
      apiRequest("PATCH", `/api/service-orders/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: soKeys.all });
      queryClient.invalidateQueries({ queryKey: soKeys.detail(id) });
    },
  });
}

export function useSendServiceOrder() {
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/service-orders/${id}/send`, {}),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: soKeys.all });
      queryClient.invalidateQueries({ queryKey: soKeys.detail(id) });
    },
  });
}

export function useConfirmServiceOrder() {
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/service-orders/${id}/confirm`, {}),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: soKeys.all });
      queryClient.invalidateQueries({ queryKey: soKeys.detail(id) });
    },
  });
}

export function useStartServiceOrder() {
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/service-orders/${id}/start`, {}),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: soKeys.all });
      queryClient.invalidateQueries({ queryKey: soKeys.detail(id) });
    },
  });
}

export function useCompleteServiceOrder() {
  return useMutation({
    mutationFn: ({
      id,
      actualAmount,
      actualDurationHours,
    }: {
      id: string;
      actualAmount?: number;
      actualDurationHours?: number;
    }) =>
      apiRequest("POST", `/api/service-orders/${id}/complete`, {
        actualAmount,
        actualDurationHours,
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: soKeys.all });
      queryClient.invalidateQueries({ queryKey: soKeys.detail(id) });
    },
  });
}

export function useCancelServiceOrder() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiRequest("POST", `/api/service-orders/${id}/cancel`, { reason }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: soKeys.all });
      queryClient.invalidateQueries({ queryKey: soKeys.detail(id) });
    },
  });
}

export function useRevertServiceOrder() {
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/service-orders/${id}/revert-to-request`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soKeys.all });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
  });
}
