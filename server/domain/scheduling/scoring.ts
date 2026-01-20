import type { SchedulingPreferences, CrewSuggestion, ConstraintViolation } from "./types";

export interface ScoringContext {
  crewId: string;
  crewName: string;
  rank?: string;
  avatarUrl?: string;
  vesselId?: string;
  targetVesselId?: string;
  currentAssignmentCount: number;
  avgAssignmentCount: number;
  consecutiveDaysOnboard: number;
  lastShiftEnd?: Date;
  certExpiryDays?: number;
  fatigueRisk: "low" | "medium" | "high";
  constraints: ConstraintViolation[];
}

export function calculateCrewScore(
  context: ScoringContext,
  preferences: SchedulingPreferences
): number {
  let score = 100;

  const hasHardViolation = context.constraints.some((c) => c.severity === "error");
  if (hasHardViolation) {
    return 0;
  }

  const softViolationCount = context.constraints.filter((c) => c.severity === "warning").length;
  score -= softViolationCount * 15;

  const fairnessWeight = preferences.weights.fairness / 100;
  const assignmentDiff = context.currentAssignmentCount - context.avgAssignmentCount;
  if (assignmentDiff > 0) {
    score -= assignmentDiff * 5 * fairnessWeight;
  } else if (assignmentDiff < 0) {
    score += Math.abs(assignmentDiff) * 3 * fairnessWeight;
  }

  const continuityWeight = preferences.weights.continuity / 100;
  if (context.vesselId === context.targetVesselId) {
    score += 20 * continuityWeight;
  }

  const fatigueWeight = preferences.weights.fatiguePenalty / 100;
  const fatigueMultiplier = { low: 0, medium: 10, high: 25 };
  score -= fatigueMultiplier[context.fatigueRisk] * fatigueWeight;

  const certWeight = preferences.weights.certExpiryProximity / 100;
  if (context.certExpiryDays !== undefined) {
    if (context.certExpiryDays < 7) {
      score -= 20 * certWeight;
    } else if (context.certExpiryDays < 14) {
      score -= 10 * certWeight;
    } else if (context.certExpiryDays < 30) {
      score -= 5 * certWeight;
    }
  }

  return Math.max(0, Math.min(100, score));
}

export function determineAvailabilityTag(context: ScoringContext): {
  availability: CrewSuggestion["availability"];
  tag: string;
} {
  const hasHardViolation = context.constraints.some((c) => c.severity === "error");
  const hasSoftViolation = context.constraints.some((c) => c.severity === "warning");

  const leaveViolation = context.constraints.find((c) => c.constraint.type === "leave");
  if (leaveViolation) {
    return { availability: "on_leave", tag: "OIS" };
  }

  const certViolation = context.constraints.find(
    (c) => c.constraint.type === "certification" && c.severity === "error"
  );
  if (certViolation) {
    return { availability: "requires_cert", tag: "RO CRRT" };
  }

  if (hasHardViolation) {
    return { availability: "hard_conflict", tag: "CONFLICT" };
  }

  if (hasSoftViolation) {
    return { availability: "soft_conflict", tag: "SOFT" };
  }

  if (context.vesselId === context.targetVesselId) {
    return { availability: "available", tag: "CONMT" };
  }

  return { availability: "available", tag: "ALWAVE" };
}

export function generateSuggestionReasons(context: ScoringContext): string[] {
  const reasons: string[] = [];

  if (context.vesselId === context.targetVesselId) {
    reasons.push("Currently assigned to this vessel");
  }

  if (context.fatigueRisk === "low") {
    reasons.push("Low fatigue risk");
  } else if (context.fatigueRisk === "medium") {
    reasons.push("Moderate fatigue level");
  } else {
    reasons.push("High fatigue - consider alternatives");
  }

  if (context.currentAssignmentCount < context.avgAssignmentCount) {
    reasons.push("Below average workload - fair distribution");
  }

  if (context.certExpiryDays !== undefined && context.certExpiryDays < 30) {
    reasons.push(`Certification expires in ${context.certExpiryDays} days`);
  }

  for (const violation of context.constraints) {
    if (violation.severity === "warning") {
      reasons.push(violation.description);
    }
  }

  return reasons;
}

export function rankCrewSuggestions(
  contexts: ScoringContext[],
  preferences: SchedulingPreferences
): CrewSuggestion[] {
  const suggestions: CrewSuggestion[] = contexts.map((context) => {
    const score = calculateCrewScore(context, preferences);
    const { availability, tag } = determineAvailabilityTag(context);
    const reasons = generateSuggestionReasons(context);

    return {
      crewId: context.crewId,
      crewName: context.crewName,
      rank: context.rank,
      avatarUrl: context.avatarUrl,
      score,
      availability,
      availabilityTag: tag,
      reasons,
      constraints: context.constraints,
    };
  });

  return suggestions.sort((a, b) => b.score - a.score);
}

export function getTopSuggestions(suggestions: CrewSuggestion[], limit = 5): CrewSuggestion[] {
  return suggestions
    .filter((s) => s.availability !== "hard_conflict" && s.availability !== "on_leave")
    .slice(0, limit);
}
