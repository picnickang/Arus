/**
 * GET /api/permissions/me — primary-role merge safety net (Task #247).
 *
 * Task #246 fixed a silent bug: a top administrator whose authority comes from
 * the primary `users.role` column (with NO matching `user_role_assignments`
 * row) was returned an empty/partial `roles` array from `/api/permissions/me`,
 * because `mapped.roles` is built purely from assignments. The client crew
 * "Access & Login" tab gate (`useRoleNames().hasAnyRole(...)`) then evaluated
 * false and hid the tab even though `requireRole(...)` — which authorizes on
 * the primary role only — would have allowed the same user.
 *
 * This pins that behaviour at two levels so a future refactor of the endpoint
 * or the role mapper cannot silently reintroduce the regression:
 *   1. the real `/api/permissions/me` route handler merges the primary
 *      `users.role` into the contract `roles` array, with case-insensitive
 *      de-duplication when an assignment role and the primary role coincide;
 *   2. the resulting `roles` payload, run through a faithful replica of the
 *      client `useRoleNames()` normalization, keeps
 *      `hasAnyRole("system_admin","company_admin","admin")` true for a
 *      primary-role-only top admin (so the `tab-crew-access` trigger renders)
 *      and false for a non-admin (so the tab stays hidden).
 *
 * Runs without Postgres: the real route handler (so the merge logic is
 * genuinely exercised) is composed against mocked `./service`, `./repository`
 * and `../../db` modules. Mocked via `jest.unstable_mockModule` + dynamic
 * import because the integration suite runs under `--experimental-vm-modules`
 * (ESM), where a hoisted `jest.mock` factory is not invoked — same pattern as
 * `hub-admin-grant-route.test.ts`.
 */

process.env['NODE_ENV'] = "test";

import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
} from "@jest/globals";
import type {
  Express,
  NextFunction,
  Request,
  Response,
} from "express";
import request from "supertest";

const ORG = "test-org-permissions-me";

interface OrgRole {
  id: string;
  name: string;
  displayName: string;
}

interface UserRow {
  role: string | null;
  hubAdmin: boolean;
  hubAccess: string[] | null;
}

interface CompiledStub {
  userId: string;
  orgId: string;
  roles: string[];
  grants: Record<string, Record<string, { allowed: boolean }>>;
}

// Per-test fixtures (reset in beforeEach). The route handler reads all three.
let compiledStub: CompiledStub;
let orgRolesStub: OrgRole[];
let userRowStub: UserRow | undefined;
let hubResolutionStub: { hubAdmin: boolean; hubAccess: string[] | null };

beforeEach(() => {
  compiledStub = {
    userId: "user-1",
    orgId: ORG,
    roles: [],
    grants: {},
  };
  orgRolesStub = [];
  userRowStub = undefined;
  hubResolutionStub = { hubAdmin: false, hubAccess: null };
});

// ---------------------------------------------------------------------------
// Faithful replica of client `useRoleNames()` normalization + the crew tab
// gate (`CREW_ADMIN_ROLES` in client/src/components/unified-crew-components.tsx
// → hasAnyRole("system_admin","company_admin","admin")). Kept in lockstep with
// client/src/hooks/useRoleNames.ts so this test asserts the real client gate
// decision without a DOM renderer (no jsdom/testing-library in this repo).
// ---------------------------------------------------------------------------
const CREW_ADMIN_ROLES = ["system_admin", "company_admin", "admin"];

function normalizeRoleNames(
  roles: ReadonlyArray<{ name?: unknown } | string>
): string[] {
  return roles
    .map((r) => {
      if (typeof r === "string") {return r;}
      if (r && typeof r === "object" && "name" in r) {
        return String((r as { name: unknown }).name);
      }
      return "";
    })
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

function hasAnyRole(
  roles: ReadonlyArray<{ name?: unknown } | string>,
  ...query: string[]
): boolean {
  const roleSet = new Set(normalizeRoleNames(roles));
  return query.some((role) => roleSet.has(role.trim().toLowerCase()));
}

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  // Mock the service layer: compileUserPermissions is the assignment-derived
  // role/grant source; permissionService is unused on the /me path but must
  // exist because routes.ts imports it at module load.
  jest.unstable_mockModule("../../server/domains/permissions/service", () => ({
    compileUserPermissions: async () => compiledStub,
    permissionService: {
      invalidateOrgPermissionCache: () => {},
      invalidateUserPermissionCache: () => {},
      // Hub resolution now lives in the service; the /me route delegates to it.
      getEffectiveHubAccess: async () => hubResolutionStub,
    },
  }));

  // Mock the repository: only listRoles is reached on the /me path; anything
  // else should be loud rather than silently return undefined.
  jest.unstable_mockModule("../../server/domains/permissions/repository", () => ({
    permissionRepository: new Proxy(
      {
        async listRoles(): Promise<OrgRole[]> {
          return orgRolesStub;
        },
      } as Record<string, unknown>,
      {
        get(obj, prop: string) {
          if (prop in obj) {return obj[prop];}
          return async () => {
            throw new Error(`unexpected repo call: ${prop}`);
          };
        },
      }
    ),
  }));

  // Mock the db so the user-row lookup (db.select(...).from(users).where(...)
  // .limit(1)) resolves to our fixture without a real Postgres connection.
  jest.unstable_mockModule("../../server/db", () => ({
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => (userRowStub ? [userRowStub] : []),
          }),
        }),
      }),
    },
    // The audit chain (transitively imported by routes.ts) imports other
    // named exports from `../db` (the real module re-exports these from
    // db-config). Provide stubs so ESM module linking succeeds; the /me GET
    // path never touches them.
    pool: {},
    libsqlClient: undefined,
    isLocalMode: false,
    deploymentMode: "cloud",
  }));

  const express = (await import("express")).default;
  app = express();
  app.use(express.json());

  // Inject an authenticated user (id + primary role + org claim) from a header
  // so `requireOrgId` (the real middleware) admits the request.
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
    const mod = await import("../../server/domains/permissions/routes");
    mod.registerPermissionRoutes(app);
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

