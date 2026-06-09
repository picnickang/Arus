import {
  equipmentNameFor,
  type EquipmentRecord,
  type RegistrySectionAssignmentRecord,
  type RegistrySectionMapRecord,
  type RegistrySummaryRecord,
} from "./data";

export type FleetEquipmentMatchStatus = "live" | "registry_only";

export interface FleetSectionEquipmentSummary {
  sectionKey: string;
  sectionName: string;
  sectionNo: number;
  equipment: FleetSectionEquipmentItem[];
}

export interface FleetSectionEquipmentItem {
  equipmentId: string | null;
  equipmentName: string;
  matchStatus: FleetEquipmentMatchStatus;
}

function activeSectionMap(
  summary: RegistrySummaryRecord | undefined
): RegistrySectionMapRecord | undefined {
  return summary?.activeSectionMap ?? summary?.sectionMaps?.[0];
}

function stableEquipmentId(equipment: EquipmentRecord | undefined): string | null {
  return equipment?.id ?? equipment?.equipmentId ?? equipment?.assetCode ?? null;
}

function findLiveEquipment(
  assignment: RegistrySectionAssignmentRecord,
  vesselEquipment: EquipmentRecord[]
): EquipmentRecord | undefined {
  const assignmentId = assignment.equipmentId?.trim() || undefined;
  const assignmentAssetCode = assignment.assetCode?.trim() || undefined;
  const assignmentName = assignment.equipmentName.toLowerCase();
  return vesselEquipment.find((item) => {
    const ids = [item.id, item.equipmentId, item.assetCode, item.tagNumber]
      .map((id) => id?.trim())
      .filter((id): id is string => Boolean(id));
    if (assignmentId && ids.includes(assignmentId)) {
      return true;
    }
    if (assignmentAssetCode && ids.includes(assignmentAssetCode)) {
      return true;
    }
    return equipmentNameFor(item).toLowerCase() === assignmentName;
  });
}

export function buildFleetSectionEquipmentSummary(
  summary: RegistrySummaryRecord | undefined,
  vesselEquipment: EquipmentRecord[]
): FleetSectionEquipmentSummary[] {
  const map = activeSectionMap(summary);
  if (!map) {
    return [];
  }
  return map.sections.map((section) => ({
    sectionKey: section.sectionKey,
    sectionName: section.name,
    sectionNo: section.sectionNo,
    equipment: section.equipment.map((assignment) => {
      const live = findLiveEquipment(assignment, vesselEquipment);
      return {
        equipmentId: stableEquipmentId(live) ?? assignment.equipmentId ?? null,
        equipmentName: assignment.equipmentName,
        matchStatus: live ? "live" : "registry_only",
      };
    }),
  }));
}
