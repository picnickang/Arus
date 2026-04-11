#!/usr/bin/env node
/**
 * Schema Import Boundary Enforcement
 *
 * Ensures server-side code imports from shared/schema-runtime (the dual-mode switcher)
 * rather than directly from shared/schema/* or shared/sqlite-schema/*.
 *
 * Direct imports bypass the runtime mode switch and will use the wrong schema
 * in vessel (SQLite) or cloud (PG) mode.
 *
 * Allowed exceptions:
 *   - Files inside shared/ itself (schema definition files)
 *   - Explicit type-only imports (import type { ... })
 *   - Files in the allowlist below (e.g., migration scripts, test utilities)
 *
 * Run:  node scripts/check-schema-imports.mjs
 * Exit: 0 = pass, 1 = violation found
 */

import { readFileSync, readdirSync } from "fs";
import { dirname, resolve, relative, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const ALLOWED_FILES = new Set([
  "server/db-config.ts",
  "server/sqlite-init.ts",
  "server/storage/db-storage.ts",
  "server/domains/agent/infrastructure/external-data-cache.ts",
  "server/domains/agent/infrastructure/file-registry.ts",
  "server/domains/alerts/settings-routes.ts",
  "server/domains/crew/lifecycle/lifecycle-repository.ts",
  "server/domains/equipment/lifecycle/lifecycle-repository.ts",
  "server/domains/equipment/lifecycle/lifecycle-validation.ts",
  "server/domains/permissions/repository.ts",
  "server/domains/permissions/routes.ts",
  "server/domains/permissions/service.ts",
  "server/modules/fleet-registry/domain/types.ts",
  "server/pdm/adapters/pdm-postgres.repository.ts",
  "server/scripts/test/seedPdMCases.ts",
  "server/services/scheduler-notifications/index.ts",
  "server/services/scheduling-settings/service.ts",
  "server/telemetry/adapters/batch-ack.ts",
  "server/telemetry/adapters/equipment-heartbeat.ts",
  "server/telemetry/adapters/postgres-dlq.ts",
  "server/telemetry/adapters/raw-archive.ts",
  "server/telemetry/adapters/schema-registry.ts",
]);

const DIRECT_SCHEMA_RE = /from\s+['"]@shared\/schema\/|from\s+['"]@shared\/sqlite-schema\/|from\s+['"]\.\.\/.*shared\/schema\/[^"']+['"]|from\s+['"]\.\.\/.*shared\/sqlite-schema\/[^"']+['"]/;

function walkDir(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full));
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
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

  if (ALLOWED_FILES.has(relPath)) continue;

  const content = readFileSync(filePath, "utf8");
  const fileLines = content.split("\n");
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i];
    if (line.trimStart().startsWith("//")) continue;
    if (line.includes("import type")) continue;
    if (DIRECT_SCHEMA_RE.test(line)) {
      violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
    }
  }
}

console.log("=== Schema Import Boundary ===");
if (violations.length > 0) {
  console.log(`${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.log(`  ✗ ${v}`);
  }
  console.log("\nFix: Import from @shared/schema-runtime instead of @shared/schema/* or @shared/sqlite-schema/*");
  console.log("Direct schema imports bypass the dual-DB mode switch.");
  process.exit(1);
} else {
  console.log("No direct schema imports found in server code. All clear.");
  process.exit(0);
}
