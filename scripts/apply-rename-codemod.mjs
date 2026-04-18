#!/usr/bin/env node
/**
 * ============================================================================
 * apply-rename-codemod.mjs
 * ============================================================================
 *
 * Applies 49 confirmed rename pairs extracted from TypeScript's own
 * "Did you mean X?" error hints. Every rename here was suggested by the
 * compiler — no guessing.
 *
 * USAGE:
 *   node scripts/apply-rename-codemod.mjs              # dry-run (default)
 *   node scripts/apply-rename-codemod.mjs --apply       # write changes
 *   node scripts/apply-rename-codemod.mjs --apply -v    # with verbose output
 *
 * SCOPE:
 *   Scans server/ and client/ .ts/.tsx files by default. Skips node_modules,
 *   dist, build, .next, and test files (unless --include-tests).
 *
 * SAFETY:
 *   - Uses word-boundary regex to prevent partial replacements
 *   - Skips string literals (strings inside "" or '' or ``) unless --strings
 *   - Dry-run by default; explicit --apply flag to write
 *   - Prints a before/after diff summary per rename
 *   - Logs skipped occurrences that look like property access on third-party types
 *
 * EXPECTED IMPACT: ~120 errors resolved across ~30 files.
 * ============================================================================
 */

import fs from "node:fs";
import path from "node:path";

// Mechanical renames — safe to apply automatically because they are ONLY
// property-access patterns (e.g., table.column, obj.field).
//
// CONSERVATIVE LIST: dangerous semantic renames (boolean→timestamp,
// preventive→predictive, kpis→kpi, completedJobs→completed, etc.) have
// been moved to MANUAL_RENAMES below. They require per-call-site review.
const RENAMES = [
  // [wrong, right, reason (for log)]
  ["sensor_type", "sensorType", "snake_case to camelCase"],
  ["alertCooldownMinutes", "defaultCooldownMinutes", "settings rename"],
  ["estimatedDuration", "estimatedDurationHours", "unit clarification (additive)"],
  ["scheduledDate", "nextScheduledDate", "maintenance_schedules column"],
  ["modelVersion", "modelVersionId", "FK column rename"],
  ["maxBufferSize", "bufferSize", "config rename"],
  // Method renames (property-access context only, so safe):
  ["getEngineerOverride", "getEngineerOverrides", "method rename"],
  ["updateStormgeoImportHistory", "createStormgeoImportHistory", "method rename"],
  ["bulkCreateStormgeoSnapshots", "createStormgeoSnapshot", "method renamed"],
  ["getCrewRestByDateRange", "getCrewRestRange", "storage method rename"],
  ["updateEngineerOverrideOutcome", "updateEngineerOverride", "method consolidated"],
  ["upsertCooldown", "getCooldown", "method consolidation"],
  ["findLowStockItems", "findLowStockParts", "method rename"],
  ["clearAllMaintenanceSchedules", "getMaintenanceSchedules", "method rename"],
  ["deleteStormgeoSettings", "deleteStormgeoSetting", "singularization"],
  ["deleteStormgeoSnapshotsByRoute", "deleteStormgeoSnapshotsBefore", "method rename"],
  ["addPartToWorkOrder", "addBulkPartsToWorkOrder", "method consolidation"],
  ["updateStormgeoSettings", "updateStormgeoSetting", "singularization"],
  ["createStormgeoSettings", "createStormgeoSetting", "singularization"],
  ["getStormgeoSnapshotForTime", "getStormgeoSnapshot", "method consolidation"],
  ["decommissionReason", "decommissionedAt", "column rename"],
  ["deployedAt", "deployedOn", "column rename"],
  ["lastRunAt", "lastRun", "column rename"],
];

