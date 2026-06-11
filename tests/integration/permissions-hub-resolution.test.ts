/**
 * permissionService.getEffectiveHubAccess — role-level hub resolution.
 *
 * Pins the contract that effective hub access folds together THREE sources:
 *   1. the user's primary role NAME (users.role) — matched by `roles.name`;
 *   2. the user's ASSIGNED roles — `getUserRoles` returns role IDs
 *      (user_role_assignments.roleId), so they MUST be matched by `roles.id`,
 *      NOT by name (an earlier draft mistakenly treated the IDs as names,
 *      silently dropping every assignment-derived hub grant);
 *   3. the per-user stored override (users.hubAdmin / users.hubAccess).
 *
 * Runs without Postgres: the real service module is exercised against a
 * PREDICATE-AWARE mock of `../../server/db`. The mock inspects the actual
 * drizzle `where(...)` condition for the `roles` query and filters the fixture
 * rows by the id/name columns/params it references — so a regression that
 * matches assigned roles by `roles.name` instead of `roles.id` genuinely fails
 * this test (the chief row's name !== its id, so name-matching would drop it).
 *
 * Mocked via `jest.unstable_mockModule` + dynamic import because the
 * integration suite runs under `--experimental-vm-modules` (ESM), where a
 * hoisted `jest.mock` factory is not invoked — same pattern as
 * `permissions-me-primary-role.test.ts`.
 */

process.env["NODE_ENV"] = "test";

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";

const ORG = "test-org-hub-resolution";

interface UserRow {
  role: string | null;
  hubAdmin: boolean;
  hubAccess: string[] | null;
}
interface RoleRow {
  id: string;
  name: string;
  hubAdmin: boolean | null;
  hubAccess: string[] | null;
}

// Per-test fixtures (reset in beforeEach).
let userRows: UserRow[];
let assignmentRows: Array<{ roleId: string }>;
let roleRows: RoleRow[];

beforeEach(() => {
  userRows = [];
  assignmentRows = [];
  roleRows = [];
});

// Walk a drizzle SQL condition tree and collect, per referenced column name,
// the param values bound to it. Mirrors the structure probed from
// `or(inArray(roles.id, [...]), eq(roles.name, ...))`: a flat queryChunks
// sequence of column refs followed by their params.
function collectColumnParams(cond: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let lastColumn: string | null = null;
  function walk(node: unknown): void {
    if (node == null) {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      const n = node as Record<string, unknown>;
      const ctor = (node as { constructor?: { name?: string } }).constructor?.name ?? "";
      if (
        typeof n["name"] === "string" &&
        (n["columnType"] || n["dataType"] || /Column/.test(ctor))
      ) {
        lastColumn = n["name"] as string;
      }
      if (ctor === "Param" && lastColumn) {
        (out[lastColumn] ??= []).push(String(n["value"]));
      }
      if (n["queryChunks"]) {
        walk(n["queryChunks"]);
      }
      if (n["column"]) {
        walk(n["column"]);
      }
      if (Array.isArray(n["value"])) {
        walk(n["value"]);
      }
    }
  }
  walk((cond as { queryChunks?: unknown }).queryChunks ?? cond);
  return out;
}

let getEffectiveHubAccess: (
  userId: string,
  orgId: string
) => Promise<{ hubAdmin: boolean; hubAccess: string[] | null }>;
let importError: string | undefined;

