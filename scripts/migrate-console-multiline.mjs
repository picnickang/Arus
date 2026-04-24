#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: migrate-console-multiline.mjs <file> [<file>...]");
  process.exit(1);
}

function relImport(filePath) {
  const target = resolve("server/lib/structured-logger");
  const fromDir = dirname(resolve(filePath));
  let rel = relative(fromDir, target);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\\/g, "/");
}

function loggerNameFromPath(filePath) {
  const m = filePath.replace(/\\/g, "/").match(/server\/(.+)\.tsx?$/);
  if (!m) return "Server";
  return m[1]
    .split("/")
    .map((s) => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase()))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(":");
}

// Walk forward from position of "(" to find matching ")"
// Tracks: nested parens/brackets/braces, string literals (', ", `), template
// expression depth ${...}, line comments //, block comments /* */, regex.
function findMatchingParen(src, openIdx) {
  let i = openIdx + 1;
  let parenDepth = 1;
  const stack = []; // 'string-"', 'string-\'', 'template', 'template-expr', 'lcomment', 'bcomment'
  const top = () => stack[stack.length - 1];
  while (i < src.length && parenDepth > 0) {
    const c = src[i];
    const next = src[i + 1];
    const t = top();
    if (t === "lcomment") {
      if (c === "\n") stack.pop();
      i++;
      continue;
    }
    if (t === "bcomment") {
      if (c === "*" && next === "/") {
        stack.pop();
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (t === "string-\"") {
      if (c === "\\") { i += 2; continue; }
      if (c === "\"") { stack.pop(); i++; continue; }
      i++; continue;
    }
    if (t === "string-'") {
      if (c === "\\") { i += 2; continue; }
      if (c === "'") { stack.pop(); i++; continue; }
      i++; continue;
    }
    if (t === "template") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { stack.pop(); i++; continue; }
      if (c === "$" && next === "{") {
        stack.push("template-expr");
        i += 2;
        continue;
      }
      i++; continue;
    }
    if (t === "template-expr") {
      // Behaves like normal code but also tracks closing }
      if (c === "}" ) { stack.pop(); i++; continue; }
      // fall through to normal handling
    }
    // normal code mode
    if (c === "/" && next === "/") { stack.push("lcomment"); i += 2; continue; }
    if (c === "/" && next === "*") { stack.push("bcomment"); i += 2; continue; }
    if (c === "\"") { stack.push("string-\""); i++; continue; }
    if (c === "'") { stack.push("string-'"); i++; continue; }
    if (c === "`") { stack.push("template"); i++; continue; }
    if (c === "{" || c === "[") { stack.push("brace"); i++; continue; }
    if (c === "}" || c === "]") {
      // balance - pop matching
      // but if top is template-expr we already handled above
      // here we just decrement a brace token if present
      if (top() === "brace") stack.pop();
      i++; continue;
    }
    if (c === "(") { parenDepth++; i++; continue; }
    if (c === ")") { parenDepth--; i++; continue; }
    i++;
  }
  return parenDepth === 0 ? i - 1 : -1; // position of matching ')'
}

// Split arg list by top-level commas using same scanner.
function splitArgs(src) {
  const args = [];
  let i = 0;
  let depth = 0;
  const stack = [];
  const top = () => stack[stack.length - 1];
  let start = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    const t = top();
    if (t === "lcomment") {
      if (c === "\n") stack.pop();
      i++; continue;
    }
    if (t === "bcomment") {
      if (c === "*" && next === "/") { stack.pop(); i += 2; continue; }
      i++; continue;
    }
    if (t === "string-\"") {
      if (c === "\\") { i += 2; continue; }
      if (c === "\"") { stack.pop(); i++; continue; }
      i++; continue;
    }
    if (t === "string-'") {
      if (c === "\\") { i += 2; continue; }
      if (c === "'") { stack.pop(); i++; continue; }
      i++; continue;
    }
    if (t === "template") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { stack.pop(); i++; continue; }
      if (c === "$" && next === "{") { stack.push("template-expr"); i += 2; continue; }
      i++; continue;
    }
    if (t === "template-expr") {
      if (c === "}") { stack.pop(); i++; continue; }
    }
    if (c === "/" && next === "/") { stack.push("lcomment"); i += 2; continue; }
    if (c === "/" && next === "*") { stack.push("bcomment"); i += 2; continue; }
    if (c === "\"") { stack.push("string-\""); i++; continue; }
    if (c === "'") { stack.push("string-'"); i++; continue; }
    if (c === "`") { stack.push("template"); i++; continue; }
    if (c === "{" || c === "[" || c === "(") { stack.push("brace"); depth++; i++; continue; }
    if (c === "}" || c === "]" || c === ")") {
      if (top() === "brace") { stack.pop(); depth--; }
      i++; continue;
    }
    if (c === "," && depth === 0 && stack.length === 0) {
      args.push(src.slice(start, i).trim());
      start = i + 1;
      i++;
      continue;
    }
    i++;
  }
  const last = src.slice(start).trim();
  if (last.length > 0 || args.length > 0) args.push(last);
  return args;
}

