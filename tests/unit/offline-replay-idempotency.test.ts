/**
 * WS1 offline mutation safety: the idempotency key chain survives replay,
 * concurrent replays collapse into one, and the outbox enforces its cap.
 *
 * Uses fake-indexeddb so the offline-sync idb wrapper works in node, and a
 * mocked global fetch to observe exactly what the replay path sends.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";

import "fake-indexeddb/auto";
import { openDB } from "idb";

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

const offlineSync = await import("../../client/src/lib/offline-sync");
const { apiRequest, replayQueuedApiRequests } = await import("../../client/src/lib/queryClient");

const DB_NAME = "arus-offline-sync";
const DB_VERSION = 2;

const fetchMock = jest.fn<typeof fetch>();
globalThis.fetch = fetchMock as typeof fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sentRequest(call: unknown[]): { url: string; init: RequestInit } {
  return { url: call[0] as string, init: (call[1] ?? {}) as RequestInit };
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function clearStores(): Promise<void> {
  const db = await openDB(DB_NAME, DB_VERSION);
  await db.clear("pendingOperations");
  await db.clear("conflicts");
  await db.clear("syncMetadata");
  db.close();
}

describe("offline replay idempotency (WS1)", () => {
  beforeAll(async () => {
    await offlineSync.getPendingCount();
  });

  beforeEach(async () => {
    await clearStores();
    fetchMock.mockReset();
  });

  it("replay sends the Idempotency-Key header and strips __-prefixed payload keys", async () => {
    const op = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
      title: "pump overhaul",
    });
    expect(op.clientMutationId).toBeTruthy();

    fetchMock.mockResolvedValue(jsonResponse(201, { id: "wo-1" }));

    const result = await replayQueuedApiRequests();
    expect(result).toEqual({ synced: 1, failed: 0, conflicts: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { init } = sentRequest(fetchMock.mock.calls[0] as unknown[]);
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe(op.clientMutationId);

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["title"]).toBe("pump overhaul");
    expect(Object.keys(body).some((k) => k.startsWith("__"))).toBe(false);
  });

  it("falls back to payload.__clientMutationId for ops queued by older builds", async () => {
    const op = await offlineSync.queueApiOperation("POST", "/api/work-orders", { title: "legacy" });

    // Simulate a record written before clientMutationId was promoted to a
    // top-level field on the operation.
    const db = await openDB(DB_NAME, DB_VERSION);
    const record = (await db.get("pendingOperations", op.id)) as Record<string, unknown>;
    delete record["clientMutationId"];
    await db.put("pendingOperations", record);
    db.close();

    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await replayQueuedApiRequests();

    const { init } = sentRequest(fetchMock.mock.calls[0] as unknown[]);
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe(op.payload["__clientMutationId"]);
  });

  it("concurrent replay calls share one in-flight replay (mutex)", async () => {
    await offlineSync.queueApiOperation("POST", "/api/work-orders", { title: "once" });

    let resolveFetch: (value: Response) => void = () => undefined;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const first = replayQueuedApiRequests();
    const second = replayQueuedApiRequests();
    // The replay reads IndexedDB before fetching; resolve only once fetch is
    // actually in flight, otherwise the captured resolver is still the no-op.
    await waitFor(() => fetchMock.mock.calls.length === 1);
    resolveFetch(jsonResponse(201, { id: "wo-1" }));

    const [a, b] = await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ synced: 1, failed: 0, conflicts: 0 });
    expect(b).toEqual(a);

    // After completion the lock is released: a new replay runs again.
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await offlineSync.queueApiOperation("POST", "/api/work-orders", { title: "again" });
    const third = await replayQueuedApiRequests();
    expect(third.synced).toBe(1);
  });

  it("409 during replay records a conflict and pauses the operation", async () => {
    const op = await offlineSync.queueApiOperation("PATCH", "/api/work-orders/wo-9", {
      id: "wo-9",
      status: "completed",
    });

    fetchMock.mockResolvedValue(jsonResponse(409, { message: "stale version", version: 4 }));

    const result = await replayQueuedApiRequests();
    expect(result.conflicts).toBe(1);

    const after = (await offlineSync.getPendingOperations()).find((p) => p.id === op.id);
    expect(after?.conflictPaused).toBe(true);
    const conflicts = await offlineSync.getConflicts();
    expect(conflicts.find((c) => c.operationId === op.id)?.serverVersion).toMatchObject({
      message: "stale version",
    });
  });

  it("enveloped 409s store the domain payload from error.details, not envelope plumbing", async () => {
    const op = await offlineSync.queueApiOperation("PATCH", "/api/work-orders/wo-10", {
      id: "wo-10",
      status: "completed",
    });

    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        success: false,
        error: {
          code: "CONFLICT",
          message: "stale version",
          details: { id: "wo-10", status: "in_progress", version: 7 },
        },
        message: "stale version",
        code: "CONFLICT",
      })
    );

    await replayQueuedApiRequests();
    const conflicts = await offlineSync.getConflicts();
    const stored = conflicts.find((c) => c.operationId === op.id)?.serverVersion;
    expect(stored).toEqual({ id: "wo-10", status: "in_progress", version: 7 });
  });

  it("enveloped 409s without details fall back to the error object", async () => {
    const op = await offlineSync.queueApiOperation("PATCH", "/api/work-orders/wo-11", {
      id: "wo-11",
      status: "completed",
    });

    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        success: false,
        error: { code: "CONFLICT", message: "version conflict" },
        message: "version conflict",
        code: "CONFLICT",
      })
    );

    await replayQueuedApiRequests();
    const conflicts = await offlineSync.getConflicts();
    expect(conflicts.find((c) => c.operationId === op.id)?.serverVersion).toMatchObject({
      code: "CONFLICT",
      message: "version conflict",
    });
  });

  it("apiRequest attaches the Idempotency-Key on the first live attempt of queueable mutations", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "wo-1" }));

    await apiRequest("POST", "/api/work-orders", { title: "live" });
    const { init } = sentRequest(fetchMock.mock.calls[0] as unknown[]);
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^client-mutation:/);

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await apiRequest("POST", "/api/equipment", { name: "not queueable" });
    const second = sentRequest(fetchMock.mock.calls[0] as unknown[]);
    expect((second.init.headers as Record<string, string>)["Idempotency-Key"]).toBeUndefined();
  });

  it("a request that dies mid-flight queues with the SAME key it sent live", async () => {
    fetchMock.mockRejectedValue(new TypeError("failed to fetch"));

    const queued = (await apiRequest("POST", "/api/work-orders", {
      title: "flaky link",
    })) as { queuedForSync: true; id: string };
    expect(queued.queuedForSync).toBe(true);

    const sentKey = (
      sentRequest(fetchMock.mock.calls[0] as unknown[]).init.headers as Record<string, string>
    )["Idempotency-Key"];
    expect(sentKey).toBeTruthy();

    const op = (await offlineSync.getPendingOperations()).find((p) => p.id === queued.id);
    expect(op?.clientMutationId).toBe(sentKey);

    // Replay then reuses that exact key, landing on the server's cached response.
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "wo-1" }));
    await replayQueuedApiRequests();
    const replayKey = (
      sentRequest(fetchMock.mock.calls[0] as unknown[]).init.headers as Record<string, string>
    )["Idempotency-Key"];
    expect(replayKey).toBe(sentKey);
  });

  it("rejects new operations once the outbox cap is reached", async () => {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction("pendingOperations", "readwrite");
    for (let i = 0; i < offlineSync.MAX_PENDING_OPERATIONS; i++) {
      void tx.store.add({
        id: `bulk-${i}`,
        entityType: "work_order",
        entityId: `wo-${i}`,
        operationType: "update",
        payload: {},
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
    }
    await tx.done;
    db.close();

    await expect(
      offlineSync.queueOperation("work_order", "wo-overflow", "create", { title: "x" })
    ).rejects.toBeInstanceOf(offlineSync.OfflineQueueFullError);

    // Dedupe of an EXISTING entity still works at the cap (update collapses).
    const id = await offlineSync.queueOperation("work_order", "wo-1", "update", { status: "done" });
    expect(id).toBe("bulk-1");
  });
});
