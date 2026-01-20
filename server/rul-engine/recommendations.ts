/**
 * RUL Engine Recommendations
 * 
 * Generates maintenance recommendations based on RUL analysis.
 */

import type { ComponentHealthStatus, DegradationPattern } from "./types.js";

/**
 * Generate maintenance recommendations based on RUL analysis
 */
export function generateRecommendations(
  remainingDays: number,
  riskLevel: string,
  componentStatus: ComponentHealthStatus[],
  degradationPattern: DegradationPattern | null
): string[] {
  const recommendations: string[] = [];

  // Risk-based recommendations
  if (riskLevel === "critical") {
    recommendations.push("URGENT: Schedule immediate inspection and maintenance", "Consider taking equipment offline to prevent catastrophic failure");
  } else if (riskLevel === "high") {
    recommendations.push("Schedule maintenance within the next week", "Increase monitoring frequency to daily");
  } else if (riskLevel === "medium") {
    recommendations.push("Plan maintenance within the next 2-3 weeks", "Monitor degradation trends closely");
  }

  // Component-specific recommendations
  componentStatus.forEach((component) => {
    if (component.healthScore < 50) {
      recommendations.push(
        `Replace or service ${component.componentType} - health at ${Math.round(component.healthScore)}%`
      );
    }

    component.criticalMetrics.forEach((metric) => {
      if (metric === "vibration") {
        recommendations.push(
          `Investigate ${component.componentType} vibration levels - possible misalignment or bearing wear`
        );
      } else if (metric === "temperature") {
        recommendations.push(
          `Check ${component.componentType} cooling system - temperature elevated`
        );
      } else if (metric === "oil_condition") {
        recommendations.push(
          `Schedule oil change for ${component.componentType} - contamination detected`
        );
      } else if (metric === "wear_particles") {
        recommendations.push(
          `Inspect ${component.componentType} for excessive wear - particle count high`
        );
      }
    });
  });

  // Degradation pattern recommendations
  if (degradationPattern) {
    if (degradationPattern.acceleration > 1) {
      recommendations.push(
        "Degradation is accelerating - prioritize investigation of root cause"
      );
    }

    if (degradationPattern.volatility > 5) {
      recommendations.push(
        "Unstable operating conditions detected - review recent operational changes"
      );
    }
  }

  return recommendations.slice(0, 6); // Limit to top 6 recommendations
}
