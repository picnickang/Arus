/**
 * Dev Fake Data - Weather Generator
 * 
 * Generates realistic weather conditions with diurnal variation.
 */

import { PhysicsUtil } from "../physics-utils.js";
import { cryptoRandom } from "@shared/crypto-random";

export class WeatherGenerator {
  private baseWindSpeed: number;
  private baseWindDir: number;
  private baseWaveHeight: number;
  private basePressure: number;

  constructor() {
    this.baseWindSpeed = 8 + cryptoRandom() * 10;
    this.baseWindDir = cryptoRandom() * 360;
    this.baseWaveHeight = 0.5 + cryptoRandom() * 2;
    this.basePressure = 1010 + cryptoRandom() * 15;
  }

  generate(hour: number): {
    windSpeed: number;
    windDirection: number;
    waveHeight: number;
    swellHeight: number;
    swellDirection: number;
    airTemp: number;
    seaTemp: number;
    pressure: number;
    visibility: number;
    humidity: number;
    cloudCover: number;
    skyCondition: string;
  } {
    const hourVariation = Math.sin((hour / 24) * Math.PI * 2);

    const windSpeed = PhysicsUtil.clamp(
      this.baseWindSpeed + 3 * hourVariation + PhysicsUtil.randn(0, 1),
      0,
      35
    );

    const windDirection = (this.baseWindDir + PhysicsUtil.randn(0, 15) + 360) % 360;

    const waveHeight = PhysicsUtil.clamp(
      this.baseWaveHeight + 0.3 * (windSpeed / 20) + PhysicsUtil.randn(0, 0.2),
      0.1,
      10
    );

    const swellHeight = PhysicsUtil.clamp(
      waveHeight * 0.7 + PhysicsUtil.randn(0, 0.2),
      0,
      8
    );

    const swellDirection = (windDirection + 180 + PhysicsUtil.randn(0, 30) + 360) % 360;

    const airTemp = PhysicsUtil.clamp(
      28 + 3 * Math.sin((hour / 24) * Math.PI) + PhysicsUtil.randn(0, 1),
      20,
      38
    );

    const seaTemp = PhysicsUtil.clamp(airTemp - 2 + PhysicsUtil.randn(0, 0.5), 22, 32);

    const pressure = PhysicsUtil.clamp(
      this.basePressure + 2 * hourVariation + PhysicsUtil.randn(0, 1),
      980,
      1040
    );

    const visibility = PhysicsUtil.clamp(
      10 - (waveHeight > 3 ? 3 : 0) + PhysicsUtil.randn(0, 1),
      1,
      15
    );

    const humidity = PhysicsUtil.clamp(
      70 + 10 * (windSpeed < 10 ? 1 : 0) + PhysicsUtil.randn(0, 5),
      40,
      95
    );

    const cloudCover = PhysicsUtil.clamp(
      30 + 20 * (pressure < 1015 ? 1 : 0) + PhysicsUtil.randn(0, 10),
      0,
      100
    );

    const skyConditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Overcast'];
    const skyIndex = Math.min(Math.floor(cloudCover / 25), 3);
    const skyCondition = skyConditions[skyIndex];

    return {
      windSpeed,
      windDirection,
      waveHeight,
      swellHeight,
      swellDirection,
      airTemp,
      seaTemp,
      pressure,
      visibility,
      humidity,
      cloudCover,
      skyCondition,
    };
  }
}