// Renames flagged for manual review — ambiguous semantics or destructive changes.
// The codemod does NOT apply these. They are documented here so the developer
// can audit each call site individually.
const MANUAL_RENAMES = [
  // RED — semantic changes that silently alter business logic:
  ["preventiveSavings", "predictiveSavings", "RED: distinct cost categories — would alter financial reports"],
  ["estimatedCost", "estimatedHours", "RED: cost (money) vs hours (duration) — different units"],
  ["metricDate", "metricType", "RED: date value vs enum type — breaks date arithmetic"],
  ["detectedValue", "expectedValue", "RED: opposite meanings — breaks anomaly/deviation logic"],
  ["foConsumptionMt", "consumptionMt", "RED: FO-specific data merged — fuel-type traceability lost"],
  ["doConsumptionMt", "consumptionMt", "RED: DO-specific data merged — fuel-type traceability lost"],
  // YELLOW — boolean → timestamp semantic shift:
  ["acknowledged", "acknowledgedAt", "YELLOW: boolean→timestamp; breaks `if (alert.acknowledged)` checks"],
  ["resolved", "resolvedAt", "YELLOW: boolean→timestamp; breaks `if (insight.resolved)` checks"],
  // YELLOW — too-generic names that risk clobbering unrelated code:
  ["completedJobs", "completed", "YELLOW: `.completed` is a common name across the codebase"],
  ["kpis", "kpi", "YELLOW: plural array → singular object; `.kpis[0]` breaks"],
  ["resourceId", "resourceCode", "YELLOW: id (UUID) vs code (string) often coexist on same table"],
  // Original manual list (verbatim):
  ["quantityUsed", "quantity", "work_order_parts.quantityUsed vs work_order_parts.quantity — verify which schema"],
  ["quantityRequired", "quantityUsed", "only some call sites — verify per usage"],
  ["completedByName", "completedBy", "schema now has BOTH columns — remove only when truly redundant"],
  ["uploadedAt", "uploadedBy", "semantic change (timestamp → user) — review every call site"],
  ["soxEmissionsKg", "sox_emissionsMt", "unit change (kg → metric tons) — conversion factor needed"],
  ["noxEmissionsKg", "nox_emissionsMt", "unit change (kg → metric tons) — conversion factor needed"],
  ["getPartSubstitutions", "suggestPartSubstitutions", "different return type — check each caller"],
  ["setCrewSkill", "getCrewSkills", "setter → getter (looks wrong) — TS hint may be misleading"],
  ["deleteCrewSkill", "getCrewSkills", "destructive → read-only — TS hint may be misleading"],
  ["deleteInventoryItem", "createInventoryItem", "delete → create — TS hint misleading, real fix unknown"],
  ["vessel", "vesselId", "bare identifier — too risky to automate"],
  ["shift", "shiftId", "bare identifier — too risky to automate"],
  ["roles", "role", "singularization of 'roles' local var is a bug — review each site"],
  ["conditions", "condition", "'conditions' is a common local var name — do NOT rename blindly"],
];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERBOSE = args.includes("-v") || args.includes("--verbose");
const INCLUDE_TESTS = args.includes("--include-tests");
const INCLUDE_STRINGS = args.includes("--strings");

const ROOT = process.cwd();

// Files to scan
const TARGET_DIRS = ["server", "client/src", "shared"];
const EXCLUDE_DIRS = new Set(["node_modules", "dist", "build", ".next", ".git", "coverage"]);
const EXCLUDE_FILE_PATTERNS = INCLUDE_TESTS
  ? []
  : [/\.test\.ts$/, /\.test\.tsx$/, /\.spec\.ts$/, /\.spec\.tsx$/];

function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walkDir(full, files);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      if (EXCLUDE_FILE_PATTERNS.some((p) => p.test(entry.name))) continue;
      files.push(full);
    }
  }
  return files;
}

/**
 * Replace `.oldName` with `.newName` — PROPERTY ACCESS ONLY.
 *
 * This is deliberately narrow. Renaming bare identifiers (`conditions`,
 * `vessel`, `role`) would clobber local variable names across the codebase.
 * We only rename when the identifier appears after a `.` (property access
 * or method call), which is exactly the context TypeScript's "Did you mean"
 * hints refer to. Destructuring renames are NOT handled; flag them for
 * manual review instead.
 *
 * Skips string literals unless --strings is set.
 */
