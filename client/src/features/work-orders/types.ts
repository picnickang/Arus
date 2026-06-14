export interface WorkOrderPartRecord {
  id: string;
  workOrderId: string;
  partId: string;
  partName: string;
  quantity: number;
  unitCost?: number;
  status: "required" | "reserved" | "used" | "returned";
}

export interface WorkOrderChecklist {
  id: string;
  workOrderId: string;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  description: string;
  isCompleted: boolean;
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
}

export interface WorkOrderWorklog {
  id: string;
  workOrderId: string;
  crewId: string;
  crewName: string;
  description: string;
  hoursWorked: number;
  workDate: Date;
  createdAt?: Date;
}

export const WORK_ORDER_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const WORK_ORDER_STATUSES = [
  "open",
  "in_progress",
  "on_hold",
  "awaiting_service",
  "completed",
  "cancelled",
] as const;
export const WORK_ORDER_TYPES = ["corrective", "preventive", "predictive", "emergency"] as const;

export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];

export interface MaintenanceCost {
  id: string;
  costType: "labor" | "parts" | "equipment" | "downtime";
  amount: number;
  currency: string;
  description?: string;
  vendor?: string;
}

export interface PartCost {
  partNo: string;
  partName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface LaborEntry {
  laborType: "standard" | "overtime" | "emergency";
  hours: number;
  costPerHour: number;
  totalCost: number;
  description: string;
}
