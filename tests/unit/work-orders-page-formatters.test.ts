import { describe, expect, it, jest } from "@jest/globals";
import {
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getWorkOrderDuration,
} from "../../client/src/features/work-orders/lib/page-formatters";
import type { WorkOrder } from "../../shared/schema";

const baseOrder = {
  id: "wo-1",
  orgId: "org-1",
  vesselId: "vessel-1",
  equipmentId: "equipment-1",
  priority: 3,
  status: "open",
} as WorkOrder;

describe("work-order page formatters", () => {
  it("formats completed duration from stored actualDuration minutes", () => {
    expect(
      getWorkOrderDuration({
        ...baseOrder,
        status: "completed",
        actualDuration: 135,
      })
    ).toBe("2h 15m");
  });

  it("formats completed duration from actual start/end dates", () => {
    expect(
      getWorkOrderDuration({
        ...baseOrder,
        status: "completed",
        actualStartDate: new Date("2026-01-01T00:00:00Z"),
        actualEndDate: new Date("2026-01-01T01:45:00Z"),
      } as WorkOrder)
    ).toBe("1h 45m");
  });

  it("formats in-progress elapsed duration against the current clock", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T03:30:00Z"));
    try {
      expect(
        getWorkOrderDuration({
          ...baseOrder,
          status: "in_progress",
          actualStartDate: new Date("2026-01-01T01:00:00Z"),
        })
      ).toBe("2h 30m (in progress)");
    } finally {
      jest.useRealTimers();
    }
  });

  it("maps priority and status labels/classes used by the page", () => {
    expect(getPriorityLabel(1)).toBe("Critical");
    expect(getPriorityLabel(2)).toBe("High");
    expect(getPriorityLabel(3)).toBe("Medium");
    expect(getPriorityLabel(99)).toBe("Low");
    expect(getPriorityColor(1)).toContain("destructive");
    expect(getPriorityColor(2)).toContain("chart-2");
    expect(getStatusColor("completed")).toContain("chart-3");
    expect(getStatusColor("in_progress")).toContain("chart-2");
  });
});
