/**
 * Marine Electrical System Templates
 * 
 * Sensor configurations for generators, electrical buses, and battery banks.
 */

import type { EquipmentTemplateMap } from "./types.js";

export const ELECTRICAL_TEMPLATES: EquipmentTemplateMap = {
  marine_generator: [
    {
      sensorType: "voltage",
      defaultThresholds: { warnLo: 380, critLo: 360, warnHi: 460, critHi: 480 },
      targetUnit: "V",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "frequency",
      defaultThresholds: { warnLo: 59, critLo: 58, warnHi: 61, critHi: 62 },
      targetUnit: "Hz",
      sampleRateHz: 2,
      enabled: true,
    },
    {
      sensorType: "current",
      defaultThresholds: { warnHi: 0.9, critHi: 1 },
      targetUnit: "per-unit",
      sampleRateHz: 2,
      enabled: true,
    },
    {
      sensorType: "stator_winding_temp",
      defaultThresholds: { warnHi: 130, critHi: 155 },
      targetUnit: "°C",
      sampleRateHz: 0.5,
      enabled: true,
    },
  ],

  electrical_bus: [
    {
      sensorType: "bus_voltage",
      defaultThresholds: { warnLo: 0.95, critLo: 0.9, warnHi: 1.05, critHi: 1.1 },
      targetUnit: "per-unit",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "bus_frequency",
      defaultThresholds: { warnLo: 59.5, critLo: 58.5, warnHi: 60.5, critHi: 61.5 },
      targetUnit: "Hz",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "harmonic_thd",
      defaultThresholds: { warnHi: 5, critHi: 8 },
      targetUnit: "%",
      sampleRateHz: 0.2,
      enabled: true,
    },
    {
      sensorType: "insulation_resistance",
      defaultThresholds: { warnLo: 1, critLo: 0.5 },
      targetUnit: "MΩ",
      sampleRateHz: 0.02,
      enabled: true,
    },
  ],

  battery_bank: [
    {
      sensorType: "string_voltage",
      defaultThresholds: { warnLo: 0.95, critLo: 0.9, warnHi: 1.05, critHi: 1.1 },
      targetUnit: "per-unit",
      sampleRateHz: 0.2,
      enabled: true,
    },
    {
      sensorType: "string_current",
      defaultThresholds: { warnHi: 0.9, critHi: 1 },
      targetUnit: "per-unit",
      sampleRateHz: 0.2,
      enabled: true,
    },
    {
      sensorType: "battery_temperature",
      defaultThresholds: { warnHi: 40, critHi: 50 },
      targetUnit: "°C",
      sampleRateHz: 0.1,
      enabled: true,
    },
    {
      sensorType: "soc",
      defaultThresholds: { warnLo: 20, critLo: 10 },
      targetUnit: "%",
      sampleRateHz: 0.1,
      enabled: true,
    },
  ],
};
