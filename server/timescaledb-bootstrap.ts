import { createLogger } from "./lib/structured-logger";
const logger = createLogger("TimescaledbBootstrap");
// Stub file - TimescaleDB bootstrap consolidated
export async function initializeTimescaleDB(): Promise<void> {
  logger.info("[TimescaleDB] Bootstrap disabled - using standard PostgreSQL");
}

export async function createTimescaleHypertables(): Promise<void> {
  // No-op - not using TimescaleDB
}

export async function setupContinuousAggregates(): Promise<void> {
  // No-op - not using TimescaleDB
}

export async function setupCompressionPolicy(): Promise<void> {
  // No-op - not using TimescaleDB
}

export async function runTimescaleBootstrap(): Promise<void> {
  logger.info("[TimescaleDB] Bootstrap skipped - standard PostgreSQL mode");
}

export async function ensureTimescaleDBSetup(): Promise<void> {
  logger.info("[TimescaleDB] Setup skipped - standard PostgreSQL mode");
}
