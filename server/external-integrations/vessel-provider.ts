/**
 * External Marine Data Integration - Vessel Provider
 * MarineTraffic API integration
 */

import type { VesselTrackingData, ExternalServiceConfigType } from "./types.js";
import { getMockVesselData } from "./mock-data.js";

export async function getVesselTracking(imo: string, config: ExternalServiceConfigType): Promise<VesselTrackingData | null> {
  if (config.enableMockData || !config.marineTrafficApiKey) {
    console.warn(`Using mock vessel data for IMO:${imo} - API key not configured`);
    return getMockVesselData(imo);
  }

  try {
    const apiUrl = `https://services.marinetraffic.com/api/exportvessel/v:8/${config.marineTrafficApiKey}/imo:${imo}/protocol:jsono`;
    const response = await fetch(apiUrl);
    if (!response.ok) { throw new Error(`MarineTraffic API request failed: ${response.status}`); }

    const data = await response.json();
    if (!data || data.length === 0) { return null; }

    const vessel = data[0];
    return {
      imo, mmsi: vessel.MMSI?.toString(), name: vessel.SHIPNAME ?? `Vessel ${imo}`,
      position: { latitude: Number.parseFloat(vessel.LAT) || 0, longitude: Number.parseFloat(vessel.LON) || 0 },
      course: Number.parseFloat(vessel.COURSE) || undefined, speed: Number.parseFloat(vessel.SPEED) || undefined,
      destination: vessel.DESTINATION ?? undefined, eta: vessel.ETA ? new Date(vessel.ETA) : undefined,
      status: vessel.STATUS ?? "Unknown",
    };
  } catch (error) {
    console.error("Failed to fetch vessel tracking data from MarineTraffic:", error);
    console.warn(`Falling back to mock vessel data for IMO:${imo} due to API failure`);
    return getMockVesselData(imo);
  }
}
