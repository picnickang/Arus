/**
 * Dev Fake Data - Engine Telemetry Generator
 * 
 * Generates realistic main engine telemetry data.
 */

import { PhysicsUtil } from "../physics-utils.js";
import { cryptoRandomInt } from "@shared/crypto-random";

export class EngineTelemetryGenerator {
  private currentTemp: number = 65;
  private currentLoad: number = 50;

  constructor(private vesselType: string) {}

  generate(hour: number, nav: { sog: number }): Record<string, number> {
    const loadDemand = PhysicsUtil.clamp(nav.sog * 5 + PhysicsUtil.randn(0, 5), 20, 95);
    this.currentLoad = PhysicsUtil.lerp(this.currentLoad, loadDemand, 0.3);

    const rpm = PhysicsUtil.clamp(
      600 + (this.currentLoad / 100) * 900 + PhysicsUtil.randn(0, 10),
      500,
      1600
    );

    const targetTemp = 60 + (this.currentLoad / 100) * 30;
    this.currentTemp = PhysicsUtil.lerp(this.currentTemp, targetTemp, 0.1);

    return {
      me_rpm: Math.round(rpm),
      me_load: Math.round(this.currentLoad),
      me_fuel_rack: PhysicsUtil.clamp(this.currentLoad * 0.8 + PhysicsUtil.randn(0, 2), 0, 100),
      me_exhaust_temp_port: PhysicsUtil.clamp(320 + this.currentLoad * 1.2 + PhysicsUtil.randn(0, 5), 280, 450),
      me_exhaust_temp_stbd: PhysicsUtil.clamp(318 + this.currentLoad * 1.2 + PhysicsUtil.randn(0, 5), 278, 448),
      me_scav_air_press: PhysicsUtil.clamp(1.5 + (rpm / 1600) * 1.5 + PhysicsUtil.randn(0, 0.05), 0.8, 3.2),
      me_scav_air_temp: PhysicsUtil.clamp(35 + (this.currentLoad / 100) * 15 + PhysicsUtil.randn(0, 1), 30, 55),
      me_tc_rpm: PhysicsUtil.clamp(rpm * 12 + PhysicsUtil.randn(0, 200), 5000, 25000),
      me_tc_exhaust_temp: PhysicsUtil.clamp(400 + this.currentLoad * 1.5 + PhysicsUtil.randn(0, 8), 350, 550),
      me_coolant_temp_in: PhysicsUtil.clamp(this.currentTemp + PhysicsUtil.randn(0, 0.5), 55, 90),
      me_coolant_temp_out: PhysicsUtil.clamp(this.currentTemp + 8 + PhysicsUtil.randn(0, 0.5), 60, 98),
      me_lub_oil_press: PhysicsUtil.clamp(4.5 - (this.currentTemp - 65) * 0.03 + PhysicsUtil.randn(0, 0.1), 2.5, 6.5),
      me_lub_oil_temp: PhysicsUtil.clamp(this.currentTemp - 5 + PhysicsUtil.randn(0, 1), 40, 70),
      me_fuel_oil_press: PhysicsUtil.clamp(7 + (this.currentLoad / 100) * 3 + PhysicsUtil.randn(0, 0.2), 5, 11),
      me_fuel_oil_temp: PhysicsUtil.clamp(120 + PhysicsUtil.randn(0, 2), 100, 140),
      sw_cooling_temp: PhysicsUtil.clamp(28 + PhysicsUtil.randn(0, 0.5), 22, 32),
      fw_cooling_temp: PhysicsUtil.clamp(38 + (this.currentLoad / 100) * 8 + PhysicsUtil.randn(0, 0.5), 32, 48),
      air_comp_press: PhysicsUtil.clamp(28 + PhysicsUtil.randn(0, 0.5), 25, 32),
      starting_air_press: PhysicsUtil.clamp(28 + PhysicsUtil.randn(0, 0.3), 24, 31),
      control_air_press: PhysicsUtil.clamp(7 + PhysicsUtil.randn(0, 0.1), 6, 9),
      er_temp: PhysicsUtil.clamp(38 + (this.currentLoad / 100) * 10 + PhysicsUtil.randn(0, 1), 30, 52),
      er_humidity: PhysicsUtil.clamp(65 + PhysicsUtil.randn(0, 3), 50, 85),
      me_running_hours: cryptoRandomInt(10000) + 5000,
    };
  }
}
