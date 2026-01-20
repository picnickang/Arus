/**
 * Base Equipment Sensor Templates
 * 
 * General industrial equipment sensor configurations.
 * Maintains backward compatibility with existing equipment configurations.
 */

import type { EquipmentTemplateMap } from "./types.js";

export const BASE_EQUIPMENT_SENSOR_TEMPLATES: EquipmentTemplateMap = {
  engine: [
    {
      sensorType: "temperature",
      defaultThresholds: { warnHi: 85, critHi: 95 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "oil_pressure",
      defaultThresholds: { warnLo: 2, critLo: 1.5 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "rpm",
      defaultThresholds: { warnHi: 2100, critHi: 2300 },
      targetUnit: "rpm",
      sampleRateHz: 10,
      enabled: true,
    },
    {
      sensorType: "vibration",
      defaultThresholds: { warnHi: 10, critHi: 15 },
      targetUnit: "mm/s",
      sampleRateHz: 1000,
      enabled: true,
    },
  ],
  pump: [
    {
      sensorType: "flow_rate",
      defaultThresholds: { warnLo: 80, critLo: 60 },
      targetUnit: "L/min",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "pressure",
      defaultThresholds: { warnLo: 2.5, critLo: 2, warnHi: 8, critHi: 10 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "vibration",
      defaultThresholds: { warnHi: 8, critHi: 12 },
      targetUnit: "mm/s",
      sampleRateHz: 1000,
      enabled: true,
    },
    {
      sensorType: "current",
      defaultThresholds: { warnHi: 45, critHi: 50 },
      targetUnit: "A",
      sampleRateHz: 1,
      enabled: true,
    },
  ],
  compressor: [
    {
      sensorType: "pressure",
      defaultThresholds: { warnHi: 12, critHi: 15 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "temperature",
      defaultThresholds: { warnHi: 80, critHi: 90 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "vibration",
      defaultThresholds: { warnHi: 12, critHi: 18 },
      targetUnit: "mm/s",
      sampleRateHz: 1000,
      enabled: true,
    },
  ],
  generator: [
    {
      sensorType: "voltage",
      defaultThresholds: { warnLo: 220, critLo: 200, warnHi: 250, critHi: 260 },
      targetUnit: "V",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "frequency",
      defaultThresholds: { warnLo: 59, critLo: 58, warnHi: 61, critHi: 62 },
      targetUnit: "Hz",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "temperature",
      defaultThresholds: { warnHi: 75, critHi: 85 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "load",
      defaultThresholds: { warnHi: 90, critHi: 95 },
      targetUnit: "%",
      sampleRateHz: 1,
      enabled: true,
    },
  ],
  hvac: [
    {
      sensorType: "temperature",
      defaultThresholds: { warnLo: 18, critLo: 15, warnHi: 26, critHi: 30 },
      targetUnit: "°C",
      sampleRateHz: 0.1,
      enabled: true,
    },
    {
      sensorType: "humidity",
      defaultThresholds: { warnLo: 30, critLo: 20, warnHi: 70, critHi: 80 },
      targetUnit: "%",
      sampleRateHz: 0.1,
      enabled: true,
    },
  ],
  boiler: [
    {
      sensorType: "pressure",
      defaultThresholds: { warnHi: 8, critHi: 10 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "temperature",
      defaultThresholds: { warnHi: 85, critHi: 95 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "water_level",
      defaultThresholds: { warnLo: 20, critLo: 10 },
      targetUnit: "%",
      sampleRateHz: 1,
      enabled: true,
    },
  ],
};
