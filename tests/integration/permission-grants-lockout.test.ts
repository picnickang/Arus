/**
 * Permission-grant lockout guard — PUT /api/permissions/roles/:id/grants.
 *
 * The grant-update route must refuse any change that would remove the org's
 * ability to administer access. Two failure modes are pinned here:
 *
 *   (a) Org lockout  — revoking `permission_management:edit` from the LAST
 *       role in the org that holds it (no role left can manage permissions).
 *   (b) Self lockout — an acting admin revoking that capability from their
 *       own (only) manage-capable role, even though another org role keeps it.
 *
 * A third case confirms the change is allowed when the actor retains the
 * capability through a second role. Without these guards an administrator can
 * silently strip every path back into permission management.
 *
 * Runs without Postgres: the real permission router is composed against a
 * mocked `./service`, an in-memory `./repository`, a stub `../../db`, and a
 * stub immutable-audit service. Mocked via `jest.unstable_mockModule` +
 * dynamic import because the integration suite runs under
 * `--experimental-vm-modules` (ESM), where a hoisted `jest.mock` factory is
 * not invoked — same pattern as `role-crud-workflow.test.ts`.
 */

process.env["NODE_ENV"] = "test";

import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals";
import type { Express, NextFunction, Request, Response } from "express";
import request from "supertest";
import type { Role, PermissionGrant, UserRoleAssignment } from "../../shared/schema/permissions";

const ORG = "test-org-lockout";
const MANAGE_RESOURCE = "permission_management";
const MANAGE_ACTION = "edit";

let rolesStore: Map<string, Role>;
let grantsStore: Map<string, PermissionGrant[]>;
let assignmentsStore: UserRoleAssignment[];
let auditEvents: Array<Record<string, unknown>>;
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
    hubAdmin: overrides.hubAdmin ?? false,
    hubAccess: overrides.hubAccess ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
  rolesStore.set(id, role);
  return role;
}

function seedManageGrant(roleId: string, isGranted: boolean): void {
  const list = grantsStore.get(roleId) ?? [];
  list.push({
    id: nextId("grant"),
    roleId,
    resourceCode: MANAGE_RESOURCE,
    actionCode: MANAGE_ACTION,
    isGranted,
    condition: null,
    createdAt: new Date(),
    createdBy: null,
  });
  grantsStore.set(roleId, list);
}

function assign(userId: string, roleId: string): void {
  assignmentsStore.push({
    id: nextId("assignment"),
    orgId: ORG,
    userId,
    roleId,
    assignedBy: null,
    isActive: true,
  });
}

beforeEach(() => {
  rolesStore = new Map();
  grantsStore = new Map();
  assignmentsStore = [];
  auditEvents = [];
  idCounter = 0;
});

