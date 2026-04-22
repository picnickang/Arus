import { runSqliteBridge, loadBridgeConfigSafe } from "../services/sqlite-bridge";
import { telemetryBatchWriter } from "../telemetry-batch-writer";
import { logger } from "../utils/logger";

let isStarted = false;

export function startIngestion(): void {
  if (isStarted) {
    logger.warn("Ingestion", "Already started - skipping");
    return;
  }

  isStarted = true;

  telemetryBatchWriter.start();
  logger.info("Ingestion", "TelemetryBatchWriter started");

  const bridgeConfig = loadBridgeConfigSafe();

  if (!bridgeConfig) {
    logger.info("Ingestion", "SQLite bridge disabled - ARUS_SQLITE_PATH not set");
    return;
  }

  runSqliteBridge(bridgeConfig).catch((err) => {
    logger.error("Ingestion", "SQLite bridge crashed", { error: err });
  });

  logger.info("Ingestion", "SQLite bridge started in background", {
    sqlitePath: bridgeConfig.sqlitePath,
    batchSize: bridgeConfig.batchSize,
    pollIntervalMs: bridgeConfig.pollIntervalMs,
  });
}

export async function stopIngestion(): Promise<void> {
  if (!isStarted) {
    return;
  }

  const { stopBridge } = await import("../services/sqlite-bridge");
  stopBridge();

  await telemetryBatchWriter.stop();
  isStarted = false;

  logger.info("Ingestion", "Stopped");
}

export function isIngestionRunning(): boolean {
  return isStarted;
}
