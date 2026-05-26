/**
 * Regression test for follow-up #194 — BottomNav override leak.
 *
 * Pins the security perimeter that stops a stale or tampered
 * `arus-bottom-nav-items` localStorage value from leaking admin
 * navigation categories into a user-portal session.
 *
 * Same Jest harness constraint as the other LR-3.5 client-side
 * tests: `testEnvironment: "node"` + the swc/ESM transform means
 * React mount is not available. We assert the contract via the
 * pure policy helper (`intersectOverrideWithPolicy`) plus a
 * source-scan of `BottomNav.tsx` / `SwitchPortalButton.tsx` that
 * pins the wiring (centralised storage key, no raw magic strings,
 * intersect-with-policy enforcement, self-heal on stale overrides).
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  getPrimaryCategoriesForRole,
  intersectOverrideWithPolicy,
} from "../../client/src/application/navigation/role-navigation-policy";

const REPO_ROOT = resolve(__dirname, "..", "..");
const BOTTOM_NAV = resolve(REPO_ROOT, "client/src/components/BottomNav.tsx");
const SWITCH_PORTAL = resolve(
  REPO_ROOT,
  "client/src/components/navigation/SwitchPortalButton.tsx",
);
const PORTAL_LOGIN = resolve(REPO_ROOT, "client/src/pages/portal-login.tsx");
const ROLES_CONFIG = resolve(REPO_ROOT, "client/src/config/roles.ts");

describe("BottomNav override-leak hardening (follow-up #194)", () => {
  describe("intersectOverrideWithPolicy — pure policy contract", () => {
    it("drops admin category ids when role is a user-portal role (deck_officer)", () => {
      const userPolicyIds = getPrimaryCategoriesForRole("deck_officer").map(
        (c) => c.id,
      );
      const adminPolicyIds = getPrimaryCategoriesForRole("system_admin").map(
        (c) => c.id,
      );
      const adminOverride = [...adminPolicyIds, ...userPolicyIds];
      const result = intersectOverrideWithPolicy("deck_officer", adminOverride);
      const ids = result.map((c) => c.id).sort();
      expect(ids).toEqual([...userPolicyIds].sort());
      for (const adminId of adminPolicyIds) {
        if (!userPolicyIds.includes(adminId)) {
          expect(ids).not.toContain(adminId);
        }
      }
    });

    it("returns policy default when override is null/empty/undefined", () => {
      const policyDefault = getPrimaryCategoriesForRole("deck_officer").map(
        (c) => c.id,
      );
      expect(
        intersectOverrideWithPolicy("deck_officer", null).map((c) => c.id),
      ).toEqual(policyDefault);
      expect(
        intersectOverrideWithPolicy("deck_officer", undefined).map((c) => c.id),
      ).toEqual(policyDefault);
      expect(
        intersectOverrideWithPolicy("deck_officer", []).map((c) => c.id),
      ).toEqual(policyDefault);
    });

    it("falls back to policy default when intersection is empty (admin-only ids on a user role)", () => {
      const userPolicyIds = getPrimaryCategoriesForRole("deck_officer").map(
        (c) => c.id,
      );
      const result = intersectOverrideWithPolicy("deck_officer", [
        "system",
        "maintenance",
        "unknown-cat",
        "definitely-not-allowed",
      ]);
      const ids = result.map((c) => c.id).sort();
      expect(ids).toEqual([...userPolicyIds].sort());
    });

    it("preserves user preferred order within allowed-by-policy set", () => {
      const userPolicyIds = getPrimaryCategoriesForRole("deck_officer").map(
        (c) => c.id,
      );
      // Reverse the policy order and assert intersect honours it.
      const reversed = [...userPolicyIds].reverse();
      const result = intersectOverrideWithPolicy("deck_officer", reversed);
      expect(result.map((c) => c.id)).toEqual(reversed);
    });

    it("admin role (system_admin) still resolves to the five admin categories under intersect", () => {
      const policyIds = getPrimaryCategoriesForRole("system_admin").map(
        (c) => c.id,
      );
      // Admin policy currently grants five primary categories — pin
      // the cardinality so a future shrink can't silently regress
      // the override codepath for admins.
      expect(policyIds.length).toBe(5);
      // With no override, intersect returns the same policy default
      // unchanged (admin nav is preserved end-to-end).
      expect(
        intersectOverrideWithPolicy("system_admin", null).map((c) => c.id),
      ).toEqual(policyIds);
      // With an override that subsets the admin set, only allowed
      // ids survive in the user's preferred order.
      const reordered = [...policyIds].reverse();
      expect(
        intersectOverrideWithPolicy("system_admin", reordered).map(
          (c) => c.id,
        ),
      ).toEqual(reordered);
    });

    it("dedupes repeated ids in the override", () => {
      const userPolicyIds = getPrimaryCategoriesForRole("deck_officer").map(
        (c) => c.id,
      );
      const [first, second] = userPolicyIds;
      const result = intersectOverrideWithPolicy("deck_officer", [
        first,
        first,
        second,
        first,
      ]);
      expect(result.map((c) => c.id)).toEqual([first, second]);
    });
  });

  describe("source-scan: BottomNav wiring uses the centralised storage key + intersect helper", () => {
    it("centralises the BottomNav override storage key in @/config/roles", async () => {
      const src = await readFile(ROLES_CONFIG, "utf8");
      expect(src).toMatch(/BOTTOM_NAV_OVERRIDE_STORAGE_KEY\s*=\s*"arus-bottom-nav-items"/);
    });

    it("BottomNav.tsx imports the centralised key and the intersect helper", async () => {
      const src = await readFile(BOTTOM_NAV, "utf8");
      expect(src).toContain("BOTTOM_NAV_OVERRIDE_STORAGE_KEY");
      expect(src).toContain("intersectOverrideWithPolicy");
      // No raw magic string for the storage key anywhere in the file
      // except inside the constant import (which uses the symbol, not
      // the literal). The literal must only live in roles.ts.
      const literalMatches = src.match(/"arus-bottom-nav-items"/g) ?? [];
      expect(literalMatches.length).toBe(0);
    });

    it("BottomNav.tsx no longer uses getCategoryById (the un-intersected lookup path)", async () => {
      const src = await readFile(BOTTOM_NAV, "utf8");
      // getCategoryById walks the full navigationConfig and was the
      // mechanism by which admin ids in the override could surface
      // as renderable categories. The new code path must not call it.
      expect(src).not.toContain("getCategoryById");
    });

    it("BottomNav.tsx self-heals: discards a stored override that survived no policy id", async () => {
      const src = await readFile(BOTTOM_NAV, "utf8");
      expect(src).toContain("discardOverride");
      expect(src).toMatch(/anyKept/);
    });

    it("SwitchPortalButton.tsx clears the centralised override key on switch", async () => {
      const src = await readFile(SWITCH_PORTAL, "utf8");
      expect(src).toContain("BOTTOM_NAV_OVERRIDE_STORAGE_KEY");
      expect(src).toContain("removeItem(BOTTOM_NAV_OVERRIDE_STORAGE_KEY)");
      expect(src).toContain("removeItem(ROLE_STORAGE_KEY)");
      const literalMatches = src.match(/"arus-bottom-nav-items"/g) ?? [];
      expect(literalMatches.length).toBe(0);
    });

    it("portal-login.tsx clears the override on portal pick (cache, not authority)", async () => {
      const src = await readFile(PORTAL_LOGIN, "utf8");
      // portal-login currently uses the raw string; either form is
      // acceptable as long as the removeItem call targets the same
      // key. Assert the behaviour, allow either spelling.
      const usesConstant = src.includes(
        "removeItem(BOTTOM_NAV_OVERRIDE_STORAGE_KEY)",
      );
      const usesLiteral = src.includes('removeItem("arus-bottom-nav-items")');
      expect(usesConstant || usesLiteral).toBe(true);
    });
  });
});
