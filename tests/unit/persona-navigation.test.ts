/**
 * Persona navigation policy — automated runtime-logic verification.
 *
 * The 11 Phase-1.5 personas, asserted against the *pure* navigation policy
 * (`role-navigation-policy.ts`) that the BottomNav, HomePage, and
 * AdminPortalRouteGuard all consume. This is the security perimeter for "which
 * hubs does this persona see" — testing it directly is deterministic and runs in
 * the sandbox (no browser).
 *
 * What this DOES verify (automated):
 *  - Each persona lands in the correct portal (admin vs user).
 *  - Each persona's primary nav categories are exactly the allowed set.
 *  - Hub-grant admins (Maintenance-only, Crew-only, Logistics-only, none) see
 *    only their granted hubs after `filterCategoriesByHubAccess`.
 *  - A tampered/stale override can never expand a persona past its allowed hubs.
 *
 * What this does NOT verify (covered by the CI Playwright spec
 * `tests/playwright/persona-nav.spec.ts`, and documented as manual in
 * docs/authenticated-navigation-verification.md):
 *  - Real login, landing redirect, logout, and live direct-URL route blocking.
 */

import { describe, it, expect } from "@jest/globals";
import {
  getPortalForRole,
  getPrimaryCategoriesForRole,
  getAdminPrimaryCategories,
  filterCategoriesByHubAccess,
  intersectOverrideWithPolicy,
} from "@/application/navigation/role-navigation-policy";

const ADMIN_HUB_IDS = ["maintenance", "system", "crew", "logistics", "analytics"];
const USER_CATEGORY_IDS = ["user-dashboard", "user-feedback"];

function ids(categories: { id: string }[]): string[] {
  return categories.map((c) => c.id);
}

describe("Persona navigation policy (11 personas)", () => {
  describe("portal assignment", () => {
    const adminRoles = ["super_admin", "admin", "company_admin", "chief_engineer"];
    const userRoles = ["crew_member", "logistics_user", "viewer", "deck_officer"];

    it.each(adminRoles)("%s lands in the admin portal", (role) => {
      expect(getPortalForRole(role)).toBe("admin");
    });

    it.each(userRoles)("%s lands in the user portal", (role) => {
      expect(getPortalForRole(role)).toBe("user");
    });

    it("an unknown role defaults to the safer user portal", () => {
      expect(getPortalForRole("totally_unknown_role")).toBe("user");
      expect(getPortalForRole(null)).toBe("user");
    });
  });

  describe("primary categories per persona", () => {
    it("1. Super Admin sees all five admin hubs", () => {
      expect(ids(getPrimaryCategoriesForRole("super_admin")).sort()).toEqual(
        [...ADMIN_HUB_IDS].sort(),
      );
    });

    it("2. Admin (all hubs granted) sees all five admin hubs", () => {
      const cats = getPrimaryCategoriesForRole("admin");
      // hubAccess null = unrestricted (super-admin / fully-granted admin).
      expect(ids(filterCategoriesByHubAccess(cats, null)).sort()).toEqual(
        [...ADMIN_HUB_IDS].sort(),
      );
    });

    it("3. Admin with Maintenance only sees just the maintenance hub", () => {
      const cats = getAdminPrimaryCategories();
      expect(ids(filterCategoriesByHubAccess(cats, ["maintenance"]))).toEqual(["maintenance"]);
    });

    it("4. Admin with Crew Management only sees just the crew hub", () => {
      const cats = getAdminPrimaryCategories();
      expect(ids(filterCategoriesByHubAccess(cats, ["crew"]))).toEqual(["crew"]);
    });

    it("5. Admin with Logistics only sees just the logistics hub", () => {
      const cats = getAdminPrimaryCategories();
      expect(ids(filterCategoriesByHubAccess(cats, ["logistics"]))).toEqual(["logistics"]);
    });

    it("6. Admin with no hubs granted sees no admin hubs", () => {
      const cats = getAdminPrimaryCategories();
      expect(filterCategoriesByHubAccess(cats, [])).toEqual([]);
    });

    it("7. Maintenance user (chief_engineer) is an admin-portal persona", () => {
      expect(getPortalForRole("chief_engineer")).toBe("admin");
      const cats = getAdminPrimaryCategories();
      expect(ids(filterCategoriesByHubAccess(cats, ["maintenance", "analytics"]))).toEqual([
        "maintenance",
        "analytics",
      ]);
    });

    it("8. Crew user lands on the reduced user surface", () => {
      expect(ids(getPrimaryCategoriesForRole("crew_member"))).toEqual(USER_CATEGORY_IDS);
    });

    it("9. Logistics user lands on the reduced user surface", () => {
      expect(ids(getPrimaryCategoriesForRole("logistics_user"))).toEqual(USER_CATEGORY_IDS);
    });

    it("10. Viewer / Auditor lands on the reduced user surface", () => {
      expect(ids(getPrimaryCategoriesForRole("viewer"))).toEqual(USER_CATEGORY_IDS);
    });

    it("11. Normal user (deck_officer) lands on the reduced user surface", () => {
      expect(ids(getPrimaryCategoriesForRole("deck_officer"))).toEqual(USER_CATEGORY_IDS);
    });
  });

  describe("override tampering cannot widen a persona's hubs", () => {
    it("a user-portal persona cannot be pushed into admin hubs via a stale override", () => {
      // A tampered localStorage override listing admin hubs must be dropped.
      const result = intersectOverrideWithPolicy("deck_officer", [
        "maintenance",
        "system",
        "user-dashboard",
      ]);
      expect(ids(result).every((id) => USER_CATEGORY_IDS.includes(id))).toBe(true);
      expect(ids(result)).not.toContain("maintenance");
      expect(ids(result)).not.toContain("system");
    });
  });
});
