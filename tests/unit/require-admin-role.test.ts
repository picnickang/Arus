/**
 * requireAdminRole — backend/frontend admin-gate parity.
 *
 * The Admin Portal UI admits SUPER_ADMIN_ROLE_KEYS (super_admin,
 * system_admin, company_admin — shared/role-dashboard.ts) while the old
 * middleware accepted exactly "admin", making the two gates mutually
 * exclusive. Pin the union: "admin" plus the shared super-admin set pass;
 * everything else 403s; missing user 401s.
 */

import { describe, it, expect } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { requireAdminRole } from "../../server/security/authorization";

function run(role?: string): { status?: number; nextCalled: boolean } {
  const result: { status?: number; nextCalled: boolean } = { nextCalled: false };
  const req = (role === undefined ? {} : { user: { role } }) as Request;
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  const next: NextFunction = () => {
    result.nextCalled = true;
  };
  requireAdminRole(req, res, next);
  return result;
}

describe("requireAdminRole", () => {
  it.each(["admin", "super_admin", "system_admin", "company_admin"])("passes role %s", (role) => {
    const result = run(role);
    expect(result.nextCalled).toBe(true);
    expect(result.status).toBeUndefined();
  });

  it.each(["deck_officer", "chief_engineer", "manager", ""])("rejects role %s with 403", (role) => {
    const result = run(role);
    expect(result.nextCalled).toBe(false);
    expect(result.status).toBe(403);
  });

  it("rejects an unauthenticated request with 401", () => {
    const result = run(undefined);
    expect(result.nextCalled).toBe(false);
    expect(result.status).toBe(401);
  });
});
