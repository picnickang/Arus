/**
 * Digital Twin Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseDigitalTwinStorage } from "./db-digital-twin.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:DigitalTwin:Index");
import { DatabaseDigitalTwinStorage } from "./db-digital-twin.js";

export const dbDigitalTwinStorage = new DatabaseDigitalTwinStorage();

logger.info("[Digital Twin Repository] Loaded 4 modular files");
