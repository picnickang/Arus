#!/usr/bin/env node
/**
 * Dual-DB Schema Guardrail
 *
 * Three-layer validation:
 *   Layer 1 — Export guard: Every table export in schema-runtime.ts uses the
 *             ternary guard pattern (isLocalMode ? sqlite : pg) or is marked
 *             cloud-only.
 *   Layer 2 — Column parity: For every switched table, compares column names
 *             AND normalized types between PG and SQLite definitions.
 *             Uses a column-level baseline (drift-baseline.json) so that new
 *             drift in already-drifted tables is still detected.
 *   Layer 3 — Missing tables: Flags tables present in one schema but absent
 *             from the other (with baseline for pre-existing gaps).
 *
 * Run:  node scripts/validate-dual-schema.mjs
 * Exit: 0 = pass, 1 = drift found
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const errors = [];

// ============================================================================
// Layer 1 — Export guard check
// ============================================================================

const runtimePath = resolve(root, "shared/schema-runtime.ts");
const runtimeSrc = readFileSync(runtimePath, "utf8");

const guardedNames = new Set();
const switchedPairs = [];
const lines = runtimeSrc.split("\n");

const VALID_NAMESPACES = new Set(["pgSchema", "sqliteVessel", "sqliteSync"]);

for (const line of lines) {
  const exportMatch = line.match(/^export const (\w+)\s*=/);
  if (!exportMatch) continue;
  const name = exportMatch[1];

  const isSwitched =
    line.includes("isLocalMode ?") ||
    line.includes("isEmbedded ?") ||
    line.includes("IS_POSTGRES ?") ||
    line.includes("IS_SQLITE ?") ||
    // Helper-based switched exports introduced to compress dual-mode casts:
    //   export const X = pickSchema(isLocalMode, sqliteX.tableY, pgSchema.tableY);
    //   export const X = cloudOnly(pgSchema.tableY);
    line.includes("pickSchema(") ||
    line.includes("cloudOnly(");

  const isDirectPgExport = line.includes("pgSchema.") && !isSwitched;

  const isConfigConst =
    name === "DEPLOYMENT_MODE" ||
    name === "IS_SQLITE" ||
    name === "IS_POSTGRES" ||
    name === "isLocalMode" ||
    name === "isEmbedded";

  if (isSwitched || isDirectPgExport || isConfigConst) {
    guardedNames.add(name);
  }

  if (isSwitched) {
    const pgMatch = line.match(/pgSchema\.(\w+)/);
    const sqliteMatch = line.match(/(?:sqliteVessel|sqliteSync)\.(\w+)/);
    if (pgMatch && sqliteMatch) {
      switchedPairs.push({ name, pgExport: pgMatch[1], sqliteExport: sqliteMatch[1] });
    }
  }

  const nsRefs = line.matchAll(/(\w+)\.\w+/g);
  for (const nsRef of nsRefs) {
    const ns = nsRef[1];
    if (
      ns === "undefined" ||
      ns === "console" ||
      ns === "process" ||
      ns === "JSON" ||
      ns === "Math"
    )
      continue;
    if (ns === "IS_POSTGRES" || ns === "IS_SQLITE" || ns === "isLocalMode" || ns === "isEmbedded")
      continue;
    if (ns.match(/^[a-z]/) && !VALID_NAMESPACES.has(ns) && ns !== "pgSchema") {
      const isImportedNs = runtimeSrc.includes(`import * as ${ns}`);
      if (!isImportedNs && line.includes(`${ns}.`)) {
        errors.push(
          `Layer 1 — Invalid namespace '${ns}' in export '${name}': not imported in schema-runtime.ts`
        );
      }
    }
  }
}

const exportLineRe = /^export const (\w+)\s*=/gm;
const allExports = [];
let m;
while ((m = exportLineRe.exec(runtimeSrc)) !== null) {
  allExports.push(m[1]);
}

const unguarded = allExports.filter(
  (name) => !guardedNames.has(name) && !name.startsWith("insert") && !name.startsWith("select")
);

if (unguarded.length > 0) {
  errors.push(`Layer 1 — ${unguarded.length} unguarded export(s): ${unguarded.join(", ")}`);
}

// ============================================================================
// Layer 2 — Column parity check for switched tables
// ============================================================================

const PG_TYPES =
  "text|varchar|integer|boolean|timestamp|real|numeric|serial|uuid|jsonb|json|bigint|smallint|doublePrecision|char|decimal|date|time|interval|blob|customType";
const SQLITE_TYPES = "text|integer|real|blob|numeric";
const ALL_TYPES = [...new Set([...PG_TYPES.split("|"), ...SQLITE_TYPES.split("|")])].join("|");

const PG_TO_NORMALIZED = {
  varchar: "text",
  text: "text",
  char: "text",
  integer: "integer",
  serial: "integer",
  bigint: "integer",
  smallint: "integer",
  boolean: "integer",
  real: "real",
  numeric: "real",
  decimal: "real",
  doublePrecision: "real",
  timestamp: "timestamp",
  date: "timestamp",
  time: "text",
  interval: "text",
  json: "text",
  jsonb: "text",
  uuid: "text",
  blob: "blob",
  customType: "text",
  // Synthetic SQLite-side type produced by extractColumnsFromSource when
  // an `integer` column is declared with `mode: "timestamp"`. Treated as
  // semantically equivalent to a PG `timestamp` column.
  timestampInt: "timestamp",
};

function normalizeType(t) {
  return PG_TO_NORMALIZED[t] || t;
}

/**
 * Given a string and the index of an opening `(`, return the substring inside
 * the matching closing `)` (excluding both parens), respecting nested parens.
 * Returns null if no matching `)` is found within the string.
 */
