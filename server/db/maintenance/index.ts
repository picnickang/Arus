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
