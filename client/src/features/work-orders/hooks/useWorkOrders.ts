import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WorkOrder, WorkOrderPart, WorkOrderChecklist, WorkOrderWorklog } from "../types";

export const workOrderKeys = {
  all: ["/api/work-orders"] as const,
  list: () => [...workOrderKeys.all] as const,
  detail: (id: string) => [...workOrderKeys.all, id] as const,
  parts: (id: string) => [...workOrderKeys.all, id, "parts"] as const,
  checklists: (id: string) => [...workOrderKeys.all, id, "checklists"] as const,
  worklogs: (id: string) => [...workOrderKeys.all, id, "worklogs"] as const,
};

export function useWorkOrders(filters?: { status?: string; equipmentId?: string; vesselId?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) { params.append("status", filters.status); }
  if (filters?.equipmentId) { params.append("equipmentId", filters.equipmentId); }
  if (filters?.vesselId) { params.append("vesselId", filters.vesselId); }
  const queryString = params.toString();
  const filterKey = `${filters?.status ?? "all"}_${filters?.equipmentId ?? "all"}_${filters?.vesselId ?? "all"}`;
  
  return useQuery<WorkOrder[]>({
    queryKey: [...workOrderKeys.list(), filterKey],
    queryFn: () => apiRequest("GET", `/api/work-orders${queryString ? `?${queryString}` : ""}`),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useWorkOrder(id: string | undefined) {
  return useQuery<WorkOrder>({
    queryKey: workOrderKeys.detail(id || ""),
    queryFn: () => apiRequest("GET", `/api/work-orders/${id}`),
    enabled: !!id,
  });
}

export function useWorkOrderParts(workOrderId: string | undefined) {
  return useQuery<WorkOrderPart[]>({
    queryKey: workOrderKeys.parts(workOrderId || ""),
    queryFn: () => apiRequest("GET", `/api/work-orders/${workOrderId}/parts`),
    enabled: !!workOrderId,
  });
}

export function useWorkOrderChecklists(workOrderId: string | undefined) {
  return useQuery<WorkOrderChecklist[]>({
    queryKey: workOrderKeys.checklists(workOrderId || ""),
    queryFn: () => apiRequest("GET", `/api/work-orders/${workOrderId}/checklists`),
    enabled: !!workOrderId,
  });
}

export function useWorkOrderWorklogs(workOrderId: string | undefined) {
  return useQuery<WorkOrderWorklog[]>({
    queryKey: workOrderKeys.worklogs(workOrderId || ""),
    queryFn: () => apiRequest("GET", `/api/work-orders/${workOrderId}/worklogs`),
    enabled: !!workOrderId,
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Omit<WorkOrder, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/work-orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.all });
    },
  });
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<WorkOrder> & { id: string }) => {
      return apiRequest("PATCH", `/api/work-orders/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: workOrderKeys.list() });
    },
  });
}

export interface CompleteWorkOrderInput {
  id: string;
  completionNotes?: string;
  actualHours?: number;
  predictionFeedback?: {
    workOrderId: string;
    predictionId?: string | number | null;
    outcome: "confirmed" | "partial" | "false_alarm";
    notes?: string;
  };
}

export function useCompleteWorkOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, completionNotes, actualHours, predictionFeedback }: CompleteWorkOrderInput) => {
      return apiRequest("POST", `/api/work-orders/${id}/complete-with-feedback`, {
        completionNotes,
        actualHours,
        predictionFeedback,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: workOrderKeys.list() });
      queryClient.invalidateQueries({ queryKey: ["/api/work-order-completions"] });
    },
  });
}

export function useAddWorkOrderPart() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ workOrderId, ...data }: Omit<WorkOrderPart, "id"> & { workOrderId: string }) => {
      return apiRequest("POST", `/api/work-orders/${workOrderId}/parts`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.parts(variables.workOrderId) });
    },
  });
}

export function useAddWorklog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ workOrderId, ...data }: Omit<WorkOrderWorklog, "id" | "createdAt"> & { workOrderId: string }) => {
      return apiRequest("POST", `/api/work-orders/${workOrderId}/worklogs`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.worklogs(variables.workOrderId) });
    },
  });
}

export function useCloneWorkOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/work-orders/${id}/clone`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workOrderKeys.all });
    },
  });
}
