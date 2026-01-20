/**
 * Dev Fake Data - Physics Utilities
 * 
 * Mathematical utility functions for realistic data generation.
 */

import { cryptoRandom } from "@shared/crypto-random";

export class PhysicsUtil {
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  static randn(mean: number = 0, stdDev: number = 1): number {
    const u = 1 - cryptoRandom();
    const v = 1 - cryptoRandom();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * stdDev;
  }

  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
