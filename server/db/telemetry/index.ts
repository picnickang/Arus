/**
 * Telemetry Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseTelemetryStorage } from "./db-telemetry.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Telemetry:Index");
import { DatabaseTelemetryStorage } from "./db-telemetry.js";

export const dbTelemetryStorage = new DatabaseTelemetryStorage();

logger.info("[Telemetry Repository] Loaded 4 modular files");
