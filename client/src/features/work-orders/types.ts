export interface WorkOrder {
  id: string;
  orgId: string;
  vesselId: string;
  equipmentId: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "critical" | number;
  status: "open" | "in_progress" | "on_hold" | "awaiting_service" | "completed" | "cancelled" | string;
  type: "corrective" | "preventive" | "predictive" | "emergency" | string;
  assignedTo?: string;
  dueDate?: Date | string | null;
  completedAt?: Date | string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  createdBy?: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  woNumber?: string | null;
  reason?: string | null;
  assignedCrewId?: string | null;
  plannedStartDate?: Date | string | null;
  plannedEndDate?: Date | string | null;
  actualStartDate?: Date | string | null;
  actualEndDate?: Date | string | null;
  maintenanceType?: string | null;
  workOrderType?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  totalCost?: number | null;
  totalPartsCost?: number | null;
  totalLaborCost?: number | null;
  laborHours?: number | null;
  laborCost?: number | null;
  notes?: string | null;
  scheduleId?: string | null;
}

export interface WorkOrderPart {
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
