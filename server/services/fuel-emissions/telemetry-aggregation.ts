/**
 * Telemetry Aggregation - Aggregate equipment telemetry for fuel calculations
 */

import { db } from '../../db';
import { equipment, equipmentTelemetry } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import type { TelemetryPeriod } from './types';

export async function aggregateTelemetryForPeriod(
  orgId: string,
  vesselId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<TelemetryPeriod | null> {
  const engineEquipment = await db
    .select({ id: equipment.id, installedPower: equipment.installedPower })
    .from(equipment)
    .where(
      and(
        eq(equipment.vesselId, vesselId),
        eq(equipment.category, 'propulsion'),
        eq(equipment.status, 'operational')
      )
    );

  if (engineEquipment.length === 0) {
    return null;
  }

  const equipmentIds = engineEquipment.map((e) => e.id);
  const totalInstalledPower = engineEquipment.reduce((sum, e) => sum + (e.installedPower ?? 0), 0);

  const telemetryData = await db
    .select({
      avgEngineLoad: sql<number>`avg(CAST(${equipmentTelemetry.readings}->>'engineLoad' AS FLOAT))`,
      avgRpm: sql<number>`avg(CAST(${equipmentTelemetry.readings}->>'rpm' AS FLOAT))`,
      avgSog: sql<number>`avg(CAST(${equipmentTelemetry.readings}->>'sog' AS FLOAT))`,
      sumDistance: sql<number>`sum(CAST(${equipmentTelemetry.readings}->>'distanceNm' AS FLOAT))`,
      dataPoints: sql<number>`count(*)`,
      minTimestamp: sql<Date>`min(${equipmentTelemetry.timestamp})`,
      maxTimestamp: sql<Date>`max(${equipmentTelemetry.timestamp})`,
      avgGeneratorLoad: sql<number>`avg(CAST(${equipmentTelemetry.readings}->>'generatorLoad' AS FLOAT))`,
    })
    .from(equipmentTelemetry)
    .where(
      and(
        eq(equipmentTelemetry.orgId, orgId),
        sql`${equipmentTelemetry.equipmentId} = ANY(${equipmentIds})`,
        gte(equipmentTelemetry.timestamp, periodStart),
        lte(equipmentTelemetry.timestamp, periodEnd)
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
