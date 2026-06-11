/**
 * Task 91 — WebSocket multi-tenant isolation under strict mode.
 *
 * Boots a real HTTP server with the production WebSocket server bound
 * to it, with `dbSystemAdminStorage` / `dbUserStorage` mocked so two
 * sessions resolve to two distinct orgs. Confirms:
 *
 *   1. Without strict mode, the legacy SYSTEM_ORG_ID bypass still
 *      reaches both tenants' clients (the historical behaviour).
 *   2. With WS_TENANT_STRICT_MODE=true, a SYSTEM_ORG_ID broadcast is
 *      dropped (with a warning) and never reaches any client.
 *   3. With WS_TENANT_STRICT_MODE=true, an event published to tenant
 *      A only ever reaches tenant A's client — tenant B never sees it.
 *
 * This is the "two-org integration test that proves no cross-tenant
 * delivery" called out in the task's done-looks-like.
 */

import { beforeAll, jest } from "@jest/globals";
import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import crypto from "node:crypto";
import WebSocket from "ws";

const ORG_A = "org-a";
const ORG_B = "org-b";
const TOKEN_A = "token-for-org-a";
const TOKEN_B = "token-for-org-b";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const sessions = new Map<string, { id: string; userId: string; expiresAt: Date }>([
  [hashToken(TOKEN_A), { id: "s-a", userId: "user-a", expiresAt: new Date(Date.now() + 60_000) }],
  [hashToken(TOKEN_B), { id: "s-b", userId: "user-b", expiresAt: new Date(Date.now() + 60_000) }],
]);
const users = new Map<string, { id: string; orgId: string; isActive: boolean }>([
  ["user-a", { id: "user-a", orgId: ORG_A, isActive: true }],
  ["user-b", { id: "user-b", orgId: ORG_B, isActive: true }],
]);

jest.unstable_mockModule("../../server/repositories", () => ({
  dbAlertStorage: {
    getAlertNotifications: jest.fn(async () => []),
  },
  dbSystemAdminStorage: {
    getAdminSessionByToken: jest.fn(async (hash: string) => sessions.get(hash)),
  },
  dbUserStorage: {
    getUser: jest.fn(async (id: string) => users.get(id)),
  },
}));

// Force tenant-auth mode so resolveUpgradeOrg honours the token path
// instead of dropping every connection into DEFAULT_ORG_ID.
process.env["REQUIRE_TENANT_AUTH"] = "true";
process.env["NODE_ENV"] = "production";

// Imports must be after env + unstable_mockModule setup.
type TelemetryWebSocketServerType =
  typeof import("../../server/websocket").TelemetryWebSocketServer;
type InProcessFanoutBusType = typeof import("../../server/websocket-fanout").InProcessFanoutBus;

let TelemetryWebSocketServer: TelemetryWebSocketServerType;
let InProcessFanoutBus: InProcessFanoutBusType;
let SYSTEM_ORG_ID: string;

beforeAll(async () => {
  ({ TelemetryWebSocketServer } = await import("../../server/websocket"));
  ({ InProcessFanoutBus, SYSTEM_ORG_ID } = await import("../../server/websocket-fanout"));
});

type AnyTws = InstanceType<TelemetryWebSocketServerType>;

interface Harness {
  http: Server;
  wsServer: AnyTws;
  bus: InstanceType<typeof InProcessFanoutBus>;
  port: number;
}

async function bootHarness(): Promise<Harness> {
  const http = createServer();
  const bus = new InProcessFanoutBus();
  const wsServer: AnyTws = new TelemetryWebSocketServer(http, bus);
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const port = (http.address() as AddressInfo).port;
  return { http, wsServer, bus, port };
}

async function teardown(h: Harness): Promise<void> {
  h.wsServer.destroy();
  await new Promise<void>((resolve) => h.http.close(() => resolve()));
}

