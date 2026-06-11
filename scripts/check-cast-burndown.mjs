#!/usr/bin/env node
/**
 * Type-Cast Burndown Guard
 *
 * Counts `as any` and `as unknown as` casts in TypeScript source and enforces
 * a monotonic decrease against scripts/cast-burndown-baseline.json.
 *
 * Same pattern as check-ts-burndown.mjs and drift-burndown.json.
 *
 * Usage:
 *   node scripts/check-cast-burndown.mjs                  # check (CI mode)
 *   node scripts/check-cast-burndown.mjs --write-baseline # lock new floor
 *   node scripts/check-cast-burndown.mjs --report         # show top offending files
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const BASELINE_PATH = resolve("scripts/cast-burndown-baseline.json");
const ROOT = process.cwd();

const SCAN_DIRS = ["client/src", "server", "shared"];

// Test trees outside the production scan dirs (root tests/ and client/tests/).
// Tracked as a separate monotonic total so test-code casts ratchet down
// without being able to trade against the production count.
const TEST_SCAN_DIRS = ["tests", "client/tests"];

// Adapter boundaries may be exempted here when `any` is genuinely required for
// raw external data. The original four exemptions (server/telemetry/, server/sync/,
// server/vessel-simulator/, server/external-integrations/) reached zero casts and
// were removed; re-adding a path requires a justification comment.
const EXEMPT_PATH_FRAGMENTS = [];

const SKIP_DIR_NAMES = new Set(["node_modules", "dist", "build", ".git", ".cache", "coverage"]);

const FILE_EXTS = [".ts", ".tsx"];

// Match `as any`, `as unknown as <T>`. Word-boundary on `any` so we don't catch `anyone`.
const CAST_RE = /\bas\s+any\b|\bas\s+unknown\s+as\s+/g;

function isExempt(relPath) {
  for (const frag of EXEMPT_PATH_FRAGMENTS) {
    if (relPath.includes(frag)) {
      return true;
    }
  }
  return false;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIR_NAMES.has(name)) {
      continue;
    }
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (FILE_EXTS.some((ext) => name.endsWith(ext))) {
      yield full;
    }
  }
}

function countCasts(scanDirs) {
  const perFile = new Map();
  let total = 0;
  for (const scanDir of scanDirs) {
    const abs = resolve(ROOT, scanDir);
    if (!existsSync(abs)) {
      continue;
    }
    for (const file of walk(abs)) {
      const rel = relative(ROOT, file);
      if (isExempt(rel)) {
        continue;
      }
      let src;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      // Strip line comments and block comments so commented-out code doesn't count.
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      const matches = stripped.match(CAST_RE);
      if (matches && matches.length > 0) {
        perFile.set(rel, matches.length);
        total += matches.length;
      }
    }
  }
  return { total, perFile };
}

function summarize(perFile) {
  const top = [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const byDir = new Map();
  for (const [file, n] of perFile) {
    const dir = file.split("/").slice(0, 2).join("/");
    byDir.set(dir, (byDir.get(dir) || 0) + n);
  }
  const topDirs = [...byDir.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return {
    byTopFiles: Object.fromEntries(top),
    byTopDirs: Object.fromEntries(topDirs),
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const writeBaseline = args.has("--write-baseline");
  const showReport = args.has("--report");

  const { total, perFile } = countCasts(SCAN_DIRS);
  const { total: testsTotal, perFile: testsPerFile } = countCasts(TEST_SCAN_DIRS);
  console.log(`Type-cast occurrences (\`as any\` + \`as unknown as\`): ${total}`);
  console.log(`Test-tree type-cast occurrences: ${testsTotal}`);
  const exemptNote = EXEMPT_PATH_FRAGMENTS.length
    ? ` (excluding ${EXEMPT_PATH_FRAGMENTS.join(", ")})`
    : "";
  console.log(
    `Scanned: ${SCAN_DIRS.join(", ")}${exemptNote}; test trees: ${TEST_SCAN_DIRS.join(", ")}`
  );

  if (showReport) {
    for (const [label, files] of [
      ["", perFile],
      [" (test trees)", testsPerFile],
    ]) {
      const summary = summarize(files);
      console.log(`\nTop files${label}:`);
      for (const [f, n] of Object.entries(summary.byTopFiles)) {
        console.log(`  ${String(n).padStart(4)}  ${f}`);
      }
      console.log(`\nTop top-level directories${label}:`);
      for (const [d, n] of Object.entries(summary.byTopDirs)) {
        console.log(`  ${String(n).padStart(4)}  ${d}`);
      }
    }
  }

  if (writeBaseline) {
    const summary = summarize(perFile);
    const payload = {
      _comment:
        "Type-cast burndown baseline. `total` (production scan dirs) and `testsTotal` (root tests/ + client/tests/) must each monotonically decrease — one may not be traded against the other. Regenerate with: node scripts/check-cast-burndown.mjs --write-baseline. No directories are exempt (the former adapter-boundary exemptions reached zero and were removed).",
      generatedAt: new Date().toISOString(),
      total,
      testsTotal,
      summary,
      testsSummary: summarize(testsPerFile),
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
    console.log(
      `\n✓ Baseline written: ${relative(ROOT, BASELINE_PATH)} (total=${total}, testsTotal=${testsTotal})`
    );
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.warn("\n⚠️  No baseline found. Run with --write-baseline to create one.");
    return;
  }

  let failed = false;
  for (const [label, current, base] of [
    ["Type-cast count", total, baseline.total],
    // Older baselines predate the test-tree scan; skip until regenerated.
    ["Test-tree type-cast count", testsTotal, baseline.testsTotal],
  ]) {
    if (base === undefined) continue;
    if (current > base) {
      console.error(`\n❌ ${label} INCREASED: ${base} → ${current} (+${current - base})`);
      failed = true;
    } else if (current < base) {
      console.log(
        `\n✓ ${label} reduction: ${base} → ${current} (-${base - current}). Consider regenerating the baseline.`
      );
    } else {
      console.log(`\n✓ ${label} at baseline.`);
    }
  }
  if (failed) {
    console.error("Each `as any` or `as unknown as` is a hole in the type system.");
    console.error("Fix the regression — or, if intentional and unavoidable, update the baseline:");
    console.error("  node scripts/check-cast-burndown.mjs --write-baseline");
    process.exit(1);
  }
}

main();
