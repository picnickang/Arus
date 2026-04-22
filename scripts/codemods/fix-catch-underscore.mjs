#!/usr/bin/env node
/**
 * Codemod: catch (_error) → catch
 *
 * Purpose: remove the underscore prefix from catch bindings and, where
 * the error is genuinely unused, use the bare `catch {}` syntax (ES2019).
 * This keeps the code's behavior EXACTLY the same but makes the intent
 * clearer: "I'm intentionally ignoring errors here."
 *
 * Why not "add a logger call"?
 *   Because we don't know, for each call site, whether adding a log
 *   would:
 *     - Flood logs during normal operation (e.g., in retry loops)
 *     - Leak information to logs that shouldn't be there
 *     - Change performance characteristics
 *   The conservative transformation preserves behavior. Adding proper
 *   logging is a separate, per-site decision the engineer should make.
 *
 * Transformations:
 *
 *   BEFORE:                          AFTER:
 *     try { ... }                       try { ... }
 *     catch (_error) { }                catch { }
 *
 *     try { ... }                       try { ... }
 *     catch (_error) {                  catch {
 *       return null;                      return null;
 *     }                                 }
 *
 *     try { ... }                       (UNCHANGED — bails out)
 *     catch (_error) {
 *       console.log(_error);  // _error is referenced!
 *     }
 *
 * Usage:
 *   node codemods/fix-catch-underscore.mjs --dry-run   # Preview
 *   node codemods/fix-catch-underscore.mjs --apply     # Write changes
 *
 * Exit codes:
 *   0 — completed (dry-run or applied)
 *   2 — error during scan
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Codemod lives at scripts/codemods/, so repo root is two levels up.
const ROOT = resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const MODE = args.includes("--apply") ? "apply" : "dry-run";

if (!args.includes("--apply") && !args.includes("--dry-run")) {
  console.error("Specify --dry-run or --apply");
  process.exit(2);
}

// ============================================================================
// Find candidate files
// ============================================================================

function findCandidateFiles() {
  const cmd = `grep -rlE "catch\\s*\\(\\s*_" --include="*.ts" --include="*.tsx" server client shared 2>/dev/null || true`;
  const out = execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
  if (!out) return [];
  return out
    .split("\n")
    .filter(Boolean)
    .map((p) => resolve(ROOT, p));
}

// ============================================================================
// Transform a single file
// ============================================================================

/**
 * Match a catch clause with an underscore-prefixed binding.
 * Captures:
 *   1: the binding name (e.g. "_error", "_e", "_err")
 *
 * We use a careful regex that:
 *   - Only matches names starting with underscore followed by word chars
 *   - Captures optional type annotation (TypeScript: `catch (_error: unknown)`)
 *   - Is line-anchored to avoid accidental matches inside strings/comments
 *     — not perfect, but combined with the "binding is unused" check below,
 *     false positives should be rare.
 *
 * Known limitations (documented, acceptable):
 *   - Doesn't handle the extreme case of `_error` appearing inside a nested
 *     string that looks like code. Mitigated by the "binding unused" check.
 *   - Doesn't transform `catch (error: unknown)` with non-underscore names
 *     (out of scope).
 */
const CATCH_RE = /catch\s*\(\s*(_\w+)(?:\s*:\s*[^)]+)?\s*\)\s*\{/g;

/**
 * Find the matching closing brace for an opening `{` at position start.
 * Returns the index of the closing `}`, or -1 if unbalanced.
 *
 * Handles strings (', ", `) and comments (// and /* *\/) to avoid false
 * matches on braces inside those.
 */
function findMatchingBrace(src, start) {
  let depth = 1;
  let i = start + 1;

  while (i < src.length && depth > 0) {
    const ch = src[i];

    // Line comment
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl + 1;
      continue;
    }
    // Block comment
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    // Strings — skip over content
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }

    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }

  return depth === 0 ? i - 1 : -1;
}

/**
 * Decide if a catch body actually uses the error binding.
 * Returns true if the binding name appears outside strings/comments.
 */
