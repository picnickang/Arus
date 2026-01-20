/**
 * Adaptive Training Window Configuration
 */

import type { EquipmentTypeConfig } from "./types";

export const EQUIPMENT_CONFIGS: Record<string, EquipmentTypeConfig> = {
  Engine: { minDays: 180, category: "critical" },
  "Main Engine": { minDays: 180, category: "critical" },
  "Auxiliary Engine": { minDays: 180, category: "critical" },
  Pump: { minDays: 180, category: "critical" },
  "Hydraulic Pump": { minDays: 180, category: "critical" },
  Generator: { minDays: 180, category: "critical" },
  Turbine: { minDays: 180, category: "critical" },
  Compressor: { minDays: 90, category: "standard" },
  "Heat Exchanger": { minDays: 90, category: "standard" },
  "Cooling System": { minDays: 90, category: "standard" },
  Motor: { minDays: 90, category: "standard" },
  Fan: { minDays: 90, category: "standard" },
  Blower: { minDays: 90, category: "standard" },
  Valve: { minDays: 90, category: "standard" },
  Sensor: { minDays: 60, category: "accessory" },
  Gauge: { minDays: 60, category: "accessory" },
  Switch: { minDays: 60, category: "accessory" },
  Indicator: { minDays: 60, category: "accessory" },
};

export const DEFAULT_CONFIG: EquipmentTypeConfig = {
  minDays: 90,
  category: "standard",
};

export const GLOBAL_CONFIG = {
  ABSOLUTE_MIN_DAYS: 60,
  BRONZE_MIN_DAYS: 90,
  SILVER_MIN_DAYS: 180,
  GOLD_MIN_DAYS: 365,
  PLATINUM_MIN_DAYS: 730,
  MAX_DAYS: 730,
  MIN_FAILURE_COUNT: 3,
  RECOMMENDED_FAILURE_COUNT: 10,
};
