import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ServiceOrderCardData } from "../components/ServiceOrderCard";
import type { PartsRequestCardData } from "../components/PartsRequestCard";

const ORG_ID = "default-org-id";

export function useWorkOrderRequests(workOrderId: string) {
  const { toast } = useToast();

  const serviceOrdersQuery = useQuery<ServiceOrderCardData[]>({
    queryKey: ["/api/work-orders", workOrderId, "service-orders"],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/service-orders`, {
        headers: { "x-org-id": ORG_ID },
      });
      if (!res.ok) throw new Error("Failed to fetch service orders");
      return res.json();
    },
  });

  const purchaseRequestsQuery = useQuery<PartsRequestCardData[]>({
    queryKey: ["/api/work-orders", workOrderId, "purchase-requests"],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/purchase-requests`, {
        headers: { "x-org-id": ORG_ID },
      });
      if (!res.ok) throw new Error("Failed to fetch purchase requests");
      return res.json();
    },
  });

  const createServiceOrderMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      const payload = {
        serviceProviderId: data.serviceProviderId,
        scheduledStartDate: data.scheduledStartDate ?? data.requestedStartDate,
        scheduledEndDate: data.scheduledEndDate ?? data.requestedEndDate,
        scope: data.symptomDescription || data.scope,
        serviceDetails: {
          equipmentIds: data.equipmentIds,
          severity: data.severity,
          assistanceTags: data.assistanceTags,
          probableCause: data.probableCause,
          actionTakenSoFar: data.actionTakenSoFar,
          isRecurringDefect: data.isRecurringDefect,
          mocRequired: data.mocRequired,
          mocNumber: data.mocNumber,
          certificateItems: data.certificateItems,
        },
        estimatedDurationHours: data.estimatedDurationHours,
        quotedAmount: data.quotedAmount,
        specialRequirements: data.specialRequirements ?? data.notes,
      };
      return apiRequest("POST", `/api/work-orders/${workOrderId}/service-orders`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "service-orders"] });
      toast({ title: "Service Order Created", description: "The service order has been created successfully." });
    },
    onError: (err) => toast({ title: "Error Creating Service Order", description: String(err), variant: "destructive" }),
  });

  const createPurchaseRequestMutation = useMutation({
    mutationFn: (data: { notes?: string; items: Array<{ partId?: string; description: string; quantity: number; notes?: string }> }) =>
      apiRequest("POST", `/api/work-orders/${workOrderId}/purchase-requests`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "purchase-requests"] });
      toast({ title: "Purchase Request Created", description: "The purchase request has been created successfully." });
    },
    onError: (err) => toast({ title: "Error Creating Purchase Request", description: String(err), variant: "destructive" }),
  });

  const deleteServiceOrderMutation = useMutation({
    mutationFn: async (soId: string) => {
      const res = await fetch(`/api/service-orders/${soId}`, {
        method: "DELETE",
        headers: { "x-org-id": ORG_ID },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete service order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "service-orders"] });
      toast({ title: "Service Order Deleted", description: "The service order has been deleted." });
    },
    onError: (err) => toast({ title: "Error Deleting Service Order", description: String(err), variant: "destructive" }),
  });

  const deletePurchaseRequestMutation = useMutation({
    mutationFn: async (prId: string) => {
      const res = await fetch(`/api/purchase-requests/${prId}`, {
        method: "DELETE",
        headers: { "x-org-id": ORG_ID },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete purchase request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "purchase-requests"] });
      toast({ title: "Purchase Request Deleted", description: "The purchase request has been deleted." });
    },
    onError: (err) => toast({ title: "Error Deleting Purchase Request", description: String(err), variant: "destructive" }),
  });

  const fulfillItemMutation = useMutation({
    mutationFn: async ({ prId, itemId, quantity }: { prId: string; itemId: string; quantity: number }) => {
      const res = await fetch(`/api/purchase-requests/${prId}/items/${itemId}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-org-id": ORG_ID },
        body: JSON.stringify({ quantityToFulfill: quantity }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fulfill item");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Item Fulfilled",
        description: data.inventoryUpdated
          ? `Fulfilled ${data.quantityFulfilled} units. Stock updated to ${data.newStockLevel}.`
          : `Fulfilled ${data.quantityFulfilled} units.`,
      });
    },
    onError: (err) => toast({ title: "Error Fulfilling Item", description: String(err), variant: "destructive" }),
  });

  const updatePRStatusMutation = useMutation({
    mutationFn: async ({ prId, status }: { prId: string; status: string }) => {
      const res = await fetch(`/api/purchase-requests/${prId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-org-id": ORG_ID },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "purchase-requests"] });
      toast({ title: "Status Updated", description: "Purchase request status has been updated." });
    },
    onError: (err) => toast({ title: "Error Updating Status", description: String(err), variant: "destructive" }),
  });

  const updateServiceOrderMutation = useMutation({
    mutationFn: async ({ soId, data }: { soId: string; data: Record<string, unknown> }) => {
      const payload: Record<string, unknown> = {};
      
      if (data.serviceProviderId) payload.serviceProviderId = data.serviceProviderId;
      if (data.requestedStartDate) payload.scheduledStartDate = data.requestedStartDate;
      if (data.requestedEndDate) payload.scheduledEndDate = data.requestedEndDate;
      if (data.symptomDescription || data.scope) payload.scope = data.symptomDescription || data.scope;
      if (data.estimatedDurationHours) payload.estimatedDurationHours = data.estimatedDurationHours;
      if (data.quotedAmount) payload.quotedAmount = data.quotedAmount;
      if (data.notes) payload.specialRequirements = data.notes;
      
      if (data.equipmentIds || data.severity || data.assistanceTags || data.probableCause || 
          data.actionTakenSoFar || data.isRecurringDefect !== undefined || 
          data.mocRequired !== undefined || data.mocNumber || data.certificateItems) {
        payload.serviceDetails = {
          equipmentIds: data.equipmentIds,
          severity: data.severity,
          assistanceTags: data.assistanceTags,
          probableCause: data.probableCause,
          actionTakenSoFar: data.actionTakenSoFar,
          isRecurringDefect: data.isRecurringDefect,
          mocRequired: data.mocRequired,
          mocNumber: data.mocNumber,
          certificateItems: data.certificateItems,
        };
      }
      
      const res = await fetch(`/api/service-orders/${soId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-org-id": ORG_ID },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update service order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "service-orders"] });
      toast({ title: "Service Order Updated", description: "The service order has been updated." });
    },
    onError: (err) => toast({ title: "Error Updating Service Order", description: String(err), variant: "destructive" }),
  });

  const updatePurchaseRequestMutation = useMutation({
    mutationFn: async ({ prId, data }: { prId: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/purchase-requests/${prId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-org-id": ORG_ID },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update purchase request");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "purchase-requests"] });
      toast({ title: "Purchase Request Updated", description: "The purchase request has been updated." });
    },
    onError: (err) => toast({ title: "Error Updating Purchase Request", description: String(err), variant: "destructive" }),
  });

  const bulkDeleteServiceOrdersMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/service-orders/bulk/by-work-order/${workOrderId}`, {
        method: "DELETE",
        headers: { "x-org-id": ORG_ID },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete service orders");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "service-orders"] });
      const msg = data.skippedCount > 0
        ? `Deleted ${data.deletedCount} service orders. ${data.skippedCount} could not be deleted.`
        : `Deleted ${data.deletedCount} service orders.`;
      toast({ title: "Service Orders Cleared", description: msg });
    },
    onError: (err) => toast({ title: "Error Clearing Service Orders", description: String(err), variant: "destructive" }),
  });

  const bulkDeletePurchaseRequestsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/purchase-requests/bulk/by-work-order/${workOrderId}`, {
        method: "DELETE",
        headers: { "x-org-id": ORG_ID },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete purchase requests");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders", workOrderId, "purchase-requests"] });
      const msg = data.skippedCount > 0
        ? `Deleted ${data.deletedCount} purchase requests. ${data.skippedCount} could not be deleted.`
        : `Deleted ${data.deletedCount} purchase requests.`;
      toast({ title: "Purchase Requests Cleared", description: msg });
    },
    onError: (err) => toast({ title: "Error Clearing Purchase Requests", description: String(err), variant: "destructive" }),
  });

  return {
    serviceOrders: serviceOrdersQuery.data || [],
    isLoadingServiceOrders: serviceOrdersQuery.isLoading,
    purchaseRequests: purchaseRequestsQuery.data || [],
    isLoadingPurchaseRequests: purchaseRequestsQuery.isLoading,
    createServiceOrder: createServiceOrderMutation.mutate,
    isCreatingServiceOrder: createServiceOrderMutation.isPending,
    createPurchaseRequest: createPurchaseRequestMutation.mutate,
    isCreatingPurchaseRequest: createPurchaseRequestMutation.isPending,
    deleteServiceOrder: deleteServiceOrderMutation.mutate,
    isDeletingServiceOrder: deleteServiceOrderMutation.isPending,
    deletingServiceOrderId: deleteServiceOrderMutation.variables,
    deletePurchaseRequest: deletePurchaseRequestMutation.mutate,
    isDeletingPurchaseRequest: deletePurchaseRequestMutation.isPending,
    deletingPurchaseRequestId: deletePurchaseRequestMutation.variables,
    fulfillItem: fulfillItemMutation.mutate,
    isFulfillingItem: fulfillItemMutation.isPending,
    updatePRStatus: updatePRStatusMutation.mutate,
    isUpdatingPRStatus: updatePRStatusMutation.isPending,
    updateServiceOrder: updateServiceOrderMutation.mutate,
    isUpdatingServiceOrder: updateServiceOrderMutation.isPending,
    updatePurchaseRequest: updatePurchaseRequestMutation.mutate,
    isUpdatingPurchaseRequest: updatePurchaseRequestMutation.isPending,
    bulkDeleteServiceOrders: bulkDeleteServiceOrdersMutation.mutate,
    isBulkDeletingServiceOrders: bulkDeleteServiceOrdersMutation.isPending,
    bulkDeletePurchaseRequests: bulkDeletePurchaseRequestsMutation.mutate,
    isBulkDeletingPurchaseRequests: bulkDeletePurchaseRequestsMutation.isPending,
  };
}
