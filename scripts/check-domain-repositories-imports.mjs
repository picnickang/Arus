#!/usr/bin/env node
/**
 * Domain Repositories Import Boundary Enforcement
 * ==============================================
 *
 * Rule:
 *   In hexagonal architecture, the domain, application, and interfaces
 *   layers must depend on ports (interfaces) — never on the concrete
 *   `server/repositories.ts` barrel. Importing repositories directly from
 *   those layers bypasses dependency injection, hides coupling, and makes
 *   the domain untestable without the database.
 *
 *   The existing `check:hex-storage-boundaries` guard already bans direct
 *   `server/db/*` imports from those layers. This guard closes the second
 *   half of that loophole by also banning the `server/repositories` barrel.
 *
 * Allowed importers of `server/repositories`:
 *   - server/repositories.ts          (the barrel itself)
 *   - server/storage/**               (canonical storage adapters)
 *   - server/composition/**           (DI wiring is the whole point)
 *   - server/bootstrap/**             (boot wiring)
 *   - server/routes/**                (legacy route registration seam)
 *   - server/domains/<name>/infrastructure/**  (adapters bridging ports
 *                                              to repositories)
 *   - server/index.ts, server/app.ts  (composition root)
 *   - explicit allowlist in scripts/domain-repositories-baseline.json
 *     (burn-down)
 *
 * Disallowed importers (will fail CI once the baseline is empty):
 *   - server/domains/<name>/domain/**
 *   - server/domains/<name>/application/**
 *   - server/domains/<name>/interfaces/**
 *
 * Burn-down workflow:
 *   1. Run this script. New violations beyond the baseline fail the build.
 *   2. To reduce the baseline, refactor the offending file to declare a
 *      port and accept the repository via constructor/factory injection,
 *      then remove its entry from
 *      `scripts/domain-repositories-baseline.json`.
 *   3. Never add to the baseline without team agreement.
 *
 * Regenerate baseline (manual, after intentional changes):
 *   node scripts/check-domain-repositories-imports.mjs --write-baseline
 *
 * Run:   node scripts/check-domain-repositories-imports.mjs
 * Exit:  0 = pass (no new violations beyond baseline), 1 = new violation found
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs";
import { dirname, resolve, relative, join, sep } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const baselinePath = resolve(__dirname, "domain-repositories-baseline.json");
const writeBaseline = process.argv.includes("--write-baseline");

const REPO_STATIC_RE =
  /from\s+['"](?:\.\.\/)+repositories(?:\.js)?['"]/;
const REPO_DYNAMIC_RE =
  /await\s+import\s*\(\s*['"](?:\.\.\/)+repositories(?:\.js)?['"]\s*\)/;

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

/**
 * Returns true if this file's PATH places it on the wrong side of the
 * boundary — i.e., it is domain/application/interfaces code inside a
 * server/domains/<name>/ folder.
 *
 * Anything outside that pattern (storage, composition, bootstrap, routes,
 * infrastructure, etc.) is allowed to import repositories.ts.
 */
function isGuardedLayer(relPath) {
  const p = relPath.split(sep).join("/");
  const match = p.match(/^server\/domains\/[^/]+\/(domain|application|interfaces)\//);
  return match !== null;
}

const serverDir = resolve(root, "server");
const tsFiles = walkDir(serverDir);

const violations = [];
for (const filePath of tsFiles) {
  const relPath = relative(root, filePath).split(sep).join("/");
  if (!isGuardedLayer(relPath)) continue;

  const content = readFileSync(filePath, "utf8");
  const fileLines = content.split("\n");
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    if (REPO_STATIC_RE.test(line) || REPO_DYNAMIC_RE.test(line)) {
      violations.push(relPath);
      break; // one entry per file is enough for the baseline
    }
  }
}

violations.sort();

if (writeBaseline) {
  const payload = {
    _comment:
      "Domain repositories import baseline. Counts must monotonically decrease. " +
      "Regenerate with: node scripts/check-domain-repositories-imports.mjs --write-baseline",
    generatedAt: new Date().toISOString(),
    count: violations.length,
    files: violations,
  };
  writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote baseline with ${violations.length} file(s) to scripts/domain-repositories-baseline.json`);
  process.exit(0);
}

const baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : { generatedAt: null, count: 0, files: [] };

const baselineSet = new Set(baseline.files);
const violationSet = new Set(violations);

const newViolations = violations.filter((v) => !baselineSet.has(v));
const resolved = baseline.files.filter((v) => !violationSet.has(v));

console.log("=== Domain Repositories Import Boundary ===");
console.log(`Baseline:        ${baseline.files.length} file(s) allowed (burn-down)`);
console.log(`Current:         ${violations.length} file(s) importing repositories directly from domain/application/interfaces`);
console.log(`New violations:  ${newViolations.length}`);
console.log(`Resolved:        ${resolved.length}`);

if (resolved.length > 0) {
  console.log("\nThe following files were on the baseline but no longer leak — please remove from baseline:");
  for (const r of resolved) console.log(`  - ${r}`);
}

if (newViolations.length > 0) {
  console.log("\nNew domain/application/interfaces files importing server/repositories directly:");
  for (const v of newViolations) console.log(`  X ${v}`);
  console.log(
    "\nFix: declare a port (interface) in the domain layer, accept the " +
      "repository via constructor/factory injection from a composition/wiring " +
      "file, or move repository access into the domain's infrastructure/ folder."
  );
  process.exit(1);
}

if (violations.length === 0) {
  console.log("\nAll clear — no domain/application/interfaces code imports server/repositories directly.");
}

process.exit(0);
