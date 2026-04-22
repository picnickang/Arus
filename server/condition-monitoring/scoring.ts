/**
 * Condition Monitoring - Scoring Functions
 * Quality and maintenance scoring utilities
 */

import type { OilAnalysis, WearParticleAnalysis, ConditionMonitoring } from "@shared/schema";
import { assessOilCondition } from "./oil-assessment.js";
import { assessWearCondition } from "./wear-assessment.js";

export function calculateOilQualityScore(oilAnalysis: OilAnalysis): number {
  return assessOilCondition(oilAnalysis).overallScore;
}

export function calculateWearScore(wearAnalysis: WearParticleAnalysis): number {
  return assessWearCondition(wearAnalysis).overallScore;
}

export function generateMaintenanceRecommendations(conditionData: ConditionMonitoring[]): Array<{
  equipmentId: string;
  priority: "low" | "medium" | "high" | "critical";
  action: string;
  reasoning: string;
  estimatedCost: number;
  timeframe: string;
}> {
  return conditionData.map((condition) => {
    let priority: "low" | "medium" | "high" | "critical" = "low";
    let estimatedCost = 1000;
    let timeframe = "30 days";

    if (condition.failureRisk === "critical") {
      priority = "critical";
      estimatedCost = 5000;
      timeframe = "immediate";
    } else if (condition.failureRisk === "high") {
      priority = "high";
      estimatedCost = 3000;
      timeframe = "1 week";
    } else if (condition.failureRisk === "medium") {
      priority = "medium";
      estimatedCost = 2000;
      timeframe = "2 weeks";
    }

    return {
      equipmentId: condition.equipmentId,
      priority,
      action: condition.maintenanceAction || "inspect",
      reasoning: condition.recommendations || "Routine maintenance",
      estimatedCost,
      timeframe,
    };
  });
}