const PATH = "/api/permissions/me";

describe("GET /api/permissions/me — mounted", () => {
  it("registers without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("GET /api/permissions/me — primary role merge", () => {
  it("includes the primary users.role even with NO matching assignment row", async () => {
    if (mountError) {throw new Error(mountError);}
    // Top admin: authority is the primary role only — no assignment-derived roles.
    compiledStub.roles = [];
    orgRolesStub = [
      { id: "role-admin", name: "admin", displayName: "Administrator" },
    ];
    userRowStub = { role: "admin", hubAdmin: false, hubAccess: null };

    const res = await request(app)
      .get(PATH)
      .set("x-test-user", "user-1:admin");

    expect(res.status).toBe(200);
    const names = res.body.roles.map((r: { name: string }) => r.name);
    expect(names).toContain("admin");
    // Resolved from org-role metadata, so it carries the real role id/displayName.
    expect(res.body.roles).toEqual(
      expect.arrayContaining([
        { id: "role-admin", name: "admin", displayName: "Administrator" },
      ])
    );
  });

  it("falls back to a synthetic entry when the primary role is not in org roles", async () => {
    if (mountError) {throw new Error(mountError);}
    compiledStub.roles = [];
    orgRolesStub = []; // primary role has no metadata row
    userRowStub = { role: "system_admin", hubAdmin: false, hubAccess: null };

    const res = await request(app)
      .get(PATH)
      .set("x-test-user", "user-1:system_admin");

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual([
      {
        id: "primary:system_admin",
        name: "system_admin",
        displayName: "system_admin",
      },
    ]);
  });

  it("de-duplicates case-insensitively when an assignment role equals the primary role", async () => {
    if (mountError) {throw new Error(mountError);}
    // Assignment row resolves to the org role "Admin"; primary column is "admin".
    orgRolesStub = [
      { id: "role-admin", name: "Admin", displayName: "Administrator" },
    ];
    compiledStub.roles = ["role-admin"];
    userRowStub = { role: "admin", hubAdmin: false, hubAccess: null };

    const res = await request(app)
      .get(PATH)
      .set("x-test-user", "user-1:admin");

    expect(res.status).toBe(200);
    const adminEntries = res.body.roles.filter(
      (r: { name: string }) => r.name.toLowerCase() === "admin"
    );
    expect(adminEntries).toHaveLength(1);
    expect(res.body.roles).toHaveLength(1);
  });
});

describe("GET /api/permissions/me — client crew-access gate stays open", () => {
  it("keeps hasAnyRole(admin roles) true for a primary-role-only top admin (tab-crew-access visible)", async () => {
    if (mountError) {throw new Error(mountError);}
    compiledStub.roles = []; // no assignment-derived roles
    orgRolesStub = [
      { id: "role-admin", name: "admin", displayName: "Administrator" },
    ];
    userRowStub = { role: "admin", hubAdmin: false, hubAccess: null };

    const res = await request(app)
      .get(PATH)
      .set("x-test-user", "user-1:admin");

    expect(res.status).toBe(200);
    // This is exactly the gate the crew dialog uses to render `tab-crew-access`.
    expect(hasAnyRole(res.body.roles, ...CREW_ADMIN_ROLES)).toBe(true);
  });

  it("keeps the gate closed for a non-admin (tab-crew-access hidden)", async () => {
    if (mountError) {throw new Error(mountError);}
    compiledStub.roles = [];
    orgRolesStub = [
      { id: "role-tech", name: "technician", displayName: "Marine Technician" },
    ];
    userRowStub = { role: "technician", hubAdmin: false, hubAccess: null };

    const res = await request(app)
      .get(PATH)
      .set("x-test-user", "user-1:technician");

    expect(res.status).toBe(200);
    expect(res.body.roles.map((r: { name: string }) => r.name)).toContain(
      "technician"
    );
    expect(hasAnyRole(res.body.roles, ...CREW_ADMIN_ROLES)).toBe(false);
  });
});
