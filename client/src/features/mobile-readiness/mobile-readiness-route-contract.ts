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

function normalizeMobileReadinessPath(path: string): string {
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
