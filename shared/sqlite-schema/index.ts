/**
 * SQLite Schema Index - Canonical Aggregator
 * Re-exports all domain modules for backward compatibility with schema-sqlite-vessel.ts
 */

export * from "./base";
export * from "./core";
export * from "./telemetry";
export * from "./work-orders";
export * from "./maintenance";
export * from "./inventory";
export * from "./crew";
export * from "./sensors";
export * from "./alerts";
export * from "./ml-analytics";
export * from "./compliance";
export * from "./insights";
export * from "./optimizer";
export * from "./sync";
export * from "./admin";
export * from "./logbook";

import * as base from "./base";
import * as core from "./core";
import * as telemetry from "./telemetry";
import * as workOrders from "./work-orders";
import * as maintenance from "./maintenance";
import * as inventory from "./inventory";
import * as crew from "./crew";
import * as sensors from "./sensors";
import * as alerts from "./alerts";
import * as ml from "./ml-analytics";
import * as compliance from "./compliance";
import * as insights from "./insights";
import * as optimizer from "./optimizer";
import * as sync from "./sync";
import * as admin from "./admin";
import * as logbook from "./logbook";

export const CoreSqliteSchema = { ...core };
export const TelemetrySqliteSchema = { ...telemetry };
export const WorkOrdersSqliteSchema = { ...workOrders };
export const MaintenanceSqliteSchema = { ...maintenance };
export const InventorySqliteSchema = { ...inventory };
export const CrewSqliteSchema = { ...crew };
export const SensorsSqliteSchema = { ...sensors };
export const AlertsSqliteSchema = { ...alerts };
export const MLSqliteSchema = { ...ml };
export const ComplianceSqliteSchema = { ...compliance };
export const InsightsSqliteSchema = { ...insights };
export const OptimizerSqliteSchema = { ...optimizer };
export const SyncSqliteSchema = { ...sync };
export const AdminSqliteSchema = { ...admin };
export const LogbookSqliteSchema = { ...logbook };

export const SqliteSchema = {
  ...base,
  ...core,
  ...telemetry,
  ...workOrders,
  ...maintenance,
  ...inventory,
  ...crew,
  ...sensors,
  ...alerts,
  ...ml,
  ...compliance,
  ...insights,
  ...optimizer,
  ...sync,
  ...admin,
  ...logbook,
};

export type SqliteSchemaDomainName =
  | "core"
  | "telemetry"
  | "work-orders"
  | "maintenance"
  | "inventory"
  | "crew"
  | "sensors"
  | "alerts"
  | "ml"
  | "compliance"
  | "insights"
  | "optimizer"
  | "sync"
  | "admin"
  | "logbook";

export const SqliteSchemaDomains: Record<SqliteSchemaDomainName, object> = {
  core: CoreSqliteSchema,
  telemetry: TelemetrySqliteSchema,
  "work-orders": WorkOrdersSqliteSchema,
  maintenance: MaintenanceSqliteSchema,
  inventory: InventorySqliteSchema,
  crew: CrewSqliteSchema,
  sensors: SensorsSqliteSchema,
  alerts: AlertsSqliteSchema,
  ml: MLSqliteSchema,
  compliance: ComplianceSqliteSchema,
  insights: InsightsSqliteSchema,
  optimizer: OptimizerSqliteSchema,
  sync: SyncSqliteSchema,
  admin: AdminSqliteSchema,
  logbook: LogbookSqliteSchema,
};
