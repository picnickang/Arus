/**
 * Role hub-access — PATCH /api/admin/crew/roles/:id/hub-access audit contract.
 *
 * Pins that a ROLE-level hub-access change writes a COMPLETE before -> after
 * record to the immutable audit trail (eventType "permission_changed"), not
 * just the resulting state. The `previousState` is the role's hub grant as it
 * stood before the mutation; `newState` is the persisted result. This is what
 * makes the change reviewable (and reversible-by-inspection) in the unified
 * Roles & Dashboards audit surface.
 *
 * Runs without Postgres: the real `CrewAdminApplicationService` (so the
 * before-state capture + normalisation are genuinely exercised) is composed
 * with an in-memory fake repository, and the audit service is mocked to record
 * `logEvent` calls. Mocked via `jest.unstable_mockModule` + dynamic import
 * because the integration suite runs under `--experimental-vm-modules` (ESM),
 * where a hoisted `jest.mock` factory is not invoked — same pattern as
 * `hub-admin-grant-route.test.ts`.
 */

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
  RequestHandler,
  Response,
} from "express";
import request from "supertest";
import type { RoleSummary } from "../../server/domains/crew-admin/domain/types";

const ORG = "test-org-role-hub-access";

type RoleHubGrantCall = {
  orgId: string;
  id: string;
  hubAdmin: boolean;
  hubAccess: string[] | null;
};

type AuditCall = Record<string, unknown>;

// The role's state BEFORE the mutation (what findRoleById returns).
let priorRole: RoleSummary | undefined;
let lastGrant: RoleHubGrantCall | undefined;
const grantCalls: RoleHubGrantCall[] = [];
const auditCalls: AuditCall[] = [];

function makeRole(overrides: Partial<RoleSummary> = {}): RoleSummary {
  return {
    id: "role-target",
    name: "fleet_manager",
    displayName: "Fleet Manager",
    description: null,
    department: null,
    hierarchyLevel: 3,
    isSystemRole: false,
    isProtected: false,
    isActive: true,
    assignedUserCount: 0,
    hubAdmin: true,
    hubAccess: ["operations"],
    ...overrides,
  };
}

// In-memory repository: only the methods the service path reaches are real;
// the rest throw so an unexpected codepath is loud rather than silent.
const fakeRepo = new Proxy(
  {
    async findRoleById(): Promise<RoleSummary | undefined> {
      return priorRole;
    },
    async setRoleHubAccess(
      orgId: string,
      id: string,
      hubAdmin: boolean,
      hubAccess: string[] | null,
    ): Promise<RoleSummary> {
      lastGrant = { orgId, id, hubAdmin, hubAccess };
      grantCalls.push(lastGrant);
      // Echo the persisted (normalised) state back as the updated role.
      return makeRole({ id, hubAdmin, hubAccess });
    },
  } as Record<string, unknown>,
  {
    get(obj, prop: string) {
      if (prop in obj) {return obj[prop];}
      return async () => {
        throw new Error(`unexpected repo call: ${prop}`);
      };
    },
  },
);

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  const { CrewAdminApplicationService, CrewAdminError } = await import(
    "../../server/domains/crew-admin/application/crew-admin-service"
  );

  jest.unstable_mockModule("../../server/domains/crew-admin/service", () => ({
    crewAdminService: new CrewAdminApplicationService(
      fakeRepo as unknown as ConstructorParameters<
        typeof CrewAdminApplicationService
      >[0],
    ),
    CrewAdminError,
  }));

  jest.unstable_mockModule("../../server/compliance/immutable-audit", () => ({
    auditService: {
      logEvent: async (event: AuditCall) => {
        auditCalls.push(event);
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

  const passthrough: RequestHandler = (_req, _res, next) => next();

  try {
    const mod = await import(
      "../../server/domains/crew-admin/interfaces/routes"
    );
    mod.registerCrewAdminRoutes(app, {
      generalApiRateLimit: passthrough,
      writeOperationRateLimit: passthrough,
    });
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

beforeEach(() => {
  priorRole = makeRole();
  lastGrant = undefined;
  grantCalls.length = 0;
  auditCalls.length = 0;
});

const PATH = "/api/admin/crew/roles/role-target/hub-access";
const adminHeader = "caller-admin:system_admin";

describe("role hub-access route — mounted", () => {
  it("registers without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("PATCH role hub-access — before -> after audit", () => {
  it("records BOTH previousState and newState on a hub-access change", async () => {
    if (mountError) {throw new Error(mountError);}
    // Prior: admin with only "operations". Change to operations + fleet.
    priorRole = makeRole({ hubAdmin: true, hubAccess: ["operations"] });
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      .send({ hubAdmin: true, hubAccess: ["operations", "fleet"] });

    expect(res.status).toBe(200);
    expect(lastGrant).toMatchObject({
      orgId: ORG,
      id: "role-target",
      hubAdmin: true,
      hubAccess: ["operations", "fleet"],
    });

    expect(auditCalls).toHaveLength(1);
    const audit = auditCalls[0]!;
    expect(audit["eventType"]).toBe("permission_changed");
    expect(audit["entityType"]).toBe("role");
    expect(audit["entityId"]).toBe("role-target");
    expect(audit["performedBy"]).toBe("caller-admin");
    // The before-state is the role as it stood prior to the mutation...
    expect(audit["previousState"]).toMatchObject({
      hubAdmin: true,
      hubAccess: ["operations"],
    });
    // ...and the after-state is the persisted result.
    expect(audit["newState"]).toMatchObject({
      hubAdmin: true,
      hubAccess: ["operations", "fleet"],
    });
  });

  it("captures previousState when revoking all hub access (empty -> kept distinct from null)", async () => {
    if (mountError) {throw new Error(mountError);}
    // Prior: admin with a partial list. Now revoke to no hubs ([]).
    priorRole = makeRole({ hubAdmin: true, hubAccess: ["operations"] });
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      .send({ hubAdmin: true, hubAccess: [] });

    expect(res.status).toBe(200);
    // [] (admin, no hubs) must persist as [], never collapse to null.
    expect(lastGrant?.hubAccess).toEqual([]);
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]!["previousState"]).toMatchObject({
      hubAccess: ["operations"],
    });
    expect(auditCalls[0]!["newState"]).toMatchObject({ hubAccess: [] });
  });
});
