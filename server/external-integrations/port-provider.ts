/**
 * External Marine Data Integration - Port Provider
 * Port information API integration
 */

import type { PortData, ExternalServiceConfigType } from "./types.js";
import { getMockPortData } from "./mock-data.js";

export async function getPortInformation(locode: string, config: ExternalServiceConfigType): Promise<PortData | null> {
  if (config.enableMockData || !config.portCallApiKey) {
    console.warn(`Using mock port data for LOCODE:${locode} - API key not configured`);
    return getMockPortData(locode);
  }

  try {
    const apiUrl = `https://api.portcall.com/v1/ports/${locode}`;
    const response = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${config.portCallApiKey}`, "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) { return null; }
      throw new Error(`Port Call API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      locode: data.locode ?? locode, name: data.name ?? "Unknown Port", country: data.country ?? "Unknown",
      location: { latitude: Number.parseFloat(data.latitude) || 0, longitude: Number.parseFloat(data.longitude) || 0 },
      facilities: data.facilities?.map((f: any) => ({
        type: f.type ?? "Unknown", description: f.description ?? "", available: f.available !== false,
      })) ?? [],
      services: data.services?.map((s: any) => ({
        name: s.name ?? "Unknown Service", provider: s.provider, contact: s.contact,
      })) ?? [],
      restrictions: data.restrictions?.map((r: any) => ({
        type: r.type ?? "Unknown", description: r.description ?? "", effective: r.effective ? new Date(r.effective) : undefined,
      })) ?? [],
    };
  } catch (error) {
    console.error("Failed to fetch port information from Port Call API:", error);
    console.warn(`Falling back to mock port data for LOCODE:${locode} due to API failure`);
    return getMockPortData(locode);
  }
}
