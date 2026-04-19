#!/usr/bin/env node
/**
 * check-route-imports.mjs
 *
 * Smoke-imports every domain route module to catch unresolved/broken imports
 * BEFORE they manifest as silent boot-time registration failures.
 *
 * Why this exists: domain-router-registry catches import errors per-domain so
 * the app can keep booting if one route file has a broken import. That's good
 * for resilience but bad for visibility — broken imports hide until runtime.
 * This script forces every route module to import successfully.
 *
 * Each "wave" of dynamic-import hoisting that fails to add this check has
 * historically surfaced 3-7 broken paths previously hidden by lazy/dynamic
 * loading. Run this in CI to fail fast.
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(process.cwd());
const DOMAINS_DIR = join(ROOT, "server", "domains");

/** Recursively find every routes.ts under server/domains/ */
function findRouteFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...findRouteFiles(full));
    } else if (entry === "routes.ts" || entry.endsWith("-routes.ts")) {
      out.push(full);
    }
  }
  return out;
}

const files = findRouteFiles(DOMAINS_DIR);
const failures = [];

console.log(`=== Route Import Smoke Check ===`);
console.log(`Scanning ${files.length} route module(s)...\n`);

for (const file of files) {
  const rel = relative(ROOT, file);
  try {
    await import(pathToFileURL(file).href);
  } catch (err) {
    failures.push({ file: rel, error: err.message.split("\n")[0] });
  }
}

if (failures.length === 0) {
  console.log(`✓ All ${files.length} route modules import cleanly.`);
  process.exit(0);
}

console.error(`❌ ${failures.length} route module(s) failed to import:\n`);
for (const { file, error } of failures) {
  console.error(`  • ${file}`);
  console.error(`    → ${error}\n`);
}
console.error(`Each failure means the route file references a module that does`);
console.error(`not exist or does not export the expected symbols. The app may`);
console.error(`still boot (registration is wrapped in try/catch) but those`);
console.error(`endpoints will return 404. Fix the imports.`);
process.exit(1);
