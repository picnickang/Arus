/**
 * Scheduling Infrastructure - Optimizer Repository Adapter
 *
 * Binds IOptimizerRepository to dbOptimizerStorage (the scheduling domain's own
 * optimization storage). Only this layer imports the storage; the wider storage
 * object satisfies the narrower port via structural typing.
 */

import type { IOptimizerRepository } from "../domain/ports";
import { dbOptimizerStorage } from "../../../db/optimizer/index.js";

export const optimizerRepository: IOptimizerRepository = dbOptimizerStorage;
