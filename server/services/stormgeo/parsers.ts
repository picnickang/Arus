/**
 * StormGeo Service - File Parsers
 */

import type { InsertStormgeoSnapshot } from "@shared/schema";
import type { StormGeoCSVRow, StormGeoJSONFormat } from "./types.js";
import { windSpeedToBeaufort, waveHeightToSeaState } from "./converters.js";

export function parseCSV(content: string): StormGeoCSVRow[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV file must have header and at least one data row");
  }

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: StormGeoCSVRow[] = [];

  const numericFields = new Set<keyof StormGeoCSVRow>([
    "latitude",
    "longitude",
    "wind_speed",
    "wind_direction",
    "wave_height",
    "swell_height",
    "swell_direction",
    "air_temp",
    "sea_temp",
    "pressure",
    "visibility",
    "current_speed",
    "current_direction",
    "recommended_speed",
    "recommended_course",
  ]);

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(",").map((v) => v.trim());
    let timestamp: string | undefined;
    const numeric: Partial<Record<keyof StormGeoCSVRow, number>> = {};
    headers.forEach((header, index) => {
      const value = values[index];
      if (value === "" || value === undefined) {
        return;
      }
      if (header === "timestamp") {
        timestamp = value;
        return;
      }
      if (numericFields.has(header as keyof StormGeoCSVRow)) {
        const num = Number.parseFloat(value);
        if (!Number.isNaN(num)) {
          numeric[header as keyof StormGeoCSVRow] = num;
        }
      }
    });
    // Require real coordinates: defaulting a missing lat/lon to 0 silently
    // places the record at (0,0) (Gulf of Guinea), corrupting position-tied
    // weather data. Skip rows that lack valid coordinates instead.
    if (timestamp && numeric.latitude != null && numeric.longitude != null) {
      rows.push({
        timestamp,
        latitude: numeric.latitude,
        longitude: numeric.longitude,
        wind_speed: numeric.wind_speed,
        wind_direction: numeric.wind_direction,
        wave_height: numeric.wave_height,
        swell_height: numeric.swell_height,
        swell_direction: numeric.swell_direction,
        air_temp: numeric.air_temp,
        sea_temp: numeric.sea_temp,
        pressure: numeric.pressure,
        visibility: numeric.visibility,
        current_speed: numeric.current_speed,
        current_direction: numeric.current_direction,
        recommended_speed: numeric.recommended_speed,
        recommended_course: numeric.recommended_course,
      });
    }
  }
  return rows;
}

export function csvRowToSnapshot(
  row: StormGeoCSVRow,
  orgId: string,
  vesselId: string,
  sourceFile: string
): InsertStormgeoSnapshot {
  const forecastTime = new Date(row.timestamp);
  if (Number.isNaN(forecastTime.getTime())) {
    throw new Error(`Invalid timestamp: ${row.timestamp}`);
  }

  return {
    orgId,
    vesselId,
    snapshotType: "weather",
    sourceFile,
    importMethod: "file",
    forecastTime,
    latitude: row.latitude,
    longitude: row.longitude,
    windSpeed: row.wind_speed,
    windDirection: row.wind_direction,
    // Finite check (not truthiness) so a real 0 (calm/flat) converts to
    // Beaufort/sea-state 0, and NaN/undefined yields undefined instead of
    // falling through windSpeedToBeaufort's else-branch to 12 (hurricane).
    windForceBeaufort:
      typeof row.wind_speed === "number" && Number.isFinite(row.wind_speed)
        ? windSpeedToBeaufort(row.wind_speed)
        : undefined,
    waveHeight: row.wave_height,
    seaState:
      typeof row.wave_height === "number" && Number.isFinite(row.wave_height)
        ? waveHeightToSeaState(row.wave_height)
        : undefined,
    swellHeight: row.swell_height,
    swellDirection: row.swell_direction,
    airTemperature: row.air_temp,
    seaTemperature: row.sea_temp,
    barometer: row.pressure,
    visibility: row.visibility,
    currentSpeed: row.current_speed,
    currentDirection: row.current_direction,
    recommendedSpeed: row.recommended_speed,
    recommendedCourse: row.recommended_course,
  };
}

export function jsonWaypointToSnapshot(
  waypoint: StormGeoJSONFormat["waypoints"][0],
  orgId: string,
  vesselId: string,
  sourceFile: string,
  routeId?: string,
  routeName?: string,
  departurePort?: string,
  arrivalPort?: string,
  departureTime?: string,
  arrivalTime?: string
): InsertStormgeoSnapshot {
  const forecastTime = new Date(waypoint.timestamp);
  if (Number.isNaN(forecastTime.getTime())) {
    throw new Error(`Invalid timestamp: ${waypoint.timestamp}`);
  }

  const weather = waypoint.weather ?? {},
    currents = waypoint.currents ?? {},
    routing = waypoint.routing ?? {};

  return {
    orgId,
    vesselId,
    snapshotType: "combined",
    sourceFile,
    importMethod: "file",
    routeId,
    routeName,
    departurePort,
    arrivalPort,
    departureTime: departureTime ? new Date(departureTime) : undefined,
    arrivalTime: arrivalTime ? new Date(arrivalTime) : undefined,
    forecastTime,
    latitude: waypoint.lat,
    longitude: waypoint.lon,
    windSpeed: weather.wind_speed,
    windDirection: weather.wind_direction,
    windForceBeaufort:
      typeof weather.wind_speed === "number" && Number.isFinite(weather.wind_speed)
        ? windSpeedToBeaufort(weather.wind_speed)
        : undefined,
    waveHeight: weather.wave_height,
    seaState:
      typeof weather.wave_height === "number" && Number.isFinite(weather.wave_height)
        ? waveHeightToSeaState(weather.wave_height)
        : undefined,
    swellHeight: weather.swell_height,
    swellDirection: weather.swell_direction,
    airTemperature: weather.air_temp,
    seaTemperature: weather.sea_temp,
    barometer: weather.pressure,
    visibility: weather.visibility,
    humidity: weather.humidity,
    cloudCover: weather.cloud_cover,
    skyCondition: weather.sky_condition,
    precipitation: weather.precipitation,
    currentSpeed: currents.speed,
    currentDirection: currents.direction,
    recommendedSpeed: routing.recommended_speed,
    recommendedCourse: routing.recommended_course,
    rawData: waypoint as object as Record<string, unknown>,
  };
}
