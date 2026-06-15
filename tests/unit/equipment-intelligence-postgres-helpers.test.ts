import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  computeRisk,
  computeTrend,
  mapWorkOrderSummaryRow,
  parseSignalEntry,
  recommendedActionText,
  statusFromRisk,
  timeAgo,
} from "../../server/domains/equipment-intelligence/infrastructure/postgres-repository-helpers";

afterEach(() => {
  jest.useRealTimers();
});

describe("equipment intelligence Postgres helpers", () => {
  it("derives risk, status, trend, and recommended action labels", () => {
    expect(computeRisk(25)).toBe("critical");
    expect(computeRisk(55)).toBe("warning");
    expect(computeRisk(85)).toBe("low");
    expect(statusFromRisk("warning")).toBe("warning");
    expect(computeTrend([90, 85, 70, 65])).toBe("declining");
    expect(computeTrend([55, 60, 70, 75])).toBe("improving");
    expect(recommendedActionText("critical", 4)).toBe("replace within 4 days");
  });

  it("normalizes supporting signals and work-order rows", () => {
    expect(parseSignalEntry({ description: "Vibration spike" })).toBe("Vibration spike");
    expect(parseSignalEntry({ detail: "missing description" })).toBe("[object Object]");

    expect(
      mapWorkOrderSummaryRow({
        id: "wo-1",
        description: null,
        status: "open",
        createdAt: new Date("2026-06-01T09:00:00Z"),
        completedAt: null,
        assignedCrewId: null,
        assignmentStatus: null,
        assignmentResponseReason: "Awaiting review",
        assignmentRespondedAt: new Date("2026-06-02T09:00:00Z"),
      })
    ).toEqual({
      id: "wo-1",
      title: "Work Order",
      status: "open",
      createdAt: "2026-06-01",
      completedAt: null,
      assignedCrewId: null,
      assignmentStatus: null,
      assignmentResponseReason: "Awaiting review",
      assignmentRespondedAt: "2026-06-02T09:00:00.000Z",
    });
  });

  it("formats model age labels relative to now", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-12T12:00:00Z"));

    expect(timeAgo(new Date("2026-06-12T08:00:00Z"))).toBe("today");
    expect(timeAgo(new Date("2026-06-11T12:00:00Z"))).toBe("1 day ago");
    expect(timeAgo(new Date("2026-06-09T12:00:00Z"))).toBe("3 days ago");
  });
});
