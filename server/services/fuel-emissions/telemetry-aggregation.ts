/**
 * Telemetry Aggregation - Aggregate equipment telemetry for fuel calculations
 *
 * Reconciled to the canonical equipment_telemetry shape: one row per
 * (equipment_id, sensor_type, value, ts). Previous implementation used a
 * phantom jsonb `readings` column and a phantom `timestamp` column that do
 * not exist in the database — every query silently returned no rows.
 *
 * Sensor type names follow the convention used by ingestion paths:
 *   engineLoad, rpm, sog, distanceNm, generatorLoad
 *
 * Installed power is read from equipment.specifications JSONB (->>'installedPower')
 * because the canonical equipment table has no installed_power column.
 */

import { db } from "../../db";
import { equipment, equipmentTelemetry } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { TelemetryPeriod } from "./types";

export async function aggregateTelemetryForPeriod(
  orgId: string,
  vesselId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<TelemetryPeriod | null> {
  // Canonical equipment has `type` and `system_type`; no `category` or `status`
  // columns. Treat any active equipment whose systemType or type marks it as
  // propulsion as an engine for aggregation purposes.
  const engineEquipment = await db
    .select({
      id: equipment.id,
      installedPower: sql<number | null>`CAST(${equipment.specifications}->>'installedPower' AS FLOAT)`,
    })
    .from(equipment)
    .where(
      and(
        eq(equipment.vesselId, vesselId),
        eq(equipment.isActive, true),
        sql`(${equipment.systemType} = 'propulsion' OR ${equipment.type} ILIKE '%propulsion%' OR ${equipment.type} ILIKE '%main engine%')`
      )
    );

  if (engineEquipment.length === 0) {
    return null;
  }

  const equipmentIds = engineEquipment.map((e) => e.id);
  const totalInstalledPower = engineEquipment.reduce((sum, e) => sum + (e.installedPower ?? 0), 0);

  // Pivot the normalized (sensor_type, value) rows into per-metric averages
  // using FILTER clauses. Each FILTER restricts the aggregation to rows of
  // the matching sensor_type.
  const telemetryData = await db
    .select({
      avgEngineLoad: sql<number>`avg(${equipmentTelemetry.value}) FILTER (WHERE ${equipmentTelemetry.sensorType} = 'engineLoad')`,
      avgRpm: sql<number>`avg(${equipmentTelemetry.value}) FILTER (WHERE ${equipmentTelemetry.sensorType} = 'rpm')`,
      avgSog: sql<number>`avg(${equipmentTelemetry.value}) FILTER (WHERE ${equipmentTelemetry.sensorType} = 'sog')`,
      sumDistance: sql<number>`sum(${equipmentTelemetry.value}) FILTER (WHERE ${equipmentTelemetry.sensorType} = 'distanceNm')`,
      avgGeneratorLoad: sql<number>`avg(${equipmentTelemetry.value}) FILTER (WHERE ${equipmentTelemetry.sensorType} = 'generatorLoad')`,
      dataPoints: sql<number>`count(*)`,
      minTimestamp: sql<Date>`min(${equipmentTelemetry.ts})`,
      maxTimestamp: sql<Date>`max(${equipmentTelemetry.ts})`,
    })
    .from(equipmentTelemetry)
    .where(
      and(
        eq(equipmentTelemetry.orgId, orgId),
        sql`${equipmentTelemetry.equipmentId} = ANY(ARRAY[${sql.join(
          equipmentIds.map((id: string) => sql`${id}`),
          sql`, `
        )}]::text[])`,
        gte(equipmentTelemetry.ts, periodStart),
        lte(equipmentTelemetry.ts, periodEnd)
      )
    );

  const data = telemetryData[0];

  if (!data || data.dataPoints === 0) {
    return null;
  }

  const periodHours = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60);
  const avgLoad = data.avgEngineLoad ?? 0;
  const meRunningHours = avgLoad > 5 ? periodHours : 0;
  const avgPowerKw = (avgLoad / 100) * totalInstalledPower;
  const totalPowerKwh = avgPowerKw * meRunningHours;
  const avgSpeed = data.avgSog ?? 0;
  const distanceNm = data.sumDistance ?? avgSpeed * periodHours;

  return {
    periodStart,
    periodEnd,
    avgEngineLoad: avgLoad,
    avgGeneratorLoad: data.avgGeneratorLoad ?? 0,
    meRunningHours,
    dgRunningHours: (data.avgGeneratorLoad ?? 0) > 5 ? periodHours : 0,
    totalPowerKwh,
    distanceNm,
    avgSpeedKn: avgSpeed,
    dataPoints: data.dataPoints ?? 0,
  };
}
