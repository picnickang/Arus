/**
 * Task #217 — admin-portal gate on the Command Queue (Attention Inbox).
 *
 * `/api/attention/*` is now `requireRole(...ADMIN_PORTAL_ROLES)` on top
 * of the existing `requireOrgId`. This file pins:
 *   - user-portal roles (deck_officer, viewer) → 403
 *   - unauthenticated → 401
 *   - admin-portal roles (chief_engineer, captain, system_admin, admin,
 *     fleet_manager, company_admin) → NOT 403
 *
 * Pattern mirrors `lr35-pdm-promote-rollback-gate.test.ts`: an empty
 * adapter stub so the role gate runs before any real I/O.
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import request from "supertest";

const ORG = "test-org-attention-gate";

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  const express = (await import("express")).default;
  app = express();
  app.use(express.json());

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

  const passthrough: RequestHandler = (_req, _res, next) => next();
  // Mirror production: requireOrgId falls back to DEFAULT_ORG_ID for
  // unauthenticated callers, so the role gate (not the orgId gate)
  // is what produces 401 for them.
  const requireOrgId: RequestHandler = (req, _res, next) => {
    const r = req as { orgId?: string };
    if (!r.orgId) {
      r.orgId = ORG;
    }
    next();
  };

  const emptyList = async () => [];
  const sources = {
    alerts: { getAlertNotifications: emptyList },
    workOrders: { getWorkOrders: emptyList },
    equipment: { getEquipmentRegistry: emptyList },
    inventory: { getLowStockParts: emptyList },
  };

  try {
    const mod = await import("../../server/domains/workflow/interfaces/routes");
    mod.registerWorkflowRoutes(app, {
      generalApiRateLimit: passthrough,
      writeOperationRateLimit: passthrough,
      requireOrgId,
      sources,
    });
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

describe("Task #217 — Attention Inbox role gate", () => {
  it("workflow routes mounted successfully", () => {
    expect(mountError).toBeUndefined();
  });

  it("GET /api/attention/items rejects deck_officer with 403", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .get("/api/attention/items")
      .set("x-test-user", "user-deck:deck_officer");
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("GET /api/attention/items rejects viewer with 403", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .get("/api/attention/items")
      .set("x-test-user", "user-viewer:viewer");
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("GET /api/attention/items rejects unauthenticated with 401", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app).get("/api/attention/items");
    expect(res.status).toBe(401);
    expect(res.body?.code).toBe("AUTH_REQUIRED");
  });

  it("POST /api/attention/handover rejects deck_officer with 403", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .post("/api/attention/handover")
      .set("x-test-user", "user-deck:deck_officer")
      .send({ note: "hi" });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("POST /api/attention/blocker-resolutions rejects viewer with 403", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .post("/api/attention/blocker-resolutions")
      .set("x-test-user", "user-viewer:viewer")
      .send({});
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("POST /api/attention/issues rejects deck_officer with 403", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .post("/api/attention/issues")
      .set("x-test-user", "user-deck:deck_officer")
      .send({ summary: "stuff" });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  for (const role of [
    "chief_engineer",
    "captain",
    "fleet_manager",
    "system_admin",
    "company_admin",
    "admin",
  ]) {
    it(`GET /api/attention/items passes the gate for ${role}`, async () => {
      if (mountError) throw new Error(mountError);
      const res = await request(app)
        .get("/api/attention/items")
        .set("x-test-user", `ok-${role}:${role}`);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
      if (res.status >= 400) {
        expect(res.body?.code).not.toBe("INSUFFICIENT_PERMISSIONS");
      }
    });
  }
});
