/**
 * WS4 wave 0: the response-envelope middleware. Pins wrapping behavior on
 * migrated prefixes, error normalization with the legacy `message` mirror,
 * passthrough idempotence, exclusions, and the /api/v1 spelling.
 *
 * Also pins the EXCLUSION LIST: these are frozen device/edge/beacon contracts.
 * If this test fails because the list changed, make sure the change is a
 * deliberate, reviewed contract decision — then update the pin here.
 */

import { describe, it, expect } from "@jest/globals";
import express from "express";
import request from "supertest";
import { envelopeJson, normalizeErrorBody } from "../../server/middleware/envelope";
import {
  ENVELOPE_EXCLUDED_PREFIXES,
  isEnvelopedPath,
} from "../../server/lib/envelope-manifest";
import {
  errorEnvelopeSchema,
  successEnvelopeSchema,
} from "../../shared/api-envelope";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", envelopeJson());

  app.get("/api/home/attention-summary", (_req, res) => {
    res.json({ alerts: 3, workOrders: 7 });
  });
  app.get("/api/home/list", (_req, res) => {
    res.json([1, 2, 3]);
  });
  app.get("/api/home/paginated", (_req, res) => {
    res.json({ data: [{ id: 1 }], pagination: { page: 1, limit: 50 } });
  });
  app.get("/api/home/already-enveloped", (_req, res) => {
    res.json({ success: true, data: { fromHelper: true } });
  });
  app.get("/api/home/legacy-error", (_req, res) => {
    res.status(404).json({ message: "Summary not found" });
  });
  app.get("/api/home/nested-error", (_req, res) => {
    res.status(409).json({ error: { code: "CONFLICT", message: "Version conflict" } });
  });
  app.get("/api/home/zod-error", (_req, res) => {
    res.status(400).json({
      message: "Validation error",
      errors: [{ path: ["name"], message: "Required" }],
    });
  });
  app.delete("/api/home/gone", (_req, res) => {
    res.status(204).send();
  });
  // Fictional prefix: stays outside the manifest no matter how many waves land.
  app.get("/api/unmigrated-test-domain", (_req, res) => {
    res.json([{ id: "raw-1" }]);
  });

  return app;
}

describe("envelopeJson (WS4 wave 0)", () => {
  it("wraps 2xx object bodies on migrated prefixes", async () => {
    const res = await request(buildApp()).get("/api/home/attention-summary");
    expect(res.body).toEqual({ success: true, data: { alerts: 3, workOrders: 7 } });
    expect(successEnvelopeSchema.safeParse(res.body).success).toBe(true);
  });

  it("wraps top-level arrays", async () => {
    const res = await request(buildApp()).get("/api/home/list");
    expect(res.body).toEqual({ success: true, data: [1, 2, 3] });
  });

  it("wraps paginated bodies hook-transparently", async () => {
    const res = await request(buildApp()).get("/api/home/paginated");
    expect(res.body.success).toBe(true);
    expect(res.body.data.pagination.page).toBe(1);
  });

  it("passes through already-enveloped bodies (no double wrap)", async () => {
    const res = await request(buildApp()).get("/api/home/already-enveloped");
    expect(res.body).toEqual({ success: true, data: { fromHelper: true } });
  });

  it("normalizes legacy {message} errors with the top-level mirrors", async () => {
    const res = await request(buildApp()).get("/api/home/legacy-error");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toBe("Summary not found");
    expect(res.body.message).toBe("Summary not found");
    expect(res.body.code).toBe("NOT_FOUND");
    expect(errorEnvelopeSchema.safeParse(res.body).success).toBe(true);
  });

  it("keeps codes from nested error bodies", async () => {
    const res = await request(buildApp()).get("/api/home/nested-error");
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.message).toBe("Version conflict");
  });

  it("carries Zod issues into error.details", async () => {
    const res = await request(buildApp()).get("/api/home/zod-error");
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.details).toEqual([{ path: ["name"], message: "Required" }]);
    expect(errorEnvelopeSchema.safeParse(res.body).success).toBe(true);
  });

  it("leaves 204 responses untouched", async () => {
    const res = await request(buildApp()).delete("/api/home/gone");
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("never wraps attachment downloads served via res.json", async () => {
    const app = express();
    app.use("/api", envelopeJson());
    app.get("/api/home/export", (_req, res) => {
      res.setHeader("Content-Disposition", "attachment; filename=export.json");
      res.json([{ id: "task-1" }]);
    });
    const res = await request(app).get("/api/home/export");
    expect(res.body).toEqual([{ id: "task-1" }]);
  });

  it("does not wrap paths outside the manifest", async () => {
    const res = await request(buildApp()).get("/api/unmigrated-test-domain");
    expect(res.body).toEqual([{ id: "raw-1" }]);
  });

  it("treats /api/v1 spellings the same as unversioned paths", () => {
    expect(isEnvelopedPath("/api/v1/home/attention-summary")).toBe(true);
    expect(isEnvelopedPath("/api/home/attention-summary?since=x")).toBe(true);
    expect(isEnvelopedPath("/api/homeX/other")).toBe(false);
  });

  it("wave 1 domains are enveloped end to end", async () => {
    expect(isEnvelopedPath("/api/equipment/eq-1")).toBe(true);
    expect(isEnvelopedPath("/api/vessels")).toBe(true);
    expect(isEnvelopedPath("/api/pdm/dashboard")).toBe(true);
    expect(isEnvelopedPath("/api/optimization/results")).toBe(true);

    const app = express();
    app.use("/api", envelopeJson());
    app.get("/api/vessels", (_req, res) => {
      res.json([{ id: "v-1", name: "MV Test" }]);
    });
    const res = await request(app).get("/api/vessels");
    expect(res.body).toEqual({ success: true, data: [{ id: "v-1", name: "MV Test" }] });
  });

  it("double mounts wrap exactly once", async () => {
    const app = express();
    app.use("/api", envelopeJson());
    app.use("/api", envelopeJson());
    app.get("/api/home/x", (_req, res) => {
      res.json({ ok: true });
    });
    const res = await request(app).get("/api/home/x");
    expect(res.body).toEqual({ success: true, data: { ok: true } });
  });

  it("normalizeErrorBody falls back sanely for unknown shapes", () => {
    const body = normalizeErrorBody(500, undefined);
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.message).toBe("Request failed");
  });
});

describe("envelope exclusions (frozen contracts)", () => {
  it("pins the exclusion list — see header comment before editing", () => {
    expect([...ENVELOPE_EXCLUDED_PREFIXES].sort()).toEqual(
      [
        "/api/agent",
        "/api/diagnostics/health",
        "/api/docs",
        "/api/edge",
        "/api/error-logs",
        "/api/health",
        "/api/healthz",
        "/api/observability/web-vitals",
        "/api/openapi.json",
        "/api/telemetry/bulk",
        "/api/telemetry/readings",
      ].sort()
    );
  });

  it("excluded paths are never enveloped, even under an /api-wide flip", () => {
    for (const prefix of ENVELOPE_EXCLUDED_PREFIXES) {
      expect(isEnvelopedPath(prefix)).toBe(false);
      expect(isEnvelopedPath(`${prefix}/sub-path`)).toBe(false);
    }
  });
});