function bodyUsesBinding(body, binding) {
  // Simple approach: strip strings and comments, then search.
  let stripped = body;

  // Strip line comments
  stripped = stripped.replace(/\/\/[^\n]*/g, "");
  // Strip block comments
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip template literals (crude but good enough here)
  stripped = stripped.replace(/`(?:[^`\\]|\\[\s\S])*`/g, "");
  // Strip string literals
  stripped = stripped.replace(/"(?:[^"\\]|\\[\s\S])*"/g, "");
  stripped = stripped.replace(/'(?:[^'\\]|\\[\s\S])*'/g, "");

  // Word boundary match — `_error` should not match `_errorish`
  const re = new RegExp(`\\b${binding}\\b`);
  return re.test(stripped);
}

function transformFile(filePath) {
  const src = readFileSync(filePath, "utf8");
  const transformations = [];

  CATCH_RE.lastIndex = 0;
  let m;
  while ((m = CATCH_RE.exec(src)) !== null) {
    const matchText = m[0]; // e.g. `catch (_error) {`
    const binding = m[1]; // e.g. `_error`
    const openBraceIdx = m.index + matchText.length - 1;
    const closeBraceIdx = findMatchingBrace(src, openBraceIdx);

    if (closeBraceIdx === -1) {
      // Unbalanced — skip this match, don't fail the whole file
      transformations.push({
        matchText,
        reason: "Unbalanced braces — bailing out",
        skip: true,
        line: lineOf(src, m.index),
      });
      continue;
    }

    const body = src.slice(openBraceIdx + 1, closeBraceIdx);

    if (bodyUsesBinding(body, binding)) {
      // Binding is used — this isn't a true "discarded error" case.
      // Recording the skip means the dry-run report is complete.
      transformations.push({
        matchText,
        reason: `Binding ${binding} is referenced in body — skipping`,
        skip: true,
        line: lineOf(src, m.index),
      });
      continue;
    }

    // Transform: `catch (_error) {` → `catch {`
    // (and `catch (_error: unknown) {` → `catch {`)
    const replacement = "catch {";
    transformations.push({
      matchText,
      replacement,
      reason: `Unused error binding — simplifying to bare catch`,
      skip: false,
      matchIdx: m.index,
      matchEnd: m.index + matchText.length,
      line: lineOf(src, m.index),
    });
  }

  if (transformations.length === 0) return { filePath, transformations: [], newSrc: src };

  // Apply transformations from last to first so indices stay valid
  const toApply = transformations.filter((t) => !t.skip).sort((a, b) => b.matchIdx - a.matchIdx);
  let newSrc = src;
  for (const t of toApply) {
    newSrc = newSrc.slice(0, t.matchIdx) + t.replacement + newSrc.slice(t.matchEnd);
  }

  return { filePath, transformations, newSrc, changed: toApply.length > 0 };
}

function lineOf(src, idx) {
  return src.slice(0, idx).split("\n").length;
}

// ============================================================================
// Run over all candidate files
// ============================================================================

const files = findCandidateFiles();
if (files.length === 0) {
  console.log("No candidate files found.");
  process.exit(0);
}

console.log(`Scanning ${files.length} candidate files...`);
console.log("");

let totalFiles = 0;
let totalApplied = 0;
let totalSkipped = 0;
let fileChanges = [];

for (const filePath of files) {
  const result = transformFile(filePath);
  const applied = result.transformations.filter((t) => !t.skip).length;
  const skipped = result.transformations.filter((t) => t.skip).length;

  if (applied === 0 && skipped === 0) continue;

  totalFiles++;
  totalApplied += applied;
  totalSkipped += skipped;

  const relPath = filePath.replace(ROOT + "/", "");
  console.log(`${relPath}`);
  for (const t of result.transformations) {
    if (t.skip) {
      console.log(`  line ${t.line}: SKIP — ${t.reason}`);
    } else {
      console.log(`  line ${t.line}: APPLY — "${t.matchText}" → "${t.replacement}"`);
    }
  }
  console.log("");

  if (MODE === "apply" && result.changed) {
    writeFileSync(filePath, result.newSrc, "utf8");
    fileChanges.push(relPath);
  }
}

console.log("=".repeat(70));
console.log(`Mode:      ${MODE}`);
console.log(`Files:     ${totalFiles}`);
console.log(`Applied:   ${totalApplied}`);
console.log(`Skipped:   ${totalSkipped}`);
console.log("=".repeat(70));

if (MODE === "dry-run") {
  console.log("");
  console.log("No changes written. Re-run with --apply to commit.");
} else {
  console.log("");
  console.log(`Modified ${fileChanges.length} files.`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Review with: git diff --stat");
  console.log("  2. Run tests:   npm run test:unit");
  console.log("  3. If green:    git commit -am 'refactor: simplify unused catch bindings'");
}
