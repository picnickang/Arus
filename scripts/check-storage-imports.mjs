#!/usr/bin/env node
/**
 * Storage Facade Import Boundary Enforcement
 *
 * Ensures no code imports from server/storage.ts (the retired facade).
 * All consumers must import from server/repositories.ts instead.
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
]);

const STORAGE_STATIC_RE = /from\s+['"](?:\.\.\/)+storage(?:\.js)?['"]/;
const STORAGE_DYNAMIC_RE = /await\s+import\s*\(\s*['"](?:\.\.\/)+storage(?:\.js)?['"]\s*\)/;

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
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
    if (STORAGE_STATIC_RE.test(line) || STORAGE_DYNAMIC_RE.test(line)) {
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
  process.exit(1);
} else {
  console.log("All storage facade imports eliminated. Only server/storage.ts re-export stub remains.");
  process.exit(0);
}
