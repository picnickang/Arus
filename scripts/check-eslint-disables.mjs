#!/usr/bin/env node
/**
 * check-eslint-disables.mjs
 *
 * Anti-hiding guard for task #163.
 *
 * Forbids `eslint-disable` directives targeting any of the type-safety
 * rules that the burndown is enforcing. Per-line, per-file, and global
 * disables for `no-explicit-any`, `no-non-null-assertion`, and any
 * `no-unsafe-*` rule are all banned across server/, shared/, client/src/.
 *
 * Baseline = 0 from day one (no grandfathering). If an existing disable
 * is found, fix the underlying code and delete the directive instead of
 * preserving it under a comment.
 *
 * Usage:
 *   node scripts/check-eslint-disables.mjs           # check
 *   node scripts/check-eslint-disables.mjs --list    # show every hit
 *
 * Exit codes:
 *   0  no banned disables
 *   1  one or more banned disables found
 *   2  script/IO error
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["shared", "server", "client/src"];

// Matches `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`
// followed by anything that mentions one of the banned rule names.
const BANNED_RULES = [
  "@typescript-eslint/no-explicit-any",
  "no-explicit-any",
  "@typescript-eslint/no-non-null-assertion",
  "no-non-null-assertion",
  "@typescript-eslint/no-unsafe-assignment",
  "@typescript-eslint/no-unsafe-member-access",
  "@typescript-eslint/no-unsafe-call",
  "@typescript-eslint/no-unsafe-argument",
  "@typescript-eslint/no-unsafe-return",
];

const DISABLE_RE = /eslint-disable(?:-line|-next-line)?\b([^\n]*)/g;

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
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) {
      yield full;
    }
  }
}

function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx; i++) if (src[i] === "\n") line++;
  return line;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const list = args.has("--list");

  const hits = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      let body;
      try {
        body = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      DISABLE_RE.lastIndex = 0;
      let m;
      while ((m = DISABLE_RE.exec(body)) !== null) {
        const tail = m[1];
        // Bare `eslint-disable` (no rule list) disables everything → banned.
        const bare = !/\S/.test(tail.replace(/\*\/\s*$/, ""));
        const mentionsBanned = BANNED_RULES.some((rule) => tail.includes(rule));
        if (bare || mentionsBanned) {
          hits.push({
            file: rel,
            line: lineOf(body, m.index),
            directive: `eslint-disable${tail}`.trim().slice(0, 120),
          });
        }
      }
    }
  }

  if (list) {
    for (const h of hits) console.log(`${h.file}:${h.line}\t${h.directive}`);
  }

  if (hits.length) {
    console.error("");
    console.error(`Banned eslint-disable directives (${hits.length}):`);
    for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.directive}`);
    console.error("");
    console.error(
      "These rules are part of the type-debt burndown and may not be silenced. Fix the underlying code and remove the directive — no exceptions.",
    );
    process.exit(1);
  }

  console.log("[check-eslint-disables] OK — 0 banned disables.");
}

try {
  main();
} catch (err) {
  console.error("[check-eslint-disables] error:", err);
  process.exit(2);
}
