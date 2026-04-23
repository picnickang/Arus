import type { Equipment } from "@shared/schema";

export interface EquipmentHealth {
  equipmentId: string;
  healthScore: number;
  status: string;
  [key: string]: unknown;
}

export type EquipmentItem = Equipment & {
  health?: EquipmentHealth;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installDate?: Date | string | null;
  lastMaintenanceDate?: Date | string | null;
  notes?: string | null;
};

export type GetVesselName = (id: string | null) => string | null;

export interface CertSummary {
  id: string;
  equipmentId?: string | null;
  certificateName?: string;
  certificateType?: string;
  status?: string;
  expiryDate?: string | Date | null;
  issuingAuthority?: string;
  certificateNumber?: string;
}
