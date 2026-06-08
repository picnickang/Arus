/**
 * Hub-admin grant — PATCH /api/admin/crew/users/:id/hub-access (Task #245).
 *
 * Pins the security-relevant route contract for granting/revoking the
 * per-account hub-admin grant at the HTTP boundary:
 *   - super-admin targets are rejected as not-editable (409 ADMIN_ROLE_PROTECTED);
 *   - granting hub-admin to a non-eligible (below-manager) role is rejected
 *     (400 ROLE_NOT_ELIGIBLE);
 *   - unknown hub ids in the allow-list are rejected by the body schema (400);
 *   - a valid grant (allow-list normalised) and a revoke both persist and are
 *     written to the immutable audit trail.
 *
 * Runs without Postgres: the real `CrewAdminApplicationService` (so the
 * guardrail logic is genuinely exercised) is composed with an in-memory fake
 * repository, and the audit service is mocked to record `logEvent` calls.
 * Mocked via `jest.unstable_mockModule` + dynamic import because the
 * integration suite runs under `--experimental-vm-modules` (ESM), where a
 * hoisted `jest.mock` factory is not invoked — same pattern as
 * `safety-bulletins.test.ts`.
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
import type { CrewUserSummary } from "../../server/domains/crew-admin/domain/types";

const ORG = "test-org-hub-access";

type HubGrantCall = {
  orgId: string;
  userId: string;
  hubAdmin: boolean;
  hubAccess: string[] | null;
};

type AuditCall = Record<string, unknown>;

let targetUser: CrewUserSummary | undefined;
let lastGrant: HubGrantCall | undefined;
const grantCalls: HubGrantCall[] = [];
const auditCalls: AuditCall[] = [];

function makeUser(overrides: Partial<CrewUserSummary> = {}): CrewUserSummary {
  return {
    id: "user-target",
    email: "target@test.local",
    name: "Target",
    username: "target",
    role: "fleet_manager",
    isActive: true,
    loginEnabled: true,
    mustChangePassword: false,
    hasPassword: true,
    lastLoginAt: null,
    passwordUpdatedAt: null,
    supervisorUserId: null,
    assignments: [],
    assignedRoleNames: [],
    ...overrides,
  };
}

// In-memory repository: only the methods `setHubAccess` reaches are real;
// the rest throw so an unexpected codepath is loud rather than silent.
const fakeRepo = new Proxy(
  {
    async findUser(): Promise<CrewUserSummary | undefined> {
      return targetUser;
    },
    async setHubAccessGrant(
      orgId: string,
      userId: string,
      hubAdmin: boolean,
      hubAccess: string[] | null,
    ): Promise<void> {
      lastGrant = { orgId, userId, hubAdmin, hubAccess };
      grantCalls.push(lastGrant);
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

  // Replace the composed singleton with a service wired to the fake repo,
  // re-exporting the REAL error class so the route's `instanceof` check
  // (and its status mapping) behaves exactly as in production.
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
  targetUser = makeUser();
  lastGrant = undefined;
  grantCalls.length = 0;
  auditCalls.length = 0;
});

const PATH = "/api/admin/crew/users/user-target/hub-access";

describe("hub-access route — mounted", () => {
  it("registers without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("PATCH hub-access — authz gate", () => {
  it("rejects a non-super-admin caller with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", "caller-fm:fleet_manager")
      .send({ hubAdmin: true });
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("INSUFFICIENT_PERMISSIONS");
    expect(grantCalls).toHaveLength(0);
  });

  it("rejects an unauthenticated caller with 401", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app).patch(PATH).send({ hubAdmin: true });
    expect(res.status).toBe(401);
    expect(grantCalls).toHaveLength(0);
  });
});

describe("PATCH hub-access — guardrails (admin caller)", () => {
  const adminHeader = "caller-admin:system_admin";

  it("rejects editing a super-admin target with 409 ADMIN_ROLE_PROTECTED", async () => {
    if (mountError) {throw new Error(mountError);}
    targetUser = makeUser({ role: "company_admin" });
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      .send({ hubAdmin: true, hubAccess: ["operations"] });
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("ADMIN_ROLE_PROTECTED");
    expect(grantCalls).toHaveLength(0);
    expect(auditCalls).toHaveLength(0);
  });

  it("rejects granting hub-admin to a non-eligible role with 400 ROLE_NOT_ELIGIBLE", async () => {
    if (mountError) {throw new Error(mountError);}
    targetUser = makeUser({ role: "technician" });
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      .send({ hubAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe("ROLE_NOT_ELIGIBLE");
    expect(grantCalls).toHaveLength(0);
    expect(auditCalls).toHaveLength(0);
  });

  it("rejects an unknown hub id in the allow-list with 400 (body schema)", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      .send({ hubAdmin: true, hubAccess: ["operations", "not-a-hub"] });
    expect(res.status).toBe(400);
    expect(grantCalls).toHaveLength(0);
  });

  it("returns 404 when the target user does not exist", async () => {
    if (mountError) {throw new Error(mountError);}
    targetUser = undefined;
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      .send({ hubAdmin: false });
    expect(res.status).toBe(404);
    expect(grantCalls).toHaveLength(0);
  });
});

describe("PATCH hub-access — grant / revoke persistence + audit", () => {
  const adminHeader = "caller-admin:system_admin";

  it("persists a valid grant with a normalised partial allow-list and audits it", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      .send({ hubAdmin: true, hubAccess: ["operations", "fleet"] });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(lastGrant).toMatchObject({
      orgId: ORG,
      userId: "user-target",
      hubAdmin: true,
      hubAccess: ["operations", "fleet"],
    });
    expect(auditCalls).toHaveLength(1);
    const audit = auditCalls[0]!;
    expect(audit.eventType).toBe("permission_changed");
    expect(audit.entityType).toBe("user");
    expect(audit.entityId).toBe("user-target");
    expect(audit.performedBy).toBe("caller-admin");
    expect(audit.newState).toMatchObject({
      hubAdmin: true,
      hubAccess: ["operations", "fleet"],
    });
  });

  it("collapses a full allow-list to null (= all hubs) on grant", async () => {
    if (mountError) {throw new Error(mountError);}
    const { HUB_IDS } = await import("@shared/role-dashboard");
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      .send({ hubAdmin: true, hubAccess: [...HUB_IDS] });
    expect(res.status).toBe(200);
    expect(lastGrant?.hubAdmin).toBe(true);
    expect(lastGrant?.hubAccess).toBeNull();
  });

  it("revokes the grant: hubAdmin=false clears the allow-list to null and audits it", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .patch(PATH)
      .set("x-test-user", adminHeader)
      // Even if an allow-list is passed, revoking must store null.
      .send({ hubAdmin: false, hubAccess: ["operations"] });
    expect(res.status).toBe(200);
    expect(lastGrant).toMatchObject({
      hubAdmin: false,
      hubAccess: null,
    });
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]!.newState).toMatchObject({ hubAdmin: false });
  });
});
