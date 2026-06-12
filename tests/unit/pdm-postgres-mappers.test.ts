import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  formatTimeAgo,
  mapRiskQueueRows,
  type RiskQueryRow,
} from "../../server/pdm/adapters/pdm-postgres-mappers";

afterEach(() => {
  jest.useRealTimers();
});

describe("PDM Postgres mappers", () => {
  const baseRow: RiskQueryRow = {
    id: 42,
    equipmentId: "eq-main",
    failureMode: "bearing vibration",
    riskLevel: "critical",
    remainingUsefulLife: 72,
    confidenceInterval: { low: 24, high: 120 },
    failureProbability: 0.82,
    maintenanceRecommendations: ["Inspect bearing"],
    predictionTimestamp: new Date("2026-06-10T12:00:00Z"),
    resolvedByWorkOrderId: null,
    equipmentName: "Main Engine",
    equipmentType: "engine",
    vesselId: "vessel-1",
    vesselName: "MV Example",
  };

  it("maps active risk rows with evidence chips, RUL confidence, and display fallbacks", () => {
    const [item] = mapRiskQueueRows([baseRow], "active");

    expect(item).toMatchObject({
      id: "42",
      vesselId: "vessel-1",
      vesselName: "MV Example",
      equipmentId: "eq-main",
      equipmentName: "Main Engine",
      equipmentType: "engine",
      failureMode: "bearing vibration",
      severity: "critical",
      rulEstimateDays: 3,
      rulConfidenceInterval: { lowDays: 1, highDays: 5 },
      confidence: 18,
      recommendedAction: "Inspect bearing",
      status: "active",
      workOrderId: null,
    });
    expect(item?.evidenceChips).toBeDefined();
    expect(item?.evidenceChips?.map((chip) => chip.label)).toEqual([
      "Low RUL",
      "High Failure Probability",
      "Critical Condition",
    ]);
  });

  it("filters risk rows into new, active, and resolved queue views", () => {
    const newRow = { ...baseRow, id: 1, riskLevel: "medium", resolvedByWorkOrderId: null };
    const activeRow = { ...baseRow, id: 2, riskLevel: "high", resolvedByWorkOrderId: null };
    const resolvedRow = { ...baseRow, id: 3, riskLevel: "critical", resolvedByWorkOrderId: "wo-1" };
    const rows = [newRow, activeRow, resolvedRow];

    expect(mapRiskQueueRows(rows, "new").map((item) => item.id)).toEqual(["1"]);
    expect(mapRiskQueueRows(rows, "active").map((item) => item.id)).toEqual(["2"]);
    expect(mapRiskQueueRows(rows, "resolved").map((item) => item.id)).toEqual(["3"]);
    expect(mapRiskQueueRows(rows).map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("formats relative timestamps for telemetry freshness labels", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-12T12:00:00Z"));

    expect(formatTimeAgo(new Date("2026-06-12T10:00:00Z"))).toBe("2h ago");
    expect(formatTimeAgo(new Date("2026-06-09T12:00:00Z"))).toBe("3d ago");
  });
});
