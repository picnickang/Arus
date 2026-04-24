/**
 * StormGeo Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseStormGeoStorage } from "./db-stormgeo.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Stormgeo:Index");
import { DatabaseStormGeoStorage } from "./db-stormgeo.js";

export const dbStormGeoStorage = new DatabaseStormGeoStorage();

logger.info("[StormGeo Repository] Loaded 4 modular files");
