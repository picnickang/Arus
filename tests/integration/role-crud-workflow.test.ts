/**
 * Role CRUD workflow — end-to-end lifecycle through the real permission
 * route handlers (Task #250).
 *
 * The role-management system (create a role → list/read it → update it →
 * set its permission grants → assign it to a user → delete it) is the
 * backbone of ARUS access control, but only a 403 gate matrix and unit
 * mapper tests existed — nothing exercised the actual create → read →
 * update → delete lifecycle through the real route handlers. This suite
 * pins that workflow so a future refactor of the permissions endpoints,
 * service, or repository cannot silently break role creation or its
 * downstream effects.
 *
 * Runs without Postgres: the real permission router (so the actual route
 * handlers and Zod validation are genuinely exercised) is composed against
 * a mocked `./service`, an in-memory `./repository`, and a stub `../../db`.
 * Mocked via `jest.unstable_mockModule` + dynamic import because the
 * integration suite runs under `--experimental-vm-modules` (ESM), where a
 * hoisted `jest.mock` factory is not invoked — same pattern as
 * `permissions-me-primary-role.test.ts` and `hub-admin-grant-route.test.ts`.
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
import type {
  Role,
  InsertRole,
  PermissionGrant,
  UserRoleAssignment,
  InsertUserRoleAssignment,
} from "../../shared/schema/permissions";
import type { WidenPartial } from "../../server/lib/widen-partial";

const ORG = "test-org-role-crud";

// ---------------------------------------------------------------------------
// In-memory stores (reset in beforeEach). The real route handlers read and
// mutate these through the mocked repository so the full lifecycle is honest.
// ---------------------------------------------------------------------------
let rolesStore: Map<string, Role>;
let grantsStore: Map<string, PermissionGrant[]>;
let assignmentsStore: UserRoleAssignment[];
let crewCountStore: Map<string, number>;
let invalidations: { org: string[]; user: Array<{ userId: string; orgId: string }> };
let idCounter: number;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function seedRole(overrides: Partial<Role> = {}): Role {
  const id = overrides.id ?? nextId("role");
  const now = new Date();
  const role: Role = {
    id,
    orgId: ORG,
    name: overrides.name ?? "seeded_role",
    displayName: overrides.displayName ?? "Seeded Role",
    description: overrides.description ?? null,
    department: overrides.department ?? null,
    hierarchyLevel: overrides.hierarchyLevel ?? 50,
    parentRoleId: overrides.parentRoleId ?? null,
    templateId: overrides.templateId ?? null,
    permissions: overrides.permissions ?? null,
    isSystemRole: overrides.isSystemRole ?? false,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
  rolesStore.set(id, role);
  return role;
}

beforeEach(() => {
  rolesStore = new Map();
  grantsStore = new Map();
  assignmentsStore = [];
  crewCountStore = new Map();
  invalidations = { org: [], user: [] };
  idCounter = 0;
});

// In-memory repository: only the methods the role-CRUD routes reach are
// implemented; the Proxy fallback throws so an unexpected codepath is loud
// rather than silently returning undefined.
const fakeRepository = new Proxy(
  {
    async createRole(data: InsertRole): Promise<Role> {
      const id = nextId("role");
      const now = new Date();
      const role: Role = {
        id,
        orgId: data.orgId,
        name: data.name,
        displayName: data.displayName,
        description: data.description ?? null,
        department: data.department ?? null,
        hierarchyLevel: data.hierarchyLevel ?? 50,
        parentRoleId: data.parentRoleId ?? null,
        templateId: data.templateId ?? null,
        permissions: data.permissions ?? null,
        isSystemRole: data.isSystemRole ?? false,
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };
      rolesStore.set(id, role);
      return role;
    },
    async listRoles(orgId: string): Promise<Role[]> {
      return Array.from(rolesStore.values()).filter(
        (r) => r.orgId === orgId && r.isActive === true
      );
    },
    async getRoleById(id: string, orgId: string): Promise<Role | undefined> {
      const role = rolesStore.get(id);
      return role && role.orgId === orgId ? role : undefined;
    },
    async updateRole(
      id: string,
      orgId: string,
      data: WidenPartial<InsertRole>
    ): Promise<Role | undefined> {
      const role = rolesStore.get(id);
      if (!role || role.orgId !== orgId) return undefined;
      const updated: Role = { ...role, ...data, updatedAt: new Date() } as Role;
      rolesStore.set(id, updated);
      return updated;
    },
    async deleteRole(id: string, orgId: string): Promise<boolean> {
      const role = rolesStore.get(id);
      if (!role || role.orgId !== orgId) return false;
      rolesStore.set(id, { ...role, isActive: false, updatedAt: new Date() });
      return true;
    },
    async getCrewCountByRoleId(roleId: string, _orgId: string): Promise<number> {
      return crewCountStore.get(roleId) ?? 0;
    },
    async getPermissionGrantsForRole(roleId: string): Promise<PermissionGrant[]> {
      return grantsStore.get(roleId) ?? [];
    },
    async bulkSetPermissionGrants(
      roleId: string,
      grants: Array<{ resourceCode: string; actionCode: string; isGranted: boolean }>
    ): Promise<void> {
      const existing = grantsStore.get(roleId) ?? [];
      for (const grant of grants) {
        const match = existing.find(
          (g) => g.resourceCode === grant.resourceCode && g.actionCode === grant.actionCode
        );
        if (match) {
          match.isGranted = grant.isGranted;
        } else {
          existing.push({
            id: nextId("grant"),
            roleId,
            resourceCode: grant.resourceCode,
            actionCode: grant.actionCode,
            isGranted: grant.isGranted,
            condition: null,
            createdAt: new Date(),
            createdBy: null,
          });
        }
      }
      grantsStore.set(roleId, existing);
    },
    async assignRoleToUser(
      data: InsertUserRoleAssignment
    ): Promise<UserRoleAssignment> {
      const assignment: UserRoleAssignment = {
        id: nextId("assignment"),
        orgId: data.orgId ?? null,
        userId: data.userId,
        roleId: data.roleId,
        assignedBy: data.assignedBy ?? null,
        isActive: data.isActive ?? true,
      };
      assignmentsStore.push(assignment);
      return assignment;
    },
    async listUserRoleAssignments(
      userId: string,
      orgId: string
    ): Promise<UserRoleAssignment[]> {
      return assignmentsStore.filter(
        (a) => a.userId === userId && a.orgId === orgId && a.isActive === true
      );
    },
    async removeRoleFromUser(
      userId: string,
      roleId: string,
      orgId: string
    ): Promise<boolean> {
      let removed = false;
      for (const a of assignmentsStore) {
        if (a.userId === userId && a.roleId === roleId && a.orgId === orgId) {
          a.isActive = false;
          removed = true;
        }
      }
      return removed;
    },
    async logPermissionChange(): Promise<void> {
      // Audit log is emitted via structured logging in production; no-op here.
    },
  } as Record<string, unknown>,
  {
    get(obj, prop: string) {
      if (prop in obj) return obj[prop];
      return async () => {
        throw new Error(`unexpected repo call: ${prop}`);
      };
    },
  }
);

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  jest.unstable_mockModule("../../server/domains/permissions/repository", () => ({
    permissionRepository: fakeRepository,
  }));

  // The CRUD paths never call compileUserPermissions, but routes.ts imports
  // it (and permissionService) at module load, so both must exist. The cache
  // invalidations are recorded so we can assert a grant/role mutation reaches
  // the cache layer.
  jest.unstable_mockModule("../../server/domains/permissions/service", () => ({
    compileUserPermissions: async () => ({
      userId: "unused",
      orgId: ORG,
      roles: [],
      grants: {},
      compiledAt: new Date(),
    }),
    permissionService: {
      invalidateOrgPermissionCache: (orgId: string) => {
        invalidations.org.push(orgId);
      },
      invalidateUserPermissionCache: (userId: string, orgId: string) => {
        invalidations.user.push({ userId, orgId });
      },
    },
  }));

  // The role-CRUD routes go through the repository, never `db` directly; the
  // stub only exists so the module-level `import { db } from "../../db"` in
  // routes.ts resolves without opening a Postgres connection.
  jest.unstable_mockModule("../../server/db", () => ({
    db: {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    },
  }));

  const express = (await import("express")).default;
  app = express();
  app.use(express.json());

  // Inject an authenticated admin user (id + primary role + org claim) from a
  // header so the real `requireOrgId` middleware admits the request.
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

const ADMIN = "admin-1:system_admin";

describe("Role CRUD routes — mounted", () => {
  it("registers without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("Role CRUD — create + read", () => {
  it("creates a role with a valid name (201) and echoes the persisted row", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .post("/api/permissions/roles")
      .set("x-test-user", ADMIN)
      .send({ name: "marine_tech", displayName: "Marine Technician", hierarchyLevel: 40 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      orgId: ORG,
      name: "marine_tech",
      displayName: "Marine Technician",
      hierarchyLevel: 40,
      isSystemRole: false,
      isActive: true,
    });
    expect(typeof res.body.id).toBe("string");
  });

  it("rejects an invalid role name (uppercase / spaces) with 400", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .post("/api/permissions/roles")
      .set("x-test-user", ADMIN)
      .send({ name: "Marine Tech", displayName: "Marine Technician" });

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    // No role should have been persisted from the rejected request.
    expect(rolesStore.size).toBe(0);
  });

  it("lists roles and fetches a single role by id with the expected shape", async () => {
    if (mountError) throw new Error(mountError);
    const created = await request(app)
      .post("/api/permissions/roles")
      .set("x-test-user", ADMIN)
      .send({ name: "deck_officer", displayName: "Deck Officer" });
    const id = created.body.id as string;

    const list = await request(app)
      .get("/api/permissions/roles")
      .set("x-test-user", ADMIN);
    expect(list.status).toBe(200);
    expect(list.body.map((r: Role) => r.id)).toContain(id);

    const one = await request(app)
      .get(`/api/permissions/roles/${id}`)
      .set("x-test-user", ADMIN);
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ id, name: "deck_officer", displayName: "Deck Officer" });
  });

  it("returns 404 for an unknown role id", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .get("/api/permissions/roles/does-not-exist")
      .set("x-test-user", ADMIN);
    expect(res.status).toBe(404);
  });
});

describe("Role CRUD — update + system-role protection", () => {
  it("renames a role and updates its display name (PUT, 200)", async () => {
    if (mountError) throw new Error(mountError);
    const role = seedRole({ name: "old_name", displayName: "Old Name" });

    const res = await request(app)
      .put(`/api/permissions/roles/${role.id}`)
      .set("x-test-user", ADMIN)
      .send({ name: "new_name", displayName: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: role.id, name: "new_name", displayName: "New Name" });
    expect(rolesStore.get(role.id)?.name).toBe("new_name");
    expect(invalidations.org).toContain(ORG);
  });

  it("blocks modifying a system role (PATCH, 400)", async () => {
    if (mountError) throw new Error(mountError);
    const sysRole = seedRole({ name: "system_admin", displayName: "System Admin", isSystemRole: true });

    const res = await request(app)
      .patch(`/api/permissions/roles/${sysRole.id}`)
      .set("x-test-user", ADMIN)
      .send({ displayName: "Hacked" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/system role/i);
    expect(rolesStore.get(sysRole.id)?.displayName).toBe("System Admin");
  });

  // Pins the intentional PUT-vs-PATCH asymmetry: PATCH guards system roles
  // (above), but PUT deliberately does NOT. If a future refactor adds a
  // system-role block to PUT as well, this test fails and forces a conscious
  // decision rather than a silent behavior change.
  it("allows updating a system role via PUT (no system-role guard on PUT, 200)", async () => {
    if (mountError) throw new Error(mountError);
    const sysRole = seedRole({ name: "system_admin", displayName: "System Admin", isSystemRole: true });

    const res = await request(app)
      .put(`/api/permissions/roles/${sysRole.id}`)
      .set("x-test-user", ADMIN)
      .send({ displayName: "System Administrator" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: sysRole.id, displayName: "System Administrator" });
    expect(rolesStore.get(sysRole.id)?.displayName).toBe("System Administrator");
  });

  it("returns 404 when updating an unknown role", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .put("/api/permissions/roles/missing")
      .set("x-test-user", ADMIN)
      .send({ displayName: "Whatever" });
    expect(res.status).toBe(404);
  });
});

describe("Role CRUD — permission grants", () => {
  it("sets permission grants and reads them back", async () => {
    if (mountError) throw new Error(mountError);
    const role = seedRole({ name: "engineer", displayName: "Engineer" });

    const put = await request(app)
      .put(`/api/permissions/roles/${role.id}/grants`)
      .set("x-test-user", ADMIN)
      .send({
        grants: [
          { resourceCode: "equipment", actionCode: "view", isGranted: true },
          { resourceCode: "equipment", actionCode: "edit", isGranted: true },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.success).toBe(true);
    expect(invalidations.org).toContain(ORG);

    const get = await request(app)
      .get(`/api/permissions/roles/${role.id}/grants`)
      .set("x-test-user", ADMIN);
    expect(get.status).toBe(200);
    const pairs = get.body.map(
      (g: PermissionGrant) => `${g.resourceCode}:${g.actionCode}:${g.isGranted}`
    );
    expect(pairs).toEqual(
      expect.arrayContaining(["equipment:view:true", "equipment:edit:true"])
    );
  });

  it("updates an existing grant in place rather than duplicating it", async () => {
    if (mountError) throw new Error(mountError);
    const role = seedRole({ name: "steward", displayName: "Steward" });

    await request(app)
      .put(`/api/permissions/roles/${role.id}/grants`)
      .set("x-test-user", ADMIN)
      .send([{ resourceCode: "inventory", actionCode: "view", isGranted: true }]);
    await request(app)
      .put(`/api/permissions/roles/${role.id}/grants`)
      .set("x-test-user", ADMIN)
      .send([{ resourceCode: "inventory", actionCode: "view", isGranted: false }]);

    const get = await request(app)
      .get(`/api/permissions/roles/${role.id}/grants`)
      .set("x-test-user", ADMIN);
    const invGrants = get.body.filter(
      (g: PermissionGrant) => g.resourceCode === "inventory" && g.actionCode === "view"
    );
    expect(invGrants).toHaveLength(1);
    expect(invGrants[0].isGranted).toBe(false);
  });

  it("returns 404 when setting grants for an unknown role", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .put("/api/permissions/roles/missing/grants")
      .set("x-test-user", ADMIN)
      .send([{ resourceCode: "equipment", actionCode: "view", isGranted: true }]);
    expect(res.status).toBe(404);
  });
});

describe("Role CRUD — assignment", () => {
  it("assigns the role to a user (201) and reflects it in the user's assignments", async () => {
    if (mountError) throw new Error(mountError);
    const role = seedRole({ name: "fleet_manager", displayName: "Fleet Manager" });
    const userId = "user-42";

    const assign = await request(app)
      .post(`/api/permissions/users/${userId}/assignments`)
      .set("x-test-user", ADMIN)
      .send({ roleId: role.id });
    expect(assign.status).toBe(201);
    expect(assign.body).toMatchObject({ userId, roleId: role.id, orgId: ORG });
    expect(invalidations.user).toContainEqual({ userId, orgId: ORG });

    const list = await request(app)
      .get(`/api/permissions/users/${userId}/assignments`)
      .set("x-test-user", ADMIN);
    expect(list.status).toBe(200);
    expect(list.body.map((a: UserRoleAssignment) => a.roleId)).toContain(role.id);
  });
});

describe("Role CRUD — delete (soft) with guardrails", () => {
  it("blocks deleting a system role (400)", async () => {
    if (mountError) throw new Error(mountError);
    const sysRole = seedRole({ name: "company_admin", displayName: "Company Admin", isSystemRole: true });

    const res = await request(app)
      .delete(`/api/permissions/roles/${sysRole.id}`)
      .set("x-test-user", ADMIN);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/system role/i);
    expect(rolesStore.get(sysRole.id)?.isActive).toBe(true);
  });

  it("blocks deleting a role while crew are still assigned to it (400 + crewCount)", async () => {
    if (mountError) throw new Error(mountError);
    const role = seedRole({ name: "bosun", displayName: "Bosun" });
    crewCountStore.set(role.id, 2);

    const res = await request(app)
      .delete(`/api/permissions/roles/${role.id}`)
      .set("x-test-user", ADMIN);
    expect(res.status).toBe(400);
    expect(res.body.crewCount).toBe(2);
    expect(rolesStore.get(role.id)?.isActive).toBe(true);
  });

  it("soft-deletes the role once no crew are assigned (204) and drops it from the list", async () => {
    if (mountError) throw new Error(mountError);
    const role = seedRole({ name: "cadet", displayName: "Cadet" });
    crewCountStore.set(role.id, 0);

    const del = await request(app)
      .delete(`/api/permissions/roles/${role.id}`)
      .set("x-test-user", ADMIN);
    expect(del.status).toBe(204);
    expect(rolesStore.get(role.id)?.isActive).toBe(false);
    expect(invalidations.org).toContain(ORG);

    const list = await request(app)
      .get("/api/permissions/roles")
      .set("x-test-user", ADMIN);
    expect(list.body.map((r: Role) => r.id)).not.toContain(role.id);
  });

  it("returns 404 when deleting an unknown role", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .delete("/api/permissions/roles/missing")
      .set("x-test-user", ADMIN);
    expect(res.status).toBe(404);
  });
});

describe("Role CRUD — auth gate", () => {
  it("rejects an unauthenticated caller with 401", async () => {
    if (mountError) throw new Error(mountError);
    const res = await request(app)
      .post("/api/permissions/roles")
      .send({ name: "ghost", displayName: "Ghost" });
    expect(res.status).toBe(401);
    expect(rolesStore.size).toBe(0);
  });
});
