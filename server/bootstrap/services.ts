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
  console.log("→ Initializing database...");
  const { initializeDatabase: initDb } = await import("../storage");
  await initDb();
  console.log("✓ Database initialized successfully");
}

export async function seedDevelopmentUser(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log("→ Seeding development user...");
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
      console.log("✓ Development user created");
    } else {
      console.log("✓ Development user already exists");
    }
  } catch (error: any) {
    console.warn("⚠️  Could not seed development user:", error.message);
  }
}

async function withServiceTimeout<T>(promise: Promise<T>, timeoutMs: number, service: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${service} timed out after ${timeoutMs}ms`)), timeoutMs);
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
  console.log("→ Initializing job queue...");
  const { jobQueueService } = await import("../job-queue-service");
  const { startIngestionWorker } = await import("../ingestion-worker");
  const fsPromises = await import("fs/promises");

  try {
    await fsPromises.mkdir("/tmp/kb-uploads", { recursive: true });
    console.log("  ✓ Created /tmp/kb-uploads directory");
  } catch {
    console.log("  ℹ /tmp/kb-uploads directory already exists");
  }

  if (process.env.DATABASE_URL) {
    try {
      await withServiceTimeout(jobQueueService.initialize(process.env.DATABASE_URL), 15000, "Job queue");
      await withServiceTimeout(startIngestionWorker(5), 10000, "Ingestion worker");
      console.log("✓ Job queue initialized with 5 workers");
    } catch (error: any) {
      console.warn("⚠️ Job queue initialization failed (non-fatal):", error.message);
    }
  } else {
    console.log("⚠ Skipping job queue initialization (no DATABASE_URL)");
  }
}

export async function initializeMLServices(): Promise<void> {
  const { storage } = await import("../storage");

  console.log("→ Initializing vessel telemetry simulator...");
  const { initVesselSimulator } = await import("../vessel-simulator");
  initVesselSimulator(storage);
  console.log("✓ Vessel telemetry simulator initialized");
}

export async function applyTimescaleOptimizations(isLocalMode: boolean): Promise<void> {
  if (isLocalMode || !process.env.DATABASE_URL) { return; }

  try {
    console.log("→ Applying TimescaleDB optimizations...");
    const { applyTimescaleOptimizations: apply } = await import("../timescaledb-optimization");
    const results = await apply();

    const compressionSuccess = results.compressionResult.success;
    const retentionSuccess = results.retentionResult.success;

    if (compressionSuccess && retentionSuccess) {
      console.log("✓ TimescaleDB optimizations fully applied (compression + retention)");
    } else if (!compressionSuccess && !retentionSuccess) {
      console.warn("⚠️  TimescaleDB commercial features unavailable (Apache license)");
      console.warn("   Compression fallback: Using composite indexes (optimal alternative)");
      console.warn("   Retention fallback: Using telemetry-pruning-service (manual cleanup)");
      console.log("✓ TimescaleDB optimization fallbacks configured");
    } else {
      console.warn("⚠️  TimescaleDB partial optimization:", {
        compression: results.compressionResult.message,
        retention: results.retentionResult.message,
      });
    }
  } catch (error) {
    console.warn("⚠️  Failed to apply TimescaleDB optimizations (non-critical):", error);
  }
}

export async function startSyncServices(isLocalMode: boolean): Promise<void> {
  if (!isLocalMode) { return; }

  console.log("→ Starting sync services...");
  const { syncManager } = await import("../sync-manager");
  const { telemetryPruningService } = await import("../telemetry-pruning-service");
  const { mqttReliableSync } = await import("../mqtt-reliable-sync");

  await syncManager.start();

  await telemetryPruningService.start();
  console.log("✓ Telemetry pruning service started");

  mqttReliableSync.start().catch((error: Error) => {
    console.warn("[MQTT Reliable Sync] Background start failed:", error.message);
  });
  console.log("✓ MQTT reliable sync starting in background");
}

export async function initializeTelemetryBatchWriter(): Promise<void> {
  console.log("→ Starting telemetry batch writer...");
  const { telemetryBatchWriter } = await import("../telemetry-batch-writer");
  telemetryBatchWriter.start();
  console.log("✓ Telemetry batch writer started");
}

export async function initializeAutoReplanPolicy(): Promise<void> {
  if (process.env.ENABLE_AUTO_REPLAN === "false") {
    console.log("ℹ️  Auto-replan policy disabled");
    return;
  }

  console.log("→ Initializing auto-replan policy...");
  const { initializeAutoReplanPolicy: initPolicy } = await import("../scheduler/auto-replan-policy");
  initPolicy();
  console.log("✓ Auto-replan policy initialized");
}

export async function initializeFmccPolling(): Promise<void> {
  if (process.env.FMCC_ENABLED !== "true") {
    console.log("ℹ️  FMCC polling disabled (FMCC_ENABLED != true)");
    return;
  }

  console.log("→ Initializing FMCC polling service...");
  const { initializeFmccPolling: initFmcc } = await import("../integrations/fmcc-polling-service");
  initFmcc();
  console.log("✓ FMCC polling service started");
}

export async function initializePatchingSystem(isEmbedded: boolean): Promise<void> {
  if (process.env.ENABLE_UPDATE_SYSTEM === "false") {
    console.log("ℹ️  Update system disabled");
    return;
  }

  console.log("→ Initializing patching system...");
  const { configManager } = await import("../services/config-manager.js");
  const { setupUpdateScheduler } = await import("../services/update-scheduler.js");

  try {
    configManager.watchForChanges({
      orgId: "default-org-id",
      changedByName: "System (Auto-reload)",
    });
    console.log("✓ Config file watcher started");

    setupUpdateScheduler();
    console.log("✓ Update scheduler configured");
  } catch (error: any) {
    console.warn("⚠️  Update system initialization failed (non-critical):", error.message);
    if (isEmbedded) {
      console.log("ℹ️  Continuing without update system in embedded mode");
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
    console.warn("⚠️  Event loop monitoring not available:", error);
  }
}
