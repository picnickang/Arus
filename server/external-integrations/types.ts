/**
 * External Marine Data Integration - Types
 * Shared type definitions for external integrations
 */

import { z } from "zod";

export const ExternalServiceConfig = z.object({
  openWeatherMapApiKey: z.string().optional(),
  marineTrafficApiKey: z.string().optional(),
  portCallApiKey: z.string().optional(),
  enableMockData: z.boolean().default(false),
});

export type ExternalServiceConfigType = z.infer<typeof ExternalServiceConfig>;

export interface WeatherData {
  location: { latitude: number; longitude: number };
  current: {
    temperature: number; humidity: number; pressure: number;
    windSpeed: number; windDirection: number; visibility: number; conditions: string;
  };
  marine: {
    waveHeight: number; swellHeight: number; swellDirection: number;
    seaTemperature: number; tideHeight: number; currentSpeed: number; currentDirection: number;
  };
  forecast: Array<{ time: Date; temperature: number; conditions: string; windSpeed: number; waveHeight: number }>;
  alerts: Array<{ type: string; severity: string; description: string; validFrom: Date; validTo: Date }>;
}

export interface VesselTrackingData {
  imo: string; mmsi?: string; name: string;
  position: { latitude: number; longitude: number };
  course?: number; speed?: number; destination?: string; eta?: Date; status: string;
}

export interface PortData {
  locode: string; name: string; country: string;
  location: { latitude: number; longitude: number };
  facilities: Array<{ type: string; description: string; available: boolean }>;
  services: Array<{ name: string; provider?: string; contact?: string }>;
  restrictions: Array<{ type: string; description: string; effective?: Date }>;
}
