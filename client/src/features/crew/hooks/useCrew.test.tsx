/**
 * Seed renderHook test for the client data-layer lane (WS3): proves the
 * jsdom + MSW + Testing Library harness against a real hook, and pins that
 * hooks behave identically whether the server sends legacy bodies or the
 * canonical {success, data} envelope.
 */

import { describe, it, expect } from "@jest/globals";
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { envelope } from "@/test/msw/handlers";
import { renderHookWithClient } from "@/test/test-utils";
import { useCrewList } from "./useCrew";

const crew = [
  { id: "c-1", name: "A. Santos", role: "Chief Engineer" },
  { id: "c-2", name: "M. Tan", role: "Second Engineer" },
];

describe("useCrewList", () => {
  it("loads crew from a legacy array body", async () => {
    server.use(http.get("/api/crew", () => HttpResponse.json(crew)));

    const { result } = renderHookWithClient(() => useCrewList());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]?.name).toBe("A. Santos");
  });

  it("loads crew identically from an enveloped body (WS4 transparency)", async () => {
    server.use(http.get("/api/crew", () => HttpResponse.json(envelope(crew))));

    const { result } = renderHookWithClient(() => useCrewList());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("surfaces server failures as typed errors", async () => {
    server.use(
      http.get("/api/crew", () =>
        HttpResponse.json({ message: "Failed to fetch crew" }, { status: 500 })
      )
    );

    const { result } = renderHookWithClient(() => useCrewList());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("500: Failed to fetch crew");
  });
});
