/**
 * StormGeo Service - Type Definitions
 */

export const WIND_DIRECTIONS: Record<string, number> = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

export interface StormGeoCSVRow {
  timestamp: string;
  latitude: number;
  longitude: number;
  wind_speed?: number | undefined;
  wind_direction?: number | undefined;
  wave_height?: number | undefined;
  swell_height?: number | undefined;
  swell_direction?: number | undefined;
  air_temp?: number | undefined;
  sea_temp?: number | undefined;
  pressure?: number | undefined;
  visibility?: number | undefined;
  current_speed?: number | undefined;
  current_direction?: number | undefined;
  recommended_speed?: number | undefined;
  recommended_course?: number | undefined;
}

export interface StormGeoJSONFormat {
  route_id?: string;
  route_name?: string;
  departure_port?: string;
  arrival_port?: string;
  departure_time?: string;
  arrival_time?: string;
  waypoints: Array<{
    timestamp: string;
    lat: number;
    lon: number;
    weather?: {
      wind_speed?: number;
      wind_direction?: number;
      wave_height?: number;
      swell_height?: number;
      swell_direction?: number;
      air_temp?: number;
      sea_temp?: number;
      pressure?: number;
      visibility?: number;
      humidity?: number;
      cloud_cover?: number;
      sky_condition?: string;
      precipitation?: number;
    };
    currents?: {
      speed?: number;
      direction?: number;
    };
    routing?: {
      recommended_speed?: number;
      recommended_course?: number;
      recommended_heading?: number;
      engine_rpm?: number;
    };
  }>;
}

export interface StormGeoImportResult {
  success: boolean;
  snapshotsCreated: number;
  importId: string;
  errors?: string[];
  warnings?: string[];
}

export interface StormGeoWeatherFilters {
  vesselId?: string;
  forecastTimeStart?: Date;
  forecastTimeEnd?: Date;
  snapshotType?: string;
  limit?: number;
}
