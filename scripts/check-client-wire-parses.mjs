#!/usr/bin/env node
/**
 * Client Wire-Boundary Zod Parse Guard (baseline mode)
 *
 * Every value returned from `await fetch(...)` or `await apiRequest(...)` in
 * `client/src/**` must flow through a Zod `.parse(...)` / `.safeParse(...)`
 * call (or through `validateResponse<T>`) in the same function — typing the
 * wire boundary at the entry point instead of casting it later.
 *
 * Heuristic: walk every .ts/.tsx file in client/src/. For each `await
 * fetch(...)` or `await apiRequest(...)` call site, look at the
 * surrounding ~6 lines for an immediate `.parse(` / `.safeParse(` /
 * `validateResponse(` consumption of that value. Anything else counts as
 * an "unparsed wire read".
 *
 * This is intentionally a structural check — it doesn't follow the value
 * across helpers, only flags the local pattern. False positives become
 * follow-up tasks; the baseline file is monotonic-decreasing.
 *
 * Baseline behaviour:
 *   - Stored in `scripts/client-wire-parses-baseline.json` as `{ "unparsed": N }`.
 *   - CI fails when the unparsed count rises above the baseline.
 *   - `--write-baseline` lowers the floor; the file should be committed.
 *
 * Usage:
 *   node scripts/check-client-wire-parses.mjs                  # CI check
 *   node scripts/check-client-wire-parses.mjs --report         # list offenders
 *   node scripts/check-client-wire-parses.mjs --write-baseline # lock new floor
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = resolve("scripts/client-wire-parses-baseline.json");
const SCAN_ROOT = "client/src";
const SKIP_DIR_NAMES = new Set(["node_modules", "dist", "build", ".git", "__tests__", "tests"]);
const FILE_EXTS = [".ts", ".tsx"];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (FILE_EXTS.some((e) => ent.name.endsWith(e))) out.push(p);
  }
  return out;
}

// Match an awaited wire call: `await fetch(...)` or `await apiRequest(...)`.
// We also accept `await fetch(...).then(...)` chains as wire reads — the
// chain itself is the consumption site we evaluate.
const WIRE_RE = /\bawait\s+(fetch|apiRequest)\s*(?:<[^>(]*>)?\s*\(/g;

// Within the look-ahead window after the call site, a parse/validate appears.
const PARSE_RE = /\b(parse|safeParse|validateResponse)\s*[(<]/;

// Common safe-consumption sinks where the body never reaches React state
// directly — typing them is still desirable but they're not in scope of this
// guard. Keep this list conservative.
const SAFE_SINKS_RE =
  /^\s*(?:await\s+)?(?:queryClient\.|console\.|toast\(|logger\.|throw\b|return\s+(?:await\s+)?(?:res|response|r)\.json\b)/;

function scanFile(absPath) {
  const src = readFileSync(absPath, "utf8");
  const offenders = [];
  let m;
  WIRE_RE.lastIndex = 0;
  while ((m = WIRE_RE.exec(src)) !== null) {
    // Take a ~600-char / ~12-line window after the call site to detect a
    // .parse() / validateResponse() consumption.
    const after = src.slice(m.index, m.index + 800);
    if (PARSE_RE.test(after)) continue;
    // Skip patterns that immediately return / fire-and-forget the wire value
    // without ever assigning it to React state. These are still worth typing
    // but aren't the unsafe pattern this guard is designed to catch.
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    const lineEnd = src.indexOf("\n", m.index);
    const line = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (SAFE_SINKS_RE.test(line)) continue;
    const lineNumber = src.slice(0, m.index).split("\n").length;
    offenders.push({ line: lineNumber, snippet: line.trim().slice(0, 120) });
  }
  return offenders;
}

function main() {
  const scanDir = resolve(SCAN_ROOT);
  if (!statSync(scanDir).isDirectory()) {
    console.error(`Scan root not found: ${SCAN_ROOT}`);
    process.exit(2);
  }
  const files = walk(scanDir);
  const perFile = new Map();
  let total = 0;
  for (const f of files) {
    const offs = scanFile(f);
    if (offs.length > 0) {
      perFile.set(relative(ROOT, f), offs);
      total += offs.length;
    }
  }

  const args = new Set(process.argv.slice(2));

  if (args.has("--report")) {
    const sorted = [...perFile.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [f, offs] of sorted.slice(0, 30)) {
      console.log(`${f}: ${offs.length}`);
      for (const o of offs.slice(0, 3)) console.log(`  ${f}:${o.line}  ${o.snippet}`);
    }
    console.log(`\nTotal unparsed client wire reads in ${SCAN_ROOT}: ${total}`);
    return;
  }

  if (args.has("--write-baseline")) {
    writeFileSync(BASELINE_PATH, JSON.stringify({ unparsed: total }, null, 2) + "\n");
    console.log(`Wrote baseline: unparsed=${total}`);
    return;
  }

  let baseline = total;
  if (existsSync(BASELINE_PATH)) {
    try {
      baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).unparsed ?? total;
    } catch {
      baseline = total;
    }
  } else {
    writeFileSync(BASELINE_PATH, JSON.stringify({ unparsed: total }, null, 2) + "\n");
    console.log(`Initialized client wire-parse baseline: unparsed=${total}`);
    return;
  }

  if (total > baseline) {
    console.error(
      `\n✗ Client wire-parse regression in ${SCAN_ROOT}: ${baseline} → ${total} (+${total - baseline})`,
    );
    console.error(
      `  Every await fetch(...) / await apiRequest(...) result must flow through a Zod parse.`,
    );
    console.error(
      `  Run \`node ${relative(ROOT, process.argv[1])} --report\` to see offenders.`,
    );
    process.exit(1);
  }

  if (total < baseline) {
    console.log(
      `✓ Reduction: ${baseline} → ${total} (-${baseline - total}). Consider regenerating the baseline.`,
    );
  } else {
    console.log(`✓ Client wire-parse count at baseline: ${total}`);
  }
}

main();