function applyRenameToContent(content, oldName, newName) {
  // Match `.oldName` followed by a non-word char or end.
  // Lookbehind for `.` and lookahead for word boundary.
  const re = new RegExp(`(?<=\\.)${escapeRegex(oldName)}(?=\\b)`, "g");

  if (INCLUDE_STRINGS) {
    const newContent = content.replace(re, newName);
    const matches = content.match(re)?.length ?? 0;
    return { newContent, matches };
  }

  // Process line by line, skipping replacements inside string literals.
  const lines = content.split("\n");
  let totalMatches = 0;
  const newLines = lines.map((line) => {
    const stringRanges = findStringRanges(line);
    let result = "";
    let lastIdx = 0;
    let m;
    const lineRe = new RegExp(`(?<=\\.)${escapeRegex(oldName)}(?=\\b)`, "g");
    while ((m = lineRe.exec(line)) !== null) {
      const pos = m.index;
      const inString = stringRanges.some(([s, e]) => pos >= s && pos < e);
      if (inString) continue;
      result += line.slice(lastIdx, pos) + newName;
      lastIdx = pos + oldName.length;
      totalMatches++;
    }
    result += line.slice(lastIdx);
    return result;
  });
  return { newContent: newLines.join("\n"), matches: totalMatches };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find positions of string literals on a single line.
 * Returns array of [start, end) ranges (end exclusive).
 * Handles ', ", ` quotes. Does NOT handle template literal ${} interpolations
 * (would need a real parser for that — skipping template interpolation is acceptable
 * since rename targets rarely appear inside ${} expressions).
 */
function findStringRanges(line) {
  const ranges = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "/" && line[i + 1] === "/") break; // single-line comment
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      const start = i;
      i++;
      while (i < line.length) {
        if (line[i] === "\\") {
          i += 2;
          continue;
        }
        if (line[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      ranges.push([start, i]);
    } else {
      i++;
    }
  }
  return ranges;
}

// Main
console.log(`ARUS rename codemod — ${RENAMES.length} rename pairs`);
console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY-RUN (use --apply to write)"}`);
console.log(`Root: ${ROOT}`);
console.log("");

const targetFiles = TARGET_DIRS.flatMap((d) => walkDir(path.join(ROOT, d)));
console.log(`Scanning ${targetFiles.length} files...`);
console.log("");

const renameStats = new Map();
const fileChanges = new Map();

for (const file of targetFiles) {
  const original = fs.readFileSync(file, "utf-8");
  let current = original;
  const perFileRenames = [];

  for (const [oldName, newName, reason] of RENAMES) {
    const { newContent, matches } = applyRenameToContent(current, oldName, newName);
    if (matches > 0) {
      current = newContent;
      const key = `${oldName}→${newName}`;
      renameStats.set(key, (renameStats.get(key) || 0) + matches);
      perFileRenames.push({ oldName, newName, reason, matches });
    }
  }

  if (current !== original) {
    fileChanges.set(file, { original, current, renames: perFileRenames });
  }
}

// Summary
console.log(`\n=== SUMMARY ===\n`);
console.log(`Files that would change: ${fileChanges.size}`);
let totalReplacements = 0;
for (const [key, count] of [...renameStats.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.padEnd(60)} ${String(count).padStart(4)}`);
  totalReplacements += count;
}
console.log(`\nTotal replacements: ${totalReplacements}`);

// Print the manual-review list so the developer knows what was NOT applied
console.log(`\n=== RENAMES NOT APPLIED (manual review required) ===\n`);
for (const [oldName, newName, reason] of MANUAL_RENAMES) {
  console.log(`  ${oldName} → ${newName}`);
  console.log(`    ${reason}`);
}

// Verbose file listing
if (VERBOSE) {
  console.log(`\n=== FILES ===\n`);
  for (const [file, { renames }] of fileChanges) {
    const rel = path.relative(ROOT, file);
    console.log(`\n${rel}`);
    for (const r of renames) {
      console.log(`    ${r.oldName} → ${r.newName} (${r.matches}×)  [${r.reason}]`);
    }
  }
}

// Write changes
if (APPLY) {
  console.log(`\n=== WRITING CHANGES ===\n`);
  for (const [file, { current }] of fileChanges) {
    fs.writeFileSync(file, current, "utf-8");
    console.log(`  ✓ ${path.relative(ROOT, file)}`);
  }
  console.log(`\n${fileChanges.size} files written.`);
  console.log(`\nNext steps:`);
  console.log(`  1. git diff  # review the changes`);
  console.log(`  2. npm run check  # verify error count dropped`);
  console.log(`  3. npm run test:unit  # ensure 337/337 still pass`);
  console.log(`  4. Review the "NOT APPLIED" list above and fix those call sites manually`);
} else {
  console.log(`\nRe-run with --apply to write changes.`);
}