beforeAll(async () => {
  // Import the REAL schema tables so the db mock can compare `.from(...)` by
  // object identity (the service imports the same singletons).
  const permSchema = await import("../../shared/schema/permissions");
  const coreSchema = await import("../../shared/schema");
  const usersTable = (coreSchema as Record<string, unknown>)["users"];
  const rolesTable = (permSchema as Record<string, unknown>)["roles"];
  const assignmentsTable = (permSchema as Record<string, unknown>)["userRoleAssignments"];

  // For the roles query, filter the fixture rows by the WHERE predicate so the
  // id-vs-name distinction is enforced; other tables return their rows as-is.
  function rolesForCondition(cond: unknown): RoleRow[] {
    const byColumn = collectColumnParams(cond);
    const idParams = new Set(byColumn["id"] ?? []);
    const nameParams = new Set(byColumn["name"] ?? []);
    return roleRows.filter((r) => idParams.has(r.id) || nameParams.has(r.name));
  }

  jest.unstable_mockModule("../../server/db", () => ({
    db: {
      select: () => ({
        from: (tbl: unknown) => ({
          where: (cond: unknown) => {
            let rows: unknown[];
            if (tbl === usersTable) {
              rows = userRows;
            } else if (tbl === assignmentsTable) {
              rows = assignmentRows;
            } else if (tbl === rolesTable) {
              rows = rolesForCondition(cond);
            } else {
              rows = [];
            }
            return {
              // The users query chains `.limit(1)`; the assignment + roles
              // queries await the `.where(...)` result directly.
              limit: async () => rows,
              then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
            };
          },
        }),
      }),
    },
  }));

  try {
    const mod = await import("../../server/domains/permissions/service");
    getEffectiveHubAccess = mod.permissionService.getEffectiveHubAccess;
  } catch (err) {
    importError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

describe("getEffectiveHubAccess — module loads", () => {
  it("imports the real service without error", () => {
    expect(importError).toBeUndefined();
    expect(typeof getEffectiveHubAccess).toBe("function");
  });
});

describe("getEffectiveHubAccess — assignment-derived roles", () => {
  it("folds in an ASSIGNED role's hub grant (resolved by role id, not name)", async () => {
    if (importError) {
      throw new Error(importError);
    }
    // Non-admin primary role with no stored override.
    userRows = [{ role: "deck_officer", hubAdmin: false, hubAccess: null }];
    // Assignment carries a role ID — getUserRoles returns ["role-chief"].
    assignmentRows = [{ roleId: "role-chief" }];
    // The chief role's NAME ("chief_engineer") deliberately differs from its
    // ID ("role-chief"): a name-based regression would fail to match it.
    roleRows = [
      { id: "role-chief", name: "chief_engineer", hubAdmin: true, hubAccess: ["maintenance"] },
    ];

    const result = await getEffectiveHubAccess("user-1", ORG);
    expect(result.hubAdmin).toBe(true);
    expect(result.hubAccess).toEqual(["maintenance"]);
  });

  it("returns no hub access for a plain non-admin with no grants", async () => {
    if (importError) {
      throw new Error(importError);
    }
    userRows = [{ role: "deck_officer", hubAdmin: false, hubAccess: null }];
    assignmentRows = [{ roleId: "role-deck" }];
    roleRows = [{ id: "role-deck", name: "deck_officer", hubAdmin: false, hubAccess: null }];

    const result = await getEffectiveHubAccess("user-1", ORG);
    expect(result.hubAdmin).toBe(false);
    expect(result.hubAccess).toBeNull();
  });
});

describe("getEffectiveHubAccess — primary role name", () => {
  it("grants full access to a super-admin primary role even with NO roles row", async () => {
    if (importError) {
      throw new Error(importError);
    }
    // Super-admin authority lives only on the primary users.role column; there
    // is no matching `roles` row. Super-admin detection is by NAME, so the
    // primary role name must still be represented.
    userRows = [{ role: "super_admin", hubAdmin: false, hubAccess: null }];
    assignmentRows = [];
    roleRows = [];

    const result = await getEffectiveHubAccess("user-1", ORG);
    expect(result.hubAdmin).toBe(true);
    // Super-admin => all hubs (null allow-list means "everything").
    expect(result.hubAccess).toBeNull();
  });

  it("resolves the primary role by NAME when it has a roles row", async () => {
    if (importError) {
      throw new Error(importError);
    }
    // No assignments — only the primary role name should match (by roles.name).
    userRows = [{ role: "fleet_manager", hubAdmin: false, hubAccess: null }];
    assignmentRows = [];
    roleRows = [{ id: "role-fleet", name: "fleet_manager", hubAdmin: true, hubAccess: ["fleet"] }];

    const result = await getEffectiveHubAccess("user-1", ORG);
    expect(result.hubAdmin).toBe(true);
    expect(result.hubAccess).toEqual(["fleet"]);
  });
});

describe("getEffectiveHubAccess — per-user stored override", () => {
  it("honours a stored per-user hub override on a grant-eligible role", async () => {
    if (importError) {
      throw new Error(importError);
    }
    // `captain` is grant-eligible, so the per-user override survives the
    // eligibility re-check and contributes its allow-list.
    userRows = [{ role: "captain", hubAdmin: true, hubAccess: ["logistics"] }];
    assignmentRows = [];
    roleRows = [{ id: "role-captain", name: "captain", hubAdmin: false, hubAccess: null }];

    const result = await getEffectiveHubAccess("user-1", ORG);
    expect(result.hubAdmin).toBe(true);
    expect(result.hubAccess).toEqual(["logistics"]);
  });

  it("drops a stored override when the role is NOT grant-eligible (demotion re-check)", async () => {
    if (importError) {
      throw new Error(importError);
    }
    // `deck_officer` is below the grant-eligible tier, so a stale stored
    // override must NOT grant hub access.
    userRows = [{ role: "deck_officer", hubAdmin: true, hubAccess: ["logistics"] }];
    assignmentRows = [];
    roleRows = [{ id: "role-deck", name: "deck_officer", hubAdmin: false, hubAccess: null }];

    const result = await getEffectiveHubAccess("user-1", ORG);
    expect(result.hubAdmin).toBe(false);
    expect(result.hubAccess).toBeNull();
  });
});
