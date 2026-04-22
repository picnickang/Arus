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
  description?: string;
  estimatedDuration?: number;
  assignedTo?: string;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MaintenanceTemplateEntity {
  id: string;
  orgId: string;
  name: string;
  equipmentType?: string;
  maintenanceType: string;
  description?: string;
  estimatedDuration?: number;
  requiredParts?: string[];
  checklistItems?: string[];
  intervalDays?: number;
  intervalHours?: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateScheduleCommand {
  orgId: string;
  equipmentId: string;
  scheduledDate: Date;
  status?: string;
  priority?: string;
  maintenanceType: string;
  description?: string;
  estimatedDuration?: number;
  assignedTo?: string;
}

export interface UpdateScheduleCommand {
  scheduledDate?: Date;
  status?: string;
  priority?: string;
  maintenanceType?: string;
  description?: string;
  estimatedDuration?: number;
  assignedTo?: string;
  notes?: string;
}

export interface CreateTemplateCommand {
  orgId: string;
  name: string;
  equipmentType?: string;
  maintenanceType: string;
  description?: string;
  estimatedDuration?: number;
  requiredParts?: string[];
  checklistItems?: string[];
  intervalDays?: number;
  intervalHours?: number;
  isActive?: boolean;
}

export interface UpdateTemplateCommand {
  name?: string;
  equipmentType?: string;
  maintenanceType?: string;
  description?: string;
  estimatedDuration?: number;
  requiredParts?: string[];
  checklistItems?: string[];
  intervalDays?: number;
  intervalHours?: number;
  isActive?: boolean;
}
