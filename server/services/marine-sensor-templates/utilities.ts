/**
 * Marine Sensor Template Utilities
 * 
 * Helper functions for template management.
 */

import type { EquipmentTemplateMap, SensorTemplate } from "./types.js";
import { EQUIPMENT_SENSOR_TEMPLATES } from "./index.js";

export function mergeEquipmentTemplates(
  base: EquipmentTemplateMap,
  custom: EquipmentTemplateMap
): EquipmentTemplateMap {
  return { ...base, ...custom };
}

export function getAvailableEquipmentTypes(): string[] {
  return Object.keys(EQUIPMENT_SENSOR_TEMPLATES).sort((a, b) => a.localeCompare(b));
}

export function hasTemplateForType(equipmentType: string): boolean {
  return equipmentType.toLowerCase() in EQUIPMENT_SENSOR_TEMPLATES;
}

export function getTemplateForType(equipmentType: string): SensorTemplate[] | undefined {
  return EQUIPMENT_SENSOR_TEMPLATES[equipmentType.toLowerCase()];
}
