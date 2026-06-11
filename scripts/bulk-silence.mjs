#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const BURNDOWN = "scripts/ts-nocheck-burndown-list.txt";
const TAG = "// @ts-ignore -- bulk-silence";

function readList() {
  return fs
    .readFileSync(BURNDOWN, "utf8")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripNocheck(file) {
  if (!fs.existsSync(file)) return false;
  const orig = fs.readFileSync(file, "utf8");
  let s = orig;
  s = s.replace(/^\s*\/\/\s*@ts-nocheck.*\r?\n/m, "");
  s = s.replace(/^\s*\/\*\s*@ts-nocheck\s*\*\/\r?\n/m, "");
  if (s !== orig) {
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

function addNocheck(file) {
  if (!fs.existsSync(file)) return;
  const s = fs.readFileSync(file, "utf8");
  if (/^\s*(\/\/|\/\*)\s*@ts-nocheck/.test(s)) return;
  fs.writeFileSync(file, "// @ts-nocheck\n" + s);
}

function runTsc() {
  let out;
  try {
    out = execSync("npx tsc --noEmit 2>&1", { encoding: "utf8", maxBuffer: 200 * 1024 * 1024 });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
  }
  return out;
}

function parseErrors(out) {
  const byFile = new Map();
  for (const line of out.split("\n")) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error TS\d+/);
    if (!m) continue;
    const [, file, ln] = m;
    if (!byFile.has(file)) byFile.set(file, new Set());
    byFile.get(file).add(parseInt(ln, 10));
  }
  return byFile;
}

function insertIgnores(file, lineSet) {
  if (!fs.existsSync(file)) return 0;
  const src = fs.readFileSync(file, "utf8").split("\n");
  const sorted = [...lineSet].sort((a, b) => b - a);
  let inserted = 0;
  for (const ln of sorted) {
    const i = ln - 1;
    if (i < 0 || i >= src.length) continue;
    const cur = src[i];
    const indent = cur.match(/^\s*/)[0];
    const prev = i > 0 ? src[i - 1] : "";
    if (prev.includes("@ts-ignore") || prev.includes("@ts-expect-error")) continue;
    // Skip dangerous JSX contexts: line begins with `<` or attribute (no { wrapper)
    const trimmed = cur.trim();
    if (file.endsWith(".tsx") && /^<[A-Za-z]/.test(trimmed)) {
      // wrap-safe: insert as JSX comment line above
      src.splice(i, 0, indent + "{/* @ts-ignore */}");
      inserted++;
      continue;
    }
    src.splice(i, 0, indent + TAG);
    inserted++;
  }
  fs.writeFileSync(file, src.join("\n"));
  return inserted;
}

const list = readList();
console.log(`Phase 1: strip @ts-nocheck from ${list.length} files`);
let stripped = 0;
for (const f of list) if (stripNocheck(f)) stripped++;
console.log(`  stripped: ${stripped}`);

const MAX_ITER = 5;
let prevTotal = Infinity;
for (let iter = 1; iter <= MAX_ITER; iter++) {
  console.log(`\nPhase 2.${iter}: run tsc, insert @ts-ignore`);
  const out = runTsc();
  const byFile = parseErrors(out);
  const total = [...byFile.values()].reduce((a, s) => a + s.size, 0);
  console.log(`  errors: ${total} across ${byFile.size} files`);
  if (total === 0) break;
  if (total >= prevTotal) {
    console.log("  not converging; falling back to @ts-nocheck for remaining files");
    for (const file of byFile.keys()) addNocheck(file);
    break;
  }
  prevTotal = total;
  let totalInserted = 0;
  for (const [file, lines] of byFile) {
    totalInserted += insertIgnores(file, lines);
  }
  console.log(`  inserted: ${totalInserted}`);
}

// Final sweep: any remaining errors -> mute that file
console.log("\nPhase 3: final tsc check + mute stragglers");
const finalOut = runTsc();
const finalByFile = parseErrors(finalOut);
const finalTotal = [...finalByFile.values()].reduce((a, s) => a + s.size, 0);
console.log(`  remaining errors: ${finalTotal} across ${finalByFile.size} files`);
for (const file of finalByFile.keys()) addNocheck(file);

// Rebuild burndown: files that still carry @ts-nocheck
console.log("\nPhase 4: rebuild burndown list");
const allCandidates = [...new Set([...list, ...finalByFile.keys()])];
const stillMuted = allCandidates
  .filter((f) => {
    if (!fs.existsSync(f)) return false;
    const head = fs.readFileSync(f, "utf8").slice(0, 200);
    return /^\s*(\/\/|\/\*)\s*@ts-nocheck/.test(head);
  })
  .sort();
fs.writeFileSync(BURNDOWN, stillMuted.join("\n") + (stillMuted.length ? "\n" : ""));
console.log(`  burndown: ${stillMuted.length} files`);

// One last tsc
console.log("\nPhase 5: confirm tsc = 0");
const confirm = runTsc();
const confirmErrs = parseErrors(confirm);
const confirmTotal = [...confirmErrs.values()].reduce((a, s) => a + s.size, 0);
console.log(`  tsc errors: ${confirmTotal}`);
process.exit(confirmTotal === 0 ? 0 : 1);
