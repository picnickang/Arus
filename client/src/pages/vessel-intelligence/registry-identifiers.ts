import type { EquipmentRecord } from "./data";

export function equipmentIdForThumbnail(equipment: EquipmentRecord): string | null {
  return equipment.id ?? equipment.equipmentId ?? equipment.assetCode ?? equipment.name ?? null;
}
