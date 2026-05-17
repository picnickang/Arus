/**
 * Database Utils - TimescaleDB Management
 * TimescaleDB extension, hypertable, and compression management
 */

import pg from "pg";
const { Pool } = pg;
type Pool = InstanceType<typeof pg.Pool>;

const DATABASE_URL = process.env.DATABASE_URL;

export async function enableTimescaleDB(): Promise<{ success: boolean; message: string }> {
  let pool: Pool | null = null;
  try {
    pool = new Pool({ connectionString: DATABASE_URL, statement_timeout: 30000, max: 5 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const extensionCheck = await client.query(
        "SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb')"
      );
      if (!extensionCheck.rows[0]?.exists) {
        await client.query("ROLLBACK");
        return {
          success: false,
          message: "TimescaleDB extension is not available in this PostgreSQL instance",
        };
      }
      await client.query("CREATE EXTENSION IF NOT EXISTS timescaledb");
      await client.query("COMMIT");
      return { success: true, message: "TimescaleDB extension enabled successfully" };
    } catch (error: any) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to enable TimescaleDB: ${error?.message || String(error)}`,
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

export async function createHypertable(): Promise<{ success: boolean; message: string }> {
  let pool: Pool | null = null;
  try {
    pool = new Pool({ connectionString: DATABASE_URL, statement_timeout: 30000, max: 5 });
    const client = await pool.connect();
    try {
      const timescaleCheck = await client.query(
        "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')"
      );
      if (!timescaleCheck.rows[0]?.exists) {
        return {
          success: false,
          message: "TimescaleDB extension is not enabled. Enable it first.",
        };
      }
      const hypertableCheck = await client.query(
        "SELECT EXISTS(SELECT 1 FROM _timescaledb_catalog.hypertable WHERE table_name = 'equipment_telemetry')"
      );
      if (hypertableCheck.rows[0]?.exists) {
        return { success: true, message: "equipment_telemetry is already a hypertable" };
      }
      await client.query(
        "SELECT create_hypertable('equipment_telemetry', 'ts', if_not_exists => TRUE)"
      );
      return { success: true, message: "equipment_telemetry converted to hypertable successfully" };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to create hypertable: ${error?.message || String(error)}`,
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

export async function createContinuousAggregate(): Promise<{ success: boolean; message: string }> {
  let pool: Pool | null = null;
  try {
    pool = new Pool({ connectionString: DATABASE_URL, statement_timeout: 60000, max: 5 });
    const client = await pool.connect();
    try {
      const caggCheck = await client.query(
        "SELECT EXISTS(SELECT 1 FROM _timescaledb_catalog.continuous_agg WHERE user_view_name = 'telemetry_5m_rollup')"
      );
      if (caggCheck.rows[0]?.exists) {
        return {
          success: true,
          message: "Continuous aggregate telemetry_5m_rollup already exists",
        };
      }
      await client.query(
        `CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_5m_rollup WITH (timescaledb.continuous) AS SELECT org_id, equipment_id, sensor_type, time_bucket(INTERVAL '5 minutes', ts) AS bucket, avg(value) AS avg_value, min(value) AS min_value, max(value) AS max_value, count(*) AS sample_count, mode() WITHIN GROUP (ORDER BY unit) AS unit FROM equipment_telemetry GROUP BY org_id, equipment_id, sensor_type, time_bucket(INTERVAL '5 minutes', ts), unit`
      );
      await client.query(
        "SELECT add_continuous_aggregate_policy('telemetry_5m_rollup', start_offset => INTERVAL '1 hour', end_offset => INTERVAL '5 minutes', schedule_interval => INTERVAL '5 minutes', if_not_exists => TRUE)"
      );
      return {
        success: true,
        message:
          "Continuous aggregate telemetry_5m_rollup created successfully with 5-minute refresh policy",
      };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to create continuous aggregate: ${error?.message || String(error)}`,
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

export async function enableCompression(): Promise<{ success: boolean; message: string }> {
  let pool: Pool | null = null;
  try {
    pool = new Pool({ connectionString: DATABASE_URL, statement_timeout: 30000, max: 5 });
    const client = await pool.connect();
    try {
      const timescaleCheck = await client.query(
        "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')"
      );
      if (!timescaleCheck.rows[0]?.exists) {
        return { success: false, message: "TimescaleDB extension is not enabled" };
      }
      await client.query(
        "ALTER TABLE equipment_telemetry SET (timescaledb.compress, timescaledb.compress_segmentby = 'equipment_id, sensor_type', timescaledb.compress_orderby = 'ts DESC')"
      );
      await client.query(
        "SELECT add_compression_policy('equipment_telemetry', INTERVAL '7 days', if_not_exists => TRUE)"
      );
      return {
        success: true,
        message:
          "Compression enabled with 7-day policy. Data older than 7 days will be compressed automatically.",
      };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to enable compression: ${error?.message || String(error)}`,
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
