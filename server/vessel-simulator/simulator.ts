// @ts-nocheck
/**
 * Vessel Telemetry Simulator Service
 *
 * Main simulation engine for generating realistic marine vessel telemetry data.
 */

import type { IStorage } from "../storage/interfaces/storage.types";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("VesselSimulator:Simulator");
import type {
  SimulationConfig,
  SimulationResult,
  SimulatedTelemetryPoint,
} from "../vessel-simulator-types";
import { VESSEL_TYPE_PRESETS } from "../vessel-simulator-types";
import { PhysicsEngine } from "./physics-engine.js";
import { OperationalPatternGenerator } from "./pattern-generator.js";
import {
  SENSOR_MAPPINGS,
  getVesselSpecificSignals,
  calculateStatistics,
} from "./sensor-mappings.js";
import { cryptoRandom } from "@shared/crypto-random";

/**
 * Core signals generated for all vessel types
 */
const CORE_SIGNALS = [
  "rpm",
  "shaft_torque",
  "vibration_x",
  "vibration_y",
  "vibration_z",
  "oil_temp",
  "coolant_temp",
  "fuel_rate",
];

/**
 * Vessel Telemetry Simulator Service
 */
export class VesselSimulator {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Simulate telemetry series for a vessel
   */
  async simulate(config: SimulationConfig): Promise<SimulationResult> {
    logger.info(`[VesselSimulator] Starting simulation for ${config.vesselType} (${config.durationMinutes} min)`);

    const basePreset = VESSEL_TYPE_PRESETS[config.vesselType] || VESSEL_TYPE_PRESETS.tug;
    const preset = {
      ...basePreset,
      ...config.customPreset,
    };

    const samplingInterval = config.samplingIntervalSeconds || 1;
    const totalSeconds = config.durationMinutes * 60;
    const dataPoints: SimulatedTelemetryPoint[] = [];

    const vesselSpecificSignals = getVesselSpecificSignals(config.vesselType);
    const signals = config.signals || [...CORE_SIGNALS, ...vesselSpecificSignals];

    let oilTemp = 60;
    let coolantTemp = 55;
    let faultDrift = 0;

    const faultStart = config.injectFault ? (config.faultStartMinute || 60) * 60 : Infinity;
    const faultSeverity = config.faultSeverity || 0.5;

    for (let t = 0; t < totalSeconds; t += samplingInterval) {
      const dataPoint = this.generateDataPoint(
        t,
        preset,
        signals,
        config,
        { oilTemp, coolantTemp, faultDrift },
        faultStart,
        faultSeverity
      );

      oilTemp = dataPoint.oil_temp;
      coolantTemp = dataPoint.coolant_temp;
      if (t >= faultStart) {
        faultDrift += cryptoRandom() < 0.002 * faultSeverity ? 1 : 0;
      }

      dataPoints.push(dataPoint);
    }

    const statistics = calculateStatistics(dataPoints);
    logger.info(`[VesselSimulator] Generated ${dataPoints.length} data points`);
    logger.info(`[VesselSimulator] Stats:`, { details: statistics });

    return {
      vesselType: config.vesselType,
      equipmentId: config.equipmentId,
      dataPoints,
      statistics,
    };
  }

