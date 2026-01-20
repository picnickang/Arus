/**
 * Unit Conversion Utilities for ARUS
 * Provides conversion functions for common marine engineering units
 */

export type PowerUnit = "kW" | "HP";
export type SpeedUnit = "knots" | "mph";
export type WeightUnit = "kg" | "lbs";
export type TemperatureUnit = "°C" | "°F";

export interface UnitPreferences {
  power: PowerUnit;
  speed: SpeedUnit;
  weight: WeightUnit;
  temperature: TemperatureUnit;
}

export const defaultUnitPreferences: UnitPreferences = {
  power: "kW",
  speed: "knots",
  weight: "kg",
  temperature: "°C",
};

/**
 * Power conversions
 */
export function convertPower(value: number, from: PowerUnit, to: PowerUnit): number {
  if (from === to) {
    return value;
  }

  if (from === "kW" && to === "HP") {
    return value * 1.34102; // 1 kW = 1.34102 HP
  }

  if (from === "HP" && to === "kW") {
    return value / 1.34102;
  }

  return value;
}

/**
 * Speed conversions
 */
export function convertSpeed(value: number, from: SpeedUnit, to: SpeedUnit): number {
  if (from === to) {
    return value;
  }

  if (from === "knots" && to === "mph") {
    return value * 1.15078; // 1 knot = 1.15078 mph
  }

  if (from === "mph" && to === "knots") {
    return value / 1.15078;
  }

  return value;
}

/**
 * Weight conversions
 */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) {
    return value;
  }

  if (from === "kg" && to === "lbs") {
    return value * 2.20462; // 1 kg = 2.20462 lbs
  }

  if (from === "lbs" && to === "kg") {
    return value / 2.20462;
  }

  return value;
}

/**
 * Temperature conversions
 */
export function convertTemperature(
  value: number,
  from: TemperatureUnit,
  to: TemperatureUnit
): number {
  if (from === to) {
    return value;
  }

  if (from === "°C" && to === "°F") {
    return (value * 9) / 5 + 32;
  }

  if (from === "°F" && to === "°C") {
    return ((value - 32) * 5) / 9;
  }

  return value;
}

/**
 * Format value with unit
 */
export function formatWithUnit(value: number, unit: string, decimals: number = 1): string {
  return `${value.toFixed(decimals)} ${unit}`;
}

/**
 * Convert and format power value
 */
export function formatPower(value: number, targetUnit: PowerUnit, decimals: number = 1): string {
  return formatWithUnit(value, targetUnit, decimals);
}

/**
 * Convert and format speed value
 */
export function formatSpeed(value: number, targetUnit: SpeedUnit, decimals: number = 1): string {
  return formatWithUnit(value, targetUnit, decimals);
}

/**
 * Convert and format weight value
 */
export function formatWeight(value: number, targetUnit: WeightUnit, decimals: number = 1): string {
  return formatWithUnit(value, targetUnit, decimals);
}

/**
 * Convert and format temperature value
 */
export function formatTemperature(
  value: number,
  targetUnit: TemperatureUnit,
  decimals: number = 1
): string {
  return formatWithUnit(value, targetUnit, decimals);
}
