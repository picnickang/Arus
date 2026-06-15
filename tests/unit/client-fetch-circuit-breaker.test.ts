/**
 * Resilience follow-ups from issue #65 (the deferred items #3 and #4):
 *
 *  #3 — every client fetch chokepoint must feed the shared backend circuit
 *       breaker. apiRequest already did; this pins the two paths that used to
 *       bypass it — apiFormDataRequest (uploads) and getQueryFn (the React
 *       Query GET chokepoint) — so they both fail fast when the breaker is open
 *       and trip it on connection failure (but never on an HTTP status error).
 *
 *  #4 — uploads must not carry a default client-side timeout: they are
 *       non-idempotent writes with no offline-outbox replay path, so a default
 *       bound would abort a legitimately slow upload with no way to resume.
 *
 * Uses the real module-level breaker (spied on) and a mocked global fetch.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import "fake-indexeddb/auto";

jest.unstable_mockModule("@/hooks/useDeviceId", () => ({
  getCurrentDeviceId: () => "device-test",
}));
jest.unstable_mockModule("@/contexts/OrganizationContext", () => ({
  getCurrentOrgId: () => "org-test",
}));
jest.unstable_mockModule("@/lib/desktopFetch", () => ({
  getBackendUrlSync: () => "",
}));
jest.unstable_mockModule("@/lib/sessionToken", () => ({
  getApiSessionToken: () => null,
}));
jest.unstable_mockModule("@/lib/tenant-quota-notifications", () => ({
  formatQuotaExceededMessage: (info: { metric: string }) => `quota exceeded: ${info.metric}`,
  inspectQuotaWarning: () => undefined,
  notifyQuotaExceeded: () => undefined,
  parseQuotaExceeded: () => undefined,
}));

// The real breaker (not mocked) so we observe the actual contract; it is the
// same singleton instance queryClient-request imports via @/lib/circuit-breaker.
const { backendCircuit } = await import("../../client/src/lib/circuit-breaker");
const { apiFormDataRequest, getQueryFn } = await import("../../client/src/lib/queryClient-request");

const fetchMock = jest.fn<typeof fetch>();
globalThis.fetch = fetchMock as typeof fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Minimal QueryFunctionContext (TPageParam = never branch): queryKey + signal +
// meta are the only required fields, so this needs no QueryClient and no cast.
function queryContext(queryKey: readonly unknown[]) {
  return { queryKey, signal: new AbortController().signal, meta: undefined };
}

describe("client fetch breaker coverage (issue #65 follow-ups #3/#4)", () => {
  beforeEach(() => {
    backendCircuit.reset();
    fetchMock.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("apiFormDataRequest is routed through the breaker (#3)", () => {
    it("records success when the server is reached", async () => {
      const success = jest.spyOn(backendCircuit, "recordSuccess");
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { ok: true } }));

      await apiFormDataRequest("POST", "/api/kb/upload", new FormData());

      expect(success).toHaveBeenCalled();
    });

    it("trips the breaker on a dropped link but NOT on an HTTP error", async () => {
      const failure = jest.spyOn(backendCircuit, "recordFailure");

      // A reachable server returning 5xx is a valid response: it must not count.
      fetchMock.mockResolvedValue(jsonResponse(500, { error: "boom" }));
      await expect(apiFormDataRequest("POST", "/api/kb/upload", new FormData())).rejects.toThrow();
      expect(failure).not.toHaveBeenCalled();

      // A connection-level failure is what feeds the breaker.
      fetchMock.mockReset();
      fetchMock.mockRejectedValue(new TypeError("failed to fetch"));
      await expect(apiFormDataRequest("POST", "/api/kb/upload", new FormData())).rejects.toThrow();
      expect(failure).toHaveBeenCalledTimes(1);
    });

    it("fails fast without fetching when the breaker is open", async () => {
      jest.spyOn(backendCircuit, "canRequest").mockReturnValue(false);

      await expect(apiFormDataRequest("POST", "/api/kb/upload", new FormData())).rejects.toThrow(
        "circuit open"
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("apiFormDataRequest no longer imposes a default timeout (#4)", () => {
    it("attaches no abort signal when the caller passes no timeout", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }));

      await apiFormDataRequest("POST", "/api/kb/upload", new FormData());

      const init: RequestInit = fetchMock.mock.calls[0]?.[1] ?? {};
      expect(init.signal).toBeUndefined();
    });

    it("honours an explicit opt-in timeout", async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: null }));

      await apiFormDataRequest("POST", "/api/kb/upload", new FormData(), { timeoutMs: 5_000 });

      const init: RequestInit = fetchMock.mock.calls[0]?.[1] ?? {};
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("getQueryFn is routed through the breaker (#3)", () => {
    it("records success and returns the unwrapped envelope body", async () => {
      const success = jest.spyOn(backendCircuit, "recordSuccess");
      fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { hello: "world" } }));

      const queryFn = getQueryFn<{ hello: string }>({ on401: "throw" });
      const result = await queryFn(queryContext(["/api/thing"]));

      expect(result).toEqual({ hello: "world" });
      expect(success).toHaveBeenCalled();
    });

    it("trips the breaker on a dropped link", async () => {
      const failure = jest.spyOn(backendCircuit, "recordFailure");
      fetchMock.mockRejectedValue(new TypeError("failed to fetch"));

      const queryFn = getQueryFn({ on401: "throw" });
      await expect(queryFn(queryContext(["/api/thing"]))).rejects.toThrow();

      expect(failure).toHaveBeenCalledTimes(1);
    });

    it("fails fast without fetching when the breaker is open", async () => {
      jest.spyOn(backendCircuit, "canRequest").mockReturnValue(false);

      const queryFn = getQueryFn({ on401: "throw" });
      await expect(queryFn(queryContext(["/api/thing"]))).rejects.toThrow("circuit open");

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
