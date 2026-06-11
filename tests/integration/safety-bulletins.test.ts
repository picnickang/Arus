/**
 * Safety Bulletins feed — route contract + admin gate (Task #230).
 *
 * `GET /api/safety-bulletins` is readable by any authenticated user; the
 * route owns the `includeInactive` → `activeOnly` coercion and the
 * `vesselId` pass-through. `POST /api/safety-bulletins` is gated to
 * admin-portal roles (mirrors the Attention Inbox gate) and validates
 * its body. This suite pins all of that at the HTTP boundary with a
 * stubbed service, so it runs without touching Postgres — the same
 * pattern as `attention-inbox-role-gate.test.ts`.
 *
 * The service is mocked via `jest.unstable_mockModule` + dynamic import
 * because the integration suite runs under `--experimental-vm-modules`
 * (ESM), where a hoisted `jest.mock` factory is not invoked. The stub
 * records the arguments the route passes so the date/expiry/vessel SQL
 * filtering (exercised by the live RLS path) is represented here by the
 * filter object the route hands the repository.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import request from "supertest";

const ORG = "test-org-safety-bulletins";

type ListArgs = {
  orgId: string;
  filters?: { activeOnly?: boolean; vesselId?: string } | undefined;
};

const listBulletins =
  jest.fn<(orgId: string, filters?: ListArgs["filters"]) => Promise<unknown[]>>();
const createBulletin = jest.fn<(command: Record<string, unknown>) => Promise<unknown>>();

let app: Express;
let mountError: string | undefined;
let lastListArgs: ListArgs | undefined;

beforeAll(async () => {
  jest.unstable_mockModule("../../server/domains/safety-bulletins/service", () => ({
    safetyBulletinService: {
      listBulletins: (orgId: string, filters?: ListArgs["filters"]) => {
        lastListArgs = { orgId, filters };
        return listBulletins(orgId, filters);
      },
      createBulletin: (command: Record<string, unknown>) => createBulletin(command),
    },
  }));

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

  try {
    const mod = await import("../../server/domains/safety-bulletins/interfaces/routes");
    mod.registerSafetyBulletinRoutes(app, {
      generalApiRateLimit: passthrough,
      writeOperationRateLimit: passthrough,
    });
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

beforeEach(() => {
  listBulletins.mockReset();
  createBulletin.mockReset();
  lastListArgs = undefined;
  listBulletins.mockResolvedValue([]);
  createBulletin.mockResolvedValue({ id: "bulletin-1" });
});

describe("Safety Bulletins — routes mounted", () => {
  it("registers without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("GET /api/safety-bulletins — read filters", () => {
  it("defaults to active-only and scopes to the caller's org", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app).get("/api/safety-bulletins").set("x-test-user", "reader:viewer");
    expect(res.status).toBe(200);
    expect(lastListArgs?.orgId).toBe(ORG);
    expect(lastListArgs?.filters?.activeOnly).toBe(true);
    expect(lastListArgs?.filters?.vesselId).toBeUndefined();
  });

  it("includeInactive=true disables the active-only filter", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .get("/api/safety-bulletins?includeInactive=true")
      .set("x-test-user", "reader:viewer");
    expect(res.status).toBe(200);
    expect(lastListArgs?.filters?.activeOnly).toBe(false);
  });

  it("includeInactive=false keeps the active-only filter (not coerced truthy)", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .get("/api/safety-bulletins?includeInactive=false")
      .set("x-test-user", "reader:viewer");
    expect(res.status).toBe(200);
    expect(lastListArgs?.filters?.activeOnly).toBe(true);
  });

  it("rejects a non-boolean includeInactive value with 400", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .get("/api/safety-bulletins?includeInactive=yes")
      .set("x-test-user", "reader:viewer");
    expect(res.status).toBe(400);
  });

  it("passes vesselId through to the service (vessel + fleet-wide scope)", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .get("/api/safety-bulletins?vesselId=vessel-42")
      .set("x-test-user", "reader:viewer");
    expect(res.status).toBe(200);
    expect(lastListArgs?.filters?.vesselId).toBe("vessel-42");
  });

  it("returns the service rows verbatim", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    listBulletins.mockResolvedValueOnce([
      { id: "a", title: "Drill" },
      { id: "b", title: "Advisory" },
    ]);
    const res = await request(app).get("/api/safety-bulletins").set("x-test-user", "reader:viewer");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]?.id).toBe("a");
  });
});

describe("POST /api/safety-bulletins — admin gate", () => {
  it("rejects deck_officer with 403", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/safety-bulletins")
      .set("x-test-user", "user-deck:deck_officer")
      .send({ title: "Nope" });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
    expect(createBulletin).not.toHaveBeenCalled();
  });

  it("rejects viewer with 403", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/safety-bulletins")
      .set("x-test-user", "user-viewer:viewer")
      .send({ title: "Nope" });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
  });

  it("rejects unauthenticated with 401", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app).post("/api/safety-bulletins").send({ title: "Nope" });
    // The real `requireOrgId` runs before the role gate and rejects the
    // org-less caller first (UNAUTHENTICATED); were it to fall through,
    // the role gate would answer AUTH_REQUIRED. Either is a valid 401.
    expect(res.status).toBe(401);
    expect(["UNAUTHENTICATED", "AUTH_REQUIRED"]).toContain(res.body?.code);
    expect(createBulletin).not.toHaveBeenCalled();
  });

  for (const role of [
    "chief_engineer",
    "captain",
    "fleet_manager",
    "system_admin",
    "company_admin",
    "admin",
  ]) {
    it(`allows ${role} to post a valid notice`, async () => {
      if (mountError) {
        throw new Error(mountError);
      }
      const res = await request(app)
        .post("/api/safety-bulletins")
        .set("x-test-user", `ok-${role}:${role}`)
        .send({ title: "Lifeboat drill", severity: "warning" });
      expect(res.status).toBe(201);
      expect(createBulletin).toHaveBeenCalledTimes(1);
      const arg = createBulletin.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(arg["orgId"]).toBe(ORG);
      expect(arg["createdBy"]).toBe(`ok-${role}`);
      expect(arg["title"]).toBe("Lifeboat drill");
    });
  }
});

describe("POST /api/safety-bulletins — body validation", () => {
  it("rejects a missing title with 400", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/safety-bulletins")
      .set("x-test-user", "admin-1:chief_engineer")
      .send({ severity: "info" });
    expect(res.status).toBe(400);
    expect(createBulletin).not.toHaveBeenCalled();
  });

  it("rejects an empty title with 400", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/safety-bulletins")
      .set("x-test-user", "admin-1:chief_engineer")
      .send({ title: "" });
    expect(res.status).toBe(400);
    expect(createBulletin).not.toHaveBeenCalled();
  });

  it("rejects an invalid severity with 400", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/safety-bulletins")
      .set("x-test-user", "admin-1:chief_engineer")
      .send({ title: "Bad severity", severity: "catastrophic" });
    expect(res.status).toBe(400);
    expect(createBulletin).not.toHaveBeenCalled();
  });

  it("accepts an optional vesselId (vessel-scoped notice)", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const res = await request(app)
      .post("/api/safety-bulletins")
      .set("x-test-user", "admin-1:chief_engineer")
      .send({ title: "Engine room notice", vesselId: "vessel-7" });
    expect(res.status).toBe(201);
    const arg = createBulletin.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg["vesselId"]).toBe("vessel-7");
  });
});
