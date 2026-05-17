import type { TwinStatePort } from "./ports";
import type { TwinDefinitionPort } from "../twin-definition/ports";
import type { TelemetryPort } from "../../feature-store/telemetry-port";
import type { AssetTwinState, InsertAssetTwinState } from "@shared/schema";
import { logger } from "../../../../utils/logger";

interface ModelCoefficients {
  [sensorType: string]: {
    intercept?: number;
    loadFactor?: number;
    ambientTempFactor?: number;
    nominalValue?: number;
  };
}

interface OperatingEnvelope {
  [sensorType: string]: {
    min: number;
    max: number;
  };
}

export class TwinStateService {
  constructor(
    private statePort: TwinStatePort,
    private definitionPort: TwinDefinitionPort,
    private telemetryPort: TelemetryPort
  ) {}

  async computeState(orgId: string, twinId: string): Promise<AssetTwinState> {
    const twin = await this.definitionPort.getTwin(orgId, twinId);
    if (!twin) {
      throw new Error(`Twin not found: ${twinId}`);
    }

    const template = await this.definitionPort.getTemplate(orgId, twin.templateId);
    if (!template) {
      throw new Error(`Template not found: ${twin.templateId}`);
    }

    const readings = await this.telemetryPort.getRecentReadings(orgId, twin.equipmentId, 60);

    const observedBySensor: Record<string, number[]> = {};
    for (const r of readings) {
      const key = r.sensorType.toLowerCase();
      if (!observedBySensor[key]) {
        observedBySensor[key] = [];
      }
      observedBySensor[key].push(r.value);
    }

    const observedValues: Record<string, number> = {};
    for (const [sensor, values] of Object.entries(observedBySensor)) {
      observedValues[sensor] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    const coefficients = (template.expectedBehavior as ModelCoefficients) || {};
    const envelope = (template.operatingEnvelope as OperatingEnvelope) || {};

    const expectedValues: Record<string, number> = {};
    for (const [sensor, coeff] of Object.entries(coefficients)) {
      const key = sensor.toLowerCase();
      if (coeff.nominalValue != null) {
        expectedValues[key] = coeff.nominalValue;
      } else {
        const intercept = coeff.intercept ?? 0;
        const loadFactor = coeff.loadFactor ?? 0;
        const ambientTempFactor = coeff.ambientTempFactor ?? 0;
        const loadPercent = observedValues["load"] ?? observedValues["load_percent"] ?? 75;
        const ambientTemp =
          observedValues["ambient_temp"] ?? observedValues["ambient_temperature"] ?? 25;
        expectedValues[key] =
          intercept + loadFactor * loadPercent + ambientTempFactor * ambientTemp;
      }
    }

    for (const sensor of Object.keys(observedValues)) {
      if (!expectedValues[sensor]) {
        expectedValues[sensor] = observedValues[sensor];
      }
    }

    const healthScore = this.computeHealthScore(observedValues, expectedValues, envelope);
    const efficiencyScore = this.computeEfficiencyScore(observedValues, expectedValues);
    const remainingUsefulLifeHours = this.computeRUL(orgId, twinId, healthScore);

    const operatingContext: Record<string, any> = {
      readingCount: readings.length,
      sensorCount: Object.keys(observedValues).length,
      computedAt: new Date().toISOString(),
    };

    const stateData: InsertAssetTwinState = {
      orgId,
      twinId,
      timestamp: new Date(),
      observedValues,
      expectedValues,
      healthScore: Math.round(healthScore * 100) / 100,
      efficiencyScore: Math.round(efficiencyScore * 100) / 100,
      remainingUsefulLifeHours: Math.round(remainingUsefulLifeHours * 10) / 10,
      operatingContext,
    };

    const saved = await this.statePort.saveState(stateData);

    // @ts-ignore -- bulk-silence
    logger.info("[TwinStateService] State computed", {
      orgId,
      twinId,
      healthScore: saved.healthScore,
      efficiencyScore: saved.efficiencyScore,
      rul: saved.remainingUsefulLifeHours,
    });

    return saved;
  }

  async getLatestState(orgId: string, twinId: string): Promise<AssetTwinState | null> {
    return this.statePort.getLatestState(orgId, twinId);
  }

  async getStateHistory(orgId: string, twinId: string, limit?: number): Promise<AssetTwinState[]> {
    return this.statePort.getStateHistory(orgId, twinId, limit);
  }

  private computeHealthScore(
    observed: Record<string, number>,
    expected: Record<string, number>,
    envelope: OperatingEnvelope
  ): number {
    const sensors = Object.keys(expected);
    if (sensors.length === 0) {
      return 100;
    }

    let totalWeightedDeviation = 0;
    let totalWeight = 0;

    for (const sensor of sensors) {
      const obs = observed[sensor];
      const exp = expected[sensor];
      if (obs == null || exp == null || exp === 0) {
        continue;
      }

      const env = envelope[sensor];
      const range = env ? env.max - env.min : Math.abs(exp) * 0.5 || 1;
      const deviation = Math.abs(obs - exp) / range;
      const weight = 1;

      totalWeightedDeviation += deviation * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 100;
    }

    const avgDeviation = totalWeightedDeviation / totalWeight;
    return Math.max(0, Math.min(100, 100 * (1 - avgDeviation)));
  }

  private computeEfficiencyScore(
    observed: Record<string, number>,
    expected: Record<string, number>
  ): number {
    const sensors = Object.keys(expected);
    if (sensors.length === 0) {
      return 100;
    }

    let ratioSum = 0;
    let count = 0;

    for (const sensor of sensors) {
      const obs = observed[sensor];
      const exp = expected[sensor];
      if (obs == null || exp == null || exp === 0) {
        continue;
      }

      const ratio = Math.min(obs / exp, exp / obs);
      ratioSum += ratio;
      count++;
    }

    if (count === 0) {
      return 100;
    }
    return Math.max(0, Math.min(100, (ratioSum / count) * 100));
  }

  private computeRUL(orgId: string, twinId: string, currentHealth: number): number {
    const maxRULHours = 8760;
    const rulHours = (currentHealth / 100) * maxRULHours;
    return Math.max(0, rulHours);
  }
}
