/**
 * Background/runtime service initialisers.
 *
 * Split out of services.ts to keep each file under the long-file ceiling.
 * These are db-free orchestration helpers (they lazy-import the concrete
 * services inside each function).
 */
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Bootstrap:ServicesRuntime");
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

  if (process.env["DATABASE_URL"]) {
    try {
      await withServiceTimeout(
        jobQueueService.initialize(process.env["DATABASE_URL"]),
        15000,
        "Job queue"
      );
      await withServiceTimeout(startIngestionWorker(), 10000, "Ingestion worker");
      logger.info("✓ Job queue initialized with 5 workers");
    } catch (error: unknown) {
      logger.warn("⚠️ Job queue initialization failed (non-fatal):", {
        details: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.info("⚠ Skipping job queue initialization (no DATABASE_URL)");
  }
}

export async function initializeMLServices(): Promise<void> {
  const { dbTelemetryStorage } = await import("../repositories");

  logger.info("→ Initializing vessel telemetry simulator...");
  const { initVesselSimulator } = await import("../vessel-simulator");
  initVesselSimulator(dbTelemetryStorage as object as Parameters<typeof initVesselSimulator>[0]);
  logger.info("✓ Vessel telemetry simulator initialized");
}

export async function applyTimescaleOptimizations(isLocalMode: boolean): Promise<void> {
  if (isLocalMode || !process.env["DATABASE_URL"]) {
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
  if (!process.env["DATABASE_URL"]) {
    return;
  }
  try {
    const { runGraphBootstrap } = await import("../graph-bootstrap");
    await runGraphBootstrap();
  } catch (error) {
    logger.warn("⚠️  Knowledge graph bootstrap failed (non-critical):", { details: error });
  }
}

export async function startSyncServices(isLocalMode: boolean): Promise<void> {
  if (process.env["ENABLE_SYNC_SERVICES"] === "false") {
    logger.info("ℹ️  Sync services disabled by ENABLE_SYNC_SERVICES=false");
    return;
  }

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
    logger.warn("[MQTT Reliable Sync] Background start failed:", {
      details: error instanceof Error ? error.message : String(error),
    });
  });
  logger.info("✓ MQTT reliable sync starting in background");
}

export async function initializeTelemetryBatchWriter(): Promise<void> {
  logger.info("→ Starting telemetry batch writer + ingestion...");
  // startIngestion() starts the batch writer AND the SQLite-bridge
  // ingress (Hardware → C# Agent → SQLite → bridge → Postgres). The
  // bridge half was defined in server/ingestion/startIngestion.ts but
  // nothing in the boot path ever called it, leaving the only production
  // ingestion path dormant. It self-gates: without ARUS_SQLITE_PATH it
  // logs "SQLite bridge disabled" and runs the writer only, so cloud
  // deployments are an explicit no-op for the bridge half.
  const { startIngestion } = await import("../ingestion/startIngestion");
  startIngestion();
  logger.info("✓ Telemetry batch writer started (bridge per ARUS_SQLITE_PATH)");
}

export async function initializeAutoReplanPolicy(): Promise<void> {
  if (process.env["ENABLE_AUTO_REPLAN"] === "false") {
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
  if (process.env["FMCC_ENABLED"] !== "true") {
    logger.info("ℹ️  FMCC polling disabled (FMCC_ENABLED != true)");
    return;
  }

  logger.info("→ Initializing FMCC polling service...");
  const { initializeFmccPolling: initFmcc } = await import("../integrations/fmcc-polling-service");
  initFmcc();
  logger.info("✓ FMCC polling service started");
}

export async function initializePatchingSystem(isEmbedded: boolean): Promise<void> {
  if (process.env["ENABLE_UPDATE_SYSTEM"] === "false") {
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
    logger.warn("⚠️  Update system initialization failed (non-critical):", {
      details: error instanceof Error ? error.message : String(error),
    });
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
