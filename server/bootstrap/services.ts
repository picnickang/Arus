import { createLogger } from "../lib/structured-logger";
import { runBootMigrations } from "../scripts/migrate";
const logger = createLogger("Bootstrap:Services");
/**
 * Service Initialization
 * Database, job queue, ML services, telemetry
 *
 * Security Note (S5443 - publicly writable directories):
 * /tmp/kb-uploads is used for temporary file processing during KB document uploads.
 * Files are processed and moved to permanent storage immediately.
 * In production, consider using a secure application-owned directory.
 */

export async function initializeLocalDatabase(): Promise<void> {
  if (process.env['LOCAL_MODE'] === "true") {
    const { initializeLocalDatabase: initLocal } = await import("../db-config");
    await initLocal();
  }
}

/**
 * Prod-hardening: opt-in pre-boot migration.
 *
 * Gated on `MIGRATE_ON_BOOT=true` because (a) most deploys still use
 * the explicit `npm run db:migrate:deploy` step in CI/CD and (b) we
 * never want a misconfigured local-mode or test boot to silently
 * mutate a shared dev database. When the flag is set we run the
 * Drizzle migrator + supplemental SQL migrator BEFORE the schema-
 * dependent setup in `initializeDatabase()` so a fresh schema diff
 * doesn't surface as a runtime "column does not exist" much later.
 */
export async function runMigrationsOnBoot(): Promise<void> {
  if (process.env['MIGRATE_ON_BOOT'] !== "true") {
    return;
  }
  if (process.env['LOCAL_MODE'] === "true" || process.env['EMBEDDED_MODE'] === "true") {
    logger.info("ℹ MIGRATE_ON_BOOT skipped (local/embedded mode uses SQLite)");
    return;
  }
  if (!process.env['DATABASE_URL']) {
    logger.warn("⚠ MIGRATE_ON_BOOT requested but DATABASE_URL missing — skipping");
    return;
  }
  logger.info("→ MIGRATE_ON_BOOT: applying pending migrations before service init...");
  await runBootMigrations();
  logger.info("✓ MIGRATE_ON_BOOT: migrations up to date");
}

