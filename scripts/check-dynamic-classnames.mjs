#!/usr/bin/env node
/**
 * Dynamic-Tailwind-class guard.
 *
 * Fails CI when a value is interpolated into the MIDDLE of a Tailwind class
 * token inside a className / cn() / clsx() / cva() / twMerge() context — e.g.
 * `bg-${color}-950`. Tailwind's JIT only generates statically-analyzable class
 * strings, so a runtime-built token is never emitted and the style silently
 * never ships. This is the exact bug the (now retired) ActionCard carried.
 *
 * Whole-token interpolation is NOT flagged — the interpolation is bounded by
 * whitespace or a backtick, not a partial token character:
 *   `${className}`              merge a className prop
 *   `flex ${active ? "a":"b"}`  whole-class conditional
 *
 * Usage:
 *   node scripts/check-dynamic-classnames.mjs            # check (CI)
 *   node scripts/check-dynamic-classnames.mjs --list     # print every hit
 *
 * Exit codes: 0 clean · 1 violation · 2 config error
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCAN_DIR = "client/src";

// An expression abutting a token char on either side = mid-token interpolation.
const MID_TOKEN = /[A-Za-z0-9_-]\$\{|\}[A-Za-z0-9_-]/;
// The template literal is the DIRECT value of className= / a direct arg of
// cn()/clsx()/cva()/tv()/twMerge() — i.e. the opening backtick immediately
// follows `className={` (or `cn(`, after any string-literal/identifier args).
// Anchored at end so an unrelated `className="…"` earlier on the line (e.g.
// before a `data-testid={`…`}`) does NOT match.
const CLASS_CONTEXT =
  /(?:className\s*=\s*\{?\s*|(?:\bcn|\bclsx|\bcva|\btv|\btwMerge)\s*\(\s*(?:(?:"[^"]*"|'[^']*'|[\w.]+)\s*,\s*)*)$/;
// Each backtick template literal (no nested backtick).
const TEMPLATE = /`([^`]*)`/g;

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
      if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "dist" || e.name === "build") {
        continue;
      }
      yield* walk(full);
    } else if (/\.(tsx|ts)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");

function main() {
  const listOnly = process.argv.includes("--list");
  const violations = [];
  for (const file of walk(path.join(ROOT, SCAN_DIR))) {
    const src = fs.readFileSync(file, "utf8");
    TEMPLATE.lastIndex = 0;
    let m;
    while ((m = TEMPLATE.exec(src)) !== null) {
      if (!MID_TOKEN.test(m[1])) continue;
      const before = src.slice(Math.max(0, m.index - 80), m.index);
      if (!CLASS_CONTEXT.test(before)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      violations.push({ file: rel(file), line, snippet: m[0].slice(0, 70) });
    }
  }
  if (listOnly || violations.length > 0) {
    for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.snippet}`);
  }
  if (violations.length > 0) {
    console.error(
      `\n❌ dynamic-classnames: ${violations.length} mid-token Tailwind interpolation(s). ` +
        `Use a static class map or cn() with whole class names — runtime-built tokens never JIT-compile.`
    );
    process.exit(1);
  }
  console.log("✓ dynamic-classnames OK — no runtime-built Tailwind class tokens.");
}

main();
