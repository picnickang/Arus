/**
 * Route → hub classification helpers for access gating.
 *
 * Split out of App.tsx to keep it under the long-file ceiling. Prefers the
 * user-facing nav classification (getHubIdForRoute) and falls back to the
 * structural route-group map.
 */
import { getHubIdForRoute } from "@/config/navigationConfig";
import { operationsRoutes } from "@/routes/operations";
import { fleetRoutes } from "@/routes/fleet";
import { maintenanceRoutes } from "@/routes/maintenance";
import { crewRoutes } from "@/routes/crew";
import { logisticsRoutes } from "@/routes/logistics";
import { recordsRoutes } from "@/routes/records";
import { analyticsRoutes } from "@/routes/analytics";
import { systemRoutes } from "@/routes/system";

const ROUTE_GROUP_HUB_BY_PATH: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const groups: Array<[string, ReadonlyArray<{ path: string }>]> = [
    ["operations", operationsRoutes],
    ["fleet", fleetRoutes],
    ["maintenance", maintenanceRoutes],
    ["crew", crewRoutes],
    ["logistics", logisticsRoutes],
    ["records", recordsRoutes],
    ["analytics", analyticsRoutes],
    ["system", systemRoutes],
  ];
  for (const [hubId, routes] of groups) {
    for (const { path } of routes) {
      map[path] = hubId;
    }
  }
  return map;
})();

/**
 * Resolve the hub a route belongs to for access gating. Prefers the
 * user-facing nav classification (`getHubIdForRoute`, from
 * `navigationCategories`) so a page is gated by the hub it is *shown under*;
 * falls back to the route's structural group. Returns null only for routes
 * outside every hub group (home, portal-login, feedback) — those are never
 * hub-gated.
 */
export function resolveRouteHubId(path: string): string | null {
  return getHubIdForRoute(path) ?? ROUTE_GROUP_HUB_BY_PATH[path] ?? null;
}

function normalizeRoutePath(path: string): string {
  return (path.split("?")[0] ?? path).split("#")[0] ?? path;
}

function routePatternMatchesCurrent(routePattern: string, currentPath: string): boolean {
  const patternSegments = normalizeRoutePath(routePattern).split("/").filter(Boolean);
  const currentSegments = normalizeRoutePath(currentPath).split("/").filter(Boolean);
  if (patternSegments.length !== currentSegments.length) {
    return false;
  }
  return patternSegments.every((segment, index) => {
    return segment.startsWith(":") || segment === currentSegments[index];
  });
}

export function resolveCurrentRouteHubId(path: string): string | null {
  const navHubId = getHubIdForRoute(path);
  if (navHubId) {
    return navHubId;
  }
  for (const [routePath, hubId] of Object.entries(ROUTE_GROUP_HUB_BY_PATH)) {
    if (routePatternMatchesCurrent(routePath, path)) {
      return hubId;
    }
  }
  return null;
}
