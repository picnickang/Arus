/**
 * Public API path policy.
 *
 * Keep this module small and dependency-free so it can be reused by bootstrap
 * middleware, security middleware, and route registration without creating
 * domain coupling. Paths are expressed without the leading /api prefix because
 * Express strips the mount path inside app.use('/api', ...).
 */
import type { Request } from "express";

const EXACT_PUBLIC_API_PATHS = new Set([
  "/admin/auth/verify",
  "/admin/auth/status",
  "/admin/auth/setup",
  "/setup/status",
  "/setup/complete",
]);

const PUBLIC_API_PREFIXES = [
  "/health",
  "/healthz",
  "/readyz",
  "/metrics",
  // Wave 5.9: Web Vitals beacon receipt. sendBeacon cannot always
  // attach session cookies; the payload is intrinsically untrusted and
  // sanitized server-side, so the endpoint runs without auth.
  "/observability/web-vitals",
];

const SENSITIVE_API_PREFIXES = [
  "/admin/auth",
  "/auth",
  "/setup",
  "/config-management",
  "/software-updates",
];

function stripQuery(path: string): string {
  return path.split("?")[0] || "/";
}

export function toApiPath(reqOrPath: Request | string): string {
  const rawPath =
    typeof reqOrPath === "string"
      ? reqOrPath
      : reqOrPath.originalUrl || reqOrPath.path || reqOrPath.url || "/";

  const pathname = stripQuery(rawPath);
  if (pathname === "/api") {
    return "/";
  }
  if (pathname.startsWith("/api/")) {
    return pathname.slice("/api".length);
  }
  return pathname;
}

export function isPublicApiPath(reqOrPath: Request | string): boolean {
  const apiPath = toApiPath(reqOrPath);
  return (
    EXACT_PUBLIC_API_PATHS.has(apiPath) ||
    PUBLIC_API_PREFIXES.some((prefix) => apiPath === prefix || apiPath.startsWith(`${prefix}/`))
  );
}

export function isSensitiveApiPath(reqOrPath: Request | string): boolean {
  const apiPath = toApiPath(reqOrPath);
  return SENSITIVE_API_PREFIXES.some(
    (prefix) => apiPath === prefix || apiPath.startsWith(`${prefix}/`)
  );
}
