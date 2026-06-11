import pg from "pg";
import fs from "fs";
import path from "path";
import { createLogger } from "../lib/structured-logger";
import { RLS_EXEMPT, TENANT_TABLE_NAMES } from "../tenancy/tenant-tables";
const logger = createLogger("Scripts:Migrate");

const { Pool } = pg;

/**
 * Canonical deploy/boot migration runner (Task #260 — unify migration runner).
 *
 * Historically three migration paths disagreed on what got applied:
 *   1. This file's old `migrate(db, { migrationsFolder })` Drizzle step, which
 *      only applied the handful of migrations registered in
 *      `migrations/meta/_journal.json` (5 of 24) plus `server/migrations/*.sql`.
 *   2. `scripts/run-sql-migrations.mjs`, which applies EVERY root
 *      `migrations/NNNN_*.sql` (incl. RLS 0018, hot-path indexes 0021, FK
 *      cascade rules 0023, telemetry dedup unique index 0024) — but was wired
 *      only into the post-merge / reversibility-CI paths, never deploy.
 *
 * A freshly deployed database could therefore be missing indexes/constraints
 * the application assumes exist (e.g. `0024`'s unique index that the telemetry
 * write path's `ON CONFLICT` targets).
 *
 * This runner is now the single source of truth. It applies, idempotently and
 * under a Postgres advisory lock (shared with `run-sql-migrations.mjs`):
 *   (a) every root `migrations/NNNN_*.sql` — tracked in `arus_migrations`,
 *       the same ledger `run-sql-migrations.mjs` uses, so the two interoperate;
 *   (b) `server/migrations/*.sql` — tracked in `arus_sql_migrations`.
 * After applying, it asserts the critical objects exist and fails loudly if any
 * are missing.
 *
 * RETIRED family — the Drizzle journal migrator (`drizzle-orm/.../migrator`):
 *   - The journal tracks only 5 of 24 root migrations, and two of its entries
 *     (`0000_schema-sync`, `0010_cost_savings_validation_status`) have NO
 *     matching `.sql` file, so `migrate()` throws on a fresh database.
 *   - Every file it could apply is part of the `migrations/NNNN_*.sql` set
 *     swept in (a), so it is a strict subset. Running both would double-apply
 *     the overlapping files.
 *   The base schema for a fresh database is still created by
 *   `drizzle-kit push` / `drizzle-kit generate` (out of scope here, unchanged);
 *   this runner applies the incremental migrations on top of it.
 */

const ROOT_MIGRATIONS_DIRNAME = "migrations";
const SERVER_MIGRATIONS_DIRNAME = "server/migrations";

// Stable 64-bit advisory-lock key. MUST match `scripts/run-sql-migrations.mjs`
// so a concurrent deploy and post-merge serialize against the same key.
const ADVISORY_LOCK_KEY = 779231474;

const ROOT_TRACKER_DDL = `
  CREATE TABLE IF NOT EXISTS arus_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const SERVER_TRACKER_DDL = `
  CREATE TABLE IF NOT EXISTS arus_sql_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

// Critical schema objects the application assumes exist post-migration. Asserted
// after every apply so a deploy that silently skipped a migration fails loudly
// rather than corrupting dashboards / breaking the telemetry ON CONFLICT path.
const REQUIRED_INDEXES: ReadonlyArray<{ name: string; from: string }> = [
  { name: "uq_equipment_telemetry_natural", from: "0024 telemetry dedup" },
  { name: "idx_work_orders_org_vessel_status", from: "0021 hot-path indexes" },
  { name: "idx_alert_notifications_org_equipment_type", from: "0021 hot-path indexes" },
  { name: "idx_maintenance_schedules_equipment_date", from: "0021 hot-path indexes" },
  { name: "uq_users_org_email", from: "0039 identity uniques" },
  { name: "uq_work_orders_org_wo_number", from: "0039 identity uniques" },
];

