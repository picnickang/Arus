#!/usr/bin/env node
/**
 * Hexagonal Storage Boundary Enforcement
 * =====================================
 *
 * Rule:
 *   In hexagonal architecture, only the *infrastructure* layer is allowed
 *   to know about the database. The domain, application, and interfaces
 *   layers must depend on ports/repositories — never on `server/db/...` or
 *   `server/db-config` directly.
 *
 * Allowed importers of `server/db/...` and `server/db-config`:
 *   - server/db/**                (the implementations themselves)
 *   - server/storage/**           (canonical storage adapters)
 *   - server/repositories.ts      (canonical repository surface)
 *   - server/domains/<name>/infrastructure/**
 *   - explicit allowlist in `scripts/hex-storage-baseline.json` (burn-down)
 *
 * Disallowed importers (will fail CI once the baseline is empty):
 *   - server/domains/<name>/application/**
 *   - server/domains/<name>/domain/**
 *   - server/domains/<name>/interfaces/**
 *   - server/services/**
 *   - server/routes/**            (registry exempt)
 *
 * Burn-down workflow:
 *   1. Run this script. New violations beyond the baseline fail the build.
 *   2. To reduce the baseline, refactor the offending file to depend on a
 *      repository/port, then remove its entry from
 *      `scripts/hex-storage-baseline.json`.
 *   3. Never add to the baseline without team agreement.
 *
 * Run:   node scripts/check-hex-storage-boundaries.mjs
 * Exit:  0 = pass (no new violations beyond baseline), 1 = new violation found
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { dirname, resolve, relative, join, sep } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const baselinePath = resolve(__dirname, "hex-storage-baseline.json");

const DB_IMPORT_RE =
  /from\s+['"](?:\.\.\/)+(db(?:\/[^'"]*)?|db-config)['"]/;
const DB_DYNAMIC_IMPORT_RE =
  /await\s+import\s*\(\s*['"](?:\.\.\/)+(db(?:\/[^'"]*)?|db-config)['"]\s*\)/;

function walkDir(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      results.push(full);
    }
  }
  return results;
}

/** Returns true if this file is allowed to import db/* directly. */
function isAllowedImporter(relPath) {
  // Normalize separators for cross-platform
  const p = relPath.split(sep).join("/");

  // Implementations themselves
  if (p.startsWith("server/db/")) return true;
  // Canonical storage adapters
  if (p.startsWith("server/storage/")) return true;
  // Canonical repository surface
  if (p === "server/repositories.ts") return true;
  // Hexagonal infrastructure layer for any domain — at any nesting depth,
  // so sub-domains (e.g. domains/pdm-platform/decision-support/infrastructure/)
  // are recognised as infrastructure, not flagged as leaks.
  if (/^server\/domains\/.+\/infrastructure\//.test(p)) return true;
  // Domain router registry is the integration seam, not domain code
  if (p === "server/routes/domain-router-registry.ts") return true;
  // Boot middleware sometimes touches db-config to wire connections
  if (p.startsWith("server/bootstrap/")) return true;

  return false;
}

const serverDir = resolve(root, "server");
const tsFiles = walkDir(serverDir);

const violations = [];
for (const filePath of tsFiles) {
  const relPath = relative(root, filePath).split(sep).join("/");
  if (isAllowedImporter(relPath)) continue;

  const content = readFileSync(filePath, "utf8");
  const fileLines = content.split("\n");
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    if (DB_IMPORT_RE.test(line) || DB_DYNAMIC_IMPORT_RE.test(line)) {
      violations.push(relPath);
      break; // one entry per file is enough for the baseline
    }
  }
}

const baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : { generatedAt: null, count: 0, files: [] };

const baselineSet = new Set(baseline.files);
const violationSet = new Set(violations);

const newViolations = violations.filter((v) => !baselineSet.has(v));
const resolved = baseline.files.filter((v) => !violationSet.has(v));

console.log("=== Hexagonal Storage Boundary ===");
console.log(`Baseline:        ${baseline.files.length} file(s) allowed (burn-down)`);
console.log(`Current:         ${violations.length} file(s) importing db/ directly`);
console.log(`New violations:  ${newViolations.length}`);
console.log(`Resolved:        ${resolved.length}`);

if (resolved.length > 0) {
  console.log("\nThe following files were on the baseline but no longer leak — please remove from baseline:");
  for (const r of resolved) console.log(`  - ${r}`);
}

if (newViolations.length > 0) {
  console.log("\nNew hexagonal boundary violations (not on baseline):");
  for (const v of newViolations) console.log(`  X ${v}`);
  console.log(
    "\nFix: depend on a repository/port from server/repositories.ts, " +
      "or move db access into the domain's infrastructure/ folder."
  );
  process.exit(1);
}

if (violations.length === 0) {
  console.log("\nAll clear — no domain/application/interfaces code imports the database directly.");
}

process.exit(0);
