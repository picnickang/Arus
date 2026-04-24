/**
 * DTC Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseDtcStorage } from "./db-dtc.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Dtc:Index");
import { DatabaseDtcStorage } from "./db-dtc.js";

export const dbDtcStorage = new DatabaseDtcStorage();

logger.info("[DTC Repository] Loaded 4 modular files");
