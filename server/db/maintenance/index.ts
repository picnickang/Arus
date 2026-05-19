/**
   * CANONICAL HOME — Maintenance
   * ============================================================
   * This module is the single canonical home for Maintenance data
   * access. Other layers (domain adapters under
   * `server/domains/maintenance/infrastructure/`, legacy route handlers,
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
 * Maintenance Repository - Modular Aggregator
 */

import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Db:Maintenance:Index");
import { DbMaintenanceSchedules } from "./db-schedules.js";
import { DbMaintenanceTemplates } from "./db-templates.js";

export * from "./types.js";
export { DbMaintenanceSchedules } from "./db-schedules.js";
export { DbMaintenanceTemplates } from "./db-templates.js";

export class DatabaseMaintenanceStorage extends DbMaintenanceSchedules {
  private templates = new DbMaintenanceTemplates();
  async getMaintenanceTemplates(orgId?: string, equipmentType?: string) {
    return this.templates.getMaintenanceTemplates(orgId, equipmentType);
  }
  async getMaintenanceTemplate(id: string, orgId?: string) {
    return this.templates.getMaintenanceTemplate(id, orgId);
  }
  async createMaintenanceTemplate(template: any) {
    return this.templates.createMaintenanceTemplate(template);
  }
  async updateMaintenanceTemplate(id: string, updates: any, orgId?: string) {
    return this.templates.updateMaintenanceTemplate(id, updates, orgId);
  }
  async deleteMaintenanceTemplate(id: string, orgId?: string) {
    return this.templates.deleteMaintenanceTemplate(id, orgId);
  }
  async cloneMaintenanceTemplate(id: string, orgId: string) {
    return this.templates.cloneMaintenanceTemplate(id, orgId);
  }
}

export const dbMaintenanceStorage = new DatabaseMaintenanceStorage();

logger.info("[Maintenance Repository] Loaded 6 modular files");
