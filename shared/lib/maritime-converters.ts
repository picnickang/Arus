/**
 * Maritime Unit Converters
 *
 * Centralized conversion utilities for maritime weather and sea conditions.
 * Consolidates duplicate implementations from scale-conversions.ts and stormgeo/converters.ts
 * per SonarQube duplication reduction guidance.
 */

/**
 * Convert wind speed (m/s) to Beaufort scale (0-12)
 * Based on WMO Beaufort scale thresholds
 */
export function windSpeedToBeaufort(speedMs: number): number {
  if (speedMs < 0.3) {
    return 0;
  }
  if (speedMs < 1.6) {
    return 1;
  }
  if (speedMs < 3.4) {
    return 2;
  }
  if (speedMs < 5.5) {
    return 3;
  }
  if (speedMs < 8) {
    return 4;
  }
  if (speedMs < 10.8) {
    return 5;
  }
  if (speedMs < 13.9) {
    return 6;
  }
  if (speedMs < 17.2) {
    return 7;
  }
  if (speedMs < 20.8) {
    return 8;
  }
  if (speedMs < 24.5) {
    return 9;
  }
  if (speedMs < 28.5) {
    return 10;
  }
  if (speedMs < 32.7) {
    return 11;
  }
  return 12;
}

/**
 * Convert wave height (meters) to Douglas Sea State scale (0-9)
 */
export function waveHeightToSeaState(heightM: number): number {
  if (heightM < 0.1) {
    return 0;
  }
  if (heightM < 0.5) {
    return 2;
  }
  if (heightM < 1.25) {
    return 3;
  }
  if (heightM < 2.5) {
    return 4;
  }
  if (heightM < 4) {
    return 5;
  }
  if (heightM < 6) {
    return 6;
  }
  if (heightM < 9) {
    return 7;
  }
  if (heightM < 14) {
    return 8;
  }
  return 9;
}

/**
 * Convert bearing (degrees) to compass direction
 */
export function bearingToDirection(bearing: number): string {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(bearing / 22.5) % 16;
  // index ∈ [0, 16) and directions has exactly 16 entries; default unreachable.
  return directions[index] ?? "N";
}

/**
 * Beaufort scale descriptions
 */
export const BEAUFORT_DESCRIPTIONS: Record<number, string> = {
  0: "Calm",
  1: "Light air",
  2: "Light breeze",
  3: "Gentle breeze",
  4: "Moderate breeze",
  5: "Fresh breeze",
  6: "Strong breeze",
  7: "High wind",
  8: "Gale",
  9: "Strong gale",
  10: "Storm",
  11: "Violent storm",
  12: "Hurricane",
};

/**
 * Sea state descriptions
 */
export const SEA_STATE_DESCRIPTIONS: Record<number, string> = {
  0: "Calm (glassy)",
  1: "Calm (rippled)",
  2: "Smooth",
  3: "Slight",
  4: "Moderate",
  5: "Rough",
  6: "Very rough",
  7: "High",
  8: "Very high",
  9: "Phenomenal",
};
