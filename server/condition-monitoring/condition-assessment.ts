/**
 * Condition Monitoring - Condition Assessment
 * Integrated multi-factor condition assessment
 */

import type { OilAnalysis, WearParticleAnalysis, InsertConditionMonitoring } from "@shared/schema";
import type { OilConditionAssessment, WearAssessment } from "./types.js";
import { assessOilCondition } from "./oil-assessment.js";
import { assessWearCondition } from "./wear-assessment.js";

function calculateOverallScore(
  oilScore: number,
  wearScore: number | undefined,
  vibrationScore: number | undefined,
  dtcScore: number | undefined
): number {
  const hasWear = wearScore !== undefined;
  const hasDtc = dtcScore !== undefined;
  const hasVibration = vibrationScore !== undefined;

  let score: number;
  if (hasWear && hasDtc && hasVibration) {
    score = Math.round(
      oilScore * 0.4 + wearScore! * 0.3 + vibrationScore! * 0.15 + dtcScore * 0.15
    );
  } else if (hasWear && hasDtc) {
    score = Math.round(oilScore * 0.5 + wearScore! * 0.35 + dtcScore * 0.15);
  } else if (hasWear) {
    score = Math.round(oilScore * 0.6 + wearScore! * 0.4);
  } else if (hasDtc) {
    score = Math.round(oilScore * 0.7 + dtcScore * 0.3);
  } else {
    score = oilScore;
  }

  if (hasVibration && !hasDtc) {
    score = Math.round(score * 0.8 + vibrationScore * 0.2);
  }
  return score;
}

function determineFailureRisk(
  overallScore: number,
  dtcScore: number | undefined
): "low" | "medium" | "high" | "critical" {
  if (dtcScore !== undefined && dtcScore < 30) {
    return "critical";
  }
  if (overallScore >= 85) {
    return "low";
  }
  if (overallScore >= 70) {
    return "medium";
  }
  if (overallScore >= 50) {
    return "high";
  }
  return "critical";
}

function determineMaintenanceAction(
  oilAssessment: OilConditionAssessment,
  wearAssessment: WearAssessment | null,
  dtcScore: number | undefined,
  failureRisk: string
): { action: string; urgency: "routine" | "urgent" | "immediate" } {
  let action = "monitor";
  let urgency: "routine" | "urgent" | "immediate" = "routine";

  if (oilAssessment.changeRecommended || wearAssessment?.inspectionRequired) {
    action = "service";
    urgency = "urgent";
  }
  if (dtcScore !== undefined && dtcScore < 30) {
    action = "repair";
    urgency = "immediate";
  } else if (dtcScore !== undefined && dtcScore < 50) {
    action = "service";
    urgency = "urgent";
  }
  if (failureRisk === "critical") {
    action = "repair";
    urgency = "immediate";
  }
  return { action, urgency };
}

function calculateEstimatedTtf(
  oilLife: number,
  componentLife: number,
  dtcScore: number | undefined
): number {
  let ttf = Math.min(oilLife, componentLife);
  if (dtcScore !== undefined && dtcScore < 30) {
    ttf = Math.min(ttf, 7);
  } else if (dtcScore !== undefined && dtcScore < 50) {
    ttf = Math.min(ttf, 30);
  }
  return ttf;
}

function determineAssessmentMethod(hasWear: boolean, hasDtc: boolean): string {
  if (hasWear && hasDtc) {
    return "combined_with_dtc";
  }
  if (hasWear) {
    return "combined";
  }
  if (hasDtc) {
    return "oil_with_dtc";
  }
  return "oil";
}

function buildAnalysisSummary(
  oilCondition: string,
  wearSeverity: string | undefined,
  dtcScore: number | undefined
): string {
  let summary = `Oil condition: ${oilCondition}`;
  if (wearSeverity) {
    summary += `, Wear severity: ${wearSeverity}`;
  }
  if (dtcScore !== undefined) {
    summary += `, DTC health: ${dtcScore}/100`;
  }
  return summary;
}

export function generateConditionAssessment(
  oilAnalysis: OilAnalysis,
  wearAnalysis?: WearParticleAnalysis,
  vibrationScore?: number,
  dtcScore?: number
): InsertConditionMonitoring {
  const oilAssessment = assessOilCondition(oilAnalysis);
  const wearAssessment = wearAnalysis ? assessWearCondition(wearAnalysis) : null;

  const overallScore = calculateOverallScore(
    oilAssessment.overallScore,
    wearAssessment?.overallScore,
    vibrationScore,
    dtcScore
  );
  const failureRisk = determineFailureRisk(overallScore, dtcScore);
  const { action: maintenanceAction, urgency: maintenanceUrgency } = determineMaintenanceAction(
    oilAssessment,
    wearAssessment,
    dtcScore,
    failureRisk
  );
  const estimatedTtf = calculateEstimatedTtf(
    oilAssessment.estimatedRemainingLife,
    wearAssessment?.estimatedComponentLife || 5 * 365,
    dtcScore
  );
  const assessmentMethod = determineAssessmentMethod(!!wearAssessment, dtcScore !== undefined);

  const allRecommendations = [
    ...oilAssessment.recommendations,
    ...(wearAssessment?.recommendations ?? []),
  ];
  if (dtcScore !== undefined && dtcScore < 50) {
    allRecommendations.push("Active diagnostic trouble codes detected - investigate immediately");
  }

  return {
    orgId: oilAnalysis.orgId,
    equipmentId: oilAnalysis.equipmentId,
    assessmentDate: new Date(),
    oilConditionScore: oilAssessment.overallScore,
    wearConditionScore: wearAssessment?.overallScore,
    vibrationScore,
    thermalScore: dtcScore,
    overallConditionScore: overallScore,
    trend: "stable",
    trendConfidence: dtcScore === undefined ? 0.8 : 0.9,
    failureRisk,
    estimatedTtf,
    confidenceInterval: 0.2,
    maintenanceAction,
    maintenanceUrgency,
    maintenanceWindow: estimatedTtf * 0.8,
    costEstimate: undefined,
    lastOilAnalysisId: oilAnalysis.id,
    lastWearAnalysisId: wearAnalysis?.id,
    ...({ lastVibrationAnalysisId: undefined } as object),
    assessmentMethod,
    analysisSummary: buildAnalysisSummary(
      oilAssessment.condition,
      wearAssessment?.wearSeverity,
      dtcScore
    ),
    recommendations: allRecommendations.join("; "),
    analystId: "system",
    analysisMetadata: {
      oilAssessment,
      wearAssessment,
      dtcScore,
      assessmentTimestamp: new Date().toISOString(),
    },
  };
}
