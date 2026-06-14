/**
 * Shared nav-target derivation for the Playwright lanes.
 *
 * The single source of truth is `navigationCategories` in
 * `client/src/config/navigationConfig.ts`; `buildNavTargets()` is lifted
 * verbatim from `nav-matrix.spec.ts` so every lane (nav matrix, stress crawl)
 * walks exactly the registered routes and auto-syncs when nav changes.
 */

import { navigationCategories, migrateRoute } from "../../../client/src/config/navigationConfig";

export interface NavTarget {
  readonly label: string;
  readonly href: string;
  readonly resolved: string;
  readonly category: string;
  readonly kind: "hub" | "child";
}

/** The 8 top-level hub roots, in declaration order. */
export const HUBS: ReadonlyArray<{ id: string; hubRoute: string }> = navigationCategories.map(
  (category) => ({ id: category.id, hubRoute: category.hubRoute })
);

/**
 * Build the full list of nav targets from the single source of truth.
 * De-dupe by resolved URL so we don't visit `/foo` twice when two children
 * alias the same destination after `migrateRoute`.
 */
export function buildNavTargets(): NavTarget[] {
  const seen = new Set<string>();
  const out: NavTarget[] = [];
  for (const cat of navigationCategories) {
    const hubResolved = migrateRoute(cat.hubRoute);
    if (!seen.has(hubResolved)) {
      seen.add(hubResolved);
      out.push({
        label: cat.name,
        href: cat.hubRoute,
        resolved: hubResolved,
        category: cat.id,
        kind: "hub",
      });
    }
    for (const child of cat.children) {
      const resolvedChild = migrateRoute(child.href);
      if (seen.has(resolvedChild)) {
        continue;
      }
      seen.add(resolvedChild);
      out.push({
        label: child.name,
        href: child.href,
        resolved: resolvedChild,
        category: cat.id,
        kind: "child",
      });
    }
  }
  return out;
}
