import { createLogger } from "./lib/structured-logger";
const logger = createLogger("IngestionWorker");
// Stub file - ingestion worker consolidated
export async function startIngestionWorker(): Promise<void> {
  logger.info("[Ingestion Worker] Worker startup skipped - Phase A uses sqlite-bridge only");
}

export async function stopIngestionWorker(): Promise<void> {
  // No-op
}

export function getWorkerStatus(): {
  running: boolean;
  stats: { processed: number; errors: number };
} {
  return { running: false, stats: { processed: 0, errors: 0 } };
}

export const ingestionWorker = {
  start: startIngestionWorker,
  stop: stopIngestionWorker,
  status: getWorkerStatus,
};
