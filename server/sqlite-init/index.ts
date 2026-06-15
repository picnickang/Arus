/**
 * SQLite Init Domain Organization
 *
 * This module provides a manifest of all 142+ tables organized by domain
 * for the SQLite database initialization (vessel offline mode), including
 * inventory schema migration for aligning column names with PostgreSQL.
 */

export type { SqliteDomainDefinition, SqliteDomainMap } from "./types.js";
export { SqliteDomains, type SqliteDomainName } from "./manifest.js";
export {
  getTableCount,
  getIndexCount,
  getTablesByDomain,
  findTableDomain,
  getAllTables,
  getAllIndexes,
  getDomainSummary,
  validateManifest,
} from "./helpers.js";

import type { Client as LibsqlClient } from "@libsql/client";
import { createLogger } from "../lib/structured-logger";
import {
  backfillFromLegacy,
  ensureDeclaredTablesAndIndexes,
  getTableColumns,
  runAdminSettingsCompatibilityMigration,
  runAdminSessionsCompatibilityMigration,
  runCrewCompatibilityMigration,
  runErrorLogsCompatibilityMigration,
  runPdmScoreLogsCompatibilityMigration,
  runAnomalyDetectionsCompatibilityMigration,
  runFailurePredictionsCompatibilityMigration,
  runComponentDegradationCompatibilityMigration,
  runSystemSettingsCompatibilityMigration,
  runUsersAuthCompatibilityMigration,
  safeAddColumn,
  safeRenameColumn,
} from "./compatibility-migrations.js";
import {
  runEquipmentCompatibilityMigration,
  runImmutableAuditTrailCompatibilityMigration,
  runImportManifestCompatibilityMigration,
  runPermissionCompatibilityMigration,
  runVesselsCompatibilityMigration,
} from "./compatibility-migrations-extra.js";
const logger = createLogger("SqliteInit:Index");

let _initialized = false;

