/**
 * Schema Drift Audit
 *
 * Compares the actual PostgreSQL DB schema against the Drizzle schema definitions
 * in shared/schema/. Reports tables that exist in one but not the other, plus
 * per-table column drift.
 *
 * Outputs a structured Markdown report to .local/schema-drift-report.md
 * Read-only: makes no changes to the DB or to source code.
 */

import { Client } from "pg";
import { getTableColumns, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { writeFileSync, mkdirSync } from "fs";
import * as schema from "../shared/schema/index.js";

type DbColumn = {
  name: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
};
type DbTable = { name: string; columns: Map<string, DbColumn> };

type DrizzleColumn = {
  name: string;
  sqlType: string;
  notNull: boolean;
  hasDefault: boolean;
};
type DrizzleTable = { name: string; columns: Map<string, DrizzleColumn> };

async function dumpDbSchema(): Promise<Map<string, DbTable>> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const tablesRes = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );

  const result = new Map<string, DbTable>();
  for (const row of tablesRes.rows) {
    const colsRes = await client.query<{
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [row.table_name]
    );
    const cols = new Map<string, DbColumn>();
    for (const c of colsRes.rows) {
      cols.set(c.column_name, {
        name: c.column_name,
        dataType: c.data_type === "USER-DEFINED" ? c.udt_name : c.data_type,
        isNullable: c.is_nullable === "YES",
        columnDefault: c.column_default,
      });
    }
    result.set(row.table_name, { name: row.table_name, columns: cols });
  }

  await client.end();
  return result;
}

function dumpDrizzleSchema(): Map<string, DrizzleTable> {
  const result = new Map<string, DrizzleTable>();
  for (const exportName of Object.keys(schema)) {
    const value = (schema as Record<string, unknown>)[exportName];
    if (!value || typeof value !== "object") {continue;}
    // Heuristic: Drizzle table proxies have a Symbol(drizzle:Name) / IsDrizzleTable marker
    let tableName: string;
    try {
      tableName = getTableName(value as PgTable);
    } catch {
      continue;
    }
    if (!tableName || typeof tableName !== "string") {continue;}
    let cols: Record<string, unknown>;
    try {
      cols = getTableColumns(value as PgTable);
    } catch {
      continue;
    }
    const colMap = new Map<string, DrizzleColumn>();
    for (const [, col] of Object.entries(cols)) {
      const c = col as {
        name: string;
        getSQLType?: () => string;
        notNull: boolean;
        hasDefault: boolean;
      };
      const sqlType = typeof c.getSQLType === "function" ? c.getSQLType() : "unknown";
      colMap.set(c.name, {
        name: c.name,
        sqlType,
        notNull: c.notNull,
        hasDefault: c.hasDefault,
      });
    }
    if (result.has(tableName)) {
      // Same table declared twice — record both
      const existing = result.get(tableName)!;
      for (const [k, v] of colMap) {if (!existing.columns.has(k)) {existing.columns.set(k, v);}}
    } else {
      result.set(tableName, { name: tableName, columns: colMap });
    }
  }
  return result;
}

function normalizeDbType(t: string): string {
  const lower = t.toLowerCase();
  return lower
    .replace(/^character varying.*/, "varchar")
    .replace(/^character.*/, "char")
    .replace(/^timestamp.*/, "timestamp")
    .replace(/^time with.*/, "time")
    .replace(/^time without.*/, "time")
    .replace(/^double precision/, "double")
    .replace(/^integer$/, "int")
    .replace(/^smallint$/, "int")
    .replace(/^array$/, "array");
}

function normalizeDrizzleType(t: string): string {
  return t
    .toLowerCase()
    .replace(/^varchar.*/, "varchar")
    .replace(/^text.*/, "text")
    .replace(/^integer/, "int")
    .replace(/^smallint/, "int")
    .replace(/^bigint/, "bigint")
    .replace(/^serial$/, "int")
    .replace(/^bigserial$/, "bigint")
    .replace(/^smallserial$/, "int")
    .replace(/^numeric.*/, "numeric")
    .replace(/^decimal.*/, "numeric")
    .replace(/^timestamp.*/, "timestamp")
    .replace(/^date$/, "date")
    .replace(/^boolean/, "boolean")
    .replace(/^jsonb/, "jsonb")
    .replace(/^json$/, "json")
    .replace(/^real/, "real")
    .replace(/^double precision/, "double")
    .replace(/^vector.*/, "vector");
}

