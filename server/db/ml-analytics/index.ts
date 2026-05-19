/**
   * CANONICAL HOME — Ml Analytics
   * ============================================================
   * This module is the single canonical home for Ml Analytics data
   * access. Other layers (domain adapters under
   * `server/domains/ml-analytics/infrastructure/`, legacy route handlers,
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
 * ML Analytics Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseMlAnalyticsStorage } from "./db-ml-analytics.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:MlAnalytics:Index");
import { DatabaseMlAnalyticsStorage } from "./db-ml-analytics.js";

export const dbMlAnalyticsStorage = new DatabaseMlAnalyticsStorage();

logger.info("[ML Analytics Repository] Loaded 4 modular files");
