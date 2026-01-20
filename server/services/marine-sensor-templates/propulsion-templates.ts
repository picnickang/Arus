/**
 * Marine Propulsion System Templates
 * 
 * Sensor configurations for main engines, auxiliary engines,
 * gearboxes, shaftlines, and thrusters.
 */

import type { EquipmentTemplateMap } from "./types.js";

export const PROPULSION_TEMPLATES: EquipmentTemplateMap = {
  main_engine: [
    {
      sensorType: "rpm",
      defaultThresholds: { warnHi: 105, critHi: 110 },
      targetUnit: "% rated",
      sampleRateHz: 10,
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
      sensorType: "bearing_temperature",
      defaultThresholds: { warnHi: 95, critHi: 110 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "exhaust_gas_temperature",
      defaultThresholds: { warnHi: 480, critHi: 520 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "cylinder_head_temperature",
      defaultThresholds: { warnHi: 180, critHi: 200 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "jacket_water_temperature",
      defaultThresholds: { warnHi: 90, critHi: 95 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "lube_oil_pressure",
      defaultThresholds: { warnLo: 2, critLo: 1.5 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "fuel_rail_pressure",
      defaultThresholds: { warnLo: 250, critLo: 200 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "boost_pressure",
      defaultThresholds: { warnLo: 0.8, critLo: 0.6 },
      targetUnit: "bar",
      sampleRateHz: 2,
      enabled: true,
    },
    {
      sensorType: "oil_water_content",
      defaultThresholds: { warnHi: 200, critHi: 300 },
      targetUnit: "ppm",
      sampleRateHz: 0.1,
      enabled: true,
    },
    {
      sensorType: "oil_debris",
      defaultThresholds: { warnHi: 150, critHi: 300 },
      targetUnit: "ppm",
      sampleRateHz: 0.0007,
      enabled: true,
    },
  ],

  auxiliary_engine: [
    {
      sensorType: "rpm",
      defaultThresholds: { warnHi: 105, critHi: 110 },
      targetUnit: "% rated",
      sampleRateHz: 10,
      enabled: true,
    },
    {
      sensorType: "vibration_overall",
      defaultThresholds: { warnHi: 7, critHi: 10 },
      targetUnit: "mm/s",
      sampleRateHz: 1000,
      enabled: true,
    },
    {
      sensorType: "bearing_temperature",
      defaultThresholds: { warnHi: 95, critHi: 110 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "lube_oil_pressure",
      defaultThresholds: { warnLo: 2, critLo: 1.5 },
      targetUnit: "bar",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "oil_debris",
      defaultThresholds: { warnHi: 120, critHi: 250 },
      targetUnit: "ppm",
      sampleRateHz: 0.0007,
      enabled: true,
    },
  ],

  gearbox: [
    {
      sensorType: "vibration_gearmesh",
      defaultThresholds: { warnHi: 10, critHi: 16 },
      targetUnit: "mm/s",
      sampleRateHz: 2000,
      enabled: true,
    },
    {
      sensorType: "oil_temperature",
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
      sensorType: "oil_particles_iso_code",
      defaultThresholds: { warnHi: 19, critHi: 21 },
      targetUnit: "ISO 4406",
      sampleRateHz: 0.02,
      enabled: true,
    },
    {
      sensorType: "oil_debris",
      defaultThresholds: { warnHi: 100, critHi: 200 },
      targetUnit: "ppm",
      sampleRateHz: 0.0007,
      enabled: true,
    },
  ],

  shaftline: [
    {
      sensorType: "shaft_speed",
      defaultThresholds: { warnHi: 105, critHi: 110 },
      targetUnit: "% rated",
      sampleRateHz: 10,
      enabled: true,
    },
    {
      sensorType: "shaft_torque",
      defaultThresholds: { warnHi: 95, critHi: 100 },
      targetUnit: "% rated",
      sampleRateHz: 10,
      enabled: true,
    },
    {
      sensorType: "thrust_bearing_temp",
      defaultThresholds: { warnHi: 90, critHi: 100 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
  ],

  thruster_system: [
    {
      sensorType: "vibration_overall",
      defaultThresholds: { warnHi: 8, critHi: 12 },
      targetUnit: "mm/s",
      sampleRateHz: 1000,
      enabled: true,
    },
    {
      sensorType: "gearbox_oil_temp",
      defaultThresholds: { warnHi: 80, critHi: 90 },
      targetUnit: "°C",
      sampleRateHz: 1,
      enabled: true,
    },
    {
      sensorType: "seal_oil_water_content",
      defaultThresholds: { warnHi: 200, critHi: 300 },
      targetUnit: "ppm",
      sampleRateHz: 0.05,
      enabled: true,
    },
    {
      sensorType: "pitch_angle",
      defaultThresholds: { warnHi: 95, critHi: 100 },
      targetUnit: "%",
      sampleRateHz: 2,
      enabled: true,
    },
    {
      sensorType: "motor_current",
      defaultThresholds: { warnHi: 0.9, critHi: 1 },
      targetUnit: "per-unit",
      sampleRateHz: 2,
      enabled: true,
    },
  ],
};
