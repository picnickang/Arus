/**
 * Condition Monitoring - Oil Assessment
 * Oil condition analysis based on tribology
 */

import type { OilAnalysis } from "@shared/schema";
import type { OilConditionAssessment } from "./types.js";

type ScoreKey =
  | "viscosity"
  | "contamination"
  | "wearMetals"
  | "additive"
  | "oxidation";
type AssessmentState = {
  scores: Record<ScoreKey, number>;
  concerns: string[];
  recs: string[];
  changeNeeded: boolean;
};

function assessViscosity(oil: OilAnalysis, state: AssessmentState): void {
  if (!oil.viscosity40C || !oil.viscosityIndex) {
    return;
  }
  if (Math.abs(oil.viscosityIndex - 100) <= 15) {
    return;
  }
  state.scores['viscosity'] = Math.max(0, 100 - Math.abs(oil.viscosityIndex - 100) * 2);
  if (state.scores['viscosity'] < 70) {
    state.concerns.push("Viscosity degradation");
    state.recs.push("Monitor viscosity trend, consider oil change");
  }
}

function assessWaterContent(oil: OilAnalysis, state: AssessmentState): void {
  if (!oil.waterContent || oil.waterContent <= 0.05) {
    return;
  }
  state.scores['contamination'] -= Math.min(50, oil.waterContent * 1000);
  state.concerns.push("Water contamination");
  state.recs.push("Investigate water ingress sources");
  if (oil.waterContent > 0.1) {
    state.changeNeeded = true;
  }
}

function assessFuelDilution(oil: OilAnalysis, state: AssessmentState): void {
  if (!oil.fuelDilution || oil.fuelDilution <= 2) {
    return;
  }
  state.scores['contamination'] -= Math.min(30, oil.fuelDilution * 5);
  state.concerns.push("Fuel contamination");
  state.recs.push("Check fuel system for leaks");
  if (oil.fuelDilution > 5) {
    state.changeNeeded = true;
  }
}

function assessWearMetals(oil: OilAnalysis, state: AssessmentState): void {
  const limits = { iron: 100, chromium: 20, aluminum: 30, copper: 30, lead: 30, tin: 20 };
  let totalExcess = 0;
  for (const [metal, limit] of Object.entries(limits)) {
    const value = oil[metal as keyof typeof limits] as number;
    if (!value || value <= limit) {
      continue;
    }
    const excess = (value - limit) / limit;
    totalExcess += excess;
    if (excess > 0.5) {
      state.concerns.push(`Elevated ${metal} levels`);
      state.recs.push(`Investigate ${metal} source component wear`);
    }
  }
  state.scores['wearMetals'] = Math.max(0, 100 - totalExcess * 20);
  if (totalExcess > 2) {
    state.changeNeeded = true;
  }
}

function assessAdditives(oil: OilAnalysis, state: AssessmentState): void {
  if (!oil.calcium || !oil.zinc) {
    return;
  }
  const calciumDepletion = Math.max(0, (1000 - (oil.calcium ?? 0)) / 1000);
  const zincDepletion = Math.max(0, (800 - (oil.zinc ?? 0)) / 800);
  const penalty = (calciumDepletion + zincDepletion) * 50;
  state.scores['additive'] -= penalty;
  if (penalty > 20) {
    state.concerns.push("Additive depletion");
    state.recs.push("Monitor additive levels, plan oil change");
  }
}

function assessOxidation(oil: OilAnalysis, state: AssessmentState): void {
  if (oil.oxidation && oil.oxidation > 20) {
    state.scores['oxidation'] -= Math.min(40, (oil.oxidation - 20) / 2);
    state.concerns.push("Oil oxidation");
    state.recs.push("Monitor oxidation trend, improve oil cooling");
    if (oil.oxidation > 50) {
      state.changeNeeded = true;
    }
  }
  if (oil.acidNumber && oil.acidNumber > 2.5) {
    state.scores['oxidation'] -= Math.min(30, (oil.acidNumber - 2.5) * 10);
    state.concerns.push("Elevated acid number");
    state.recs.push("Consider oil change due to acid buildup");
    if (oil.acidNumber > 4) {
      state.changeNeeded = true;
    }
  }
}

function determineCondition(score: number): "normal" | "marginal" | "critical" {
  if (score >= 80) {
    return "normal";
  }
  if (score >= 60) {
    return "marginal";
  }
  return "critical";
}

function calculateRemainingLife(
  condition: "normal" | "marginal" | "critical",
  serviceHours?: number | null
): number {
  if (condition === "critical") {
    return 30;
  }
  if (condition === "marginal") {
    return 90;
  }
  if (serviceHours && serviceHours > 500) {
    return Math.min(365, Math.max(0, 1000 - serviceHours) * 0.5);
  }
  return 365;
}

export function assessOilCondition(oilAnalysis: OilAnalysis): OilConditionAssessment {
  const state: AssessmentState = {
    scores: { viscosity: 100, contamination: 100, wearMetals: 100, additive: 100, oxidation: 100 },
    concerns: [],
    recs: [],
    changeNeeded: false,
  };

  assessViscosity(oilAnalysis, state);
  assessWaterContent(oilAnalysis, state);
  assessFuelDilution(oilAnalysis, state);
  assessWearMetals(oilAnalysis, state);
  assessAdditives(oilAnalysis, state);
  assessOxidation(oilAnalysis, state);

  const overallScore = Math.round(
    state.scores['viscosity'] * 0.25 +
      state.scores['contamination'] * 0.25 +
      state.scores['wearMetals'] * 0.25 +
      state.scores['additive'] * 0.15 +
      state.scores['oxidation'] * 0.1
  );
  const condition = determineCondition(overallScore);
  const estimatedRemainingLife = calculateRemainingLife(condition, oilAnalysis.serviceHours);

  return {
    overallScore,
    viscosityScore: Math.round(state.scores['viscosity']),
    contaminationScore: Math.round(state.scores['contamination']),
    wearMetalsScore: Math.round(state.scores['wearMetals']),
    additiveScore: Math.round(state.scores['additive']),
    oxidationScore: Math.round(state.scores['oxidation']),
    condition,
    primaryConcerns: state.concerns,
    recommendations: state.recs,
    changeRecommended: state.changeNeeded,
    estimatedRemainingLife: Math.round(estimatedRemainingLife),
  };
}
