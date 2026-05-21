import type { Pool } from "pg";
import { createLogger } from "./lib/structured-logger";
import { pool } from "./db";

const logger = createLogger("TimescaledbBootstrap");

function requirePool(): Pool {
  if (!pool) {
    throw new Error("TimescaleDB bootstrap requires a PostgreSQL pool (local mode or missing DATABASE_URL)");
  }
  return pool as object as Pool;
}

export interface HypertableConfig {
  table: string;
  timeColumn: string;
  chunkInterval: string;
  retention: string | null;
  compressAfter: string | null;
}

export const TIMESCALE_TABLES: HypertableConfig[] = [
  {
    table: "metrics_history",
    timeColumn: "recorded_at",
    chunkInterval: "7 days",
    retention: "90 days",
    compressAfter: "7 days",
  },
  {
    table: "system_performance_metrics",
    timeColumn: "recorded_at",
    chunkInterval: "1 day",
    retention: "30 days",
    compressAfter: "7 days",
  },
  {
    table: "error_logs",
    timeColumn: "timestamp",
    chunkInterval: "7 days",
    retention: "90 days",
    compressAfter: "7 days",
  },
  {
    table: "compliance_audit_log",
    timeColumn: "timestamp",
    chunkInterval: "30 days",
    retention: "2555 days",
    compressAfter: "30 days",
  },
];

interface HypertableStatus {
  table: string;
  isHypertable: boolean;
  hasRetention: boolean;
  hasCompression: boolean;
}

function isTimescaleEnabled(): boolean {
  return process.env.TIMESCALEDB_ENABLED === "true";
}

async function extensionInstalled(pg: Pool): Promise<boolean> {
  const res = await pg.query(
    "SELECT 1 FROM pg_extension WHERE extname = 'timescaledb' LIMIT 1",
  );
  return res.rowCount !== null && res.rowCount > 0;
}

async function ensureExtension(pg: Pool): Promise<void> {
  if (await extensionInstalled(pg)) {
    logger.info("[TimescaleDB] Extension already installed");
    return;
  }
  logger.info("[TimescaleDB] Installing extension...");
  await pg.query("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE");
  logger.info("[TimescaleDB] Extension installed");
}

async function inspectHypertable(pg: Pool, table: string): Promise<HypertableStatus> {
  const ht = await pg.query(
    `SELECT 1 FROM timescaledb_information.hypertables
     WHERE hypertable_schema = 'public' AND hypertable_name = $1 LIMIT 1`,
    [table],
  );
  const isHypertable = ht.rowCount !== null && ht.rowCount > 0;

  if (!isHypertable) {
    return { table, isHypertable: false, hasRetention: false, hasCompression: false };
  }

  const policies = await pg.query(
    `SELECT proc_name FROM timescaledb_information.jobs
     WHERE hypertable_schema = 'public' AND hypertable_name = $1`,
    [table],
  );
  const procNames = policies.rows.map((r: { proc_name: string }) => r.proc_name);
  return {
    table,
    isHypertable: true,
    hasRetention: procNames.includes("policy_retention"),
    hasCompression: procNames.includes("policy_compression"),
  };
}

async function applyPolicies(pg: Pool, cfg: HypertableConfig, status: HypertableStatus): Promise<void> {
  if (!status.isHypertable) {
    logger.warn(
      `[TimescaleDB] ${cfg.table} is NOT a hypertable. Run 'node scripts/timescale-init-hypertables.mjs' as an operator to convert it (requires PK migration).`,
    );
    return;
  }

  if (cfg.compressAfter && !status.hasCompression) {
    try {
      await pg.query(
        `ALTER TABLE ${cfg.table} SET (timescaledb.compress, timescaledb.compress_segmentby = '')`,
      );
      await pg.query(
        `SELECT add_compression_policy($1, INTERVAL '${cfg.compressAfter}', if_not_exists => true)`,
        [cfg.table],
      );
      logger.info(`[TimescaleDB] ${cfg.table}: compression policy set (after ${cfg.compressAfter})`);
    } catch (err) {
      logger.warn(`[TimescaleDB] ${cfg.table}: compression policy failed`, { details: err });
    }
  }

  if (cfg.retention && !status.hasRetention) {
    try {
      await pg.query(
        `SELECT add_retention_policy($1, INTERVAL '${cfg.retention}', if_not_exists => true)`,
        [cfg.table],
      );
      logger.info(`[TimescaleDB] ${cfg.table}: retention policy set (${cfg.retention})`);
    } catch (err) {
      logger.warn(`[TimescaleDB] ${cfg.table}: retention policy failed`, { details: err });
    }
  }
}

export async function runTimescaleBootstrap(): Promise<void> {
  if (!isTimescaleEnabled()) {
    logger.info("[TimescaleDB] Disabled (set TIMESCALEDB_ENABLED=true to opt in)");
    return;
  }

  try {
    const pg = requirePool();
    await ensureExtension(pg);

    const statuses: HypertableStatus[] = [];
    for (const cfg of TIMESCALE_TABLES) {
      const status = await inspectHypertable(pg, cfg.table);
      statuses.push(status);
      await applyPolicies(pg, cfg, status);
    }

    const hypertables = statuses.filter((s) => s.isHypertable).length;
    const pending = statuses.filter((s) => !s.isHypertable).length;
    logger.info(
      `[TimescaleDB] Bootstrap complete — ${hypertables}/${statuses.length} tables are hypertables, ${pending} pending operator init`,
    );
  } catch (err) {
    logger.error("[TimescaleDB] Bootstrap failed (non-fatal, continuing in standard PG mode)", undefined, err);
  }
}

export async function initializeTimescaleDB(): Promise<void> {
  await runTimescaleBootstrap();
}

export async function createTimescaleHypertables(): Promise<void> {
  logger.warn(
    "[TimescaleDB] createTimescaleHypertables() is a no-op; use 'node scripts/timescale-init-hypertables.mjs' for safe conversion.",
  );
}

export async function setupContinuousAggregates(): Promise<void> {
  logger.info("[TimescaleDB] Continuous aggregates not yet configured");
}

export async function setupCompressionPolicy(): Promise<void> {
  await runTimescaleBootstrap();
}

export async function ensureTimescaleDBSetup(): Promise<void> {
  await runTimescaleBootstrap();
}
