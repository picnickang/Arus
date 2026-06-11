#!/usr/bin/env node
/**
 * Client-UI drift ratchets (gap-closure plan G1–G4).
 *
 * Counts four client-side debt patterns that measurably drifted upward
 * while unguarded (docs/UI-SCORECARD.md §11) and compares each against
 * scripts/ui-ratchets-baseline.json — monotonic-decrease, same pattern as
 * check-typed-casts.mjs:
 *
 *   handRolledHeaders        `text-2xl|3xl font-bold` in client/src/pages —
 *                            pages must use PageHeader/AppPage instead.
 *   arbitraryColorUtilities  Tailwind arbitrary color values (`bg-[#…]`,
 *                            `text-[#…]`, …) — semantic/--chart-* tokens only.
 *   rawPollLiterals          `refetchInterval: <number>` literals — use
 *                            POLL_INTERVALS (client/src/lib/polling.ts).
 *   indexKeys                `key={i|idx|index}` outside skeleton files —
 *                            mutable lists need entity keys.
 *
 * Usage:
 *   node scripts/check-ui-ratchets.mjs            # check vs baseline
 *   node scripts/check-ui-ratchets.mjs --update   # ratchet baseline down
 *   node scripts/check-ui-ratchets.mjs --list     # print every hit
 *
 * Exit codes: 0 current <= baseline (all counters) · 1 regression · 2 config error
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(__dirname, "ui-ratchets-baseline.json");

/** @type {Array<{id: string, dir: string, re: RegExp, exclude?: RegExp, hint: string}>} */
const COUNTERS = [
  {
    id: "handRolledHeaders",
    dir: "client/src/pages",
    re: /text-[23]xl font-bold/g,
    hint: "use PageHeader (components/navigation) / the AppPage shell instead of hand-rolled titles",
  },
  {
    id: "arbitraryColorUtilities",
    dir: "client/src",
    re: /(?:bg|text|border|from|to|via|ring|fill|stroke|shadow|outline|decoration|accent|caret|divide)-\[#/g,
    hint: "use semantic tokens (bg-background, text-primary, hsl(var(--chart-N))) — no raw hex utilities",
  },
  {
    id: "rawPollLiterals",
    dir: "client/src",
    re: /refetchInterval:\s*\d/g,
    hint: "use POLL_INTERVALS from client/src/lib/polling.ts (or CACHE_TIMES) instead of numeric literals",
  },
  {
    id: "indexKeys",
    dir: "client/src",
    re: /key=\{(?:i|idx|index)\}/g,
    exclude: /skeleton/i,
    hint: "use a stable entity id as the key (index keys are only acceptable in static skeletons)",
  },
];

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
      if (e.name === "dist" || e.name === "build") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

function countAll() {
  const totals = {};
  const hits = {};
  for (const counter of COUNTERS) {
    let total = 0;
    const list = [];
    for (const file of walk(path.join(ROOT, counter.dir))) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      if (counter.exclude && counter.exclude.test(rel)) continue;
      const body = fs.readFileSync(file, "utf8");
      counter.re.lastIndex = 0;
      let m;
      while ((m = counter.re.exec(body)) !== null) {
        total += 1;
        list.push(`${rel}: ${m[0]}`);
      }
    }
    totals[counter.id] = total;
    hits[counter.id] = list;
  }
  return { totals, hits };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const update = args.has("--update");
  const list = args.has("--list");

  const { totals, hits } = countAll();

  if (list) {
    for (const counter of COUNTERS) {
      console.log(`\n# ${counter.id} (${totals[counter.id]})`);
      for (const hit of hits[counter.id]) console.log(`  ${hit}`);
    }
  }

  if (update) {
    const baseline = {
      _comment:
        "UI drift ratchets — counts may only decrease. Regenerate after intentional reductions: node scripts/check-ui-ratchets.mjs --update",
      ...totals,
    };
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`[check-ui-ratchets] baseline updated: ${JSON.stringify(totals)}`);
    return;
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(
      `[check-ui-ratchets] missing baseline ${path.relative(ROOT, BASELINE_PATH)} — run with --update once.`
    );
    process.exit(2);
  }
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch (err) {
    console.error(`[check-ui-ratchets] failed to parse baseline: ${err.message}`);
    process.exit(2);
  }

  let failed = false;
  const reductions = [];
  for (const counter of COUNTERS) {
    const base = baseline[counter.id];
    const cur = totals[counter.id];
    if (typeof base !== "number") {
      console.error(`[check-ui-ratchets] baseline missing counter '${counter.id}' — run --update.`);
      process.exit(2);
    }
    if (cur > base) {
      failed = true;
      console.error(`\nRATCHET REGRESSION: ${counter.id} increased ${base} → ${cur}.`);
      console.error(`  Fix: ${counter.hint}`);
      const sample = hits[counter.id].slice(-Math.min(5, cur));
      for (const hit of sample) console.error(`    ${hit}`);
    } else if (cur < base) {
      reductions.push(`  ${counter.id}: ${base} → ${cur} (-${base - cur})`);
    }
  }

  if (failed) {
    console.error("\nRun with --list to see every hit. Baselines only ratchet down.");
    process.exit(1);
  }
  console.log(
    `[check-ui-ratchets] OK — ${COUNTERS.map((c) => `${c.id}=${totals[c.id]}`).join(", ")} (all <= baseline).`
  );
  if (reductions.length > 0) {
    console.log("✓ Reductions detected (consider regenerating baseline):");
    for (const r of reductions) console.log(r);
  }
}

main();
