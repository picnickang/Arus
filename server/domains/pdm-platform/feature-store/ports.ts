import type { EquipmentFeature } from "@shared/schema";

export interface FeatureStorePort {
  computeAndStore(
    orgId: string,
    equipmentId: string,
    windowMinutes?: number
  ): Promise<EquipmentFeature>;
  getLatest(orgId: string, equipmentId: string): Promise<EquipmentFeature | null>;
  getHistory(orgId: string, equipmentId: string, from: Date, to: Date): Promise<EquipmentFeature[]>;
}
