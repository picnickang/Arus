/**
 * ML Ensemble Feature Conversion
 * 
 * Convert time-series data to classification features for RF/XGBoost.
 */

import type { TimeSeriesFeatures, ClassificationFeatures } from "../ml-training-data.js";
import { bucketTelemetry } from "../ml-time-bucketing.js";
import { dbEquipmentStorage } from "../db/equipment/index.js";
import { workOrderService } from "../services/domains/work-order-service.js";
import { calculateStats } from "./helpers.js";

const isTemperature = (key: string) => /(temp|temperature|coolant|oil_temp|exhaust)/i.test(key);
const isVibration = (key: string) => /(vib|vibration|accel|acceleration|rms|fft)/i.test(key);
const isPressure = (key: string) => /(press|pressure|bar|psi|fuel_press|oil_press)/i.test(key);

export async function convertToClassificationFeatures(
  timeSeriesData: TimeSeriesFeatures[],
  equipmentId: string,
  orgId: string
): Promise<ClassificationFeatures> {
  const equipment = await dbEquipmentStorage.getEquipment(orgId, equipmentId);

  const telemetryData: any[] = [];
  for (const dataPoint of timeSeriesData) {
    for (const [sensorType, value] of Object.entries(dataPoint.features)) {
      telemetryData.push({
        id: `${equipmentId}-${dataPoint.timestamp.getTime()}-${sensorType}`,
        equipmentId,
        ts: dataPoint.timestamp,
        sensorType,
        value: typeof value === "number" ? value : 0,
        unit: "",
        orgId,
      });
    }
  }

  const bucketed = bucketTelemetry(telemetryData, { bucketSizeMs: 1000 });

  if (bucketed.length === 0) {
    return {
      equipmentId,
      equipmentType: equipment?.type || "unknown",
      features: {},
      label: "healthy",
      failureRisk: 0,
    } as any;
  }

  const allSensorValues: Map<string, number[]> = new Map();

  for (const bucket of bucketed) {
    for (const [sensorType, value] of bucket.sensors.entries()) {
      if (!allSensorValues.has(sensorType)) {
        allSensorValues.set(sensorType, []);
      }
      allSensorValues.get(sensorType)!.push(value);
    }
  }

  const temperatureValues: number[] = [];
  const vibrationValues: number[] = [];
  const pressureValues: number[] = [];

  for (const [sensorType, values] of allSensorValues.entries()) {
    if (isTemperature(sensorType)) {
      temperatureValues.push(...values);
    } else if (isVibration(sensorType)) {
      vibrationValues.push(...values);
    } else if (isPressure(sensorType)) {
      pressureValues.push(...values);
    }
  }

  const tempStats = calculateStats(temperatureValues);
  const vibStats = calculateStats(vibrationValues);
  const presStats = calculateStats(pressureValues);

  const workOrders = await workOrderService.getWorkOrdersWithDetails(equipmentId, orgId);
  const lastMaintenance = workOrders
    .filter((wo) => wo.status === "completed")
    .sort((a, b) => (b.actualEndDate?.getTime() || 0) - (a.actualEndDate?.getTime() || 0))[0];

  const maintenanceAge = lastMaintenance?.actualEndDate
    ? Math.floor((Date.now() - lastMaintenance.actualEndDate.getTime()) / 86400000)
    : undefined;

  const failureHistory = workOrders.filter(
    (wo) => wo.priority >= 4 && wo.status === "completed"
  ).length;

  const features: Record<string, number> = {
    avgTemperature: tempStats.avg,
    maxTemperature: tempStats.max,
    stdTemperature: tempStats.std,
    avgVibration: vibStats.avg,
    maxVibration: vibStats.max,
    stdVibration: vibStats.std,
    avgPressure: presStats.avg,
    minPressure: presStats.min,
    cycleCount: bucketed.length,
    failureHistory,
  };

  if (maintenanceAge !== undefined) {
    features.maintenanceAge = maintenanceAge;
  }

  return {
    equipmentId,
    equipmentType: equipment?.type || "unknown",
    features,
    label: "healthy",
    failureRisk: 0,
  } as any;
}
