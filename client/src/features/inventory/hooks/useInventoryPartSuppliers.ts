import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Supplier } from "../types";

export interface SupplierLink {
  id: string;
  inventoryItemId: string;
  supplierId: string;
  supplierPartNumber?: string | null;
  unitCost?: number | null;
  leadTimeDays?: number | null;
  isPreferred?: boolean | null;
  notes?: string | null;
  createdAt?: string | null;
  supplier?: Supplier;
}

export interface LinkSupplierInput {
  supplierId: string;
  supplierPartNumber?: string;
  unitCost?: number;
  leadTimeDays?: number;
  isPreferred?: boolean;
  notes?: string;
}

export const inventorySupplierKeys = {
  all: ["/api/inventory", "suppliers"] as const,
  forItem: (inventoryItemId: string) => [...inventorySupplierKeys.all, inventoryItemId] as const,
  forSupplier: (supplierId: string) => ["/api/suppliers", supplierId, "inventory-items"] as const,
};

export interface SupplierLinkWithName extends SupplierLink {
  supplierName?: string;
}

export function useInventoryPartSuppliers(
  inventoryItemId: string | undefined,
  options?: { enabled?: boolean }
) {
  const shouldFetch = options?.enabled !== undefined ? options.enabled : !!inventoryItemId;

  return useQuery<SupplierLinkWithName[]>({
    queryKey: inventorySupplierKeys.forItem(inventoryItemId || ""),
    queryFn: () =>
      apiRequest<SupplierLinkWithName[]>("GET", `/api/inventory/${inventoryItemId}/suppliers`),
    enabled: !!inventoryItemId && shouldFetch,
  });
}

export function useLinkSupplier(inventoryItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LinkSupplierInput) =>
      apiRequest("POST", `/api/inventory/${inventoryItemId}/suppliers`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventorySupplierKeys.forItem(inventoryItemId) });
    },
  });
}

export function useBulkLinkSuppliers(inventoryItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (supplierIds: string[]) =>
      apiRequest("POST", `/api/inventory/${inventoryItemId}/suppliers/bulk`, { supplierIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventorySupplierKeys.forItem(inventoryItemId) });
    },
  });
}

export function useReplaceSupplierLinks(inventoryItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (supplierIds: string[]) =>
      apiRequest("PUT", `/api/inventory/${inventoryItemId}/suppliers/replace`, { supplierIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventorySupplierKeys.forItem(inventoryItemId) });
    },
  });
}

export function useUpdateSupplierLink(inventoryItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ linkId, data }: { linkId: string; data: Partial<LinkSupplierInput> }) =>
      apiRequest("PATCH", `/api/inventory/supplier-links/${linkId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventorySupplierKeys.forItem(inventoryItemId) });
    },
  });
}

export function useUnlinkSupplier(inventoryItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => apiRequest("DELETE", `/api/inventory/supplier-links/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventorySupplierKeys.forItem(inventoryItemId) });
    },
  });
}

export function useSetPreferredSupplier(inventoryItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (supplierId: string) =>
      apiRequest("POST", `/api/inventory/${inventoryItemId}/suppliers/preferred`, { supplierId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventorySupplierKeys.forItem(inventoryItemId) });
    },
  });
}
