/**
 * Maintenance Domain - Domain Types
 * Pure domain types without infrastructure dependencies
 */

export interface MaintenanceScheduleEntity {
  id: string;
  orgId: string;
  equipmentId: string;
  scheduledDate: Date;
  status: "scheduled" | "in_progress" | "completed" | "cancelled" | "overdue";
  priority: "low" | "medium" | "high" | "critical";
  maintenanceType: string;
  description?: string | undefined;
  estimatedDuration?: number | undefined;
  assignedTo?: string | undefined;
  completedAt?: Date | undefined;
  completedBy?: string | undefined;
  notes?: string | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export interface MaintenanceTemplateEntity {
  id: string;
  orgId: string;
  name: string;
  equipmentType?: string | undefined;
  maintenanceType: string;
  description?: string | undefined;
  estimatedDuration?: number | undefined;
  requiredParts?: string[] | undefined;
  checklistItems?: string[] | undefined;
  intervalDays?: number | undefined;
  intervalHours?: number | undefined;
  isActive: boolean;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export interface CreateScheduleCommand {
  orgId: string;
  equipmentId: string;
  scheduledDate: Date;
  status?: string | undefined;
  priority?: string | undefined;
  maintenanceType: string;
  description?: string | undefined;
  estimatedDuration?: number | undefined;
  assignedTo?: string | undefined;
}

export interface UpdateScheduleCommand {
  scheduledDate?: Date | undefined;
  status?: string | undefined;
  priority?: string | undefined;
  maintenanceType?: string | undefined;
  description?: string | undefined;
  estimatedDuration?: number | undefined;
  assignedTo?: string | undefined;
  notes?: string | undefined;
}

export interface CreateTemplateCommand {
  orgId: string;
  name: string;
  equipmentType?: string | undefined;
  maintenanceType: string;
  description?: string | undefined;
  estimatedDuration?: number | undefined;
  requiredParts?: string[] | undefined;
  checklistItems?: string[] | undefined;
  intervalDays?: number | undefined;
  intervalHours?: number | undefined;
  isActive?: boolean | undefined;
}

export interface UpdateTemplateCommand {
  name?: string | undefined;
  equipmentType?: string | undefined;
  maintenanceType?: string | undefined;
  description?: string | undefined;
  estimatedDuration?: number | undefined;
  requiredParts?: string[] | undefined;
  checklistItems?: string[] | undefined;
  intervalDays?: number | undefined;
  intervalHours?: number | undefined;
  isActive?: boolean | undefined;
}
