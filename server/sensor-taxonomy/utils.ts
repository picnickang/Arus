/**
 * Sensor Taxonomy Utility Functions
 */

import type { SensorDefinition } from "./types";
import { MARINE_SENSORS } from "./sensors";

export function getSensorsByCategory(category: SensorDefinition["category"]): SensorDefinition[] {
  return MARINE_SENSORS.filter((s) => s.category === category);
}

export function getSensorByName(canonicalName: string): SensorDefinition | undefined {
  return MARINE_SENSORS.find((s) => s.canonicalName === canonicalName);
}

export function getSensorBySpn(spn: number): SensorDefinition | undefined {
  return MARINE_SENSORS.find((s) => s.j1939Spn === spn);
}

export function getSensorDescription(sensor: SensorDefinition): string {
  let desc = sensor.description;

  if (sensor.validRange) {
    desc += ` (normal: ${sensor.validRange.min}-${sensor.validRange.max} ${sensor.unit})`;
  }

  if (sensor.criticalThreshold) {
    const { min, max } = sensor.criticalThreshold;
    if (min !== undefined && max !== undefined) {
      desc += ` [critical: <${min} or >${max} ${sensor.unit}]`;
    } else if (min !== undefined) {
      desc += ` [critical: <${min} ${sensor.unit}]`;
    } else if (max !== undefined) {
      desc += ` [critical: >${max} ${sensor.unit}]`;
    }
  }

  return desc;
}
