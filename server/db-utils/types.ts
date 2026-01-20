/**
 * Database Utils - Types
 * Interface definitions for database health and configuration
 */

export interface DatabaseHealth {
  ok: boolean;
  engine: "postgres" | "neon";
  timescaledb: boolean;
  connectionPool: { total: number; idle: number; waiting: number };
  tableCount: number;
  telemetryRecords: number;
  detail?: string;
}
