/**
 * Response-envelope migration manifest.
 *
 * Domains are migrated in waves by adding their path prefixes to
 * ENVELOPED_PREFIXES; scripts/check-envelope-adoption.mjs ratchets the list
 * (prefixes may only be added, never removed). The endgame flips to a single
 * "/api" entry minus the exclusions below.
 *
 * EXCLUSIONS are frozen contracts and must never be enveloped:
 * - device/edge ingestion + agent surfaces (C# Windows agent, edge firmware)
 * - beacons and probes consumed by infra, not the app client
 * Changing the exclusion list requires updating the pin in
 * tests/unit/envelope-middleware.test.ts — deliberate, reviewed edits only.
 */

export const ENVELOPED_PREFIXES: readonly string[] = [
  // Wave 0 pilot
  "/api/home",
  // Aggregate endpoints — born enveloped
  "/api/crew/unified",
  "/api/optimization/dashboard",
  // Wave 1: read-heavy core domains
  "/api/equipment",
  "/api/vessels",
  "/api/pdm",
  "/api/optimization",
  // Wave 2: mutation-heavy domains (offline-queueable families)
  "/api/work-orders",
  "/api/maintenance-checklist",
  "/api/parts-inventory",
  "/api/purchase-orders",
  "/api/offshore-ops",
  "/api/service-requests",
  "/api/service-orders",
];

export const ENVELOPE_EXCLUDED_PREFIXES: readonly string[] = [
  // Telemetry ingestion: C# agent / edge firmware contract (503-disabled HTTP
  // path today; the real path is agent → SQLite → sqlite-bridge).
  "/api/telemetry/readings",
  "/api/telemetry/bulk",
  // HMAC-validated edge/agent surfaces.
  "/api/agent",
  "/api/edge",
  // Beacons + probes: fire-and-forget clients that never read bodies, and
  // infra that expects exact shapes.
  "/api/observability/web-vitals",
  "/api/error-logs",
  // Spec/document endpoints serve raw documents, not API data.
  "/api/openapi.json",
  "/api/docs",
];

function normalizePath(path: string): string {
  // The /api/v1 rewrite re-dispatches into /api/*; envelope decisions must be
  // identical for both spellings.
  const bare = path.split("?")[0] ?? path;
  return bare.startsWith("/api/v1/") ? bare.replace("/api/v1/", "/api/") : bare;
}

function matchesPrefix(path: string, prefix: string): boolean {
  if (prefix.endsWith("/")) {
    return path.startsWith(prefix);
  }
  // Segment-aware: "/api/home" matches "/api/home/x" but never "/api/homeX".
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isEnvelopedPath(path: string): boolean {
  const normalized = normalizePath(path);
  if (ENVELOPE_EXCLUDED_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix))) {
    return false;
  }
  return ENVELOPED_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix));
}
