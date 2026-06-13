// Mobile-readiness route contract — single source of truth for how an app path
// behaves on mobile. Layered:
//   1. base       — does a path have a mobile replacement screen, and which one;
//   2. classifier — classifyMobileRoute / isSafeForBottomNav (Phase 1, #58/#60);
//   3. ops guard  — UniversalOpsShell mobile helpers built on the classifier (Phase 2).
//
// The consolidation PRs (#56/#57) deleted layers 1 and the classifier while
// keeping the Phase-2 callers; this module restores the base + classifier so the
// existing Phase-2 helpers resolve as originally written.

export type MobileReadinessScreenMarker =
  | "command"
  | "fleet"
  | "vessel-detail"
  | "vessel-diagram"
  | "pdm-queue"
  | "pdm-asset-case"
  | "pdm-telemetry"
  | "work-queue"
  | "work-execution"
  | "logs"
  | "crew"
  | "inventory"
  | "settings";

export function normalizeMobileReadinessPath(path: string): string {
  return (path.split("?")[0] ?? path).split("#")[0] ?? path;
}

export function isMobileReadinessReplacementPath(path: string): boolean {
  const currentPath = normalizeMobileReadinessPath(path);
  return (
    currentPath === "/" ||
    currentPath === "/fleet" ||
    currentPath.startsWith("/fleet/") ||
    currentPath === "/vessel-intelligence" ||
    currentPath.startsWith("/vessel-intelligence/") ||
    currentPath === "/maint" ||
    currentPath === "/work-orders" ||
    currentPath.startsWith("/work-orders/") ||
    currentPath === "/pdm-platform" ||
    currentPath.startsWith("/pdm/equipment/") ||
    currentPath === "/logs" ||
    currentPath.startsWith("/logs/") ||
    currentPath === "/crew-management" ||
    currentPath === "/logistics" ||
    currentPath === "/system"
  );
}

export function getMobileReadinessExpectedScreen(path: string): MobileReadinessScreenMarker | null {
  const currentPath = normalizeMobileReadinessPath(path);

  if (currentPath === "/") {
    return "command";
  }
  if (currentPath === "/fleet" || currentPath.startsWith("/fleet/")) {
    return "fleet";
  }
  if (currentPath.includes("diagram") || currentPath.endsWith("/3d")) {
    return "vessel-diagram";
  }
  if (currentPath === "/vessel-intelligence" || currentPath.startsWith("/vessel-intelligence/")) {
    return "vessel-detail";
  }
  if (currentPath === "/maint" || currentPath === "/pdm-platform") {
    return "pdm-queue";
  }
  if (currentPath.startsWith("/pdm/equipment/") && currentPath.endsWith("/telemetry")) {
    return "pdm-telemetry";
  }
  if (currentPath.startsWith("/pdm/equipment/")) {
    return "pdm-asset-case";
  }
  if (currentPath === "/work-orders") {
    return "work-queue";
  }
  if (currentPath.startsWith("/work-orders/")) {
    return "work-execution";
  }
  if (currentPath === "/logs" || currentPath.startsWith("/logs/")) {
    return "logs";
  }
  if (currentPath === "/crew-management") {
    return "crew";
  }
  if (currentPath === "/logistics") {
    return "inventory";
  }
  if (currentPath === "/system") {
    return "settings";
  }

  return null;
}

// --- Phase 1: route classifier -------------------------------------------------

export type MobileRouteStatus = "mobileReplacement" | "universalAdminShell" | "missing";

export interface MobileRouteClassification {
  /** Where this path lands on mobile. */
  status: MobileRouteStatus;
  /** Safe to surface / keep active in the mobile bottom nav. */
  isSafeForMobileBottomNav: boolean;
  /** The mobile screen marker when the path has a replacement screen. */
  expectedScreen: MobileReadinessScreenMarker | null;
}

/**
 * Admin / ops-shell paths that render their own UniversalOpsShell chrome and
 * must never appear in the mobile bottom nav. Mobile-replacement routes are
 * matched first in classifyMobileRoute, so this only sees non-replacement paths.
 */
function isUniversalAdminShellPath(path: string): boolean {
  const currentPath = normalizeMobileReadinessPath(path);
  return currentPath === "/admin" || currentPath.startsWith("/admin/");
}

/**
 * Classify how a path behaves on mobile. The single source of truth that
 * isSafeForBottomNav, the UniversalOpsShell guard, and isMobileContext build on.
 */
export function classifyMobileRoute(
  path: string,
  roleHint: string | null = null
): MobileRouteClassification {
  void roleHint; // reserved for future role-aware classification
  if (isMobileReadinessReplacementPath(path)) {
    return {
      status: "mobileReplacement",
      isSafeForMobileBottomNav: true,
      expectedScreen: getMobileReadinessExpectedScreen(path),
    };
  }
  if (isUniversalAdminShellPath(path)) {
    return {
      status: "universalAdminShell",
      isSafeForMobileBottomNav: false,
      expectedScreen: null,
    };
  }
  return {
    status: "missing",
    isSafeForMobileBottomNav: false,
    expectedScreen: null,
  };
}

/** Whether a path is safe to surface / keep active in the mobile bottom nav. */
export function isSafeForBottomNav(path: string): boolean {
  return classifyMobileRoute(path).isSafeForMobileBottomNav;
}

// --- Phase 2: UniversalOpsShell mobile guard -----------------------------------

export function shouldBlockUniversalOpsShellForMobile(
  path: string,
  roleHint: string | null = null
): boolean {
  const classification = classifyMobileRoute(path, roleHint);
  return (
    classification.status === "universalAdminShell" && !classification.isSafeForMobileBottomNav
  );
}

export function getMobileFallbackPath(path: string): string {
  // Fallback to safe mobile landing
  return shouldBlockUniversalOpsShellForMobile(path) ? "/today" : path;
}

export function isMobileContext(path: string): boolean {
  return (
    isMobileReadinessReplacementPath(path) ||
    classifyMobileRoute(path).status === "mobileReplacement"
  );
}
