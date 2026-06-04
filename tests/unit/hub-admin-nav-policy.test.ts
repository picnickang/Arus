/**
 * Hub-admin grant — client navigation policy (Task #245).
 *
 * The per-account hub-admin grant decides (a) whether a session may reach
 * the admin portal at all (`isAdminPortalAccess`) and (b) which hubs within
 * it are visible (`filterCategoriesByHubAccess`). Both are pure helpers in
 * `client/src/application/navigation/role-navigation-policy.ts`. This suite
 * pins the no-grant, partial-allow-list, and always-on super-admin cases so
 * a regression can't silently expose or hide admin navigation.
 */

import { describe, it, expect } from "@jest/globals";
import {
  isAdminPortalAccess,
  filterCategoriesByHubAccess,
  getAdminPrimaryCategories,
} from "../../client/src/application/navigation/role-navigation-policy";

describe("isAdminPortalAccess", () => {
  describe("no grant (ready, non-super-admin role)", () => {
    it("denies a non-admin role with no hub-admin grant", () => {
      expect(isAdminPortalAccess("fleet_manager", false, true)).toBe(false);
      expect(isAdminPortalAccess("technician", false, true)).toBe(false);
      expect(isAdminPortalAccess("viewer", false, true)).toBe(false);
    });

    it("grants a non-admin role once the server-computed hubAdmin flag is true", () => {
      expect(isAdminPortalAccess("fleet_manager", true, true)).toBe(true);
    });
  });

  describe("super-admin is always-on", () => {
    it("grants access even with hubAdmin=false and ready=true", () => {
      for (const role of ["super_admin", "system_admin", "company_admin"]) {
        expect(isAdminPortalAccess(role, false, true)).toBe(true);
      }
    });

    it("grants access even while permissions are still loading", () => {
      expect(isAdminPortalAccess("system_admin", false, false)).toBe(true);
    });
  });

  describe("demoted admin is no longer always-on", () => {
    it("denies a plain admin with hubAdmin=false once permissions are ready", () => {
      expect(isAdminPortalAccess("admin", false, true)).toBe(false);
    });

    it("grants a plain admin once the server-computed hubAdmin flag is true", () => {
      expect(isAdminPortalAccess("admin", true, true)).toBe(true);
    });
  });

  describe("loading fallback (ready=false)", () => {
    it("falls back to the role→portal map for an admin-portal role", () => {
      // chief_engineer maps to the admin portal — first paint must not
      // lock an existing admin user out of the admin shell.
      expect(isAdminPortalAccess("chief_engineer", false, false)).toBe(true);
    });

    it("falls back to the user portal for a user-portal role", () => {
      expect(isAdminPortalAccess("deck_officer", false, false)).toBe(false);
      expect(isAdminPortalAccess("viewer", false, false)).toBe(false);
    });
  });
});

describe("filterCategoriesByHubAccess", () => {
  const adminCategories = getAdminPrimaryCategories();

  it("null allow-list returns every category unchanged (super-admin / unrestricted)", () => {
    expect(filterCategoriesByHubAccess(adminCategories, null)).toBe(adminCategories);
    expect(filterCategoriesByHubAccess(adminCategories, undefined)).toBe(adminCategories);
  });

  it("partial allow-list keeps only the listed hub ids", () => {
    const ids = adminCategories.map((c) => c.id);
    const [first, second] = ids;
    const result = filterCategoriesByHubAccess(adminCategories, [first, second]);
    expect(result.map((c) => c.id).sort()).toEqual([first, second].sort());
  });

  it("an allow-list of unknown ids yields no categories (fail-closed)", () => {
    expect(
      filterCategoriesByHubAccess(adminCategories, ["definitely-not-a-hub"]),
    ).toHaveLength(0);
  });

  it("an empty allow-list yields no categories", () => {
    // An empty array is a real allow-list (distinct from null); nothing
    // matches, so the filtered set is empty.
    expect(filterCategoriesByHubAccess(adminCategories, [])).toHaveLength(0);
  });

  it("preserves the source category order for the surviving ids", () => {
    const ids = adminCategories.map((c) => c.id);
    // Pass the allow-list in reverse — the helper must keep the SOURCE
    // order, not the allow-list order.
    const result = filterCategoriesByHubAccess(adminCategories, [...ids].reverse());
    expect(result.map((c) => c.id)).toEqual(ids);
  });
});
