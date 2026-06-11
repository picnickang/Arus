/**
 * STCW Compliance Tests
 * Tests maritime rest hour requirements and fatigue scoring
 */

import { describe, test, expect, getResults, resetResults, printSummary } from "./test-utils.mjs";

// STCW Constants
const STCW_MIN_REST_24H = 10; // Minimum 10 hours rest in any 24-hour period
const STCW_MIN_REST_PERIOD = 6; // One rest period must be at least 6 hours
const STCW_MAX_WORK_7D = 77; // Maximum 77 hours work in any 7-day period

// Rest hour calculation
function calculateRestHours(workPeriods, date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Filter work periods for this day
  const dayWork = workPeriods.filter((wp) => {
    const start = new Date(wp.startTime);
    const end = new Date(wp.endTime);
    return start < dayEnd && end > dayStart;
  });

  // Calculate total work hours in this 24h period
  let totalWorkMinutes = 0;
  for (const wp of dayWork) {
    const start = Math.max(new Date(wp.startTime).getTime(), dayStart.getTime());
    const end = Math.min(new Date(wp.endTime).getTime(), dayEnd.getTime());
    totalWorkMinutes += (end - start) / (1000 * 60);
  }

  const totalRestHours = 24 - totalWorkMinutes / 60;
  return Math.round(totalRestHours * 10) / 10;
}

function checkSTCW24HourCompliance(restHours) {
  return {
    compliant: restHours >= STCW_MIN_REST_24H,
    restHours,
    required: STCW_MIN_REST_24H,
    deficit: Math.max(0, STCW_MIN_REST_24H - restHours),
  };
}

function calculateWeeklyWorkHours(workPeriods, endDate) {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  let totalMinutes = 0;
  for (const wp of workPeriods) {
    const wpStart = new Date(wp.startTime);
    const wpEnd = new Date(wp.endTime);

    if (wpStart < end && wpEnd > start) {
      const clampedStart = Math.max(wpStart.getTime(), start.getTime());
      const clampedEnd = Math.min(wpEnd.getTime(), end.getTime());
      totalMinutes += (clampedEnd - clampedStart) / (1000 * 60);
    }
  }

  return Math.round((totalMinutes / 60) * 10) / 10;
}

function checkSTCW7DayCompliance(weeklyHours) {
  return {
    compliant: weeklyHours <= STCW_MAX_WORK_7D,
    workHours: weeklyHours,
    maximum: STCW_MAX_WORK_7D,
    excess: Math.max(0, weeklyHours - STCW_MAX_WORK_7D),
  };
}

function findRestPeriods(workPeriods, date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Get work periods sorted by start time
  const dayWork = workPeriods
    .filter((wp) => {
      const start = new Date(wp.startTime);
      const end = new Date(wp.endTime);
      return start < dayEnd && end > dayStart;
    })
    .map((wp) => ({
      start: Math.max(new Date(wp.startTime).getTime(), dayStart.getTime()),
      end: Math.min(new Date(wp.endTime).getTime(), dayEnd.getTime()),
    }))
    .sort((a, b) => a.start - b.start);

  // Find gaps (rest periods)
  const restPeriods = [];
  let current = dayStart.getTime();

  for (const work of dayWork) {
    if (work.start > current) {
      restPeriods.push({
        hours: (work.start - current) / (1000 * 60 * 60),
      });
    }
    current = Math.max(current, work.end);
  }

  // Rest at end of day
  if (current < dayEnd.getTime()) {
    restPeriods.push({
      hours: (dayEnd.getTime() - current) / (1000 * 60 * 60),
    });
  }

  return restPeriods;
}

function checkMinRestPeriod(restPeriods) {
  const longest = Math.max(...restPeriods.map((rp) => rp.hours), 0);
  return {
    compliant: longest >= STCW_MIN_REST_PERIOD,
    longestRest: Math.round(longest * 10) / 10,
    required: STCW_MIN_REST_PERIOD,
  };
}

