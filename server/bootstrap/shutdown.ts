import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Bootstrap:Shutdown");
/**
 * Graceful Shutdown Handlers
 * Connection draining and service cleanup
 */

let isShuttingDown = false;
const activeConnections = new Set<any>();

function withTimeout(p: Promise<any>, ms: number): Promise<any> {
  return Promise.race([
    p,
    new Promise((_r, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

export function trackConnection(socket: any): void {
  activeConnections.add(socket);
  socket.on("close", () => activeConnections.delete(socket));
}

export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

async function shutdown(sig: string): Promise<void> {
  if (isShuttingDown) {
    logger.info(`↩ ${sig} received again, forcing exit...`);
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`\n↩ ${sig} received. Shutting down gracefully...`);
  logger.info(`   Active connections: ${activeConnections.size}`);

  const shutdownStart = Date.now();
  const DRAIN_TIMEOUT_MS = 10000;

  try {
    logger.info("→ Phase 1: Stopping new connections...");
    const serverModule = await import("../routes");
    const mod = serverModule as { server?: { close: () => void } };
    if (mod.server) {
      mod.server.close();
    }

    logger.info("→ Phase 2: Draining active connections...");
    const drainStart = Date.now();
    while (activeConnections.size > 0 && Date.now() - drainStart < DRAIN_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 100));
      if (activeConnections.size > 0 && (Date.now() - drainStart) % 1000 < 100) {
        logger.info(`   Waiting for ${activeConnections.size} connections...`);
      }
    }

    if (activeConnections.size > 0) {
      logger.warn(`⚠️ Forcefully closing ${activeConnections.size} remaining connections`);
      for (const socket of activeConnections) {
        try {
          socket.destroy();
        } catch {
          /* socket already destroyed */
        }
      }
      activeConnections.clear();
    }
    logger.info("✓ Connections drained");

    logger.info("→ Phase 3: Stopping background services...");

    try {
      const { mqttReliableSync } = await import("../mqtt-reliable-sync");
      await withTimeout(mqttReliableSync.stop(), 3000);
      logger.info("  ✓ MQTT sync stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { telemetryPruningService } = await import("../telemetry-pruning-service");
      await withTimeout(telemetryPruningService.stop?.() || Promise.resolve(), 2000);
      logger.info("  ✓ Telemetry pruning stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { telemetryBatchWriter } = await import("../telemetry-batch-writer");
      await withTimeout(telemetryBatchWriter.stop(), 5000);
      logger.info("  ✓ Telemetry batch writer flushed");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { mlTrainingQueue } = await import("../ml-training-queue");
      await withTimeout(mlTrainingQueue.shutdown(), 3000);
      logger.info("  ✓ ML training queue stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { jobQueue } = await import("../background-jobs");
      await withTimeout(jobQueue.stop(), 6000);
      logger.info("  ✓ Background job queue stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { stopEventLoopMonitoring } = await import("../observability");
      stopEventLoopMonitoring();
      logger.info("  ✓ Observability stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    const shutdownDuration = Date.now() - shutdownStart;
    logger.info(`✓ Graceful shutdown complete in ${shutdownDuration}ms`);
  } finally {
    process.exit(0);
  }
}

export function setupShutdownHandlers(): void {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
