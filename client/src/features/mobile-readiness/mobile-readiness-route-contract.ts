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

export type MobileRouteStatus =
  | 'mobileReplacement'     // Fully handled by MobileReadinessRoute
  | 'mobileUserPage'        // Acceptable mobile page (may need polish)
  | 'universalAdminShell'   // Desktop-heavy shell - block from mobile nav
  | 'legacyCardLayout'      // Uses old desktop patterns
  | 'missing';              // Unknown / risky

export interface MobileRouteClassification {
  status: MobileRouteStatus;
  isSafeForMobileBottomNav: boolean;
  recommendedMobileScreen?: MobileReadinessScreenMarker | null;
  requiresModernization: boolean;
  notes?: string;
}

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

export function getMobileReadinessExpectedScreen(
  path: string
): MobileReadinessScreenMarker | null {
  const currentPath = normalizeMobileReadinessPath(path);

  if (currentPath === "/") return "command";
  if (currentPath === "/fleet" || currentPath.startsWith("/fleet/")) return "fleet";
  if (currentPath.includes("diagram") || currentPath.endsWith("/3d")) return "vessel-diagram";
  if (currentPath === "/vessel-intelligence" || currentPath.startsWith("/vessel-intelligence/")) return "vessel-detail";
  if (currentPath === "/maint" || currentPath === "/pdm-platform") return "pdm-queue";
  if (currentPath.startsWith("/pdm/equipment/") && currentPath.endsWith("/telemetry")) return "pdm-telemetry";
  if (currentPath.startsWith("/pdm/equipment/")) return "pdm-asset-case";
  if (currentPath === "/work-orders") return "work-queue";
  if (currentPath.startsWith("/work-orders/")) return "work-execution";
  if (currentPath === "/logs" || currentPath.startsWith("/logs/")) return "logs";
  if (currentPath === "/crew-management") return "crew";
  if (currentPath === "/logistics") return "inventory";
  if (currentPath === "/system") return "settings";

  return null;
}

// New Phase 1 classifier - Single source of truth
const routeClassificationMap: Record<string, Omit<MobileRouteClassification, 'isSafeForMobileBottomNav'>> = {
  '/': { status: 'mobileReplacement', recommendedMobileScreen: 'command', requiresModernization: false },
  '/fleet': { status: 'mobileReplacement', recommendedMobileScreen: 'fleet', requiresModernization: false },
  '/work-orders': { status: 'mobileReplacement', recommendedMobileScreen: 'work', requiresModernization: false },
  '/pdm-platform': { status: 'mobileReplacement', recommendedMobileScreen: 'pdm-queue', requiresModernization: false },
  '/logs': { status: 'mobileReplacement', recommendedMobileScreen: 'logs', requiresModernization: false },
  '/crew-management': { status: 'mobileReplacement', recommendedMobileScreen: 'crew', requiresModernization: false },
  '/logistics': { status: 'mobileReplacement', recommendedMobileScreen: 'inventory', requiresModernization: false },
  '/system': { status: 'mobileUserPage', recommendedMobileScreen: 'settings', requiresModernization: true, notes: 'Settings - good candidate for polish' },
  '/profile': { status: 'legacyCardLayout', recommendedMobileScreen: null, requiresModernization: true, notes: 'Inconsistent across roles - prioritize' },
  '/my-tasks': { status: 'legacyCardLayout', recommendedMobileScreen: null, requiresModernization: true },
  '/attention-inbox': { status: 'missing', recommendedMobileScreen: null, requiresModernization: true, notes: 'Add handling or remove from nav' },
  // Add more as audit progresses
};

export function classifyMobileRoute(path: string, roleHint: string | null = null): MobileRouteClassification {
  const normalized = normalizeMobileReadinessPath(path);

  // Exact match
  let base = routeClassificationMap[normalized];

  // Prefix fallbacks
  if (!base) {
    if (normalized.startsWith('/fleet') || normalized.startsWith('/vessel')) {
      base = { status: 'mobileReplacement', recommendedMobileScreen: 'fleet', requiresModernization: false };
    } else if (normalized.startsWith('/work') || normalized.includes('order')) {
      base = { status: 'mobileReplacement', recommendedMobileScreen: 'work', requiresModernization: false };
    } else if (normalized.includes('admin') || normalized.includes('UniversalOpsShell')) {
      base = { status: 'universalAdminShell', recommendedMobileScreen: null, requiresModernization: true, notes: 'Desktop shell - block from mobile nav' };
    } else if (normalized === '/profile' || normalized.includes('user')) {
      base = { status: 'legacyCardLayout', recommendedMobileScreen: null, requiresModernization: true };
    } else {
      base = { status: 'missing', recommendedMobileScreen: null, requiresModernization: true, notes: `Unknown: ${normalized}` };
    }
  }

  return {
    ...base,
    isSafeForMobileBottomNav: ['mobileReplacement', 'mobileUserPage'].includes(base.status),
  };
}

export function isSafeForBottomNav(path: string): boolean {
  return classifyMobileRoute(path).isSafeForMobileBottomNav;
}

export { getMobileReadinessExpectedScreen, isMobileReadinessReplacementPath }; // backward compat
