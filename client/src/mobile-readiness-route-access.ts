const DECK_MOBILE_READINESS_ROLES = new Set(["deck_officer", "captain", "vessel_master"]);
const CREW_MOBILE_READINESS_ROLES = new Set([
  "crew_member",
  "crew",
  "viewer",
  "technician",
  "maintenance_technician",
]);
const DECK_MOBILE_READINESS_EXACT_PATHS = new Set([
  "/fleet",
  "/vessel-intelligence",
  "/crew-management",
  "/pdm-platform",
]);
const DECK_MOBILE_READINESS_PREFIXES = ["/fleet/", "/vessel-intelligence/", "/pdm/equipment/"];

function pathMatches(currentPath: string, exactPaths: Set<string>, prefixes: string[]): boolean {
  return exactPaths.has(currentPath) || prefixes.some((prefix) => currentPath.startsWith(prefix));
}

function isLogsPath(currentPath: string): boolean {
  return currentPath === "/logs" || currentPath.startsWith("/logs/");
}

export function isRegularMobileReadinessRouteAllowed(role: string | null, path: string): boolean {
  const roleName = (role ?? "").toLowerCase();
  const currentPath = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  if (isLogsPath(currentPath)) {
    return DECK_MOBILE_READINESS_ROLES.has(roleName) || CREW_MOBILE_READINESS_ROLES.has(roleName);
  }
  if (!DECK_MOBILE_READINESS_ROLES.has(roleName)) {
    return false;
  }
  return pathMatches(
    currentPath,
    DECK_MOBILE_READINESS_EXACT_PATHS,
    DECK_MOBILE_READINESS_PREFIXES
  );
}
