#!/usr/bin/env node
/**
 * TimescaleDB Hypertable Initialization (Operator Script)
 *
 * Converts configured tables to TimescaleDB hypertables. This is a DESTRUCTIVE
 * schema migration — it rebuilds the primary key to include the time column.
 *
 * Usage:
 *   node scripts/timescale-init-hypertables.mjs              # dry-run (show plan)
 *   node scripts/timescale-init-hypertables.mjs --apply      # apply on empty tables only
 *   node scripts/timescale-init-hypertables.mjs --apply --force  # apply even if rows exist
 *
 * Pre-requisites:
 *   - TimescaleDB extension installed (CREATE EXTENSION timescaledb)
 *   - DATABASE_URL set
 *
 * Idempotent: re-running is safe — tables already configured as hypertables
 * are skipped.
 */

import pg from "pg";

const TIMESCALE_TABLES = [
  { table: "metrics_history", timeColumn: "recorded_at", chunkInterval: "7 days" },
  { table: "system_performance_metrics", timeColumn: "recorded_at", chunkInterval: "1 day" },
  { table: "error_logs", timeColumn: "timestamp", chunkInterval: "7 days" },
  { table: "compliance_audit_log", timeColumn: "timestamp", chunkInterval: "30 days" },
];

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function isHypertable(table) {
  const res = await client.query(
    `SELECT 1 FROM timescaledb_information.hypertables
     WHERE hypertable_schema = 'public' AND hypertable_name = $1 LIMIT 1`,
    [table]
  );
  return res.rowCount > 0;
}

async function rowCount(table) {
  const res = await client.query(`SELECT COUNT(*)::bigint AS n FROM ${table}`);
  return Number(res.rows[0].n);
}

async function getPkColumns(table) {
  const res = await client.query(
    `SELECT a.attname AS col, c.conname
     FROM pg_constraint c
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.contype = 'p' AND c.conrelid = $1::regclass
     ORDER BY array_position(c.conkey, a.attnum)`,
    [table]
  );
  return { cols: res.rows.map((r) => r.col), name: res.rows[0]?.conname };
}

async function convertOne(cfg) {
  const { table, timeColumn, chunkInterval } = cfg;
  const prefix = `[${table}]`;

  if (await isHypertable(table)) {
    console.log(`${prefix} already a hypertable — skipping`);
    return { table, status: "already-hypertable" };
  }

  const rows = await rowCount(table);
  console.log(`${prefix} not a hypertable; ${rows} row(s) present`);
  if (rows > 0 && !force) {
    console.log(`${prefix} SKIPPED: rows exist and --force not set`);
    return { table, status: "skipped-has-rows" };
  }

  const pk = await getPkColumns(table);
  console.log(`${prefix} current PK (${pk.name}): [${pk.cols.join(", ")}]`);
  const needsPkRebuild = !pk.cols.includes(timeColumn);

  if (!apply) {
    console.log(
      `${prefix} PLAN: ${needsPkRebuild ? `rebuild PK to (${[...pk.cols, timeColumn].join(", ")}), ` : ""}create_hypertable('${table}', '${timeColumn}', chunk_time_interval => INTERVAL '${chunkInterval}')`
    );
    return { table, status: "dry-run" };
  }

  await client.query("BEGIN");
  try {
    if (needsPkRebuild) {
      const newPk = [...pk.cols, timeColumn];
      console.log(`${prefix} rebuilding PK to (${newPk.join(", ")})`);
      await client.query(`ALTER TABLE ${table} DROP CONSTRAINT ${pk.name}`);
      await client.query(`ALTER TABLE ${table} ADD PRIMARY KEY (${newPk.join(", ")})`);
    }
    console.log(`${prefix} creating hypertable...`);
    await client.query(
      `SELECT create_hypertable($1, $2, chunk_time_interval => INTERVAL '${chunkInterval}', migrate_data => true, if_not_exists => true)`,
      [table, timeColumn]
    );
    await client.query("COMMIT");
    console.log(`${prefix} ✓ converted`);
    return { table, status: "converted" };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`${prefix} ✗ FAILED:`, err.message);
    return { table, status: "failed", error: err.message };
  }
}

console.log(`TimescaleDB hypertable initialization (apply=${apply}, force=${force})\n`);

const extRes = await client.query(
  "SELECT installed_version FROM pg_available_extensions WHERE name = 'timescaledb'"
);
if (!extRes.rows[0]?.installed_version) {
  console.error("TimescaleDB extension is not installed. Run: CREATE EXTENSION timescaledb;");
  await client.end();
  process.exit(1);
}
console.log(`TimescaleDB version: ${extRes.rows[0].installed_version}\n`);

const results = [];
for (const cfg of TIMESCALE_TABLES) {
  results.push(await convertOne(cfg));
}

await client.end();

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`  ${r.table}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
}

const failed = results.filter((r) => r.status === "failed");
process.exit(failed.length > 0 ? 1 : 0);
