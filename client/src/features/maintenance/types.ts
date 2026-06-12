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

// Re-export form-data types defined alongside their zod schemas.
// These are imported from `../types` by hooks (per project convention) but
// physically live in `../lib/*Utils` next to the schemas they're derived from.
export type { TemplateFormData, ChecklistItemFormData } from "./lib/templateUtils";
export type { PdmAlert, PdmBaseline, AnalysisResult, BearingFormData } from "./lib/pdmUtils";
