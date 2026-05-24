/**
 * Vessel Intelligence Calculation Helpers
 *
 * Utility functions for vessel metrics, performance, and trend calculations.
 */

import type { EquipmentTelemetry, WorkOrder, Vessel as SelectVessel } from "@shared/schema";
import type { VesselLearnings, HistoricalContext } from "./types.js";

export function calculateOperatingHours(vessel: SelectVessel): number {
  const commissionDate = vessel.commissionDate
    ? new Date(vessel.commissionDate)
    : new Date(vessel.createdAt ?? Date.now());
  const ageYears = (Date.now() - commissionDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.round(ageYears * 365.25 * 24);
}

export function calculateVesselAge(vessel: SelectVessel): number {
  const commissionDate = vessel.commissionDate
    ? new Date(vessel.commissionDate)
    : new Date(vessel.createdAt ?? Date.now());
  return Math.round((Date.now() - commissionDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export function calculateAverageResolutionTime(workOrders: WorkOrder[]): number {
  const completed = workOrders.filter((wo) => wo.status === "completed" && wo.actualEndDate);
  if (completed.length === 0) {
    return 0;
  }

  const totalHours = completed.reduce((sum, wo) => {
    const start = new Date(wo.createdAt ?? Date.now()).getTime();
    const end = new Date(wo.actualEndDate!).getTime();
    return sum + (end - start) / (60 * 60 * 1000);
  }, 0);

  return Math.round(totalHours / completed.length);
}

export function calculatePerformanceMetrics(
  workOrders: WorkOrder[],
  vesselAge: number
): HistoricalContext["performanceMetrics"] {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentWorkOrders = workOrders.filter((wo) => new Date(wo.createdAt ?? Date.now()) >= thirtyDaysAgo);

  const totalDowntimeHours = recentWorkOrders
    .filter((wo) => wo.affectsVesselDowntime)
    .reduce((sum, wo) => sum + (wo.actualDowntimeHours || wo.estimatedDowntimeHours || 0), 0);

  const analysisPeriodHours = 30 * 24;
  const operatingHours = Math.max(0, analysisPeriodHours - totalDowntimeHours);
  const availability = analysisPeriodHours > 0 ? (operatingHours / analysisPeriodHours) * 100 : 100;

  const failureOrders = recentWorkOrders.filter(
    (wo) => (wo.workOrderType) === "corrective" || String(wo.priority) === "critical" || String(wo.priority) === "urgent"
  );
  const mtbf =
    operatingHours > 0 && failureOrders.length > 0
      ? operatingHours / failureOrders.length
      : operatingHours > 0
        ? operatingHours
        : 0;
  const mttr = calculateAverageResolutionTime(failureOrders);
  const reliability = mtbf > 0 && mttr >= 0 ? (mtbf / (mtbf + mttr)) * 100 : 0;

  const avgResolutionTime = calculateAverageResolutionTime(recentWorkOrders);
  const maintainability =
    avgResolutionTime > 0 ? Math.max(0, 100 - (avgResolutionTime / 48) * 50) : 100;

  return {
    availability: Math.round(availability),
    reliability: Math.round(reliability),
    maintainability: Math.round(maintainability),
  };
}

export function analyzeEquipmentHealth(
  equipment: Array<{ healthScore?: number | null } & Record<string, unknown>>
): HistoricalContext["equipmentHealth"] {
  const health = { critical: 0, warning: 0, normal: 0, excellent: 0 };

  equipment.forEach((eq) => {
    const healthScore = eq.healthScore || 75;
    if (healthScore >= 90) {
      health.excellent++;
    } else if (healthScore >= 70) {
      health.normal++;
    } else if (healthScore >= 50) {
      health.warning++;
    } else {
      health.critical++;
    }
  });

  return health;
}

export function calculateComplianceScore(
  workOrders: WorkOrder[],
  history: HistoricalContext["maintenanceHistory"]
): number {
  const total = history.scheduled + history.preventive + history.unscheduled;
  if (total === 0) {
    return 100;
  }

  const planned = history.scheduled + history.preventive;
  const complianceRate = (planned / total) * 100;

  return Math.round(complianceRate);
}

export function byCreatedAtAsc(a: WorkOrder, b: WorkOrder): number {
  return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
}

export function calculateAverageDaysBetween(orders: WorkOrder[]): number {
  if (orders.length < 2) {
    return 0;
  }

  const sorted = [...orders].sort(byCreatedAtAsc);
  let totalDays = 0;

  for (let i = 1; i < sorted.length; i++) {
    const days =
      (new Date(sorted[i].createdAt ?? 0).getTime() - new Date(sorted[i - 1].createdAt ?? 0).getTime()) /
      (24 * 60 * 60 * 1000);
    totalDays += days;
  }

  return totalDays / (sorted.length - 1);
}

export function identifyCorrelatedMetrics(
  telemetry: EquipmentTelemetry[],
  workOrders: WorkOrder[]
): string[] {
  const metrics = new Set<string>();

  workOrders.forEach((wo) => {
    const beforeFailure = telemetry.filter(
      (t) =>
        new Date(t.ts) < new Date(wo.createdAt ?? 0) &&
        new Date(t.ts) > new Date(new Date(wo.createdAt ?? 0).getTime() - 48 * 60 * 60 * 1000)
    );

    beforeFailure.forEach((t) => metrics.add(t.sensorType));
  });

  return Array.from(metrics);
}

export function generateFailureRecommendations(
  equipmentType: string | undefined,
  frequency: number,
  avgDays: number
): string[] {
  const recommendations = [];

  if (frequency > 3) {
    recommendations.push("Consider equipment replacement or major overhaul");
  }

  if (avgDays < 90) {
    recommendations.push(
      "Increase preventive maintenance frequency",
      "Implement condition-based monitoring"
    );
  }

  recommendations.push(`Schedule inspection every ${Math.floor(avgDays * 0.7)} days`);
  recommendations.push("Review operating procedures and training");

  return recommendations;
}

export function calculateEfficiencyTrends(
  telemetry: EquipmentTelemetry[]
): VesselLearnings["operationalInsights"]["efficiencyTrends"] {
  const trends: VesselLearnings["operationalInsights"]["efficiencyTrends"] = [];

  const sensorTypes = [...new Set(telemetry.map((t) => t.sensorType))];

  sensorTypes.forEach((sensorType) => {
    const readings = telemetry
      .filter((t) => t.sensorType === sensorType)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    if (readings.length >= 10) {
      const firstHalf = readings.slice(0, Math.floor(readings.length / 2));
      const secondHalf = readings.slice(Math.floor(readings.length / 2));

      const avgFirst = firstHalf.reduce((sum, r) => sum + r.value, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((sum, r) => sum + r.value, 0) / secondHalf.length;

      const change = ((avgSecond - avgFirst) / avgFirst) * 100;

      let trend: "improving" | "declining" | "stable" = "stable";
      if (Math.abs(change) > 10) {
        trend = change > 0 ? "improving" : "declining";
      }

      trends.push({
        metric: sensorType,
        trend,
        change: Math.round(change * 10) / 10,
      });
    }
  });

  return trends;
}

export function identifyEnvironmentalFactors(
  telemetry: EquipmentTelemetry[]
): VesselLearnings["operationalInsights"]["environmentalFactors"] {
  const factors: VesselLearnings["operationalInsights"]["environmentalFactors"] = [];

  const tempReadings = telemetry.filter((t) => t.sensorType.toLowerCase().includes("temp"));
  if (tempReadings.length > 0) {
    const avgTemp = tempReadings.reduce((sum, r) => sum + r.value, 0) / tempReadings.length;
    factors.push({
      factor: "Temperature",
      impact: avgTemp > 80 ? "high" : avgTemp > 60 ? "medium" : "low",
      description: `Average operating temperature: ${avgTemp.toFixed(1)}°C`,
    });
  }

  const vibReadings = telemetry.filter((t) => t.sensorType.toLowerCase().includes("vib"));
  if (vibReadings.length > 0) {
    const maxVib = Math.max(...vibReadings.map((r) => r.value));
    factors.push({
      factor: "Vibration",
      impact: maxVib > 50 ? "high" : maxVib > 25 ? "medium" : "low",
      description: `Peak vibration levels: ${maxVib.toFixed(2)} mm/s`,
    });
  }

  return factors;
}

export function determineCostTrend(
  ordersWithCost: WorkOrder[]
): "increasing" | "decreasing" | "stable" {
  if (ordersWithCost.length < 4) {
    return "stable";
  }

  const sorted = [...ordersWithCost].sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  );

  const firstQuarter = sorted.slice(0, Math.floor(sorted.length / 4));
  const lastQuarter = sorted.slice(-Math.floor(sorted.length / 4));

  const avgFirst =
    firstQuarter.reduce((sum, wo) => sum + ((Number(wo.estimatedCostPerHour ?? 0) || 0) * (Number(wo.estimatedHours ?? 0) || 0)), 0) / firstQuarter.length;
  const avgLast =
    lastQuarter.reduce((sum, wo) => sum + ((Number(wo.estimatedCostPerHour ?? 0) || 0) * (Number(wo.estimatedHours ?? 0) || 0)), 0) / lastQuarter.length;

  const change = ((avgLast - avgFirst) / avgFirst) * 100;

  if (Math.abs(change) < 15) {
    return "stable";
  }
  return change > 0 ? "increasing" : "decreasing";
}

export function calculatePredictiveLeadTime(
  readings: EquipmentTelemetry[],
  failures: WorkOrder[]
): number {
  if (failures.length === 0 || readings.length < 10) {
    return 0;
  }

  const leadTimes: number[] = [];

  failures.forEach((failure) => {
    const failureTime = new Date(failure.createdAt ?? 0).getTime();
    const beforeFailure = readings
      .filter(
        (r) =>
          new Date(r.ts).getTime() < failureTime &&
          new Date(r.ts).getTime() > failureTime - 168 * 60 * 60 * 1000
      )
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    if (beforeFailure.length >= 5) {
      const recentAvg = beforeFailure.slice(0, 5).reduce((sum, r) => sum + r.value, 0) / 5;
      const normalAvg = beforeFailure.slice(-10).reduce((sum, r) => sum + r.value, 0) / 10;

      if (Math.abs(recentAvg - normalAvg) / normalAvg > 0.2) {
        const anomalyTime = new Date(beforeFailure[0].ts).getTime();
        const hoursLead = (failureTime - anomalyTime) / (60 * 60 * 1000);
        leadTimes.push(hoursLead);
      }
    }
  });

  if (leadTimes.length === 0) {
    return 0;
  }
  return Math.round(leadTimes.reduce((sum, t) => sum + t, 0) / leadTimes.length);
}
