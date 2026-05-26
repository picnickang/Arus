/**
 * LR-3.5 / SEC-1 regression: requireRole must NOT auto-allow simply
 * because NODE_ENV !== "production". The dev bypass now requires an
 * explicit RBAC_DEV_NO_AUTH=1 opt-in, and even when set, must still
 * be off in production.
 */
import { jest, describe, it, expect, afterEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { requireRole } from "../../server/middleware/role-auth";

function buildReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as unknown as Request;
}
function buildRes(): { status: jest.Mock; json: jest.Mock; statusCode?: number } {
  const res: { status: jest.Mock; json: jest.Mock; statusCode?: number } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockReturnValue(res);
  return res;
}

describe("LR-3.5 SEC-1 — RBAC dev bypass requires explicit env opt-in", () => {
  const ORIG_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIG_ENV };
  });

  it("rejects an unauthenticated request when only NODE_ENV=development is set", async () => {
    process.env['NODE_ENV'] = "development";
    delete process.env['RBAC_DEV_NO_AUTH'];
    const mw = requireRole(["admin"]);
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn() as NextFunction;
    await mw(req, res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects when RBAC_DEV_NO_AUTH=1 but NODE_ENV=production", async () => {
    process.env['NODE_ENV'] = "production";
    process.env['RBAC_DEV_NO_AUTH'] = "1";
    const mw = requireRole(["admin"]);
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn() as NextFunction;
    await mw(req, res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
