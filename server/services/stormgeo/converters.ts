/**
 * StormGeo Service - Conversion Utilities
 *
 * Re-exports maritime conversion utilities from shared module.
 * Maintained for backward compatibility with StormGeo integration.
 */

export {
  windSpeedToBeaufort,
  waveHeightToSeaState,
  bearingToDirection,
  BEAUFORT_DESCRIPTIONS,
  SEA_STATE_DESCRIPTIONS,
} from "@shared/lib/maritime-converters";
