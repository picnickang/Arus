import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "../../../db";
import {
  equipmentFeatures,
  type EquipmentFeature,
  type InsertEquipmentFeature,
} from "@shared/schema";
import type { FeatureStorePort } from "./ports";
import type { TelemetryPort, FeatureStoreTelemetryReading } from "./telemetry-port";
import { TelemetryAdapter } from "./telemetry-adapter";
import { createLogger } from "../../../lib/structured-logger";
const logger = createLogger("PdmPlatform:FeatureStore");

interface SensorStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  count: number;
  rms: number;
  delta: number;
  rateOfChange: number;
}

function computeStats(values: number[]): SensorStats {
  if (values.length === 0) {
    return { mean: 0, std: 0, min: 0, max: 0, count: 0, rms: 0, delta: 0, rateOfChange: 0 };
  }

  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(n - 1, 1);
  const std = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rms = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / n);
  const delta = max - min;
  const rateOfChange = n > 1 ? ((values[0] ?? 0) - (values[n - 1] ?? 0)) / n : 0;

  return {
    mean: round(mean),
    std: round(std),
    min: round(min),
    max: round(max),
    count: n,
    rms: round(rms),
    delta: round(delta),
    rateOfChange: round(rateOfChange),
  };
}

function computeKurtosis(values: number[], mean: number, std: number): number {
  if (values.length < 4 || std === 0) {
    return 3.0;
  }
  const n = values.length;
  const m4 = values.reduce((sum, v) => sum + ((v - mean) / std) ** 4, 0) / n;
  return round(m4);
}

