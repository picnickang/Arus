/**
 * LR-1D — Two-person rule for ML model promotion.
 *
 * Covers four contracts on `/api/ml/models/:id/promote`:
 *   1. The endpoint is gated by `requireRole("admin", "chief_engineer")`
 *      — a non-admin caller is rejected with 403 before any state change.
 *   2. The promote call without a prior `/promote/request` is rejected
 *      with 412 (`PROMOTION_APPROVAL_MISSING`) — auto-approval is OFF.
 *   3. The promote call by the same user who proposed it is rejected
 *      with 412 (`PROMOTION_SELF_APPROVAL_FORBIDDEN`) — two-person rule.
 *   4. Proposer → distinct approver succeeds, the candidate is marked
 *      `deployed`, and the previously-deployed model is archived.
 *
 * The test owns the ML storage interface (no real DB needed) by
 * monkey-patching `dbMlAnalyticsStorage` before mounting the router.
 * That keeps the suite fast and decoupled from RLS / pinned-tx wiring,
 * which are covered separately in tests/integration/rls-cross-tenant-*.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import type { Express, NextFunction, Request, Response } from "express";
import request from "supertest";

type MlModelRow = {
  id: string;
  orgId: string;
  status: string;
  equipmentType: string | null;
  deployedOn: Date | null;
  archivedOn: Date | null;
};

const ORG = "lr1d-org";
const EQUIP_TYPE = "pump";

// Mutable in-memory model store the test owns. The mock storage below
// reads/writes through this Map so assertions can introspect end state.
const store = new Map<string, MlModelRow>();

function seedModel(id: string, status: string): MlModelRow {
  const row: MlModelRow = {
    id,
    orgId: ORG,
    status,
    equipmentType: EQUIP_TYPE,
    deployedOn: status === "deployed" ? new Date() : null,
    archivedOn: null,
  };
  store.set(id, row);
  return row;
}

// ESM-compatible module mock — `jest.mock` doesn't hoist under
// `--experimental-vm-modules`. The route module is dynamically imported
// in beforeAll so this mock takes effect before resolution.
jest.unstable_mockModule("../../server/repositories", () => ({
  __esModule: true,
  dbMlAnalyticsStorage: {
    getMlModel: async (id: string, orgId: string) => {
      const r = store.get(id);
      if (!r || r.orgId !== orgId) {
        return null;
      }
      return { ...r };
    },
    getMlModels: async (orgId: string) =>
      [...store.values()].filter((r) => r.orgId === orgId).map((r) => ({ ...r })),
    updateMlModel: async (id: string, patch: Partial<MlModelRow>, orgId: string) => {
      const r = store.get(id);
      if (!r || r.orgId !== orgId) {
        return null;
      }
      const next = { ...r, ...patch };
      store.set(id, next);
      return { ...next };
    },
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

  // Test-only auth shim — attaches a fake user from `x-test-user` headers.
  // Format: "userId:role".  Missing header → unauthenticated.
  app.use("/api", (req: Request, _res: Response, next: NextFunction) => {
    const hdr = req.headers["x-test-user"];
    const value = Array.isArray(hdr) ? hdr[0] : hdr;
    if (value && typeof value === "string") {
      const [id, role] = value.split(":");
      (req as Request & { user?: unknown; orgId?: string }).user = {
        id,
        email: `${id}@example.com`,
        role,
        isActive: true,
        orgId: ORG,
      };
      (req as Request & { orgId?: string }).orgId = ORG;
    }
    next();
  });

  app.use("/api", modelRoutes);
});

afterAll(() => {
  store.clear();
});

describe("LR-1D — ML promotion two-person rule", () => {
  it("rejects a non-admin/non-chief_engineer caller with 403", async () => {
    seedModel("model-403", "trained");

    const res = await request(app)
      .post("/api/ml/models/model-403/promote/request")
      .set("x-test-user", "viewer-1:second_officer")
      .send();

    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("rejects promote without a prior approval token (412 PROMOTION_APPROVAL_MISSING)", async () => {
    seedModel("model-naked", "trained");

    const res = await request(app)
      .post("/api/ml/models/model-naked/promote")
      .set("x-test-user", "admin-1:admin")
      .set("Idempotency-Key", "lr1d-promote-naked-1")
      .send({ approvalToken: "made-up-token" });

    expect(res.status).toBe(412);
    expect(res.body?.code).toBe("PROMOTION_APPROVAL_MISSING");
    expect(store.get("model-naked")?.status).toBe("trained");
  });

  it("rejects self-approval: proposer cannot also approve (412 PROMOTION_SELF_APPROVAL_FORBIDDEN)", async () => {
    seedModel("model-self", "trained");

    const reqRes = await request(app)
      .post("/api/ml/models/model-self/promote/request")
      .set("x-test-user", "admin-self:admin")
      .send();
    expect(reqRes.status).toBe(200);
    const token = (reqRes.body?.data ?? reqRes.body)?.approvalToken as string;
    expect(typeof token).toBe("string");

    const promoteRes = await request(app)
      .post("/api/ml/models/model-self/promote")
      .set("x-test-user", "admin-self:admin")
      .set("Idempotency-Key", "lr1d-promote-self-1")
      .send({ approvalToken: token });

    expect(promoteRes.status).toBe(412);
    expect(promoteRes.body?.code).toBe("PROMOTION_SELF_APPROVAL_FORBIDDEN");
    expect(store.get("model-self")?.status).toBe("trained");
  });

  it("proposer + distinct approver succeeds and archives the previous deployed model", async () => {
    seedModel("model-prev", "deployed");
    seedModel("model-new", "trained");

    const reqRes = await request(app)
      .post("/api/ml/models/model-new/promote/request")
      .set("x-test-user", "alice:admin")
      .send();
    expect(reqRes.status).toBe(200);
    const token = (reqRes.body?.data ?? reqRes.body)?.approvalToken as string;
    expect(typeof token).toBe("string");

    const promoteRes = await request(app)
      .post("/api/ml/models/model-new/promote")
      .set("x-test-user", "bob:chief_engineer")
      .set("Idempotency-Key", "lr1d-promote-new-1")
      .send({ approvalToken: token });

    expect(promoteRes.status).toBe(200);
    const body = (promoteRes.body?.data ?? promoteRes.body) as {
      proposerUserId: string;
      approverUserId: string;
      replaced: string[];
    };
    expect(body.proposerUserId).toBe("alice");
    expect(body.approverUserId).toBe("bob");
    expect(body.replaced).toContain("model-prev");

    expect(store.get("model-new")?.status).toBe("deployed");
    expect(store.get("model-prev")?.status).toBe("archived");

    // Token is single-use: a second call with the same token is rejected.
    const replay = await request(app)
      .post("/api/ml/models/model-new/promote")
      .set("x-test-user", "carol:admin")
      .set("Idempotency-Key", "lr1d-promote-new-replay-1")
      .send({ approvalToken: token });
    expect(replay.status).toBe(412);
    expect(replay.body?.code).toBe("PROMOTION_APPROVAL_MISSING");
  });
});

/**
 * LR-3.5 / V1 — broader admin-gate verification across promote/request,
 * promote, and rollback. The two-person test above already pins one row
 * (viewer/second_officer on promote/request). This block widens the
 * matrix and adds an unauthenticated 401 row + a wrong-role rollback
 * row so a regression on any of the three gates fails loudly.
 */
