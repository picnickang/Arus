import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  PurchaseRequest,
  PRWithItems,
  PRFilters,
  PRFormData,
  PRItemFormData,
  PRSendResult,
} from "../types";

export const prKeys = {
  all: ["/api/purchase-requests"] as const,
  list: (filters?: PRFilters) => [...prKeys.all, "list", filters] as const,
  detail: (id: string) => [...prKeys.all, id] as const,
};

export function usePurchaseRequests(filters?: PRFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.status) {
    queryParams.append("status", filters.status);
  }
  if (filters?.vesselId) {
    queryParams.append("vesselId", filters.vesselId);
  }
  if (filters?.requestedBy) {
    queryParams.append("requestedBy", filters.requestedBy);
  }
  if (filters?.fromDate) {
    queryParams.append("fromDate", filters.fromDate.toISOString());
  }
  if (filters?.toDate) {
    queryParams.append("toDate", filters.toDate.toISOString());
  }
  if (filters?.limit) {
    queryParams.append("limit", String(filters.limit));
  }
  if (filters?.offset) {
    queryParams.append("offset", String(filters.offset));
  }

  const queryString = queryParams.toString();
  const url = `/api/purchase-requests${queryString ? `?${queryString}` : ""}`;

  return useQuery<PurchaseRequest[]>({
    queryKey: prKeys.list(filters),
    queryFn: () => apiRequest<PurchaseRequest[]>("GET", url),
  });
}

export function usePurchaseRequest(id: string | undefined) {
  return useQuery<PRWithItems>({
    queryKey: prKeys.detail(id || ""),
    queryFn: () => apiRequest<PRWithItems>("GET", `/api/purchase-requests/${id}`),
    enabled: !!id,
  });
}

export interface PurchaseRequestRecord {
  id: string;
  prNumber?: string;
  status?: string;
  requestedBy?: string;
  notes?: string;
  createdAt?: string | Date;
  [key: string]: unknown;
}

export function useCreatePR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PRFormData) =>
      apiRequest<PurchaseRequestRecord>("POST", "/api/purchase-requests", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: prKeys.all }),
  });
}

export function useUpdatePR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<PRFormData> & { id: string }) =>
      apiRequest("PATCH", `/api/purchase-requests/${id}`, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: prKeys.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: prKeys.all });
    },
  });
}

export function useAddPRItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ prId, ...data }: PRItemFormData & { prId: string }) =>
      apiRequest("POST", `/api/purchase-requests/${prId}/items`, data),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: prKeys.detail(vars.prId) }),
  });
}

export function useRemovePRItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ prId, itemId }: { prId: string; itemId: string }) =>
      apiRequest("DELETE", `/api/purchase-requests/${prId}/items/${itemId}`),
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: prKeys.detail(vars.prId) }),
  });
}

export function useSendPR() {
  const queryClient = useQueryClient();
  return useMutation<PRSendResult, Error, string>({
    mutationFn: (prId: string) => apiRequest("POST", `/api/purchase-requests/${prId}/send`),
    onSuccess: (_, prId) => {
      queryClient.invalidateQueries({ queryKey: prKeys.detail(prId) });
      queryClient.invalidateQueries({ queryKey: prKeys.all });
    },
  });
}

export function useCancelPR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prId: string) => apiRequest("POST", `/api/purchase-requests/${prId}/cancel`),
    onSuccess: (_, prId) => {
      queryClient.invalidateQueries({ queryKey: prKeys.detail(prId) });
      queryClient.invalidateQueries({ queryKey: prKeys.all });
    },
  });
}

export function useClosePR() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prId: string) => apiRequest("POST", `/api/purchase-requests/${prId}/close`),
    onSuccess: (_, prId) => {
      queryClient.invalidateQueries({ queryKey: prKeys.detail(prId) });
      queryClient.invalidateQueries({ queryKey: prKeys.all });
    },
  });
}
