#!/usr/bin/env node
/**
 * ESLint Warning Burndown Guard
 *
 * Runs `npm run lint`, counts warnings + errors, and fails if either count
 * exceeds the frozen baseline in scripts/lint-warnings-baseline.json.
 *
 * Same monotonic-decrease pattern as ts-burndown and cast-burndown.
 * Errors are tracked separately from warnings so a regression in either
 * dimension blocks CI.
 *
 * Usage:
 *   node scripts/check-lint-warnings.mjs                   # check (CI mode)
 *   node scripts/check-lint-warnings.mjs --write-baseline  # lock new floor
 *   node scripts/check-lint-warnings.mjs --report          # show top rules
 */
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const BASELINE_PATH = resolve("scripts/lint-warnings-baseline.json");

function runLint() {
  const res = spawnSync(
    "npx",
    ["--no-install", "eslint", ".", "--format=json"],
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
  );
  // eslint exit codes:
  //   0 — clean
  //   1 — lint issues found (errors and/or warnings) — JSON still on stdout
  //   2 — runtime/config crash — stderr has the message, stdout typically empty
  // A status of 2 (or empty stdout with non-empty stderr) means our parsing
  // would silently report "0 errors, 0 warnings" and let CI pass while the
  // linter is actually broken. Fail loudly instead.
  const stdout = res.stdout || "";
  const stderr = res.stderr || "";
  if (res.status !== null && res.status > 1) {
    console.error("\n❌ ESLint crashed (exit status > 1). stderr:\n");
    console.error(stderr);
    process.exit(2);
  }
  if (!stdout.trim() && stderr.trim()) {
    console.error("\n❌ ESLint produced no JSON output. stderr:\n");
    console.error(stderr);
    process.exit(2);
  }
  return stdout;
}

function parseLint(output) {
  // ESLint --format=json emits a single JSON array of file results:
  //   [{ filePath, messages: [{ severity, ruleId, ... }], ... }, ...]
  // severity: 1 = warning, 2 = error.
  let data;
  try {
    data = JSON.parse(output);
  } catch {
    return [];
  }
  const issues = [];
  for (const file of data) {
    for (const msg of file.messages || []) {
      issues.push({
        file: file.filePath,
        severity: msg.severity === 2 ? "error" : "warning",
        rule: msg.ruleId || "(no-rule)",
      });
    }
  }
  return issues;
}

function summarize(issues) {
  const byRule = new Map();
  const byFile = new Map();
  for (const i of issues) {
    byRule.set(i.rule, (byRule.get(i.rule) || 0) + 1);
    byFile.set(i.file, (byFile.get(i.file) || 0) + 1);
  }
  const top = (m, n = 15) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    byTopRules: Object.fromEntries(top(byRule)),
    byTopFiles: Object.fromEntries(top(byFile, 10)),
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeBaseline = args.has("--write-baseline");
  const showReport = args.has("--report");

  console.log("Running eslint . (this takes ~90–120s)...");
  const output = runLint();
  const issues = parseLint(output);
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  console.log(`ESLint: ${errors} errors, ${warnings} warnings`);

  if (showReport) {
    const summary = summarize(issues);
    console.log("\nTop rules:");
    for (const [rule, n] of Object.entries(summary.byTopRules)) {
      console.log(`  ${String(n).padStart(5)}  ${rule}`);
    }
    console.log("\nTop files:");
    for (const [f, n] of Object.entries(summary.byTopFiles)) {
      console.log(`  ${String(n).padStart(5)}  ${f}`);
    }
  }

  if (writeBaseline) {
    const summary = summarize(issues);
    const payload = {
      _comment:
        "ESLint warning burndown baseline. Both `errors` and `warnings` must monotonically decrease. Regenerate with: node scripts/check-lint-warnings.mjs --write-baseline",
      generatedAt: new Date().toISOString(),
      errors,
      warnings,
      summary,
    };
    await writeFile(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
    console.log(
      `\n✓ Baseline written: ${relative(process.cwd(), BASELINE_PATH)} (errors=${errors}, warnings=${warnings})`,
    );
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(await readFile(BASELINE_PATH, "utf8"));
  } catch {
    console.warn(
      "\n⚠️  No baseline found. Run with --write-baseline to create one.",
    );
    return;
  }

  let regressed = false;
  if (errors > baseline.errors) {
    console.error(
      `\n❌ ESLint error count INCREASED: ${baseline.errors} → ${errors} (+${errors - baseline.errors})`,
    );
    regressed = true;
  }
  if (warnings > baseline.warnings) {
    console.error(
      `\n❌ ESLint warning count INCREASED: ${baseline.warnings} → ${warnings} (+${warnings - baseline.warnings})`,
    );
    regressed = true;
  }

  if (regressed) {
    console.error(
      "\nFix the regression, or — if intentional — update the baseline:",
    );
    console.error("  node scripts/check-lint-warnings.mjs --write-baseline");
    process.exit(1);
  }

  if (errors < baseline.errors || warnings < baseline.warnings) {
    console.log(
      `\n✓ Reduction: errors ${baseline.errors} → ${errors} (-${baseline.errors - errors}), warnings ${baseline.warnings} → ${warnings} (-${baseline.warnings - warnings}). Consider regenerating the baseline.`,
    );
  } else {
    console.log("\n✓ ESLint counts at baseline.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
