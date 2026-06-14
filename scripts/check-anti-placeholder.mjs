#!/usr/bin/env node
/**
 * Anti-placeholder guard (G-AP).
 *
 * Fails CI when AI "suggestion" scaffolding, comment-only stub modules, or a
 * client entry root with no default export get committed — the exact regression
 * class that replaced client/src/App.tsx and MobileReadinessShared.tsx with
 * placeholder comments (reverted in 5f1753d4) and produced a white-screen boot
 * that still type-checked.
 *
 * Three hard checks (0 is the only acceptable count — these do NOT ratchet):
 *   1. placeholderMarkers      unambiguous AI-leftover phrases in source
 *                              (e.g. "[full improved code here …]",
 *                              "See next file update suggestion in the response",
 *                              "Phase N … integration example").
 *   2. commentOnlyModules      a client/src .ts/.tsx whose every non-blank line
 *                              is a comment — i.e. a stub committed as a module.
 *   3. entryRootDefaultExport  every LOCAL module default-imported by
 *                              client/src/main.tsx must expose `export default`
 *                              (renders `<App/>` — undefined here = white screen).
 *
 * Usage:
 *   node scripts/check-anti-placeholder.mjs            # check (CI)
 *   node scripts/check-anti-placeholder.mjs --list     # print every hit
 *
 * Exit codes: 0 clean · 1 violation · 2 config error
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const MARKER_DIRS = ["client/src", "server", "shared"];
const COMMENT_ONLY_DIR = "client/src"; // SPA only: a comment-only module = white screen
const ENTRY = "client/src/main.tsx";
const ALIAS_PREFIX = "@/";
const ALIAS_TARGET = "client/src/";
const RESOLVE_EXTS = [".tsx", ".ts", ".jsx", ".js", ".mts", ".cts"];

const MARKERS = [
  { id: "fullCodeHere", re: /\[\s*full\b[^\]]*\bhere\b[^\]]*\]/i },
  { id: "codeHereBasedOn", re: /\bcode here based on\b/i },
  { id: "nextFileSuggestion", re: /see next file update suggestion/i },
  { id: "integrationExample", re: /\bphase\s+\d+\b[^\n]*\bintegration example\b/i },
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
    } else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

const rel = (f) => path.relative(ROOT, f).replace(/\\/g, "/");

/** True only when the file has ≥1 line and every non-blank line is a comment. */
function isCommentOnly(src) {
  let sawComment = false;
  let inBlock = false;
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    if (inBlock) {
      sawComment = true;
      if (line.includes("*/")) {
        inBlock = false;
        if (line.slice(line.indexOf("*/") + 2).trim() !== "") return false;
      }
      continue;
    }
    if (line.startsWith("//") || line.startsWith("*")) {
      sawComment = true;
      continue;
    }
    if (line.startsWith("/*")) {
      sawComment = true;
      if (!line.includes("*/")) inBlock = true;
      else if (line.slice(line.indexOf("*/") + 2).trim() !== "") return false;
      continue;
    }
    return false; // a real line of code
  }
  return sawComment;
}

/** `import X from "..."` (also `import X, { ... } from "..."`). */
function findDefaultImports(src) {
  const out = [];
  const re = /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push({ name: m[1], spec: m[2] });
  return out;
}

function resolveSpec(spec, fromFile) {
  let base;
  if (spec.startsWith(ALIAS_PREFIX)) {
    base = path.join(ROOT, ALIAS_TARGET, spec.slice(ALIAS_PREFIX.length));
  } else if (spec.startsWith("./") || spec.startsWith("../")) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null; // bare package import — not our concern
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of RESOLVE_EXTS) if (fs.existsSync(base + ext)) return base + ext;
  for (const ext of RESOLVE_EXTS) {
    const idx = path.join(base, `index${ext}`);
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

function hasDefaultExport(src) {
  return (
    /export\s+default\b/.test(src) ||
    /export\s*\{[^}]*\bas\s+default\b[^}]*\}/.test(src) ||
    /export\s*\{\s*default\s*\}/.test(src)
  );
}

function main() {
  const listOnly = process.argv.includes("--list");
  const violations = [];

  for (const dir of MARKER_DIRS) {
    const wantCommentOnly = dir === COMMENT_ONLY_DIR;
    for (const file of walk(path.join(ROOT, dir))) {
      const src = fs.readFileSync(file, "utf8");
      const lines = src.split("\n");
      for (const mk of MARKERS) {
        if (!mk.re.test(src)) continue;
        const line = lines.findIndex((l) => mk.re.test(l)) + 1;
        violations.push({ kind: "placeholderMarker", id: mk.id, file: rel(file), line });
      }
      if (wantCommentOnly && /\.(ts|tsx|jsx)$/.test(file) && isCommentOnly(src)) {
        violations.push({ kind: "commentOnlyModule", file: rel(file), line: 1 });
      }
    }
  }

  const entryPath = path.join(ROOT, ENTRY);
  if (!fs.existsSync(entryPath)) {
    console.error(`[anti-placeholder] entry not found: ${ENTRY}`);
    process.exit(2);
  }
  for (const { name, spec } of findDefaultImports(fs.readFileSync(entryPath, "utf8"))) {
    const target = resolveSpec(spec, entryPath);
    if (!target) continue;
    if (!hasDefaultExport(fs.readFileSync(target, "utf8"))) {
      violations.push({
        kind: "missingDefaultExport",
        file: rel(target),
        line: 1,
        detail: `default-imported as '${name}' by ${ENTRY} but has no \`export default\``,
      });
    }
  }

  if (listOnly || violations.length > 0) {
    for (const v of violations) {
      console.error(
        `  ${v.file}:${v.line}  ${v.kind}${v.id ? `(${v.id})` : ""}${v.detail ? ` — ${v.detail}` : ""}`
      );
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n❌ anti-placeholder: ${violations.length} violation(s). Placeholder scaffolding, ` +
        `comment-only modules, and a root without a default export must not ship.`
    );
    process.exit(1);
  }
  console.log(
    "✓ anti-placeholder OK — no stub scaffolding, comment-only modules, or missing root default export."
  );
}

main();
