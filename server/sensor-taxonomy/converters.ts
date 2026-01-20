/**
 * Sensor Value Conversion and Validation
 */

import type { SensorDefinition } from "./types";

export function normalizeSensorValue(value: number, fromUnit: string, toUnit: string): number {
  const from = fromUnit.toLowerCase().trim();
  const to = toUnit.toLowerCase().trim();
  if (from === to) {return value;}

  // Temperature conversions
  if (to === "°c" || to === "c") {
    if (from === "°f" || from === "f") {return ((value - 32) * 5) / 9;}
    if (from === "k" || from === "kelvin") {return value - 273.15;}
  }

  // Pressure conversions (to kPa)
  if (to === "kpa") {
    if (from === "psi") {return value * 6.894757;}
    if (from === "bar") {return value * 100;}
    if (from === "mpa") {return value * 1000;}
  }

  // Vibration conversions (to mm/s)
  if (to === "mm/s") {
    if (from === "in/s" || from === "ips") {return value * 25.4;}
  }

  // Flow conversions (to L/h)
  if (to === "l/h" || to === "lph") {
    if (from === "gph" || from === "gal/h") {return value * 3.78541;}
    if (from === "l/min") {return value * 60;}
  }

  console.warn(`[SensorTaxonomy] No conversion from ${from} to ${to}`);
  return value;
}

export function validateSensorReading(sensor: SensorDefinition, value: number): { valid: boolean; warning?: string; critical?: boolean } {
  if (!sensor.validRange) {return { valid: true };}

  const { min, max } = sensor.validRange;

  if (value < min || value > max) {
    return { valid: false, warning: `${sensor.canonicalName} value ${value} ${sensor.unit} outside valid range [${min}, ${max}]`, critical: true };
  }

  if (sensor.criticalThreshold) {
    const { min: critMin, max: critMax } = sensor.criticalThreshold;
    if (critMin !== undefined && value < critMin) {
      return { valid: true, warning: `${sensor.canonicalName} ${value} ${sensor.unit} below critical minimum ${critMin}`, critical: true };
    }

    if (critMax !== undefined && value > critMax) {
      return { valid: true, warning: `${sensor.canonicalName} ${value} ${sensor.unit} above critical maximum ${critMax}`, critical: true };
    }
  }

  return { valid: true };
}
