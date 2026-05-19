/**
   * CANONICAL HOME — Notifications
   * ============================================================
   * This module is the single canonical home for Notifications data
   * access. Other layers (domain adapters under
   * `server/domains/notifications/infrastructure/`, legacy route handlers,
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
 * Notifications Repository - Modular Aggregator
 */

export * from "./types.js";
export { DatabaseNotificationsStorage } from "./db-notifications.js";

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Notifications:Index");
import { DatabaseNotificationsStorage } from "./db-notifications.js";

export const dbNotificationsStorage = new DatabaseNotificationsStorage();

logger.info("[Notifications Repository] Loaded 4 modular files");
