/**
 * Fleet Analysis Functions for Enhanced Trends Analysis
 */

import { mean } from "simple-statistics";
import type { EquipmentRanking, FleetRecommendation } from "./types";

export interface EquipmentAnalysisResult {
  equipmentId: string;
  sensor: string;
  analysis: {
    anomalyDetection: {
      summary: {
        anomalyRate: number;
      };
    };
    statisticalSummary: {
      standardDeviation: number;
      trend: {
        rSquared: number;
        trendType: string;
      };
    };
  };
}

export interface AggregatedFleetMetrics {
  healthScore: number;
  anomalyRate: number;
  volatilityIndex: number;
  maintenanceRisk: "low" | "medium" | "high" | "critical";
}

export function aggregateFleetMetrics(analyses: EquipmentAnalysisResult[]): AggregatedFleetMetrics {
  if (analyses.length === 0) {
    return { healthScore: 0, anomalyRate: 0, volatilityIndex: 0, maintenanceRisk: "critical" };
  }

  const avgAnomalyRates = analyses.map((a) => a.analysis.anomalyDetection.summary.anomalyRate);
  const avgVolatility = analyses.map((a) => a.analysis.statisticalSummary.standardDeviation);
  const avgTrendRSquared = analyses.map((a) => a.analysis.statisticalSummary.trend.rSquared);

  const avgAnomalyRate = mean(avgAnomalyRates);
  const avgVolatilityIndex = mean(avgVolatility);
  const avgTrendStability = mean(avgTrendRSquared);

  const healthScore = Math.max(
    0,
    Math.min(100, 100 - avgAnomalyRate * 200 - avgVolatilityIndex * 10 + avgTrendStability * 20)
  );

  let maintenanceRisk: "low" | "medium" | "high" | "critical";
  if (avgAnomalyRate > 0.3 || healthScore < 30) {
    maintenanceRisk = "critical";
  } else if (avgAnomalyRate > 0.15 || healthScore < 50) {
    maintenanceRisk = "high";
  } else if (avgAnomalyRate > 0.05 || healthScore < 70) {
    maintenanceRisk = "medium";
  } else {
    maintenanceRisk = "low";
  }

  return {
    healthScore,
    anomalyRate: avgAnomalyRate,
    volatilityIndex: avgVolatilityIndex,
    maintenanceRisk,
  };
}

export function rankEquipmentByRisk(analyses: EquipmentAnalysisResult[]): EquipmentRanking[] {
  const rankings = analyses.map((analysis) => {
    const { equipmentId } = analysis;
    const { anomalyDetection, statisticalSummary } = analysis.analysis;

    const anomalyRisk = anomalyDetection.summary.anomalyRate * 100;
    const volatilityRisk = statisticalSummary.standardDeviation * 10;
    const trendRisk = statisticalSummary.trend.trendType === "volatile" ? 25 : 0;

    const riskScore = anomalyRisk + volatilityRisk + trendRisk;

    const riskFactors: string[] = [];
    if (anomalyDetection.summary.anomalyRate > 0.15) {
      riskFactors.push("High anomaly rate");
    }
    if (statisticalSummary.standardDeviation > 5) {
      riskFactors.push("High volatility");
    }
    if (statisticalSummary.trend.trendType === "volatile") {
      riskFactors.push("Unstable trends");
    }

    let priority: "low" | "medium" | "high" | "critical";
    if (riskScore > 75) {
      priority = "critical";
    } else if (riskScore > 50) {
      priority = "high";
    } else if (riskScore > 25) {
      priority = "medium";
    } else {
      priority = "low";
    }

    return {
      equipmentId,
      rank: 0,
      score: riskScore,
      riskFactors,
      priority,
    };
  });

  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;
  });

  return rankings;
}

export function generateFleetRecommendations(
  analyses: EquipmentAnalysisResult[],
  metrics: AggregatedFleetMetrics
): FleetRecommendation[] {
  const recommendations: FleetRecommendation[] = [];

  const highRiskEquipment = analyses
    .filter((a) => a.analysis.anomalyDetection.summary.anomalyRate > 0.2)
    .map((a) => a.equipmentId);

  if (highRiskEquipment.length > 0) {
    recommendations.push({
      type: "maintenance",
      equipmentIds: highRiskEquipment,
      priority: 1,
      description: `Immediate maintenance required for ${highRiskEquipment.length} equipment units with high anomaly rates.`,
      expectedBenefit: "Prevent potential equipment failures and reduce unplanned downtime.",
      timeFrame: "24-48 hours",
    });
  }

  const volatileEquipment = analyses
    .filter((a) => a.analysis.statisticalSummary.trend.trendType === "volatile")
    .map((a) => a.equipmentId);

  if (volatileEquipment.length > 0) {
    recommendations.push({
      type: "monitoring",
      equipmentIds: volatileEquipment,
      priority: 2,
      description: `Increase monitoring frequency for ${volatileEquipment.length} equipment units with volatile behavior.`,
      expectedBenefit: "Improve early detection of potential issues.",
      timeFrame: "1-2 weeks",
    });
  }

  if (metrics.maintenanceRisk === "high" || metrics.maintenanceRisk === "critical") {
    recommendations.push({
      type: "optimization",
      equipmentIds: analyses.map((a) => a.equipmentId),
      priority: 3,
      description:
        "Fleet-wide maintenance strategy review recommended due to elevated risk levels.",
      expectedBenefit: "Optimize maintenance schedules and reduce overall fleet risk.",
      timeFrame: "2-4 weeks",
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}
