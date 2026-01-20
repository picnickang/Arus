/**
 * External Marine Data Integration - Mock Data
 * Mock data generators for development and demo purposes
 */

import type { WeatherData, VesselTrackingData, PortData } from "./types.js";

function cryptoRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / 0xFFFFFFFF;
}

function cryptoRandomInt(max: number): number {
  return Math.floor(cryptoRandom() * max);
}

export function getMockWeatherData(lat: number, lon: number): WeatherData {
  const baseTemp = 15 + cryptoRandom() * 20;
  return {
    location: { latitude: lat, longitude: lon },
    current: {
      temperature: baseTemp, humidity: 60 + cryptoRandom() * 30, pressure: 1000 + cryptoRandom() * 50,
      windSpeed: cryptoRandom() * 25, windDirection: cryptoRandom() * 360,
      visibility: 8 + cryptoRandom() * 7,
      conditions: ["Clear", "Partly Cloudy", "Overcast", "Light Rain"][cryptoRandomInt(4)],
    },
    marine: {
      waveHeight: cryptoRandom() * 4, swellHeight: cryptoRandom() * 3, swellDirection: cryptoRandom() * 360,
      seaTemperature: baseTemp - 2 + cryptoRandom() * 4, tideHeight: -2 + cryptoRandom() * 4,
      currentSpeed: cryptoRandom() * 3, currentDirection: cryptoRandom() * 360,
    },
    forecast: Array.from({ length: 5 }, (_, i) => ({
      time: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
      temperature: baseTemp + (cryptoRandom() - 0.5) * 10,
      conditions: ["Clear", "Partly Cloudy", "Overcast", "Rain"][cryptoRandomInt(4)],
      windSpeed: cryptoRandom() * 30, waveHeight: cryptoRandom() * 5,
    })),
    alerts: cryptoRandom() > 0.7 ? [{
      type: "Gale Warning", severity: "moderate",
      description: "Strong winds expected in the area",
      validFrom: new Date(), validTo: new Date(Date.now() + 12 * 60 * 60 * 1000),
    }] : [],
  };
}

export function getMockVesselData(imo: string): VesselTrackingData {
  return {
    imo, mmsi: `12345${imo.slice(-4)}`,
    name: `MV ${["Pacific", "Atlantic", "Northern", "Southern"][cryptoRandomInt(4)]} ${["Pioneer", "Explorer", "Voyager", "Navigator"][cryptoRandomInt(4)]}`,
    position: { latitude: -90 + cryptoRandom() * 180, longitude: -180 + cryptoRandom() * 360 },
    course: cryptoRandom() * 360, speed: cryptoRandom() * 25,
    destination: ["Singapore", "Rotterdam", "Shanghai", "Los Angeles"][cryptoRandomInt(4)],
    eta: new Date(Date.now() + cryptoRandom() * 7 * 24 * 60 * 60 * 1000),
    status: ["Under Way", "At Anchor", "Moored", "Not Under Command"][cryptoRandomInt(4)],
  };
}

export function getMockPortData(locode: string): PortData {
  const portNames: Record<string, { name: string; country: string; lat: number; lon: number }> = {
    SGSIN: { name: "Singapore", country: "Singapore", lat: 1.29, lon: 103.851 },
    NLRTM: { name: "Rotterdam", country: "Netherlands", lat: 51.922, lon: 4.479 },
    CNSHA: { name: "Shanghai", country: "China", lat: 31.23, lon: 121.473 },
    USLAX: { name: "Los Angeles", country: "United States", lat: 33.742, lon: -118.27 },
  };
  const port = portNames[locode] || { name: "Unknown Port", country: "Unknown", lat: 0, lon: 0 };

  return {
    locode, name: port.name, country: port.country,
    location: { latitude: port.lat, longitude: port.lon },
    facilities: [
      { type: "Container Terminal", description: "Deep water container berths", available: true },
      { type: "Bulk Terminal", description: "Dry bulk handling facilities", available: true },
      { type: "Oil Terminal", description: "Petroleum products handling", available: cryptoRandom() > 0.3 },
      { type: "RoRo Terminal", description: "Roll-on/Roll-off ferry terminal", available: true },
    ],
    services: [
      { name: "Pilotage", provider: "Port Authority", contact: "+1-555-0100" },
      { name: "Tugboat Services", provider: "Marine Services Ltd", contact: "+1-555-0101" },
      { name: "Bunker Supply", provider: "Fuel Marine Inc", contact: "+1-555-0102" },
      { name: "Ship Supplies", provider: "Maritime Supply Co", contact: "+1-555-0103" },
    ],
    restrictions: cryptoRandom() > 0.5 ? [{ type: "Draft Limitation", description: "Maximum draft 15 meters at MLWS", effective: new Date() }] : [],
  };
}
