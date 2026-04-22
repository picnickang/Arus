/**
 * Failure Prediction Module
 *
 * Equipment failure prediction using degradation analysis and
 * statistical modeling. Provides RUL estimates and maintenance recommendations.
 */

import { db } from "../db";
import { telemetryAggregates } from "@shared/schema-runtime";
import { eq, and, gte, asc } from "drizzle-orm";
import type { FailurePredictionResult, DegradationMetrics, TelemetryReading } from "./types";
import {
  calculateTrend,
  calculateVariability,
  isBadTrendSensor,
  isGoodTrendSensor,
} from "./statistical";

export async function getMultiSensorData(
  equipmentId: string,
  days: number
): Promise<TelemetryReading[]> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const data = await db
    .select()
    .from(telemetryAggregates)
    .where(
      and(
        eq(telemetryAggregates.equipmentId, equipmentId),
        eq(telemetryAggregates.timeWindow, "1h"),
        gte(telemetryAggregates.windowStart, startDate)
      )
    )
    .orderBy(asc(telemetryAggregates.windowStart));

  return data as TelemetryReading[];
}

export function calculateDegradationMetrics(data: TelemetryReading[]): DegradationMetrics {
  const sensorGroups = data.reduce(
    (groups, reading) => {
      if (!groups[reading.sensorType]) {
        groups[reading.sensorType] = [];
      }
      groups[reading.sensorType].push(reading);
      return groups;
    },
    {} as Record<string, TelemetryReading[]>
  );

  const metrics: DegradationMetrics = {
    overallTrend: "stable",
    riskFactors: [],
    degradationScore: 0,
    criticalSensors: [],
  };

  for (const [sensorType, readings] of Object.entries(sensorGroups)) {
    const values = readings.map((r) => r.avgValue).filter((v) => v !== null) as number[];
    if (values.length < 5) {
      continue;
    }

    const trend = calculateTrend(values);
    const variability = calculateVariability(values);
    const anomalyCount = readings.filter((r) => (r.anomalyScore || 0) > 0.7).length;

    let sensorRisk = 0;
    if (trend === "increasing" && isBadTrendSensor(sensorType)) {
      sensorRisk += 0.3;
    }
    if (trend === "decreasing" && isGoodTrendSensor(sensorType)) {
      sensorRisk += 0.3;
    }
    if (variability > 0.5) {
      sensorRisk += 0.2;
    }
    if (anomalyCount > readings.length * 0.2) {
      sensorRisk += 0.3;
    }

    if (sensorRisk > 0.6) {
      metrics.criticalSensors.push(sensorType);
      metrics.riskFactors.push(
        `${sensorType}: High degradation risk (${(sensorRisk * 100).toFixed(0)}%)`
      );
    }

    metrics.degradationScore = Math.max(metrics.degradationScore, sensorRisk);
  }

  return metrics;
}

export function statisticalFailurePrediction(
  degradationMetrics: DegradationMetrics
): FailurePredictionResult {
  const degradationScore = degradationMetrics.degradationScore;
  const criticalSensorCount = degradationMetrics.criticalSensors.length;

  let failureProbability = Math.min(0.95, degradationScore * 1.2);
  if (criticalSensorCount > 2) {
    failureProbability *= 1.3;
  }

  let remainingUsefulLife = 365;
  if (degradationScore > 0.8) {
    remainingUsefulLife = 30;
  } else if (degradationScore > 0.6) {
    remainingUsefulLife = 90;
  } else if (degradationScore > 0.4) {
    remainingUsefulLife = 180;
  }

  const predictedFailureDate =
    failureProbability > 0.3
      ? new Date(Date.now() + remainingUsefulLife * 24 * 60 * 60 * 1000)
      : null;

  const riskLevel =
    failureProbability > 0.8
      ? "critical"
      : failureProbability > 0.6
        ? "high"
        : failureProbability > 0.3
          ? "medium"
          : "low";

  return {
    failureProbability,
    predictedFailureDate,
    remainingUsefulLife,
    confidenceInterval: {
      lower: Math.max(0, failureProbability - 0.15),
      upper: Math.min(1, failureProbability + 0.15),
    },
    failureMode: inferFailureMode(degradationMetrics.criticalSensors),
    riskLevel,
    maintenanceRecommendations: generateMaintenanceRecommendations(degradationMetrics),
    costImpact: {
      estimatedCost: estimateMaintenanceCost(riskLevel),
      downtime: estimateDowntime(riskLevel),
    },
  };
}

export function getDefaultPrediction(reason: string): FailurePredictionResult {
  return {
    failureProbability: 0.1,
    predictedFailureDate: null,
    remainingUsefulLife: 365,
    confidenceInterval: { lower: 0, upper: 0.2 },
    failureMode: "unknown",
    riskLevel: "low",
    maintenanceRecommendations: ["Gather more operational data for accurate prediction"],
    costImpact: { estimatedCost: 0, downtime: 0 },
  };
}

export function inferFailureMode(criticalSensors: string[]): string {
  if (criticalSensors.includes("vibration")) {
    return "bearing_wear";
  }
  if (criticalSensors.includes("temperature")) {
    return "overheating";
  }
  if (criticalSensors.includes("pressure")) {
    return "seal_failure";
  }
  if (criticalSensors.includes("current")) {
    return "electrical_degradation";
  }
  return "general_deterioration";
}

export function generateMaintenanceRecommendations(
  degradationMetrics: DegradationMetrics
): string[] {
  const recommendations = ["Schedule routine inspection"];

  if (degradationMetrics.criticalSensors.includes("vibration")) {
    recommendations.push("Check bearing alignment and lubrication");
  }

  if (degradationMetrics.criticalSensors.includes("temperature")) {
    recommendations.push("Inspect cooling system and thermal management");
  }

  if (degradationMetrics.degradationScore > 0.7) {
    recommendations.push("Consider proactive component replacement");
  }

  return recommendations;
}

export function estimateMaintenanceCost(riskLevel: string): number {
  const costs: Record<string, number> = { low: 1000, medium: 5000, high: 15000, critical: 50000 };
  return costs[riskLevel] || 1000;
}

export function estimateDowntime(riskLevel: string): number {
  const downtime: Record<string, number> = { low: 2, medium: 8, high: 24, critical: 72 };
  return downtime[riskLevel] || 2;
}