// Fatigue Risk Score (0-100, higher = more fatigue)
function calculateFatigueRiskScore(restHours24h, weeklyWorkHours, longestRestPeriod) {
  let score = 0;

  // Rest deficit component (0-40 points)
  if (restHours24h < STCW_MIN_REST_24H) {
    const deficit = STCW_MIN_REST_24H - restHours24h;
    score += Math.min(40, deficit * 10);
  }

  // Weekly overwork component (0-30 points)
  if (weeklyWorkHours > 60) {
    const excess = weeklyWorkHours - 60;
    score += Math.min(30, excess * 1.5);
  }

  // Fragmented rest component (0-30 points)
  if (longestRestPeriod < 6) {
    const deficit = 6 - longestRestPeriod;
    score += Math.min(30, deficit * 10);
  }

  return Math.round(Math.min(100, score));
}

function getFatigueRiskLevel(score) {
  if (score <= 20) return "low";
  if (score <= 50) return "moderate";
  if (score <= 75) return "high";
  return "critical";
}

console.log("\n🧪 Running STCW Compliance Tests\n");
resetResults();

describe("24-Hour Rest Calculation", () => {
  test("calculates rest hours correctly for standard work day", () => {
    const workPeriods = [
      {
        startTime: "2025-01-15T08:00:00",
        endTime: "2025-01-15T18:00:00",
      },
    ];

    const restHours = calculateRestHours(workPeriods, "2025-01-15");

    expect(restHours).toBe(14); // 24 - 10 = 14 hours rest
  });

  test("calculates rest for split shifts", () => {
    const workPeriods = [
      { startTime: "2025-01-15T06:00:00", endTime: "2025-01-15T10:00:00" },
      { startTime: "2025-01-15T14:00:00", endTime: "2025-01-15T20:00:00" },
    ];

    const restHours = calculateRestHours(workPeriods, "2025-01-15");

    expect(restHours).toBe(14); // 24 - (4 + 6) = 14 hours rest
  });

  test("handles overnight work periods", () => {
    const workPeriods = [
      {
        startTime: "2025-01-14T22:00:00",
        endTime: "2025-01-15T06:00:00",
      },
    ];

    const restHours = calculateRestHours(workPeriods, "2025-01-15");

    expect(restHours).toBe(18); // Only counts 6 hours that fall on Jan 15
  });

  test("returns 24 hours for no work", () => {
    const workPeriods = [];
    const restHours = calculateRestHours(workPeriods, "2025-01-15");

    expect(restHours).toBe(24);
  });
});

describe("24-Hour STCW Compliance", () => {
  test("compliant when rest >= 10 hours", () => {
    const result = checkSTCW24HourCompliance(12);

    expect(result.compliant).toBe(true);
    expect(result.deficit).toBe(0);
  });

  test("exactly compliant at 10 hours", () => {
    const result = checkSTCW24HourCompliance(10);

    expect(result.compliant).toBe(true);
  });

  test("non-compliant when rest < 10 hours", () => {
    const result = checkSTCW24HourCompliance(8);

    expect(result.compliant).toBe(false);
    expect(result.deficit).toBe(2);
  });

  test("calculates correct deficit", () => {
    const result = checkSTCW24HourCompliance(6);

    expect(result.deficit).toBe(4);
  });
});

describe("7-Day Work Hours", () => {
  test("calculates weekly hours correctly", () => {
    const workPeriods = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date("2025-01-15");
      date.setDate(date.getDate() - i);
      workPeriods.push({
        startTime: `${date.toISOString().split("T")[0]}T08:00:00`,
        endTime: `${date.toISOString().split("T")[0]}T18:00:00`,
      });
    }

    const hours = calculateWeeklyWorkHours(workPeriods, "2025-01-15T23:59:59");

    expect(hours).toBe(70); // 7 days x 10 hours
  });

  test("handles partial week", () => {
    const workPeriods = [
      { startTime: "2025-01-14T08:00:00", endTime: "2025-01-14T18:00:00" },
      { startTime: "2025-01-15T08:00:00", endTime: "2025-01-15T18:00:00" },
    ];

    const hours = calculateWeeklyWorkHours(workPeriods, "2025-01-15T23:59:59");

    expect(hours).toBe(20); // 2 days x 10 hours
  });
});

