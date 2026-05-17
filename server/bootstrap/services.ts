// @ts-nocheck
import { createLogger } from "../lib/structured-logger";
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
  if (process.env.LOCAL_MODE === "true") {
    const { initializeLocalDatabase: initLocal } = await import("../db-config");
    await initLocal();
  }
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

        if (process.env.NODE_ENV === "development") {
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

      return;
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      logger.warn(`  Database initialization attempt ${attempt} failed:`, { details: error.message });

      if (!isLastAttempt) {
        const delay = attempt * 5000;
        logger.info(`  Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error("Database initialization failed after all retries:", undefined, error);
        if (process.env.EMBEDDED_MODE === "true" || process.env.LOCAL_MODE === "true") {
          logger.error("Embedded/local mode: Continuing despite initialization error");
          return;
        }
        throw error;
      }
    }
  }
}

export async function seedDevelopmentUser(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
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
  } catch (error: any) {
    logger.warn("⚠️  Could not seed development user:", { details: error.message });
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

  if (process.env.DATABASE_URL) {
    try {
      await withServiceTimeout(
        jobQueueService.initialize(process.env.DATABASE_URL),
        15000,
        "Job queue"
      );
      await withServiceTimeout(startIngestionWorker(5), 10000, "Ingestion worker");
      logger.info("✓ Job queue initialized with 5 workers");
    } catch (error: any) {
      logger.warn("⚠️ Job queue initialization failed (non-fatal):", { details: error.message });
    }
  } else {
    logger.info("⚠ Skipping job queue initialization (no DATABASE_URL)");
  }
}

export async function initializeMLServices(): Promise<void> {
  const { storage } = await import("../repositories");

  logger.info("→ Initializing vessel telemetry simulator...");
  const { initVesselSimulator } = await import("../vessel-simulator");
  initVesselSimulator(storage);
  logger.info("✓ Vessel telemetry simulator initialized");
}

export async function applyTimescaleOptimizations(isLocalMode: boolean): Promise<void> {
  if (isLocalMode || !process.env.DATABASE_URL) {
    return;
  }

  try {
    logger.info("→ Applying TimescaleDB optimizations...");
    const { applyTimescaleOptimizations: apply } = await import("../timescaledb-optimization");
    const results = await apply();

    const compressionSuccess = results.compressionResult.success;
    const retentionSuccess = results.retentionResult.success;

    if (compressionSuccess && retentionSuccess) {
      logger.info("✓ TimescaleDB optimizations fully applied (compression + retention)");
    } else if (!compressionSuccess && !retentionSuccess) {
      logger.warn("⚠️  TimescaleDB commercial features unavailable (Apache license)");
      logger.warn("   Compression fallback: Using composite indexes (optimal alternative)");
      logger.warn("   Retention fallback: Using telemetry-pruning-service (manual cleanup)");
      logger.info("✓ TimescaleDB optimization fallbacks configured");
    } else {
      logger.warn("⚠️  TimescaleDB partial optimization:", { details: {
        compression: results.compressionResult.message,
        retention: results.retentionResult.message,
      } });
    }
  } catch (error) {
    logger.warn("⚠️  Failed to apply TimescaleDB optimizations (non-critical):", { details: error });
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
    logger.warn("[MQTT Reliable Sync] Background start failed:", { details: error.message });
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
  if (process.env.ENABLE_AUTO_REPLAN === "false") {
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
  if (process.env.FMCC_ENABLED !== "true") {
    logger.info("ℹ️  FMCC polling disabled (FMCC_ENABLED != true)");
    return;
  }

  logger.info("→ Initializing FMCC polling service...");
  const { initializeFmccPolling: initFmcc } = await import("../integrations/fmcc-polling-service");
  initFmcc();
  logger.info("✓ FMCC polling service started");
}

export async function initializePatchingSystem(isEmbedded: boolean): Promise<void> {
  if (process.env.ENABLE_UPDATE_SYSTEM === "false") {
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
  } catch (error: any) {
    logger.warn("⚠️  Update system initialization failed (non-critical):", { details: error.message });
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
