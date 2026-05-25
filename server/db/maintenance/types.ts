/**
 * Maintenance - Types
 */

export type {
  MaintenanceSchedule,
  InsertMaintenanceSchedule,
  MaintenanceRecord,
  InsertMaintenanceRecord,
  MaintenanceCost,
  InsertMaintenanceCost,
  MaintenanceTemplate,
  InsertMaintenanceTemplate,
} from "@shared/schema-runtime";

export interface MaintenanceFilters {
  equipmentId?: string | undefined;
  vesselId?: string | undefined;
  status?: string | undefined;
  type?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}
