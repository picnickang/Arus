/**
 * Date Utilities Tests
 * Tests date calculations, overlap detection, and duration formatting
 */

import { describe, test, expect, getResults, resetResults, printSummary } from "./test-utils.mjs";

// Date utilities
function parseDate(dateStr) {
  return new Date(dateStr);
}

function formatDate(date, format = "iso") {
  const d = new Date(date);

  switch (format) {
    case "iso":
      return d.toISOString().split("T")[0];
    case "display":
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    case "short":
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    default:
      return d.toISOString();
  }
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subtractDays(date, days) {
  return addDays(date, -days);
}

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getDateRange(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function doRangesOverlap(range1, range2) {
  const start1 = new Date(range1.start);
  const end1 = new Date(range1.end);
  const start2 = new Date(range2.start);
  const end2 = new Date(range2.end);

  return start1 < end2 && end1 > start2;
}

function getOverlapDays(range1, range2) {
  if (!doRangesOverlap(range1, range2)) return 0;

  const start = Math.max(new Date(range1.start).getTime(), new Date(range2.start).getTime());
  const end = Math.min(new Date(range1.end).getTime(), new Date(range2.end).getTime());

  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function formatDuration(days) {
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  if (remainingDays === 0) {
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }

  return `${weeks} week${weeks === 1 ? "" : "s"}, ${remainingDays} day${remainingDays === 1 ? "" : "s"}`;
}

function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getStartOfWeek(date, weekStartsOn = 1) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date, weekStartsOn = 1) {
  const start = getStartOfWeek(date, weekStartsOn);
  return addDays(start, 6);
}

console.log("\n🧪 Running Date Utilities Tests\n");
resetResults();

describe("Date Parsing", () => {
  test("parses ISO date string", () => {
    const date = parseDate("2025-12-31");

    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11); // 0-indexed
    expect(date.getDate()).toBe(31);
  });

  test("parses ISO datetime string", () => {
    const date = parseDate("2025-12-31T14:30:00");

    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
  });
});

describe("Date Formatting", () => {
  test("formats to ISO date", () => {
    const formatted = formatDate(new Date("2025-12-31"), "iso");

    expect(formatted).toBe("2025-12-31");
  });

  test("formats to display format", () => {
    const formatted = formatDate(new Date("2025-12-31"), "display");

    expect(formatted).toContain("Dec");
    expect(formatted).toContain("31");
    expect(formatted).toContain("2025");
  });

  test("formats to short format", () => {
    const formatted = formatDate(new Date("2025-12-31"), "short");

    expect(formatted).toContain("Dec");
    expect(formatted).toContain("31");
    expect(formatted).not.toContain("2025");
  });
});

describe("Date Arithmetic", () => {
  test("adds days correctly", () => {
    const date = new Date("2025-01-15");
    const result = addDays(date, 10);

    expect(result.getDate()).toBe(25);
    expect(result.getMonth()).toBe(0);
  });

  test("handles month boundary", () => {
    const date = new Date("2025-01-28");
    const result = addDays(date, 7);

    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(4);
  });

  test("handles year boundary", () => {
    const date = new Date("2025-12-28");
    const result = addDays(date, 10);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
  });

  test("subtracts days correctly", () => {
    const date = new Date("2025-01-15");
    const result = subtractDays(date, 10);

    expect(result.getDate()).toBe(5);
  });

  test("calculates days between dates", () => {
    const days = daysBetween("2025-01-01", "2025-01-15");

    expect(days).toBe(14);
  });

  test("handles same date", () => {
    const days = daysBetween("2025-01-15", "2025-01-15");

    expect(days).toBe(0);
  });
});

describe("Date Range Generation", () => {
  test("generates range of dates", () => {
    const range = getDateRange("2025-01-01", "2025-01-05");

    expect(range).toHaveLength(5);
  });

  test("includes start and end dates", () => {
    const range = getDateRange("2025-01-01", "2025-01-03");

    expect(range[0].getDate()).toBe(1);
    expect(range[2].getDate()).toBe(3);
  });

  test("returns single date when start equals end", () => {
    const range = getDateRange("2025-01-15", "2025-01-15");

    expect(range).toHaveLength(1);
  });
});

describe("Range Overlap Detection", () => {
  test("detects overlapping ranges", () => {
    const range1 = { start: "2025-01-01", end: "2025-01-15" };
    const range2 = { start: "2025-01-10", end: "2025-01-20" };

    expect(doRangesOverlap(range1, range2)).toBe(true);
  });

  test("detects non-overlapping ranges", () => {
    const range1 = { start: "2025-01-01", end: "2025-01-10" };
    const range2 = { start: "2025-01-15", end: "2025-01-20" };

    expect(doRangesOverlap(range1, range2)).toBe(false);
  });

  test("detects contained range", () => {
    const range1 = { start: "2025-01-01", end: "2025-01-31" };
    const range2 = { start: "2025-01-10", end: "2025-01-20" };

    expect(doRangesOverlap(range1, range2)).toBe(true);
  });

  test("touching ranges do not overlap", () => {
    const range1 = { start: "2025-01-01", end: "2025-01-10" };
    const range2 = { start: "2025-01-10", end: "2025-01-20" };

    expect(doRangesOverlap(range1, range2)).toBe(false);
  });

  test("calculates overlap days", () => {
    const range1 = { start: "2025-01-01", end: "2025-01-15" };
    const range2 = { start: "2025-01-10", end: "2025-01-20" };

    const overlap = getOverlapDays(range1, range2);

    expect(overlap).toBe(5); // Jan 10-14
  });

  test("returns 0 for non-overlapping ranges", () => {
    const range1 = { start: "2025-01-01", end: "2025-01-10" };
    const range2 = { start: "2025-01-15", end: "2025-01-20" };

    const overlap = getOverlapDays(range1, range2);

    expect(overlap).toBe(0);
  });
});

describe("Duration Formatting", () => {
  test("formats single day", () => {
    expect(formatDuration(1)).toBe("1 day");
  });

  test("formats multiple days", () => {
    expect(formatDuration(5)).toBe("5 days");
  });

  test("formats exact weeks", () => {
    expect(formatDuration(7)).toBe("1 week");
    expect(formatDuration(14)).toBe("2 weeks");
  });

  test("formats weeks and days", () => {
    expect(formatDuration(10)).toBe("1 week, 3 days");
    expect(formatDuration(15)).toBe("2 weeks, 1 day");
  });
});

describe("Weekend Detection", () => {
  test("identifies Saturday as weekend", () => {
    // January 4, 2025 is Saturday
    expect(isWeekend(new Date("2025-01-04"))).toBe(true);
  });

  test("identifies Sunday as weekend", () => {
    // January 5, 2025 is Sunday
    expect(isWeekend(new Date("2025-01-05"))).toBe(true);
  });

  test("identifies weekday correctly", () => {
    // January 6, 2025 is Monday
    expect(isWeekend(new Date("2025-01-06"))).toBe(false);
  });
});

describe("Week Calculations", () => {
  test("calculates week number", () => {
    const week = getWeekNumber(new Date("2025-01-15"));

    expect(week).toBeGreaterThan(0);
    expect(week).toBeLessThanOrEqual(53);
  });

  test("first week of year", () => {
    const week = getWeekNumber(new Date("2025-01-06"));

    expect(week).toBe(2);
  });

  test("gets start of week (Monday)", () => {
    const date = new Date("2025-01-15"); // Wednesday
    const start = getStartOfWeek(date, 1); // Monday start

    expect(start.getDay()).toBe(1); // Monday
    expect(start.getDate()).toBe(13);
  });

  test("gets end of week", () => {
    const date = new Date("2025-01-15"); // Wednesday
    const end = getEndOfWeek(date, 1); // Monday start

    expect(end.getDay()).toBe(0); // Sunday
    expect(end.getDate()).toBe(19);
  });
});

const results = getResults();
printSummary();

export { results };
