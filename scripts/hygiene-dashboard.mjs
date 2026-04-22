#!/usr/bin/env node
/**
 * ARUS Hygiene Dashboard
 *
 * Counts code-quality anti-patterns across the codebase and tracks them
 * against a baseline. Complementary to TS error tracking — measures the
 * things the type system doesn't catch.
 *
 * Usage:
 *   node scripts/hygiene-dashboard.mjs              # Show current vs baseline
 *   node scripts/hygiene-dashboard.mjs --baseline   # Write new baseline
 *   node scripts/hygiene-dashboard.mjs --json       # JSON output for CI
 *   node scripts/hygiene-dashboard.mjs --strict     # Exit 1 if any metric got worse
 *
 * Exit codes:
 *   0 — all metrics stable or improved
 *   1 — at least one metric got worse (in --strict mode only)
 *   2 — script error
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASELINE_PATH = resolve(__dirname, "hygiene-baseline.json");

// ============================================================================
// Configuration — what we measure and where we look
// ============================================================================

const SEARCH_PATHS = "server client shared";

/**
 * Each metric: { name, pattern, exclude, description }
 *
 * `pattern` is a grep -E regex. Use conservative patterns — we prefer
 * false-negatives (undercount) to false-positives (overcount). An
 * overcounted metric that drops to zero after a refactor is a worse
 * signal than an undercounted one that stays stable.
 */
const METRICS = [
  // NOTE: `as any` / `as unknown as` tracking lives in scripts/check-cast-burndown.mjs.
  // That script enforces a CI ratchet with adapter-boundary exemptions matching
  // eslint Stage 5. Do not re-add an `as-any-casts` metric here — it would
  // double-count and confuse the burndown story.
  {
    name: "catch-underscore",
    pattern: "catch\\s*\\(\\s*_",
    exclude: null,
    description: "`catch (_error)` blocks that silently discard error context",
  },
  {
    name: "console-log",
    pattern: "console\\.(log|debug)\\b",
    exclude: null,
    // Scope to client/src + shared only. Server-side `console.log` is
    // explicitly allowed by ESLint Stage 3 config (operational logging),
    // so counting it here was noise. Client and shared are where
    // `console.log` is genuinely banned and the metric is actionable.
    paths: "client/src shared",
    description: "console.log/debug calls in client/src + shared (server allows them)",
  },
  {
    name: "ts-ignore",
    pattern: "@ts-ignore",
    exclude: null,
    description: "@ts-ignore directives (prefer @ts-expect-error)",
  },
  {
    name: "ts-expect-error",
    pattern: "@ts-expect-error",
    exclude: null,
    description:
      "@ts-expect-error directives (better than @ts-ignore — tracks when the ignored error resolves)",
    goodIsHigher: true, // More @ts-expect-error vs @ts-ignore is an improvement
  },
  {
    name: "todo-markers",
    pattern: "(TODO|FIXME|XXX|HACK)",
    exclude: null,
    description: "TODO/FIXME/XXX/HACK markers (keep linked to tracked issues)",
  },
  {
    name: "dense-oneliners",
    // Function body starting with control keyword, 80+ chars, and closing brace — all on same line
    pattern: "\\{\\s*(const|let|var|return|await|if|for|throw|try)[^{}]{80,}\\}",
    exclude: null,
    description: "Dense single-line function bodies (hurts readability, hides bugs)",
  },
  {
    name: "long-files",
    // Files over 500 lines counted separately — see scanLongFiles() below
    isLongFile: true,
    description: "Source files over 500 lines (refactor opportunistically)",
  },
];

// ============================================================================
// Measurement
// ============================================================================

function run(cmd) {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    // grep exits 1 when no matches — treat as empty result
    if (err.status === 1 && err.stdout !== undefined) return err.stdout;
    return "";
  }
}

function countMatches(metric) {
  if (metric.isLongFile) return scanLongFiles();

  // Build grep command. We use -c to count matching lines per file, then sum.
  const include = `--include="*.ts" --include="*.tsx"`;
  const excludeClause = metric.exclude ? ` | grep -v -E "${metric.exclude}"` : "";
  const paths = metric.paths || SEARCH_PATHS;

  const cmd = `grep -rnE "${metric.pattern}" ${include} ${paths} 2>/dev/null${excludeClause} | wc -l`;
  const out = run(cmd).trim();
  return Number.parseInt(out, 10) || 0;
}

