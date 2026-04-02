/**
 * SQLite Init Domain Organization
 * 
 * This module provides a manifest of all 142+ tables organized by domain
 * for the SQLite database initialization (vessel offline mode).
 * 
 * The actual CREATE TABLE statements remain in sqlite-init.ts for
 * execution efficiency, but this manifest provides documentation
 * and organizational structure for maintainability.
 */

export type { SqliteDomainDefinition, SqliteDomainMap } from "./types.js";
export { SqliteDomains, type SqliteDomainName } from "./manifest.js";
export { getTableCount, getIndexCount, getTablesByDomain, findTableDomain, getAllTables, getAllIndexes, getDomainSummary, validateManifest } from "./helpers.js";

import { getAllTablesSql, getAllIndexesSql, getInventoryMigrationsSql } from "../sqlite/index.js";

let _initialized = false;

export async function isSqliteDatabaseInitialized(): Promise<boolean> {
  if (_initialized) return true;
  try {
    const { db } = await import("../db-config.js");
    const result = await db.all<{ name: string }>(
      { sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='parts_inventory'`, params: [] } as any
    );
    _initialized = Array.isArray(result) && result.length > 0;
    return _initialized;
  } catch {
    return false;
  }
}

export async function initializeSqliteDatabase(): Promise<void> {
  const { db } = await import("../db-config.js");

  for (const stmt of getAllTablesSql()) {
    await db.run(stmt);
  }
  for (const stmt of getAllIndexesSql()) {
    await db.run(stmt);
  }

  await runInventoryMigrations(db);

  _initialized = true;
  console.log("✓ SQLite database initialized with all tables and indexes");
}

async function runInventoryMigrations(database: any): Promise<void> {
  try {
    const piCols = await getTableColumns(database, "parts_inventory");
    if (!piCols.length) return;

    if (piCols.includes("min_quantity") && !piCols.includes("min_stock_level")) {
      await safeRenameColumn(database, "parts_inventory", "min_quantity", "min_stock_level");
    }
    if (piCols.includes("current_quantity") && !piCols.includes("quantity_on_hand")) {
      await safeRenameColumn(database, "parts_inventory", "current_quantity", "quantity_on_hand");
    }
    if (!piCols.includes("quantity_reserved")) {
      await safeAddColumn(database, "parts_inventory", "quantity_reserved", "INTEGER NOT NULL DEFAULT 0");
    }
    if (!piCols.includes("max_stock_level")) {
      await safeAddColumn(database, "parts_inventory", "max_stock_level", "INTEGER DEFAULT 100");
    }
    if (!piCols.includes("part_name") && piCols.includes("description")) {
      await safeAddColumn(database, "parts_inventory", "part_name", "TEXT NOT NULL DEFAULT ''");
    }
    if (!piCols.includes("supplier_name")) {
      await safeAddColumn(database, "parts_inventory", "supplier_name", "TEXT");
    }
    if (!piCols.includes("supplier_part_number")) {
      await safeAddColumn(database, "parts_inventory", "supplier_part_number", "TEXT");
    }
    if (!piCols.includes("location")) {
      await safeAddColumn(database, "parts_inventory", "location", "TEXT");
    }

    const stockCols = await getTableColumns(database, "stock");
    if (!stockCols.length) return;

    if (stockCols.includes("quantity") && !stockCols.includes("quantity_on_hand")) {
      await safeRenameColumn(database, "stock", "quantity", "quantity_on_hand");
    }
    if (!stockCols.includes("quantity_reserved")) {
      await safeAddColumn(database, "stock", "quantity_reserved", "REAL DEFAULT 0");
    }
    if (!stockCols.includes("quantity_on_order")) {
      await safeAddColumn(database, "stock", "quantity_on_order", "REAL DEFAULT 0");
    }
    if (!stockCols.includes("part_no")) {
      await safeAddColumn(database, "stock", "part_no", "TEXT NOT NULL DEFAULT ''");
    }
    if (!stockCols.includes("unit_cost")) {
      await safeAddColumn(database, "stock", "unit_cost", "REAL DEFAULT 0");
    }
    if (!stockCols.includes("bin_location")) {
      await safeAddColumn(database, "stock", "bin_location", "TEXT");
    }
    if (!stockCols.includes("supplier_id")) {
      await safeAddColumn(database, "stock", "supplier_id", "TEXT");
    }
    if (!stockCols.includes("reorder_point")) {
      await safeAddColumn(database, "stock", "reorder_point", "REAL");
    }
    if (!stockCols.includes("max_quantity")) {
      await safeAddColumn(database, "stock", "max_quantity", "REAL");
    }

    console.log("✓ Inventory schema migration completed");
  } catch (error) {
    console.warn("⚠ Inventory migration encountered issues (non-fatal):", error instanceof Error ? error.message : error);
  }
}

async function getTableColumns(database: any, tableName: string): Promise<string[]> {
  try {
    const rows = await database.all({ sql: `PRAGMA table_info(${tableName})`, params: [] } as any);
    if (!Array.isArray(rows)) return [];
    return rows.map((r: any) => r.name);
  } catch {
    return [];
  }
}

async function safeRenameColumn(database: any, table: string, oldCol: string, newCol: string): Promise<void> {
  try {
    await database.run({ sql: `ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`, params: [] } as any);
    console.log(`  ✓ Renamed ${table}.${oldCol} → ${newCol}`);
  } catch (error) {
    console.warn(`  ⚠ Could not rename ${table}.${oldCol} → ${newCol}:`, error instanceof Error ? error.message : error);
  }
}

async function safeAddColumn(database: any, table: string, col: string, definition: string): Promise<void> {
  try {
    await database.run({ sql: `ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`, params: [] } as any);
    console.log(`  ✓ Added ${table}.${col}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate column")) return;
    console.warn(`  ⚠ Could not add ${table}.${col}:`, error instanceof Error ? error.message : error);
  }
}
