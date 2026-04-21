#!/usr/bin/env node
/**
 * Type-Cast Burndown Guard
 *
 * Counts `as any` and `as unknown as` casts in TypeScript source (excluding
 * adapter boundaries where `any` is intentional) and enforces a monotonic
 * decrease against scripts/cast-burndown-baseline.json.
 *
 * Same pattern as check-ts-burndown.mjs and drift-burndown.json.
 *
 * Usage:
 *   node scripts/check-cast-burndown.mjs                  # check (CI mode)
 *   node scripts/check-cast-burndown.mjs --write-baseline # lock new floor
 *   node scripts/check-cast-burndown.mjs --report         # show top offending files
 *
 * Adapter-boundary directories are exempt — they handle raw external data
 * where `any` is the correct type. Keep this list in sync with eslint.config.js
 * (Stage 5 "True ingestion/adapter boundaries").
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const BASELINE_PATH = resolve("scripts/cast-burndown-baseline.json");
const ROOT = process.cwd();

const SCAN_DIRS = ["client/src", "server", "shared"];

// Adapter boundaries where `any` is intentional. Mirror eslint.config.js Stage 5.
const EXEMPT_PATH_FRAGMENTS = [
  "server/telemetry/",
  "server/sync/",
  "server/vessel-simulator/",
  "server/external-integrations/",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".cache",
  "coverage",
]);

const FILE_EXTS = [".ts", ".tsx"];

// Match `as any`, `as unknown as <T>`. Word-boundary on `any` so we don't catch `anyone`.
const CAST_RE = /\bas\s+any\b|\bas\s+unknown\s+as\s+/g;

function isExempt(relPath) {
  for (const frag of EXEMPT_PATH_FRAGMENTS) {
    if (relPath.includes(frag)) {return true;}
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
    if (SKIP_DIR_NAMES.has(name)) {continue;}
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

function countCasts() {
  const perFile = new Map();
  let total = 0;
  for (const scanDir of SCAN_DIRS) {
    const abs = resolve(ROOT, scanDir);
    if (!existsSync(abs)) {continue;}
    for (const file of walk(abs)) {
      const rel = relative(ROOT, file);
      if (isExempt(rel)) {continue;}
      let src;
      try {
        src = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      // Strip line comments and block comments so commented-out code doesn't count.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
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
  const top = [...perFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
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

  const { total, perFile } = countCasts();
  console.log(`Type-cast occurrences (\`as any\` + \`as unknown as\`): ${total}`);
  console.log(
    `Scanned: ${SCAN_DIRS.join(", ")} (excluding ${EXEMPT_PATH_FRAGMENTS.join(", ")})`,
  );

  if (showReport) {
    const summary = summarize(perFile);
    console.log("\nTop files:");
    for (const [f, n] of Object.entries(summary.byTopFiles)) {
      console.log(`  ${String(n).padStart(4)}  ${f}`);
    }
    console.log("\nTop top-level directories:");
    for (const [d, n] of Object.entries(summary.byTopDirs)) {
      console.log(`  ${String(n).padStart(4)}  ${d}`);
    }
  }

  if (writeBaseline) {
    const summary = summarize(perFile);
    const payload = {
      _comment:
        "Type-cast burndown baseline. Total must monotonically decrease. Regenerate with: node scripts/check-cast-burndown.mjs --write-baseline. Adapter boundaries (telemetry/sync/vessel-simulator/external-integrations) are exempt.",
      generatedAt: new Date().toISOString(),
      total,
      summary,
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
    console.log(`\n✓ Baseline written: ${relative(ROOT, BASELINE_PATH)} (total=${total})`);
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    console.warn(
      "\n⚠️  No baseline found. Run with --write-baseline to create one.",
    );
    return;
  }

  if (total > baseline.total) {
    const delta = total - baseline.total;
    console.error(
      `\n❌ Type-cast count INCREASED: ${baseline.total} → ${total} (+${delta})`,
    );
    console.error(
      "Each `as any` or `as unknown as` is a hole in the type system.",
    );
    console.error("Fix the regression — or, if intentional and unavoidable, update the baseline:");
    console.error("  node scripts/check-cast-burndown.mjs --write-baseline");
    process.exit(1);
  }

  if (total < baseline.total) {
    console.log(
      `\n✓ Reduction: ${baseline.total} → ${total} (-${baseline.total - total}). Consider regenerating the baseline.`,
    );
  } else {
    console.log("\n✓ Type-cast count at baseline.");
  }
}

main();
