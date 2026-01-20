/**
 * External Marine Data Integration - Service Class
 * Main ExternalMarineDataService orchestrator
 */

import { ExternalServiceConfig, type ExternalServiceConfigType, type WeatherData, type VesselTrackingData, type PortData } from "./types.js";
import { getMarineWeather } from "./weather-provider.js";
import { getVesselTracking } from "./vessel-provider.js";
import { getPortInformation } from "./port-provider.js";
import { processWebhook } from "./webhooks.js";

export class ExternalMarineDataService {
  private config: ExternalServiceConfigType;

  constructor() {
    this.config = ExternalServiceConfig.parse({
      openWeatherMapApiKey: process.env.OPENWEATHERMAP_API_KEY,
      marineTrafficApiKey: process.env.MARINETRAFFIC_API_KEY,
      portCallApiKey: process.env.PORTCALL_API_KEY,
      enableMockData: process.env.ENABLE_MOCK_DATA === "true" ||
        (!process.env.OPENWEATHERMAP_API_KEY && !process.env.MARINETRAFFIC_API_KEY && !process.env.PORTCALL_API_KEY),
    });
  }

  async getMarineWeather(lat: number, lon: number): Promise<WeatherData> {
    return getMarineWeather(lat, lon, this.config);
  }

  async getVesselTracking(imo: string): Promise<VesselTrackingData | null> {
    return getVesselTracking(imo, this.config);
  }

  async getPortInformation(locode: string): Promise<PortData | null> {
    return getPortInformation(locode, this.config);
  }

  async processWebhook(source: string, payload: any): Promise<{ success: boolean; message: string }> {
    return processWebhook(source, payload);
  }
}
