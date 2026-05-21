#!/usr/bin/env node
/**
 * Server Wire-Boundary Zod Parse Guard
 *
 * Every `req.body`, `req.query`, and `req.params` access in server/domains/**
 * route handlers must flow through a `Schema.parse(...)` (or `.safeParse(...)`)
 * call in the same function — typing the wire boundary at the entry point
 * instead of casting it later.
 *
 * Heuristic: split each .ts file on `async (req`/`(req`/`function (req` handler
 * starts (approximated by scanning function bodies), and within each body:
 *   - count raw `req.body`/`req.query`/`req.params` reads, EXCLUDING those that
 *     appear as the immediate argument to a `.parse(`/`.safeParse(` call.
 * Failures are reported with file:line. Baseline is monotonic-decreasing,
 * stored in scripts/wire-parses-baseline.json.
 *
 * Usage:
 *   node scripts/check-server-wire-parses.mjs                  # check (CI)
 *   node scripts/check-server-wire-parses.mjs --write-baseline # lock new floor
 *   node scripts/check-server-wire-parses.mjs --report         # list offenders
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const BASELINE_PATH = resolve("scripts/wire-parses-baseline.json");
const ROOT = process.cwd();
const SCAN_ROOT = "server/domains";
const FILE_EXTS = [".ts"];
const SKIP_DIR_NAMES = new Set(["node_modules", "dist", "build", ".git", "tests", "__tests__"]);

// Match a wire-read like `req.body`, `req.query.foo`, `req.params.id`.
// Word boundary ensures we don't match `request.body`.
const WIRE_RE = /\breq\.(body|query|params)\b/g;

// A wire read is OK when it appears as the immediate argument of a parse:
//   Schema.parse(req.body)        OK
//   Schema.safeParse(req.query)   OK
// We detect this by looking at the characters immediately preceding the match
// for the pattern `.parse(` or `.safeParse(` (allowing whitespace).
const PARSE_PREFIX_RE = /\.(?:parse|safeParse)\(\s*$/;

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
    if (ent.isDirectory()) {
      walk(p, out);
    } else if (FILE_EXTS.some((e) => ent.name.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

function scanFile(absPath) {
  const src = readFileSync(absPath, "utf8");
  const offenders = [];
  let m;
  WIRE_RE.lastIndex = 0;
  while ((m = WIRE_RE.exec(src)) !== null) {
    const before = src.slice(Math.max(0, m.index - 32), m.index);
    if (PARSE_PREFIX_RE.test(before)) continue;
    // Compute line number
    const line = src.slice(0, m.index).split("\n").length;
    offenders.push({ line, snippet: m[0] });
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
  if (args.has("--write-baseline")) {
    writeFileSync(BASELINE_PATH, JSON.stringify({ total }, null, 2) + "\n");
    console.log(`Wrote baseline: total=${total}`);
    return;
  }

  if (args.has("--report")) {
    const sorted = [...perFile.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [f, offs] of sorted.slice(0, 25)) {
      console.log(`${f}: ${offs.length}`);
      for (const o of offs.slice(0, 3)) console.log(`  ${f}:${o.line} ${o.snippet}`);
    }
    console.log(`\nTotal unparsed wire reads in ${SCAN_ROOT}: ${total}`);
    return;
  }

  let baseline = total;
  if (existsSync(BASELINE_PATH)) {
    try {
      baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).total ?? total;
    } catch {
      baseline = total;
    }
  } else {
    writeFileSync(BASELINE_PATH, JSON.stringify({ total }, null, 2) + "\n");
    console.log(`Initialized baseline: total=${total}`);
    return;
  }

  if (total > baseline) {
    console.error(
      `\n✗ Wire-parse regression in ${SCAN_ROOT}: ${baseline} → ${total} (+${total - baseline})`
    );
    console.error(`  Every req.body / req.query / req.params must flow through Schema.parse().`);
    console.error(`  Run \`node ${relative(ROOT, process.argv[1])} --report\` to see offenders.`);
    process.exit(1);
  }

  if (total < baseline) {
    console.log(
      `✓ Reduction: ${baseline} → ${total} (-${baseline - total}). Consider regenerating the baseline.`
    );
  } else {
    console.log(`✓ Wire-parse count at baseline: ${total}`);
  }
}

main();
