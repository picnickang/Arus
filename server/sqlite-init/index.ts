/**
 * SQLite Init Domain Organization
 * 
 * This module provides a manifest of all 142+ tables organized by domain
 * for the SQLite database initialization (vessel offline mode), including
 * inventory schema migration for aligning column names with PostgreSQL.
 */

export type { SqliteDomainDefinition, SqliteDomainMap } from "./types.js";
export { SqliteDomains, type SqliteDomainName } from "./manifest.js";
export { getTableCount, getIndexCount, getTablesByDomain, findTableDomain, getAllTables, getAllIndexes, getDomainSummary, validateManifest } from "./helpers.js";

import type { Client as LibsqlClient } from "@libsql/client";
import { getAllTablesSql, getAllIndexesSql } from "../sqlite/index.js";

let _initialized = false;

export async function isSqliteDatabaseInitialized(): Promise<boolean> {
  if (_initialized) return true;
  try {
    const { libsqlClient } = await import("../db-config.js");
    if (!libsqlClient) return false;
    const result = await libsqlClient.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='parts_inventory'"
    );
    _initialized = result.rows.length > 0;
    return _initialized;
  } catch {
    return false;
  }
}

export async function initializeSqliteDatabase(): Promise<void> {
  const { db, libsqlClient } = await import("../db-config.js");
  if (!libsqlClient) {
    throw new Error("SQLite client not initialized");
  }

  for (const stmt of getAllTablesSql()) {
    await db.run(stmt);
  }
  for (const stmt of getAllIndexesSql()) {
    await db.run(stmt);
  }

  await runInventoryMigrations(libsqlClient);
  await verifyInventorySchema(libsqlClient);

  _initialized = true;
  console.log("✓ SQLite database initialized with all tables and indexes");
}

async function getTableColumns(client: LibsqlClient, tableName: string): Promise<string[]> {
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  return result.rows.map((r) => String(r.name));
}

async function safeRenameColumn(client: LibsqlClient, table: string, oldCol: string, newCol: string): Promise<void> {
  await client.execute(`ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`);
  console.log(`  ✓ Renamed ${table}.${oldCol} → ${newCol}`);
}

