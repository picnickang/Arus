export interface MaintenanceSchedule {
  id: string;
  orgId: string;
  equipmentId: string;
  templateId?: string;
  title: string;
  description?: string;
  scheduleType: "time" | "running_hours" | "condition";
  intervalDays?: number;
  intervalHours?: number;
  conditionTrigger?: string;
  lastCompletedDate?: Date;
  scheduledDate: Date;
  priority: "low" | "medium" | "high" | "critical";
  estimatedDuration?: number;
  assignedTo?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MaintenanceRecord {
  id: string;
  scheduleId?: string;
  equipmentId: string;
  workOrderId?: string;
  completedDate: Date;
  completedBy: string;
  duration?: number;
  notes?: string;
  partsUsed?: string[];
  cost?: number;
}

export interface MaintenanceTemplate {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  equipmentType?: string;
  scheduleType: "time" | "running_hours" | "condition";
  defaultIntervalDays?: number;
  defaultIntervalHours?: number;
  estimatedDuration?: number;
  requiredParts?: string[];
  requiredSkills?: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MaintenanceTemplateItem {
  id: string;
  templateId: string;
  stepNumber: number;
  description: string;
  estimatedMinutes?: number;
  requiresPhoto?: boolean;
  requiresSignature?: boolean;
}

export interface MaintenanceCost {
  id: string;
  workOrderId?: string;
  equipmentId: string;
  costType: "labor" | "parts" | "external" | "other";
  amount: number;
  description?: string;
  incurredDate: Date;
  createdBy?: string;
}

export const SCHEDULE_TYPES = ["time", "running_hours", "condition"] as const;
export const COST_TYPES = ["labor", "parts", "external", "other"] as const;

export type ScheduleType = (typeof SCHEDULE_TYPES)[number];
export type CostType = (typeof COST_TYPES)[number];

// Re-export form-data types defined alongside their zod schemas.
// These are imported from `../types` by hooks (per project convention) but
// physically live in `../lib/*Utils` next to the schemas they're derived from.
export type { TemplateFormData, ChecklistItemFormData } from "./lib/templateUtils";
export type {
  PdmAlert,
  PdmBaseline,
  AnalysisResult,
  BearingFormData,
  PumpFormData,
} from "./lib/pdmUtils";
