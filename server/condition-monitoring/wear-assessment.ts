/**
 * Condition Monitoring - Wear Assessment
 * Ferrography-based wear particle analysis
 */

import type { WearParticleAnalysis } from "@shared/schema";
import type { WearAssessment } from "./types.js";

interface WearState {
  recommendations: string[];
  affectedComponents: string[];
  inspectionRequired: boolean;
  wearModeScore: number;
  dominantWearMode: "adhesive" | "abrasive" | "fatigue" | "corrosive" | "normal";
}

function assessPqIndex(pqIndex: number, state: WearState): number {
  if (pqIndex <= 50) {
    return 100;
  }

  const severityScore = Math.max(0, 100 - (pqIndex - 50) * 2);
  if (pqIndex > 100) {
    state.recommendations.push(
      "High wear particle concentration - immediate investigation required"
    );
    state.inspectionRequired = true;
  }
  return severityScore;
}

function assessWearModes(wearAnalysis: WearParticleAnalysis, state: WearState): void {
  if (wearAnalysis.cuttingParticles && wearAnalysis.cuttingParticles > 30) {
    state.dominantWearMode = "abrasive";
    state.wearModeScore -= (wearAnalysis.cuttingParticles - 30) * 2;
    state.recommendations.push("High cutting particles indicate abrasive wear - check filtration");
  }

  if (wearAnalysis.fatigueParticles && wearAnalysis.fatigueParticles > 20) {
    state.dominantWearMode = "fatigue";
    state.wearModeScore -= (wearAnalysis.fatigueParticles - 20) * 3;
    state.recommendations.push("Fatigue particles detected - examine bearing and gear surfaces");
    state.inspectionRequired = true;
  }

  if (wearAnalysis.slidingParticles && wearAnalysis.slidingParticles > 25) {
    state.dominantWearMode = "adhesive";
    state.wearModeScore -= (wearAnalysis.slidingParticles - 25) * 2;
    state.recommendations.push("High sliding particles - check lubrication adequacy");
  }
}

function assessComponentWear(wearAnalysis: WearParticleAnalysis, state: WearState): void {
  if (wearAnalysis.bearingWear && wearAnalysis.bearingWear > 15) {
    state.affectedComponents.push("Bearings");
    state.recommendations.push("Elevated bearing wear indicators");
    state.inspectionRequired = true;
  }

  if (wearAnalysis.gearWear && wearAnalysis.gearWear > 20) {
    state.affectedComponents.push("Gears");
    state.recommendations.push("Gear wear particles detected - inspect gear teeth");
    state.inspectionRequired = true;
  }

  if (wearAnalysis.pumpWear && wearAnalysis.pumpWear > 10) {
    state.affectedComponents.push("Pump components");
    state.recommendations.push("Pump wear detected - check impeller and casing");
  }

  if (wearAnalysis.cylinderWear && wearAnalysis.cylinderWear > 25) {
    state.affectedComponents.push("Engine cylinders");
    state.recommendations.push("Cylinder wear particles - monitor engine condition");
  }
}

function calculateWearSeverity(overallScore: number): "normal" | "moderate" | "high" | "severe" {
  if (overallScore >= 85) {
    return "normal";
  }
  if (overallScore >= 70) {
    return "moderate";
  }
  if (overallScore >= 50) {
    return "high";
  }
  return "severe";
}

function calculateEstimatedLife(wearSeverity: "normal" | "moderate" | "high" | "severe"): number {
  const lifeMap: Record<string, number> = {
    severe: 180,
    high: 365,
    moderate: 2 * 365,
    normal: 5 * 365,
  };
  return lifeMap[wearSeverity];
}

export function assessWearCondition(wearAnalysis: WearParticleAnalysis): WearAssessment {
  const state: WearState = {
    recommendations: [],
    affectedComponents: [],
    inspectionRequired: false,
    wearModeScore: 100,
    dominantWearMode: "normal",
  };

  const pqIndex = wearAnalysis.pqIndex ?? 0;
  const severityScore = assessPqIndex(pqIndex, state);

  assessWearModes(wearAnalysis, state);
  assessComponentWear(wearAnalysis, state);

  const overallScore = Math.round((severityScore + state.wearModeScore) / 2);
  const wearSeverity = calculateWearSeverity(overallScore);
  const estimatedComponentLife = calculateEstimatedLife(wearSeverity);

  return {
    overallScore,
    wearSeverity,
    dominantWearMode: state.dominantWearMode,
    affectedComponents: state.affectedComponents,
    wearTrend: "stable",
    recommendations: state.recommendations,
    inspectionRequired: state.inspectionRequired,
    estimatedComponentLife,
  };
}
