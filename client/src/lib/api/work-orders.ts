import { apiRequest } from "../queryClient";
import type { WorkOrder, InsertWorkOrder } from "@shared/schema";

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

export async function createWorkOrder(order: InsertWorkOrder): Promise<WorkOrder> {
  return apiRequest("POST", "/api/work-orders", order);
}

export async function updateWorkOrder(
  id: string,
  order: Partial<InsertWorkOrder>
): Promise<WorkOrder> {
  return apiRequest("PUT", `/api/work-orders/${id}`, order);
}