describe("LR-3.5 V1 — ML promote/rollback role gate", () => {
  const WRONG_ROLE_ROWS: Array<{
    label: string;
    path: string;
    role: string;
    idemKey: string;
  }> = [
    {
      label: "promote rejects viewer",
      path: "/api/ml/models/model-gate-1/promote",
      role: "viewer",
      idemKey: "lr35-v1-promote-viewer",
    },
    {
      label: "rollback rejects able_seaman",
      path: "/api/ml/models/model-gate-1/rollback",
      role: "able_seaman",
      idemKey: "lr35-v1-rollback-ab",
    },
    {
      label: "promote/request rejects third_officer",
      path: "/api/ml/models/model-gate-1/promote/request",
      role: "third_officer",
      idemKey: "lr35-v1-req-3rd",
    },
  ];

  for (const row of WRONG_ROLE_ROWS) {
    it(`${row.label} with 403 INSUFFICIENT_PERMISSIONS`, async () => {
      seedModel("model-gate-1", "trained");
      const res = await request(app)
        .post(row.path)
        .set("x-test-user", `wrong-${row.role}:${row.role}`)
        .set("Idempotency-Key", row.idemKey)
        .send({});
      expect(res.status).toBe(403);
      expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  }

  it("unauthenticated promote is rejected with 401 AUTH_REQUIRED", async () => {
    seedModel("model-gate-1", "trained");
    const res = await request(app)
      .post("/api/ml/models/model-gate-1/promote")
      .set("Idempotency-Key", "lr35-v1-unauth-promote")
      .send({});
    expect(res.status).toBe(401);
    expect(res.body?.code).toBe("AUTH_REQUIRED");
  });

  it("chief_engineer is NOT rejected by the gate (positive control)", async () => {
    // Chief engineer is in `requireRole("admin", "chief_engineer")` so
    // the gate must let them through. Body is empty, so the handler
    // will fail downstream — but it must NOT be the role gate.
    const res = await request(app)
      .post("/api/ml/models/model-gate-1/promote/request")
      .set("x-test-user", "chief-1:chief_engineer")
      .set("Idempotency-Key", "lr35-v1-chief-passes")
      .send({});
    expect(res.status).not.toBe(403);
    if (res.status >= 400) {
      expect(res.body?.code).not.toBe("INSUFFICIENT_PERMISSIONS");
    }
  });
});
