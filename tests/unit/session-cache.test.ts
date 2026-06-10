/**
 * P3: authentication hot-path cache — the session+user SELECTs run once per
 * 30s TTL window instead of per request, activity writes throttle to one per
 * minute, and expiry is still enforced on every request.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

const getAdminSessionByToken = jest.fn<() => Promise<unknown>>();
const updateAdminSessionActivity = jest.fn<() => Promise<void>>();
const getUser = jest.fn<() => Promise<unknown>>();
const getUserByEmail = jest.fn<() => Promise<unknown>>();
const createUser = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule("../../server/repositories", () => ({
  dbSystemAdminStorage: { getAdminSessionByToken, updateAdminSessionActivity },
  dbUserStorage: { getUser, getUserByEmail, createUser },
}));

jest.unstable_mockModule("../../server/bootstrap/public-api-paths", () => ({
  isPublicApiPath: () => false,
  isSensitiveApiPath: () => false,
}));

jest.unstable_mockModule("../../server/security/dev-login", () => ({
  resolveDevLoginSessionToken: () => null,
}));

const { requireAuthentication, _sessionCacheInternals, invalidateSessionCache } = await import(
  "../../server/security/authentication"
);

const SESSION = {
  id: "sess-1",
  userId: "user-1",
  adminEmail: "admin@example.com",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

const USER = {
  id: "user-1",
  email: "admin@example.com",
  role: "admin",
  name: "Admin",
  isActive: true,
  orgId: "org-1",
};

function buildReq(token = "token-abc"): Request {
  return {
    headers: { authorization: `Bearer ${token}` },
    method: "GET",
    originalUrl: "/api/private",
    path: "/api/private",
    url: "/api/private",
  } as unknown as Request;
}

function buildRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status: jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

async function authenticate(token?: string): Promise<{ req: Request; res: ReturnType<typeof buildRes>; nextCalled: boolean }> {
  const req = buildReq(token);
  const res = buildRes();
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };
  await requireAuthentication(req, res, next);
  return { req, res, nextCalled };
}

beforeEach(() => {
  _sessionCacheInternals.clear();
  getAdminSessionByToken.mockReset().mockResolvedValue(SESSION);
  updateAdminSessionActivity.mockReset().mockResolvedValue(undefined);
  getUser.mockReset().mockResolvedValue(USER);
  getUserByEmail.mockReset();
  createUser.mockReset();
});

describe("authentication session cache (P3)", () => {
  it("authenticates and populates req.user on a cold cache", async () => {
    const { req, nextCalled } = await authenticate();
    expect(nextCalled).toBe(true);
    expect(req.user).toMatchObject({ id: "user-1", orgId: "org-1" });
    expect(getAdminSessionByToken).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("serves repeat requests within the TTL without any session/user SELECT", async () => {
    await authenticate();
    const second = await authenticate();
    const third = await authenticate();

    expect(second.nextCalled).toBe(true);
    expect(third.nextCalled).toBe(true);
    expect(getAdminSessionByToken).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("throttles activity writes to one per interval", async () => {
    await authenticate();
    await authenticate();
    await authenticate();
    expect(updateAdminSessionActivity).toHaveBeenCalledTimes(1);
  });

  it("still rejects expired sessions on every request (cache can't extend a session)", async () => {
    const expired = { ...SESSION, expiresAt: new Date(Date.now() - 1000).toISOString() };
    getAdminSessionByToken.mockResolvedValue(expired);

    const { res, nextCalled } = await authenticate();
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body["code"]).toBe("SESSION_EXPIRED");
  });

  it("invalidateSessionCache forces the next request back to the database", async () => {
    await authenticate();
    invalidateSessionCache();
    await authenticate();
    expect(getAdminSessionByToken).toHaveBeenCalledTimes(2);
  });

  it("rejects disabled users and drops them from the cache", async () => {
    getUser.mockResolvedValue({ ...USER, isActive: false });
    const { res, nextCalled } = await authenticate();
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body["code"]).toBe("ACCOUNT_DISABLED");
    expect(_sessionCacheInternals.sessionCache.size).toBe(0);
  });
});
