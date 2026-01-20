/**
 * External Marine Data Integration - Main Entry Point
 * Re-exports all types, providers, and service
 */

export type { WeatherData, VesselTrackingData, PortData, ExternalServiceConfigType } from "./types.js";
export { ExternalServiceConfig } from "./types.js";
export { getMockWeatherData, getMockVesselData, getMockPortData } from "./mock-data.js";
export { getMarineWeather } from "./weather-provider.js";
export { getVesselTracking } from "./vessel-provider.js";
export { getPortInformation } from "./port-provider.js";
export { processWebhook } from "./webhooks.js";
export { ExternalMarineDataService } from "./service.js";

import { ExternalMarineDataService } from "./service.js";

export const externalMarineDataService = new ExternalMarineDataService();