export async function initializeDatabase(): Promise<void> {
  logger.info("→ Initializing database...");
  const { db, isLocalMode } = await import("../db-config");
  const { devices } = await import("@shared/schema-runtime");
  const { dbInventoryStorage } = await import("../repositories");

  const maxRetries = 3;
  const connectionTimeout = 30000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`  Attempting database connection (attempt ${attempt}/${maxRetries})...`);
      await withServiceTimeout(
        db.select().from(devices).limit(1),
        connectionTimeout,
        "Database connection check"
      );
      logger.info("  Database connection verified");

      if (!isLocalMode) {
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
          dbInventoryStorage.seedStockForParts("default-org-id"),
          30000,
          "Seed stock data"
        );

        const { createDatabaseIndexes, analyzeDatabasePerformance } = await import("../db-indexes");
        await withServiceTimeout(createDatabaseIndexes(), 60000, "Create database indexes");

        if (process.env['NODE_ENV'] === "development") {
          await withServiceTimeout(
            analyzeDatabasePerformance(),
            30000,
            "Analyze database performance"
          );
        }
      } else {
        logger.info("SQLite mode: Skipping PostgreSQL-specific setup (TimescaleDB, views, indexes)");
        logger.info("Database ready for offline-first operation");
      }

      logger.info("✓ Database initialized successfully");

      try {
        const { migrateWorkOrderServiceOrderBridge } = await import("../migrations/wo-so-bridge");
        await migrateWorkOrderServiceOrderBridge(db);
        logger.info("✓ WO ↔ SO bridge migration applied");
      } catch (err) {
        logger.warn("[WO-SO Bridge] Migration skipped or already applied:", { details: (err as Error).message });
      }

      // Wave 0.6 — Feature flag overrides table + cache priming.
      try {
        const { migrateFeatureFlagOverrides } = await import("../migrations/011-feature-flag-overrides");
        await migrateFeatureFlagOverrides(db);
        const { featureFlags } = await import("../infrastructure/feature-flags");
        await featureFlags.refresh(db);
        featureFlags.startAutoRefresh(db, 60_000);
        logger.info("✓ Feature flag overrides table ready (cache primed, auto-refresh every 60s)");
      } catch (err) {
        logger.warn("[FeatureFlags] Override table setup skipped:", { details: (err as Error).message });
      }

      return;
    } catch (error: unknown) {
      const isLastAttempt = attempt === maxRetries;
      logger.warn(`  Database initialization attempt ${attempt} failed:`, { details: error instanceof Error ? error.message : String(error) });

      if (!isLastAttempt) {
        const delay = attempt * 5000;
        logger.info(`  Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error("Database initialization failed after all retries:", undefined, error);
        if (process.env['EMBEDDED_MODE'] === "true" || process.env['LOCAL_MODE'] === "true") {
          logger.error("Embedded/local mode: Continuing despite initialization error");
          return;
        }
        throw error;
      }
    }
  }
}

export async function seedDevelopmentUser(): Promise<void> {
  if (process.env['NODE_ENV'] !== "development") {
    return;
  }

  logger.info("→ Seeding development user...");
  const { db } = await import("../db");
  const { users } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");

  const devUserId = "dev-admin-user";
  const devOrgId = "default-org-id";

  try {
    const existing = await db.select().from(users).where(eq(users.id, devUserId)).limit(1);

    if (existing.length === 0) {
      await db.insert(users).values({
        id: devUserId,
        orgId: devOrgId,
        email: "admin@example.com",
        name: "Development Admin",
        role: "admin",
        isActive: true,
        passwordHash: null,
      });
      logger.info("✓ Development user created");
    } else {
      logger.info("✓ Development user already exists");
    }
  } catch (error: unknown) {
    logger.warn("⚠️  Could not seed development user:", { details: error instanceof Error ? error.message : String(error) });
  }
}

async function withServiceTimeout<T>(
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

export async function initializeJobQueue(): Promise<void> {
  logger.info("→ Initializing job queue...");
  const { jobQueueService } = await import("../job-queue-service");
  const { startIngestionWorker } = await import("../ingestion-worker");
  const fsPromises = await import("fs/promises");

  try {
    await fsPromises.mkdir("/tmp/kb-uploads", { recursive: true });
    logger.info("  ✓ Created /tmp/kb-uploads directory");
  } catch {
    logger.info("  ℹ /tmp/kb-uploads directory already exists");
  }

  if (process.env['DATABASE_URL']) {
    try {
      await withServiceTimeout(
        jobQueueService.initialize(process.env['DATABASE_URL']),
        15000,
        "Job queue"
      );
      await withServiceTimeout(startIngestionWorker(), 10000, "Ingestion worker");
      logger.info("✓ Job queue initialized with 5 workers");
    } catch (error: unknown) {
      logger.warn("⚠️ Job queue initialization failed (non-fatal):", { details: error instanceof Error ? error.message : String(error) });
    }
  } else {
    logger.info("⚠ Skipping job queue initialization (no DATABASE_URL)");
  }
}

export async function initializeMLServices(): Promise<void> {
  const { dbTelemetryStorage } = await import("../repositories");

  logger.info("→ Initializing vessel telemetry simulator...");
  const { initVesselSimulator } = await import("../vessel-simulator");
  initVesselSimulator(
    dbTelemetryStorage as object as Parameters<typeof initVesselSimulator>[0]
  );
  logger.info("✓ Vessel telemetry simulator initialized");
}

export async function applyTimescaleOptimizations(isLocalMode: boolean): Promise<void> {
  if (isLocalMode || !process.env['DATABASE_URL']) {
    return;
  }

  try {
    const { runTimescaleBootstrap } = await import("../timescaledb-bootstrap");
    await runTimescaleBootstrap();
  } catch (error) {
    logger.warn("⚠️  TimescaleDB bootstrap failed (non-critical):", { details: error });
  }
}

/**
 * Push A2 — Knowledge graph bootstrap. Decoupled from the Timescale
 * gate (reviewer's sixth-pass non-blocking comment): graph runs on
 * local PG too as long as `DATABASE_URL` is set and `GRAPH_ENABLED`
 * opt-in is on. Falls back to no-op when the Apache AGE extension
 * is unavailable so the app keeps booting on managed-Postgres
 * deployments without it.
 */
export async function applyGraphBootstrap(): Promise<void> {
  if (!process.env['DATABASE_URL']) return;
  try {
    const { runGraphBootstrap } = await import("../graph-bootstrap");
    await runGraphBootstrap();
  } catch (error) {
    logger.warn("⚠️  Knowledge graph bootstrap failed (non-critical):", { details: error });
  }
}

export async function startSyncServices(isLocalMode: boolean): Promise<void> {
  if (!isLocalMode) {
    return;
  }

  logger.info("→ Starting sync services...");
  const { syncManager } = await import("../sync-manager");
  const { telemetryPruningService } = await import("../telemetry-pruning-service");
  const { mqttReliableSync } = await import("../mqtt-reliable-sync");

  await syncManager.start();

  await telemetryPruningService.start();
  logger.info("✓ Telemetry pruning service started");

  mqttReliableSync.start().catch((error: Error) => {
    logger.warn("[MQTT Reliable Sync] Background start failed:", { details: error instanceof Error ? error.message : String(error) });
  });
  logger.info("✓ MQTT reliable sync starting in background");
}

export async function initializeTelemetryBatchWriter(): Promise<void> {
  logger.info("→ Starting telemetry batch writer...");
  const { telemetryBatchWriter } = await import("../telemetry-batch-writer");
  telemetryBatchWriter.start();
  logger.info("✓ Telemetry batch writer started");
}

export async function initializeAutoReplanPolicy(): Promise<void> {
  if (process.env['ENABLE_AUTO_REPLAN'] === "false") {
    logger.info("ℹ️  Auto-replan policy disabled");
    return;
  }

  logger.info("→ Initializing auto-replan policy...");
  const { initializeAutoReplanPolicy: initPolicy } = await import(
    "../scheduler/auto-replan-policy"
  );
  initPolicy();
  logger.info("✓ Auto-replan policy initialized");
}

export async function initializeFmccPolling(): Promise<void> {
  if (process.env['FMCC_ENABLED'] !== "true") {
    logger.info("ℹ️  FMCC polling disabled (FMCC_ENABLED != true)");
    return;
  }

  logger.info("→ Initializing FMCC polling service...");
  const { initializeFmccPolling: initFmcc } = await import("../integrations/fmcc-polling-service");
  initFmcc();
  logger.info("✓ FMCC polling service started");
}

export async function initializePatchingSystem(isEmbedded: boolean): Promise<void> {
  if (process.env['ENABLE_UPDATE_SYSTEM'] === "false") {
    logger.info("ℹ️  Update system disabled");
    return;
  }

  logger.info("→ Initializing patching system...");
  const { configManager } = await import("../services/config-manager.js");
  const { setupUpdateScheduler } = await import("../services/update-scheduler.js");

  try {
    configManager.watchForChanges({
      orgId: "default-org-id",
      changedByName: "System (Auto-reload)",
    });
    logger.info("✓ Config file watcher started");

    setupUpdateScheduler();
    logger.info("✓ Update scheduler configured");
  } catch (error: unknown) {
    logger.warn("⚠️  Update system initialization failed (non-critical):", { details: error instanceof Error ? error.message : String(error) });
    if (isEmbedded) {
      logger.info("ℹ️  Continuing without update system in embedded mode");
    } else {
      throw error;
    }
  }
}

export async function startEventLoopMonitoring(): Promise<void> {
  try {
    const { startEventLoopMonitoring: startMonitoring } = await import("../observability");
    startMonitoring(1000);
  } catch (error) {
    logger.warn("⚠️  Event loop monitoring not available:", { details: error });
  }
}
