/**
 * Dev Fake Data - Generator Telemetry Generator
 * 
 * Generates realistic diesel generator telemetry data.
 */

import { PhysicsUtil } from "../physics-utils.js";
import { cryptoRandomInt } from "@shared/crypto-random";

export class GeneratorTelemetryGenerator {
  generate(genNumber: number, hour: number, engineLoad: number): Record<string, number> {
    const baseLoad = 40 + (genNumber === 1 ? 20 : 0);
    const loadKw = PhysicsUtil.clamp(
      baseLoad + engineLoad * 0.3 + PhysicsUtil.randn(0, 5),
      20,
      500
    );
    const loadPercent = (loadKw / 500) * 100;

    return {
      dg_load_kw: Math.round(loadKw),
      dg_load_percent: Math.round(loadPercent),
      dg_voltage: PhysicsUtil.clamp(440 + PhysicsUtil.randn(0, 3), 430, 460),
      dg_frequency: PhysicsUtil.clamp(60 + PhysicsUtil.randn(0, 0.1), 59.5, 60.5),
      dg_current: PhysicsUtil.clamp(loadKw / 0.44 / Math.sqrt(3) + PhysicsUtil.randn(0, 2), 20, 700),
      dg_power_factor: PhysicsUtil.clamp(0.85 + PhysicsUtil.randn(0, 0.02), 0.75, 0.98),
      dg_exhaust_temp: PhysicsUtil.clamp(350 + loadPercent * 1.5 + PhysicsUtil.randn(0, 5), 300, 480),
      dg_lub_oil_press: PhysicsUtil.clamp(4.2 + PhysicsUtil.randn(0, 0.1), 3.5, 5.5),
      dg_coolant_temp: PhysicsUtil.clamp(78 + loadPercent * 0.15 + PhysicsUtil.randn(0, 1), 65, 92),
      dg_fuel_rack: PhysicsUtil.clamp(loadPercent * 0.85 + PhysicsUtil.randn(0, 2), 10, 95),
      dg_running_hours: cryptoRandomInt(8000) + 3000,
    };
  }
}
