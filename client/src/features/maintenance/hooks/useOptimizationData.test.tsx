/**
 * WS6: useOptimizationData sources the dashboard from the
 * /api/optimization/dashboard aggregate (one request instead of five,
 * previously each polled at 15s) plus the shared /api/crew cache entry.
 */

import { describe, it, expect } from "@jest/globals";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { envelope } from "@/test/msw/handlers";
import { renderHookWithClient } from "@/test/test-utils";
import { useOptimizationData } from "./useOptimizationData";

const dashboardPayload = {
  configurations: [{ id: "cfg-1", name: "Default plan" }],
  results: [{ id: "res-1", configurationId: "cfg-1", runStatus: "completed" }],
  trendInsights: [],
  equipment: [{ id: "eq-1", name: "Cooling pump" }],
  vessels: [
    { id: "v-1", name: "MV Test", active: true },
    { id: "v-2", name: "MV Idle", active: false },
  ],
};

function useDashboardHandlers() {
  let dashboardRequests = 0;
  server.use(
    http.get("/api/optimization/dashboard", () => {
      dashboardRequests++;
      return HttpResponse.json(envelope(dashboardPayload));
    }),
    http.get("/api/crew", () =>
      HttpResponse.json([
        { id: "c-1", name: "A. Santos", active: true },
        { id: "c-2", name: "M. Tan", active: false },
      ])
    ),
    http.get("/api/equipment/:id/rul", () =>
      HttpResponse.json({ riskLevel: "low", remainingDays: 120, healthIndex: 0.9, failureProbability: 0.05 })
    )
  );
  return () => dashboardRequests;
}

describe("useOptimizationData", () => {
  it("loads every dashboard section from one aggregate request", async () => {
    const getDashboardRequests = useDashboardHandlers();

    const { result } = renderHookWithClient(() => useOptimizationData());
    await waitFor(() => expect(result.current.configurationsLoading).toBe(false));

    expect(result.current.configurations).toHaveLength(1);
    expect(result.current.optimizationResults?.[0]?.id).toBe("res-1");
    expect(result.current.trendAnalyses).toEqual([]);
    expect(result.current.equipment?.[0]?.id).toBe("eq-1");
    expect(result.current.fleetStats.activeVessels).toBe(1);
    expect(result.current.fleetStats.totalVessels).toBe(2);
    expect(getDashboardRequests()).toBe(1);

    await waitFor(() => expect(result.current.fleetStats.activeCrew).toBe(1));
  });

  it("filters configurations and results from the aggregate data", async () => {
    useDashboardHandlers();

    const { result } = renderHookWithClient(() => useOptimizationData());
    await waitFor(() => expect(result.current.configurationsLoading).toBe(false));

    expect(result.current.filteredConfigurations).toHaveLength(1);
    expect(result.current.filteredResults).toHaveLength(1);
  });
});
