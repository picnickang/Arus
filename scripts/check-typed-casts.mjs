#!/usr/bin/env node
/**
 * check-typed-casts.mjs
 *
 * Anti-hiding ratchet for task #163.
 *
 * Counts typed assertion expressions `… as <ConcreteType>` repo-wide
 * (excluding `as any`, `as unknown`, `as const`, and string/numeric
 * literals already covered by check-cast-burndown). Prevents the
 * common laundering pattern where `as any` is removed by replacing it
 * with `as ConcreteType` at the same callsite — which silences the
 * compiler without verifying the shape.
 *
 * The repo-wide total is stored in scripts/typed-casts-baseline.json
 * with monotonic-decrease semantics. Each subsequent burndown task
 * (#164 → #167) must reduce this number; --update writes a new floor.
 *
 * Usage:
 *   node scripts/check-typed-casts.mjs           # check vs baseline
 *   node scripts/check-typed-casts.mjs --update  # ratchet baseline down
 *   node scripts/check-typed-casts.mjs --list    # show every match
 *
 * Exit codes:
 *   0  current <= baseline
 *   1  current > baseline (regression)
 *   2  script/IO error
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(__dirname, "typed-casts-baseline.json");
const SCAN_DIRS = ["shared", "server", "client/src"];

// Matches `as <TypeName>` and `as <TypeName<...>` and `as <Type>[]` but
// EXCLUDES `as any`, `as unknown`, `as const`, `as never`, and string/
// numeric/boolean literal coercions (`as 'foo'`, `as 0`, `as true`).
// Excludes `as unknown as X` chains (counted by check-cast-burndown).
//
// Two-pass strategy keeps the regex tractable:
//   - Pass 1: find `\bas\s+([A-Za-z_$][\w$]*)` candidate positions.
//   - Pass 2: filter out blacklisted keywords.
const CANDIDATE_RE = /\bas\s+([A-Za-z_$][\w$]*)/g;
const EXCLUDED_TARGETS = new Set(["any", "unknown", "const", "never"]);

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

function stripCommentsAndStrings(src) {
  // Very lightweight stripper; good enough to suppress `as Foo` inside
  // `//` and `/* */` comments and inside `'…'`, `"…"`, and `` `…` ``
  // strings. False-negatives are acceptable (undercount) — we just want
  // to avoid false-positives.
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      out += " ";
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i++;
          break;
        }
        // template-literal expression: keep contents (rare to contain `as Foo`)
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function countFile(file) {
  let body;
  try {
    body = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const stripped = stripCommentsAndStrings(body);
  const matches = [];
  CANDIDATE_RE.lastIndex = 0;
  let m;
  while ((m = CANDIDATE_RE.exec(stripped)) !== null) {
    const target = m[1];
    if (EXCLUDED_TARGETS.has(target)) continue;
    // Skip if the preceding token is also `as` — handles `as unknown as X`
    // (counted by check-cast-burndown).
    const before = stripped.slice(Math.max(0, m.index - 16), m.index);
    if (/\bas\s+unknown\s*$/.test(before)) continue;
    // Skip target names that start lowercase (likely identifier like
    // `… as foo` which is rare but possible in tagged template names).
    if (!/^[A-Z]/.test(target)) continue;
    matches.push({ file, index: m.index, target });
  }
  return matches;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const update = args.has("--update");
  const list = args.has("--list");

  let total = 0;
  const perFile = new Map();
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const m = countFile(file);
      if (m.length) {
        const rel = path.relative(ROOT, file).replace(/\\/g, "/");
        perFile.set(rel, m.length);
        total += m.length;
        if (list) {
          for (const hit of m) console.log(`${rel}: as ${hit.target}`);
        }
      }
    }
  }

  let baseline = {};
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    } catch (err) {
      console.error(`[check-typed-casts] failed to parse baseline: ${err.message}`);
      process.exit(2);
    }
  }
  const allowed = baseline.total ?? Number.POSITIVE_INFINITY;

  if (update) {
    const next = {
      $note:
        "Monotonic-decrease ratchet for typed `as <ConcreteType>` casts. Drops each task; do not raise. Excludes `as any`, `as unknown as X`, `as const`, `as never`, and string/numeric literal coercions (those are tracked elsewhere or harmless).",
      generatedAt: new Date().toISOString(),
      total,
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
    console.log(`[check-typed-casts] baseline updated: total=${total}`);
    return;
  }

  if (total > allowed) {
    console.error("");
    console.error(
      `RATCHET REGRESSION: typed casts increased from baseline ${allowed} to ${total}.`,
    );
    console.error(
      "New `as <Type>` assertions were added. Replace with a Zod parse, type guard, or fix the underlying signature so the cast is unnecessary.",
    );
    console.error("Top files:");
    const top = [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [f, c] of top) console.error(`  ${c.toString().padStart(4)} ${f}`);
    process.exit(1);
  }

  console.log(
    `[check-typed-casts] OK — ${total} typed casts (baseline ${allowed === Number.POSITIVE_INFINITY ? "n/a" : allowed}).`,
  );
}

try {
  main();
} catch (err) {
  console.error("[check-typed-casts] error:", err);
  process.exit(2);
}
