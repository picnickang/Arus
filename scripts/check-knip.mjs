#!/usr/bin/env node
/**
 * Knip Dead-Code Ratchet
 *
 * Runs knip with JSON output, counts each issue bucket, and fails if any bucket
 * exceeds scripts/knip-baseline.json. This keeps the legacy dead-code backlog
 * from growing while Wave 2 burns it down deliberately.
 *
 * Usage:
 *   node scripts/check-knip.mjs                   # check (CI mode)
 *   node scripts/check-knip.mjs --write-baseline  # lock current floor
 */
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const BASELINE_PATH = resolve("scripts/knip-baseline.json");
const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/arus_test";
const ISSUE_BUCKETS = [
  "dependencies",
  "devDependencies",
  "optionalPeerDependencies",
  "exports",
  "types",
  "enumMembers",
  "duplicates",
  "catalog",
];

function runKnip() {
  const res = spawnSync("npx", ["--no-install", "knip", "--reporter", "json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
    },
    maxBuffer: 128 * 1024 * 1024,
  });

  const stdout = res.stdout || "";
  const stderr = res.stderr || "";
  if (res.status !== null && res.status > 1) {
    console.error("\n❌ knip crashed (exit status > 1). stderr:\n");
    console.error(stderr);
    process.exit(2);
  }
  if (!stdout.trim()) {
    console.error("\n❌ knip produced no JSON output. stderr:\n");
    console.error(stderr);
    process.exit(2);
  }
  return stdout;
}

function countValue(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object") {
    return Object.values(value).reduce((total, nested) => total + countValue(nested), 0);
  }
  return 0;
}

function summarize(report) {
  const counts = {
    files: Array.isArray(report.files) ? report.files.length : 0,
  };

  for (const bucket of ISSUE_BUCKETS) counts[bucket] = 0;

  for (const issue of report.issues || []) {
    for (const bucket of ISSUE_BUCKETS) {
      counts[bucket] += countValue(issue[bucket]);
    }
  }

  const totalAtomic = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { counts, totalAtomic };
}

function printCounts(label, summary) {
  console.log(`${label}:`);
  for (const [bucket, count] of Object.entries(summary.counts)) {
    console.log(`  ${bucket.padEnd(24)} ${String(count).padStart(5)}`);
  }
  console.log(`  ${"totalAtomic".padEnd(24)} ${String(summary.totalAtomic).padStart(5)}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeBaseline = args.has("--write-baseline");

  console.log("Running knip --reporter json...");
  let report;
  try {
    report = JSON.parse(runKnip());
  } catch (err) {
    console.error("\n❌ Failed to parse knip JSON output:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(2);
  }

  const current = summarize(report);
  printCounts("Knip current counts", current);

  if (writeBaseline) {
    const payload = {
      $note:
        "Monotonic-decrease ratchet for knip dead-code buckets. Regenerate with: node scripts/check-knip.mjs --write-baseline. Do not raise a bucket unless the new debt is intentionally accepted.",
      generatedAt: new Date().toISOString(),
      counts: current.counts,
      totalAtomic: current.totalAtomic,
    };
    await writeFile(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
    console.log(`\n✓ Baseline written: ${relative(process.cwd(), BASELINE_PATH)}`);
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(await readFile(BASELINE_PATH, "utf8"));
  } catch {
    console.warn("\n⚠️  No baseline found. Run with --write-baseline to create one.");
    return;
  }

  const baselineCounts = baseline.counts || {};
  let failed = false;
  for (const [bucket, currentCount] of Object.entries(current.counts)) {
    const baselineCount = baselineCounts[bucket];
    if (baselineCount === undefined) continue;
    if (currentCount > baselineCount) {
      console.error(
        `\n❌ knip ${bucket} count INCREASED: ${baselineCount} → ${currentCount} (+${
          currentCount - baselineCount
        })`
      );
      failed = true;
    } else if (currentCount < baselineCount) {
      console.log(
        `\n✓ knip ${bucket} reduction: ${baselineCount} → ${currentCount} (-${
          baselineCount - currentCount
        }). Consider regenerating the baseline.`
      );
    }
  }

  if (baseline.totalAtomic !== undefined && current.totalAtomic > baseline.totalAtomic) {
    console.error(
      `\n❌ knip totalAtomic count INCREASED: ${baseline.totalAtomic} → ${current.totalAtomic} (+${
        current.totalAtomic - baseline.totalAtomic
      })`
    );
    failed = true;
  } else if (baseline.totalAtomic !== undefined && current.totalAtomic < baseline.totalAtomic) {
    console.log(
      `\n✓ knip totalAtomic reduction: ${baseline.totalAtomic} → ${current.totalAtomic} (-${
        baseline.totalAtomic - current.totalAtomic
      }). Consider regenerating the baseline.`
    );
  }

  if (failed) {
    console.error("\nFix the regression, or — if intentional — update the baseline:");
    console.error("  node scripts/check-knip.mjs --write-baseline");
    process.exit(1);
  }

  console.log("\n✓ knip counts at baseline.");
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
