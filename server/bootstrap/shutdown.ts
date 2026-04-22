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
    console.log(`↩ ${sig} received again, forcing exit...`);
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`\n↩ ${sig} received. Shutting down gracefully...`);
  console.log(`   Active connections: ${activeConnections.size}`);

  const shutdownStart = Date.now();
  const DRAIN_TIMEOUT_MS = 10000;

  try {
    console.log("→ Phase 1: Stopping new connections...");
    const serverModule = await import("../routes");
    if ((serverModule as any).server) {
      (serverModule as any).server.close();
    }

    console.log("→ Phase 2: Draining active connections...");
    const drainStart = Date.now();
    while (activeConnections.size > 0 && Date.now() - drainStart < DRAIN_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 100));
      if (activeConnections.size > 0 && (Date.now() - drainStart) % 1000 < 100) {
        console.log(`   Waiting for ${activeConnections.size} connections...`);
      }
    }

    if (activeConnections.size > 0) {
      console.warn(`⚠️ Forcefully closing ${activeConnections.size} remaining connections`);
      for (const socket of activeConnections) {
        try {
          socket.destroy();
        } catch {
          /* socket already destroyed */
        }
      }
      activeConnections.clear();
    }
    console.log("✓ Connections drained");

    console.log("→ Phase 3: Stopping background services...");

    try {
      const { mqttReliableSync } = await import("../mqtt-reliable-sync");
      await withTimeout(mqttReliableSync.stop(), 3000);
      console.log("  ✓ MQTT sync stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { telemetryPruningService } = await import("../telemetry-pruning-service");
      await withTimeout(telemetryPruningService.stop?.() || Promise.resolve(), 2000);
      console.log("  ✓ Telemetry pruning stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { telemetryBatchWriter } = await import("../telemetry-batch-writer");
      await withTimeout(telemetryBatchWriter.stop(), 5000);
      console.log("  ✓ Telemetry batch writer flushed");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { mlTrainingQueue } = await import("../ml-training-queue");
      await withTimeout(mlTrainingQueue.shutdown(), 3000);
      console.log("  ✓ ML training queue stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    try {
      const { stopEventLoopMonitoring } = await import("../observability");
      stopEventLoopMonitoring();
      console.log("  ✓ Observability stopped");
    } catch {
      /* module not loaded or already stopped */
    }

    const shutdownDuration = Date.now() - shutdownStart;
    console.log(`✓ Graceful shutdown complete in ${shutdownDuration}ms`);
  } finally {
    process.exit(0);
  }
}

export function setupShutdownHandlers(): void {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
