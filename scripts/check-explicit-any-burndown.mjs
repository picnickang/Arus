#!/usr/bin/env node
/**
 * Explicit-`any` Burndown Guard
 *
 * Reads the explicit-`any` inventory produced by
 * scripts/type-debt/classify-explicit-any.mjs and enforces a monotonic
 * decrease against scripts/explicit-any-burndown-baseline.json.
 *
 * Mirrors the cast-burndown pattern (scripts/check-cast-burndown.mjs).
 *
 * Usage:
 *   node scripts/check-explicit-any-burndown.mjs                  # check (CI mode)
 *   node scripts/check-explicit-any-burndown.mjs --write-baseline # lock new floor
 *   node scripts/check-explicit-any-burndown.mjs --report         # show top offending files/buckets
 *
 * The inventory JSON is the source of truth for the count. Regenerate it
 * with `node scripts/type-debt/classify-explicit-any.mjs` after running
 * `npx eslint . --format json -o /tmp/lint.json`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = resolve(ROOT, "scripts/explicit-any-burndown-baseline.json");
const INVENTORY_PATH = resolve(ROOT, "scripts/type-debt/explicit-any-inventory.json");

function loadInventory() {
  if (!existsSync(INVENTORY_PATH)) {
    console.error(
      `❌ Missing inventory at ${relative(ROOT, INVENTORY_PATH)}.\n` +
        "Regenerate with:\n" +
        "  npx eslint . --format json -o /tmp/lint.json\n" +
        "  node scripts/type-debt/classify-explicit-any.mjs"
    );
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(INVENTORY_PATH, "utf8"));
  } catch (err) {
    console.error(`❌ Failed to parse ${relative(ROOT, INVENTORY_PATH)}: ${err.message}`);
    process.exit(1);
  }
}

function summarize(inventory) {
  const byBucket = {};
  const topFiles = {};
  for (const [key, b] of Object.entries(inventory.buckets ?? {})) {
    byBucket[b.label ?? key] = b.count ?? 0;
    for (const tf of b.topFiles ?? []) {
      topFiles[tf.file] = (topFiles[tf.file] ?? 0) + tf.count;
    }
  }
  const byTopFiles = Object.fromEntries(
    Object.entries(topFiles)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
  );
  return { byBucket, byTopFiles };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const writeBaseline = args.has("--write-baseline");
  const showReport = args.has("--report");

  const inventory = loadInventory();
  const total = inventory.total ?? 0;

  console.log(`Explicit \`any\` occurrences (@typescript-eslint/no-explicit-any): ${total}`);
  console.log(`Source: ${relative(ROOT, INVENTORY_PATH)} (generated ${inventory.generatedAt})`);

  if (showReport) {
    const summary = summarize(inventory);
    console.log("\nBy bucket:");
    for (const [label, count] of Object.entries(summary.byBucket)) {
      console.log(`  ${String(count).padStart(5)}  ${label}`);
    }
    console.log("\nTop files:");
    for (const [file, count] of Object.entries(summary.byTopFiles)) {
      console.log(`  ${String(count).padStart(5)}  ${file}`);
    }
  }

  if (writeBaseline) {
    const payload = {
      _comment:
        "Explicit-`any` burndown baseline. Total must monotonically decrease. " +
        "Regenerate the inventory (`node scripts/type-debt/classify-explicit-any.mjs`) " +
        "then run `node scripts/check-explicit-any-burndown.mjs --write-baseline`.",
      generatedAt: new Date().toISOString(),
      total,
      summary: summarize(inventory),
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
      `\n⚠️  No baseline found at ${relative(ROOT, BASELINE_PATH)}. ` +
        "Run with --write-baseline to create one."
    );
    return;
  }

  if (total > baseline.total) {
    const delta = total - baseline.total;
    console.error(`\n❌ Explicit \`any\` count INCREASED: ${baseline.total} → ${total} (+${delta})`);
    console.error(
      "Each new `any` is a hole in the type system. Narrow with `unknown` + a type guard, " +
        "reach for `Parameters<typeof fn>[n]` / `Awaited<ReturnType<typeof fn>>`, or use " +
        "`AuthenticatedRequest` for route handlers."
    );
    console.error("If the increase is intentional and unavoidable, update the baseline:");
    console.error("  node scripts/check-explicit-any-burndown.mjs --write-baseline");
    process.exit(1);
  }

  if (total < baseline.total) {
    const delta = baseline.total - total;
    console.log(
      `\n✓ Nice — reduction: ${baseline.total} → ${total} (-${delta}). ` +
        "Consider regenerating the baseline to lock in the new floor:\n" +
        "  node scripts/check-explicit-any-burndown.mjs --write-baseline"
    );
  } else {
    console.log("\n✓ Explicit `any` count at baseline.");
  }
}

main();
