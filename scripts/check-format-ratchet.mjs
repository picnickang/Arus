#!/usr/bin/env node
/**
 * Prettier debt ratchet.
 *
 * This keeps historical formatting debt visible without turning the release
 * branch into a repository-wide formatting change. The raw formatter remains
 * available as `npm run format:check`; CI uses this ratchet to fail on new
 * formatting debt and on touched tracked files that are left unformatted.
 *
 * Usage:
 *   node scripts/check-format-ratchet.mjs
 *   node scripts/check-format-ratchet.mjs --write-baseline --write-report
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE_PATH = resolve(ROOT, "scripts/format-baseline.json");
const REPORT_PATH = resolve(ROOT, "docs/qa/format-burndown.md");
const BASELINE_REPO_PATH = "scripts/format-baseline.json";
const REPORT_REPO_PATH = "docs/qa/format-burndown.md";
const PRETTIER_CLI = require.resolve("prettier/bin/prettier.cjs");
const MAX_PREVIEW = 40;

const args = new Set(process.argv.slice(2));
const writeBaseline = args.has("--write-baseline");
const writeReport = args.has("--write-report");

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
}

function parsePrettierFiles(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("[warn]"))
    .filter((line) => line !== "Checking formatting...")
    .filter((line) => !line.startsWith("Code style issues found"))
    .filter((line) => !line.startsWith("All matched files use Prettier code style"));
}

function prettierListDifferent(paths) {
  const result = run(process.execPath, [
    PRETTIER_CLI,
    "--list-different",
    "--cache=false",
    "--ignore-unknown",
    ...paths,
  ]);

  if (result.status !== 0 && result.status !== 1) {
    console.error("Prettier failed before formatting debt could be counted.");
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
    process.exit(2);
  }

  return [...new Set(parsePrettierFiles(`${result.stdout || ""}\n${result.stderr || ""}`))].sort();
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadBaseline() {
  return readJson(BASELINE_PATH);
}

function loadGitBaseline(ref) {
  const result = run("git", ["show", `${ref}:${BASELINE_REPO_PATH}`]);
  if (result.status !== 0 || !result.stdout.trim()) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function getPriorBaselineCandidates() {
  const candidates = [];
  for (const ref of ["HEAD", "HEAD~1", "refs/remotes/origin/main", "refs/remotes/origin/master"]) {
    const baseline = loadGitBaseline(ref);
    if (typeof baseline?.count === "number") {
      candidates.push({ ref, count: baseline.count });
    }
  }
  return candidates;
}

function assertBaselineDidNotIncrease(baseline) {
  const priorBaselines = getPriorBaselineCandidates();
  const lowerPrior = priorBaselines.find((prior) => baseline.count > prior.count);
  if (!lowerPrior) return;

  console.error(
    `\n❌ Format baseline increased compared with ${lowerPrior.ref}: ${lowerPrior.count} → ${baseline.count}.`
  );
  console.error("The formatting baseline is ratcheted and may only stay flat or decrease.");
  process.exit(1);
}

function getTouchedTrackedFiles() {
  const result = run("git", ["diff", "--name-only", "--diff-filter=ACMRT", "HEAD", "--"]);
  if (result.status !== 0) return [];

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => existsSync(resolve(ROOT, path)))
    .sort();
}

function groupByArea(files) {
  const groups = {
    server: 0,
    client: 0,
    shared: 0,
    tests: 0,
    scripts: 0,
    docs: 0,
    config: 0,
    other: 0,
  };

  for (const file of files) {
    if (file.startsWith("server/")) groups.server += 1;
    else if (file.startsWith("client/")) groups.client += 1;
    else if (file.startsWith("shared/")) groups.shared += 1;
    else if (file.startsWith("tests/")) groups.tests += 1;
    else if (file.startsWith("scripts/")) groups.scripts += 1;
    else if (file.startsWith("docs/")) groups.docs += 1;
    else if (/^[^/]+\.(json|mjs|js|ts|tsx|md|yml|yaml)$/.test(file)) groups.config += 1;
    else groups.other += 1;
  }

  return groups;
}

function topDirectories(files, depth = 2, limit = 30) {
  const counts = new Map();
  for (const file of files) {
    const key = file.split("/").slice(0, depth).join("/") || file;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function writeBaselineFile(count) {
  const payload = {
    _comment:
      "Prettier formatting debt ratchet. Current unformatted file count must not exceed `count`; lower this count only after formatting debt is removed. Regenerate with: node scripts/check-format-ratchet.mjs --write-baseline --write-report",
    generatedAt: new Date().toISOString(),
    count,
    policy: {
      mode: "ratchet-ceiling",
      rawCheck: "npm run format:check",
      ratchetCheck: "npm run check:format-ratchet",
      report: REPORT_REPO_PATH,
      touchedTrackedFilesMustBeFormatted: true,
      productionCodeCounted: true,
      note: "Historical formatting debt is visible and cannot increase. New/touched tracked files must be formatted.",
    },
  };

  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return payload;
}

function renderReport({ baseline, unformattedFiles, touchedFailures }) {
  const groups = groupByArea(unformattedFiles);
  const directories = topDirectories(unformattedFiles);
  const preview = unformattedFiles.slice(0, 100);
  const generatedAt = new Date().toISOString();

  const lines = [
    "# Format Burndown",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Policy",
    "",
    "Formatting debt is tracked as a ratcheted release gate:",
    "",
    "- `npm run format:check` remains the raw repository-wide Prettier check.",
    "- `npm run check:format-ratchet` is used by `npm run check:guards-full`.",
    "- Existing formatting debt is counted and reported.",
    "- CI fails when the unformatted file count exceeds the committed ceiling.",
    "- CI fails when tracked files touched by the current change are left unformatted.",
    "- The baseline can only stay flat or decrease.",
    "- Production code remains counted.",
    "- Do not run a whole-repo format sweep unless the release branch explicitly accepts that churn.",
    "",
    "## Current Count",
    "",
    `Current unformatted file count: ${unformattedFiles.length}`,
    `Committed ceiling: ${baseline.count}`,
    "",
    "| Area | Count |",
    "| --- | ---: |",
    ...Object.entries(groups).map(([area, count]) => `| ${area} | ${count} |`),
    "",
    "## Top Directories",
    "",
    "| Directory | Count |",
    "| --- | ---: |",
    ...directories.map(([directory, count]) => `| \`${directory}\` | ${count} |`),
    "",
    "## Touched-File Enforcement",
    "",
    touchedFailures.length
      ? `Tracked touched files currently failing Prettier: ${touchedFailures.length}`
      : "All tracked touched files passed Prettier at report generation time.",
    "",
    "## Recommended Burndown",
    "",
    "1. Format files only when already changing them for functional work.",
    "2. Prefer small module-scoped formatting PRs when a team explicitly owns the churn.",
    "3. After debt decreases, regenerate this report and lower `scripts/format-baseline.json`.",
    "4. Keep raw `npm run format:check` available for local inspection and eventual full cleanup.",
    "",
    "## Sample Unformatted Files",
    "",
    "The first 100 unformatted files are listed as a sample. Use `npm run format:check` for the full raw list.",
    "",
    "```text",
    ...preview,
    "```",
  ];

  return `${lines.join("\n")}\n`;
}

function printPreview(label, files) {
  if (!files.length) return;
  console.error(`\n${label}:`);
  for (const file of files.slice(0, MAX_PREVIEW)) {
    console.error(`  ${file}`);
  }
  if (files.length > MAX_PREVIEW) {
    console.error(`  ...and ${files.length - MAX_PREVIEW} more`);
  }
}

function main() {
  console.log("Counting repository formatting debt with Prettier...");
  const unformattedFiles = prettierListDifferent(["."]);
  const currentCount = unformattedFiles.length;
  const touchedTrackedFiles = getTouchedTrackedFiles();
  const touchedFailures = touchedTrackedFiles.length
    ? prettierListDifferent(touchedTrackedFiles)
    : [];

  let baseline = loadBaseline();
  if (writeBaseline) {
    baseline = writeBaselineFile(currentCount);
    console.log(`Baseline written: ${relative(ROOT, BASELINE_PATH)} (count=${baseline.count})`);
  }

  if (!baseline) {
    console.error("\n❌ Missing formatting baseline.");
    console.error(
      "Create one with: node scripts/check-format-ratchet.mjs --write-baseline --write-report"
    );
    process.exit(1);
  }

  assertBaselineDidNotIncrease(baseline);

  if (writeReport) {
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(
      REPORT_PATH,
      renderReport({ baseline, unformattedFiles, touchedFailures }),
      "utf8"
    );
    console.log(`Report written: ${relative(ROOT, REPORT_PATH)}`);
  }

  let failed = false;

  if (currentCount > baseline.count) {
    console.error(
      `\n❌ Format debt increased: baseline ${baseline.count}, current ${currentCount} (+${currentCount - baseline.count}).`
    );
    printPreview("Unformatted files", unformattedFiles);
    failed = true;
  } else if (currentCount < baseline.count) {
    console.log(
      `\n✓ Format debt reduced: baseline ${baseline.count}, current ${currentCount} (-${baseline.count - currentCount}).`
    );
    console.log(
      "Lower the ratchet with: node scripts/check-format-ratchet.mjs --write-baseline --write-report"
    );
  } else {
    console.log(`\n✓ Format debt at baseline (${currentCount}). Future increases fail CI.`);
  }

  if (touchedFailures.length > 0) {
    console.error(
      `\n❌ ${touchedFailures.length} tracked touched file(s) need Prettier formatting.`
    );
    printPreview("Touched formatting failures", touchedFailures);
    console.error("\nFormat only touched files, then rerun npm run check:format-ratchet.");
    failed = true;
  } else {
    console.log(`✓ Tracked touched files formatted (${touchedTrackedFiles.length} checked).`);
  }

  if (failed) process.exit(1);
}

main();
