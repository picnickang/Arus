/**
 * Admin no-hubs overview contract (Task #359 — supersedes the #309 blank
 * fallback).
 *
 * An admin-portal account whose hub allow-list is a populated-but-empty
 * set (granted admin access, zero hubs) must NOT see a blank command
 * center, and must NOT be hidden from the hubs either. The overview lists
 * EVERY admin hub — all rendered as LOCKED — with an explicit banner
 * explaining that nothing is unlocked yet, plus a logout affordance.
 *
 * Two layers are pinned here:
 *   1. Policy layer — `filterCategoriesByHubAccess(cats, [])` returns an
 *      empty set (zero hubs OPENABLE), distinct from `null` (all hubs).
 *   2. Source contract — `home.tsx` maps over the full hub set, renders
 *      locked hubs non-actionably, and shows the `banner-no-hubs` notice
 *      when `accessibleCount === 0` (the old `shell-admin-no-hubs` blank
 *      fallback is gone).
 *
 * This is a source-scan (not a DOM render) on purpose: the admin
 * `HomePage` pulls in the full command-center dependency graph, which is
 * out of reach for a lightweight unit test.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  getAdminPrimaryCategories,
  filterCategoriesByHubAccess,
} from "@/application/navigation/role-navigation-policy";

async function readSrc(p: string): Promise<string> {
  return readFile(resolve(process.cwd(), p), "utf8");
}

describe("Phase 2 — admin no-hubs safe fallback", () => {
  it("policy: an empty hub allow-list yields zero admin categories", () => {
    const cats = getAdminPrimaryCategories();
    expect(cats.length).toBe(8);
    // [] = granted admin access, no hubs assigned → nothing to launch.
    expect(filterCategoriesByHubAccess(cats, [])).toEqual([]);
    // null = unrestricted (super-admin / dev) → all hubs survive.
    expect(filterCategoriesByHubAccess(cats, null).length).toBe(8);
  });

  describe("home.tsx source contract", () => {
    let homeSrc = "";

    beforeAll(async () => {
      homeSrc = await readSrc("client/src/pages/home.tsx");
    });

    it("lists every admin hub (accessible or locked), not just the granted ones", () => {
      expect(homeSrc).toMatch(/const allHubs/);
      expect(homeSrc).toMatch(/allHubs\.map\(/);
      expect(homeSrc).toMatch(/data-testid={`card-hub-\$\{hub\.id\}`}/);
    });

    it("renders locked hubs as non-actionable with a Locked pill", () => {
      expect(homeSrc).toMatch(/data-testid={`pill-locked-\$\{hub\.id\}`}/);
      expect(homeSrc).toMatch(/aria-disabled="true"/);
    });

    it("shows an explicit banner when the admin has zero accessible hubs", () => {
      expect(homeSrc).toMatch(/accessibleCount === 0/);
      expect(homeSrc).toMatch(/data-testid="banner-no-hubs"/);
    });

    it("no longer renders the old blank no-hubs fallback shell", () => {
      expect(homeSrc).not.toMatch(/data-testid="shell-admin-no-hubs"/);
    });

    it("keeps a logout affordance available on the overview", () => {
      expect(homeSrc).toMatch(/<LogoutButton\b/);
    });
  });
});
