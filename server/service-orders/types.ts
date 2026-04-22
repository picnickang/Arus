import { serviceOrders, insertServiceOrderSchema, serviceOrderEvents } from "@shared/schema";
import { z } from "zod";

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;
export type ServiceOrderEvent = typeof serviceOrderEvents.$inferSelect;

export type ServiceOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export const SERVICE_ORDER_STATUSES: ServiceOrderStatus[] = [
  "draft",
  "sent",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];

export const SERVICE_ORDER_STATUS_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export type ServiceOrderEventType =
  | "created"
  | "sent"
  | "confirmed"
  | "started"
  | "completed"
  | "cancelled"
  | "updated";

export interface ServiceOrderWithDetails extends ServiceOrder {
  workOrderNumber?: string;
  workOrderDescription?: string;
  serviceProviderName?: string;
  serviceProviderEmail?: string;
  vesselName?: string;
  equipmentName?: string;
}

export interface ServiceOrderListFilters {
  status?: ServiceOrderStatus;
  serviceProviderId?: string;
  vesselId?: string;
  workOrderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GenerateSoNumberResult {
  soNumber: string;
}