function scanLongFiles() {
  const cmd = `find ${SEARCH_PATHS} \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" 2>/dev/null | xargs wc -l 2>/dev/null | awk '$1 > 500 && $2 != "total" {count++} END {print count+0}'`;
  const out = run(cmd).trim();
  return Number.parseInt(out, 10) || 0;
}

function measureAll() {
  const results = {};
  for (const metric of METRICS) {
    results[metric.name] = countMatches(metric);
  }
  return results;
}

// ============================================================================
// Reporting
// ============================================================================

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeBaseline(counts) {
  const baseline = {
    createdAt: new Date().toISOString(),
    counts,
    note: "Regenerate with `node scripts/hygiene-dashboard.mjs --baseline`. Commit the result.",
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n", "utf8");
}

function formatDelta(current, baseline, goodIsHigher) {
  if (baseline === undefined || baseline === null) return "(no baseline)";
  const delta = current - baseline;
  if (delta === 0) return "unchanged";

  const sign = delta > 0 ? "+" : "";
  // If "good is higher" (e.g. @ts-expect-error), a positive delta is good
  const isImprovement = goodIsHigher ? delta > 0 : delta < 0;
  const mark = isImprovement ? "✓" : "✗";

  return `${mark} ${sign}${delta} vs baseline`;
}

function renderTable(counts, baseline) {
  const lines = [];
  lines.push("| Metric | Current | vs Baseline | Description |");
  lines.push("|---|---:|:---|---|");

  for (const metric of METRICS) {
    const current = counts[metric.name];
    const base = baseline?.counts?.[metric.name];
    const delta = formatDelta(current, base, metric.goodIsHigher);
    lines.push(`| \`${metric.name}\` | ${current} | ${delta} | ${metric.description} |`);
  }

  return lines.join("\n");
}

function renderSummary(counts, baseline) {
  if (!baseline) return "No baseline — run `--baseline` to create one.";

  let improved = 0;
  let worse = 0;
  let unchanged = 0;

  for (const metric of METRICS) {
    const current = counts[metric.name];
    const base = baseline.counts?.[metric.name];
    if (base === undefined) continue;
    const delta = current - base;
    const isImprovement = metric.goodIsHigher ? delta > 0 : delta < 0;
    if (delta === 0) unchanged++;
    else if (isImprovement) improved++;
    else worse++;
  }

  return `Improved: ${improved}  Worse: ${worse}  Unchanged: ${unchanged}`;
}

// ============================================================================
// Main
// ============================================================================

const args = process.argv.slice(2);
const isBaseline = args.includes("--baseline");
const isJson = args.includes("--json");
const isStrict = args.includes("--strict");

const counts = measureAll();

if (isBaseline) {
  writeBaseline(counts);
  console.log(`Baseline written to: ${BASELINE_PATH}`);
  console.log(`Counts:`);
  for (const metric of METRICS) {
    console.log(`  ${metric.name}: ${counts[metric.name]}`);
  }
  process.exit(0);
}

const baseline = loadBaseline();

if (isJson) {
  console.log(
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        counts,
        baseline: baseline?.counts ?? null,
        baselineDate: baseline?.createdAt ?? null,
      },
      null,
      2
    )
  );
} else {
  console.log("=== ARUS Code Hygiene Dashboard ===");
  console.log("");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  if (baseline) {
    console.log(`Baseline:  ${baseline.createdAt}`);
  } else {
    console.log(`Baseline:  none (run --baseline to create)`);
  }
  console.log("");
  console.log(renderTable(counts, baseline));
  console.log("");
  console.log(renderSummary(counts, baseline));
}

if (isStrict && baseline) {
  for (const metric of METRICS) {
    const current = counts[metric.name];
    const base = baseline.counts?.[metric.name];
    if (base === undefined) continue;
    const delta = current - base;
    const isRegression = metric.goodIsHigher ? delta < 0 : delta > 0;
    if (isRegression) {
      console.error(`\nREGRESSION: ${metric.name} went from ${base} to ${current}`);
      process.exit(1);
    }
  }
}

process.exit(0);
