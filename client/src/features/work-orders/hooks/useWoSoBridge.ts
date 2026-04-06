/**
 * WO ↔ SO Bridge — Frontend Hooks
 *
 * useWorkOrderServiceOrders(workOrderId)
 *   → Fetches all service orders linked to a work order
 *
 * useServiceOrderWorkOrder(serviceOrderId)
 *   → Fetches the linked work order for a service order
 *
 * useCreateServiceOrderFromWO()
 *   → Creates a service order pre-linked to a work order
 *
 * useLinkServiceOrderToWO()
 *   → Retroactively links an existing SO to a WO
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LinkedServiceOrder {
  id: string;
  soNumber: string;
  status: string;
  serviceProviderId: string | null;
  serviceProviderName: string | null;
  supplierProfileId: string | null;
  scope: string | null;
  serviceDetails: string | null;
  specialRequirements: string | null;
  quotedAmount: number | null;
  actualAmount: number | null;
  revisedAmount: number | null;
  revisionNotes: string | null;
  currency: string | null;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  estimatedDurationHours: number | null;
  actualDurationHours: number | null;
  sentAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  vesselName: string | null;
  equipmentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedWorkOrder {
  id: string;
  workOrderNumber: string;
  description: string;
  status: string;
  priority: string | number;
  equipmentId: string | null;
  equipmentName: string | null;
  vesselId: string | null;
  vesselName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CreateSOFromWOPayload {
  workOrderId: string;
  serviceProviderId?: string;
  serviceProviderName?: string;
  scope?: string;
  estimatedCost?: number;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  estimatedDurationHours?: number;
  severity?: string;
  notes?: string;
  updateWorkOrderStatus?: boolean;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Fetch all service orders linked to a work order.
 * Returns { serviceOrders, count, workOrderId }.
 */
export function useWorkOrderServiceOrders(workOrderId: string | null | undefined) {
  return useQuery<{
    workOrderId: string;
    serviceOrders: LinkedServiceOrder[];
    count: number;
  }>({
    queryKey: ["/api/work-orders", workOrderId, "service-orders"],
    queryFn: () => apiRequest("GET", `/api/work-orders/${workOrderId}/service-orders`),
    enabled: !!workOrderId,
    staleTime: 30000,
  });
}

/**
 * Fetch the linked work order for a service order.
 * Returns { workOrder, linked }.
 */
export function useServiceOrderWorkOrder(serviceOrderId: string | null | undefined) {
  return useQuery<{
    workOrder: LinkedWorkOrder | null;
    linked: boolean;
  }>({
    queryKey: ["/api/service-orders", serviceOrderId, "work-order"],
    queryFn: () => apiRequest("GET", `/api/service-orders/${serviceOrderId}/work-order`),
    enabled: !!serviceOrderId,
    staleTime: 30000,
  });
}

/**
 * Create a service order pre-linked to a work order.
 * The work order status is optionally updated to "awaiting_service".
 */
export function useCreateServiceOrderFromWO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateSOFromWOPayload) => {
      const { workOrderId, ...body } = payload;
      return apiRequest("POST", `/api/work-orders/${workOrderId}/service-orders`, body);
    },
    onSuccess: (_, variables) => {
      // Invalidate both WO and SO queries
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", variables.workOrderId, "service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-orders"] });
    },
  });
}

/**
 * Retroactively link an existing service order to a work order.
 */
export function useLinkServiceOrderToWO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceOrderId, workOrderId }: { serviceOrderId: string; workOrderId: string }) => {
      return apiRequest("PATCH", `/api/service-orders/${serviceOrderId}/link-work-order`, { workOrderId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-orders", variables.serviceOrderId, "work-order"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", variables.workOrderId, "service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-orders"] });
    },
  });
}

/**
 * Sync work order status after a service order status change.
 * Call this after completing or cancelling a service order.
 */
export function useSyncWOStatusFromSO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serviceOrderId: string) => {
      return apiRequest("POST", `/api/service-orders/${serviceOrderId}/sync-work-order-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
  });
}
