/**
 * GET /api/governance/model/lineage — optional limit/offset safety cap.
 *
 * Pins: (1) the no-param response is the full record set (back-compat for
 * the sole consumer, useGovernanceData.ts), (2) when limit/offset are
 * supplied the slice is applied to the createdAt-desc ordering while
 * `count` stays the pre-slice total (the provenance endpoint's `total`
 * convention), and (3) out-of-range params are rejected by the schema.
 *
 * The lineage source is a JSONL file whose path is read from
 * process.env.LINEAGE_FILE at module load of server/governance/lineage.ts,
 * so the env var MUST be set before the router is dynamically imported.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import type { Express, NextFunction, Request, Response } from "express";
import request from "supertest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let app: Express;
let fixtureDir: string;

beforeAll(async () => {
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "lineage-pagination-"));
  const lineageFile = path.join(fixtureDir, "lineage.jsonl");

  const { DEFAULT_ORG_ID } = await import("@shared/config/tenant");
  // Five base records, createdAt ascending; the route returns them
  // createdAt-DESC, so model-5 is first.
  const records = Array.from({ length: 5 }, (_, i) => ({
    modelId: `model-${i + 1}`,
    orgId: DEFAULT_ORG_ID,
    family: "lstm",
    profile: "default",
    version: i + 1,
    promotion: { stage: "dev" },
    predictionCount: 0,
    createdAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
  }));
  await fs.writeFile(lineageFile, `${records.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");

  process.env["LINEAGE_FILE"] = lineageFile;
  const express = (await import("express")).default;
  const governanceRouter = (await import("../../server/governance/routes")).default;
  const { ZodError } = await import("zod");

  app = express();
  app.use("/api/governance", governanceRouter);
  // The route forwards schema failures via next(error); mirror the app's
  // ZodError → 400 mapping so the validation contract is observable here.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, error: "Invalid query" });
    }
    return res.status(500).json({ success: false, error: "Internal error" });
  });
});

afterAll(async () => {
  delete process.env["LINEAGE_FILE"];
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

describe("GET /api/governance/model/lineage pagination", () => {
  it("returns the full set with the historical shape when no params are sent", async () => {
    const res = await request(app).get("/api/governance/model/lineage");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(5);
    expect(res.body.records).toHaveLength(5);
    expect(res.body.records[0].modelId).toBe("model-5");
  });

  it("applies limit while reporting the pre-slice total in count", async () => {
    const res = await request(app).get("/api/governance/model/lineage?limit=2");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(5);
    expect(res.body.records.map((r: { modelId: string }) => r.modelId)).toEqual([
      "model-5",
      "model-4",
    ]);
  });

  it("applies offset together with limit", async () => {
    const res = await request(app).get("/api/governance/model/lineage?limit=2&offset=2");
    expect(res.status).toBe(200);
    expect(res.body.records.map((r: { modelId: string }) => r.modelId)).toEqual([
      "model-3",
      "model-2",
    ]);
  });

  it("supports offset on its own", async () => {
    const res = await request(app).get("/api/governance/model/lineage?offset=4");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(5);
    expect(res.body.records.map((r: { modelId: string }) => r.modelId)).toEqual(["model-1"]);
  });

  it("rejects a limit above the 1000 cap", async () => {
    const res = await request(app).get("/api/governance/model/lineage?limit=2000");
    expect(res.status).toBe(400);
  });

  it("rejects a negative offset", async () => {
    const res = await request(app).get("/api/governance/model/lineage?offset=-1");
    expect(res.status).toBe(400);
  });
});