function typesCompatible(dbType: string, drizzleType: string): boolean {
  // Postgres reports any array column as `ARRAY` in information_schema.data_type;
  // any Drizzle column type ending in `[]` is an array and therefore compatible.
  // Check this BEFORE normalization (normalization strips the `[]` suffix).
  if (dbType.toLowerCase() === "array" && drizzleType.toLowerCase().endsWith("[]")) {
    return true;
  }
  const a = normalizeDbType(dbType);
  const b = normalizeDrizzleType(drizzleType);
  if (a === b) {return true;}
  // Common equivalences
  const pairs: Array<[string, string]> = [
    ["timestamp", "timestamp"],
    ["int", "int"],
    ["bigint", "bigint"],
    ["bigint", "int"],
    ["int", "bigint"],
    ["text", "text"],
    ["varchar", "varchar"],
    ["varchar", "text"],
    ["text", "varchar"],
    ["real", "real"],
    ["double", "double"],
    ["double", "real"],
    ["real", "double"],
    ["numeric", "numeric"],
    ["numeric", "real"],
    ["real", "numeric"],
    ["boolean", "boolean"],
    ["jsonb", "jsonb"],
    ["json", "json"],
    ["json", "jsonb"],
    ["jsonb", "json"],
    ["date", "date"],
    ["uuid", "uuid"],
    ["uuid", "varchar"],
    ["varchar", "uuid"],
    ["vector", "vector"],
  ];
  return pairs.some(([x, y]) => a.startsWith(x) && b.startsWith(y));
}

type TableDrift = {
  table: string;
  missingInDb: Array<{ name: string; drizzleType: string; notNull: boolean }>;
  missingInDrizzle: Array<{ name: string; dbType: string; nullable: boolean }>;
  typeMismatches: Array<{
    name: string;
    dbType: string;
    drizzleType: string;
  }>;
  nullabilityMismatches: Array<{
    name: string;
    dbNullable: boolean;
    drizzleNotNull: boolean;
  }>;
};

