import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../../db";
import { equipment, equipmentFeatures } from "@shared/schema";
import type { EquipmentContext, EquipmentFeatureSnapshot, OperationalContextInput, NormalizedOperationalContext } from "../domain/types";
import type { OperationalContextPort, PdmContextPort } from "../domain/ports";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberFrom(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function stringFrom(value: unknown, fallback: string | null = null): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

export class DrizzlePdmContextAdapter implements PdmContextPort {
  async getEquipmentContext(orgId: string, equipmentId: string): Promise<EquipmentContext | null> {
    const [row] = await db
      .select({
        id: equipment.id,
        name: equipment.name,
        type: equipment.type,
        vesselId: equipment.vesselId,
        vesselName: equipment.vesselName,
        criticalityLevel: equipment.criticalityLevel,
        operatingParameters: equipment.operatingParameters,
      })
      .from(equipment)
      .where(and(eq(equipment.orgId, orgId), eq(equipment.id, equipmentId)))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      ...row,
      operatingParameters: asRecord(row.operatingParameters),
    };
  }

  async getRecentFeatureSnapshots(
    orgId: string,
    equipmentId: string,
    limit: number
  ): Promise<EquipmentFeatureSnapshot[]> {
    return db
      .select({
        id: equipmentFeatures.id,
        timestamp: equipmentFeatures.timestamp,
        windowMinutes: equipmentFeatures.windowMinutes,
        sampleCount: equipmentFeatures.sampleCount,
        meanTemp: equipmentFeatures.meanTemp,
        stdTemp: equipmentFeatures.stdTemp,
        meanVibration: equipmentFeatures.meanVibration,
        stdVibration: equipmentFeatures.stdVibration,
        meanPressure: equipmentFeatures.meanPressure,
        stdPressure: equipmentFeatures.stdPressure,
        rmsVibration: equipmentFeatures.rmsVibration,
        peakToPeak: equipmentFeatures.peakToPeak,
        kurtosis: equipmentFeatures.kurtosis,
        skewness: equipmentFeatures.skewness,
      })
      .from(equipmentFeatures)
      .where(and(eq(equipmentFeatures.orgId, orgId), eq(equipmentFeatures.equipmentId, equipmentId)))
      .orderBy(desc(equipmentFeatures.timestamp))
      .limit(Math.max(1, Math.min(limit, 96)));
  }
}

export class EquipmentOperationalContextAdapter implements OperationalContextPort {
  normalize(
    equipmentContext: EquipmentContext | null,
    override?: OperationalContextInput
  ): NormalizedOperationalContext {
    const params = equipmentContext?.operatingParameters ?? {};
    const notes: string[] = [];

    const operatingMode =
      override?.operatingMode ??
      (stringFrom(params.operatingMode) as NormalizedOperationalContext["operatingMode"] | null) ??
      "unknown";
    const loadFactor = Math.max(0.05, Math.min(1.5, override?.loadFactor ?? numberFrom(params.loadFactor, 0.65)!));
    const weatherSeverity = Math.max(
      0,
      Math.min(1, override?.weatherSeverity ?? numberFrom(params.weatherSeverity, 0)!)
    );
    const seaState = Math.max(0, Math.min(12, override?.seaState ?? numberFrom(params.seaState, 2)!));

    if (!equipmentContext?.operatingParameters && !override) {
      notes.push("No operating context was provided; using conservative vessel-default context.");
    }
    if (operatingMode === "heavy_weather" || weatherSeverity >= 0.7 || seaState >= 6) {
      notes.push("Heavy weather/load context is applied so PdM risk is not over-triggered by expected operating stress.");
    }

    const contextInputs = [
      override?.operatingMode ?? params.operatingMode,
      override?.loadFactor ?? params.loadFactor,
      override?.weatherSeverity ?? params.weatherSeverity,
      override?.seaState ?? params.seaState,
      override?.fuelBurnRate ?? params.fuelBurnRate,
      override?.shaftPower ?? params.shaftPower,
    ].filter((value) => value !== undefined && value !== null).length;

    return {
      operatingMode,
      loadFactor,
      weatherSeverity,
      seaState,
      speedOverGround: override?.speedOverGround ?? numberFrom(params.speedOverGround),
      fuelBurnRate: override?.fuelBurnRate ?? numberFrom(params.fuelBurnRate),
      shaftPower: override?.shaftPower ?? numberFrom(params.shaftPower),
      cargoLoadPercent: override?.cargoLoadPercent ?? numberFrom(params.cargoLoadPercent),
      routeSegment: override?.routeSegment ?? stringFrom(params.routeSegment),
      contextConfidence: Math.max(0.25, Math.min(0.95, 0.25 + contextInputs * 0.11)),
      notes,
    };
  }
}
