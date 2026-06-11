import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

const ORIGINAL_ENV = { ...process.env };

const getAdminSessionByToken = jest.fn();
const updateAdminSessionActivity = jest.fn();
const getUser = jest.fn();
const getUserByEmail = jest.fn();
const createUser = jest.fn();

jest.unstable_mockModule("../../server/repositories", () => ({
  dbSystemAdminStorage: {
    getAdminSessionByToken,
    updateAdminSessionActivity,
  },
  dbUserStorage: {
    getUser,
    getUserByEmail,
    createUser,
  },
}));

function buildReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    method: "GET",
    originalUrl: "/api/private",
    path: "/api/private",
    url: "/api/private",
  } as unknown as Request;
}

function buildRes(): Response & { statusCode?: number; body?: unknown } {
  // Plain closures (not jest.fn) so the partial object stays structurally
  // comparable to Response — the tests assert on res.statusCode / res.body,
  // never on mock call metadata.
  const res = {
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    json: (body: unknown) => {
      res.body = body;
      return res;
    },
  } as Response & { statusCode?: number; body?: unknown };
  return res;
}

describe("temporary dev login authentication", () => {
  beforeEach(() => {
    jest.resetModules();
    getAdminSessionByToken.mockReset();
    updateAdminSessionActivity.mockReset();
    getUser.mockReset();
    getUserByEmail.mockReset();
    createUser.mockReset();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test", ARUS_DEV_LOGIN: "1" };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("does not grant the old no-token development admin fallback", async () => {
    const { requireAuthentication } = await import("../../server/security/authentication");
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    await requireAuthentication(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect((res.body as { code?: string }).code).toBe("MISSING_AUTH_HEADER");
  });

  it("resolves a dev admin token into a superuser request", async () => {
    const { createDevLoginSession } = await import("../../server/security/dev-login");
    const { requireAuthentication } = await import("../../server/security/authentication");
    const login = createDevLoginSession({ persona: "admin" }, { ip: "127.0.0.1" });
    const req = buildReq({ authorization: `Bearer ${login.sessionToken}` });
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    await requireAuthentication(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { user?: { id: string; role: string } }).user).toMatchObject({
      id: "dev-admin-user",
      role: "super_admin",
    });
  });

  it("resolves a dev user token into the selected regular role", async () => {
    const { createDevLoginSession } = await import("../../server/security/dev-login");
    const { requireAuthentication } = await import("../../server/security/authentication");
    const login = createDevLoginSession({ persona: "user", role: "logistics_user" }, {});
    const req = buildReq({ authorization: `Bearer ${login.sessionToken}` });
    const res = buildRes();
    const next = jest.fn() as NextFunction;

    await requireAuthentication(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { user?: { id: string; role: string } }).user).toMatchObject({
      id: "dev-login-user-logistics_user",
      role: "logistics_user",
    });
  });
});
