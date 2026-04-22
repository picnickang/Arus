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
  equipmentId?: string;
  vesselId?: string;
  status?: string;
  type?: string;
  startDate?: Date;
  endDate?: Date;
}
