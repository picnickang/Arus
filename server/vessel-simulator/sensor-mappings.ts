/**
 * Sensor Mappings and Signal Configuration
 * 
 * Maps simulated data points to telemetry sensor types and provides
 * vessel-specific signal configurations.
 */

import type { SimulatedTelemetryPoint } from "../vessel-simulator-types";

/**
 * Sensor mapping configuration for telemetry ingestion
 */
export interface SensorMapping {
  key: keyof SimulatedTelemetryPoint;
  sensorType: string;
  unit: string;
}

/**
 * Complete sensor mappings from simulated data to telemetry records
 */
export const SENSOR_MAPPINGS: SensorMapping[] = [
  { key: "rpm", sensorType: "engine_rpm", unit: "rpm" },
  { key: "shaft_torque", sensorType: "shaft_torque", unit: "Nm" },
  { key: "vibration_x", sensorType: "vibration_x", unit: "mm/s" },
  { key: "vibration_y", sensorType: "vibration_y", unit: "mm/s" },
  { key: "vibration_z", sensorType: "vibration_z", unit: "mm/s" },
  { key: "oil_temp", sensorType: "oil_temp", unit: "°C" },
  { key: "coolant_temp", sensorType: "coolant_temp", unit: "°C" },
  { key: "fuel_rate", sensorType: "fuel_rate", unit: "L/hr" },
  { key: "hyd_pressure", sensorType: "hyd_pressure", unit: "bar" },
  { key: "winch_tension", sensorType: "winch_tension", unit: "kN" },
  { key: "towline_tension", sensorType: "towline_tension", unit: "kN" },
  { key: "cargo_pump_pressure", sensorType: "cargo_pump_pressure", unit: "bar" },
  { key: "cargo_pump_temp", sensorType: "cargo_pump_temp", unit: "°C" },
  { key: "gen_load", sensorType: "gen_load", unit: "%" },
  { key: "thruster_load", sensorType: "thruster_load", unit: "%" },
  { key: "dp_status", sensorType: "dp_status", unit: "binary" },
  { key: "imu_heave", sensorType: "imu_heave", unit: "m" },
  { key: "imu_pitch", sensorType: "imu_pitch", unit: "deg" },
  { key: "imu_roll", sensorType: "imu_roll", unit: "deg" },
];

/**
 * Vessel-specific sensor signal configurations
 */
const VESSEL_SIGNAL_MAP: Record<string, string[]> = {
  tug: ["hyd_pressure", "winch_tension", "imu_heave", "imu_pitch", "imu_roll"],
  workboat: ["hyd_pressure", "winch_tension", "gen_load"],
  psv: ["thruster_load", "dp_status", "cargo_pump_pressure", "gen_load"],
  ahts: ["towline_tension", "winch_tension", "thruster_load", "gen_load"],
  bunker: ["cargo_pump_pressure", "cargo_pump_temp", "gen_load"],
  lct: ["ramp_hyd_pressure", "gen_load"],
  multicat: ["winch_tension", "hyd_pressure", "gen_load"],
  errv: ["thruster_load", "dp_status", "gen_load"],
};

/**
 * Get vessel-specific sensor signals
 */
export function getVesselSpecificSignals(vesselType: string): string[] {
  return VESSEL_SIGNAL_MAP[vesselType] || ["gen_load"];
}

/**
 * Calculate statistics from data points
 */
export function calculateStatistics(dataPoints: SimulatedTelemetryPoint[]) {
  const avgRpm = dataPoints.reduce((sum, p) => sum + p.rpm, 0) / dataPoints.length;
  const avgTorque = dataPoints.reduce((sum, p) => sum + p.shaft_torque, 0) / dataPoints.length;
  const avgLoad = (avgTorque / 420) * 100;

  const maxVibration = Math.max(
    ...dataPoints.map((p) =>
      Math.sqrt(p.vibration_x ** 2 + p.vibration_y ** 2 + p.vibration_z ** 2)
    )
  );

  return {
    duration: dataPoints.length,
    pointCount: dataPoints.length,
    avgRpm: Math.round(avgRpm),
    avgTorque: Math.round(avgTorque),
    avgLoad: Math.round(avgLoad),
    maxVibration: Number.parseFloat(maxVibration.toFixed(4)),
  };
}
