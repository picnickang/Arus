/**
 * LR-3.5 / V1 — admin-gate verification on the PDM parallel paths:
 *   POST /api/pdm/training/runs/:id/promote
 *   POST /api/pdm/models/deployments/:deploymentId/rollback
 *
 * Both routes already declare `requireRole("admin", "chief_engineer")`.
 * This file pins that contract: wrong-role callers get 403, unauth
 * callers get 401, and a chief_engineer caller passes the gate (the
 * downstream handler may 4xx/5xx for other reasons but MUST NOT 403).
 *
 * Uses `jest.unstable_mockModule` (the swc-jest + ESM equivalent of
 * `jest.mock` with hoisting) to stub the adapter/service classes so
 * they never construct a real drizzle pg-node client at module load.
 */

import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import type { Express, NextFunction, Request, Response } from "express";
import request from "supertest";

const ORG = "test-org-pdm-gate";

// Stub the adapter/service classes the route modules instantiate at
// import time. The role gate runs ahead of every handler so an empty
// stub is sufficient — wrong-role rejections never reach these.
jest.unstable_mockModule("../../server/domains/pdm-platform/model-registry/adapter", () => ({
  __esModule: true,
  ModelRegistryAdapter: class {
    async rollback() { return { id: 0, status: "rolled_back" }; }
    async deploy() { return { id: 0, status: "deployed" }; }
    async listDeployments() { return []; }
    async getVersion() { return null; }
    async listVersions() { return []; }
    async createVersion() { return { id: "v", version: "0.0.1" }; }
  },
}));

jest.unstable_mockModule("../../server/domains/pdm-platform/training-pipeline/training-pipeline.service", () => ({
  __esModule: true,
  TrainingPipelineService: class {
    async promoteModelVersion() { return { id: "promoted" }; }
    async createDataset() { return { id: "ds" }; }
    async startRun() { return { id: "run" }; }
    async getRun() { return null; }
    async listRuns() { return []; }
    async getDataset() { return null; }
    async listDatasets() { return []; }
  },
}));

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  const express = (await import("express")).default;
  app = express();
  app.use(express.json());

  // Auth shim — `x-test-user` "userId:role". Always attaches orgId
  // because both PDM routers expect `req.orgId` to be set upstream
  // by `requireOrgId`.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const hdr = req.headers["x-test-user"];
    const value = Array.isArray(hdr) ? hdr[0] : hdr;
    if (value && typeof value === "string") {
      const [id, role] = value.split(":");
      (req as Request & { user?: unknown; orgId?: string }).user = {
        id,
        email: `${id}@test.local`,
        role,
        isActive: true,
        orgId: ORG,
      };
      (req as Request & { orgId?: string }).orgId = ORG;
    }
    next();
  });

  try {
    const trainingMod = (await import("../../server/domains/pdm-platform/training-pipeline/routes")) as {
      trainingPipelineRouter?: import("express").Router;
    };
    const registryMod = (await import("../../server/domains/pdm-platform/model-registry/routes")) as {
      modelRegistryRouter?: import("express").Router;
    };
    const trainingRouter = trainingMod.trainingPipelineRouter;
    const registryRouter = registryMod.modelRegistryRouter;
    if (!trainingRouter) {
      mountError = "training-pipeline routes trainingPipelineRouter export missing";
      return;
    }
    if (!registryRouter) {
      mountError = "model-registry routes modelRegistryRouter export missing";
      return;
    }
    app.use("/api/pdm/training", trainingRouter);
    app.use("/api/pdm/models", registryRouter);
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

describe("LR-3.5 V1 — PDM promote/rollback role gate", () => {
  it("PDM routers mounted successfully", () => {
    expect(mountError).toBeUndefined();
  });

  it("training promote rejects viewer with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/pdm/training/runs/run-1/promote")
      .set("x-test-user", "wrong-viewer:viewer")
      .send({ modelId: "m1", version: "0.0.1" });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("training promote rejects second_officer with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/pdm/training/runs/run-1/promote")
      .set("x-test-user", "wrong-so:second_officer")
      .send({ modelId: "m1", version: "0.0.1" });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("training promote rejects unauthenticated with 401", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/pdm/training/runs/run-1/promote")
      .send({ modelId: "m1", version: "0.0.1" });
    expect(res.status).toBe(401);
    expect(res.body?.code).toBe("AUTH_REQUIRED");
  });

  it("deployment rollback rejects able_seaman with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/pdm/models/deployments/42/rollback")
      .set("x-test-user", "wrong-ab:able_seaman")
      .send({});
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("deployment rollback rejects cook with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/pdm/models/deployments/42/rollback")
      .set("x-test-user", "wrong-cook:cook")
      .send({});
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("deployment rollback rejects unauthenticated with 401", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/pdm/models/deployments/42/rollback")
      .send({});
    expect(res.status).toBe(401);
    expect(res.body?.code).toBe("AUTH_REQUIRED");
  });

  it("chief_engineer is NOT rejected by the training-promote gate (positive control)", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/pdm/training/runs/run-1/promote")
      .set("x-test-user", "chief-1:chief_engineer")
      .send({ modelId: "m1", version: "0.0.1" });
    expect(res.status).not.toBe(403);
    if (res.status >= 400) {
      expect(res.body?.code).not.toBe("INSUFFICIENT_PERMISSIONS");
    }
  });

  it("admin is NOT rejected by the rollback gate (positive control)", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/pdm/models/deployments/42/rollback")
      .set("x-test-user", "admin-1:admin")
      .send({});
    expect(res.status).not.toBe(403);
    if (res.status >= 400) {
      expect(res.body?.code).not.toBe("INSUFFICIENT_PERMISSIONS");
    }
  });
});
