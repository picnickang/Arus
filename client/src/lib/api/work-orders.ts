import { apiRequest } from "../queryClient";
import type { WorkOrder } from "@shared/schema";

export async function fetchWorkOrders(filters?: {
  equipmentId?: string;
  vesselId?: string;
  engineerId?: string;
}): Promise<WorkOrder[]> {
  const params = new URLSearchParams();
  if (filters?.equipmentId) {
    params.append("equipmentId", filters.equipmentId);
  }
  if (filters?.vesselId) {
    params.append("vesselId", filters.vesselId);
  }
  if (filters?.engineerId) {
    params.append("engineerId", filters.engineerId);
  }
  const queryString = params.toString();
  const url = queryString ? `/api/work-orders?${queryString}` : "/api/work-orders";
  return apiRequest("GET", url);
}