async function safeAddColumn(client: LibsqlClient, table: string, col: string, definition: string): Promise<void> {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
    console.log(`  ✓ Added ${table}.${col}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate column")) return;
    throw error;
  }
}

export async function applyInventoryMigrations(): Promise<void> {
  const { libsqlClient } = await import("../db-config.js");
  if (!libsqlClient) {
    throw new Error("SQLite client not initialized");
  }
  await runInventoryMigrations(libsqlClient);
  await verifyInventorySchema(libsqlClient);
}

async function runInventoryMigrations(client: LibsqlClient): Promise<void> {
  const piCols = await getTableColumns(client, "parts_inventory");
  if (!piCols.length) return;

  const migrationErrors: string[] = [];

  try {
    if (piCols.includes("min_quantity") && !piCols.includes("min_stock_level")) {
      await safeRenameColumn(client, "parts_inventory", "min_quantity", "min_stock_level");
    }
    if (piCols.includes("reorder_level") && !piCols.includes("min_stock_level")) {
      await safeRenameColumn(client, "parts_inventory", "reorder_level", "min_stock_level");
    }

    if (piCols.includes("current_quantity") && !piCols.includes("quantity_on_hand")) {
      await safeRenameColumn(client, "parts_inventory", "current_quantity", "quantity_on_hand");
    }

    if (piCols.includes("reorder_quantity") && !piCols.includes("max_stock_level")) {
      await safeRenameColumn(client, "parts_inventory", "reorder_quantity", "max_stock_level");
    }

    if (piCols.includes("name") && !piCols.includes("part_name")) {
      await safeRenameColumn(client, "parts_inventory", "name", "part_name");
    }

    if (!piCols.includes("quantity_on_hand")) {
      await safeAddColumn(client, "parts_inventory", "quantity_on_hand", "INTEGER NOT NULL DEFAULT 0");
    }
    if (!piCols.includes("quantity_reserved")) {
      await safeAddColumn(client, "parts_inventory", "quantity_reserved", "INTEGER NOT NULL DEFAULT 0");
    }
    if (!piCols.includes("min_stock_level")) {
      await safeAddColumn(client, "parts_inventory", "min_stock_level", "INTEGER DEFAULT 1");
    }
    if (!piCols.includes("max_stock_level")) {
      await safeAddColumn(client, "parts_inventory", "max_stock_level", "INTEGER DEFAULT 100");
    }
    if (!piCols.includes("part_name")) {
      await safeAddColumn(client, "parts_inventory", "part_name", "TEXT NOT NULL DEFAULT ''");
    }
    if (!piCols.includes("supplier_name")) {
      await safeAddColumn(client, "parts_inventory", "supplier_name", "TEXT");
    }
    if (!piCols.includes("supplier_part_number")) {
      await safeAddColumn(client, "parts_inventory", "supplier_part_number", "TEXT");
    }
    if (!piCols.includes("location")) {
      await safeAddColumn(client, "parts_inventory", "location", "TEXT");
    }
  } catch (error) {
    migrationErrors.push(`parts_inventory: ${error instanceof Error ? error.message : String(error)}`);
  }

  const stockCols = await getTableColumns(client, "stock");
  if (!stockCols.length) return;

  try {
    if (stockCols.includes("quantity") && !stockCols.includes("quantity_on_hand")) {
      await safeRenameColumn(client, "stock", "quantity", "quantity_on_hand");
    }
    if (!stockCols.includes("quantity_reserved")) {
      await safeAddColumn(client, "stock", "quantity_reserved", "REAL DEFAULT 0");
    }
    if (!stockCols.includes("quantity_on_order")) {
      await safeAddColumn(client, "stock", "quantity_on_order", "REAL DEFAULT 0");
    }
    if (!stockCols.includes("part_no")) {
      await safeAddColumn(client, "stock", "part_no", "TEXT NOT NULL DEFAULT ''");
    }
    if (!stockCols.includes("unit_cost")) {
      await safeAddColumn(client, "stock", "unit_cost", "REAL DEFAULT 0");
    }
    if (!stockCols.includes("bin_location")) {
      await safeAddColumn(client, "stock", "bin_location", "TEXT");
    }
    if (!stockCols.includes("supplier_id")) {
      await safeAddColumn(client, "stock", "supplier_id", "TEXT");
    }
    if (!stockCols.includes("reorder_point")) {
      await safeAddColumn(client, "stock", "reorder_point", "REAL");
    }
  } catch (error) {
    migrationErrors.push(`stock: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (migrationErrors.length > 0) {
    const errorMsg = `Inventory schema migration failed:\n  ${migrationErrors.join("\n  ")}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log("✓ Inventory schema migration completed");
}

async function verifyInventorySchema(client: LibsqlClient): Promise<void> {
  const requiredPiCols = [
    "quantity_on_hand", "quantity_reserved", "min_stock_level", "max_stock_level", "part_name"
  ];
  const requiredStockCols = [
    "quantity_on_hand", "quantity_reserved", "quantity_on_order", "part_no"
  ];

  const piCols = await getTableColumns(client, "parts_inventory");
  const missingPi = requiredPiCols.filter(c => !piCols.includes(c));

  const stockCols = await getTableColumns(client, "stock");
  const missingStock = requiredStockCols.filter(c => !stockCols.includes(c));

  if (missingPi.length > 0 || missingStock.length > 0) {
    const details: string[] = [];
    if (missingPi.length) details.push(`parts_inventory missing: ${missingPi.join(", ")}`);
    if (missingStock.length) details.push(`stock missing: ${missingStock.join(", ")}`);
    const msg = `Inventory schema verification FAILED:\n  ${details.join("\n  ")}`;
    console.error(msg);
    throw new Error(msg);
  }

  const legacyPiCols = ["min_quantity", "current_quantity", "reorder_level", "reorder_quantity"];
  const stalepi = legacyPiCols.filter(c => piCols.includes(c));
  const legacyStockCols = ["quantity"];
  const staleStock = legacyStockCols.filter(c => stockCols.includes(c) && c !== "quantity_on_hand");

  if (stalepi.length > 0 || staleStock.length > 0) {
    console.warn(`⚠ Legacy columns still present (will not be used by Drizzle):`,
      [...stalepi.map(c => `parts_inventory.${c}`), ...staleStock.map(c => `stock.${c}`)].join(", "));
  }

  console.log("✓ Inventory schema verification passed");
}
