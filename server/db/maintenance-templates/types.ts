/**
 * Maintenance Templates - Types
 */

export type { MaintenanceTemplate, InsertMaintenanceTemplate, MaintenanceChecklistItem, InsertMaintenanceChecklistItem, WorkOrderChecklist, InsertWorkOrderChecklist, PdmScoreLog, InsertPdmScoreLog, MaintenanceSchedule, InsertMaintenanceSchedule } from "@shared/schema-runtime";

import type { MaintenanceChecklistItem, InsertMaintenanceChecklistItem } from "@shared/schema";
// Backwards compatibility aliases
export type ChecklistItem = MaintenanceChecklistItem;
export type InsertChecklistItem = InsertMaintenanceChecklistItem;
