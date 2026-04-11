#!/usr/bin/env node
/**
 * Storage Facade Import Boundary Enforcement
 *
 * Ensures no new code imports from server/storage.ts (the frozen facade).
 * Allowed exceptions are explicitly listed below.
 *
 * Run:  node scripts/check-storage-imports.mjs
 * Exit: 0 = pass, 1 = violation found
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, resolve, relative, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const ALLOWED = new Set([
  "server/storage.ts",
  "server/storage/index.ts",
  "server/bootstrap/services.ts",
  "server/compliance/routes/data-privacy-routes.ts",
  "server/routes/pdm-gap-fill-routes.ts",
  "server/inventory/auto-optimization.ts",
  "server/vessel-simulator/simulator.ts",
  "server/vessel-simulator/instances.ts",
  "server/vessel-simulator/stress-test.ts",
  "server/vessel-simulator/fleet-stress-test.ts",
]);

const STORAGE_IMPORT_RE = /from\s+['"](?:\.\.\/)+storage['"]/;

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

  if (relPath.includes("storage/")) continue;
  if (ALLOWED.has(relPath)) continue;

  const content = readFileSync(filePath, "utf8");
  const fileLines = content.split("\n");
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i];
    if (STORAGE_IMPORT_RE.test(line) && !line.trimStart().startsWith("//") && !line.includes("import type")) {
      violations.push(`${relPath}:${i + 1}: ${line.trim()}`);
    }
  }
}

console.log("=== Storage Import Boundary ===");
if (violations.length > 0) {
  console.log(`${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.log(`  ✗ ${v}`);
  }
  console.log("\nFix: Import from server/repositories.ts instead of server/storage.ts");
  console.log("See server/storage.ts header for migration guide.");
  process.exit(1);
} else {
  console.log("All storage facade imports are within the allowed exception list.");
  process.exit(0);
}
