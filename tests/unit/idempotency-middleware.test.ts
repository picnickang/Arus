/**
 * WS1: idempotency middleware behavior — header/body key sources, the
 * L1 (memory) and L2 (durable repository) lookup chain, request-hash reuse
 * detection, the claim marker that lets broad per-family mounts compose with
 * older per-route mounts, and absolute-path key construction.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import express from "express";
import request from "supertest";

const getStoredResponse = jest.fn<(key: string) => Promise<unknown>>();
const storeResponse = jest.fn<(entry: Record<string, unknown>) => Promise<void>>();
const deleteExpiredResponses = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("../../server/storage/idempotency-repository", () => ({
  getStoredResponse,
  storeResponse,
  deleteExpiredResponses,
  // Deterministic stand-in: same key+body → same hash, different body → different hash.
  hashIdempotentRequest: (fullKey: string, body: unknown) =>
    `${fullKey}|${JSON.stringify(body ?? null)}`,
}));

jest.unstable_mockModule("../../server/middleware/auth", () => ({
  authenticatedRequest: (req: { headers: Record<string, string | undefined> }) => ({
    orgId: req.headers["x-org-id"],
  }),
}));

jest.unstable_mockModule("../../server/utils/logger", () => ({
  logger: { info: () => undefined, warn: () => undefined, debug: () => undefined },
}));

const { idempotencyMiddleware, _internals } = await import("../../server/middleware/idempotency");

function buildApp(options?: { required?: boolean; doubleMount?: boolean }) {
  const app = express();
  app.use(express.json());
  const handler = jest.fn((req: express.Request, res: express.Response) => {
    res.status(201).json({ created: true, echo: req.body });
  });

  const middlewares = [idempotencyMiddleware(options)];
  if (options?.doubleMount) {
    middlewares.push(idempotencyMiddleware());
  }
  // Path-prefix mount mirrors how bootstrap mounts per-family middleware.
  app.use("/api/work-orders", ...middlewares);
  app.post("/api/work-orders/:id/parts", handler);
  return { app, handler };
}

beforeEach(() => {
  _internals.processedKeys.clear();
  getStoredResponse.mockReset().mockResolvedValue(undefined);
  storeResponse.mockReset().mockResolvedValue(undefined);
});

describe("idempotencyMiddleware (WS1)", () => {
  it("passes through without a key (optional mode)", async () => {
    const { app, handler } = buildApp();
    const res = await request(app).post("/api/work-orders/1/parts").send({ a: 1 });
    expect(res.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(storeResponse).not.toHaveBeenCalled();
  });

  it("rejects when required and no key is provided", async () => {
    const { app, handler } = buildApp({ required: true });
    const res = await request(app).post("/api/work-orders/1/parts").send({ a: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("requires org context once a key is present", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .send({ a: 1 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("ORG_CONTEXT_REQUIRED");
  });

  it("replays the cached response for a repeated key without re-running the handler", async () => {
    const { app, handler } = buildApp();
    const first = await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "impeller" });
    const second = await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "impeller" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("accepts the key from body.clientMutationId", async () => {
    const { app, handler } = buildApp();
    const payload = { part: "seal", clientMutationId: "client-mutation:abc" };
    await request(app)
      .post("/api/work-orders/1/parts")
      .set("x-org-id", "org-1")
      .send(payload);
    await request(app)
      .post("/api/work-orders/1/parts")
      .set("x-org-id", "org-1")
      .send(payload);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the same key is reused with a different body", async () => {
    const { app } = buildApp();
    await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "impeller" });
    const reused = await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "completely different" });
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("persists successful responses durably with an absolute-path key", async () => {
    const { app } = buildApp();
    await request(app)
      .post("/api/work-orders/42/parts")
      .set("Idempotency-Key", "key-9")
      .set("x-org-id", "org-1")
      .send({ part: "gasket" });

    expect(storeResponse).toHaveBeenCalledTimes(1);
    const entry = storeResponse.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry["fullKey"]).toBe("org-1:POST:/api/work-orders/42/parts:key-9");
    expect(entry["statusCode"]).toBe(201);
    expect(entry["orgId"]).toBe("org-1");
    expect(entry["idempotencyKey"]).toBe("key-9");
  });

  it("serves a durable (L2) hit without re-running the handler — restart survival", async () => {
    const fullKey = "org-1:POST:/api/work-orders/1/parts:key-1";
    getStoredResponse.mockResolvedValue({
      statusCode: 201,
      body: { created: true, fromDurableStore: true },
      requestHash: `${fullKey}|${JSON.stringify({ part: "impeller" })}`,
    });

    const { app, handler } = buildApp();
    const res = await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "impeller" });

    expect(res.status).toBe(201);
    expect(res.body.fromDurableStore).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    // L1 warmed: the next hit doesn't touch the repository again.
    getStoredResponse.mockClear();
    await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "impeller" });
    expect(getStoredResponse).not.toHaveBeenCalled();
  });

  it("detects key reuse against the durable hash too", async () => {
    const fullKey = "org-1:POST:/api/work-orders/1/parts:key-1";
    getStoredResponse.mockResolvedValue({
      statusCode: 201,
      body: { created: true },
      requestHash: `${fullKey}|${JSON.stringify({ part: "original" })}`,
    });

    const { app } = buildApp();
    const res = await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "tampered" });
    expect(res.status).toBe(409);
  });

  it("proceeds normally when the durable lookup fails (availability over strictness)", async () => {
    getStoredResponse.mockRejectedValue(new Error("db unavailable"));
    const { app, handler } = buildApp();
    const res = await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "impeller" });
    expect(res.status).toBe(201);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stacked mounts process the request exactly once (claim marker)", async () => {
    const { app, handler } = buildApp({ doubleMount: true });
    await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "impeller" });
    const replay = await request(app)
      .post("/api/work-orders/1/parts")
      .set("Idempotency-Key", "key-1")
      .set("x-org-id", "org-1")
      .send({ part: "impeller" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(replay.status).toBe(201);
    expect(_internals.processedKeys.size).toBe(1);
    expect(storeResponse).toHaveBeenCalledTimes(1);
  });
});
