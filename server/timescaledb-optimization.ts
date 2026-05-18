import { createLogger } from "./lib/structured-logger";
import { runTimescaleBootstrap } from "./timescaledb-bootstrap";

const logger = createLogger("TimescaledbOptimization");

export async function applyTimescaleOptimizations(): Promise<void> {
  await runTimescaleBootstrap();
}

export async function configureChunkTimeInterval(): Promise<void> {
  logger.info("[TimescaleDB] chunk_time_interval is configured in scripts/timescale-init-hypertables.mjs");
}

export async function enableCompression(): Promise<void> {
  await runTimescaleBootstrap();
}

export async function scheduleRetentionPolicy(): Promise<void> {
  await runTimescaleBootstrap();
}

export const timescaledbOptimization = {
  apply: applyTimescaleOptimizations,
  configureChunks: configureChunkTimeInterval,
  enableCompression,
  scheduleRetention: scheduleRetentionPolicy,
};
