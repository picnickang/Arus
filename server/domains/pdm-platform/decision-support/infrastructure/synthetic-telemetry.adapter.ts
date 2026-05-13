import type { SyntheticTelemetryPort } from "../domain/ports";
import type {
  PdmHealthStatus,
  SyntheticTelemetryPoint,
  SyntheticTelemetryResult,
  SyntheticTelemetryScenario,
} from "../domain/types";

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) % 10000) / 10000;
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function kurtosis(values: number[]): number {
  if (values.length < 4) {
    return 3;
  }
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  const std = Math.sqrt(variance) || 1;
  return round(average(values.map((value) => ((value - mean) / std) ** 4)), 2);
}

function scenarioProfile(scenario: SyntheticTelemetryScenario): {
  expectedStatus: PdmHealthStatus;
  failureMode: string;
  tempSlope: number;
  vibSlope: number;
  fuelSlope: number;
  dropoutRate: number;
} {
  switch (scenario) {
    case "heavy_weather":
      return {
        expectedStatus: "watch",
        failureMode: "operational load stress",
        tempSlope: 0.02,
        vibSlope: 0.02,
        fuelSlope: 0.06,
        dropoutRate: 0,
      };
    case "cooling_degradation":
      return {
        expectedStatus: "degrading",
        failureMode: "cooling efficiency loss",
        tempSlope: 0.16,
        vibSlope: 0.02,
        fuelSlope: 0.02,
        dropoutRate: 0,
      };
    case "bearing_wear":
      return {
        expectedStatus: "degrading",
        failureMode: "bearing wear / alignment degradation",
        tempSlope: 0.04,
        vibSlope: 0.13,
        fuelSlope: 0.02,
        dropoutRate: 0,
      };
    case "fuel_inefficiency":
      return {
        expectedStatus: "watch",
        failureMode: "fuel efficiency degradation",
        tempSlope: 0.04,
        vibSlope: 0.02,
        fuelSlope: 0.14,
        dropoutRate: 0,
      };
    case "sensor_drift":
      return {
        expectedStatus: "watch",
        failureMode: "sensor drift / calibration issue",
        tempSlope: 0.09,
        vibSlope: 0.05,
        fuelSlope: 0.01,
        dropoutRate: 0,
      };
    case "sensor_dropout":
      return {
        expectedStatus: "watch",
        failureMode: "telemetry dropout / data quality risk",
        tempSlope: 0,
        vibSlope: 0,
        fuelSlope: 0,
        dropoutRate: 0.22,
      };
    case "progressive_failure":
      return {
        expectedStatus: "critical",
        failureMode: "progressive failure signature",
        tempSlope: 0.2,
        vibSlope: 0.18,
        fuelSlope: 0.1,
        dropoutRate: 0,
      };
    case "post_maintenance_recovery":
      return {
        expectedStatus: "optimal",
        failureMode: "post-maintenance recovery baseline",
        tempSlope: -0.08,
        vibSlope: -0.07,
        fuelSlope: -0.04,
        dropoutRate: 0,
      };
    case "normal":
    default:
      return {
        expectedStatus: "optimal",
        failureMode: "normal baseline operation",
        tempSlope: 0,
        vibSlope: 0,
        fuelSlope: 0,
        dropoutRate: 0,
      };
  }
}

export class SyntheticTelemetryAdapter implements SyntheticTelemetryPort {
  generate(input: {
    equipmentId: string;
    scenario: SyntheticTelemetryScenario;
    hours: number;
    intervalMinutes: number;
    loadFactor?: number;
    weatherSeverity?: number;
    seed?: string;
  }): SyntheticTelemetryResult {
    const hours = Math.max(1, Math.min(input.hours, 168));
    const intervalMinutes = Math.max(1, Math.min(input.intervalMinutes, 120));
    const sampleCount = Math.min(Math.ceil((hours * 60) / intervalMinutes), 1000);
    const rng = createRng(input.seed ?? `${input.equipmentId}:${input.scenario}`);
    const profile = scenarioProfile(input.scenario);
    const loadFactor = Math.max(0.1, Math.min(input.loadFactor ?? 0.68, 1.4));
    const weatherSeverity = Math.max(0, Math.min(input.weatherSeverity ?? 0, 1));
    const now = Date.now();
    const samples: SyntheticTelemetryPoint[] = [];

    for (let i = 0; i < sampleCount; i += 1) {
      const progress = sampleCount <= 1 ? 0 : i / (sampleCount - 1);
      const noise = () => (rng() - 0.5) * 2;
      const effectiveLoad = Math.max(0.1, loadFactor + weatherSeverity * 0.18 + noise() * 0.04);
      const sensorHealthy = rng() > profile.dropoutRate;
      const rpm = 650 + effectiveLoad * 1050 + noise() * 40;
      const oilTemp = 55 + effectiveLoad * 28 + profile.tempSlope * progress * 100 + noise() * 2.5;
      const coolantTemp = 50 + effectiveLoad * 20 + profile.tempSlope * progress * 75 + noise() * 2;
      const vibrationRms = 1.2 + effectiveLoad * 2.2 + profile.vibSlope * progress * 80 + noise() * 0.35;
      const fuelFlow = 16 + effectiveLoad * 60 + profile.fuelSlope * progress * 160 + noise() * 3;
      const pressure = 210 - profile.tempSlope * progress * 35 - profile.vibSlope * progress * 20 + noise() * 4;

      samples.push({
        timestamp: new Date(now - (sampleCount - 1 - i) * intervalMinutes * 60 * 1000).toISOString(),
        rpm: round(sensorHealthy ? rpm : 0),
        loadFactor: round(effectiveLoad, 3),
        oilTemp: round(sensorHealthy ? oilTemp : 0),
        coolantTemp: round(sensorHealthy ? coolantTemp : 0),
        vibrationRms: round(sensorHealthy ? vibrationRms : 0, 3),
        fuelFlow: round(sensorHealthy ? fuelFlow : 0),
        pressure: round(sensorHealthy ? pressure : 0),
        sensorHealthy,
      });
    }

    const healthySamples = samples.filter((sample) => sample.sensorHealthy);
    const temps = healthySamples.map((sample) => (sample.oilTemp + sample.coolantTemp) / 2);
    const vibrations = healthySamples.map((sample) => sample.vibrationRms);
    const pressures = healthySamples.map((sample) => sample.pressure);

    return {
      equipmentId: input.equipmentId,
      scenario: input.scenario,
      hours,
      intervalMinutes,
      samples,
      summary: {
        sampleCount: samples.length,
        expectedStatus: profile.expectedStatus,
        failureMode: profile.failureMode,
        usefulFor: [
          "PdM inference smoke tests",
          "feature-store validation",
          "alert threshold tuning",
          "post-maintenance outcome comparison",
        ],
      },
      featureHints: {
        meanTemp: round(average(temps)),
        meanVibration: round(average(vibrations), 3),
        rmsVibration: round(Math.sqrt(average(vibrations.map((value) => value * value))), 3),
        meanPressure: round(average(pressures)),
        kurtosis: kurtosis(vibrations),
        sampleCount: healthySamples.length,
      },
    };
  }
}

