/**
 * db-context abort handling (audit B9).
 *
 * The pinned per-request RLS transaction finalizes on res 'finish' AND
 * 'close'. On a client disconnect mid-handler, 'close' fires while the route
 * handler may still be issuing queries on the pinned client. Returning that
 * client to the pool would hand a still-in-use connection — carrying this
 * request's `SET LOCAL app.current_org_id` — to the next request: a
 * cross-tenant hole. These tests pin that an aborted request DESTROYS its
 * connection (release(true)) and rolls back, while a normal finish COMMITs and
 * returns the client to the pool (release(false)).
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

process.env["ENABLE_PG_RLS_CONTEXT"] = "true";

const queries: string[] = [];
const releaseCalls: Array<boolean | undefined> = [];

const fakeClient = {
  query: jest.fn(async (sql: string) => {
    queries.push(sql);
    return { rows: [] };
  }),
  release: jest.fn((destroy?: boolean) => {
    releaseCalls.push(destroy);
  }),
};

const pool = { connect: jest.fn(async () => fakeClient) };

jest.unstable_mockModule("../../server/db-config", () => ({
  isLocalMode: false,
  pool,
  connectionMode: "tcp",
  supportsPinnedConnection: true,
}));

jest.unstable_mockModule("@shared/config/tenant", () => ({
  DEFAULT_ORG_ID: "default-org",
  requireTenantAuth: () => false,
}));

jest.unstable_mockModule("../../server/db/tenant-context", () => ({
  tenantContextStore: {
    run: (_ctx: unknown, cb: () => void) => cb(),
  },
}));

jest.unstable_mockModule("../../server/lib/structured-logger", () => ({
  createLogger: () => ({
    warn: () => undefined,
    error: () => undefined,
    info: () => undefined,
    debug: () => undefined,
  }),
}));

// drizzle's node-postgres wrapper just stores the client; stub it so the test
// has no real driver dependency.
jest.unstable_mockModule("drizzle-orm/node-postgres", () => ({
  drizzle: () => ({}),
}));
jest.unstable_mockModule("drizzle-orm/neon-serverless", () => ({
  drizzle: () => ({}),
}));

const { withDatabaseContext } = await import("../../server/middleware/db-context");

type ResHandlers = Record<string, Array<() => void>>;

function makeReqRes() {
  const handlers: ResHandlers = {};
  const req = { orgId: "org-test", path: "/api/x", method: "POST" } as never;
  const res = {
    writableEnded: false,
    statusCode: 200,
    on(event: string, cb: () => void) {
      (handlers[event] ??= []).push(cb);
      return this;
    },
    status() {
      return this;
    },
    json() {
      return this;
    },
    emit(event: string) {
      for (const cb of handlers[event] ?? []) {
        cb();
      }
    },
  };
  return { req, res };
}

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  queries.length = 0;
  releaseCalls.length = 0;
  fakeClient.query.mockClear();
  fakeClient.release.mockClear();
  pool.connect.mockClear();
});

describe("withDatabaseContext abort handling (B9)", () => {
  it("destroys the connection and rolls back when the request is aborted mid-flight", async () => {
    const { req, res } = makeReqRes();
    const next = jest.fn();

    withDatabaseContext(req, res as never, next);
    await flush();

    expect(next).toHaveBeenCalledTimes(1);
    expect(queries).toContain("BEGIN");

    // Client disconnects before the response is written: 'close' with
    // writableEnded still false.
    res.writableEnded = false;
    res.emit("close");
    await flush();

    expect(queries).toContain("ROLLBACK");
    expect(queries).not.toContain("COMMIT");
    // Destroyed, not pooled.
    expect(releaseCalls).toEqual([true]);
  });

  it("commits and returns the client to the pool on a normal finish", async () => {
    const { req, res } = makeReqRes();
    const next = jest.fn();

    withDatabaseContext(req, res as never, next);
    await flush();

    res.writableEnded = true;
    res.statusCode = 201;
    res.emit("finish");
    await flush();

    expect(queries).toContain("COMMIT");
    expect(queries).not.toContain("ROLLBACK");
    // Normal release (not destroyed) so the connection is reused.
    expect(releaseCalls).toEqual([false]);
  });
});
