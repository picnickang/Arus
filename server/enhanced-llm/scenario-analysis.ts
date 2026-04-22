/**
 * Enhanced LLM - Scenario Analysis
 *
 * Scenario generation and ROI calculation.
 */

import type { ReportContext } from "../report-context";
import type { EnhancedAnalysisOutput, ModelConfig } from "./types.js";

/**
 * Generate predictive scenarios
 */
export async function generateScenarios(
  context: ReportContext,
  modelConfig: ModelConfig
): Promise<EnhancedAnalysisOutput["scenarios"]> {
  const scenarios: EnhancedAnalysisOutput["scenarios"] = [];

  const criticalItems = (context.data.workOrders?.filter((wo) => wo.priority === "critical") ?? [])
    .length;
  const urgentItems = (context.data.workOrders?.filter((wo) => wo.priority === "urgent") ?? [])
    .length;

  if (criticalItems > 0) {
    scenarios.push({
      scenario: "Immediate Intervention",
      probability: 0.85,
      impact: "critical",
      recommendations: [
        "Deploy emergency maintenance team within 24 hours",
        "Prepare spare equipment and parts",
        "Notify stakeholders of potential downtime",
      ],
    });
  }

  if (urgentItems > 2) {
    scenarios.push({
      scenario: "Preventive Maintenance Acceleration",
      probability: 0.7,
      impact: "high",
      recommendations: [
        "Schedule maintenance during next port call",
        "Increase monitoring frequency",
        "Review maintenance schedules",
      ],
    });
  }

  scenarios.push({
    scenario: "Continued Monitoring",
    probability: 0.6,
    impact: "medium",
    recommendations: [
      "Maintain current monitoring protocols",
      "Schedule routine maintenance as planned",
      "Review performance trends monthly",
    ],
  });

  return scenarios;
}

/**
 * Calculate ROI analysis
 */
export async function calculateROI(
  context: ReportContext,
  scenarios?: EnhancedAnalysisOutput["scenarios"]
): Promise<EnhancedAnalysisOutput["roi"]> {
  const workOrders = context.data.workOrders ?? [];
  const avgCost =
    workOrders.reduce((sum, wo) => sum + (wo.estimatedCost ?? 0), 0) /
    Math.max(workOrders.length, 1);

  const criticalCount = workOrders.filter((wo) => wo.priority === "critical").length;
  const preventiveCost = avgCost * 0.3;
  const failureCost = avgCost * 3;

  const estimatedSavings = criticalCount * (failureCost - preventiveCost);
  const investmentRequired = preventiveCost * workOrders.length;
  const paybackPeriod = investmentRequired > 0 ? investmentRequired / (estimatedSavings / 12) : 0;
  const riskReduction = Math.min(90, criticalCount * 15);

  return {
    estimatedSavings: Math.round(estimatedSavings),
    investmentRequired: Math.round(investmentRequired),
    paybackPeriod: Math.round(paybackPeriod * 10) / 10,
    riskReduction,
  };
}

/**
 * Calculate confidence score for analysis
 */
export function calculateConfidence(context: ReportContext, analysis: string): number {
  let confidence = 0.5;

  if (context.data.telemetry && context.data.telemetry.length > 100) {
    confidence += 0.15;
  }
  if (context.data.workOrders && context.data.workOrders.length > 10) {
    confidence += 0.15;
  }
  if (context.intelligence?.vesselLearnings) {
    confidence += 0.1;
  }
  if (context.intelligence?.historicalContext) {
    confidence += 0.1;
  }

  return Math.min(0.95, Math.round(confidence * 100) / 100);
}

/**
 * Generate fallback analysis when LLM unavailable
 */
export function generateFallbackAnalysis(context: ReportContext): string {
  const parts: string[] = ["# System Analysis (Fallback Mode)\n"];

  if (context.data.workOrders) {
    const critical = context.data.workOrders.filter((wo) => wo.priority === "critical").length;
    const urgent = context.data.workOrders.filter((wo) => wo.priority === "urgent").length;

    parts.push(
      `## Work Orders Summary`,
      `- Critical: ${critical}`,
      `- Urgent: ${urgent}`,
      `- Total: ${context.data.workOrders.length}\n`
    );
  }

  parts.push("Note: Advanced AI analysis unavailable. This is a basic statistical summary.");

  return parts.join("\n");
}