describe("7-Day STCW Compliance", () => {
  test("compliant when work <= 77 hours", () => {
    const result = checkSTCW7DayCompliance(70);

    expect(result.compliant).toBe(true);
    expect(result.excess).toBe(0);
  });

  test("exactly compliant at 77 hours", () => {
    const result = checkSTCW7DayCompliance(77);

    expect(result.compliant).toBe(true);
  });

  test("non-compliant when work > 77 hours", () => {
    const result = checkSTCW7DayCompliance(85);

    expect(result.compliant).toBe(false);
    expect(result.excess).toBe(8);
  });
});

describe("Rest Period Analysis", () => {
  test("finds continuous rest periods", () => {
    const workPeriods = [
      { startTime: "2025-01-15T08:00:00", endTime: "2025-01-15T12:00:00" },
      { startTime: "2025-01-15T18:00:00", endTime: "2025-01-15T22:00:00" },
    ];

    const restPeriods = findRestPeriods(workPeriods, "2025-01-15");

    expect(restPeriods).toHaveLength(3); // Before, between, after work
  });

  test("identifies longest rest period", () => {
    const workPeriods = [
      { startTime: "2025-01-15T06:00:00", endTime: "2025-01-15T10:00:00" },
      { startTime: "2025-01-15T12:00:00", endTime: "2025-01-15T16:00:00" },
    ];

    const restPeriods = findRestPeriods(workPeriods, "2025-01-15");
    const result = checkMinRestPeriod(restPeriods);

    expect(result.longestRest).toBe(8); // 16:00 to 00:00 next day
    expect(result.compliant).toBe(true);
  });

  test("fails when no 6-hour rest period", () => {
    const workPeriods = [
      { startTime: "2025-01-15T00:00:00", endTime: "2025-01-15T05:00:00" },
      { startTime: "2025-01-15T08:00:00", endTime: "2025-01-15T13:00:00" },
      { startTime: "2025-01-15T16:00:00", endTime: "2025-01-15T21:00:00" },
      { startTime: "2025-01-15T23:00:00", endTime: "2025-01-15T23:59:59" },
    ];

    const restPeriods = findRestPeriods(workPeriods, "2025-01-15");
    const result = checkMinRestPeriod(restPeriods);

    expect(result.compliant).toBe(false);
  });
});

describe("Fatigue Risk Scoring", () => {
  test("low fatigue for well-rested crew", () => {
    const score = calculateFatigueRiskScore(14, 40, 8);

    expect(score).toBeLessThanOrEqual(20);
    expect(getFatigueRiskLevel(score)).toBe("low");
  });

  test("moderate fatigue for reduced rest", () => {
    const score = calculateFatigueRiskScore(9, 65, 5);

    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThanOrEqual(50);
    expect(getFatigueRiskLevel(score)).toBe("moderate");
  });

  test("high fatigue for STCW violation", () => {
    const score = calculateFatigueRiskScore(7, 75, 4);

    expect(score).toBeGreaterThan(50);
    expect(getFatigueRiskLevel(score)).toBe("high");
  });

  test("critical fatigue for multiple violations", () => {
    const score = calculateFatigueRiskScore(6, 80, 3);

    expect(score).toBeGreaterThan(75);
    expect(getFatigueRiskLevel(score)).toBe("critical");
  });

  test("score capped at 100", () => {
    const score = calculateFatigueRiskScore(0, 100, 0);

    expect(score).toBeLessThanOrEqual(100);
  });

  test("minimum score is 0", () => {
    const score = calculateFatigueRiskScore(24, 0, 24);

    expect(score).toBe(0);
  });
});

const results = getResults();
printSummary();

export { results };
