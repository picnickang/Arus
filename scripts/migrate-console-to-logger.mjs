#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: migrate-console-to-logger.mjs <file> [<file>...]");
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

function migrateFile(filePath) {
  const original = readFileSync(filePath, "utf8");
  let src = original;
  const stats = { simple: 0, twoArg: 0, errArg: 0, skipped: 0 };

  // Remove BOM/handle
  // Pattern A: console.X("...") or console.X(`...`)  (single arg, no comma)
  src = src.replace(
    /console\.(log|info|warn|error|debug)\(\s*((?:"(?:[^"\\]|\\.)*"|`(?:[^`\\$]|\\.|\$\{[^}]*\})*`))\s*\)/g,
    (_, level, str) => {
      stats.simple++;
      const lvl = level === "log" ? "info" : level;
      return `logger.${lvl}(${str})`;
    }
  );

  // Pattern B: console.error("...", err) -> logger.error("...", undefined, err)
  src = src.replace(
    /console\.error\(\s*((?:"(?:[^"\\]|\\.)*"|`(?:[^`\\$]|\\.|\$\{[^}]*\})*`))\s*,\s*([^()]+?)\s*\)/g,
    (_, str, expr) => {
      stats.errArg++;
      return `logger.error(${str}, undefined, ${expr})`;
    }
  );

  // Pattern C: console.warn("...", expr) -> logger.warn("...", { details: expr })
  src = src.replace(
    /console\.warn\(\s*((?:"(?:[^"\\]|\\.)*"|`(?:[^`\\$]|\\.|\$\{[^}]*\})*`))\s*,\s*([^()]+?)\s*\)/g,
    (_, str, expr) => {
      stats.twoArg++;
      return `logger.warn(${str}, { details: ${expr} })`;
    }
  );

  // Pattern D: console.log("...", expr) -> logger.info("...", { details: expr })
  src = src.replace(
    /console\.(log|info|debug)\(\s*((?:"(?:[^"\\]|\\.)*"|`(?:[^`\\$]|\\.|\$\{[^}]*\})*`))\s*,\s*([^()]+?)\s*\)/g,
    (_, level, str, expr) => {
      stats.twoArg++;
      const lvl = level === "log" ? "info" : level;
      return `logger.${lvl}(${str}, { details: ${expr} })`;
    }
  );

  // Count remaining console.* calls (these need manual review)
  const remaining = (src.match(/console\.(log|info|warn|error|debug)\(/g) || []).length;
  stats.skipped = remaining;

  if (src === original) {
    return { filePath, changed: false, stats };
  }

  // Add import for createLogger if not present
  if (!/from\s+["'][^"']*structured-logger["']/.test(src)) {
    const importPath = relImport(filePath);
    const loggerName = loggerNameFromPath(filePath);
    const importLine = `import { createLogger } from "${importPath}";\nconst logger = createLogger("${loggerName}");\n`;

    // Insert after the last top-level import
    const importBlock = src.match(/((?:^import [^\n]+\n)+)/m);
    if (importBlock) {
      src = src.replace(importBlock[0], importBlock[0] + importLine);
    } else {
      src = importLine + src;
    }
  }

  writeFileSync(filePath, src);
  return { filePath, changed: true, stats };
}

const results = files.map(migrateFile);
for (const r of results) {
  const { filePath, changed, stats } = r;
  console.log(
    `${changed ? "✓" : "·"} ${filePath}: simple=${stats.simple} twoArg=${stats.twoArg} errArg=${stats.errArg} remaining=${stats.skipped}`
  );
}
