#!/usr/bin/env node
/**
 * Wave 2.3 — Backup verification harness.
 *
 * The automated companion to §10 of docs/operations/dr-runbook.md
 * (the quarterly DR drill checklist). A backup you've never restored
 * is not a backup — it's a hope. This script turns that hope into a
 * green/red CI signal.
 *
 * What it does:
 *   1. Restores a backup dump (file or fetched from a presigned URL)
 *      into a scratch Postgres database (VERIFY_DATABASE_URL).
 *   2. Asserts schema parity against the live DB: every table that
 *      exists in live must exist in the restore, with the same columns.
 *      (Restore-only tables are allowed — represents post-backup DDL.)
 *   3. Asserts each table's row count is within tolerance of live
 *      (default ±20%; restore is by definition older). Catches
 *      truncated/empty dumps that pg_dump produced "successfully" but
 *      that wouldn't actually restore your tenant data.
 *   4. Spot-checks the canonical anchor tables for non-empty content.
 *   5. Emits a JSON summary report and exits non-zero on any failure
 *      so CI can gate on it.
 *
 * What it deliberately does NOT do:
 *   - Touch the live DB beyond read-only metadata queries.
 *   - Modify the scratch DB schema (it's restored, then read).
 *   - Mutate any backup artefact.
 *   - Run inside the unit/integration runner — this is an operational
 *     job, scheduled separately (cron / GitHub Actions / drill day).
 *
 * Usage:
 *   DATABASE_URL=postgres://...prod-readonly... \
 *   VERIFY_DATABASE_URL=postgres://...scratch... \
 *   BACKUP_PATH=/tmp/latest.dump \
 *     node scripts/dr/verify-backup.mjs
 *
 *   # Or fetch from a presigned URL (S3/GCS/etc):
 *   BACKUP_URL=https://... node scripts/dr/verify-backup.mjs
 *
 * Env vars:
 *   DATABASE_URL              read-only live DB (parity reference)
 *   VERIFY_DATABASE_URL       scratch DB to restore into (will be wiped)
 *   BACKUP_PATH               local path to a pg_dump custom-format file
 *   BACKUP_URL                alternative to BACKUP_PATH; downloaded first
 *   ROW_COUNT_TOLERANCE_PCT   default 20
 *   ANCHOR_TABLES             CSV override (default: vessels, equipment, work_orders)
 *   REPORT_PATH               where to write the JSON summary (default /tmp)
 *   ALLOW_RESTORE_ONLY_TABLES default "true" (set false to fail on extra tables)
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — at least one check failed (report has details)
 *   2 — harness error (couldn't connect, missing inputs, etc.)
 */

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, stat, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const TOLERANCE_PCT = Number(process.env.ROW_COUNT_TOLERANCE_PCT ?? "20");
const ANCHOR_TABLES = (process.env.ANCHOR_TABLES ?? "vessels,equipment,work_orders")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const REPORT_PATH = process.env.REPORT_PATH ?? join(tmpdir(), `backup-verify-${Date.now()}.json`);
const ALLOW_RESTORE_ONLY_TABLES = (process.env.ALLOW_RESTORE_ONLY_TABLES ?? "true") === "true";

function die(code, message, extra) {
  console.error(`[verify-backup] FATAL: ${message}`);
  if (extra) console.error(extra);
  process.exit(code);
}

function log(msg) {
  console.log(`[verify-backup] ${msg}`);
}

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}\n${stderr}`));
    });
  });
}

async function fetchBackup(url, destDir) {
  const dest = join(destDir, "backup.dump");
  log(`Downloading backup from ${url.split("?")[0]}...`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`backup fetch failed: ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
  const st = await stat(dest);
  log(`Downloaded ${(st.size / 1024 / 1024).toFixed(1)} MiB`);
  return dest;
}

async function restoreDump(dumpPath, verifyUrl) {
  log("Wiping scratch DB schema...");
  await run("psql", [
    verifyUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
  ]);
  log(`Restoring ${dumpPath} into scratch DB...`);
  // --no-owner / --no-privileges keep the restore portable across role layouts.
  // Custom format is required; pg_restore will error helpfully if it isn't.
  await run("pg_restore", [
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
    "--dbname",
    verifyUrl,
    dumpPath,
  ]);
  log("Restore complete.");
}

async function listTables(url) {
  const { stdout } = await run("psql", [
    url,
    "-At",
    "-F",
    "|",
    "-c",
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  ]);
  return stdout.split("\n").filter(Boolean);
}

async function columnSignature(url, table) {
  const { stdout } = await run("psql", [
    url,
    "-At",
    "-F",
    "|",
    "-c",
    `SELECT column_name || ':' || data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table.replace(/'/g, "''")}'
     ORDER BY ordinal_position`,
  ]);
  return stdout.split("\n").filter(Boolean).join(",");
}

async function rowCount(url, table) {
  const { stdout } = await run("psql", [
    url,
    "-At",
    "-c",
    `SELECT count(*) FROM "${table.replace(/"/g, '""')}"`,
  ]);
  return Number(stdout.trim());
}

