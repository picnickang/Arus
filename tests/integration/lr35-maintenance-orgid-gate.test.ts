/**
 * LR-3.5 / TEN-1 — orgId gate on /api/maintenance-schedules.
 *
 * Prior to this cluster, the list endpoint had no `requireOrgId` and
 * the service call dropped orgId entirely, returning schedules from
 * every tenant. This file pins the contract that every verb on
 * `/api/maintenance-schedules*` rejects callers with no resolved
 * tenant context (401), and that authenticated callers WITHOUT an
 * `orgId` claim also get 401 with the canonical `TENANT_CLAIM_MISSING`
 * code (the `requireOrgId` middleware's own error code).
 *
 * We do not test happy-path inserts here — that is covered by the
 * `tests/integration/forms/maintenance.test.ts` lifecycle suite. This
 * file only proves the gate.
 *
 * Same ESM-mock pattern used by the rest of the LR-3.5 cluster:
 * stub the maintenance service and the rate-limit middleware so the
 * routes module can mount cleanly without booting the real DB pool.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import type { Express, NextFunction, Request, Response } from "express";
import request from "supertest";

const passthrough = (_req: Request, _res: Response, next: NextFunction) => next();

// Stub the maintenance service so route module construction doesn't
// boot the real DB pool. The role gate runs before any service call,
// so empty stubs are sufficient for negative-path testing.
jest.unstable_mockModule("../../server/domains/maintenance/service", () => ({
  __esModule: true,
  maintenanceService: {
    listSchedules: jest.fn(async () => []),
    getUpcomingSchedules: jest.fn(async () => []),
    getScheduleById: jest.fn(async () => null),
    createSchedule: jest.fn(async (data: unknown) => ({ id: "new-id", ...(data as object) })),
    updateSchedule: jest.fn(async () => ({ id: "id", updated: true })),
    deleteSchedule: jest.fn(async () => undefined),
    autoSchedule: jest.fn(async () => ({ scheduled: true })),
    listTemplates: jest.fn(async () => []),
    createTemplate: jest.fn(async () => ({ id: "t-id" })),
    updateTemplate: jest.fn(async () => ({ id: "t-id" })),
    deleteTemplate: jest.fn(async () => undefined),
  },
}));

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  const express = (await import("express")).default;
  app = express();
  app.use(express.json());

  // Optional auth shim — `x-test-user` "userId:role[:orgId]". If
  // `orgId` is omitted, requireOrgId should reject with
  // TENANT_CLAIM_MISSING (when REQUIRE_TENANT_AUTH is on) OR fall
  // back to DEFAULT_ORG_ID (when off, legacy single-tenant). The
  // unauth case (no header at all) is the primary contract this
  // file pins — 401 UNAUTHENTICATED.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const hdr = req.headers["x-test-user"];
    const value = Array.isArray(hdr) ? hdr[0] : hdr;
    if (value && typeof value === "string") {
      const [id, role, orgId] = value.split(":");
      (req as Request & { user?: unknown }).user = {
        id,
        email: `${id}@test.local`,
        role,
        isActive: true,
        ...(orgId ? { orgId } : {}),
      };
    }
    next();
  });

  try {
    const mod = (await import("../../server/domains/maintenance/interfaces/routes")) as {
      registerMaintenanceRoutes?: (
        app: Express,
        rateLimit: {
          writeOperationRateLimit: import("express").RequestHandler;
          criticalOperationRateLimit: import("express").RequestHandler;
          generalApiRateLimit: import("express").RequestHandler;
        }
      ) => void;
    };
    if (typeof mod.registerMaintenanceRoutes !== "function") {
      mountError = "registerMaintenanceRoutes not exported from maintenance routes module";
      return;
    }
    mod.registerMaintenanceRoutes(app, {
      writeOperationRateLimit: passthrough,
      criticalOperationRateLimit: passthrough,
      generalApiRateLimit: passthrough,
    });
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

describe("LR-3.5 TEN-1 — /api/maintenance-schedules orgId gate", () => {
  it("maintenance routes mounted", () => {
    expect(mountError).toBeUndefined();
  });

  describe.each([
    ["GET", "/api/maintenance-schedules"],
    ["GET", "/api/maintenance-schedules/upcoming"],
    ["GET", "/api/maintenance-schedules/some-id"],
  ] as const)("%s %s", (method, path) => {
    it("rejects unauthenticated request with 401 UNAUTHENTICATED", async () => {
      if (mountError) throw new Error(mountError);
      const res = await request(app)[method.toLowerCase() as "get"](path);
      expect(res.status).toBe(401);
      expect(res.body?.code).toBe("UNAUTHENTICATED");
    });
  });

  describe.each([
    ["POST", "/api/maintenance-schedules", { equipmentId: "eq-1", type: "preventive" }],
    [
      "PUT",
      "/api/maintenance-schedules/some-id",
      { description: "x" },
    ],
    ["DELETE", "/api/maintenance-schedules/some-id", undefined],
    ["POST", "/api/maintenance-schedules/auto-schedule/eq-1", { pdmScore: 50 }],
  ] as const)("%s %s", (method, path, body) => {
    it("rejects unauthenticated request with 401 UNAUTHENTICATED", async () => {
      if (mountError) throw new Error(mountError);
      const req = request(app)[method.toLowerCase() as "post"](path);
      const res = body ? await req.send(body) : await req.send();
      expect(res.status).toBe(401);
      expect(res.body?.code).toBe("UNAUTHENTICATED");
    });
  });

  // TEN-1 second contract: an AUTHENTICATED caller with no resolved
  // org claim. The `requireOrgId` middleware does the resolution; in
  // legacy mode it falls back to DEFAULT_ORG_ID, in strict tenant
  // mode it returns 401 TENANT_CLAIM_MISSING. We assert BOTH paths
  // deterministically by toggling `REQUIRE_TENANT_AUTH` per-call via
  // `process.env`, then restoring afterwards.
  describe("authenticated request with no orgId claim", () => {
    const originalFlag = process.env['REQUIRE_TENANT_AUTH'];
    afterAll(() => {
      if (originalFlag === undefined) delete process.env['REQUIRE_TENANT_AUTH'];
      else process.env['REQUIRE_TENANT_AUTH'] = originalFlag;
    });

    it("strict mode (REQUIRE_TENANT_AUTH=true) returns 401 TENANT_CLAIM_MISSING on GET list", async () => {
      if (mountError) throw new Error(mountError);
      process.env['REQUIRE_TENANT_AUTH'] = "true";
      const res = await request(app)
        .get("/api/maintenance-schedules")
        // valid user, NO orgId segment
        .set("x-test-user", "u-1:chief_engineer");
      expect(res.status).toBe(401);
      expect(res.body?.code).toBe("TENANT_CLAIM_MISSING");
    });

    it("strict mode returns 401 TENANT_CLAIM_MISSING on POST create", async () => {
      if (mountError) throw new Error(mountError);
      process.env['REQUIRE_TENANT_AUTH'] = "true";
      const res = await request(app)
        .post("/api/maintenance-schedules")
        .set("x-test-user", "u-1:chief_engineer")
        .send({ equipmentId: "eq-1", type: "preventive" });
      expect(res.status).toBe(401);
      expect(res.body?.code).toBe("TENANT_CLAIM_MISSING");
    });

    it("legacy mode (REQUIRE_TENANT_AUTH unset) accepts the request and resolves DEFAULT_ORG_ID (no TENANT_CLAIM_MISSING)", async () => {
      if (mountError) throw new Error(mountError);
      delete process.env['REQUIRE_TENANT_AUTH'];
      const res = await request(app)
        .get("/api/maintenance-schedules")
        .set("x-test-user", "u-1:chief_engineer");
      // Either passes (200) or hits an unrelated downstream — but the
      // org-claim gate must NOT fire.
      expect(res.body?.code).not.toBe("TENANT_CLAIM_MISSING");
      expect(res.status).not.toBe(401);
    });
  });
});
