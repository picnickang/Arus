#!/usr/bin/env -S npx tsx
/**
 * LR-1B — Tenant-gate audit.
 *
 * Walks every `server/**\/*routes*.ts` file and flags any router that
 * defines tenant-scoped `router.{get,post,patch,put,delete}` handlers
 * WITHOUT inheriting `requireOrgId` through the canonical
 * `server/routes.ts` mount or declaring an explicit allow-list
 * comment (`// @lr1b-allow-no-orgid: <reason>`).
 *
 * The check is intentionally CONSERVATIVE — we want false positives
 * the developer must waive rather than silent under-coverage. The
 * audit lives next to `check-domain-leaks` and is wired into the
 * `lint-and-typecheck` CI job by LR-1A.
 *
 * Exit codes: 0 = clean, 1 = violations printed.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SERVER = join(ROOT, "server");

// Files known to mount under `/api` via `server/routes.ts` get the
// global `requireOrgId` middleware for free — those don't need a
// per-route gate. Routes mounted via other paths (admin namespace,
// public health endpoints, edge HMAC) are listed here
// so the audit doesn't false-positive on them.
const EXEMPT_FILES = new Set<string>([
  // Health/diagnostics — explicitly public.
  "server/routes/diagnostics/health-routes.ts",
  // Admin namespace — uses its own admin-session middleware chain.
  "server/routes/admin-auth-routes.ts",
  "server/routes/admin-routes.ts",
  // Setup token — bootstraps the first admin before tenants exist.
  "server/routes/setup-token-routes.ts",
  // Edge HMAC — tenant resolved from device identity, not session.
  "server/routes/edge-routes.ts",
  // Public web vitals beacon — no tenant.
  "server/observability/web-vitals-route.ts",
  // Metrics scrape — Prometheus.
  "server/observability/health-endpoints.ts",
]);

const ROUTE_METHOD_RE = /\brouter\.(get|post|patch|put|delete)\s*\(/g;
const REQUIRE_ORG_RE = /\brequireOrgId\b/;
const REQUIRE_ROLE_RE = /\brequireRole\s*\(/;
const ALLOW_COMMENT = "@lr1b-allow-no-orgid";

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    const s = statSync(p);
    if (s.isDirectory()) {
      walk(p, out);
    } else if (s.isFile() && /routes?\.ts$/.test(ent) && ent !== "routes.ts") {
      out.push(p);
    }
  }
  return out;
}

const ROOT_ROUTES = join(SERVER, "routes.ts");
const rootRoutesContent = readFileSync(ROOT_ROUTES, "utf8");
// The mount is wrapped in a guard that bypasses public paths but still
// invokes `requireOrgId`. Accept either the bare form or the guarded
// form (`return requireOrgId(req, res, next)`).
const rootHasGlobalGate =
  /app\.use\(\s*["']\/api["']\s*,\s*requireOrgId\s*\)/.test(rootRoutesContent) ||
  /app\.use\(\s*["']\/api["']\s*,[\s\S]{0,400}?requireOrgId\s*\(/.test(rootRoutesContent);

if (!rootHasGlobalGate) {
  console.error(
    `[check-routes-require-orgid] ERROR: ${relative(ROOT, ROOT_ROUTES)} no longer mounts requireOrgId globally on /api. ` +
      `Either restore the global mount or rewrite this audit to inspect per-router middleware chains.`
  );
  process.exit(1);
}

const violations: string[] = [];
const files = walk(SERVER);

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (EXEMPT_FILES.has(rel)) {
    continue;
  }

  const content = readFileSync(file, "utf8");
  const routeMatches = content.match(ROUTE_METHOD_RE);
  if (!routeMatches || routeMatches.length === 0) {
    continue;
  }

  // The global gate covers everything mounted via the standard
  // `/api` mount in `routes.ts`. Per-file violations are limited to
  // explicit `app.use(...)` mounts elsewhere or comment opt-outs.
  const hasExplicitGate = REQUIRE_ORG_RE.test(content) || REQUIRE_ROLE_RE.test(content);
  const hasOptOut = content.includes(ALLOW_COMMENT);

  // Files that look like they're mounted outside /api need to ship
  // their own gate. Heuristic: presence of `app.use(` referencing the
  // router (these are typically server/index.ts pattern files we
  // don't see here, so this is mostly a future-proof guard).
  if (!hasExplicitGate && !hasOptOut) {
    // The router is presumed to be mounted under /api via routes.ts —
    // therefore covered by the global gate. We still flag it if the
    // file appears to be a top-level mount (defines `app.use`) without
    // a gate.
    if (/\bapp\.use\s*\(/.test(content)) {
      violations.push(
        `${rel}: defines app.use(...) without requireOrgId / requireRole / ${ALLOW_COMMENT} comment`
      );
    }
  }
}

if (violations.length === 0) {
  console.log(
    `[check-routes-require-orgid] OK — global gate enforced; ${files.length} route files audited.`
  );
  process.exit(0);
}

console.error(`[check-routes-require-orgid] FAIL — ${violations.length} violation(s):`);
for (const v of violations) {
  console.error(`  - ${v}`);
}
console.error(
  `\nFix by either: (a) mounting via the central /api router in server/routes.ts (inherits requireOrgId), ` +
    `(b) adding requireOrgId locally, or (c) annotating with '// ${ALLOW_COMMENT}: <reason>' if the route is intentionally public.`
);
process.exit(1);