function withinTolerance(live, restored, tolPct) {
  if (live === 0) return restored === 0;
  const drift = Math.abs(live - restored) / live;
  return drift <= tolPct / 100;
}

async function main() {
  const live = process.env.DATABASE_URL;
  const verify = process.env.VERIFY_DATABASE_URL;
  if (!live) die(2, "DATABASE_URL is required (read-only live DB for parity reference)");
  if (!verify) die(2, "VERIFY_DATABASE_URL is required (scratch DB to restore into)");
  if (live === verify)
    die(2, "VERIFY_DATABASE_URL must differ from DATABASE_URL — refusing to restore over live");

  const path = process.env.BACKUP_PATH;
  const url = process.env.BACKUP_URL;
  if (!path && !url) die(2, "Either BACKUP_PATH or BACKUP_URL is required");

  const tmpDir = await mkdtemp(join(tmpdir(), "backup-verify-"));
  let dumpPath = path;
  try {
    if (!dumpPath) dumpPath = await fetchBackup(url, tmpDir);
    const dumpStat = await stat(dumpPath).catch(() => null);
    if (!dumpStat) die(2, `Backup file not found: ${dumpPath}`);
    if (dumpStat.size < 1024)
      die(1, `Backup is suspiciously small (${dumpStat.size} bytes) — refusing to validate`);

    const startedAt = Date.now();
    await restoreDump(dumpPath, verify);
    const restoreSeconds = (Date.now() - startedAt) / 1000;
    log(`Restore took ${restoreSeconds.toFixed(1)}s`);

    log("Comparing schema...");
    const [liveTables, restoredTables] = await Promise.all([listTables(live), listTables(verify)]);
    const liveSet = new Set(liveTables);
    const restoredSet = new Set(restoredTables);

    const missingInRestore = liveTables.filter((t) => !restoredSet.has(t));
    const extraInRestore = restoredTables.filter((t) => !liveSet.has(t));

    log(`Live: ${liveTables.length} tables / Restore: ${restoredTables.length} tables`);
    if (missingInRestore.length) log(`Missing in restore: ${missingInRestore.join(", ")}`);
    if (extraInRestore.length) log(`Extra in restore: ${extraInRestore.join(", ")}`);

    log("Comparing column signatures + row counts on common tables...");
    const common = liveTables.filter((t) => restoredSet.has(t));
    const tableReports = [];
    for (const table of common) {
      const [liveSig, restoredSig, liveCount, restoredCount] = await Promise.all([
        columnSignature(live, table),
        columnSignature(verify, table),
        rowCount(live, table).catch(() => -1),
        rowCount(verify, table).catch(() => -1),
      ]);
      const schemaMatch = liveSig === restoredSig;
      const countOk = withinTolerance(liveCount, restoredCount, TOLERANCE_PCT);
      tableReports.push({
        table,
        schemaMatch,
        liveCount,
        restoredCount,
        countOk,
      });
    }

    log("Spot-checking anchor tables for non-empty content...");
    const anchorReports = [];
    for (const table of ANCHOR_TABLES) {
      if (!restoredSet.has(table)) {
        anchorReports.push({ table, present: false, rowCount: 0, ok: false });
        continue;
      }
      const count = await rowCount(verify, table).catch(() => -1);
      anchorReports.push({ table, present: true, rowCount: count, ok: count > 0 });
    }

    const schemaFailures = tableReports.filter((r) => !r.schemaMatch);
    const countFailures = tableReports.filter((r) => !r.countOk);
    const anchorFailures = anchorReports.filter((r) => !r.ok);
    const extraTableFailure = !ALLOW_RESTORE_ONLY_TABLES && extraInRestore.length > 0;

    const passed =
      missingInRestore.length === 0 &&
      schemaFailures.length === 0 &&
      countFailures.length === 0 &&
      anchorFailures.length === 0 &&
      !extraTableFailure;

    const report = {
      verifiedAt: new Date().toISOString(),
      backup: dumpPath,
      backupBytes: dumpStat.size,
      restoreSeconds,
      tolerancePct: TOLERANCE_PCT,
      summary: {
        liveTables: liveTables.length,
        restoredTables: restoredTables.length,
        missingInRestore,
        extraInRestore,
        schemaFailures: schemaFailures.map((r) => r.table),
        countFailures: countFailures.map((r) => ({
          table: r.table,
          live: r.liveCount,
          restored: r.restoredCount,
        })),
        anchorFailures: anchorFailures.map((r) => r.table),
      },
      tables: tableReports,
      anchors: anchorReports,
      passed,
    };

    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
    log(`Report written to ${REPORT_PATH}`);

    if (!passed) {
      log("FAIL — see report for details.");
      process.exit(1);
    }
    log("PASS — backup is restorable and within drift tolerance.");
    process.exit(0);
  } catch (err) {
    die(2, `harness error: ${err instanceof Error ? err.message : String(err)}`, err);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

main();