export async function isSqliteDatabaseInitialized(): Promise<boolean> {
  if (_initialized) {
    return true;
  }
  try {
    const { libsqlClient } = await import("../db-config.js");
    if (!libsqlClient) {
      return false;
    }
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

  await ensureDeclaredTablesAndIndexes();

  await runSystemSettingsCompatibilityMigration(libsqlClient);
  await runAdminSettingsCompatibilityMigration(libsqlClient);
  await runUsersAuthCompatibilityMigration(libsqlClient);
  await runCrewCompatibilityMigration(libsqlClient);
  await runAdminSessionsCompatibilityMigration(libsqlClient);
  await runErrorLogsCompatibilityMigration(libsqlClient);
  await runPdmScoreLogsCompatibilityMigration(libsqlClient);
  await runAnomalyDetectionsCompatibilityMigration(libsqlClient);
  await runFailurePredictionsCompatibilityMigration(libsqlClient);
  await runComponentDegradationCompatibilityMigration(libsqlClient);
  await runImmutableAuditTrailCompatibilityMigration(libsqlClient);
  await runEquipmentCompatibilityMigration(libsqlClient);
  await runVesselsCompatibilityMigration(libsqlClient);
  await runPermissionCompatibilityMigration(libsqlClient);
  await runImportManifestCompatibilityMigration(libsqlClient);
  await runInventoryMigrations(libsqlClient);
  await verifyInventorySchema(libsqlClient);

  _initialized = true;
  logger.info("✓ SQLite database initialized with all tables and indexes");
}

export async function applyInventoryMigrations(): Promise<void> {
  const { libsqlClient } = await import("../db-config.js");
  if (!libsqlClient) {
    throw new Error("SQLite client not initialized");
  }
  await ensureDeclaredTablesAndIndexes();
  await runSystemSettingsCompatibilityMigration(libsqlClient);
  await runAdminSettingsCompatibilityMigration(libsqlClient);
  await runUsersAuthCompatibilityMigration(libsqlClient);
  await runCrewCompatibilityMigration(libsqlClient);
  await runAdminSessionsCompatibilityMigration(libsqlClient);
  await runErrorLogsCompatibilityMigration(libsqlClient);
  await runPdmScoreLogsCompatibilityMigration(libsqlClient);
  await runAnomalyDetectionsCompatibilityMigration(libsqlClient);
  await runFailurePredictionsCompatibilityMigration(libsqlClient);
  await runComponentDegradationCompatibilityMigration(libsqlClient);
  await runImmutableAuditTrailCompatibilityMigration(libsqlClient);
  await runEquipmentCompatibilityMigration(libsqlClient);
  await runVesselsCompatibilityMigration(libsqlClient);
  await runPermissionCompatibilityMigration(libsqlClient);
  await runImportManifestCompatibilityMigration(libsqlClient);
  await runInventoryMigrations(libsqlClient);
  await verifyInventorySchema(libsqlClient);
}

async function runInventoryMigrations(client: LibsqlClient): Promise<void> {
  const piCols = await getTableColumns(client, "parts_inventory");
  if (!piCols.length) {
    return;
  }

  const migrationErrors: string[] = [];

  try {
    if (piCols.includes("min_quantity") && !piCols.includes("min_stock_level")) {
      await safeRenameColumn(client, "parts_inventory", "min_quantity", "min_stock_level");
    } else if (piCols.includes("min_quantity") && piCols.includes("min_stock_level")) {
      await backfillFromLegacy(client, "parts_inventory", "min_quantity", "min_stock_level");
    }

    if (piCols.includes("reorder_level") && !piCols.includes("min_stock_level")) {
      await safeRenameColumn(client, "parts_inventory", "reorder_level", "min_stock_level");
    } else if (piCols.includes("reorder_level") && piCols.includes("min_stock_level")) {
      await backfillFromLegacy(client, "parts_inventory", "reorder_level", "min_stock_level");
    }

    if (piCols.includes("current_quantity") && !piCols.includes("quantity_on_hand")) {
      await safeRenameColumn(client, "parts_inventory", "current_quantity", "quantity_on_hand");
    } else if (piCols.includes("current_quantity") && piCols.includes("quantity_on_hand")) {
      await backfillFromLegacy(client, "parts_inventory", "current_quantity", "quantity_on_hand");
    }

    if (piCols.includes("reorder_quantity") && !piCols.includes("max_stock_level")) {
      await safeRenameColumn(client, "parts_inventory", "reorder_quantity", "max_stock_level");
    } else if (piCols.includes("reorder_quantity") && piCols.includes("max_stock_level")) {
      await backfillFromLegacy(client, "parts_inventory", "reorder_quantity", "max_stock_level");
    }

    if (piCols.includes("name") && !piCols.includes("part_name")) {
      await safeRenameColumn(client, "parts_inventory", "name", "part_name");
    } else if (piCols.includes("name") && piCols.includes("part_name")) {
      await backfillFromLegacy(client, "parts_inventory", "name", "part_name");
    }

    if (!piCols.includes("quantity_on_hand")) {
      await safeAddColumn(
        client,
        "parts_inventory",
        "quantity_on_hand",
        "INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!piCols.includes("quantity_reserved")) {
      await safeAddColumn(
        client,
        "parts_inventory",
        "quantity_reserved",
        "INTEGER NOT NULL DEFAULT 0"
      );
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
    migrationErrors.push(
      `parts_inventory: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const stockCols = await getTableColumns(client, "stock");
  if (!stockCols.length) {
    return;
  }

  try {
    if (stockCols.includes("quantity") && !stockCols.includes("quantity_on_hand")) {
      await safeRenameColumn(client, "stock", "quantity", "quantity_on_hand");
    } else if (stockCols.includes("quantity") && stockCols.includes("quantity_on_hand")) {
      await backfillFromLegacy(client, "stock", "quantity", "quantity_on_hand");
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

  const poiCols = await getTableColumns(client, "purchase_order_items");
  if (poiCols.length) {
    try {
      if (poiCols.includes("purchase_order_id") && !poiCols.includes("po_id")) {
        await safeRenameColumn(client, "purchase_order_items", "purchase_order_id", "po_id");
      } else if (poiCols.includes("purchase_order_id") && poiCols.includes("po_id")) {
        await backfillFromLegacy(client, "purchase_order_items", "purchase_order_id", "po_id");
      }
      if (!poiCols.includes("org_id")) {
        await safeAddColumn(client, "purchase_order_items", "org_id", "TEXT NOT NULL DEFAULT ''");
        const poIdCol = poiCols.includes("po_id")
          ? "po_id"
          : poiCols.includes("purchase_order_id")
            ? "purchase_order_id"
            : null;
        if (poIdCol) {
          const backfilled = await client.execute(
            `UPDATE purchase_order_items SET org_id = (SELECT po.org_id FROM purchase_orders po WHERE po.id = purchase_order_items.${poIdCol}) WHERE org_id = ''`
          );
          if (backfilled.rowsAffected > 0) {
            logger.info(
              `  ✓ Backfilled ${backfilled.rowsAffected} purchase_order_items.org_id from purchase_orders`
            );
          }
        }
      }
      if (!poiCols.includes("po_id")) {
        await safeAddColumn(client, "purchase_order_items", "po_id", "TEXT NOT NULL DEFAULT ''");
      }
    } catch (error) {
      migrationErrors.push(
        `purchase_order_items: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (migrationErrors.length > 0) {
    const errorMsg = `Inventory schema migration failed:\n  ${migrationErrors.join("\n  ")}`;
    logger.error(String(errorMsg));
    throw new Error(errorMsg);
  }

  logger.info("✓ Inventory schema migration completed");
}

async function verifyInventorySchema(client: LibsqlClient): Promise<void> {
  const requiredPiCols = [
    "quantity_on_hand",
    "quantity_reserved",
    "min_stock_level",
    "max_stock_level",
    "part_name",
  ];
  const requiredStockCols = [
    "quantity_on_hand",
    "quantity_reserved",
    "quantity_on_order",
    "part_no",
  ];

  const requiredPoiCols = ["org_id", "po_id"];

  const piCols = await getTableColumns(client, "parts_inventory");
  const missingPi = requiredPiCols.filter((c) => !piCols.includes(c));

  const stockCols = await getTableColumns(client, "stock");
  const missingStock = requiredStockCols.filter((c) => !stockCols.includes(c));

  const poiCols = await getTableColumns(client, "purchase_order_items");
  const missingPoi = poiCols.length ? requiredPoiCols.filter((c) => !poiCols.includes(c)) : [];

  if (missingPi.length > 0 || missingStock.length > 0 || missingPoi.length > 0) {
    const details: string[] = [];
    if (missingPi.length) {
      details.push(`parts_inventory missing: ${missingPi.join(", ")}`);
    }
    if (missingStock.length) {
      details.push(`stock missing: ${missingStock.join(", ")}`);
    }
    if (missingPoi.length) {
      details.push(`purchase_order_items missing: ${missingPoi.join(", ")}`);
    }
    const msg = `Inventory schema verification FAILED:\n  ${details.join("\n  ")}`;
    logger.error(String(msg));
    throw new Error(msg);
  }

  if (poiCols.includes("org_id")) {
    const orphaned = await client.execute(
      "SELECT COUNT(*) as cnt FROM purchase_order_items WHERE org_id = '' OR org_id IS NULL"
    );
    const count = Number(orphaned.rows[0]?.["cnt"] ?? 0);
    if (count > 0) {
      logger.warn(
        `⚠ ${count} purchase_order_items rows have empty org_id — tenant isolation incomplete`
      );
    }
  }

  const legacyPiCols = ["min_quantity", "current_quantity", "reorder_level", "reorder_quantity"];
  const stalepi = legacyPiCols.filter((c) => piCols.includes(c));
  const legacyStockCols = ["quantity"];
  const staleStock = legacyStockCols.filter(
    (c) => stockCols.includes(c) && c !== "quantity_on_hand"
  );

  if (stalepi.length > 0 || staleStock.length > 0) {
    logger.warn(`⚠ Legacy columns still present (will not be used by Drizzle):`, {
      details: [
        ...stalepi.map((c) => `parts_inventory.${c}`),
        ...staleStock.map((c) => `stock.${c}`),
      ].join(", "),
    });
  }

  logger.info("✓ Inventory schema verification passed");
}