const fakeRepository = new Proxy(
  {
    async getRoleById(id: string, orgId: string): Promise<Role | undefined> {
      const role = rolesStore.get(id);
      return role && role.orgId === orgId ? role : undefined;
    },
    async listRoles(orgId: string): Promise<Role[]> {
      return Array.from(rolesStore.values()).filter(
        (r) => r.orgId === orgId && r.isActive === true
      );
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
    async listUserRoleAssignments(userId: string, orgId: string): Promise<UserRoleAssignment[]> {
      return assignmentsStore.filter(
        (a) => a.userId === userId && a.orgId === orgId && a.isActive === true
      );
    },
    async logPermissionChange(): Promise<void> {
      // Structured-log audit is a no-op in tests.
    },
  } as Record<string, unknown>,
  {
    get(obj, prop: string) {
      if (prop in obj) {
        return obj[prop];
      }
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
    // routes.ts imports these named queries at module load (hex-storage
    // refactor moved the inline db reads into the repository). The lockout
    // paths under test never call them.
    getUserPrimaryRole: async () => undefined,
    getUserDiagnosticRow: async () => undefined,
    getCrewLinkForUser: async () => undefined,
  }));

  jest.unstable_mockModule("../../server/domains/permissions/service", () => ({
    compileUserPermissions: async () => ({
      userId: "unused",
      orgId: ORG,
      roles: [],
      grants: {},
      compiledAt: new Date(),
    }),
    permissionService: {
      authorize: async () => ({ allowed: true }),
      hasAnyPermission: async () => true,
      hasAllPermissions: async () => true,
      invalidateOrgPermissionCache: () => {},
      invalidateUserPermissionCache: () => {},
    },
  }));

  jest.unstable_mockModule("../../server/db", () => ({
    db: {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    },
    pool: {
      query: jest.fn(async () => ({ rows: [] })),
      end: jest.fn(async () => {}),
    },
    libsqlClient: null,
  }));

  // Capture immutable-audit events without pulling in the db-heavy real service.
  jest.unstable_mockModule("../../server/compliance/immutable-audit.service", () => ({
    auditService: {
      logEvent: async (input: Record<string, unknown>) => {
        auditEvents.push(input);
        return input;
      },
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

  try {
    const mod = await import("../../server/domains/permissions/routes");
    mod.registerPermissionRoutes(app);
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

const ADMIN = "admin-1:system_admin";

describe("Permission-grant lockout guard — mounted", () => {
  it("registers without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("Org-wide lockout", () => {
  it("rejects revoking manage from the org's last manage-capable role (400)", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const onlyRole = seedRole({ name: "access_admin" });
    seedManageGrant(onlyRole.id, true);

    const res = await request(app)
      .put(`/api/permissions/roles/${onlyRole.id}/grants`)
      .set("x-test-user", ADMIN)
      .send([{ resourceCode: MANAGE_RESOURCE, actionCode: MANAGE_ACTION, isGranted: false }]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last role/i);
    // Nothing persisted, nothing audited.
    const after = grantsStore.get(onlyRole.id) ?? [];
    expect(after.some((g) => g.actionCode === MANAGE_ACTION && g.isGranted === false)).toBe(false);
    expect(auditEvents).toHaveLength(0);
  });
});

describe("Acting-admin self lockout", () => {
  it("rejects an admin revoking manage from their own only manage role (400)", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    // Two roles can manage; org-wide check passes, but the actor only holds roleA.
    const roleA = seedRole({ name: "access_admin" });
    const roleB = seedRole({ name: "ops_admin" });
    seedManageGrant(roleA.id, true);
    seedManageGrant(roleB.id, true);
    assign("admin-1", roleA.id);

    const res = await request(app)
      .put(`/api/permissions/roles/${roleA.id}/grants`)
      .set("x-test-user", ADMIN)
      .send([{ resourceCode: MANAGE_RESOURCE, actionCode: MANAGE_ACTION, isGranted: false }]);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/your own/i);
    expect(auditEvents).toHaveLength(0);
  });
});

describe("Allowed revoke", () => {
  it("allows revoking manage from one role when the actor keeps it via another (200)", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const roleA = seedRole({ name: "access_admin" });
    const roleB = seedRole({ name: "ops_admin" });
    seedManageGrant(roleA.id, true);
    seedManageGrant(roleB.id, true);
    // Actor holds BOTH manage-capable roles, so losing it on roleA is fine.
    assign("admin-1", roleA.id);
    assign("admin-1", roleB.id);

    const res = await request(app)
      .put(`/api/permissions/roles/${roleA.id}/grants`)
      .set("x-test-user", ADMIN)
      .send([{ resourceCode: MANAGE_RESOURCE, actionCode: MANAGE_ACTION, isGranted: false }]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Change persisted and a before -> after audit event recorded.
    const after = grantsStore.get(roleA.id) ?? [];
    expect(after.some((g) => g.actionCode === MANAGE_ACTION && g.isGranted === false)).toBe(true);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      orgId: ORG,
      eventType: "permission_changed",
      entityType: "role",
      entityId: roleA.id,
    });
  });

  it("does not engage the guard for non-manage grant changes (200)", async () => {
    if (mountError) {
      throw new Error(mountError);
    }
    const role = seedRole({ name: "engineer" });

    const res = await request(app)
      .put(`/api/permissions/roles/${role.id}/grants`)
      .set("x-test-user", ADMIN)
      .send([{ resourceCode: "equipment", actionCode: "view", isGranted: false }]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
