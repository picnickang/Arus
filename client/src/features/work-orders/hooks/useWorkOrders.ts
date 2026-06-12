import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WorkOrderListItem as WorkOrder } from "../types";

const workOrderKeys = {
  all: ["/api/work-orders"] as const,
  list: () => [...workOrderKeys.all] as const,
};

export function useWorkOrders(filters?: {
  status?: string;
  equipmentId?: string;
  vesselId?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) {
    params.append("status", filters.status);
  }
  if (filters?.equipmentId) {
    params.append("equipmentId", filters.equipmentId);
  }
  if (filters?.vesselId) {
    params.append("vesselId", filters.vesselId);
  }
  const queryString = params.toString();
  const filterKey = `${filters?.status ?? "all"}_${filters?.equipmentId ?? "all"}_${filters?.vesselId ?? "all"}`;

  return useQuery<WorkOrder[]>({
    queryKey: [...workOrderKeys.list(), filterKey],
    queryFn: () =>
      apiRequest<WorkOrder[]>("GET", `/api/work-orders${queryString ? `?${queryString}` : ""}`),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
