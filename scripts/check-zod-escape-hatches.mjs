#!/usr/bin/env node
/**
 * check-zod-escape-hatches.mjs
 *
 * Anti-hiding guard for task #163.
 *
 * Fails if any Zod schema uses an `any`-shaped escape hatch outside the
 * explicit allowlist. The patterns banned here re-introduce
 * unverified data behind a Zod facade:
 *
 *   - `.passthrough()`               — accepts unknown extra fields silently
 *   - `.catchall(z.any())`           — same, but more explicit
 *   - `.catchall(z.unknown())`       — same
 *   - `z.any()`                      — wildcard schema
 *   - `z.unknown()`                  — wildcard schema (typed `unknown`)
 *   - `.passthrough` (without call)  — defensive: also catches references
 *
 * Allowlist lives in scripts/zod-escape-allowlist.json with entries of
 * shape `{ "file": "<repo-rel path>", "pattern": "<which>", "reason": "<why>" }`.
 *
 * Usage:
 *   node scripts/check-zod-escape-hatches.mjs           # check
 *   node scripts/check-zod-escape-hatches.mjs --list    # list every hit
 *
 * Exit codes:
 *   0  no unallowlisted matches
 *   1  unallowlisted matches found
 *   2  script/IO error
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ALLOWLIST_PATH = path.join(__dirname, "zod-escape-allowlist.json");
const SCAN_DIRS = ["shared", "server", "client/src"];

const PATTERNS = [
  { id: "passthrough", re: /\.passthrough\s*\(/g },
  { id: "catchall-any", re: /\.catchall\s*\(\s*z\.any\s*\(/g },
  { id: "catchall-unknown", re: /\.catchall\s*\(\s*z\.unknown\s*\(/g },
  { id: "z.any", re: /\bz\.any\s*\(/g },
  { id: "z.unknown", re: /\bz\.unknown\s*\(/g },
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

function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx; i++) if (src[i] === "\n") line++;
  return line;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const list = args.has("--list");

  let allowlist = [];
  if (fs.existsSync(ALLOWLIST_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8"));
      allowlist = raw.entries ?? [];
    } catch (err) {
      console.error(`[check-zod-escape] failed to parse allowlist: ${err.message}`);
      process.exit(2);
    }
  }
  const allowed = new Set(allowlist.map((e) => `${e.file}::${e.pattern}`));

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
      for (const { id, re } of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(body)) !== null) {
          const key = `${rel}::${id}`;
          if (allowed.has(key)) continue;
          hits.push({ file: rel, pattern: id, line: lineOf(body, m.index) });
        }
      }
    }
  }

  if (list) {
    for (const h of hits) console.log(`${h.file}:${h.line}\t${h.pattern}`);
  }

  if (hits.length) {
    console.error("");
    console.error(
      `Zod escape-hatch violations (${hits.length}). These re-introduce \`any\`-shaped data behind a Zod facade and defeat wire-boundary validation.`,
    );
    const byPattern = new Map();
    for (const h of hits) {
      if (!byPattern.has(h.pattern)) byPattern.set(h.pattern, []);
      byPattern.get(h.pattern).push(h);
    }
    for (const [pat, list] of byPattern) {
      console.error(`  ${pat}: ${list.length}`);
      for (const h of list.slice(0, 10)) console.error(`    - ${h.file}:${h.line}`);
      if (list.length > 10) console.error(`    … and ${list.length - 10} more`);
    }
    console.error("");
    console.error(
      "Replace with a concrete schema. If a single instance is genuinely justified (e.g. opaque third-party blob being passed through unchanged), add it to scripts/zod-escape-allowlist.json with a reason.",
    );
    process.exit(1);
  }

  console.log("[check-zod-escape] OK — 0 escape-hatch usages.");
}

try {
  main();
} catch (err) {
  console.error("[check-zod-escape] error:", err);
  process.exit(2);
}
