import { describe, expect, it } from "@jest/globals";
import { safeIsoDate } from "@/components/work-orders/work-order-task-dates";

describe("WorkOrderTasksTab date helpers", () => {
  it("returns undefined for missing or invalid task completion dates", () => {
    expect(safeIsoDate(null)).toBeUndefined();
    expect(safeIsoDate(undefined)).toBeUndefined();
    expect(safeIsoDate("not-a-date")).toBeUndefined();
  });

  it("normalizes valid string and Date task completion dates", () => {
    expect(safeIsoDate("2026-06-09T12:34:56.000Z")).toBe("2026-06-09T12:34:56.000Z");
    expect(safeIsoDate(new Date("2026-06-09T12:34:56.000Z"))).toBe(
      "2026-06-09T12:34:56.000Z"
    );
  });
});
