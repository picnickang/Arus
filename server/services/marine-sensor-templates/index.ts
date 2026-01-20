/**
 * Marine Equipment Sensor Templates - Main Entry Point
 * 
 * Provides comprehensive sensor configurations for maritime equipment with
 * industry-standard thresholds, sample rates, and monitoring parameters.
 * 
 * Template Structure:
 * - sensorType: Identifier for the sensor measurement
 * - defaultThresholds: Warning and critical limits (high/low)
 * - targetUnit: Physical unit for the measurement
 * - sampleRateHz: Recommended sampling frequency
 * - enabled: Whether sensor is active by default
 * 
 * Notes:
 * - Thresholds are conservative starting points. Tune per OEM baselines and vessel commissioning data.
 * - Sample rates: vibration high (1000-2000Hz); temps/pressures medium (1Hz); fluids/env slow (0.1Hz).
 * - Units chosen to align with typical marine/OEM conventions.
 */

export type { SensorTemplate, EquipmentTemplateMap } from "./types.js";
export { BASE_EQUIPMENT_SENSOR_TEMPLATES } from "./base-templates.js";
export { PROPULSION_TEMPLATES } from "./propulsion-templates.js";
export { AUXILIARY_TEMPLATES } from "./auxiliary-templates.js";
export { ELECTRICAL_TEMPLATES } from "./electrical-templates.js";

import type { EquipmentTemplateMap } from "./types.js";
import { BASE_EQUIPMENT_SENSOR_TEMPLATES } from "./base-templates.js";
import { PROPULSION_TEMPLATES } from "./propulsion-templates.js";
import { AUXILIARY_TEMPLATES } from "./auxiliary-templates.js";
import { ELECTRICAL_TEMPLATES } from "./electrical-templates.js";

export const MARINE_EQUIPMENT_SENSOR_TEMPLATES: EquipmentTemplateMap = {
  ...PROPULSION_TEMPLATES,
  ...AUXILIARY_TEMPLATES,
  ...ELECTRICAL_TEMPLATES,
};

export const EQUIPMENT_SENSOR_TEMPLATES: EquipmentTemplateMap = {
  ...BASE_EQUIPMENT_SENSOR_TEMPLATES,
  ...MARINE_EQUIPMENT_SENSOR_TEMPLATES,
};

export {
  mergeEquipmentTemplates,
  getAvailableEquipmentTypes,
  hasTemplateForType,
  getTemplateForType,
} from "./utilities.js";
