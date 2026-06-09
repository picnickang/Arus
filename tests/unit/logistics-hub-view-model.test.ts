import { describe, expect, it } from "@jest/globals";
import {
  buildLogisticsOverviewModel,
  formatLogisticsError,
  parseLogisticsTab,
} from "@/features/logistics/logistics-overview-model";

describe("logistics overview model", () => {
  it("keeps Logistics tab parsing on canonical tab names", () => {
    expect(parseLogisticsTab("")).toBe("overview");
    expect(parseLogisticsTab("tab=inventory")).toBe("inventory");
    expect(parseLogisticsTab("tab=service-requests")).toBe("service-requests");
    expect(parseLogisticsTab("tab=service-orders")).toBe("service-orders");
    expect(parseLogisticsTab("tab=vendors")).toBe("vendors");
    expect(parseLogisticsTab("tab=unknown")).toBe("overview");
  });

  it("builds exception-first KPIs and queue rows without fake counts", () => {
    const model = buildLogisticsOverviewModel({
      lowStock: {
        total: 2,
        suggestions: [
          {
            partId: "part-1",
            partNumber: "P-1042",
            partName: "Fuel filter cartridge",
            quantityOnHand: 0,
            minStockLevel: 4,
            estimatedCost: 480,
            vesselName: "ARUS Explorer",
          },
        ],
        estimatedTotalCost: 480,
      },
      serviceRequests: [
        {
          id: "sr-1",
          title: "Main engine vibration inspection",
          requestNumber: "SR-1001",
          workOrderId: "wo-1",
          urgency: "critical",
          requestedBy: "chief-engineer",
          status: "pending_review",
          createdAt: "2026-06-10T00:00:00.000Z",
          updatedAt: "2026-06-10T00:00:00.000Z",
          vesselName: "ARUS Explorer",
          equipmentName: "Main engine",
        },
      ],
      serviceOrders: [
        {
          id: "so-1",
          orgId: "org-1",
          workOrderId: "wo-1",
          serviceProviderId: "vendor-1",
          soNumber: "SO-2042",
          status: "confirmed",
          serviceType: "service",
          createdAt: "2026-06-09T00:00:00.000Z",
          updatedAt: "2026-06-09T00:00:00.000Z",
          scope: "Crane hydraulic service",
          vesselName: "ARUS Supply",
          serviceProviderName: "Oceanic Hydraulics",
          urgency: "urgent",
        },
      ],
      vendors: [
        {
          id: "vendor-1",
          orgId: "org-1",
          name: "Oceanic Hydraulics",
          code: "OHL",
          type: "service_provider",
          isActive: true,
          isPreferred: false,
          orderCount: 1,
        },
      ],
    });

    expect(model.kpis.map((kpi) => [kpi.id, kpi.value])).toEqual([
      ["critical-stockouts", "2"],
      ["pending-requests", "1"],
      ["open-service-orders", "1"],
      ["vendor-issues", "0"],
    ]);
    expect(model.urgentQueue.map((row) => row.title)).toEqual([
      "Fuel filter cartridge",
      "Main engine vibration inspection",
      "Crane hydraulic service",
    ]);
    expect(model.urgentQueue.every((row) => row.href.startsWith("/logistics"))).toBe(true);
    expect(model.dataHealth.some((source) => source.state === "healthy")).toBe(true);
  });

  it("renders empty and degraded states instead of inventing metrics", () => {
    const model = buildLogisticsOverviewModel({
      lowStock: undefined,
      serviceRequests: undefined,
      serviceOrders: [],
      vendors: undefined,
      errors: {
        lowStock: new Error(
          "401: Admin endpoints require authentication. Provide Authorization header."
        ),
        vendors: new Error("500: backend unavailable"),
      },
    });

    expect(model.kpis.map((kpi) => [kpi.id, kpi.value])).toEqual([
      ["critical-stockouts", "N/A"],
      ["pending-requests", "N/A"],
      ["open-service-orders", "0"],
      ["vendor-issues", "N/A"],
    ]);
    expect(model.urgentQueue).toEqual([]);
    expect(model.emptyMessage).toBe(
      "No urgent logistics actions are available from the current data."
    );
    expect(
      model.dataHealth.filter((source) => source.state === "degraded").map((source) => source.id)
    ).toEqual(["inventory", "service-requests", "vendors"]);
  });

  it("maps raw backend errors into safe operator messages", () => {
    expect(
      formatLogisticsError(
        new Error("401: Admin endpoints require authentication. Provide Authorization header.")
      )
    ).toEqual({
      title: "Session required",
      message: "Your session expired. Sign in again.",
      tone: "auth",
    });
    expect(formatLogisticsError(new Error("403: forbidden"))).toMatchObject({
      title: "Permission required",
    });
    expect(formatLogisticsError(new Error("500: database unavailable"))).toMatchObject({
      title: "Data unavailable",
      message: "This data could not be loaded. Retry.",
    });
  });
});
