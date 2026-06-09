import {
  getHubIdForRoute,
  navigationCategories,
  type NavigationCategory,
  type NavigationItem,
} from "@/config/navigationConfig";
import { filterCategoriesByHubAccess } from "./role-navigation-policy";

const DEEP_ROUTE_PREFIX_HUBS: Array<[prefix: string, hubId: string]> = [
  ["/vessel-intelligence/", "fleet"],
  ["/fleet/", "fleet"],
  ["/vessels/", "fleet"],
  ["/equipment-schematic/", "fleet"],
  ["/reports/vessel/", "fleet"],
  ["/work-orders/", "maintenance"],
  ["/admin/", "system"],
];

function normalizePath(path: string): string {
  return (path.split("?")[0] ?? path).split("#")[0] ?? path;
}

export function resolveActiveOpsHubId(path: string): string | null {
  const normalized = normalizePath(path);
  const navHubId = getHubIdForRoute(normalized);
  if (navHubId) {
    return navHubId;
  }
  for (const [prefix, hubId] of DEEP_ROUTE_PREFIX_HUBS) {
    if (normalized.startsWith(prefix)) {
      return hubId;
    }
  }
  return null;
}

export function isUniversalOpsShellRoute(path: string): boolean {
  return resolveActiveOpsHubId(path) !== null;
}

export interface UniversalOpsNavModel {
  primaryHubs: NavigationCategory[];
  activeHub: NavigationCategory | undefined;
  activeChildren: NavigationItem[];
}

export function buildUniversalOpsNavModel({
  currentPath,
  hubAccess,
  activeHubId,
}: {
  currentPath: string;
  hubAccess: readonly string[] | null | undefined;
  activeHubId?: string | null;
}): UniversalOpsNavModel {
  const primaryHubs = filterCategoriesByHubAccess(navigationCategories, hubAccess);
  const resolvedHubId = activeHubId ?? resolveActiveOpsHubId(currentPath);
  const activeHub = primaryHubs.find((category) => category.id === resolvedHubId);

  return {
    primaryHubs,
    activeHub,
    activeChildren: activeHub?.children ?? [],
  };
}
