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
const SWITCH_PORTAL = resolve(REPO_ROOT, "client/src/components/navigation/SwitchPortalButton.tsx");
const PORTAL_LOGIN = resolve(REPO_ROOT, "client/src/pages/portal-login.tsx");
const ROLE_HINT = resolve(REPO_ROOT, "client/src/application/navigation/role-hint.ts");
const ROLES_CONFIG = resolve(REPO_ROOT, "client/src/config/roles.ts");
const NAV_STORAGE = resolve(REPO_ROOT, "client/src/infrastructure/navigation/nav-storage.ts");

describe("BottomNav override-leak hardening (follow-up #194)", () => {
  describe("intersectOverrideWithPolicy — pure policy contract", () => {
    it("drops admin category ids when role is a user-portal role (deck_officer)", () => {
      const userPolicyIds = getPrimaryCategoriesForRole("deck_officer").map((c) => c.id);
      const adminPolicyIds = getPrimaryCategoriesForRole("system_admin").map((c) => c.id);
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
      const policyDefault = getPrimaryCategoriesForRole("deck_officer").map((c) => c.id);
      expect(intersectOverrideWithPolicy("deck_officer", null).map((c) => c.id)).toEqual(
        policyDefault
      );
      expect(intersectOverrideWithPolicy("deck_officer", undefined).map((c) => c.id)).toEqual(
        policyDefault
      );
      expect(intersectOverrideWithPolicy("deck_officer", []).map((c) => c.id)).toEqual(
        policyDefault
      );
    });

    it("falls back to policy default when intersection is empty (admin-only ids on a user role)", () => {
      const userPolicyIds = getPrimaryCategoriesForRole("deck_officer").map((c) => c.id);
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
      const userPolicyIds = getPrimaryCategoriesForRole("deck_officer").map((c) => c.id);
      // Reverse the policy order and assert intersect honours it.
      const reversed = [...userPolicyIds].reverse();
      const result = intersectOverrideWithPolicy("deck_officer", reversed);
      expect(result.map((c) => c.id)).toEqual(reversed);
    });

    it("admin role (system_admin) still resolves to the eight admin categories under intersect", () => {
      const policyIds = getPrimaryCategoriesForRole("system_admin").map((c) => c.id);
      // Admin policy currently grants eight primary categories — pin
      // the cardinality so a future shrink can't silently regress
      // the override codepath for admins.
      expect(policyIds.length).toBe(8);
      // With no override, intersect returns the same policy default
      // unchanged (admin nav is preserved end-to-end).
      expect(intersectOverrideWithPolicy("system_admin", null).map((c) => c.id)).toEqual(policyIds);
      // With an override that subsets the admin set, only allowed
      // ids survive in the user's preferred order.
      const reordered = [...policyIds].reverse();
      expect(intersectOverrideWithPolicy("system_admin", reordered).map((c) => c.id)).toEqual(
        reordered
      );
    });

    it("dedupes repeated ids in the override", () => {
      const userPolicyIds = getPrimaryCategoriesForRole("deck_officer").map((c) => c.id);
      const [first, second] = userPolicyIds;
      const result = intersectOverrideWithPolicy("deck_officer", [first, first, second, first]);
      expect(result.map((c) => c.id)).toEqual([first, second]);
    });
  });

  describe("source-scan: BottomNav wiring uses the centralised storage key + intersect helper", () => {
    it("centralises the BottomNav override storage key in @/config/roles", async () => {
      const src = await readFile(ROLES_CONFIG, "utf8");
      expect(src).toMatch(/BOTTOM_NAV_OVERRIDE_STORAGE_KEY\s*=\s*"arus-bottom-nav-items"/);
    });

    it("BottomNav.tsx imports the centralised key and the prune helper", async () => {
      const src = await readFile(BOTTOM_NAV, "utf8");
      expect(src).toContain("BOTTOM_NAV_OVERRIDE_STORAGE_KEY");
      expect(src).toContain("pruneOverrideToPolicyIds");
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

    it("BottomNav.tsx renders the Figma role nav after stale override self-heal", async () => {
      const src = await readFile(BOTTOM_NAV, "utf8");
      // Mobile readiness replaces the old user-portal render gate:
      // every mobile role gets the Figma role-specific nav, while the
      // stale override self-heal still runs before rendering.
      expect(src).toContain("MobileReadinessBottomNav");
      expect(src).not.toContain("isAdminPortalAccess");
      expect(src).not.toMatch(/return\s+null/);
      const useEffectIdx = src.indexOf("useEffect(");
      const navReturnIdx = src.indexOf("return <MobileReadinessBottomNav />");
      expect(useEffectIdx).toBeGreaterThan(-1);
      expect(navReturnIdx).toBeGreaterThan(useEffectIdx);
    });

    it("App.tsx mounts BottomNav on mobile replacement routes and suppresses the global Copilot FAB there", async () => {
      const APP_TSX = resolve(REPO_ROOT, "client/src/App.tsx");
      const src = await readFile(APP_TSX, "utf8");
      // CRITICAL #194 contract: BottomNav must still mount for
      // non-shell user-portal sessions so its useEffect-driven
      // override self-heal (`pruneOverrideToPolicyIds`) keeps running
      // even though the bar itself returns null and is invisible.
      // Universal admin hub routes provide their own navigation chrome,
      // so BottomNav must not mount there.
      expect(src).toContain("{!isLoginRoute && !usesUniversalOpsShell && <BottomNav />}");
      expect(src).toContain("usesMobileReadinessReplacement");
      expect(src).toContain("isMobileReadinessReplacementPath");
      expect(src).toContain(
        "{!isLoginRoute && !usesUniversalOpsShell && !usesMobileReadinessReplacement && <CopilotFab />}"
      );
      expect(src).not.toMatch(/\{\s*isAdminPortal\s*&&\s*<BottomNav\s*\/>\s*\}/);
      // Mobile clearance is scoped to the admin portal AND off the ops shell
      // (no orphan `pb-14` strip on routes where BottomNav isn't mounted).
      expect(src).toContain("isAdminPortal");
      expect(src).toContain("isAdminPortalAccess");
      expect(src).toContain("permissions.hubAdmin");
      expect(src).toMatch(
        /isAdminPortal\s*&&\s*!\s*usesUniversalOpsShell\s*\?\s*"pb-20 md:pb-0"\s*:\s*""/
      );
      // Must not reintroduce the legacy unconditional clearance.
      expect(src).not.toMatch(
        /className=\{`min-h-screen \$\{isLoginRoute \? "" : "pb-14 md:pb-0"\}`\}/
      );

      // CRITICAL #194 contract: because BottomNav is gated off ops-shell
      // routes, UniversalOpsShell must carry the same prune self-heal so a
      // stale/tampered admin override never lingers in storage for sessions
      // that only ever see the ops shell.
      const shell = await readFile(
        resolve(REPO_ROOT, "client/src/components/ops/UniversalOpsShell.tsx"),
        "utf8"
      );
      expect(shell).toContain("pruneOverrideToPolicyIds");
      expect(shell).toContain("writeNavOverride");
      expect(shell).toContain("clearNavOverride");
    });

    it("portal-login.tsx writes nav state ONLY through the centralised adapter", async () => {
      const src = await readFile(PORTAL_LOGIN, "utf8");
      const roleHintSrc = await readFile(ROLE_HINT, "utf8");
      // Brief #194 requirement: PortalLogin MUST write nav state
      // through a centralised helper, not raw `localStorage`.
      expect(src).toContain("rememberRoleHint");
      expect(src).toContain("clearUserRole");
      expect(roleHintSrc).toContain("writeUserRole");
      expect(roleHintSrc).toContain("clearNavOverride");
      expect(src).not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
      expect(roleHintSrc).not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
    });
  });

  describe("pruneOverrideToPolicyIds — partial-conflict self-heal", () => {
    it("drops disallowed ids but keeps allowed ids in user-preferred order", () => {
      const userIds = getPrimaryCategoriesForRole("deck_officer").map((c) => c.id);
      // Mixed override: one valid user id + two admin ids.
      const mixed = [userIds[0], "maintenance", "system", userIds[1]];
      const pruned = pruneOverrideToPolicyIds("deck_officer", mixed);
      expect(pruned).toEqual([userIds[0], userIds[1]]);
    });

    it("returns null when the override is already clean (no rewrite needed)", () => {
      const userIds = getPrimaryCategoriesForRole("deck_officer").map((c) => c.id);
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
      const userIds = getPrimaryCategoriesForRole("deck_officer").map((c) => c.id);
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
      const overrideLiteralMatches = src.match(/"arus-bottom-nav-items"/g) ?? [];
      // The literals appear only in the doc comments at the top of
      // the file (as `arus-user-role` / `arus-bottom-nav-items` inside
      // backticks). Forbid the JS-string spelling.
      expect(roleLiteralMatches.length).toBe(0);
      expect(overrideLiteralMatches.length).toBe(0);
    });
  });
});
