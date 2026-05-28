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
  pruneOverrideToPolicyIds,
} from "../../client/src/application/navigation/role-navigation-policy";

// `__dirname` is not defined under the ESM/swc Jest config used by
// these unit tests; `process.cwd()` is the project root when Jest is
// invoked from package.json — same convention as the sibling
// `lr35-ui-align-*` tests in this directory.
const REPO_ROOT = process.cwd();
const BOTTOM_NAV = resolve(REPO_ROOT, "client/src/components/BottomNav.tsx");
const SWITCH_PORTAL = resolve(
  REPO_ROOT,
  "client/src/components/navigation/SwitchPortalButton.tsx",
);
const PORTAL_LOGIN = resolve(REPO_ROOT, "client/src/pages/portal-login.tsx");
const ROLES_CONFIG = resolve(REPO_ROOT, "client/src/config/roles.ts");
const NAV_STORAGE = resolve(
  REPO_ROOT,
  "client/src/infrastructure/navigation/nav-storage.ts",
);

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

    it("BottomNav.tsx self-heals: rewrites the stored override via the prune helper + nav-storage adapter", async () => {
      const src = await readFile(BOTTOM_NAV, "utf8");
      // New contract: BottomNav delegates to `pruneOverrideToPolicyIds`
      // and writes back via the centralised adapter (`writeNavOverride`
      // for the non-empty pruned list, `clearNavOverride` when nothing
      // survives). Direct `localStorage` calls are forbidden in this
      // file.
      expect(src).toContain("pruneOverrideToPolicyIds");
      expect(src).toContain("writeNavOverride");
      expect(src).toContain("clearNavOverride");
      expect(src).not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
    });

    it("SwitchPortalButton.tsx clears every portal-scoped key through the adapter", async () => {
      const src = await readFile(SWITCH_PORTAL, "utf8");
      // Centralised reset: one call to `clearAllPortalState` replaces
      // the prior per-key `removeItem` pair. No raw `localStorage`
      // calls, no magic strings.
      expect(src).toContain("clearAllPortalState");
      expect(src).not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
      const literalMatches = src.match(/"arus-bottom-nav-items"/g) ?? [];
      expect(literalMatches.length).toBe(0);
      const roleLiteralMatches = src.match(/"arus-user-role"/g) ?? [];
      expect(roleLiteralMatches.length).toBe(0);
    });

    it("BottomNav.tsx renders nothing for user-portal roles (#218 render gate)", async () => {
      const src = await readFile(BOTTOM_NAV, "utf8");
      // Pin the policy import + the early-return on `portal === "user"`.
      // The hooks above the return must still execute so the #194
      // override self-heal keeps running for users who never see the
      // bar — assert the return sits AFTER the useEffect block.
      expect(src).toContain("getPortalForRole");
      expect(src).toMatch(/if\s*\(\s*portal\s*===\s*"user"\s*\)\s*\{\s*return\s+null\s*;\s*\}/);
      const useEffectIdx = src.indexOf("useEffect(");
      const userReturnIdx = src.search(
        /if\s*\(\s*portal\s*===\s*"user"\s*\)\s*\{\s*return\s+null/,
      );
      expect(useEffectIdx).toBeGreaterThan(-1);
      expect(userReturnIdx).toBeGreaterThan(useEffectIdx);
    });

    it("App.tsx gates the BottomNav mount + pb-14 padding on the admin portal (#218)", async () => {
      const APP_TSX = resolve(REPO_ROOT, "client/src/App.tsx");
      const src = await readFile(APP_TSX, "utf8");
      // Bar mount is admin-portal-only — no orphan `pb-14` for users.
      expect(src).toContain("isAdminPortal");
      expect(src).toContain("{isAdminPortal && <BottomNav />}");
      expect(src).toMatch(/getPortalForRole\(readCurrentRole\(\)\)\s*===\s*"admin"/);
      // The mobile clearance is now conditional — must not reintroduce
      // the unconditional `pb-14 md:pb-0` on `<main>`.
      expect(src).not.toMatch(/className=\{`min-h-screen \$\{isLoginRoute \? "" : "pb-14 md:pb-0"\}`\}/);
    });

    it("portal-login.tsx writes nav state ONLY through the centralised adapter", async () => {
      const src = await readFile(PORTAL_LOGIN, "utf8");
      // Brief #194 requirement: PortalLogin MUST write nav state
      // through a centralised helper, not raw `localStorage`.
      expect(src).toContain("writeUserRole");
      expect(src).toContain("clearNavOverride");
      expect(src).not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
    });
  });

  describe("pruneOverrideToPolicyIds — partial-conflict self-heal", () => {
    it("drops disallowed ids but keeps allowed ids in user-preferred order", () => {
      const userIds = getPrimaryCategoriesForRole("deck_officer").map(
        (c) => c.id,
      );
      // Mixed override: one valid user id + two admin ids.
      const mixed = [userIds[0], "maintenance", "system", userIds[1]];
      const pruned = pruneOverrideToPolicyIds("deck_officer", mixed);
      expect(pruned).toEqual([userIds[0], userIds[1]]);
    });

    it("returns null when the override is already clean (no rewrite needed)", () => {
      const userIds = getPrimaryCategoriesForRole("deck_officer").map(
        (c) => c.id,
      );
      expect(pruneOverrideToPolicyIds("deck_officer", userIds)).toBeNull();
    });

    it("returns null for null/empty override (nothing to rewrite)", () => {
      expect(pruneOverrideToPolicyIds("deck_officer", null)).toBeNull();
      expect(pruneOverrideToPolicyIds("deck_officer", undefined)).toBeNull();
      expect(pruneOverrideToPolicyIds("deck_officer", [])).toBeNull();
    });

    it("returns an empty array when EVERY id is disallowed (caller should clear storage)", () => {
      const pruned = pruneOverrideToPolicyIds("deck_officer", [
        "maintenance",
        "system",
        "definitely-not-allowed",
      ]);
      expect(pruned).toEqual([]);
    });

    it("dedupes repeated allowed ids while pruning", () => {
      const userIds = getPrimaryCategoriesForRole("deck_officer").map(
        (c) => c.id,
      );
      const pruned = pruneOverrideToPolicyIds("deck_officer", [
        userIds[0],
        userIds[0],
        "system",
        userIds[0],
      ]);
      expect(pruned).toEqual([userIds[0]]);
    });
  });

  describe("nav-storage adapter — typed centralised I/O", () => {
    it("exists at the expected hexagonal infrastructure path", async () => {
      const src = await readFile(NAV_STORAGE, "utf8");
      // Pin the public API surface so consumers (BottomNav,
      // SwitchPortalButton, PortalLogin) cannot drift onto direct
      // localStorage access.
      expect(src).toContain("export function readUserRole");
      expect(src).toContain("export function writeUserRole");
      expect(src).toContain("export function clearUserRole");
      expect(src).toContain("export function readNavOverride");
      expect(src).toContain("export function writeNavOverride");
      expect(src).toContain("export function clearNavOverride");
      expect(src).toContain("export function clearAllPortalState");
    });

    it("imports the storage keys from @/config/roles (no magic strings in the adapter)", async () => {
      const src = await readFile(NAV_STORAGE, "utf8");
      expect(src).toContain('from "@/config/roles"');
      expect(src).toContain("ROLE_STORAGE_KEY");
      expect(src).toContain("BOTTOM_NAV_OVERRIDE_STORAGE_KEY");
      const roleLiteralMatches = src.match(/"arus-user-role"/g) ?? [];
      const overrideLiteralMatches =
        src.match(/"arus-bottom-nav-items"/g) ?? [];
      // The literals appear only in the doc comments at the top of
      // the file (as `arus-user-role` / `arus-bottom-nav-items` inside
      // backticks). Forbid the JS-string spelling.
      expect(roleLiteralMatches.length).toBe(0);
      expect(overrideLiteralMatches.length).toBe(0);
    });
  });
});
