/**
 * Physics Engine for Vessel Telemetry Simulation
 *
 * Contains physics utilities for realistic marine vessel telemetry generation.
 */

import { cryptoRandom } from "@shared/crypto-random";

/**
 * Physics Utilities
 */
export class PhysicsEngine {
  /**
   * Clamp value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Generate normally distributed random number (Box-Muller transform)
   */
  static randn(mean: number = 0, stdDev: number = 1): number {
    const u = 1 - cryptoRandom();
    const v = 1 - cryptoRandom();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * stdDev;
  }

  /**
   * Calculate torque from RPM using realistic engine curve
   */
  static torqueFromRpm(rpm: number, maxTorque: number): number {
    const torque = ((rpm * rpm) / (1700 * 1700)) * maxTorque;
    return this.clamp(torque, 0.1 * maxTorque, maxTorque);
  }

  /**
   * Simulate sea state effects on vessel motion
   */
  static seaState(time: number, seaState: number) {
    const frequency = 0.05 + seaState * 0.01;

    return {
      imu_heave: 0.2 * seaState * Math.sin(frequency * time) + this.randn(0, 0.05 * seaState),
      imu_pitch:
        1.5 * seaState * Math.sin((frequency * time) / 1.8 + 0.3) + this.randn(0, 0.2 * seaState),
      imu_roll:
        2.2 * seaState * Math.sin((frequency * time) / 2.2 + 1.1) + this.randn(0, 0.25 * seaState),
    };
  }

  /**
   * Hydraulic system pressure cycle (for winch, crane, ramp operations)
   */
  static hydraulicCycle(
    time: number,
    period: number = 300,
    dutyCycle: number = 0.15,
    basePressure: number = 5,
    peakPressure: number = 180
  ): number {
    const phase = (time % period) / period;
    const isActive = phase < dutyCycle;

    const pressure = isActive ? peakPressure + this.randn(0, 6) : basePressure + this.randn(0, 1.5);

    return this.clamp(pressure, 0, 250);
  }

  /**
   * Dynamic positioning thruster load
   */
  static dpThrusterLoad(time: number, severity: number = 0.6): number {
    const baseLoad = 30 + 50 * severity + 10 * Math.sin(time / 60) + this.randn(0, 8);
    return this.clamp(baseLoad, 10, 100);
  }

  /**
   * Temperature evolution with thermal lag
   */
  static temperatureStep(
    currentTemp: number,
    loadPercent: number,
    ambientTemp: number = 28,
    timeConstant: number = 180
  ): number {
    const targetTemp = ambientTemp + 50 * (loadPercent / 100);
    const delta = (targetTemp - currentTemp) / timeConstant;
    return currentTemp + delta + this.randn(0, 0.05);
  }

  /**
   * Vibration components (with fault injection support)
   */
  static vibrationComponents(loadPercent: number, faultDrift: number = 0): number {
    const baseVibration = 0.09 + 0.02 * (loadPercent / 100);
    const imbalance = 0.01 * this.randn();
    const faultComponent = faultDrift * 0.001;

    return this.clamp(baseVibration + imbalance + faultComponent, 0.05, 0.5);
  }
}