function migrateFile(filePath) {
  const original = readFileSync(filePath, "utf8");
  let src = original;
  const stats = { migrated: 0, skipped: 0 };

  // Find every console.<level>(  occurrence and try to migrate.
  const out = [];
  let cursor = 0;
  const regex = /console\.(log|info|warn|error|debug)\(/g;
  let m;
  while ((m = regex.exec(src)) !== null) {
    const callStart = m.index;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findMatchingParen(src, openIdx);
    if (closeIdx === -1) {
      stats.skipped++;
      continue;
    }
    const level = m[1];
    const argsSrc = src.slice(openIdx + 1, closeIdx);
    const args = splitArgs(argsSrc);
    // Drop trailing empty arg from trailing comma
    while (args.length && args[args.length - 1] === "") args.pop();

    let replacement = null;

    if (args.length === 0) {
      const lvl = level === "log" ? "info" : level;
      replacement = `logger.${lvl}("")`;
    } else if (args.length === 1) {
      const lvl = level === "log" ? "info" : level;
      const a = args[0];
      // If single arg is not a string literal, wrap as message via String()
      const isString = /^["'`]/.test(a);
      if (isString) {
        replacement = `logger.${lvl}(${a})`;
      } else {
        // Use String coercion to ensure message is a string
        replacement = `logger.${lvl}(String(${a}))`;
      }
    } else if (args.length === 2) {
      const [a0, a1] = args;
      const a0IsString = /^["'`]/.test(a0);
      // If a1 is already a top-level object literal, pass it directly as ctx
      // (avoids ugly { details: { ... } } double-wrap).
      const a1IsObjectLiteral = /^\{[\s\S]*\}$/.test(a1.trim());
      const ctxExpr = a1IsObjectLiteral ? a1 : `{ details: ${a1} }`;
      if (level === "error") {
        if (a0IsString) {
          replacement = `logger.error(${a0}, undefined, ${a1})`;
        } else {
          replacement = `logger.error(String(${a0}), undefined, ${a1})`;
        }
      } else {
        const lvl = level === "log" ? "info" : level;
        if (a0IsString) {
          replacement = `logger.${lvl}(${a0}, ${ctxExpr})`;
        } else {
          replacement = `logger.${lvl}(String(${a0}), ${ctxExpr})`;
        }
      }
    } else {
      // 3+ args: collapse the rest into details array
      const [a0, ...rest] = args;
      const a0IsString = /^["'`]/.test(a0);
      const detailsExpr = `[${rest.join(", ")}]`;
      if (level === "error") {
        // Heuristic: if last arg looks like an Error, treat it as err
        const last = rest[rest.length - 1];
        const looksLikeErr = /\berr(or)?\b|\bex\b|\be\b$/i.test(last);
        if (looksLikeErr && rest.length === 2) {
          const ctx = rest[0];
          if (a0IsString) {
            replacement = `logger.error(${a0}, { details: ${ctx} }, ${last})`;
          } else {
            replacement = `logger.error(String(${a0}), { details: ${ctx} }, ${last})`;
          }
        } else {
          if (a0IsString) {
            replacement = `logger.error(${a0}, { details: ${detailsExpr} })`;
          } else {
            replacement = `logger.error(String(${a0}), { details: ${detailsExpr} })`;
          }
        }
      } else {
        const lvl = level === "log" ? "info" : level;
        if (a0IsString) {
          replacement = `logger.${lvl}(${a0}, { details: ${detailsExpr} })`;
        } else {
          replacement = `logger.${lvl}(String(${a0}), { details: ${detailsExpr} })`;
        }
      }
    }

    out.push(src.slice(cursor, callStart));
    out.push(replacement);
    cursor = closeIdx + 1;
    stats.migrated++;
    // Reset regex lastIndex to keep scanning original src linearly
    regex.lastIndex = closeIdx + 1;
  }
  out.push(src.slice(cursor));
  src = out.join("");

  if (src === original) {
    return { filePath, changed: false, stats };
  }

  // Add import for createLogger if not present
  if (!/from\s+["'][^"']*structured-logger["']/.test(src)) {
    const importPath = relImport(filePath);
    const loggerName = loggerNameFromPath(filePath);
    const importLine = `import { createLogger } from "${importPath}";\nconst logger = createLogger("${loggerName}");\n`;

    // Insert before the first import (safer — never lands inside multi-line block).
    const firstImport = src.search(/^import\s/m);
    if (firstImport !== -1) {
      src = src.slice(0, firstImport) + importLine + src.slice(firstImport);
    } else {
      src = importLine + src;
    }
  }

  writeFileSync(filePath, src);
  return { filePath, changed: true, stats };
}

const results = files.map(migrateFile);
let totalMig = 0, totalSkip = 0;
for (const r of results) {
  const { filePath, changed, stats } = r;
  totalMig += stats.migrated;
  totalSkip += stats.skipped;
  console.log(
    `${changed ? "✓" : "·"} ${filePath}: migrated=${stats.migrated} skipped=${stats.skipped}`
  );
}
console.log(`---\ntotal migrated=${totalMig} skipped=${totalSkip}`);
