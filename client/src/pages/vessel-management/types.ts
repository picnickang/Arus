import type { Equipment } from "@shared/schema";
import type { EquipmentHealth } from "@/lib/api/equipment";

// Canonical EquipmentHealth lives in the API layer; re-exported here so existing
// imports from this module keep working without a duplicate definition.
export type { EquipmentHealth };

export interface EquipmentWithHealth extends Equipment {
  health?: EquipmentHealth;
}

export interface RawHealthItem {
  id: string;
  vesselId?: string;
  vessel?: string;
  name: string;
  type: string;
  healthIndex?: number;
  healthScore?: number;
  predictedDueDays?: number;
  status?: "healthy" | "warning" | "critical";
  condition?: string;
}