function computeSkewness(values: number[], mean: number, std: number): number {
  if (values.length < 3 || std === 0) {
    return 0;
  }
  const n = values.length;
  const m3 = values.reduce((sum, v) => sum + ((v - mean) / std) ** 3, 0) / n;
  return round(m3);
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function allowPdmDemoFallbacks(): boolean {
  return process.env['NODE_ENV'] !== "production" || process.env['ALLOW_PDM_DEMO_FALLBACKS'] === "true";
}

export class FeatureStoreAdapter implements FeatureStorePort {
  private telemetry: TelemetryPort;

  constructor(telemetryPort?: TelemetryPort) {
    this.telemetry = telemetryPort ?? new TelemetryAdapter();
  }

  async computeAndStore(
    orgId: string,
    equipmentId: string,
    windowMinutes = 60
  ): Promise<EquipmentFeature> {
    const readings = await this.telemetry.getRecentReadings(orgId, equipmentId, windowMinutes);

    let features: InsertEquipmentFeature;

    if (readings.length > 0) {
      features = this.computeFromTelemetry(orgId, equipmentId, windowMinutes, readings);
      logger.info("[FeatureStore] Computed features from real telemetry", {
        orgId,
        equipmentId,
        readingCount: readings.length,
      });
    } else {
      if (!allowPdmDemoFallbacks()) {
        throw new Error("No telemetry data available for feature computation; demo fallback disabled in production.");
      }
      features = this.computeStubFeatures(orgId, equipmentId, windowMinutes);
      logger.warn("[FeatureStore] No telemetry data found, using demo fallback features", {
        orgId,
        equipmentId,
        windowMinutes,
      });
    }

    const [result] = await db.insert(equipmentFeatures).values(features).returning();
    if (!result) {throw new Error("computeAndStore: equipmentFeatures insert returned no row");}
    logger.info("[FeatureStore] Stored features", {
      orgId,
      equipmentId,
      featureId: result.id,
      source: readings.length > 0 ? "telemetry" : "demo-fallback",
    });
    return result;
  }

  private computeFromTelemetry(
    orgId: string,
    equipmentId: string,
    windowMinutes: number,
    readings: FeatureStoreTelemetryReading[]
  ): InsertEquipmentFeature {
    const bySensor: Record<string, number[]> = {};
    for (const r of readings) {
      const key = r.sensorType.toLowerCase();
      if (!bySensor[key]) {
        bySensor[key] = [];
      }
      bySensor[key].push(r.value);
    }

    const tempValues = this.findSensorValues(bySensor, [
      "temperature",
      "temp",
      "exhaust_temp",
      "coolant_temp",
      "oil_temp",
    ]);
    const vibValues = this.findSensorValues(bySensor, [
      "vibration",
      "vib",
      "acceleration",
      "vibration_rms",
    ]);
    const pressValues = this.findSensorValues(bySensor, [
      "pressure",
      "press",
      "oil_pressure",
      "fuel_pressure",
      "boost_pressure",
    ]);

    const tempStats = computeStats(tempValues);
    const vibStats = computeStats(vibValues);
    const pressStats = computeStats(pressValues);

    const vibForKurtosis = vibValues.length > 0 ? vibValues : tempValues;
    const kurtosis = computeKurtosis(
      vibForKurtosis,
      vibStats.mean || tempStats.mean,
      vibStats.std || tempStats.std || 1
    );
    const skewness = computeSkewness(
      vibForKurtosis,
      vibStats.mean || tempStats.mean,
      vibStats.std || tempStats.std || 1
    );

    return {
      orgId,
      equipmentId,
      timestamp: new Date(),
      windowMinutes,
      meanTemp: tempStats.mean,
      stdTemp: tempStats.std,
      meanVibration: vibStats.mean,
      stdVibration: vibStats.std,
      meanPressure: pressStats.mean,
      stdPressure: pressStats.std,
      rmsVibration: vibStats.rms,
      peakToPeak: vibStats.delta,
      kurtosis,
      skewness,
      sampleCount: readings.length,
    };
  }

  private findSensorValues(bySensor: Record<string, number[]>, candidates: string[]): number[] {
    for (const candidate of candidates) {
      if (bySensor[candidate] && bySensor[candidate].length > 0) {
        return bySensor[candidate];
      }
    }
    for (const key of Object.keys(bySensor)) {
      for (const candidate of candidates) {
        if (key.includes(candidate)) {
          return bySensor[key] ?? [];
        }
      }
    }
    return [];
  }

  private computeStubFeatures(
    orgId: string,
    equipmentId: string,
    windowMinutes: number
  ): InsertEquipmentFeature {
    return {
      orgId,
      equipmentId,
      timestamp: new Date(),
      windowMinutes,
      meanTemp: this.deterministicValue(equipmentId, "temp", 40, 90),
      stdTemp: this.deterministicValue(equipmentId, "tempStd", 1, 8),
      meanVibration: this.deterministicValue(equipmentId, "vib", 0.5, 5),
      stdVibration: this.deterministicValue(equipmentId, "vibStd", 0.1, 1.5),
      meanPressure: this.deterministicValue(equipmentId, "press", 100, 300),
      stdPressure: this.deterministicValue(equipmentId, "pressStd", 2, 15),
      rmsVibration: this.deterministicValue(equipmentId, "rms", 1, 6),
      peakToPeak: this.deterministicValue(equipmentId, "p2p", 2, 12),
      kurtosis: this.deterministicValue(equipmentId, "kurt", 1.5, 6),
      skewness: this.deterministicValue(equipmentId, "skew", -1, 1),
      sampleCount: 0,
    };
  }

  private deterministicValue(equipmentId: string, seed: string, min: number, max: number): number {
    let hash = 0;
    const str = equipmentId + seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    const normalized = (Math.abs(hash) % 10000) / 10000;
    return round(min + normalized * (max - min));
  }

  async getLatest(orgId: string, equipmentId: string): Promise<EquipmentFeature | null> {
    const [result] = await db
      .select()
      .from(equipmentFeatures)
      .where(
        and(eq(equipmentFeatures.orgId, orgId), eq(equipmentFeatures.equipmentId, equipmentId))
      )
      .orderBy(desc(equipmentFeatures.timestamp))
      .limit(1);
    return result ?? null;
  }

  async getHistory(
    orgId: string,
    equipmentId: string,
    from: Date,
    to: Date
  ): Promise<EquipmentFeature[]> {
    return db
      .select()
      .from(equipmentFeatures)
      .where(
        and(
          eq(equipmentFeatures.orgId, orgId),
          eq(equipmentFeatures.equipmentId, equipmentId),
          gte(equipmentFeatures.timestamp, from),
          lte(equipmentFeatures.timestamp, to)
        )
      )
      .orderBy(desc(equipmentFeatures.timestamp));
  }
}

