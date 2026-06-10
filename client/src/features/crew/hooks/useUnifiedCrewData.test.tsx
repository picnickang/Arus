/**
 * WS6: useUnifiedCrewData sources its four reference datasets from the
 * /api/crew/unified aggregate (one request instead of four) and keeps its
 * return shape for the crew-management page.
 */

import { describe, it, expect } from "@jest/globals";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { envelope } from "@/test/msw/handlers";
import { renderHookWithClient } from "@/test/test-utils";
import { useUnifiedCrewData } from "./useUnifiedCrewData";

const unifiedPayload = {
  crew: [
    {
      id: "c-1",
      name: "A. Santos",
      rank: "Chief Engineer",
      vesselId: "v-1",
      status: "active",
      onDuty: true,
      skills: [],
    },
    {
      id: "c-2",
      name: "M. Tan",
      rank: "Second Engineer",
      vesselId: "v-1",
      status: "active",
      onDuty: false,
      skills: [],
    },
  ],
  vessels: [{ id: "v-1", name: "MV Test", active: true }],
  crewRoles: [],
  permissionRoles: [{ id: "r-1", name: "admin", displayName: "Administrator" }],
};

describe("useUnifiedCrewData", () => {
  it("loads all four sections from the unified aggregate", async () => {
    let requests = 0;
    server.use(
      http.get("/api/crew/unified", () => {
        requests++;
        return HttpResponse.json(envelope(unifiedPayload));
      })
    );

    const { result } = renderHookWithClient(() => useUnifiedCrewData());
    await waitFor(() => expect(result.current.crewLoading).toBe(false));

    expect(result.current.crew).toHaveLength(2);
    expect(result.current.vessels[0]?.name).toBe("MV Test");
    expect(result.current.permissionRoles[0]?.id).toBe("r-1");
    expect(result.current.getVesselName("v-1")).toBe("MV Test");
    expect(result.current.stats.totalCrew).toBe(2);
    expect(requests).toBe(1);
  });

  it("degrades a failed section to an empty list (server sends sectionErrors)", async () => {
    server.use(
      http.get("/api/crew/unified", () =>
        HttpResponse.json(
          envelope({
            ...unifiedPayload,
            permissionRoles: [],
            sectionErrors: { permissionRoles: "unavailable" },
          })
        )
      )
    );

    const { result } = renderHookWithClient(() => useUnifiedCrewData());
    await waitFor(() => expect(result.current.crewLoading).toBe(false));
    expect(result.current.permissionRoles).toEqual([]);
    expect(result.current.crew).toHaveLength(2);
  });

  it("skips the admin-gated access queries unless enabled", async () => {
    let accessCalls = 0;
    server.use(
      http.get("/api/crew/unified", () => HttpResponse.json(envelope(unifiedPayload))),
      http.get("/api/admin/crew/access-readiness", () => {
        accessCalls++;
        return HttpResponse.json([]);
      })
    );

    const { result } = renderHookWithClient(() => useUnifiedCrewData());
    await waitFor(() => expect(result.current.crewLoading).toBe(false));
    expect(accessCalls).toBe(0);
  });
});
