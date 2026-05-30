/**
 * Me-Portal — credential hardening guards (Task #235).
 *
 * Two server-side controls that must not be bypassable from the client:
 *   1. A self password change revokes every existing session (so any
 *      pre-change token, including the caller's own, stops working).
 *   2. `mustChangePassword` is enforced server-side: every non-credential
 *      `/api/me/*` data read throws `PASSWORD_CHANGE_REQUIRED` (403) until the
 *      password is changed — the UX redirect is not the only gate.
 *
 * `db` and the composed domain services are mocked so no Postgres is needed;
 * bcrypt runs for real against a known hash.
 */

import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import bcrypt from "bcryptjs";

let selectRows: unknown[] = [];
const calls = { updates: 0, deletes: 0 };

const fakeDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(selectRows),
      }),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => {
        calls.updates += 1;
        return Promise.resolve(undefined);
      },
    }),
  }),
  delete: () => ({
    where: () => {
      calls.deletes += 1;
      return Promise.resolve(undefined);
    },
  }),
};

let MePortalService: typeof import("../../server/domains/me-portal/me-portal-service").MePortalService;
let MePortalError: typeof import("../../server/domains/me-portal/me-portal-service").MePortalError;

const user = {
  id: "u-1",
  email: "u1@test.local",
  name: "User One",
  role: "deck_officer",
  orgId: "org-1",
};

beforeAll(async () => {
  jest.unstable_mockModule("../../server/db", () => ({
    __esModule: true,
    get db() {
      return fakeDb;
    },
  }));
  jest.unstable_mockModule("../../server/repositories", () => ({
    __esModule: true,
    dbSystemAdminStorage: { createAdminSession: jest.fn(async () => undefined) },
    vesselService: { getVessels: jest.fn(async () => []) },
    workOrderService: { getWorkOrdersWithDetails: jest.fn(async () => []) },
  }));
  jest.unstable_mockModule("../../server/domains/crew-admin/service", () => ({
    __esModule: true,
    crewAdminService: {
      resolveEffectiveConfigList: jest.fn(async () => []),
      getAssignments: jest.fn(async () => []),
    },
  }));
  jest.unstable_mockModule("../../server/domains/safety-alarms/service", () => ({
    __esModule: true,
    safetyAlarmService: {
      listActiveForUser: jest.fn(async () => []),
      acknowledge: jest.fn(async () => undefined),
    },
    AlarmValidationError: class extends Error {},
  }));

  const mod = await import("../../server/domains/me-portal/me-portal-service");
  MePortalService = mod.MePortalService;
  MePortalError = mod.MePortalError;
});

beforeEach(() => {
  selectRows = [];
  calls.updates = 0;
  calls.deletes = 0;
});

describe("me-portal — forced password-change enforcement", () => {
  it("blocks task reads when mustChangePassword is set", async () => {
    selectRows = [{ mustChangePassword: true }];
    const service = new MePortalService();
    await expect(service.getTasks(user)).rejects.toMatchObject({
      code: "PASSWORD_CHANGE_REQUIRED",
      status: 403,
    });
  });

  it("blocks dashboard reads when mustChangePassword is set", async () => {
    selectRows = [{ mustChangePassword: true }];
    const service = new MePortalService();
    await expect(service.getDashboard(user)).rejects.toBeInstanceOf(MePortalError);
  });

  it("blocks alarm reads when mustChangePassword is set", async () => {
    selectRows = [{ mustChangePassword: true }];
    const service = new MePortalService();
    await expect(service.getVisibleAlarms(user)).rejects.toMatchObject({
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  });

  it("allows task reads once the password has been changed", async () => {
    selectRows = [{ mustChangePassword: false }];
    const service = new MePortalService();
    await expect(service.getTasks(user)).resolves.toEqual([]);
  });
});

describe("me-portal — self password change revokes sessions", () => {
  it("invalidates all sessions after a successful change", async () => {
    const hash = await bcrypt.hash("oldpass12", 10);
    selectRows = [{ id: user.id, orgId: user.orgId, passwordHash: hash }];
    const service = new MePortalService();
    await service.changePassword(user, "oldpass12", "newpass123");
    expect(calls.updates).toBe(1);
    expect(calls.deletes).toBe(1);
  });

  it("does not touch sessions when the current password is wrong", async () => {
    const hash = await bcrypt.hash("oldpass12", 10);
    selectRows = [{ id: user.id, orgId: user.orgId, passwordHash: hash }];
    const service = new MePortalService();
    await expect(service.changePassword(user, "wrongpass", "newpass123")).rejects.toMatchObject({
      code: "INVALID_CURRENT_PASSWORD",
    });
    expect(calls.deletes).toBe(0);
  });
});