function sliceBalanced(src, openIdx) {
  if (src[openIdx] !== "(") return null;
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

function extractColumnsFromSource(src) {
  const tables = {};
  // Find each `const X = pgTable("name", ` / `sqliteTable("name", ` then
  // brace-balance-match the column body (the non-greedy regex previously
  // truncated mid-column at any inner `}` like `{ mode: "timestamp" }`).
  const tableHeaderRe =
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable)\s*\(\s*["'](\w+)["']\s*,\s*\{/gm;

  let header;
  while ((header = tableHeaderRe.exec(src)) !== null) {
    const varName = header[1];
    const tableName = header[2];
    // `header[0]` ends just past the opening `{` of the column object.
    const openBraceIdx = header.index + header[0].length - 1;
    let depth = 0;
    let endIdx = -1;
    for (let i = openBraceIdx; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx === -1) continue;
    const body = src.slice(openBraceIdx, endIdx + 1);

    const columns = new Map();
    // Match `name: type(` (matches the opening paren only — the body string
    // can be truncated mid-column by the non-greedy body extractor above, so
    // we cannot require the closing `)` in the same regex).
    const colRe = new RegExp(`(\\w+)\\s*:\\s*(${ALL_TYPES})\\s*\\(`, "g");
    let cm;
    while ((cm = colRe.exec(body)) !== null) {
      const [, name, type] = cm;
      // Balance-match the args from the opening paren so we can detect
      // `integer(..., { mode: "timestamp" })` and normalize it to a timestamp.
      const openIdx = cm.index + cm[0].length - 1; // position of `(`
      const args = sliceBalanced(body, openIdx);
      let effective = type;
      if (type === "integer" && args !== null && /mode\s*:\s*["']timestamp["']/.test(args)) {
        effective = "timestampInt";
      }
      columns.set(name, effective);
    }
    tables[varName] = { tableName, columns };
  }
  return tables;
}

function scanSchemaDir(dir) {
  const result = {};
  if (!existsSync(dir)) return result;
  const entries = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  for (const file of entries) {
    const filePath = join(dir, file);
    const src = readFileSync(filePath, "utf8");
    const tables = extractColumnsFromSource(src);
    Object.assign(result, tables);
  }
  return result;
}

const pgDir = resolve(root, "shared/schema");
const sqliteDir = resolve(root, "shared/sqlite-schema");

const pgTables = scanSchemaDir(pgDir);
const sqliteTables = scanSchemaDir(sqliteDir);

const COLUMN_PARITY_ALLOWLIST = new Set(["createdAt", "updatedAt", "deletedAt"]);

const baselinePath = resolve(__dirname, "drift-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const baselineMissing = new Set(baseline.missingTables || []);
const baselineDrift = baseline.columnDrift || {};

function isBaselineDrift(tableName, pgOnly, sqliteOnly, typeDriftCols) {
  const entry = baselineDrift[tableName];
  if (!entry) return false;

  const baselinePgOnly = new Set(entry.pgOnly || []);
  const baselineSqliteOnly = new Set(entry.sqliteOnly || []);
  const baselineTypeDrift = new Set(entry.typeDrift || []);

  const newPgOnly = pgOnly.filter((c) => !baselinePgOnly.has(c));
  const newSqliteOnly = sqliteOnly.filter((c) => !baselineSqliteOnly.has(c));
  const newTypeDrift = typeDriftCols.filter((c) => !baselineTypeDrift.has(c));

  return newPgOnly.length === 0 && newSqliteOnly.length === 0 && newTypeDrift.length === 0;
}

let knownDriftCount = 0;
let newDriftCount = 0;
let missingTableCount = 0;
let pairsChecked = 0;
for (const pair of switchedPairs) {
  const pgDef = pgTables[pair.pgExport];
  const sqliteDef = sqliteTables[pair.sqliteExport];

  if (!pgDef && !sqliteDef) continue;

  if (pgDef && !sqliteDef) {
    if (!baselineMissing.has(pair.name)) {
      missingTableCount++;
      errors.push(
        `Layer 3 — MISSING SQLite table for ${pair.name}: PG has ${pair.pgExport} but no SQLite ${pair.sqliteExport} found`
      );
    }
    continue;
  }
  if (!pgDef && sqliteDef) {
    if (!baselineMissing.has(pair.name)) {
      missingTableCount++;
      errors.push(
        `Layer 3 — MISSING PG table for ${pair.name}: SQLite has ${pair.sqliteExport} but no PG ${pair.pgExport} found`
      );
    }
    continue;
  }

  if (pgDef.columns.size === 0 || sqliteDef.columns.size === 0) continue;

  pairsChecked++;
  const pgColNames = new Set(pgDef.columns.keys());
  const sqliteColNames = new Set(sqliteDef.columns.keys());
  const pgOnly = [...pgColNames].filter(
    (c) => !sqliteColNames.has(c) && !COLUMN_PARITY_ALLOWLIST.has(c)
  );
  const sqliteOnly = [...sqliteColNames].filter(
    (c) => !pgColNames.has(c) && !COLUMN_PARITY_ALLOWLIST.has(c)
  );

  const typeDriftCols = [];
  const typeDriftDetails = [];
  for (const [col, pgType] of pgDef.columns) {
    if (COLUMN_PARITY_ALLOWLIST.has(col)) continue;
    const sqliteType = sqliteDef.columns.get(col);
    if (!sqliteType) continue;
    const pgNorm = normalizeType(pgType);
    const sqliteNorm = normalizeType(sqliteType);
    if (pgNorm !== sqliteNorm) {
      typeDriftCols.push(col);
      typeDriftDetails.push(
        `${col}: PG=${pgType}(→${pgNorm}) vs SQLite=${sqliteType}(→${sqliteNorm})`
      );
    }
  }

  if (pgOnly.length > 0 || sqliteOnly.length > 0 || typeDriftCols.length > 0) {
    if (isBaselineDrift(pair.name, pgOnly, sqliteOnly, typeDriftCols)) {
      knownDriftCount++;
    } else {
      newDriftCount++;
      const newPgOnly = pgOnly.filter((c) => !(baselineDrift[pair.name]?.pgOnly || []).includes(c));
      const newSqliteOnly = sqliteOnly.filter(
        (c) => !(baselineDrift[pair.name]?.sqliteOnly || []).includes(c)
      );
      const newTypeDrift = typeDriftDetails.filter((d) => {
        const col = d.split(":")[0];
        return !(baselineDrift[pair.name]?.typeDrift || []).includes(col);
      });
      const details = [];
      if (newPgOnly.length) details.push(`NEW PG-only cols: ${newPgOnly.join(", ")}`);
      if (newSqliteOnly.length) details.push(`NEW SQLite-only cols: ${newSqliteOnly.join(", ")}`);
      if (newTypeDrift.length) details.push(`NEW type mismatches: ${newTypeDrift.join("; ")}`);
      if (!details.length) {
        if (pgOnly.length) details.push(`PG-only cols: ${pgOnly.join(", ")}`);
        if (sqliteOnly.length) details.push(`SQLite-only cols: ${sqliteOnly.join(", ")}`);
        if (typeDriftDetails.length)
          details.push(`Type mismatches: ${typeDriftDetails.join("; ")}`);
      }
      errors.push(
        `Layer 2 — NEW drift in ${pair.name} (${pgDef.tableName}): ${details.join("; ")}`
      );
    }
  }
}

// ============================================================================
// Report
// ============================================================================

console.log("=== Dual-DB Schema Guardrail ===");
console.log(`Guarded exports:       ${guardedNames.size}`);
console.log(`Switched table pairs:  ${switchedPairs.length}`);
console.log(`Pairs with columns:    ${pairsChecked}`);
console.log(`Known drift (allowed): ${knownDriftCount}`);
console.log(`New drift (blocking):  ${newDriftCount}`);
console.log(`Missing tables:        ${missingTableCount}`);
console.log(`PG tables found:       ${Object.keys(pgTables).length}`);
console.log(`SQLite tables found:   ${Object.keys(sqliteTables).length}`);
console.log(`Total runtime exports: ${allExports.length}`);

if (errors.length > 0) {
  console.log(`\n${errors.length} issue(s) found:`);
  for (const e of errors) {
    console.log(`  ⚠ ${e}`);
  }
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
  process.exit(0);
}
