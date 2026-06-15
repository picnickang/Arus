#!/usr/bin/env node
/**
 * check-scheduler-single-flight.mjs
 *
 * Zero-tolerance guard against the self-lapping scheduler bug class.
 *
 * `setInterval(async () => …)` does not wait for the previous tick to settle,
 * so a tick that runs longer than its interval fires again while the prior run
 * is still in flight — two runs racing the same state (last-write-wins data
 * loss in refresh/expiry schedulers). Wrap the tick in `withSingleFlight`
 * (`server/lib/single-flight.ts`) so overlapping invocations are skipped.
 *
 * Scope: server-side only (where the schedulers and the helper live). Comments
 * and strings are stripped before matching so docstrings that mention the
 * pattern do not trip the guard.
 *
 * Escape hatch: a genuinely overlap-safe tick may opt out with a
 * `// single-flight-ok: <reason>` comment on the line above the setInterval.
 *
 * Exit codes:
 *   0  no raw `setInterval(async …)` found
 *   1  one or more violations
 *   2  script/IO error
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["server"];

const VIOLATION_RE = /setInterval\s*\(\s*async\b/;
const EXEMPT_RE = /single-flight-ok/;

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
      yield* walk(full);
    } else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

// Strip block and line comments so a pattern mentioned in a docstring does not
// count. Naive but sufficient: the guard only needs the code surface.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const violations = [];

try {
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const src = fs.readFileSync(file, "utf8");
      const code = stripComments(src);
      if (!VIOLATION_RE.test(code)) continue;

      // Re-scan the ORIGINAL lines to report a line number and honour the
      // per-callsite exemption comment.
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!VIOLATION_RE.test(stripComments(lines[i]))) continue;
        const prev = i > 0 ? lines[i - 1] : "";
        if (EXEMPT_RE.test(prev) || EXEMPT_RE.test(lines[i])) continue;
        violations.push(`${path.relative(ROOT, file)}:${i + 1}`);
      }
    }
  }
} catch (err) {
  console.error(`[check-scheduler-single-flight] error: ${err?.message ?? err}`);
  process.exit(2);
}

if (violations.length > 0) {
  console.error(
    `[check-scheduler-single-flight] FAIL — ${violations.length} raw setInterval(async …) callsite(s):`
  );
  for (const v of violations) console.error(`    ${v}`);
  console.error(
    "Wrap the tick in withSingleFlight (server/lib/single-flight.ts), or add a\n" +
      "`// single-flight-ok: <reason>` comment above the line if the tick is provably overlap-safe."
  );
  process.exit(1);
}

console.log("[check-scheduler-single-flight] OK — no raw setInterval(async …) schedulers.");
process.exit(0);
