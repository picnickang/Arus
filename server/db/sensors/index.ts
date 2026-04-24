/**
 * Sensors Repository - Modular Aggregator
 */

export * from "./types.js";
export { DbSensorsStorage } from "./db-sensors.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Sensors:Index");
import { DbSensorsStorage } from "./db-sensors.js";

export const dbSensorsStorage = new DbSensorsStorage();

logger.info("[Sensors Repository] Loaded 3 modular files");
