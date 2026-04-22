/**
 * Operational Pattern Generator for Vessel Telemetry Simulation
 *
 * Generates realistic RPM patterns based on vessel operational profiles.
 */

import type { VesselOperationalPattern } from "../vessel-simulator-types";
import { PhysicsEngine } from "./physics-engine.js";
import { cryptoRandom } from "@shared/crypto-random";

type RpmCalculator = (time: number) => number;

const rpmPatterns: Record<VesselOperationalPattern, RpmCalculator> = {
  harbor_bursts: () => 700 + 400 * (cryptoRandom() < 0.15 ? 1 : 0) + PhysicsEngine.randn(0, 15),
  stop_go_hyd: (time: number) => 900 + 300 * Math.sin(time / 50) + PhysicsEngine.randn(0, 10),
  high_speed: (time: number) =>
    1200 +
    500 * Math.sin(time / 120) +
    100 * (cryptoRandom() < 0.05 ? 1 : 0) +
    PhysicsEngine.randn(0, 20),
  dp_hold: (time: number) => 900 + 80 * Math.sin(time / 100) + PhysicsEngine.randn(0, 8),
  tow_spikes: (time: number) =>
    950 + 100 * Math.sin(time / 80) + (cryptoRandom() < 0.1 ? 300 : 0) + PhysicsEngine.randn(0, 15),
  crane_winch: (time: number) => 850 + 200 * Math.sin(time / 70) + PhysicsEngine.randn(0, 12),
  ramp_cycles: () => 800 + 200 * (cryptoRandom() < 0.1 ? 1 : 0) + PhysicsEngine.randn(0, 10),
  pump_transfer: (time: number) => 900 + 150 * Math.sin(time / 90) + PhysicsEngine.randn(0, 10),
  standby_sprint: () => 750 + (cryptoRandom() < 0.04 ? 700 : 0) + PhysicsEngine.randn(0, 20),
  transit: (time: number) => 1000 + 200 * Math.sin(time / 100) + PhysicsEngine.randn(0, 10),
};

/**
 * Operational Pattern Generator
 */
export class OperationalPatternGenerator {
  /**
   * Generate RPM based on vessel operational pattern
   */
  static generateRpm(time: number, pattern: VesselOperationalPattern, maxRpm: number): number {
    const calculator = rpmPatterns[pattern] ?? rpmPatterns.transit;
    const rpm = calculator(time);
    return PhysicsEngine.clamp(rpm, 600, maxRpm);
  }
}
