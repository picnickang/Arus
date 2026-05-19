/**
   * CANONICAL HOME — Scheduler
   * ============================================================
   * This module is the single canonical home for Scheduler data
   * access. Other layers (domain adapters under
   * `server/domains/scheduler/infrastructure/`, legacy route handlers,
   * cross-domain readers in `server/composition/*`, etc.) MUST import
   * the `db…Storage` singleton from this file directly rather than
   * routing through `server/repositories.ts`. Push B4 (Repositories
   * Proxy Decomposition) removed the four primary-domain importers of
   * that proxy; the proxy now exists only as a transitional re-export
   * barrel for legacy non-domain consumers. New code MUST import from
   * here.
   * ============================================================
   */
  /**
 * Scheduler Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseSchedulerStorage } from "./db-scheduler.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Scheduler:Index");
import { DatabaseSchedulerStorage } from "./db-scheduler.js";

export const dbSchedulerStorage = new DatabaseSchedulerStorage();

logger.info("[Scheduler Repository] Loaded 4 modular files");
