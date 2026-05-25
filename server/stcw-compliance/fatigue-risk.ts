/**
 * Fatigue Risk Assessment Module
 */

import type { RestDay, FatigueMetrics, FatigueRiskResult } from "./types";
import {
  STCW_MIN_REST_24,
  STCW_MIN_REST_7D,
  NIGHT_HOURS_START,
  NIGHT_HOURS_END,
  FULL_REST_THRESHOLD,
} from "./types";
import { countRestHours, countWorkHours, findLongestRestBlock } from "./rest-utils";

function isNightHour(hour: number): boolean {
  return hour >= NIGHT_HOURS_START || hour < NIGHT_HOURS_END;
}

function countNightWorkHours(day: RestDay): number {
  let nightWork = 0;
  for (let h = 0; h < 24; h++) {
    const isRest = Number.parseInt(String(day[`h${h}` as keyof RestDay] || 0)) === 1;
    if (!isRest && isNightHour(h)) {
      nightWork++;
    }
  }
  return nightWork;
}

function hasNightShift(day: RestDay): boolean {
  return countNightWorkHours(day) >= 4;
}

export function calculateFatigueMetrics(days: RestDay[]): FatigueMetrics {
  if (days.length === 0) {
    return {
      sleepDebt24h: 0,
      sleepDebt7d: 0,
      consecutiveNightShifts: 0,
      timeSinceLastFullRest: 0,
      nightWorkRatio: 0,
      avgRestPer24h: STCW_MIN_REST_24,
      avgRestPer7d: STCW_MIN_REST_7D,
    };
  }

  let sleepDebt24h = 0,
    consecutiveNightShifts = 0,
    currentNightStreak = 0;
  let totalNightWork = 0,
    totalWork = 0,
    totalRest = 0;
  let timeSinceLastFullRest = 0,
    foundFullRest = false;

  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (!day) continue;
    const restHours = countRestHours(day);
    const workHours = countWorkHours(day);
    const nightWorkHours = countNightWorkHours(day);
    const longestRest = findLongestRestBlock(day);

    totalRest += restHours;
    totalWork += workHours;
    totalNightWork += nightWorkHours;

    if (restHours < STCW_MIN_REST_24) {
      sleepDebt24h += STCW_MIN_REST_24 - restHours;
    }

    if (hasNightShift(day)) {
      currentNightStreak++;
      consecutiveNightShifts = Math.max(consecutiveNightShifts, currentNightStreak);
    } else {
      currentNightStreak = 0;
    }

    if (!foundFullRest) {
      if (longestRest >= FULL_REST_THRESHOLD) {
        foundFullRest = true;
      } else {
        timeSinceLastFullRest += 24;
      }
    }
  }

  const last7Days = days.slice(-7);
  let rest7d = 0;
  for (const day of last7Days) {
    rest7d += countRestHours(day);
  }
  const sleepDebt7d = rest7d < STCW_MIN_REST_7D ? STCW_MIN_REST_7D - rest7d : 0;

  return {
    sleepDebt24h,
    sleepDebt7d,
    consecutiveNightShifts,
    timeSinceLastFullRest,
    nightWorkRatio: totalWork > 0 ? totalNightWork / totalWork : 0,
    avgRestPer24h: days.length > 0 ? totalRest / days.length : STCW_MIN_REST_24,
    avgRestPer7d: rest7d,
  };
}

export function calculateFatigueRisk(
  crewId: string,
  days: RestDay[],
  crewName?: string
): FatigueRiskResult {
  const metrics = calculateFatigueMetrics(days);
  const factors: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  if (metrics.sleepDebt24h > 0) {
    score += metrics.sleepDebt24h * 10;
    factors.push(
      `Sleep debt: ${metrics.sleepDebt24h.toFixed(1)}h below minimum in recent 24h periods`
    );
    recommendations.push("Schedule additional rest periods to recover sleep debt");
  }

  if (metrics.sleepDebt7d > 0) {
    score += metrics.sleepDebt7d * 5;
    factors.push(`7-day deficit: ${metrics.sleepDebt7d.toFixed(1)}h below 77h minimum`);
    recommendations.push("Reduce scheduled work hours over the next week");
  }

  if (metrics.consecutiveNightShifts >= 5) {
    score += 30;
    factors.push(
      `Extended night watch: ${metrics.consecutiveNightShifts} consecutive night shifts`
    );
    recommendations.push("Rotate to day shift immediately to prevent circadian disruption");
  } else if (metrics.consecutiveNightShifts >= 3) {
    score += 20;
    factors.push(`Multiple night shifts: ${metrics.consecutiveNightShifts} consecutive nights`);
    recommendations.push("Plan for shift rotation within 2 days");
  }

  if (metrics.nightWorkRatio > 0.5) {
    score += 15;
    factors.push(
      `High night work: ${(metrics.nightWorkRatio * 100).toFixed(0)}% of work during night hours`
    );
    recommendations.push("Balance work schedule with more daytime assignments");
  }

  if (metrics.timeSinceLastFullRest > 48) {
    score += 25;
    factors.push(`No full rest: ${metrics.timeSinceLastFullRest}h since last 8+ hour rest block`);
    recommendations.push("Ensure at least one 8-hour uninterrupted rest period");
  }

  let riskLevel: "low" | "medium" | "high" | "critical";
  if (score >= 60) {
    riskLevel = "critical";
    if (recommendations.length === 0) {
      recommendations.push("Immediate action required");
    }
  } else if (score >= 40) {
    riskLevel = "high";
  } else if (score >= 20) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
    if (factors.length === 0) {
      factors.push("Rest patterns within acceptable limits");
    }
  }

  return { crewId, crewName, riskLevel, score, metrics, factors, recommendations };
}

export function calculateVesselFatigueSummary(crewFatigueResults: FatigueRiskResult[]) {
  const summary = {
    totalCrew: crewFatigueResults.length,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    averageScore: 0,
    highestRiskCrew: [] as FatigueRiskResult[],
  };

  if (crewFatigueResults.length === 0) {
    return summary;
  }

  let totalScore = 0;
  const riskCounters: Record<string, keyof typeof summary> = {
    critical: "criticalCount",
    high: "highCount",
    medium: "mediumCount",
    low: "lowCount",
  };
  for (const result of crewFatigueResults) {
    totalScore += result.score;
    const counterKey = riskCounters[result.riskLevel];
    if (counterKey) {
      const bag = summary as object as Record<string, number>;
      bag[counterKey] = (bag[counterKey] ?? 0) + 1;
    }
  }

  summary.averageScore = totalScore / crewFatigueResults.length;
  summary.highestRiskCrew = crewFatigueResults
    .filter((r) => r.riskLevel === "critical" || r.riskLevel === "high")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return summary;
}
