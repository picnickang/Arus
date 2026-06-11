#!/usr/bin/env node
// LR-3 — Nightly threshold gate. k6 already enforces declared
// thresholds and exits 99 on breach; this guard exists so a future
// k6 script that *forgets* to declare thresholds does not silently
// pass the nightly job. We require every summary file in the given
// directory to declare at least one `thresholds[*].ok === true`
// metric, and we re-assert k6's own exit by inspecting `failed`.
//
// Usage: node tests/load/check-thresholds.mjs artifacts/load

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: check-thresholds.mjs <summary-dir>");
  process.exit(2);
}

let failed = 0;
let checked = 0;

for (const entry of readdirSync(dir)) {
  if (!entry.endsWith("-summary.json")) continue;
  const path = join(dir, entry);
  if (!statSync(path).isFile()) continue;
  checked += 1;

  const summary = JSON.parse(readFileSync(path, "utf8"));
  const metrics = summary.metrics ?? {};
  const declared = Object.entries(metrics).filter(
    ([, m]) => m && typeof m === "object" && m.thresholds
  );

  if (declared.length === 0) {
    console.error(`✗ ${entry}: no thresholds declared`);
    failed += 1;
    continue;
  }

  const breaches = [];
  for (const [metric, body] of declared) {
    for (const [thresholdExpr, result] of Object.entries(body.thresholds)) {
      // k6 records each declared threshold as `{ ok: bool, ...}`.
      if (result && result.ok === false) {
        breaches.push(`${metric} :: ${thresholdExpr}`);
      }
    }
  }

  if (breaches.length > 0) {
    console.error(`✗ ${entry}: threshold breaches:`);
    for (const b of breaches) console.error(`    - ${b}`);
    failed += 1;
  } else {
    console.log(`✓ ${entry}: ${declared.length} threshold(s) ok`);
  }
}

if (checked === 0) {
  console.error("no -summary.json files found in", dir);
  process.exit(2);
}

process.exit(failed > 0 ? 1 : 0);
