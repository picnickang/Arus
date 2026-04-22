/**
 * Equipment - Types
 */

export type {
  Equipment,
  InsertEquipment,
  EquipmentLifecycle,
  InsertEquipmentLifecycle,
} from "@shared/schema-runtime";

export interface EquipmentHealthFilters {
  vesselId?: string;
  category?: string;
  status?: string;
}
export interface EquipmentHealth {
  id: string;
  name: string;
  type: string;
  category?: string;
  status: string;
  riskScore?: number;
  lastReading?: Date;
  alertCount?: number;
  vesselId?: string;
  vesselName?: string;
}
