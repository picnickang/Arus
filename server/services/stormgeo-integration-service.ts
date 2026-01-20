/**
 * StormGeo Integration Service - Backward Compatible Shim
 * Delegates to modular files in ./stormgeo/
 */

export { StormGeoIntegrationService, stormgeoIntegrationService } from "./stormgeo/index.js";
export type { StormGeoCSVRow, StormGeoJSONFormat, StormGeoImportResult, StormGeoWeatherFilters } from "./stormgeo/index.js";
export { WIND_DIRECTIONS, bearingToDirection, windSpeedToBeaufort, waveHeightToSeaState } from "./stormgeo/index.js";
