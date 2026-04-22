import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  Part,
  InventoryPart,
  Stock,
  InventoryMovement,
  Supplier,
  PurchaseOrder,
} from "../types";

export const inventoryKeys = {
  all: ["/api/parts-inventory"] as const,
  parts: () => ["/api/parts"] as const,
  partDetail: (id: string) => [...inventoryKeys.parts(), id] as const,
  stock: (vesselId?: string) => [...inventoryKeys.all, "stock", vesselId] as const,
  movements: (partId?: string) => [...inventoryKeys.all, "movements", partId] as const,
  suppliers: () => ["/api/suppliers"] as const,
  purchaseOrders: () => ["/api/purchase-orders"] as const,
  lowStock: () => [...inventoryKeys.all, "low-stock"] as const,
};

export function useParts(searchTerm?: string) {
  return useQuery<Part[]>({
    queryKey: [...inventoryKeys.parts(), searchTerm ?? "all"],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/parts${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`
      ),
  });
}

export function usePart(id: string | undefined) {
  return useQuery<Part>({
    queryKey: inventoryKeys.partDetail(id || ""),
    queryFn: () => apiRequest("GET", `/api/parts/${id}`),
    enabled: !!id,
  });
}

export function useInventoryParts(vesselId?: string) {
  return useQuery<InventoryPart[]>({
    queryKey: inventoryKeys.stock(vesselId ?? "all"),
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/parts-inventory${vesselId ? `?vesselId=${vesselId}` : ""}`
      );
      return Array.isArray(response) ? response : (response?.items ?? []);
    },
  });
}

export function useStock(vesselId?: string) {
  return useQuery<Stock[]>({
    queryKey: inventoryKeys.stock(vesselId ?? "all"),
    queryFn: () => apiRequest("GET", `/api/stock${vesselId ? `?vesselId=${vesselId}` : ""}`),
  });
}

export function useLowStockItems() {
  return useQuery<Part[]>({
    queryKey: inventoryKeys.lowStock(),
    queryFn: () => apiRequest("GET", "/api/parts-inventory/low-stock"),
  });
}

export function useInventoryMovements(partId?: string) {
  return useQuery<InventoryMovement[]>({
    queryKey: inventoryKeys.movements(partId ?? ""),
    queryFn: () =>
      apiRequest("GET", `/api/inventory-movements${partId ? `?partId=${partId}` : ""}`),
    enabled: !!partId,
  });
}

export function useSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: inventoryKeys.suppliers(),
    queryFn: () => apiRequest("GET", "/api/suppliers"),
  });
}

export function usePurchaseOrders(status?: string) {
  return useQuery<PurchaseOrder[]>({
    queryKey: [...inventoryKeys.purchaseOrders(), status ?? "all"],
    queryFn: () => apiRequest("GET", `/api/purchase-orders${status ? `?status=${status}` : ""}`),
  });
}

export function useCreatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Part, "id" | "createdAt" | "updatedAt">) => {
      return apiRequest("POST", "/api/parts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.parts() });
    },
  });
}

export function useUpdatePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Part> & { id: string }) => {
      return apiRequest("PATCH", `/api/parts/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.partDetail(variables.id) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.parts() });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      partId: string;
      vesselId?: string;
      adjustment: number;
      reason: string;
    }) => {
      return apiRequest("POST", "/api/stock/adjust", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useTransferStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      partId: string;
      fromVesselId: string;
      toVesselId: string;
      quantity: number;
    }) => {
      return apiRequest("POST", "/api/stock/transfer", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<PurchaseOrder, "id">) => {
      return apiRequest("POST", "/api/purchase-orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders() });
    },
  });
}