  /**
   * Generate a single data point
   */
  private generateDataPoint(
    t: number,
    preset: { maxRpm: number; maxTorque: number; pattern: any; seaState: number },
    signals: string[],
    config: SimulationConfig,
    state: { oilTemp: number; coolantTemp: number; faultDrift: number },
    faultStart: number,
    faultSeverity: number
  ): SimulatedTelemetryPoint {
    const rpm = OperationalPatternGenerator.generateRpm(t, preset.pattern, preset.maxRpm);
    const torque = PhysicsEngine.clamp(
      PhysicsEngine.torqueFromRpm(rpm, preset.maxTorque) + PhysicsEngine.randn(0, 8),
      40,
      preset.maxTorque
    );
    const loadPercent = PhysicsEngine.clamp((100 * torque) / preset.maxTorque, 5, 100);

    const hydPressure =
      signals.includes("hyd_pressure") || signals.includes("ramp_hyd_pressure")
        ? PhysicsEngine.hydraulicCycle(t, 260, 0.12, 6, 185)
        : undefined;

    const winchTension = signals.includes("winch_tension")
      ? Math.max(
          0,
          cryptoRandom() < 0.1 ? 50 + 300 * cryptoRandom() : 5 + PhysicsEngine.randn(0, 3)
        )
      : undefined;

    const towlineTension = signals.includes("towline_tension")
      ? Math.max(
          0,
          cryptoRandom() < 0.08 ? 100 + 600 * cryptoRandom() : 8 + PhysicsEngine.randn(0, 5)
        )
      : undefined;

    const cargoPumpPressure = signals.includes("cargo_pump_pressure")
      ? cryptoRandom() < 0.4
        ? 120 + 30 * Math.sin(t / 40) + PhysicsEngine.randn(0, 5)
        : 5 + PhysicsEngine.randn(0, 1)
      : undefined;

    const cargoPumpTemp = signals.includes("cargo_pump_temp")
      ? cryptoRandom() < 0.4
        ? 35 + 0.02 * t + PhysicsEngine.randn(0, 0.2)
        : 28 + PhysicsEngine.randn(0, 0.2)
      : undefined;

    const genLoad = signals.includes("gen_load")
      ? PhysicsEngine.clamp(
          30 + 0.2 * loadPercent + (cryptoRandom() < 0.3 ? 30 : 0) + PhysicsEngine.randn(0, 4),
          10,
          100
        )
      : undefined;

    const thrusterLoad = signals.includes("thruster_load")
      ? PhysicsEngine.dpThrusterLoad(t, 0.5)
      : undefined;

    const dpStatus = signals.includes("dp_status")
      ? thrusterLoad && thrusterLoad > 35
        ? 1
        : 0
      : undefined;

    const combinedLoad = PhysicsEngine.clamp(
      0.8 * loadPercent + (genLoad || 0) * 0.4 + (thrusterLoad || 0) * 0.6,
      0,
      100
    );

    const oilTemp = PhysicsEngine.temperatureStep(state.oilTemp, combinedLoad, 28, 180);
    const coolantTemp = PhysicsEngine.temperatureStep(state.coolantTemp, combinedLoad, 27, 150);

    const vibration_x =
      PhysicsEngine.vibrationComponents(loadPercent, state.faultDrift) +
      PhysicsEngine.randn(0, 0.01);
    const vibration_y =
      PhysicsEngine.vibrationComponents(loadPercent, state.faultDrift) +
      PhysicsEngine.randn(0, 0.01);
    const vibration_z =
      PhysicsEngine.vibrationComponents(loadPercent, state.faultDrift) +
      PhysicsEngine.randn(0, 0.012);

    const fuelRate = PhysicsEngine.clamp(20 + 0.15 * torque + PhysicsEngine.randn(0, 1.2), 10, 120);
    const imu = PhysicsEngine.seaState(t, preset.seaState);

    return {
      timestamp: new Date(Date.now() + t * 1000),
      rpm,
      shaft_torque: torque,
      vibration_x,
      vibration_y,
      vibration_z,
      oil_temp: oilTemp,
      coolant_temp: coolantTemp,
      fuel_rate: fuelRate,
      hyd_pressure: hydPressure,
      winch_tension: winchTension,
      towline_tension: towlineTension,
      cargo_pump_pressure: cargoPumpPressure,
      cargo_pump_temp: cargoPumpTemp,
      gen_load: genLoad,
      thruster_load: thrusterLoad,
      dp_status: dpStatus,
      imu_heave: imu.imu_heave,
      imu_pitch: imu.imu_pitch,
      imu_roll: imu.imu_roll,
    };
  }

  /**
   * Simulate and write to database
   */
  async simulateAndIngest(config: SimulationConfig): Promise<SimulationResult> {
    const result = await this.simulate(config);

    logger.info(`[VesselSimulator] Ingesting ${result.dataPoints.length} telemetry points to database...`);

    let totalRecords = 0;
    const batchSize = 100;

    for (let i = 0; i < result.dataPoints.length; i += batchSize) {
      const batchPoints = result.dataPoints.slice(i, i + batchSize);

      for (const point of batchPoints) {
        for (const { key, sensorType, unit } of SENSOR_MAPPINGS) {
          const value = point[key];
          if (value !== undefined && value !== null) {
            await this.storage.createTelemetryReading({
              equipmentId: config.equipmentId,
              deviceId: config.deviceId,
              orgId: config.orgId,
              ts: point.timestamp,
              sensorType,
              value: typeof value === "number" ? value : 0,
              unit,
              metadata: {
                simulated: true,
                vesselType: config.vesselType,
              },
            });
            totalRecords++;
          }
        }
      }

      logger.info(`[VesselSimulator] Progress: ${Math.min(i + batchSize, result.dataPoints.length)}/${result.dataPoints.length} points`);
    }

    logger.info(`[VesselSimulator] Successfully ingested ${totalRecords} telemetry records from ${result.dataPoints.length} data points`);

    return result;
  }
}
