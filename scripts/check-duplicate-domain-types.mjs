#!/usr/bin/env node
/**
 * check-duplicate-domain-types.mjs
 *
 * Foundation guard for the type-debt burndown (task #163).
 *
 * Scans `shared/`, `server/`, `client/src/` for `export type X` / `export
 * interface X` declarations and counts how many distinct source files
 * declare each name. Two modes of enforcement:
 *
 *   1. HARD-GATED allowlist (HARD_GATE) — each name in this list MUST
 *      have exactly one definition repo-wide. These are the top-priority
 *      canonicals identified in the plan (Vessel, TelemetryReading, etc).
 *      Failing one of these means a downstream contract is fractured.
 *
 *   2. BASELINE-TRACKED ratchet — every other duplicated name is
 *      recorded in scripts/duplicate-types-baseline.json. The count for
 *      each name MUST be <= the baseline value. New duplicates fail CI;
 *      removed duplicates can be baselined down with --update.
 *
 * Usage:
 *   node scripts/check-duplicate-domain-types.mjs           # check
 *   node scripts/check-duplicate-domain-types.mjs --update  # write baseline
 *   node scripts/check-duplicate-domain-types.mjs --json    # JSON report
 *
 * Exit codes:
 *   0  OK
 *   1  hard-gate violation or baseline regression
 *   2  script/IO error
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(__dirname, "duplicate-types-baseline.json");
const SCAN_DIRS = ["shared", "server", "client/src"];

// Top-priority canonicals — each TARGETS exactly one definition. These
// are tracked through the same monotonic-decrease baseline as the other
// duplicates so the script can pass while the burndown chain
// (#164 → #167) drives them to 1. The HARD_GATE_TARGET annotation in
// the baseline file records the goal so reviewers can see at a glance
// which entries are not yet collapsed.
const HARD_GATE_TARGETS = new Set([
  "Vessel",
  "Equipment",
  "TelemetryReading",
  "CrewMember",
  "Crew",
  "WorkOrder",
  "WorkOrderTask",
  "WorkOrderPart",
]);

const EXPORT_RE = /^export\s+(?:type|interface)\s+([A-Z][A-Za-z0-9_]+)\b/gm;

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

function collect() {
  const map = new Map(); // name -> Set<relPath>
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      let body;
      try {
        body = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      EXPORT_RE.lastIndex = 0;
      let m;
      while ((m = EXPORT_RE.exec(body)) !== null) {
        const name = m[1];
        const rel = path.relative(ROOT, file).replace(/\\/g, "/");
        if (!map.has(name)) map.set(name, new Set());
        map.get(name).add(rel);
      }
    }
  }
  return map;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const update = args.has("--update");
  const wantJson = args.has("--json");
  const map = collect();

  // Build duplicates report: { name -> [files...] } for count >= 2.
  const duplicates = {};
  for (const [name, files] of map) {
    if (files.size >= 2) {
      duplicates[name] = Array.from(files).sort();
    }
  }

  // Baseline-tracked ratchet (includes hard-gate-target names; their
  // current count is recorded and may only decrease).
  let baseline = {};
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    } catch (err) {
      console.error(`[check-dup-types] failed to parse baseline: ${err.message}`);
      process.exit(2);
    }
  }

  const baselineCounts = baseline.counts ?? {};
  const trackedNow = {};
  for (const [name, files] of Object.entries(duplicates)) {
    trackedNow[name] = files.length;
  }

  // Hard-gate enforcement: each canonical name MUST resolve to exactly
  // one definition. This is non-negotiable and not subject to the
  // ratchet — single-source is the entire point.
  const hardGateViolations = [];
  for (const name of HARD_GATE_TARGETS) {
    const count = map.get(name)?.size ?? 0;
    if (count !== 1) {
      hardGateViolations.push({
        name,
        count,
        files: Array.from(map.get(name) ?? []).sort(),
      });
    }
  }

  const ratchetRegressions = [];
  for (const [name, count] of Object.entries(trackedNow)) {
    const allowed = baselineCounts[name] ?? 1; // new name = treat as freshly introduced
    if (count > allowed) {
      ratchetRegressions.push({
        name,
        baseline: allowed,
        current: count,
        files: duplicates[name],
      });
    }
  }
  // Names in baseline that disappeared or shrank are fine; --update will
  // refresh the file.

  if (update) {
    const targets = {};
    for (const name of HARD_GATE_TARGETS) targets[name] = 1;
    const next = {
      $note:
        "Monotonic-decrease ratchet for duplicate exported type names. Counts may only decrease unless --update is run. The HARD_GATE_TARGETS list in scripts/check-duplicate-domain-types.mjs (mirrored here as `hardGateTargets`) records the canonical names whose count MUST reach 1 by the end of the type-debt burndown (tasks #163–#167).",
      generatedAt: new Date().toISOString(),
      hardGateTargets: targets,
      counts: Object.fromEntries(Object.entries(trackedNow).sort(([a], [b]) => a.localeCompare(b))),
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
    console.log(
      `[check-dup-types] baseline updated: ${Object.keys(next.counts).length} tracked entries (${hardGateViolations.length} hard-gate violations)`
    );
    if (hardGateViolations.length) {
      console.error(
        `[check-dup-types] WARNING: --update wrote a baseline while ${hardGateViolations.length} hard-gate canonical(s) still have count != 1. The next non-update run will fail.`
      );
    }
    return;
  }

  if (wantJson) {
    console.log(
      JSON.stringify(
        {
          ratchetRegressions,
          hardGateViolations,
          duplicateCount: Object.keys(duplicates).length,
        },
        null,
        2
      )
    );
  }

  let failed = false;

  if (hardGateViolations.length) {
    failed = true;
    console.error("");
    console.error(
      "HARD-GATE FAILURE: each canonical domain entity MUST resolve to exactly one definition."
    );
    for (const v of hardGateViolations) {
      console.error(`  ${v.name} (${v.count} definitions):`);
      for (const f of v.files) console.error(`    - ${f}`);
    }
    console.error("");
    console.error(
      'Designate a single canonical (drizzle $inferSelect in shared/schema/* preferred) and convert every other declaration to a rename (`export interface XListItem { … }`) or a re-export (`export { type SelectX as X } from "@shared/schema"`). The re-export form is not matched by the duplicate-types regex.'
    );
  }

  if (ratchetRegressions.length) {
    failed = true;
    console.error("");
    console.error(
      "RATCHET REGRESSION: duplicate-type count exceeds baseline for the following names."
    );
    for (const r of ratchetRegressions) {
      console.error(`  ${r.name}: baseline=${r.baseline}, current=${r.current}`);
      for (const f of r.files) console.error(`    - ${f}`);
    }
    console.error("");
    console.error(
      "Either consolidate (preferred) or, if you legitimately removed duplicates elsewhere, run with --update to refresh the baseline downward."
    );
  }

  if (failed) process.exit(1);

  if (!wantJson) {
    const tracked = Object.keys(trackedNow).length;
    const targets = HARD_GATE_TARGETS.size;
    console.log(
      `[check-dup-types] OK — ${targets}/${targets} hard-gate canonicals at exactly 1 definition; ${tracked} tracked duplicates within baseline.`
    );
  }
}

try {
  main();
} catch (err) {
  console.error("[check-dup-types] error:", err);
  process.exit(2);
}
