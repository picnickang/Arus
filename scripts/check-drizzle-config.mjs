#!/usr/bin/env node
/**
 * Drizzle Config Coverage Enforcement
 *
 * Ensures drizzle.config.ts lists every table-defining module under
 * shared/schema/, and that every config entry exists on disk.
 *
 * Modules absent from the config are invisible to `drizzle-kit push`
 * (except via transitive re-exports, which is fragile — sso.ts and
 * scheduled-reports.ts were silently unbootstrappable this way), and
 * non-existent entries are silently skipped by drizzle-kit's glob
 * resolution, hiding typos.
 *
 * Run:  node scripts/check-drizzle-config.mjs
 * Exit: 0 = pass, 1 = violation found
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// drizzle.config.ts throws without DATABASE_URL, so string-parse it instead
// of importing it.
const configPath = resolve(root, "drizzle.config.ts");
const configSrc = readFileSync(configPath, "utf8");
const schemaArrayMatch = configSrc.match(/schema:\s*\[([\s\S]*?)\]/);
if (!schemaArrayMatch) {
  console.error("Could not find a `schema: [...]` array in drizzle.config.ts");
  process.exit(1);
}
const configEntries = [...schemaArrayMatch[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);

// A module defines tables iff it has a top-level `export const x = pgTable(`.
// (base.ts only mentions pgTable( inside a JSDoc example; index.ts and
// ml-analytics.ts are pure re-exporters.)
const TABLE_DEF_RE = /^export const \w+ = pgTable\(/m;

const schemaDir = resolve(root, "shared/schema");
const tableModules = readdirSync(schemaDir)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts"))
  .filter((name) => TABLE_DEF_RE.test(readFileSync(join(schemaDir, name), "utf8")))
  .map((name) => `./shared/schema/${name}`);

const errors = [];

for (const mod of tableModules) {
  if (!configEntries.includes(mod)) {
    errors.push(`missing from drizzle.config.ts: ${mod} (defines pgTable tables)`);
  }
}

for (const entry of configEntries) {
  if (!existsSync(resolve(root, entry))) {
    errors.push(`listed in drizzle.config.ts but not on disk: ${entry}`);
  }
}

console.log("=== Drizzle Config Coverage ===");
if (errors.length > 0) {
  console.log(`${errors.length} violation(s) found:\n`);
  for (const e of errors) {
    console.log(`  ✗ ${e}`);
  }
  console.log("\nFix: every shared/schema/*.ts module that defines tables must be listed in");
  console.log("drizzle.config.ts so `drizzle-kit push` can bootstrap it, and every config");
  console.log("entry must exist (non-existent entries are silently skipped).");
  process.exit(1);
} else {
  console.log(
    `All ${tableModules.length} table-defining schema modules are listed in drizzle.config.ts. All clear.`
  );
  process.exit(0);
}
