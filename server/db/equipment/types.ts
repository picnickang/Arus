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
  vesselId?: string | undefined;
  equipmentId?: string | undefined;
  category?: string | undefined;
  status?: string | undefined;
}
export interface EquipmentHealth {
  id: string;
  equipmentId?: string | undefined;
  name: string;
  type: string;
  category?: string | undefined;
  status: string;
  riskScore?: number | undefined;
  lastReading?: Date | undefined;
  alertCount?: number | undefined;
  vesselId?: string | undefined;
  vesselName?: string | undefined;
  vessel?: string | undefined;
  healthIndex: number;
  predictedDueDays: number;
}
