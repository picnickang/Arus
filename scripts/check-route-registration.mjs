#!/usr/bin/env node
/**
 * Route Registration Pattern Enforcement
 *
 * Ensures route registration only happens through the domain router registry
 * or explicit inline-routes.ts.
 *
 * Forbidden patterns:
 *   - app.get("/api/...", ...) outside of inline-routes.ts / domain modules
 *   - app.post("/api/...", ...) outside of inline-routes.ts / domain modules
 *   - app.use("/api/...", ...) outside of inline-routes.ts / domain modules
 *   - router.get("/api/...", ...) in files that aren't domain route files
 *
 * Run:  node scripts/check-route-registration.mjs
 * Exit: 0 = pass, 1 = violation found
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, resolve, relative, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const ALLOWED_ROUTE_FILES = new Set([
  "server/index.ts",
  "server/routes.ts",
  "server/routes/domain-router-registry.ts",
  "server/routes/route-dependencies.ts",
  "server/routes/inline-routes.ts",
  "server/routes/pdm-gap-fill-routes.ts",
  "server/routes/telemetry-dlq-routes.ts",
  "server/routes/telemetry-ingestion-routes.ts",
  "server/routes/home-routes.ts",
  "server/routes/kb-routes.ts",
  "server/routes/rag-routes.ts",
  "server/routes/rag-security-routes.ts",
  "server/routes/insights-routes.ts",
  "server/routes/equipment-context-routes.ts",
  "server/routes/analytics.ts",
  "server/routes/wo-so-bridge-routes.ts",
  "server/routes/service-request-routes.ts",
  "server/routes/agent-routes.ts",
  "server/routes/kb-ask-route.ts",
  "server/routes/sensorBundles.ts",
  "server/routes/sensorTemplates.ts",
  "server/routes/diagnostics.ts",
  "server/routes/observability-routes.ts",
  "server/middleware/api-versioning.ts",
  "server/swagger/swagger.ts",
]);

const ALLOWED_DIRS = [
  "server/domains/",
  "server/compliance/",
  "server/governance/",
  "server/beast/",
  "server/pdm/",
  "server/ml-routes/",
  "server/suppliers/",
  "server/purchasing/",
  "server/service-orders/",
  "server/import-adapters/",
  "server/modules/",
  "server/replit_integrations/",
  "server/routes/analytics/",
  "server/routes/equipment-context/",
];

const ROUTE_MOUNT_RE = /\bapp\.(get|post|put|patch|delete|use)\s*\(\s*["'`]\/api\//;

function walkDir(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full));
      } else if (
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts") &&
        !entry.name.endsWith(".test.ts")
      ) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

const serverDir = resolve(root, "server");
const tsFiles = walkDir(serverDir);

const violations = [];
for (const filePath of tsFiles) {
  const relPath = relative(root, filePath);

  if (ALLOWED_ROUTE_FILES.has(relPath)) continue;
  if (ALLOWED_DIRS.some((dir) => relPath.startsWith(dir))) continue;

  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
    if (ROUTE_MOUNT_RE.test(line)) {
      violations.push(`${relPath}:${i + 1}: ${line.trim().substring(0, 120)}`);
    }
  }
}

console.log("=== Route Registration Pattern ===");
if (violations.length > 0) {
  console.log(`${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.log(`  ✗ ${v}`);
  }
  console.log(
    "\nFix: Move route registration to a domain module or add to domain-router-registry.ts"
  );
  console.log("See server/routes/domain-router-registry.ts for the canonical pattern.");
  process.exit(1);
} else {
  console.log("All route registrations follow the domain router registry pattern.");
  process.exit(0);
}
