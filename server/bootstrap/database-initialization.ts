import { dbSystemAdminStorage } from "../db/system-admin/index.js";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Bootstrap:Database");

type RuntimeDatabase = (typeof import("../db-config"))["db"];
type RuntimeInventoryStorage = (typeof import("../repositories"))["dbInventoryStorage"];

export function canRunPostgresBootstrapMigration(dbHandle: unknown): boolean {
  return Boolean(dbHandle && typeof (dbHandle as { execute?: unknown }).execute === "function");
}

export async function withServiceTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  service: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${service} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

export async function initializePostgresDatabase(
  inventoryStorage: RuntimeInventoryStorage
): Promise<void> {
  logger.info("PostgreSQL mode: Running TimescaleDB and view setup...");
  const { ensureTimescaleDBSetup } = await import("../timescaledb-bootstrap");
  await withServiceTimeout(ensureTimescaleDBSetup(), 60000, "TimescaleDB setup");

  const { createDatabaseViews, verifyDatabaseViews } = await import("../schema-views");
  await withServiceTimeout(createDatabaseViews(), 60000, "Create database views");
  const viewVerification = await withServiceTimeout(
    verifyDatabaseViews(),
    30000,
    "Verify database views"
  );
  if (!viewVerification.success) {
    logger.error("Database view verification failed:", undefined, viewVerification.errors);
    throw new Error("Essential database views are not functioning properly");
  }

  await withServiceTimeout(
    inventoryStorage.seedStockForParts("default-org-id"),
    30000,
    "Seed stock data"
  );

  const { createDatabaseIndexes, analyzeDatabasePerformance } = await import("../db-indexes");
  await withServiceTimeout(createDatabaseIndexes(), 60000, "Create database indexes");

  if (process.env["NODE_ENV"] === "development") {
    await withServiceTimeout(analyzeDatabasePerformance(), 30000, "Analyze database performance");
  }
}

export async function applyWorkOrderBridgeMigration(db: RuntimeDatabase): Promise<void> {
  if (!canRunPostgresBootstrapMigration(db)) {
    logger.info("[WO-SO Bridge] Migration skipped in local SQLite mode");
    return;
  }
  try {
    const { migrateWorkOrderServiceOrderBridge } = await import("../migrations/wo-so-bridge");
    await migrateWorkOrderServiceOrderBridge(db);
    logger.info("✓ WO ↔ SO bridge migration applied");
  } catch (err) {
    logger.warn("[WO-SO Bridge] Migration skipped or already applied:", {
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function applyFeatureFlagOverridesMigration(db: RuntimeDatabase): Promise<void> {
  if (!canRunPostgresBootstrapMigration(db)) {
    logger.info("[FeatureFlags] Override table setup skipped in local SQLite mode");
    return;
  }
  try {
    const { migrateFeatureFlagOverrides } = await import(
      "../migrations/011-feature-flag-overrides"
    );
    await migrateFeatureFlagOverrides(db);
    const { featureFlags } = await import("../infrastructure/feature-flags");
    await featureFlags.refresh(db);
    featureFlags.startAutoRefresh(db, 60_000);
    logger.info("✓ Feature flag overrides table ready (cache primed, auto-refresh every 60s)");
  } catch (err) {
    logger.warn("[FeatureFlags] Override table setup skipped:", {
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

async function warnIfTelemetryHmacDisabled(): Promise<void> {
  if (process.env["NODE_ENV"] !== "production") {
    return;
  }
  const settings = await dbSystemAdminStorage.getSettings();
  if (!settings?.hmacRequired) {
    logger.warn(
      "⚠ Telemetry HMAC validation is DISABLED — unauthenticated devices can post telemetry. " +
        "Set hmacRequired=true in system settings to require device signatures."
    );
  }
}

export async function runSystemSettingsStartupChecks(): Promise<void> {
  try {
    await dbSystemAdminStorage.ensureSettingsSecretsMigrated();
    await warnIfTelemetryHmacDisabled();
  } catch (err) {
    logger.warn("[SystemSettings] Secret migration/HMAC check skipped:", {
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
