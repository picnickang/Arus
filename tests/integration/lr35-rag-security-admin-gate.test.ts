/**
 * LR-3.5 / SEC-3 regression: the RAG security configuration surface
 * (`PUT /api/rag/security/config`, audit reads, test endpoints) must
 * reject non-admin sessions with 403 and unauthenticated requests with
 * 401. The previous `requireAdminAuth` implementation had a dev-mode
 * disjunct that was always truthy in `NODE_ENV=development`; this test
 * pins the fail-closed behaviour after that bypass was removed.
 */
import { describe, it, expect, beforeAll, afterEach } from "@jest/globals";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { registerRagSecurityRoutes } from "../../server/routes/rag-security-routes";

type SessionShape = {
  userId?: string;
  roles?: Array<{ name?: string }>;
};

let app: Express;
let currentSession: SessionShape | undefined;

beforeAll(() => {
  app = express();
  app.use(express.json());
  // Auth shim — mirrors how the real session middleware would attach
  // `req.session` upstream. The test owns this state via `currentSession`.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentSession) {
      (req as Request & { session?: SessionShape }).session = currentSession;
    }
    next();
  });
  registerRagSecurityRoutes(app);
});

afterEach(() => {
  currentSession = undefined;
  delete process.env['RBAC_DEV_NO_AUTH'];
});

describe("LR-3.5 SEC-3 — RAG security admin gate", () => {
  it("rejects unauthenticated PUT /api/rag/security/config with 401", async () => {
    currentSession = undefined;
    const res = await request(app)
      .put("/api/rag/security/config")
      .send({ rateLimiting: { enabled: true } });
    expect(res.status).toBe(401);
  });

  it("rejects non-admin session on PUT /api/rag/security/config with 403", async () => {
    currentSession = {
      userId: "user-not-admin",
      roles: [{ name: "second_officer" }],
    };
    const res = await request(app)
      .put("/api/rag/security/config")
      .send({ rateLimiting: { enabled: true } });
    expect(res.status).toBe(403);
    expect(res.body?.error).toMatch(/admin/i);
  });

  it("rejects non-admin session on GET /api/rag/security/audit with 403", async () => {
    currentSession = {
      userId: "user-not-admin",
      roles: [{ name: "viewer" }],
    };
    const res = await request(app).get("/api/rag/security/audit");
    expect(res.status).toBe(403);
  });

  it("allows admin session through (positive control)", async () => {
    currentSession = {
      userId: "admin-1",
      roles: [{ name: "admin" }],
    };
    const res = await request(app)
      .put("/api/rag/security/config")
      .send({ rateLimiting: { enabled: true, requestsPerMinute: 60 } });
    // Admin made it past the gate — handler runs and either 200s or
    // produces a non-403/non-401 status. The contract under test is
    // the gate, not the handler.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("rejects system_admin role with 403 (admin-only narrowing pin)", async () => {
    // LR-3.5 / SEC-3: the prior gate accepted `admin || system_admin ||
    // developer`. Narrowed to `admin` only. Pin the regression.
    currentSession = {
      userId: "sysadmin-1",
      roles: [{ name: "system_admin" }],
    };
    const res = await request(app)
      .put("/api/rag/security/config")
      .send({ rateLimiting: { enabled: true } });
    expect(res.status).toBe(403);
  });

  it("rejects developer role with 403 (admin-only narrowing pin)", async () => {
    currentSession = {
      userId: "dev-1",
      roles: [{ name: "developer" }],
    };
    const res = await request(app)
      .put("/api/rag/security/config")
      .send({ rateLimiting: { enabled: true } });
    expect(res.status).toBe(403);
  });

  it("does NOT bypass admin gate when NODE_ENV=development without RBAC_DEV_NO_AUTH=1", async () => {
    const prev = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = "development";
    delete process.env['RBAC_DEV_NO_AUTH'];
    currentSession = undefined;
    try {
      const res = await request(app)
        .put("/api/rag/security/config")
        .send({ rateLimiting: { enabled: true } });
      expect(res.status).toBe(401);
    } finally {
      if (prev === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = prev;
      }
    }
  });
});
