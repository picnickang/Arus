/**
 * Public API path policy.
 *
 * Keep this module small and dependency-free so it can be reused by bootstrap
 * middleware, security middleware, and route registration without creating
 * domain coupling. Paths are expressed without the leading /api prefix because
 * Express strips the mount path inside app.use('/api', ...).
 */
import type { Request } from "express";

// LR-3.5 / V3 — Public-API allowlist audit.
//
// EVERY entry below must be unauthenticated by design. Adding a new
// entry is a security-sensitive change: the route runs without a
// session, without an orgId, and without RBAC. Any new entry MUST
// carry a one-line justification in this comment block and a regression
// pin in `tests/unit/lr35-public-api-paths-audit.test.ts` so it is
// impossible to silently re-list a sensitive prefix.
//
// EXACT_PUBLIC_API_PATHS — exact-match only (no prefix sub-paths).
//   /admin/auth/verify   — token verification, used by the bootstrap
//                          UI before a session exists.
//   /admin/auth/status   — boolean "is the system already set up?",
//                          used by the bootstrap UI on first load.
//   /admin/auth/setup    — one-shot bootstrap-password POST gated by
//                          a setup token (compared via constant time,
//                          see server/lib/constant-time-compare.ts).
//   /setup/status        — sibling of /admin/auth/status for the
//                          unauth setup wizard.
//   /setup/complete      — sibling of /admin/auth/setup.
const EXACT_PUBLIC_API_PATHS = new Set([
  "/admin/auth/verify",
  "/admin/auth/status",
  "/admin/auth/setup",
  "/setup/status",
  "/setup/complete",
]);

// PUBLIC_API_PREFIXES — prefix-match (and bare path) is allowed.
//   /health, /healthz, /readyz, /metrics — liveness / readiness /
//     Prometheus scraping. Must be unauthenticated so external probes
//     (Kubernetes, load balancer, monitoring) can reach them.
//   /observability/web-vitals — Wave 5.9 sendBeacon receipt. The
//     beacon API cannot always attach session cookies; the payload is
//     intrinsically untrusted and sanitized server-side.
const PUBLIC_API_PREFIXES = [
  "/health",
  "/healthz",
  "/readyz",
  "/metrics",
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
