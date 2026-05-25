/**
 * Weibull Data Extraction
 *
 * Extract equipment life data and degradation metrics.
 */

import { dbEquipmentStorage, dbTelemetryStorage, workOrderService } from "../repositories";
import type { EquipmentLifeData } from "./types.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("WeibullRul:DataExtraction");

export async function getEquipmentLifeData(
  equipmentId: string,
  orgId: string
): Promise<EquipmentLifeData[]> {
  try {
    const workOrders = await workOrderService.getWorkOrdersWithDetails();
    const equipmentWorkOrders = workOrders
      .filter((wo) => wo.equipmentId === equipmentId)
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));

    if (equipmentWorkOrders.length < 2) {
      logger.info(`[Weibull RUL] Insufficient failure history for ${equipmentId} (${equipmentWorkOrders.length} events, need ≥2)`);
      return [];
    }

    const lifeData: EquipmentLifeData[] = [];
    let lastEventTime: Date | null = null;

    for (const workOrder of equipmentWorkOrders) {
      const eventTime = workOrder.createdAt ?? new Date(0);

      if (lastEventTime) {
        const timeBetweenFailures =
          (eventTime.getTime() - lastEventTime.getTime()) / (1000 * 60 * 60);

        if (timeBetweenFailures > 1 && timeBetweenFailures < 17520) {
          lifeData.push({
            equipmentId,
            age: timeBetweenFailures,
            degradationMetric: extractDegradationFromWorkOrder(workOrder),
            maintenanceEvents: [
              {
                timestamp: eventTime,
                type: (workOrder.priority as unknown) === "critical" ? "corrective" : "preventive",
                description: workOrder.description ?? "",
              },
            ],
          });
        }
      }

      lastEventTime = eventTime;
    }

    logger.info(`[Weibull RUL] Extracted ${lifeData.length} time-between-failures samples for ${equipmentId}`);
    return lifeData;
  } catch (error) {
    logger.error(`[Weibull RUL] Error retrieving failure history for ${equipmentId}:`, undefined, error);
    return [];
  }
}

export function extractDegradationFromWorkOrder(
  workOrder: { priority?: string | number | null; description?: string | null }
): number {
  const priorityWeight = {
    low: 0.2,
    normal: 0.4,
    high: 0.7,
    critical: 1,
  };

  const baseScore = priorityWeight[workOrder.priority as keyof typeof priorityWeight] || 0.5;

  const description = (workOrder.description || "").toLowerCase();
  const severityKeywords = {
    failure: 0.3,
    breakdown: 0.3,
    malfunction: 0.25,
    wear: 0.1,
    leak: 0.2,
    overheating: 0.25,
    vibration: 0.15,
    noise: 0.1,
    emergency: 0.4,
  };

  let severityBoost = 0;
  for (const [keyword, boost] of Object.entries(severityKeywords)) {
    if (description.includes(keyword)) {
      severityBoost += boost;
    }
  }

  return Math.min(1, baseScore + severityBoost);
}

interface TelemetryDayReading {
  ts?: Date | null;
  sensorType?: string | null;
  value?: number;
}

export function groupTelemetryByDay<T extends TelemetryDayReading>(
  telemetry: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  telemetry.forEach((reading) => {
    const day = reading.ts?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0];
    if (!groups.has(day)) {
      groups.set(day, []);
    }
    groups.get(day)!.push(reading);
  });

  return groups;
}

export function calculateDegradationMetric(dayData: TelemetryDayReading[]): number {
  if (dayData.length === 0) {
    return 0;
  }

  const weights = {
    temperature: 0.3,
    vibration: 0.4,
    pressure: 0.2,
    current: 0.1,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [sensorType, weight] of Object.entries(weights)) {
    const sensorData = dayData.filter((d) => d.sensorType === sensorType);
    if (sensorData.length > 0) {
      const avgValue = sensorData.reduce((sum, d) => sum + (d.value ?? 0), 0) / sensorData.length;
      weightedSum += avgValue * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export async function getCurrentEquipmentAge(equipmentId: string, orgId: string): Promise<number> {
  try {
    const equipmentInfo = await dbEquipmentStorage.getEquipment(orgId, equipmentId);

    const commDateRaw = (equipmentInfo as Record<string, unknown> | undefined)?.['commissioningDate'];
    if (commDateRaw) {
      const commissioningDate = new Date(commDateRaw as string | number | Date);
      const now = new Date();
      const ageMs = now.getTime() - commissioningDate.getTime();
      return Math.max(0, ageMs / (1000 * 60 * 60));
    }

    const telemetryData = await dbTelemetryStorage.getLatestTelemetryReadings(equipmentId, 1000);
    const equipmentTelemetry = telemetryData.filter((t) => t.equipmentId === equipmentId);

    if (equipmentTelemetry.length > 0) {
      const oldestReading = equipmentTelemetry.reduce((oldest, current) => {
        return !oldest.ts || (current.ts && current.ts < oldest.ts) ? current : oldest;
      });

      if (oldestReading.ts) {
        const ageMs = Date.now() - oldestReading.ts.getTime();
        return Math.max(0, ageMs / (1000 * 60 * 60));
      }
    }

    return 8760;
  } catch (error) {
    logger.error(`[Weibull RUL] Error getting age for ${equipmentId}:`, undefined, error);
    return 8760;
  }
}
