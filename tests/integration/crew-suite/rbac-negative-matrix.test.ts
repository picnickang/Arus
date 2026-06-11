/**
 * §R — Negative RBAC matrix (in-process, NODE_ENV=test so gates enforce).
 *
 * The live dev server forces a fixed admin caller, so it can only prove the
 * POSITIVE path. This suite proves the NEGATIVE path by mounting the *real*
 * gate middlewares that the crew-admin / crew-lifecycle / safety-alarm
 * routers use in production, wired with the exact same parameters they ship
 * with, on stub handlers:
 *
 *   - requireRole(...CREW_ADMIN_ROLES) rejects a caller whose role is not in
 *     the crew-admin allow-list with 403 INSUFFICIENT_PERMISSIONS, and lets
 *     an `admin` caller through (positive control).
 *   - requirePermission(resource, action) rejects a caller when the
 *     permission service denies, and lets them through when it allows
 *     (positive control).
 *
 * Why the real middlewares instead of the real routers: the crew-admin /
 * safety / lifecycle route modules statically import `server/db-config`,
 * which eagerly initialises a drizzle/pg client at module load and crashes
 * under jest's module resolution in this cloud-mode sandbox. The gate
 * middlewares (`requireRole`, `requirePermission`) carry no such dependency,
 * so importing them directly exercises the genuine enforcement code with the
 * production allow-lists and resource/action pairs (mirrored verbatim from
 * the route files below) without the brittle db-config import.
 *
 * The permission service is mocked so the requirePermission decision is
 * controllable; the assertion is on the GATE, not on any handler outcome.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  jest,
} from "@jest/globals";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import request from "supertest";

// This jest config runs native ESM (extensionsToTreatAsEsm: ['.ts']), where
// jest.mock is a no-op — the supported API is jest.unstable_mockModule, which
// must be called BEFORE the dynamic import of the module under test.

// Control the requirePermission decision.
const authorizeMock = jest.fn(async () => ({ allowed: false, reason: "denied by test" }));

// requireRole imports `./auth` only for the AuthenticatedRequest *type*
// (erased at runtime). Stub it defensively so nothing transitive is pulled in.
jest.unstable_mockModule("../../../server/middleware/auth.js", () => ({}));

// Stub the permission service so requirePermission's decision is controllable
// and no real DB / db-config is loaded.
jest.unstable_mockModule("../../../server/domains/permissions/service", () => ({
  permissionService: {
    authorize: authorizeMock,
    hasAnyPermission: jest.fn(async () => false),
    hasAllPermissions: jest.fn(async () => false),
    getAllUserPermissions: jest.fn(async () => ({})),
  },
}));

// Production gate parameters, mirrored verbatim from the route modules:
//   server/domains/crew-admin/interfaces/routes.ts
//   server/domains/crew/interfaces/crew-lifecycle-routes.ts
//   server/domains/safety-alarms/interfaces/routes.ts
const CREW_ADMIN_ROLES = ["super_admin", "system_admin", "company_admin", "admin"] as const;
const HUB_GRANT_ADMIN_ROLES = ["super_admin", "system_admin", "company_admin", "admin"] as const;

type RoleRoute = { label: string; method: "get" | "post" | "put" | "patch"; path: string; roles: readonly string[] };
const ROLE_ROUTES: RoleRoute[] = [
  { label: "list roles", method: "get", path: "/api/admin/crew/roles", roles: CREW_ADMIN_ROLES },
  { label: "create role", method: "post", path: "/api/admin/crew/roles", roles: CREW_ADMIN_ROLES },
  { label: "list role-dashboards", method: "get", path: "/api/admin/role-dashboards", roles: CREW_ADMIN_ROLES },
  { label: "save role-dashboard", method: "put", path: "/api/admin/role-dashboards/some_role", roles: CREW_ADMIN_ROLES },
  { label: "access-readiness", method: "get", path: "/api/admin/crew/access-readiness", roles: CREW_ADMIN_ROLES },
  { label: "former-access-risks", method: "get", path: "/api/admin/crew/former-access-risks", roles: CREW_ADMIN_ROLES },
  { label: "create crew account", method: "post", path: "/api/admin/crew/members/c1/account", roles: CREW_ADMIN_ROLES },
  { label: "set login-enabled", method: "patch", path: "/api/admin/crew/users/u1/login-enabled", roles: CREW_ADMIN_ROLES },
  { label: "set hub-access (super-admin)", method: "patch", path: "/api/admin/crew/users/u1/hub-access", roles: HUB_GRANT_ADMIN_ROLES },
];

type PermRoute = { label: string; method: "get" | "post"; path: string; resource: string; action: string };
const PERM_ROUTES: PermRoute[] = [
  { label: "retire crew", method: "post", path: "/api/crew/c1/retire", resource: "crew_members", action: "edit" },
  { label: "reinstate crew", method: "post", path: "/api/crew/c1/reinstate", resource: "crew_members", action: "edit" },
  { label: "former crew list", method: "get", path: "/api/crew/former", resource: "crew_members", action: "view" },
  { label: "trigger safety alarm", method: "post", path: "/api/admin/safety-alarms", resource: "safety_alarms", action: "trigger" },
  { label: "clear safety alarm", method: "post", path: "/api/admin/safety-alarms/a1/clear", resource: "safety_alarms", action: "clear" },
  { label: "list safety alarm types", method: "get", path: "/api/admin/safety-alarm-types", resource: "safety_alarm_types", action: "view" },
  { label: "create safety alarm type", method: "post", path: "/api/admin/safety-alarm-types", resource: "safety_alarm_types", action: "manage" },
];

let app: Express;
let mountErr: unknown = null;

beforeAll(async () => {
  const { requireRole } = await import("../../../server/middleware/role-auth.js");
  const { requirePermission } = await import("../../../server/domains/permissions/middleware.js");

  const a = express();
  a.use(express.json());
  // Auth shim — same shape as production. `x-test-user` = "userId:role".
  a.use((req: Request, _res: Response, next: NextFunction) => {
    const hdr = req.headers["x-test-user"];
    const value = Array.isArray(hdr) ? hdr[0] : hdr;
    if (value && typeof value === "string") {
      const [id, role] = value.split(":");
      (req as Request & { user?: unknown; orgId?: string }).user = {
        id,
        email: `${id}@example.com`,
        role,
        isActive: true,
        orgId: "rbac-neg-org",
      };
      (req as Request & { orgId?: string }).orgId = "rbac-neg-org";
    }
    next();
  });

  const ok = (_req: Request, res: Response): void => {
    res.status(200).json({ ok: true });
  };

  try {
    for (const r of ROLE_ROUTES) {
      a[r.method](r.path, requireRole(...(r.roles as string[]) as never[]), ok);
    }
    for (const r of PERM_ROUTES) {
      a[r.method](
        r.path,
        requirePermission(r.resource, r.action as never),
        ok,
      );
    }
  } catch (err) {
    mountErr = err;
  }

  app = a;
});

function send(method: string, path: string, role: string) {
  const r = request(app) as unknown as Record<string, (p: string) => request.Test>;
  return r[method](path).set("x-test-user", `actor:${role}`).send({});
}

describe("§R — harness sanity", () => {
  it("mounted the real gate middlewares (guards against a false-green skip)", () => {
    expect(mountErr).toBeNull();
    expect(typeof app).toBe("function");
  });
});

describe("§R — requireRole crew-admin gate rejects non-admins", () => {
  for (const route of ROLE_ROUTES) {
    it(`${route.label} (${route.method.toUpperCase()} ${route.path}) → 403 for role=crew_member`, async () => {
      const res = await send(route.method, route.path, "crew_member");
      expect(res.status).toBe(403);
      expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  }

  it("rejects an unauthenticated caller with 401 (no role)", async () => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)
      ["get"]("/api/admin/crew/roles")
      .send({});
    expect(res.status).toBe(401);
  });

  it("positive control: an admin caller is NOT 403", async () => {
    const res = await send("get", "/api/admin/crew/roles", "admin");
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });
});

describe("§R — requirePermission gate rejects when permission is denied", () => {
  for (const route of PERM_ROUTES) {
    it(`${route.label} (${route.method.toUpperCase()} ${route.path}) → 403 when denied`, async () => {
      authorizeMock.mockResolvedValue({ allowed: false, reason: "denied by test" });
      const res = await send(route.method, route.path, "viewer");
      expect(res.status).toBe(403);
      expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
    });
  }

  it("positive control: a granted permission is NOT 403", async () => {
    authorizeMock.mockResolvedValue({ allowed: true, reason: "granted by test" });
    const res = await send("get", "/api/crew/former", "viewer");
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it("the gate calls the permission service with the route's resource/action", async () => {
    authorizeMock.mockClear();
    authorizeMock.mockResolvedValue({ allowed: true, reason: "granted by test" });
    await send("post", "/api/crew/c1/retire", "viewer");
    expect(authorizeMock).toHaveBeenCalledWith(
      "actor",
      "rbac-neg-org",
      "crew_members",
      "edit",
    );
  });
});
