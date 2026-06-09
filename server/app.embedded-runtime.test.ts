import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

import { createTestApp } from "./app.js";

process.env["EMBEDDED_MODE"] ||= "true";
process.env["LOCAL_MODE"] ||= "true";
process.env["DISABLE_BACKGROUND_WORKERS"] ||= "true";
process.env["NODE_ENV"] ||= "test";

describe("embedded runtime app bootstrap", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  }, 60000);

  it("serves public health endpoints after embedded SQLite initialization", async () => {
    const health = await request(app).get("/api/healthz");

    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({
      status: "ok",
    });
  });

  it("serves readiness without a production database or live external service", async () => {
    const ready = await request(app)
      .get("/api/readyz")
      .set("x-org-id", "default-org-id")
      .set("x-user-id", "coverage-runtime-user")
      .set("x-user-role", "admin");

    expect([200, 207]).toContain(ready.status);
    expect(ready.body).toMatchObject({
      checks: {
        database: {
          status: "ok",
          type: "SQLite",
        },
      },
      databaseType: "SQLite",
    });
    expect(["ready", "degraded"]).toContain(ready.body.status);
  });
});
