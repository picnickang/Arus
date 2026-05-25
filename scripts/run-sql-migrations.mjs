#!/usr/bin/env node
/**
 * LR-1A — Explicit SQL migration runner.
 *
 * Replaces the historical `drizzle-kit push --force` posture in
 * scripts/post-merge.sh with an idempotent, journaled, reversible
 * migration application pass over every `migrations/NNNN_*.sql` file.
 *
 * Why a custom runner instead of `drizzle-kit migrate`:
 *   - `migrations/meta/_journal.json` only tracks 5 of the 23 current
 *     SQL migrations — the rest were applied via push and were never
 *     registered with Drizzle's tracker. Switching cold to
 *     `drizzle-kit migrate` would silently skip them.
 *   - We need to track up/down state for reversibility CI; Drizzle's
 *     tracker only knows about up-migrations.
 *
 * Tracking table:
 *   arus_migrations(filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ)
 *
 * Modes (mutually exclusive):
 *   up              (default) — apply every NNNN_*.sql not yet recorded,
 *                   in lexical order, each inside its own transaction.
 *   down --count N  revert the most recently applied N migrations using
 *                   the matching NNNN_*.down.sql. Fails loudly if a
 *                   .down.sql is missing.
 *   status          print applied + pending counts and the last applied
 *                   migration filename.
 *
 * Environment:
 *   DATABASE_URL    Postgres connection string (required).
 *   ARUS_MIGRATIONS_DIR  override the migrations folder (defaults to
 *                   `<cwd>/migrations`); used by the reversibility
 *                   harness to point at an ephemeral copy.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

const MIGRATIONS_DIR =
  process.env.ARUS_MIGRATIONS_DIR ??
  path.resolve(process.cwd(), "migrations");

const TRACKER_DDL = `
  CREATE TABLE IF NOT EXISTS arus_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

function listUpMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (f) =>
        /^\d{4}_.*\.sql$/.test(f) && !f.endsWith(".down.sql"),
    )
    .sort();
}

function downFileFor(upFile) {
  return upFile.replace(/\.sql$/, ".down.sql");
}

async function ensureTracker(pool) {
  await pool.query(TRACKER_DDL);
}

// Stable 64-bit integer for `pg_advisory_lock`. The value is arbitrary
// but constant — any concurrent migration runner against the same DB
// will block on this key until the lock holder finishes (or
// disconnects). Computed once: hash('arus_migrations_v1') mod 2^31.
const ADVISORY_LOCK_KEY = 779231474;

async function withAdvisoryLock(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    try {
      return await fn();
    } finally {
      await client
        .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY])
        .catch(() => undefined);
    }
  } finally {
    client.release();
  }
}

async function appliedSet(pool) {
  const { rows } = await pool.query(
    "SELECT filename FROM arus_migrations",
  );
  return new Set(rows.map((r) => r.filename));
}

async function applyOne(pool, filename) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO arus_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
      [filename],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function revertOne(pool, filename) {
  const down = downFileFor(filename);
  const downPath = path.join(MIGRATIONS_DIR, down);
  if (!fs.existsSync(downPath)) {
    throw new Error(
      `Missing reverse migration: ${down} (required to revert ${filename}). ` +
        `Every migration must ship with a matching .down.sql — see LR-1A.`,
    );
  }
  const sql = fs.readFileSync(downPath, "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("DELETE FROM arus_migrations WHERE filename = $1", [
      filename,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function cmdUp(pool) {
  await ensureTracker(pool);
  const applied = await appliedSet(pool);
  const pending = listUpMigrations().filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log("[arus-migrate up] nothing to apply");
    return;
  }
  for (const file of pending) {
    process.stdout.write(`[arus-migrate up] applying ${file} ... `);
    await applyOne(pool, file);
    console.log("ok");
  }
}

async function cmdDown(pool, count) {
  await ensureTracker(pool);
  const { rows } = await pool.query(
    "SELECT filename FROM arus_migrations ORDER BY applied_at DESC, filename DESC LIMIT $1",
    [count],
  );
  if (rows.length === 0) {
    console.log("[arus-migrate down] nothing to revert");
    return;
  }
  for (const { filename } of rows) {
    process.stdout.write(`[arus-migrate down] reverting ${filename} ... `);
    await revertOne(pool, filename);
    console.log("ok");
  }
}

async function cmdStatus(pool) {
  await ensureTracker(pool);
  const applied = await appliedSet(pool);
  const all = listUpMigrations();
  const pending = all.filter((f) => !applied.has(f));
  const last = [...applied].sort().pop() ?? "(none)";
  console.log(`[arus-migrate status] applied=${applied.size} pending=${pending.length} last=${last}`);
  if (pending.length > 0) {
    console.log("[arus-migrate status] pending:");
    for (const f of pending) console.log(`  - ${f}`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const mode = args[0] && !args[0].startsWith("--") ? args[0] : "up";
  let count = 1;
  const idx = args.indexOf("--count");
  if (idx !== -1 && args[idx + 1]) {
    const parsed = Number.parseInt(args[idx + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0) count = parsed;
  }
  return { mode, count };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const { mode, count } = parseArgs(process.argv);
  const pool = new Pool({ connectionString: url });
  try {
    // Architect-flagged concurrency hardening: serialize concurrent
    // post-merge runs against the same DB through a Postgres session
    // advisory lock. The status mode is read-only and skips the lock
    // so observability is never blocked by an in-flight apply.
    if (mode === "status") await cmdStatus(pool);
    else if (mode === "up") await withAdvisoryLock(pool, () => cmdUp(pool));
    else if (mode === "down") await withAdvisoryLock(pool, () => cmdDown(pool, count));
    else {
      console.error(`Unknown mode: ${mode}`);
      process.exit(2);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[arus-migrate] FAILED:", err.message);
  process.exit(1);
});