// deleteRule matches pg_constraint.confdeltype: "c" = CASCADE, "n" = SET NULL,
// "a" = NO ACTION. refTable (when set) additionally asserts the FK points at
// that table — used to prove model_id was retargeted off ml_models_legacy.
const REQUIRED_FKS: ReadonlyArray<{
  table: string;
  column: string;
  deleteRule: "c" | "n" | "a";
  refTable?: string;
  from: string;
}> = [
  { table: "purchase_order_items", column: "po_id", deleteRule: "c", from: "0023 FK cascade" },
  { table: "purchase_request_items", column: "pr_id", deleteRule: "c", from: "0023 FK cascade" },
  {
    table: "anomaly_detections",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0040 ML FK integrity",
  },
  {
    table: "anomaly_detections",
    column: "equipment_id",
    deleteRule: "c",
    refTable: "equipment",
    from: "0040 ML FK integrity",
  },
  {
    table: "anomaly_detections",
    column: "model_id",
    deleteRule: "n",
    refTable: "ml_models",
    from: "0040 ML FK integrity",
  },
  {
    table: "failure_predictions",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0040 ML FK integrity",
  },
  {
    table: "failure_predictions",
    column: "equipment_id",
    deleteRule: "c",
    refTable: "equipment",
    from: "0040 ML FK integrity",
  },
  {
    table: "failure_predictions",
    column: "model_id",
    deleteRule: "n",
    refTable: "ml_models",
    from: "0040 ML FK integrity",
  },
  // Representatives for the catalog-driven org FK sweep — one early-domain
  // table, one mid-list, one late-list, so a partially applied 0046 trips
  // the assertion regardless of where it stopped.
  {
    table: "crew_alerts",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0046 org FK backfill",
  },
  {
    table: "agent_conversations",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0046 org FK backfill",
  },
  {
    table: "report_schedules",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0046 org FK backfill",
  },
];

// Columns the application assumes exist post-migration. Asserted after every
// apply so a deploy that silently skipped a migration fails loudly.
const REQUIRED_COLUMNS: ReadonlyArray<{ table: string; column: string; from: string }> = [
  { table: "roles", column: "hub_admin", from: "0033 role hub access" },
  { table: "roles", column: "hub_access", from: "0033 role hub access" },
  { table: "system_settings", column: "openai_api_key_encrypted", from: "0043 secure settings" },
];

/**
 * Prod-hardening: exported entry point for boot-time migration.
 *
 * `server/bootstrap/services.ts` calls this when `MIGRATE_ON_BOOT=true`
 * so a fresh deploy that ships ahead of the manual `npm run db:migrate:deploy`
 * step still ends up with the schema the application expects. Runs against a
 * short-lived pg.Pool that we close before returning (the runtime app pool is
 * owned by db-config.ts and stays untouched).
 */
export async function runBootMigrations(): Promise<void> {
  if (!process.env['DATABASE_URL']) {
    throw new Error("runBootMigrations: DATABASE_URL is required");
  }
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isStatus = args.includes("--status");
  const isDeploy = args.includes("--deploy");

  if (!process.env['DATABASE_URL']) {
    logger.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });

  if (isStatus) {
    await showStatus(pool);
  } else if (isDeploy) {
    logger.info("[Migrate] Running migrations in deploy mode (non-interactive)...");
    await runMigrations(pool);
    logger.info("[Migrate] Deploy complete");
  } else {
    logger.info("[Migrate] Running pending migrations...");
    await runMigrations(pool);
    logger.info("[Migrate] Migrations complete");
  }

  await pool.end();
}

async function runMigrations(pool: pg.Pool): Promise<void> {
  try {
    // Serialize concurrent runners (deploy vs. post-merge) through the shared
    // advisory lock, then apply every required family in order.
    await withAdvisoryLock(pool, async () => {
      await applyRootSqlMigrations(pool);
      await runServerSqlMigrations(pool);
    });
    // Read-only verification — outside the lock; fails loudly if a required
    // object is absent (e.g. a migration was skipped on this database).
    await assertCriticalObjects(pool);
    logger.info("[Migrate] All migrations applied successfully");
  } catch (error) {
    logger.error("[Migrate] Migration failed:", undefined, error);
    process.exit(1);
  }
}

async function withAdvisoryLock<T>(pool: pg.Pool, fn: () => Promise<T>): Promise<T> {
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

function listRootUpMigrations(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f) && !f.endsWith(".down.sql"))
    .sort();
}

async function rootAppliedSet(pool: pg.Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>(
    "SELECT filename FROM arus_migrations"
  );
  return new Set(rows.map((r) => r.filename));
}

/**
 * Apply every root `migrations/NNNN_*.sql` not yet recorded in `arus_migrations`,
 * in lexical order, each inside its own transaction. Mirrors the semantics of
 * `scripts/run-sql-migrations.mjs up` (same ledger table, same lock key) so the
 * deploy path and the post-merge/CI path stay consistent. Re-running is a no-op.
 */
