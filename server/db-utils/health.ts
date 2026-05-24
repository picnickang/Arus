/**
 * Database Utils - Health Check
 * Database connectivity and health monitoring
 */

import pg from "pg";
const { Pool } = pg;
import { isLocalMode } from "../db-config.js";
import type { DatabaseHealth } from "./types.js";

const DATABASE_URL = process.env.DATABASE_URL;

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  if (isLocalMode || !DATABASE_URL) {
    return {
      ok: true,
      engine: "postgres",
      timescaledb: false,
      connectionPool: { total: 1, idle: 1, waiting: 0 },
      tableCount: 0,
      telemetryRecords: 0,
      detail: "Local mode - health check skipped",
    };
  }

  let pool: InstanceType<typeof Pool> | null = null;
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      statement_timeout: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
    const client = await pool.connect();

    try {
      await client.query("SELECT 1");
      const timescaleCheck = await client.query(
        "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')"
      );
      const hasTimescale = timescaleCheck.rows[0]?.exists || false;
      const poolStats = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      };
      const tableCountResult = await client.query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'"
      );
      const tableCount = Number.parseInt(tableCountResult.rows[0]?.count || "0");
      let telemetryRecords = 0;
      try {
        const telemetryCountResult = await client.query(
          "SELECT COUNT(*) as count FROM equipment_telemetry"
        );
        telemetryRecords = Number.parseInt(telemetryCountResult.rows[0]?.count || "0");
      } catch {
        telemetryRecords = 0;
      }

      return {
        ok: true,
        engine: DATABASE_URL.includes("neon.tech") ? "neon" : "postgres",
        timescaledb: hasTimescale,
        connectionPool: poolStats,
        tableCount,
        telemetryRecords,
      };
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    return {
      ok: false,
      engine: DATABASE_URL.includes("neon.tech") ? "neon" : "postgres",
      timescaledb: false,
      connectionPool: { total: 0, idle: 0, waiting: 0 },
      tableCount: 0,
      telemetryRecords: 0,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
