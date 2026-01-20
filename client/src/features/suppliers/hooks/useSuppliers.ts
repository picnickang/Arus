import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Supplier, SupplierWithStats, SupplierFormData, SupplierFilters, VendorType } from "../types";

export const supplierKeys = {
  all: ["/api/suppliers"] as const,
  list: (filters?: SupplierFilters) => [...supplierKeys.all, "list", filters] as const,
  detail: (id: string) => [...supplierKeys.all, id] as const,
  stats: () => [...supplierKeys.all, "stats"] as const,
  preferred: () => [...supplierKeys.all, "preferred"] as const,
  byType: (type: VendorType | VendorType[]) => [...supplierKeys.all, "type", type] as const,
};

export function useSuppliers(filters?: SupplierFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.search) queryParams.append("search", filters.search);
  if (filters?.isActive !== undefined) queryParams.append("isActive", String(filters.isActive));
  if (filters?.isPreferred !== undefined) queryParams.append("isPreferred", String(filters.isPreferred));
  if (filters?.type) {
    const types = Array.isArray(filters.type) ? filters.type.join(",") : filters.type;
    queryParams.append("type", types);
  }
  if (filters?.limit) queryParams.append("limit", String(filters.limit));
  if (filters?.offset) queryParams.append("offset", String(filters.offset));

  const queryString = queryParams.toString();
  const url = `/api/suppliers${queryString ? `?${queryString}` : ""}`;

  return useQuery<Supplier[]>({
    queryKey: supplierKeys.list(filters),
    queryFn: () => apiRequest("GET", url),
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery<Supplier>({
    queryKey: supplierKeys.detail(id || ""),
    queryFn: () => apiRequest("GET", `/api/suppliers/${id}`),
    enabled: !!id,
  });
}

export function useSuppliersWithStats() {
  return useQuery<SupplierWithStats[]>({
    queryKey: supplierKeys.stats(),
    queryFn: () => apiRequest("GET", "/api/suppliers/stats"),
  });
}

export function usePreferredSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: supplierKeys.preferred(),
    queryFn: () => apiRequest("GET", "/api/suppliers/preferred"),
  });
}

export function useSuppliersOnly() {
  return useQuery<Supplier[]>({
    queryKey: supplierKeys.byType(["supplier", "both"]),
    queryFn: () => apiRequest("GET", "/api/suppliers?type=supplier,both"),
  });
}

export function useServiceProviders() {
  return useQuery<Supplier[]>({
    queryKey: supplierKeys.byType(["service_provider", "both"]),
    queryFn: () => apiRequest("GET", "/api/suppliers?type=service_provider,both"),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SupplierFormData) => {
      return apiRequest("POST", "/api/suppliers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<SupplierFormData> & { id: string }) => {
      return apiRequest("PATCH", `/api/suppliers/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/suppliers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.all });
    },
  });
}
