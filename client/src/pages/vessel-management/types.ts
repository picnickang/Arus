import type { Equipment } from "@shared/schema";

export interface EquipmentHealth {
  equipmentId: string;
  healthScore: number;
  status: string;
  [key: string]: unknown;
}

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
