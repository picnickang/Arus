/**
 * Vessel Intelligence Operational Analysis
 *
 * Operational patterns, cost analysis, and predictive indicators.
 */

import type { EquipmentTelemetry, WorkOrder, Equipment } from "@shared/schema";
import type { VesselLearnings } from "./types.js";
import {
  calculateEfficiencyTrends,
  identifyEnvironmentalFactors,
  determineCostTrend,
  calculatePredictiveLeadTime,
} from "./calculation-helpers.js";

export function analyzeOperationalPatterns(
  telemetry: EquipmentTelemetry[],
  _equipment: Equipment[]
): VesselLearnings["operationalInsights"] {
  const hourlyLoad = new Map<number, number[]>();
  telemetry.forEach((t) => {
    const hour = new Date(t.ts).getHours();
    if (!hourlyLoad.has(hour)) {
      hourlyLoad.set(hour, []);
    }
    hourlyLoad.get(hour)!.push(t.value);
  });

  const peakLoadTimes: string[] = [];
  const avgLoads: [number, number][] = [];

  hourlyLoad.forEach((values, hour) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    avgLoads.push([hour, avg]);
  });

  avgLoads.sort((a, b) => b[1] - a[1]);
  peakLoadTimes.push(...avgLoads.slice(0, 3).map(([hour]) => `${hour}:00-${hour + 1}:00`));

  const efficiencyTrends = calculateEfficiencyTrends(telemetry);
  const environmentalFactors = identifyEnvironmentalFactors(telemetry);

  return {
    peakLoadTimes,
    efficiencyTrends,
    environmentalFactors,
  };
}

export function analyzeCosts(workOrders: WorkOrder[]): VesselLearnings["costAnalysis"] {
  const calcCost = (wo: WorkOrder): number =>
    (Number((wo as { estimatedCostPerHour?: unknown }).estimatedCostPerHour ?? 0) || 0) *
    (Number((wo as { estimatedHours?: unknown }).estimatedHours ?? 0) || 0);
  const ordersWithCost = workOrders.filter((wo) => calcCost(wo) > 0);
  const totalCost = ordersWithCost.reduce((sum, wo) => sum + calcCost(wo), 0);
  const avgCost = ordersWithCost.length > 0 ? totalCost / ordersWithCost.length : 0;

  const costByType = new Map<string, number>();
  ordersWithCost.forEach((wo) => {
    const type = (wo as { workOrderType?: string }).workOrderType || "other";
    costByType.set(type, (costByType.get(type) || 0) + calcCost(wo));
  });

  const costDrivers =
    totalCost > 0
      ? Array.from(costByType.entries())
          .map(([category, cost]) => ({
            category,
            percentage: (cost / totalCost) * 100,
          }))
          .sort((a, b) => b.percentage - a.percentage)
      : [];

  const costTrend = determineCostTrend(ordersWithCost);

  return {
    averageMaintenanceCost: avgCost,
    costTrend,
    costDrivers,
  };
}

export function identifyPredictiveIndicators(
  telemetry: EquipmentTelemetry[],
  workOrders: WorkOrder[]
): VesselLearnings["predictiveIndicators"] {
  const indicators: VesselLearnings["predictiveIndicators"] = [];

  const telemetryByEquipment = new Map<string, EquipmentTelemetry[]>();
  telemetry.forEach((t) => {
    if (!telemetryByEquipment.has(t.equipmentId)) {
      telemetryByEquipment.set(t.equipmentId, []);
    }
    telemetryByEquipment.get(t.equipmentId)!.push(t);
  });

  telemetryByEquipment.forEach((readings, equipmentId) => {
    const failures = workOrders.filter(
      (wo) =>
        wo.equipmentId === equipmentId && (String(wo.priority) === "critical" || (wo as { workOrderType?: string }).workOrderType === "corrective")
    );

    if (failures.length > 0 && readings.length > 20) {
      const sensorTypes = [...new Set(readings.map((r) => r.sensorType))];

      sensorTypes.forEach((sensorType) => {
        const sensorReadings = readings.filter((r) => r.sensorType === sensorType);
        const leadTime = calculatePredictiveLeadTime(sensorReadings, failures);

        if (leadTime > 0) {
          indicators.push({
            indicator: `${sensorType} anomaly detection`,
            leadTime,
            accuracy: Math.min(0.85, 0.6 + failures.length * 0.05),
            description: `${sensorType} readings show predictive value ${leadTime} hours before failure`,
          });
        }
      });
    }
  });

  return indicators;
}
