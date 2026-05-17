import { eq, and, gte, desc } from "drizzle-orm";
import { db } from "../../../db";
import { equipmentTelemetry } from "@shared/schema";
import type { TelemetryPort, TelemetryReading } from "./telemetry-port";
import { logger } from "../../../utils/logger";

export class TelemetryAdapter implements TelemetryPort {
  async getRecentReadings(
    orgId: string,
    equipmentId: string,
    windowMinutes: number
  ): Promise<TelemetryReading[]> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);

    try {
      return await db
        .select({
          sensorType: equipmentTelemetry.sensorType,
          value: equipmentTelemetry.value,
          ts: equipmentTelemetry.ts,
          unit: equipmentTelemetry.unit,
        })
        .from(equipmentTelemetry)
        .where(
          and(
            eq(equipmentTelemetry.orgId, orgId),
            eq(equipmentTelemetry.equipmentId, equipmentId),
            gte(equipmentTelemetry.ts, cutoff)
          )
        )
        .orderBy(desc(equipmentTelemetry.ts))
        .limit(5000);
    } catch (error: any) {
      // @ts-ignore -- bulk-silence
      logger.warn("[TelemetryAdapter] Failed to query telemetry, returning empty", {
        error: error.message,
      });
      return [];
    }
  }

  async getAvailableSensorTypes(orgId: string, equipmentId: string): Promise<string[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const rows = await db
        .selectDistinct({ sensorType: equipmentTelemetry.sensorType })
        .from(equipmentTelemetry)
        .where(
          and(
            eq(equipmentTelemetry.orgId, orgId),
            eq(equipmentTelemetry.equipmentId, equipmentId),
            gte(equipmentTelemetry.ts, cutoff)
          )
        );
      return rows.map((r) => r.sensorType);
    } catch {
      return [];
    }
  }
}
