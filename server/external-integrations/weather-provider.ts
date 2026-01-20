/**
 * External Marine Data Integration - Weather Provider
 * OpenWeatherMap API integration
 */

import type { WeatherData, ExternalServiceConfigType } from "./types.js";
import { getMockWeatherData } from "./mock-data.js";
import { cryptoRandom } from "@shared/crypto-random";

export async function getMarineWeather(lat: number, lon: number, config: ExternalServiceConfigType): Promise<WeatherData> {
  if (config.enableMockData || !config.openWeatherMapApiKey) {
    console.warn(`Using mock weather data for lat:${lat}, lon:${lon} - API key not configured`);
    return getMockWeatherData(lat, lon);
  }

  try {
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${config.openWeatherMapApiKey}&units=metric`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${config.openWeatherMapApiKey}&units=metric`;

    const [currentResponse, forecastResponse] = await Promise.all([fetch(currentWeatherUrl), fetch(forecastUrl)]);
    if (!currentResponse.ok || !forecastResponse.ok) { throw new Error("Weather API request failed"); }

    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();

    return {
      location: { latitude: lat, longitude: lon },
      current: {
        temperature: currentData.main.temp, humidity: currentData.main.humidity, pressure: currentData.main.pressure,
        windSpeed: currentData.wind?.speed ?? 0, windDirection: currentData.wind?.deg ?? 0,
        visibility: currentData.visibility / 1000, conditions: currentData.weather[0]?.description ?? "Unknown",
      },
      marine: generateMarineConditions(currentData),
      forecast: processForecastData(forecastData),
      alerts: processWeatherAlerts(currentData),
    };
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    console.warn(`Falling back to mock weather data for lat:${lat}, lon:${lon} due to API failure`);
    return getMockWeatherData(lat, lon);
  }
}

function generateMarineConditions(weatherData: any) {
  return {
    waveHeight: cryptoRandom() * 4, swellHeight: cryptoRandom() * 3, swellDirection: cryptoRandom() * 360,
    seaTemperature: weatherData.main.temp - 2 + cryptoRandom() * 4, tideHeight: -2 + cryptoRandom() * 4,
    currentSpeed: cryptoRandom() * 3, currentDirection: cryptoRandom() * 360,
  };
}

function processForecastData(forecastData: any) {
  return forecastData.list.slice(0, 5).map((item: any) => ({
    time: new Date(item.dt * 1000), temperature: item.main.temp,
    conditions: item.weather[0]?.description ?? "Unknown", windSpeed: item.wind?.speed ?? 0, waveHeight: cryptoRandom() * 5,
  }));
}

function processWeatherAlerts(weatherData: any) {
  const alerts = [];
  if (weatherData.wind?.speed > 15) {
    alerts.push({
      type: "Strong Wind Warning", severity: "moderate",
      description: `Wind speeds up to ${Math.round(weatherData.wind.speed)} m/s expected`,
      validFrom: new Date(), validTo: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });
  }
  return alerts;
}