async function main() {
  console.error("Dumping DB schema…");
  const db = await dumpDbSchema();
  console.error(`  ${db.size} tables in DB`);

  console.error("Introspecting Drizzle schema…");
  const dz = dumpDrizzleSchema();
  console.error(`  ${dz.size} tables in Drizzle`);

  const tablesOnlyInDb: string[] = [];
  const tablesOnlyInDrizzle: string[] = [];
  const tableDrifts: TableDrift[] = [];

  for (const name of db.keys()) {if (!dz.has(name)) {tablesOnlyInDb.push(name);}}
  for (const name of dz.keys()) {if (!db.has(name)) {tablesOnlyInDrizzle.push(name);}}

  for (const [name, dbTable] of db) {
    const dzTable = dz.get(name);
    if (!dzTable) {continue;}
    const drift: TableDrift = {
      table: name,
      missingInDb: [],
      missingInDrizzle: [],
      typeMismatches: [],
      nullabilityMismatches: [],
    };
    for (const [colName, dzCol] of dzTable.columns) {
      const dbCol = dbTable.columns.get(colName);
      if (!dbCol) {
        drift.missingInDb.push({
          name: colName,
          drizzleType: dzCol.sqlType,
          notNull: dzCol.notNull,
        });
        continue;
      }
      if (!typesCompatible(dbCol.dataType, dzCol.sqlType)) {
        drift.typeMismatches.push({
          name: colName,
          dbType: dbCol.dataType,
          drizzleType: dzCol.sqlType,
        });
      }
      if (dbCol.isNullable === dzCol.notNull) {
        // dbNullable=true && drizzleNotNull=true => mismatch
        // dbNullable=false && drizzleNotNull=false => mismatch (drizzle says nullable but db says notNull)
        drift.nullabilityMismatches.push({
          name: colName,
          dbNullable: dbCol.isNullable,
          drizzleNotNull: dzCol.notNull,
        });
      }
    }
    for (const [colName, dbCol] of dbTable.columns) {
      if (!dzTable.columns.has(colName)) {
        drift.missingInDrizzle.push({
          name: colName,
          dbType: dbCol.dataType,
          nullable: dbCol.isNullable,
        });
      }
    }
    if (
      drift.missingInDb.length ||
      drift.missingInDrizzle.length ||
      drift.typeMismatches.length ||
      drift.nullabilityMismatches.length
    ) {
      tableDrifts.push(drift);
    }
  }

  // Severity: tables where Drizzle declares columns that don't exist (queries will crash on real data),
  // or where notNull diverges in a way that breaks inserts.
  const SEVERE = (d: TableDrift) =>
    d.missingInDb.length > 0 ||
    d.typeMismatches.length > 0 ||
    d.nullabilityMismatches.some((m) => m.drizzleNotNull && m.dbNullable);

  const severe = tableDrifts.filter(SEVERE);
  const mild = tableDrifts.filter((d) => !SEVERE(d));

  const lines: string[] = [];
  lines.push("# Schema Drift Audit Report");
  lines.push("");
  lines.push(`- DB tables: **${db.size}**`);
  lines.push(`- Drizzle tables: **${dz.size}**`);
  lines.push(`- Tables present in DB but not in Drizzle: **${tablesOnlyInDb.length}**`);
  lines.push(`- Tables present in Drizzle but not in DB: **${tablesOnlyInDrizzle.length}**`);
  lines.push(`- Tables with column drift: **${tableDrifts.length}**`);
  lines.push(`  - **SEVERE** (Drizzle queries reference phantom columns / will crash): ${severe.length}`);
  lines.push(`  - MILD (only Drizzle missing columns the DB has): ${mild.length}`);
  lines.push("");

  if (tablesOnlyInDrizzle.length) {
    lines.push("## Phantom tables (declared in Drizzle, do NOT exist in DB)");
    lines.push("");
    lines.push("Any code that does `db.select().from(<table>)` against these will fail at runtime.");
    lines.push("");
    for (const n of tablesOnlyInDrizzle) {lines.push(`- \`${n}\``);}
    lines.push("");
  }

  if (tablesOnlyInDb.length) {
    lines.push("## Untyped tables (exist in DB, no Drizzle declaration)");
    lines.push("");
    lines.push("These are accessible only via raw SQL.");
    lines.push("");
    for (const n of tablesOnlyInDb) {lines.push(`- \`${n}\``);}
    lines.push("");
  }

  if (severe.length) {
    lines.push("## SEVERE drift — Drizzle declares columns/types that don't match the DB");
    lines.push("");
    lines.push("These tables will silently or loudly fail when queried through Drizzle.");
    lines.push("");
    for (const d of severe) {
      lines.push(`### \`${d.table}\``);
      if (d.missingInDb.length) {
        lines.push("");
        lines.push(`**Drizzle declares but DB lacks (${d.missingInDb.length}):**`);
        for (const c of d.missingInDb) {
          lines.push(`- \`${c.name}\` (${c.drizzleType}${c.notNull ? ", notNull" : ""})`);
        }
      }
      if (d.typeMismatches.length) {
        lines.push("");
        lines.push(`**Type mismatches (${d.typeMismatches.length}):**`);
        for (const c of d.typeMismatches) {
          lines.push(`- \`${c.name}\`: DB=\`${c.dbType}\` vs Drizzle=\`${c.drizzleType}\``);
        }
      }
      const harmfulNullability = d.nullabilityMismatches.filter(
        (m) => m.drizzleNotNull && m.dbNullable
      );
      if (harmfulNullability.length) {
        lines.push("");
        lines.push(`**Drizzle says notNull but DB allows NULL (${harmfulNullability.length}):**`);
        for (const c of harmfulNullability) {
          lines.push(`- \`${c.name}\``);
        }
      }
      lines.push("");
    }
  }

  if (mild.length) {
    lines.push("## MILD drift — DB has columns Drizzle doesn't declare (or non-harmful null mismatches)");
    lines.push("");
    lines.push("Queries still work; you just can't access the extra columns through typed Drizzle.");
    lines.push("");
    for (const d of mild) {
      const summary: string[] = [];
      if (d.missingInDrizzle.length) {summary.push(`${d.missingInDrizzle.length} cols missing in schema`);}
      const benignNull = d.nullabilityMismatches.filter((m) => !(m.drizzleNotNull && m.dbNullable));
      if (benignNull.length) {summary.push(`${benignNull.length} benign null mismatches`);}
      lines.push(`### \`${d.table}\` — ${summary.join(", ")}`);
      if (d.missingInDrizzle.length) {
        for (const c of d.missingInDrizzle.slice(0, 50)) {
          lines.push(`  - DB has \`${c.name}\` (${c.dbType}${c.nullable ? "" : ", NOT NULL"})`);
        }
        if (d.missingInDrizzle.length > 50) {
          lines.push(`  - …and ${d.missingInDrizzle.length - 50} more`);
        }
      }
      lines.push("");
    }
  }

  try {
    mkdirSync(".local", { recursive: true });
  } catch {}
  writeFileSync(".local/schema-drift-report.md", lines.join("\n"));
  console.error("Wrote .local/schema-drift-report.md");
  console.error(
    `Summary: ${tablesOnlyInDrizzle.length} phantom tables, ${tablesOnlyInDb.length} untyped tables, ${severe.length} severe drifted tables, ${mild.length} mild drifted tables`
  );
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
