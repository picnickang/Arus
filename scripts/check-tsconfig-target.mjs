#!/usr/bin/env node
/**
 * P2 #27 — Guard rail: keep tsconfig.json in sync with the strictness
 * burndown plan documented in tsconfig.target.json.
 *
 * The target file pins the desired final values of a curated set of
 * compilerOptions (strict family). This script compares each pinned
 * value against the live tsconfig.json and reports drift.
 *
 *   - Exit 0 → live config matches target for every tracked option.
 *   - Exit 1 → at least one option drifted away from / no longer
 *     reaches the target value.
 *
 * Whitelisted to the keys declared inside target.compilerOptions so
 * unrelated tsconfig tuning (paths, lib, jsx, etc.) is not policed.
 *
 * Designed to be CI-friendly: stdout is plain text, no chalk / no
 * deps. Wire it as `node scripts/check-tsconfig-target.mjs` from any
 * pre-merge hook.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function readJsonStripComments(path) {
  // tsconfig.json supports // and /* */ comments + trailing commas.
  const raw = readFileSync(path, "utf-8");
  const noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const noLine = noBlock.replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  const noTrailingCommas = noLine.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(noTrailingCommas);
}

const targetPath = resolve(repoRoot, "tsconfig.target.json");
const livePath = resolve(repoRoot, "tsconfig.json");

let target;
let live;
try {
  target = readJsonStripComments(targetPath);
} catch (err) {
  console.error(`[check-tsconfig-target] failed to read ${targetPath}: ${err.message}`);
  process.exit(2);
}
try {
  live = readJsonStripComments(livePath);
} catch (err) {
  console.error(`[check-tsconfig-target] failed to read ${livePath}: ${err.message}`);
  process.exit(2);
}

const targetOpts = target.compilerOptions ?? {};
const liveOpts = live.compilerOptions ?? {};

const drift = [];
for (const key of Object.keys(targetOpts)) {
  const want = targetOpts[key];
  const got = liveOpts[key];
  if (got !== want) {
    drift.push({ key, want, got: got === undefined ? "<unset>" : got });
  }
}

if (drift.length === 0) {
  console.log(
    `[check-tsconfig-target] OK — tsconfig.json matches tsconfig.target.json on all ${Object.keys(targetOpts).length} tracked option(s).`,
  );
  process.exit(0);
}

console.error("[check-tsconfig-target] DRIFT — tsconfig.json does not match tsconfig.target.json:");
for (const { key, want, got } of drift) {
  console.error(`  - ${key}: live=${JSON.stringify(got)} target=${JSON.stringify(want)}`);
}
console.error(
  `\n${drift.length} option(s) need to be reconciled (see tsconfig.target.json burndown notes).`,
);
process.exit(1);
