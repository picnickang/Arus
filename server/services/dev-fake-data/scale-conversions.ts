/**
 * Dev Fake Data - Scale Conversions
 * 
 * Re-exports maritime scale conversion utilities from shared module.
 * Maintained for backward compatibility.
 */

export {
  windSpeedToBeaufort,
  waveHeightToSeaState,
  bearingToDirection,
  BEAUFORT_DESCRIPTIONS,
  SEA_STATE_DESCRIPTIONS,
} from "@shared/lib/maritime-converters";
