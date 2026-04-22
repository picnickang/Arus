#!/usr/bin/env node
/**
 * One-shot mechanical fix for the "discarded catch binding" bug pattern.
 *
 * Pattern:    } catch {
 *               doSomething(error);   // TS2304: Cannot find name 'error'
 *             }
 *
 * Fix:        } catch (error) {
 *               doSomething(error);
 *             }
 *
 * Strategy:
 *   1. Run `tsc --noEmit` and parse TS2304 lines for `error` / `e` / `err`.
 *   2. Group by file. For each (file, missingName, lineNumber):
 *        - Walk backwards from `lineNumber` to find the nearest enclosing
 *          `catch {` (no binding). Stop at any `function`, `=>`, or
 *          `class`/method boundary (column-0 `}`).
 *        - If found, rewrite that line to `catch (missingName) {`.
 *      Each catch is rewritten only once even if the body has multiple
 *      references to the missing name.
 *   3. Print a summary; do not run the formatter.
 *
 * Skips:
 *   - `catch (otherName) {` blocks where the body uses a *different*
 *     name — those are real misnamings that need human review.
 *   - Catch lines that already have any binding.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TARGET_NAMES = new Set(["error", "e", "err"]);

let tscOutput = "";
try {
  tscOutput = execSync("npx tsc --noEmit 2>&1", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (e) {
  tscOutput = e.stdout?.toString() ?? "";
}

const ts2304 = tscOutput
  .split("\n")
  .map((line) => {
    const m = line.match(/^(.+?)\((\d+),\d+\): error TS2304: Cannot find name '([^']+)'\.$/);
    if (!m) return null;
    const [, file, lineStr, name] = m;
    if (!TARGET_NAMES.has(name)) return null;
    return { file, line: Number(lineStr), name };
  })
  .filter(Boolean);

const byFile = new Map();
for (const err of ts2304) {
  if (!byFile.has(err.file)) byFile.set(err.file, []);
  byFile.get(err.file).push(err);
}

let totalRewrites = 0;
let totalSkipped = 0;
const summary = [];

for (const [file, errs] of byFile) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const rewrittenLines = new Set();

  errs.sort((a, b) => a.line - b.line);

  for (const err of errs) {
    // tsc lines are 1-based
    const errIdx = err.line - 1;

    // Walk backwards to find the nearest `} catch {` (or `catch {` at start
    // of line). Bail if we cross a `function`/arrow/class boundary.
    let foundIdx = -1;
    let depth = 0; // brace depth relative to error line
    for (let i = errIdx; i >= 0 && i > errIdx - 200; i--) {
      const ln = lines[i];
      // Track braces (rough — string/comment safe enough for our codebase).
      // Count from right to left of the line so the catch's opening `{`
      // matches the closing `}` at the end of the body.
      for (let j = ln.length - 1; j >= 0; j--) {
        const ch = ln[j];
        if (ch === "}") depth++;
        else if (ch === "{") {
          if (depth === 0) {
            // This `{` opens the block containing our error reference.
            // Check if it is preceded by `catch ` (no binding) on the same line.
            const before = ln.slice(0, j).trimEnd();
            if (/(^|\s)catch$/.test(before)) {
              foundIdx = i;
              break;
            } else if (/(^|\s)catch\s*\([^)]*\)\s*$/.test(before)) {
              // Already has a binding — different bug, skip.
              foundIdx = -2;
              break;
            } else {
              // Not a catch — we crossed a function/block boundary.
              foundIdx = -3;
              break;
            }
          }
          depth--;
        }
      }
      if (foundIdx !== -1) break;
    }

    if (foundIdx < 0) {
      totalSkipped++;
      continue;
    }
    if (rewrittenLines.has(foundIdx)) {
      // Already fixed by an earlier reference in the same catch.
      continue;
    }

    // Rewrite `catch {` → `catch (name) {` on lines[foundIdx].
    const original = lines[foundIdx];
    const updated = original.replace(/(\s|^)catch\s*\{/, `$1catch (${err.name}) {`);
    if (updated === original) {
      totalSkipped++;
      continue;
    }
    lines[foundIdx] = updated;
    rewrittenLines.add(foundIdx);
    totalRewrites++;
  }

  if (rewrittenLines.size > 0) {
    writeFileSync(file, lines.join("\n"));
    summary.push(`  ${file}: ${rewrittenLines.size} catch block(s) rewritten`);
  }
}

console.log("=== Discarded catch binding fix ===");
console.log(`TS2304 (error|e|err) candidates: ${ts2304.length}`);
console.log(`Catch blocks rewritten:          ${totalRewrites}`);
console.log(`Skipped (no match / boundary):   ${totalSkipped}`);
if (summary.length > 0) {
  console.log("\nFiles changed:");
  for (const s of summary) console.log(s);
}
