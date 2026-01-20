/**
 * SQLite-Compatible Vessel Operations Schema
 *
 * This file re-exports from the modular shared/sqlite-schema/ directory
 * for backward compatibility with existing imports.
 *
 * @deprecated Import from 'shared/sqlite-schema' directly for new code
 */

export * from "./sqlite-schema";

export {
  SqliteSchema,
  CoreSqliteSchema,
  TelemetrySqliteSchema,
  WorkOrdersSqliteSchema,
  MaintenanceSqliteSchema,
  InventorySqliteSchema,
  CrewSqliteSchema,
  SensorsSqliteSchema,
  AlertsSqliteSchema,
  MLSqliteSchema,
  ComplianceSqliteSchema,
  InsightsSqliteSchema,
  OptimizerSqliteSchema,
  SyncSqliteSchema,
  AdminSqliteSchema,
  LogbookSqliteSchema,
  SqliteSchemaDomains,
  type SqliteSchemaDomainName,
} from "./sqlite-schema";