async function applyRootSqlMigrations(pool: pg.Pool): Promise<void> {
  const dir = path.resolve(process.cwd(), ROOT_MIGRATIONS_DIRNAME);
  if (!fs.existsSync(dir)) {
    throw new Error(`[Migrate] Root migrations folder not found: ${dir}`);
  }

  await pool.query(ROOT_TRACKER_DDL);
  const applied = await rootAppliedSet(pool);
  const pending = listRootUpMigrations(dir).filter((f) => !applied.has(f));

  if (pending.length === 0) {
    logger.info("[Migrate] Root SQL migrations up to date");
    return;
  }

  for (const file of pending) {
    logger.info(`[Migrate] Applying root SQL migration: ${file}`);
    const sqlText = fs.readFileSync(path.join(dir, file), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sqlText);
      await client.query(
        "INSERT INTO arus_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
        [file]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      logger.error(`[Migrate] Root SQL migration failed: ${file}`, undefined, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function runServerSqlMigrations(pool: pg.Pool): Promise<void> {
  const serverMigrationsFolder = path.resolve(process.cwd(), SERVER_MIGRATIONS_DIRNAME);

  if (!fs.existsSync(serverMigrationsFolder)) {
    logger.info("[Migrate] No server/migrations folder found; skipping supplemental SQL migrations");
    return;
  }

  await pool.query(SERVER_TRACKER_DDL);

  const files = fs
    .readdirSync(serverMigrationsFolder)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const alreadyApplied = await pool.query(
      "SELECT 1 FROM arus_sql_migrations WHERE filename = $1 LIMIT 1",
      [file]
    );
    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
      logger.info(`[Migrate] Supplemental SQL migration already applied: ${file}`);
      continue;
    }

    const fullPath = path.join(serverMigrationsFolder, file);
    const sqlText = fs.readFileSync(fullPath, "utf-8").trim();
    if (!sqlText || sqlText.split("\n").every((line) => line.trim().startsWith("--"))) {
      logger.info(`[Migrate] Supplemental SQL migration has no executable SQL: ${file}`);
      await pool.query("INSERT INTO arus_sql_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", [
        file,
      ]);
      continue;
    }

    logger.info(`[Migrate] Applying supplemental SQL migration: ${file}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sqlText);
      await client.query("INSERT INTO arus_sql_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      logger.error(`[Migrate] Supplemental SQL migration failed: ${file}`, undefined, error);
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * Verify the critical objects the application assumes exist after migration:
 * the telemetry dedup unique index (0024), the hot-path indexes (0021), the
 * identity unique indexes (0039), and the FK delete rules (0023, 0040).
 * Throws a single error listing everything missing.
 */
async function assertCriticalObjects(pool: pg.Pool): Promise<void> {
  const missing: string[] = [];

  const indexNames = REQUIRED_INDEXES.map((i) => i.name);
  const idxRes = await pool.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE indexname = ANY($1)",
    [indexNames]
  );
  const presentIndexes = new Set(idxRes.rows.map((r) => r.indexname));
  for (const idx of REQUIRED_INDEXES) {
    if (!presentIndexes.has(idx.name)) {
      missing.push(`index "${idx.name}" (${idx.from})`);
    }
  }

  const DELETE_RULE_LABEL: Record<string, string> = {
    c: "ON DELETE CASCADE",
    n: "ON DELETE SET NULL",
    a: "ON DELETE NO ACTION",
  };
  for (const fk of REQUIRED_FKS) {
    const res = await pool.query(
      `SELECT 1
         FROM pg_constraint c
         JOIN pg_class r ON r.oid = c.conrelid
         JOIN pg_class fr ON fr.oid = c.confrelid
         JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f'
          AND c.confdeltype = $3
          AND r.relname = $1
          AND a.attname = $2
          AND ($4::text IS NULL OR fr.relname = $4)
        LIMIT 1`,
      [fk.table, fk.column, fk.deleteRule, fk.refTable ?? null]
    );
    if (!res.rowCount || res.rowCount === 0) {
      const target = fk.refTable ? ` -> ${fk.refTable}` : "";
      missing.push(
        `FK ${DELETE_RULE_LABEL[fk.deleteRule]} on ${fk.table}.${fk.column}${target} (${fk.from})`
      );
    }
  }

  for (const col of REQUIRED_COLUMNS) {
    const res = await pool.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
        LIMIT 1`,
      [col.table, col.column]
    );
    if (!res.rowCount || res.rowCount === 0) {
      missing.push(`column ${col.table}.${col.column} (${col.from})`);
    }
  }

  // RLS (0018/0034/0038/0045): every registry table that exists in this
  // database must have rowsecurity + forcerowsecurity + its
  // tenant_isolation_<t> policy. Tables that don't exist are skipped —
  // the RLS migrations themselves skip missing tables by design.
  const exemptNames = new Set(RLS_EXEMPT.map((e) => e.table));
  const rlsRequired = TENANT_TABLE_NAMES.filter((t) => !exemptNames.has(t));
  const rlsRes = await pool.query<{
    relname: string;
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
    has_policy: boolean;
  }>(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
            EXISTS (
              SELECT 1 FROM pg_policies p
               WHERE p.schemaname = current_schema()
                 AND p.tablename = c.relname
                 AND p.policyname = 'tenant_isolation_' || c.relname
            ) AS has_policy
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema()
        AND c.relkind IN ('r', 'p')
        AND c.relname = ANY($1)`,
    [rlsRequired]
  );
  for (const row of rlsRes.rows) {
    if (!row.relrowsecurity || !row.relforcerowsecurity || !row.has_policy) {
      missing.push(
        `RLS on ${row.relname} (rowsecurity=${row.relrowsecurity}, force=${row.relforcerowsecurity}, policy=${row.has_policy}) (0018/0045 tenant isolation)`
      );
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[Migrate] Post-migration assertion FAILED — required objects missing: ${missing.join("; ")}`
    );
  }

  logger.info(
    "[Migrate] Post-migration assertions passed (telemetry dedup index, hot-path indexes, identity uniques, FK delete rules, tenant RLS present)"
  );
}

async function showStatus(pool: pg.Pool) {
  logger.info("\n=== Migration Status ===\n");

  // Ledger 1 — root migrations/NNNN_*.sql (canonical, arus_migrations).
  try {
    await pool.query(ROOT_TRACKER_DDL);
    const applied = await rootAppliedSet(pool);
    const dir = path.resolve(process.cwd(), ROOT_MIGRATIONS_DIRNAME);
    const all = fs.existsSync(dir) ? listRootUpMigrations(dir) : [];
    const pending = all.filter((f) => !applied.has(f));
    const last = [...applied].sort().pop() ?? "(none)";
    logger.info(
      `Root migrations (arus_migrations): applied=${applied.size} pending=${pending.length} last=${last}`
    );
    for (const f of pending) {logger.info(`  - pending: ${f}`);}
  } catch (error) {
    logger.error("Root migrations: error reading ledger", undefined, error);
  }

  // Ledger 2 — server/migrations/*.sql (supplemental, arus_sql_migrations).
  try {
    const supplemental = await pool.query<{ filename: string; applied_at: string }>(`
      SELECT filename, applied_at
      FROM arus_sql_migrations
      ORDER BY applied_at DESC
      LIMIT 50
    `);
    if (supplemental.rows.length > 0) {
      logger.info(`\nServer migrations (arus_sql_migrations): applied=${supplemental.rows.length}`);
      for (const row of supplemental.rows) {
        logger.info(`  - ${row.filename} (applied: ${new Date(row.applied_at).toISOString()})`);
      }
    } else {
      logger.info("\nServer migrations (arus_sql_migrations): none applied yet");
    }
  } catch {
    logger.info("\nServer migrations (arus_sql_migrations): none applied yet");
  }

  // Ledger 3 — legacy Drizzle journal (__drizzle_migrations). RETIRED as an
  // apply path (see header); shown for visibility on databases that still
  // carry it from before the unification.
  try {
    const result = await pool.query<{ hash: string; created_at: number }>(`
      SELECT hash, created_at FROM "__drizzle_migrations"
      ORDER BY created_at DESC
      LIMIT 10
    `);
    if (result.rows.length === 0) {
      logger.info("\nLegacy Drizzle journal (__drizzle_migrations): empty (retired)");
    } else {
      logger.info("\nLegacy Drizzle journal (__drizzle_migrations) — retired, informational only:");
      for (const row of result.rows) {
        logger.info(`  - ${row.hash} (applied: ${new Date(Number(row.created_at)).toISOString()})`);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not exist")) {
      logger.info("\nLegacy Drizzle journal (__drizzle_migrations): not present (retired)");
    } else {
      logger.error("Legacy Drizzle journal: error reading ledger", undefined, error);
    }
  }

  logger.info("");
}

// Prod-hardening: guard CLI execution so importing this module from
// `server/bootstrap/services.ts` (for MIGRATE_ON_BOOT) does NOT
// trigger main() at import time. `process.argv[1]` is the script
// path tsx/node invoked; we only run main when this file is it.
const invokedDirectly = (() => {
  try {
    const entry = process.argv[1] ?? "";
    return entry.endsWith("migrate.ts") || entry.endsWith("migrate.js");
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((error) => {
    logger.error("Migration error:", undefined, error);
    process.exit(1);
  });
}
