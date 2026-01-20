/**
 * Dev Fake Data - Navigation Generator
 * 
 * Generates realistic navigation data (position, speed, course).
 */

import { PhysicsUtil } from "../physics-utils.js";
import { cryptoRandom } from "@shared/crypto-random";

export class NavigationGenerator {
  private currentLat: number;
  private currentLon: number;
  private targetLat: number;
  private targetLon: number;
  private baseSpeed: number;

  constructor(startLat: number, startLon: number, endLat: number, endLon: number) {
    this.currentLat = startLat;
    this.currentLon = startLon;
    this.targetLat = endLat;
    this.targetLon = endLon;
    this.baseSpeed = 10 + cryptoRandom() * 5;
  }

  static createRoute(vesselType: string): NavigationGenerator {
    const routes: Record<string, [number, number, number, number]> = {
      tug: [1.2636, 103.8554, 1.2900, 103.8700],
      psv: [1.2636, 103.8554, 1.0000, 104.2000],
      tanker: [1.2636, 103.8554, 0.8000, 104.5000],
      cargo: [1.2636, 103.8554, 1.1000, 104.0000],
      ferry: [1.2636, 103.8554, 1.3500, 103.9500],
    };
    const [startLat, startLon, endLat, endLon] = routes[vesselType] || routes.tug;
    return new NavigationGenerator(startLat, startLon, endLat, endLon);
  }

  generate(progress: number): { lat: number; lon: number; sog: number; cog: number } {
    this.currentLat = PhysicsUtil.lerp(this.currentLat, this.targetLat, 0.01);
    this.currentLon = PhysicsUtil.lerp(this.currentLon, this.targetLon, 0.01);

    const latProgress = PhysicsUtil.lerp(this.currentLat, this.targetLat, progress);
    const lonProgress = PhysicsUtil.lerp(this.currentLon, this.targetLon, progress);

    const lat = latProgress + PhysicsUtil.randn(0, 0.0005);
    const lon = lonProgress + PhysicsUtil.randn(0, 0.0005);

    const sogVariation = 0.8 + 0.4 * Math.sin(progress * Math.PI * 4);
    const sog = PhysicsUtil.clamp(
      this.baseSpeed * sogVariation + PhysicsUtil.randn(0, 0.5),
      0,
      25
    );

    const dLat = this.targetLat - this.currentLat;
    const dLon = this.targetLon - this.currentLon;
    const baseCog = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
    const cog = PhysicsUtil.clamp(baseCog + PhysicsUtil.randn(0, 3), 0, 360);

    return { lat, lon, sog, cog };
  }
}
