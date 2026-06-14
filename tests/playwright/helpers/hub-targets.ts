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

export interface DeepRoute {
  /** Stable id used for screenshot/baseline names. */
  readonly id: string;
  readonly path: string;
  /** The `getMobileReadinessExpectedScreen` marker this route should land on. */
  readonly expectedScreen: string;
}

/**
 * Representative DEEP sub-routes (beyond the hub roots), with the canonical test
 * data IDs (`mv-atlas`, `port-generator`, `so-4481`). Shared by the deep-route
 * visual spec and the deep-route real-backend smoke. `/digital-twin` and
 * `/vessels/:id/3d` are intentionally absent — they're heavy/blocked and only
 * exercised by the stress lane.
 */
export const DEEP_ROUTES: readonly DeepRoute[] = [
  {
    id: "vessel-overview",
    path: "/vessel-intelligence/mv-atlas/overview",
    expectedScreen: "vessel-detail",
  },
  {
    id: "vessel-diagrams",
    path: "/vessel-intelligence/mv-atlas/diagrams",
    expectedScreen: "vessel-diagram",
  },
  { id: "pdm-asset-case", path: "/pdm/equipment/port-generator", expectedScreen: "pdm-asset-case" },
  {
    id: "pdm-telemetry",
    path: "/pdm/equipment/port-generator/telemetry",
    expectedScreen: "pdm-telemetry",
  },
  { id: "work-execution", path: "/work-orders/so-4481", expectedScreen: "work-execution" },
  { id: "logs-deck", path: "/logs/deck", expectedScreen: "logs" },
  { id: "logs-engine", path: "/logs/engine", expectedScreen: "logs" },
  { id: "logs-compliance", path: "/logs/compliance", expectedScreen: "logs" },
  { id: "logistics-inventory", path: "/logistics?tab=inventory", expectedScreen: "inventory" },
];

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