function connect(port: number, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => reject(new Error("ws connect timeout")), 5000);
    ws.once("message", (data) => {
      // First message from the server is the connection welcome frame
      // (`{ type: "connection", ... }`). Use it as the open signal so
      // any subsequent subscribe message arrives after the server-side
      // bookkeeping for this client is fully established.
      const parsed = JSON.parse(data.toString());
      if (parsed.type === "connection") {
        clearTimeout(timer);
        resolve(ws);
      }
    });
    ws.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function collectFrames(ws: WebSocket): { frames: Array<Record<string, unknown>> } {
  const frames: Array<Record<string, unknown>> = [];
  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === "connection" || parsed.type === "pong") {
        return;
      }
      frames.push(parsed);
    } catch {
      /* ignore non-json frames */
    }
  });
  return { frames };
}

async function settle(ms = 60): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function closeSocket(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) {
    return;
  }
  await new Promise<void>((resolve) => {
    ws.once("close", () => resolve());
    ws.close();
  });
}

describe("websocket strict mode / cross-tenant isolation", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await bootHarness();
  });

  afterEach(async () => {
    delete process.env["WS_TENANT_STRICT_MODE"];
    await teardown(h);
  });

  test("production default drops SYSTEM_ORG_ID broadcasts unless strict mode is explicitly disabled", async () => {
    delete process.env["WS_TENANT_STRICT_MODE"];
    const a = await connect(h.port, TOKEN_A);
    const b = await connect(h.port, TOKEN_B);
    const aCap = collectFrames(a);
    const bCap = collectFrames(b);

    a.send(JSON.stringify({ type: "subscribe", channel: "updates" }));
    b.send(JSON.stringify({ type: "subscribe", channel: "updates" }));
    await settle();

    h.wsServer.broadcast("updates", { type: "ping", data: { hello: "world" } });
    await settle();

    expect(aCap.frames.some((f) => f["orgId"] === SYSTEM_ORG_ID)).toBe(false);
    expect(bCap.frames.some((f) => f["orgId"] === SYSTEM_ORG_ID)).toBe(false);

    await Promise.all([closeSocket(a), closeSocket(b)]);
  });

  test("strict mode drops SYSTEM_ORG_ID broadcasts — neither tenant receives them", async () => {
    process.env["WS_TENANT_STRICT_MODE"] = "true";
    const a = await connect(h.port, TOKEN_A);
    const b = await connect(h.port, TOKEN_B);
    const aCap = collectFrames(a);
    const bCap = collectFrames(b);

    a.send(JSON.stringify({ type: "subscribe", channel: "updates" }));
    b.send(JSON.stringify({ type: "subscribe", channel: "updates" }));
    await settle();

    h.wsServer.broadcast("updates", { type: "ping" });
    // Defence-in-depth: a stray direct publish to SYSTEM_ORG_ID must
    // also be dropped at delivery time even though it bypassed the
    // broadcast() guard.
    await h.bus.publish("updates", { type: "stray" }, SYSTEM_ORG_ID);
    await settle();

    expect(aCap.frames).toEqual([]);
    expect(bCap.frames).toEqual([]);

    await Promise.all([closeSocket(a), closeSocket(b)]);
  });

  test("strict mode: a tenant-scoped event reaches only that tenant's client", async () => {
    process.env["WS_TENANT_STRICT_MODE"] = "true";
    const a = await connect(h.port, TOKEN_A);
    const b = await connect(h.port, TOKEN_B);
    const aCap = collectFrames(a);
    const bCap = collectFrames(b);

    a.send(JSON.stringify({ type: "subscribe", channel: "updates" }));
    b.send(JSON.stringify({ type: "subscribe", channel: "updates" }));
    await settle();

    h.wsServer.broadcast("updates", { type: "alert_for_a", data: { id: "a-1" } }, ORG_A);
    await settle();

    const aGotIt = aCap.frames.some((f) => f["orgId"] === ORG_A && f["type"] === "alert_for_a");
    const bSawA = bCap.frames.some((f) => f["orgId"] === ORG_A);
    expect(aGotIt).toBe(true);
    expect(bSawA).toBe(false);
    expect(bCap.frames).toEqual([]);

    await Promise.all([closeSocket(a), closeSocket(b)]);
  });
});
