import { describe, expect, it, afterEach, jest } from "@jest/globals";
import {
  analyzeEquipmentHealth,
  calculateAverageDaysBetween,
  calculateAverageResolutionTime,
  calculateComplianceScore,
  calculateEfficiencyTrends,
  calculateOperatingHours,
  calculatePerformanceMetrics,
  calculatePredictiveLeadTime,
  calculateVesselAge,
  determineCostTrend,
  generateFailureRecommendations,
  identifyCorrelatedMetrics,
  identifyEnvironmentalFactors,
} from "./calculation-helpers.js";

type RecordLike = Record<string, unknown>;

function workOrder(input: RecordLike): never {
  return input as never;
}

function telemetry(input: RecordLike): never {
  return input as never;
}

describe("vessel intelligence calculation helpers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("derives operating hours, vessel age, and average resolution time from dated records", () => {
    jest.spyOn(Date, "now").mockReturnValue(new Date("2026-01-01T00:00:00Z").getTime());

    const vessel = {
      commissionDate: "2024-01-01T00:00:00Z",
      createdAt: "2023-01-01T00:00:00Z",
    } as never;

    expect(calculateVesselAge(vessel)).toBe(2);
    expect(calculateOperatingHours(vessel)).toBe(17544);
    expect(
      calculateAverageResolutionTime([
        workOrder({
          status: "completed",
          createdAt: "2026-01-01T00:00:00Z",
          actualEndDate: "2026-01-02T12:00:00Z",
        }),
        workOrder({ status: "open", createdAt: "2026-01-01T00:00:00Z" }),
      ])
    ).toBe(36);
    expect(calculateAverageResolutionTime([])).toBe(0);
  });

  it("summarizes recent performance, equipment health, and maintenance compliance", () => {
    jest.spyOn(Date, "now").mockReturnValue(new Date("2026-06-01T00:00:00Z").getTime());

    const orders = [
      workOrder({
        id: "wo-1",
        status: "completed",
        createdAt: "2026-05-20T00:00:00Z",
        actualEndDate: "2026-05-21T00:00:00Z",
        affectsVesselDowntime: true,
        actualDowntimeHours: 24,
        workOrderType: "corrective",
        priority: "critical",
      }),
      workOrder({
        id: "wo-2",
        status: "open",
        createdAt: "2026-05-25T00:00:00Z",
        affectsVesselDowntime: true,
        estimatedDowntimeHours: 12,
        workOrderType: "preventive",
        priority: "normal",
      }),
    ];

    expect(calculatePerformanceMetrics(orders, 4)).toEqual({
      availability: 95,
      reliability: 97,
      maintainability: 75,
    });
    expect(
      analyzeEquipmentHealth([
        { healthScore: 95 },
        { healthScore: 75 },
        { healthScore: 55 },
        { healthScore: 25 },
        { healthScore: null },
      ])
    ).toEqual({ excellent: 1, normal: 2, warning: 1, critical: 1 });
    expect(
      calculateComplianceScore(orders, {
        scheduled: 2,
        preventive: 3,
        unscheduled: 1,
        averageResolutionTime: 0,
        totalWorkOrders: 6,
      } as never)
    ).toBe(83);
    expect(
      calculateComplianceScore(orders, { scheduled: 0, preventive: 0, unscheduled: 0 } as never)
    ).toBe(100);
  });

  it("identifies timing gaps, correlated telemetry, recommendations, and cost trends", () => {
    const orders = [
      workOrder({ id: "wo-1", createdAt: "2026-01-01T00:00:00Z" }),
      workOrder({ id: "wo-2", createdAt: "2026-01-11T00:00:00Z" }),
      workOrder({ id: "wo-3", createdAt: "2026-01-21T00:00:00Z" }),
    ];

    expect(calculateAverageDaysBetween([orders[2], orders[0], orders[1]])).toBe(10);
    expect(calculateAverageDaysBetween([orders[0]])).toBe(0);

    expect(
      identifyCorrelatedMetrics(
        [
          telemetry({ sensorType: "temperature", ts: "2026-01-20T00:00:00Z" }),
          telemetry({ sensorType: "vibration", ts: "2026-01-19T01:00:00Z" }),
          telemetry({ sensorType: "pressure", ts: "2025-12-01T00:00:00Z" }),
        ],
        [workOrder({ createdAt: "2026-01-21T00:00:00Z" })]
      )
    ).toEqual(["temperature", "vibration"]);

    expect(generateFailureRecommendations("pump", 4, 60)).toEqual(
      expect.arrayContaining([
        "Consider equipment replacement or major overhaul",
        "Increase preventive maintenance frequency",
        "Implement condition-based monitoring",
        "Schedule inspection every 42 days",
      ])
    );

    expect(
      determineCostTrend([
        workOrder({ createdAt: "2026-01-01", estimatedCostPerHour: 10, estimatedHours: 10 }),
        workOrder({ createdAt: "2026-01-02", estimatedCostPerHour: 10, estimatedHours: 10 }),
        workOrder({ createdAt: "2026-01-03", estimatedCostPerHour: 50, estimatedHours: 10 }),
        workOrder({ createdAt: "2026-01-04", estimatedCostPerHour: 60, estimatedHours: 10 }),
      ])
    ).toBe("increasing");
    expect(
      determineCostTrend([
        workOrder({ createdAt: "2026-01-01", estimatedCostPerHour: 60, estimatedHours: 10 }),
        workOrder({ createdAt: "2026-01-02", estimatedCostPerHour: 50, estimatedHours: 10 }),
        workOrder({ createdAt: "2026-01-03", estimatedCostPerHour: 10, estimatedHours: 10 }),
        workOrder({ createdAt: "2026-01-04", estimatedCostPerHour: 10, estimatedHours: 10 }),
      ])
    ).toBe("decreasing");
    expect(determineCostTrend([workOrder({})])).toBe("stable");
  });

  it("detects efficiency trends, environmental factors, and predictive lead time", () => {
    const rising = Array.from({ length: 12 }, (_, index) =>
      telemetry({
        sensorType: "fuel_efficiency",
        value: index < 6 ? 100 : 130,
        ts: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      })
    );
    const falling = Array.from({ length: 12 }, (_, index) =>
      telemetry({
        sensorType: "oil_pressure",
        value: index < 6 ? 100 : 70,
        ts: `2026-02-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      })
    );
    const stable = Array.from({ length: 12 }, (_, index) =>
      telemetry({
        sensorType: "rpm",
        value: index < 6 ? 100 : 105,
        ts: `2026-03-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      })
    );

    expect(calculateEfficiencyTrends([...rising, ...falling, ...stable])).toEqual([
      { metric: "fuel_efficiency", trend: "improving", change: 30 },
      { metric: "oil_pressure", trend: "declining", change: -30 },
      { metric: "rpm", trend: "stable", change: 5 },
    ]);

    expect(
      identifyEnvironmentalFactors([
        telemetry({ sensorType: "engine_temp", value: 85 }),
        telemetry({ sensorType: "ambient_temp", value: 65 }),
        telemetry({ sensorType: "shaft_vibration", value: 52 }),
      ])
    ).toEqual([
      {
        factor: "Temperature",
        impact: "medium",
        description: "Average operating temperature: 75.0°C",
      },
      {
        factor: "Vibration",
        impact: "high",
        description: "Peak vibration levels: 52.00 mm/s",
      },
    ]);

    const failureTime = new Date("2026-04-08T00:00:00Z").getTime();
    const leadReadings = Array.from({ length: 12 }, (_, index) =>
      telemetry({
        sensorType: "vibration",
        value: index < 6 ? 100 : 150,
        ts: new Date(failureTime - (12 - index) * 60 * 60 * 1000).toISOString(),
      })
    );

    expect(
      calculatePredictiveLeadTime(leadReadings, [workOrder({ createdAt: "2026-04-08T00:00:00Z" })])
    ).toBe(1);
    expect(
      calculatePredictiveLeadTime([], [workOrder({ createdAt: "2026-04-08T00:00:00Z" })])
    ).toBe(0);
  });
});
