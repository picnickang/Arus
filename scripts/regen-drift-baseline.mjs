#!/usr/bin/env node
/**
 * Regenerates scripts/drift-baseline.json from the current validator state.
 * Run after intentional schema changes or validator improvements.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Re-import the helpers from validate-dual-schema by sourcing it textually.
// Simpler: duplicate the minimal logic we need here.

const PG_TYPES =
  "text|varchar|integer|boolean|timestamp|real|numeric|serial|uuid|jsonb|json|bigint|smallint|doublePrecision|char|decimal|date|time|interval|blob|customType";
const SQLITE_TYPES = "text|integer|real|blob|numeric";
const ALL_TYPES = [...new Set([...PG_TYPES.split("|"), ...SQLITE_TYPES.split("|")])].join("|");

const PG_TO_NORMALIZED = {
  varchar: "text", text: "text", char: "text",
  integer: "integer", serial: "integer", bigint: "integer", smallint: "integer", boolean: "integer",
  real: "real", numeric: "real", decimal: "real", doublePrecision: "real",
  timestamp: "timestamp", date: "timestamp", time: "text", interval: "text",
  json: "text", jsonb: "text", uuid: "text", blob: "blob", customType: "text",
  timestampInt: "timestamp",
};
const normalizeType = (t) => PG_TO_NORMALIZED[t] || t;

function extractColumns(src) {
  const tables = {};
  const headerRe =
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable)\s*\(\s*["'](\w+)["']\s*,\s*\{/gm;
  let header;
  while ((header = headerRe.exec(src)) !== null) {
    const [varName, tableName] = [header[1], header[2]];
    const openBrace = header.index + header[0].length - 1;
    let depth = 0, end = -1;
    for (let i = openBrace; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) { end = i; break; }
    }
    if (end === -1) continue;
    const body = src.slice(openBrace, end + 1);
    const cols = new Map();
    const colRe = new RegExp(`(\\w+)\\s*:\\s*(${ALL_TYPES})\\s*\\(`, "g");
    let cm;
    while ((cm = colRe.exec(body)) !== null) {
      const [, name, type] = cm;
      const openIdx = cm.index + cm[0].length - 1;
      let d = 0, args = "";
      for (let i = openIdx; i < body.length; i++) {
        if (body[i] === "(") d++;
        else if (body[i] === ")") { d--; if (d === 0) { args = body.slice(openIdx + 1, i); break; } }
      }
      let eff = type;
      if (type === "integer" && /mode\s*:\s*["']timestamp["']/.test(args)) eff = "timestampInt";
      cols.set(name, eff);
    }
    tables[varName] = { tableName, columns: cols };
  }
  return tables;
}

function scanDir(dir) {
  if (!existsSync(dir)) return {};
  const out = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))) {
    Object.assign(out, extractColumns(readFileSync(join(dir, f), "utf8")));
  }
  return out;
}

// Read schema-runtime.ts to find paired tables (mirrors validate-dual-schema.mjs).
const runtimeSrc = readFileSync(resolve(root, "shared/schema-runtime.ts"), "utf8");
const switchedPairs = [];
for (const line of runtimeSrc.split("\n")) {
  const exportMatch = line.match(/^export const (\w+)\s*=/);
  if (!exportMatch) continue;
  const name = exportMatch[1];
  const isSwitched =
    line.includes("isLocalMode ?") ||
    line.includes("isEmbedded ?") ||
    line.includes("IS_POSTGRES ?") ||
    line.includes("IS_SQLITE ?");
  if (!isSwitched) continue;
  const pgMatch = line.match(/pgSchema\.(\w+)/);
  const sqliteMatch = line.match(/(?:sqliteVessel|sqliteSync)\.(\w+)/);
  if (pgMatch && sqliteMatch) {
    switchedPairs.push({ name, pgExport: pgMatch[1], sqliteExport: sqliteMatch[1] });
  }
}

const pgTables = scanDir(resolve(root, "shared/schema"));
const sqliteTables = scanDir(resolve(root, "shared/sqlite-schema"));
const ALLOWLIST = new Set(["createdAt", "updatedAt", "deletedAt"]);

const columnDrift = {};
const missingTables = [];
for (const pair of switchedPairs) {
  const pg = pgTables[pair.pgExport];
  const sq = sqliteTables[pair.sqliteExport];
  if (pg && !sq) { missingTables.push(pair.name); continue; }
  if (!pg && sq) { missingTables.push(pair.name); continue; }
  if (!pg || !sq || pg.columns.size === 0 || sq.columns.size === 0) continue;
  const pgCols = new Set(pg.columns.keys());
  const sqCols = new Set(sq.columns.keys());
  const pgOnly = [...pgCols].filter((c) => !sqCols.has(c) && !ALLOWLIST.has(c)).sort();
  const sqliteOnly = [...sqCols].filter((c) => !pgCols.has(c) && !ALLOWLIST.has(c)).sort();
  const typeDrift = [];
  for (const [c, pt] of pg.columns) {
    if (ALLOWLIST.has(c)) continue;
    const st = sq.columns.get(c);
    if (!st) continue;
    if (normalizeType(pt) !== normalizeType(st)) typeDrift.push(c);
  }
  typeDrift.sort();
  if (pgOnly.length || sqliteOnly.length || typeDrift.length) {
    const entry = {};
    if (pgOnly.length) entry.pgOnly = pgOnly;
    if (sqliteOnly.length) entry.sqliteOnly = sqliteOnly;
    if (typeDrift.length) entry.typeDrift = typeDrift;
    columnDrift[pair.name] = entry;
  }
}

const out = {
  _comment:
    "Auto-generated baseline of known PG/SQLite drift. Do not edit manually — regenerate with: node scripts/regen-drift-baseline.mjs",
  generatedAt: new Date().toISOString(),
  missingTables: missingTables.sort(),
  columnDrift,
};

writeFileSync(resolve(root, "scripts/drift-baseline.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Regenerated baseline: ${Object.keys(columnDrift).length} drifted tables, ${missingTables.length} missing`);
