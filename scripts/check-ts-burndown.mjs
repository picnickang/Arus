#!/usr/bin/env node
/**
 * TypeScript Error Burndown Guard
 *
 * Runs `tsc --noEmit`, counts errors, and fails if the count exceeds the
 * frozen baseline in scripts/ts-burndown-baseline.json.
 *
 * Same monotonic-decrease pattern as drift-burndown and domain-leak-baseline.
 *
 * Usage:
 *   node scripts/check-ts-burndown.mjs               # check (CI mode)
 *   node scripts/check-ts-burndown.mjs --write-baseline   # lock new floor
 *   node scripts/check-ts-burndown.mjs --report      # show top error categories
 */
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const BASELINE_PATH = resolve("scripts/ts-burndown-baseline.json");

function runTsc() {
  const res = spawnSync("npx", ["--no-install", "tsc", "--noEmit", "--pretty", "false"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  // tsc exits 1 when errors are present — that's fine for our purposes.
  return (res.stdout || "") + (res.stderr || "");
}

function parseErrors(output) {
  // Match lines like:  path/to/file.ts(123,45): error TS2345: message
  const re = /^(.*?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/gm;
  const errors = [];
  let m;
  while ((m = re.exec(output)) !== null) {
    errors.push({
      file: m[1],
      line: Number(m[2]),
      col: Number(m[3]),
      code: m[4],
      message: m[5],
    });
  }
  return errors;
}

function summarize(errors) {
  const byCode = new Map();
  const byFile = new Map();
  const byDir = new Map();
  for (const e of errors) {
    byCode.set(e.code, (byCode.get(e.code) || 0) + 1);
    byFile.set(e.file, (byFile.get(e.file) || 0) + 1);
    const dir = e.file.split("/").slice(0, 2).join("/");
    byDir.set(dir, (byDir.get(dir) || 0) + 1);
  }
  const top = (m, n = 10) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    byCode: Object.fromEntries(top(byCode)),
    byTopFiles: Object.fromEntries(top(byFile, 15)),
    byTopDirs: Object.fromEntries(top(byDir, 10)),
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const writeBaseline = args.has("--write-baseline");
  const showReport = args.has("--report");

  console.log("Running tsc --noEmit (this takes ~60–90s)...");
  const output = runTsc();
  const errors = parseErrors(output);
  const total = errors.length;

  console.log(`TypeScript errors: ${total}`);

  if (showReport) {
    const summary = summarize(errors);
    console.log("\nTop error codes:");
    for (const [code, n] of Object.entries(summary.byCode)) {
      console.log(`  ${code.padEnd(8)} ${n}`);
    }
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
    const summary = summarize(errors);
    const payload = {
      _comment:
        "TypeScript error burndown baseline. Total must monotonically decrease. Regenerate with: node scripts/check-ts-burndown.mjs --write-baseline",
      generatedAt: new Date().toISOString(),
      total,
      summary,
    };
    await writeFile(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
    console.log(`\n✓ Baseline written: ${relative(process.cwd(), BASELINE_PATH)} (total=${total})`);
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(await readFile(BASELINE_PATH, "utf8"));
  } catch {
    console.warn("\n⚠️  No baseline found. Run with --write-baseline to create one.");
    return;
  }

  if (total > baseline.total) {
    const delta = total - baseline.total;
    console.error(
      `\n❌ TypeScript error count INCREASED: ${baseline.total} → ${total} (+${delta})`
    );
    console.error("Fix the regression, or — if intentional — update the baseline:");
    console.error("  node scripts/check-ts-burndown.mjs --write-baseline");
    process.exit(1);
  }

  if (total < baseline.total) {
    console.log(
      `\n✓ Reduction: ${baseline.total} → ${total} (-${baseline.total - total}). Consider regenerating the baseline.`
    );
  } else {
    console.log("\n✓ TypeScript error count at baseline.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
