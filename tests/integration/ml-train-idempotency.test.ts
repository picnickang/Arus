/**
 * Task 201 — Prove ML training replays return the same job.
 *
 * `POST /api/ml/train` is wrapped in `idempotencyMiddleware()` so that a
 * client that retries the same POST on a flaky network does NOT create
 * a second `ml_models` row OR enqueue a second background training job.
 *
 * Existing coverage (tests/unit/lr35-launch-readiness-wave.test.ts) is a
 * source-scan — it proves the middleware is mounted. This test proves
 * the *runtime* contract:
 *
 *   1. Two POSTs with the same `Idempotency-Key` return identical
 *      `{ modelId, jobId }` bodies and the mock queue's `enqueue` is
 *      called exactly once.
 *   2. A POST with a different key allocates a fresh `modelId` and
 *      triggers a second `enqueue` call.
 *
 * Strategy mirrors `ml-promote-two-person.test.ts`: mount `modelRoutes`
 * against a mocked `dbMlAnalyticsStorage` and a mocked `mlTrainingQueue`
 * so no real DB / worker pool is touched.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from "@jest/globals";
import type { Express, NextFunction, Request, Response } from "express";
import request from "supertest";

const ORG = "task201-org";

let createdModelIds: string[] = [];
const enqueueMock = jest.fn(async (job: Record<string, unknown>) => ({
  id: `job-${(job["modelId"] as string) ?? "x"}`,
}));

jest.unstable_mockModule("../../server/repositories", () => ({
  __esModule: true,
  dbMlAnalyticsStorage: {
    createMlModel: async (data: Record<string, unknown>, _orgId: string) => {
      const id = `model-${createdModelIds.length + 1}`;
      createdModelIds.push(id);
      return { id, ...data };
    },
    getMlModel: async () => null,
    getMlModels: async () => [],
    updateMlModel: async () => null,
  },
}));

jest.unstable_mockModule("../../server/ml-training-queue", () => ({
  __esModule: true,
  mlTrainingQueue: {
    enqueue: enqueueMock,
  },
}));

let app: Express;

beforeAll(async () => {
  const express = (await import("express")).default;
  const { modelRoutes } = (await import("../../server/ml-routes/model-routes")) as {
    modelRoutes: import("express").Router;
  };

  app = express();
  app.use(express.json());
  app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { orgId?: string; user?: unknown }).orgId = ORG;
    (req as Request & { user?: unknown }).user = {
      id: "tester",
      email: "tester@example.com",
      role: "admin",
      isActive: true,
      orgId: ORG,
    };
    next();
  });
  app.use("/api", modelRoutes);
});

beforeEach(() => {
  createdModelIds = [];
  enqueueMock.mockClear();
});

afterAll(() => {
  enqueueMock.mockReset();
});

const trainBody = {
  algorithm: "xgboost",
  equipmentType: "pump",
  dataWindowDays: 30,
};

function unwrap(body: unknown): { modelId: string; jobId: string } {
  const b = body as { data?: { modelId: string; jobId: string }; modelId?: string; jobId?: string };
  if (b.data && typeof b.data.modelId === "string") {
    return b.data;
  }
  return { modelId: b.modelId as string, jobId: b.jobId as string };
}

describe("Task 201 — /ml/train idempotent replay does not double-enqueue", () => {
  it("returns the same {modelId, jobId} and enqueues exactly once for replays with the same Idempotency-Key", async () => {
    const key = "task201-key-replay";

    const first = await request(app)
      .post("/api/ml/train")
      .set("Idempotency-Key", key)
      .send(trainBody);
    expect(first.status).toBe(200);
    const firstBody = unwrap(first.body);
    expect(firstBody.modelId).toBe("model-1");
    expect(firstBody.jobId).toBe("job-model-1");

    const second = await request(app)
      .post("/api/ml/train")
      .set("Idempotency-Key", key)
      .send(trainBody);
    expect(second.status).toBe(200);

    // The replay must hand back the EXACT cached response body so the
    // client's retry observes the same modelId/jobId it would have
    // observed on the original successful call.
    expect(second.body).toEqual(first.body);

    // Critical contract: the training queue is the side-effect that
    // makes a duplicate POST expensive. It must NOT be re-invoked on
    // the replay.
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(createdModelIds).toEqual(["model-1"]);
  });

  it("allocates a fresh modelId and re-enqueues when a different Idempotency-Key is used", async () => {
    const firstRes = await request(app)
      .post("/api/ml/train")
      .set("Idempotency-Key", "task201-key-A")
      .send(trainBody);
    expect(firstRes.status).toBe(200);
    const a = unwrap(firstRes.body);

    const secondRes = await request(app)
      .post("/api/ml/train")
      .set("Idempotency-Key", "task201-key-B")
      .send(trainBody);
    expect(secondRes.status).toBe(200);
    const b = unwrap(secondRes.body);

    expect(b.modelId).not.toBe(a.modelId);
    expect(b.jobId).not.toBe(a.jobId);
    expect(enqueueMock).toHaveBeenCalledTimes(2);
    expect(createdModelIds).toHaveLength(2);
  });
});
