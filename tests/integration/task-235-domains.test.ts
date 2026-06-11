/**
 * Task #235 — Crew Management, Safety Alarms, and Me-Portal route contracts.
 *
 * Pins the HTTP boundary for the three cloud-only hexagonal domains that
 * back the role-aware User page + admin Crew Management:
 *   - crew-admin   (/api/admin/crew/*, /api/admin/role-dashboards/*)
 *   - safety-alarms(/api/admin/safety-alarm-types/*, /api/admin/safety-alarms/*)
 *   - me-portal    (/api/portal/login — the public regular-user login)
 *
 * Same pattern as `safety-bulletins.test.ts`: services are stubbed via
 * `jest.unstable_mockModule` (ESM `--experimental-vm-modules`), an auth
 * shim sets `req.user`/`req.orgId` from an `x-test-user` header, and the
 * REAL `requireOrgId` + `requireRole` middleware enforce the gates. The
 * audit service is stubbed so the routes' fire-and-forget `logEvent`
 * calls never touch Postgres.
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

const ORG = "test-org-task-235";

let setWebSocketServer: (server: unknown) => void;

class CrewAdminError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "CrewAdminError";
  }
}
class AlarmValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AlarmValidationError";
  }
}
class MePortalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "MePortalError";
  }
}

const crewStub = {
  listRoles: jest.fn<(orgId: string) => Promise<unknown[]>>(),
  createRole: jest.fn<(input: Record<string, unknown>) => Promise<{ id: string; name: string }>>(),
  updateRole: jest.fn(),
  deleteRole: jest.fn<(orgId: string, id: string) => Promise<void>>(),
  listDashboardConfigs: jest.fn(),
  getDashboardConfig: jest.fn(),
  saveDashboardConfig: jest.fn(),
  resetDashboardConfig: jest.fn(),
  listUsers: jest.fn(),
  getAssignments: jest.fn(),
  setAssignments: jest.fn(),
  changeRole: jest.fn(),
  setLoginEnabled: jest.fn(),
  setCredentials: jest.fn<(input: Record<string, unknown>) => Promise<void>>(),
  resetPassword: jest.fn(),
};

const alarmStub = {
  listTypes: jest.fn(),
  createType: jest.fn<(input: Record<string, unknown>) => Promise<{ id: string; key: string; displayName: string }>>(),
  updateType: jest.fn(),
  deleteType: jest.fn(),
  listAlarms: jest.fn(),
  triggerAlarm: jest.fn<(input: Record<string, unknown>, confirmed: boolean) => Promise<Record<string, unknown>>>(),
  clearAlarm: jest.fn(),
};

const meStub = {
  login: jest.fn<(orgId: string, username: string, password: string, ctx: unknown) => Promise<unknown>>(),
  getDashboard: jest.fn(),
  getTasks: jest.fn(),
  getVisibleAlarms: jest.fn(),
  acknowledgeAlarm: jest.fn(),
  changePassword: jest.fn(),
};

let lastCreateRoleArg: Record<string, unknown> | undefined;
let lastCredentialsArg: Record<string, unknown> | undefined;
let lastTriggerArg: { input: Record<string, unknown>; confirmed: boolean } | undefined;
let lastLoginArgs: { orgId: string; username: string; password: string } | undefined;

let app: Express;
let mountError: string | undefined;

beforeAll(async () => {
  jest.unstable_mockModule("../../server/compliance/immutable-audit", () => ({
    auditService: { logEvent: jest.fn(async () => undefined) },
  }));

  jest.unstable_mockModule("../../server/security/authentication", () => ({
    requireAuthentication: (_req: Request, _res: Response, next: NextFunction) => next(),
  }));

  jest.unstable_mockModule("../../server/domains/crew-admin/service", () => ({
    crewAdminService: {
      ...crewStub,
      createRole: (input: Record<string, unknown>) => {
        lastCreateRoleArg = input;
        return crewStub.createRole(input);
      },
      setCredentials: (input: Record<string, unknown>) => {
        lastCredentialsArg = input;
        return crewStub.setCredentials(input);
      },
    },
    CrewAdminError,
  }));

  jest.unstable_mockModule("../../server/domains/safety-alarms/service", () => ({
    safetyAlarmService: {
      ...alarmStub,
      triggerAlarm: (input: Record<string, unknown>, confirmed: boolean) => {
        lastTriggerArg = { input, confirmed };
        return alarmStub.triggerAlarm(input, confirmed);
      },
    },
    AlarmValidationError,
  }));

  jest.unstable_mockModule("../../server/domains/me-portal/me-portal-service", () => ({
    mePortalService: {
      ...meStub,
      login: (orgId: string, username: string, password: string, ctx: unknown) => {
        lastLoginArgs = { orgId, username, password };
        return meStub.login(orgId, username, password, ctx);
      },
    },
    MePortalError,
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
        name: id,
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
    const crew = await import("../../server/domains/crew-admin/interfaces/routes");
    crew.registerCrewAdminRoutes(app, {
      generalApiRateLimit: passthrough,
      writeOperationRateLimit: passthrough,
    });
    const alarms = await import("../../server/domains/safety-alarms/interfaces/routes");
    alarms.registerSafetyAlarmRoutes(app, {
      generalApiRateLimit: passthrough,
      writeOperationRateLimit: passthrough,
    });
    const me = await import("../../server/domains/me-portal/routes");
    me.registerMePortalRoutes(app, {
      generalApiRateLimit: passthrough,
      loginRateLimit: passthrough,
    });
    const wsServer = await import("../../server/websocket-server");
    setWebSocketServer = wsServer.setWebSocketServer as unknown as (server: unknown) => void;
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

beforeEach(() => {
  Object.values(crewStub).forEach((fn) => fn.mockReset());
  Object.values(alarmStub).forEach((fn) => fn.mockReset());
  Object.values(meStub).forEach((fn) => fn.mockReset());
  lastCreateRoleArg = undefined;
  lastCredentialsArg = undefined;
  lastTriggerArg = undefined;
  lastLoginArgs = undefined;

  crewStub.listRoles.mockResolvedValue([]);
  crewStub.createRole.mockResolvedValue({ id: "role-1", name: "deckhand" });
  crewStub.deleteRole.mockResolvedValue(undefined);
  crewStub.setCredentials.mockResolvedValue(undefined);
  alarmStub.createType.mockResolvedValue({ id: "type-1", key: "fire", displayName: "Fire" });
  alarmStub.triggerAlarm.mockResolvedValue({
    id: "alarm-1",
    severity: "critical",
    mode: "real",
    title: "Fire",
    vesselId: null,
  });
  meStub.login.mockResolvedValue({ token: "t", mustChangePassword: false });
});

describe("routes mounted", () => {
  it("registers all three domains without error", () => {
    expect(mountError).toBeUndefined();
  });
});

describe("crew-admin — admin gate", () => {
  it("rejects deck_officer on GET roles with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .get("/api/admin/crew/roles")
      .set("x-test-user", "u-deck:deck_officer");
    expect(res.status).toBe(403);
    expect(crewStub.listRoles).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated on GET roles with 401", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app).get("/api/admin/crew/roles");
    expect(res.status).toBe(401);
  });

  for (const role of ["system_admin", "company_admin", "admin"]) {
    it(`allows ${role} to list roles (org-scoped)`, async () => {
      if (mountError) {throw new Error(mountError);}
      const res = await request(app)
        .get("/api/admin/crew/roles")
        .set("x-test-user", `a-${role}:${role}`);
      expect(res.status).toBe(200);
      expect(crewStub.listRoles).toHaveBeenCalledWith(ORG);
    });
  }
});

describe("crew-admin — role create validation + safe-delete", () => {
  it("rejects an invalid role name (uppercase) with 400", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/crew/roles")
      .set("x-test-user", "a1:admin")
      .send({ name: "BadName", displayName: "Bad Name" });
    expect(res.status).toBe(400);
    expect(crewStub.createRole).not.toHaveBeenCalled();
  });

  it("creates a valid role scoped to the caller's org", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/crew/roles")
      .set("x-test-user", "a1:admin")
      .send({ name: "deckhand", displayName: "Deck Hand" });
    expect(res.status).toBe(201);
    expect(lastCreateRoleArg?.["orgId"]).toBe(ORG);
    expect(lastCreateRoleArg?.["name"]).toBe("deckhand");
  });

  it("maps ROLE_IN_USE delete conflict to 409", async () => {
    if (mountError) {throw new Error(mountError);}
    crewStub.deleteRole.mockRejectedValueOnce(
      new CrewAdminError("Role still assigned", "ROLE_IN_USE"),
    );
    const res = await request(app)
      .delete("/api/admin/crew/roles/role-9")
      .set("x-test-user", "a1:admin");
    expect(res.status).toBe(409);
    expect(res.body?.code).toBe("ROLE_IN_USE");
  });
});

describe("crew-admin — credential admin", () => {
  it("rejects a short password with 400 before calling the service", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/crew/users/user-7/credentials")
      .set("x-test-user", "a1:admin")
      .send({ password: "short" });
    expect(res.status).toBe(400);
    expect(crewStub.setCredentials).not.toHaveBeenCalled();
  });

  it("sets credentials with the userId from the path and the caller's org", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/crew/users/user-7/credentials")
      .set("x-test-user", "a1:admin")
      .send({ username: "jdoe", password: "longenough1" });
    expect(res.status).toBe(200);
    expect(lastCredentialsArg?.["orgId"]).toBe(ORG);
    expect(lastCredentialsArg?.["userId"]).toBe("user-7");
    expect(lastCredentialsArg?.["username"]).toBe("jdoe");
  });

  it("rejects deck_officer from resetting a password with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/crew/users/user-7/reset-password")
      .set("x-test-user", "u-deck:deck_officer")
      .send({ password: "longenough1" });
    expect(res.status).toBe(403);
  });
});

describe("safety-alarms — write gate + trigger", () => {
  it("rejects deck_officer from triggering an alarm with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/safety-alarms")
      .set("x-test-user", "u-deck:deck_officer")
      .send({ alarmTypeId: "type-1" });
    expect(res.status).toBe(403);
    expect(alarmStub.triggerAlarm).not.toHaveBeenCalled();
  });

  it("rejects a trigger missing alarmTypeId with 400", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/safety-alarms")
      .set("x-test-user", "cap:captain")
      .send({ title: "No type" });
    expect(res.status).toBe(400);
    expect(alarmStub.triggerAlarm).not.toHaveBeenCalled();
  });

  for (const role of ["captain", "chief_engineer", "fleet_manager", "system_admin"]) {
    it(`allows ${role} to trigger an alarm`, async () => {
      if (mountError) {throw new Error(mountError);}
      const res = await request(app)
        .post("/api/admin/safety-alarms")
        .set("x-test-user", `w-${role}:${role}`)
        .send({ alarmTypeId: "type-1", confirmed: true });
      expect(res.status).toBe(201);
      expect(lastTriggerArg?.input["orgId"]).toBe(ORG);
      expect(lastTriggerArg?.confirmed).toBe(true);
    });
  }

  it("maps CONFIRMATION_REQUIRED to 428", async () => {
    if (mountError) {throw new Error(mountError);}
    alarmStub.triggerAlarm.mockRejectedValueOnce(
      new AlarmValidationError("Confirm critical alarm", "CONFIRMATION_REQUIRED"),
    );
    const res = await request(app)
      .post("/api/admin/safety-alarms")
      .set("x-test-user", "cap:captain")
      .send({ alarmTypeId: "type-1" });
    expect(res.status).toBe(428);
    expect(res.body?.code).toBe("CONFIRMATION_REQUIRED");
  });

  // Mode is constrained to the shared ALARM_MODES enum (real|drill|test)
  // at the route boundary — a legacy/invalid literal like "live" must be
  // rejected with 400 before the service ever runs.
  it("rejects an invalid alarm mode with 400", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/safety-alarms")
      .set("x-test-user", "cap:captain")
      .send({ alarmTypeId: "type-1", mode: "live" });
    expect(res.status).toBe(400);
    expect(alarmStub.triggerAlarm).not.toHaveBeenCalled();
  });

  // Realtime fan-out: a successful trigger must publish a tenant-scoped
  // WebSocket frame on the `safety-alarms` channel (polling is only the
  // fallback). We inject a fake WS server and assert the emission path.
  it("broadcasts a tenant-scoped WebSocket event on trigger", async () => {
    if (mountError) {throw new Error(mountError);}
    const broadcast = jest.fn();
    setWebSocketServer({ broadcast });
    try {
      const res = await request(app)
        .post("/api/admin/safety-alarms")
        .set("x-test-user", "cap:captain")
        .send({ alarmTypeId: "type-1", confirmed: true });
      expect(res.status).toBe(201);
      expect(broadcast).toHaveBeenCalledWith(
        "safety-alarms",
        expect.objectContaining({ type: "safety_alarm_triggered", alarmId: "alarm-1" }),
        ORG,
      );
    } finally {
      setWebSocketServer(null);
    }
  });

  it("rejects deck_officer from creating an alarm type with 403", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/admin/safety-alarm-types")
      .set("x-test-user", "u-deck:deck_officer")
      .send({ key: "fire", displayName: "Fire" });
    expect(res.status).toBe(403);
    expect(alarmStub.createType).not.toHaveBeenCalled();
  });
});

describe("me-portal — public login", () => {
  it("rejects a missing body with 400", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app).post("/api/portal/login").send({});
    expect(res.status).toBe(400);
    expect(meStub.login).not.toHaveBeenCalled();
  });

  it("logs in with the default org when none is supplied", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .post("/api/portal/login")
      .send({ username: "jdoe", password: "secret1" });
    expect(res.status).toBe(200);
    expect(lastLoginArgs?.username).toBe("jdoe");
    expect(lastLoginArgs?.orgId).toBeTruthy();
  });

  it("maps a failed login to its MePortalError status", async () => {
    if (mountError) {throw new Error(mountError);}
    meStub.login.mockRejectedValueOnce(
      new MePortalError("Invalid credentials", "LOGIN_FAILED", 401),
    );
    const res = await request(app)
      .post("/api/portal/login")
      .send({ username: "jdoe", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body?.code).toBe("LOGIN_FAILED");
  });
});
