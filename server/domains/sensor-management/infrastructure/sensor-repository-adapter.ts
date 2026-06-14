/**
 * Sensor Management Infrastructure - Repository Adapter
 *
 * Binds ISensorRepository to dbSensorsStorage (the domain's own sensor storage).
 * This is the only sensor-management layer importing the storage; the wider
 * storage object satisfies the narrower port via structural typing.
 */

import type { ISensorRepository } from "../domain/ports";
import { dbSensorsStorage } from "../../../db/sensors/index.js";

export const sensorRepository: ISensorRepository = dbSensorsStorage;
