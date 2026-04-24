/**
 * Vessels Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseVesselStorage } from "./db-vessels.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Vessels:Index");
import { DatabaseVesselStorage } from "./db-vessels.js";

export const dbVesselStorage = new DatabaseVesselStorage();

logger.info("[Vessels Repository] Loaded 4 modular files");
