/**
 * Marine Auxiliary System Templates
 * 
 * Sensor configurations for pumps, compressors, boilers, and HVAC systems.
 */

import type { EquipmentTemplateMap } from "./types.js";

export const AUXILIARY_TEMPLATES: EquipmentTemplateMap = {
  marine_pump: [
    {
      sensorType: "flow_rate",
      defaultThresholds: { warnLo: 80, critLo: 60 },
      targetUnit: "L/min",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "discharge_pressure",
      defaultThresholds: { warnLo: 2.5, critLo: 2, warnHi: 8, critHi: 10 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "vibration_overall",
      defaultThresholds: { warnHi: 8, critHi: 12 },
      targetUnit: "mm/s",
      sampleRateHz: 1000,
      enabled: true,
    },
    {
      sensorType: "motor_current",
      defaultThresholds: { warnHi: 0.9, critHi: 1 },
      targetUnit: "per-unit",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "suction_pressure",
      defaultThresholds: { warnLo: 0.4, critLo: 0.2 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "oil_debris",
      defaultThresholds: { warnHi: 80, critHi: 150 },
      targetUnit: "ppm",
      sampleRateHz: 0.001,
      enabled: true,
    },
  ],

  marine_compressor: [
    {
      sensorType: "discharge_pressure",
      defaultThresholds: { warnHi: 12, critHi: 15 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "discharge_temperature",
      defaultThresholds: { warnHi: 85, critHi: 95 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "vibration_overall",
      defaultThresholds: { warnHi: 12, critHi: 18 },
      targetUnit: "mm/s",
      sampleRateHz: 1000,
      enabled: true,
    },
    {
      sensorType: "motor_current",
      defaultThresholds: { warnHi: 0.9, critHi: 1 },
      targetUnit: "per-unit",
      sampleRateHz: 1,
      enabled: true,
    },
  ],

  marine_boiler: [
    {
      sensorType: "steam_pressure",
      defaultThresholds: { warnHi: 8, critHi: 10 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "feedwater_temp",
      defaultThresholds: { warnLo: 60, critLo: 50 },
      targetUnit: "°C",
      sampleRateHz: 0.5,
      enabled: true,
    },
    {
      sensorType: "drum_level",
      defaultThresholds: { warnLo: 20, critLo: 10 },
      targetUnit: "%",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "exhaust_gas_temp_economizer",
      defaultThresholds: { warnHi: 260, critHi: 300 },
      targetUnit: "°C",
      sampleRateHz: 0.5,
      enabled: true,
    },
  ],

  marine_hvac: [
    {
      sensorType: "space_temperature",
      defaultThresholds: { warnLo: 18, critLo: 15, warnHi: 26, critHi: 30 },
      targetUnit: "°C",
      sampleRateHz: 0.1,
      enabled: true,
    },
    {
      sensorType: "space_humidity",
      defaultThresholds: { warnLo: 30, critLo: 20, warnHi: 70, critHi: 80 },
      targetUnit: "%",
      sampleRateHz: 0.1,
      enabled: true,
    },
    {
      sensorType: "chilled_water_supply_temp",
      defaultThresholds: { warnHi: 9, critHi: 12 },
      targetUnit: "°C",
      sampleRateHz: 0.2,
      enabled: true,
    },
    {
      sensorType: "compressor_current",
      defaultThresholds: { warnHi: 0.9, critHi: 1 },
      targetUnit: "per-unit",
      sampleRateHz: 0.5,
      enabled: true,
    },
  ],
};
