/**
 * Maintenance - Types
 */

export interface MaintenanceFilters {
  equipmentId?: string | undefined;
  vesselId?: string | undefined;
  status?: string | undefined;
  type?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}
