/**
 * Phase 2 (Task #309) — admin no-hubs safe fallback.
 *
 * An admin-portal account whose hub allow-list is a populated-but-empty
 * set (granted admin access, zero hubs) must NOT see a blank command
 * center. `HomePage` renders an explicit, honest fallback page with a
 * profile link and a logout affordance when both `pinnedGroups` and
 * `otherGroups` resolve to empty.
 *
 * Two layers are pinned here:
 *   1. Policy layer — `filterCategoriesByHubAccess(cats, [])` returns an
 *      empty set, which is the precondition that drives the fallback.
 *   2. Source contract — `home.tsx` contains the gated fallback render
 *      (`shell-admin-no-hubs`) so the safe page can't silently regress.
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
    expect(cats.length).toBe(5);
    // [] = granted admin access, no hubs assigned → nothing to launch.
    expect(filterCategoriesByHubAccess(cats, [])).toEqual([]);
    // null = unrestricted (super-admin / dev) → all hubs survive.
    expect(filterCategoriesByHubAccess(cats, null).length).toBe(5);
  });

  describe("home.tsx source contract", () => {
    let homeSrc = "";

    beforeAll(async () => {
      homeSrc = await readSrc("client/src/pages/home.tsx");
    });

    it("renders the safe fallback shell when no hubs are visible", () => {
      expect(homeSrc).toMatch(/data-testid="shell-admin-no-hubs"/);
    });

    it("gates the fallback on both group sets being empty", () => {
      expect(homeSrc).toMatch(
        /pinnedGroups\.length === 0 && otherGroups\.length === 0/,
      );
    });

    it("offers a profile route and a logout affordance from the fallback", () => {
      expect(homeSrc).toMatch(/data-testid="button-no-hubs-profile"/);
      expect(homeSrc).toMatch(/setLocation\("\/profile"\)/);
      expect(homeSrc).toMatch(/<LogoutButton\b/);
    });
  });
});
