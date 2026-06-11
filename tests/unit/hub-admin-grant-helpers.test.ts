/**
 * Hub-admin grant — shared policy helpers (Task #245).
 *
 * Pins the security-relevant rules behind the per-account hub-admin grant
 * that live in `shared/role-dashboard.ts`. These are pure functions shared
 * by the server (grant/revoke authz + normalisation) and the client
 * (portal gating), so a regression here silently widens or narrows access
 * on BOTH tiers at once. No Postgres, no Express — just the contract.
 */

import { describe, it, expect } from "@jest/globals";
import {
  HUB_IDS,
  isSuperAdminRole,
  isAdminGrantEligibleRole,
  normalizeHubAccess,
  resolveHubAdmin,
  resolveHubAccess,
} from "@shared/role-dashboard";

describe("isSuperAdminRole", () => {
  it("is true for every super-admin role", () => {
    for (const role of ["super_admin", "system_admin", "company_admin"]) {
      expect(isSuperAdminRole(role)).toBe(true);
    }
  });

  it("is false for grant-eligible-but-not-super roles (incl. demoted admin)", () => {
    for (const role of [
      "admin",
      "fleet_manager",
      "captain",
      "chief_engineer",
      "manager",
      "vessel_master",
    ]) {
      expect(isSuperAdminRole(role)).toBe(false);
    }
  });

  it("is false for ordinary roles and null/undefined", () => {
    expect(isSuperAdminRole("technician")).toBe(false);
    expect(isSuperAdminRole("viewer")).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
    expect(isSuperAdminRole(undefined)).toBe(false);
  });
});

describe("isAdminGrantEligibleRole", () => {
  it("is true for super-admin roles (superset of grant-eligible)", () => {
    for (const role of ["super_admin", "system_admin", "company_admin"]) {
      expect(isAdminGrantEligibleRole(role)).toBe(true);
    }
  });

  it("is true for the demoted admin role (grant-eligible, not super)", () => {
    expect(isAdminGrantEligibleRole("admin")).toBe(true);
  });

  it("is true for manager-or-above roles", () => {
    for (const role of ["fleet_manager", "captain", "vessel_master", "chief_engineer", "manager"]) {
      expect(isAdminGrantEligibleRole(role)).toBe(true);
    }
  });

  it("is false for below-manager roles and null/undefined", () => {
    for (const role of ["technician", "crew_member", "viewer", "deck_officer"]) {
      expect(isAdminGrantEligibleRole(role)).toBe(false);
    }
    expect(isAdminGrantEligibleRole(null)).toBe(false);
    expect(isAdminGrantEligibleRole(undefined)).toBe(false);
  });
});

describe("normalizeHubAccess", () => {
  it("returns null for null/undefined (= all hubs)", () => {
    expect(normalizeHubAccess(null)).toBeNull();
    expect(normalizeHubAccess(undefined)).toBeNull();
  });

  it("returns null for an empty list (= all hubs)", () => {
    expect(normalizeHubAccess([])).toBeNull();
  });

  it("drops unknown ids", () => {
    expect(normalizeHubAccess(["operations", "not-a-hub", "fleet"])).toEqual([
      "operations",
      "fleet",
    ]);
  });

  it("returns null when EVERY unknown id is dropped (empty result collapses to all hubs)", () => {
    expect(normalizeHubAccess(["nope", "still-nope"])).toBeNull();
  });

  it("dedupes repeated ids", () => {
    expect(normalizeHubAccess(["fleet", "fleet", "operations", "fleet"])).toEqual([
      "fleet",
      "operations",
    ]);
  });

  it("collapses a full set to null (= all hubs)", () => {
    expect(normalizeHubAccess([...HUB_IDS])).toBeNull();
  });

  it("keeps a genuine partial allow-list", () => {
    const partial = ["maintenance", "crew"];
    expect(normalizeHubAccess(partial)).toEqual(["maintenance", "crew"]);
  });
});

describe("resolveHubAdmin", () => {
  it("super-admin role is always-on regardless of the stored flag", () => {
    expect(resolveHubAdmin(["super_admin"], false)).toBe(true);
    expect(resolveHubAdmin(["system_admin"], false)).toBe(true);
    expect(resolveHubAdmin(["company_admin"], false)).toBe(true);
  });

  it("a demoted admin is NOT always-on — it needs the stored grant", () => {
    expect(resolveHubAdmin(["admin"], false)).toBe(false);
    expect(resolveHubAdmin(["admin"], true)).toBe(true);
  });

  it("non-admin with no stored grant is off", () => {
    expect(resolveHubAdmin(["fleet_manager"], false)).toBe(false);
    expect(resolveHubAdmin(["technician"], false)).toBe(false);
  });

  it("grant-eligible role with a stored grant is on", () => {
    expect(resolveHubAdmin(["fleet_manager"], true)).toBe(true);
    expect(resolveHubAdmin(["chief_engineer"], true)).toBe(true);
  });

  it("re-checks eligibility: a demoted (below-manager) role loses the grant even if the flag was never revoked", () => {
    expect(resolveHubAdmin(["technician"], true)).toBe(false);
    expect(resolveHubAdmin(["viewer"], true)).toBe(false);
  });

  it("any super-admin among multiple roles wins", () => {
    expect(resolveHubAdmin(["technician", "system_admin"], false)).toBe(true);
  });
});

describe("resolveHubAccess", () => {
  it("super-admin always gets full access (null), ignoring any stored allow-list", () => {
    expect(resolveHubAccess(["system_admin"], ["maintenance"])).toBeNull();
    expect(resolveHubAccess(["super_admin"], [])).toBeNull();
  });

  it("non-admin null stored access stays null (= all hubs they are granted)", () => {
    expect(resolveHubAccess(["fleet_manager"], null)).toBeNull();
  });

  it("non-admin partial allow-list is normalised through", () => {
    expect(resolveHubAccess(["fleet_manager"], ["maintenance", "crew"])).toEqual([
      "maintenance",
      "crew",
    ]);
  });

  it("non-admin allow-list with unknown ids is cleaned", () => {
    expect(resolveHubAccess(["fleet_manager"], ["maintenance", "bogus"])).toEqual(["maintenance"]);
  });

  it("non-admin full allow-list collapses to null (= all hubs)", () => {
    expect(resolveHubAccess(["fleet_manager"], [...HUB_IDS])).toBeNull();
  });
});
