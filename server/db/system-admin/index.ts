/**
 * CANONICAL HOME — System Admin
 * ============================================================
 * This module is the single canonical home for System Admin data
 * access. Other layers (domain adapters under
 * `server/domains/system-admin/infrastructure/`, legacy route handlers,
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
 * System Admin Repository - Modular Aggregator
 */

import { randomUUID } from "node:crypto";
import { createLogger } from "../../lib/structured-logger";
import { isLocalMode } from "../../db-config";
const logger = createLogger("Db:SystemAdmin:Index");
import { DbAuditStorage } from "./db-audit.js";
import { DbSettingsStorage } from "./db-settings.js";
import type {
  InsertAdminSystemSetting,
  InsertIntegrationConfig,
  InsertMaintenanceWindow,
  InsertSystemHealthCheck,
} from "./types.js";

export * from "./types.js";
export { DbAuditStorage } from "./db-audit.js";
export { DbSettingsStorage } from "./db-settings.js";

type PartialSetting = Partial<InsertAdminSystemSetting>;
type PartialConfig = Partial<InsertIntegrationConfig>;
type PartialWindow = Partial<InsertMaintenanceWindow>;
type PartialCheck = Partial<InsertSystemHealthCheck>;

export class DatabaseSystemAdminStorage extends DbAuditStorage {
  private s = new DbSettingsStorage();
  async getSettings() {
    return this.s.getSettings();
  }
  async getPublicSettings() {
    return this.s.getPublicSettings();
  }
  async getDecryptedOpenAiKey() {
    return this.s.getDecryptedOpenAiKey();
  }
  async ensureSettingsSecretsMigrated() {
    return this.s.ensureSettingsSecretsMigrated();
  }
  async updateSettings(updates: Record<string, unknown>) {
    return this.s.updateSettings(updates);
  }
  async getAdminSystemSettings(orgId?: string, category?: string) {
    return this.s.getAdminSystemSettings(orgId, category);
  }
  async getAdminSystemSetting(orgId: string, category: string, key: string) {
    return this.s.getAdminSystemSetting(orgId, category, key);
  }
  async createAdminSystemSetting(setting: PartialSetting) {
    return this.s.createAdminSystemSetting(setting as InsertAdminSystemSetting);
  }
  async updateAdminSystemSetting(id: string, setting: PartialSetting) {
    return this.s.updateAdminSystemSetting(id, setting);
  }
  async deleteAdminSystemSetting(id: string) {
    return this.s.deleteAdminSystemSetting(id);
  }
  async getSettingsByCategory(orgId: string, category: string) {
    return this.s.getSettingsByCategory(orgId, category);
  }
  async getIntegrationConfigs(orgId?: string, type?: string) {
    return this.s.getIntegrationConfigs(orgId, type);
  }
  async getIntegrationConfig(id: string, orgId?: string) {
    return this.s.getIntegrationConfig(id, orgId);
  }
  async createIntegrationConfig(config: PartialConfig) {
    return this.s.createIntegrationConfig(config as InsertIntegrationConfig);
  }
  async updateIntegrationConfig(id: string, config: PartialConfig) {
    return this.s.updateIntegrationConfig(id, config);
  }
  async deleteIntegrationConfig(id: string) {
    return this.s.deleteIntegrationConfig(id);
  }
  async updateIntegrationHealth(id: string, healthStatus: string, errorMessage?: string) {
    return this.s.updateIntegrationHealth(id, healthStatus, errorMessage);
  }
  async getMaintenanceWindows(orgId?: string, status?: string) {
    return this.s.getMaintenanceWindows(orgId, status);
  }
  async getMaintenanceWindow(id: string, orgId?: string) {
    return this.s.getMaintenanceWindow(id, orgId);
  }
  async createMaintenanceWindow(window: PartialWindow) {
    return this.s.createMaintenanceWindow(window as InsertMaintenanceWindow);
  }
  async updateMaintenanceWindow(id: string, window: PartialWindow) {
    return this.s.updateMaintenanceWindow(id, window);
  }
  async deleteMaintenanceWindow(id: string) {
    return this.s.deleteMaintenanceWindow(id);
  }
  async getActiveMaintenanceWindows(orgId?: string) {
    return this.s.getActiveMaintenanceWindows(orgId);
  }
  async getSystemHealthChecks(orgId?: string, category?: string) {
    return this.s.getSystemHealthChecks(orgId, category);
  }
  async getSystemHealthCheck(id: string, orgId?: string) {
    return this.s.getSystemHealthCheck(id, orgId);
  }
  async createSystemHealthCheck(check: PartialCheck) {
    return this.s.createSystemHealthCheck(check as InsertSystemHealthCheck);
  }
  async updateSystemHealthCheck(id: string, check: PartialCheck, orgId: string) {
    return this.s.updateSystemHealthCheck(id, check, orgId);
  }
  async deleteSystemHealthCheck(id: string, orgId: string) {
    return this.s.deleteSystemHealthCheck(id, orgId);
  }
  async updateHealthCheckStatus(
    id: string,
    status: string,
    orgId: string,
    message?: string,
    responseTime?: number
  ) {
    return this.s.updateHealthCheckStatus(id, status, orgId, message, responseTime);
  }
  async getFailingHealthChecks(orgId?: string) {
    return this.s.getFailingHealthChecks(orgId);
  }
  async getMetricTrends(orgId: string, metricName: string, hours: number) {
    return this.s.getMetricTrends(orgId, metricName, hours);
  }
  async getSystemHealth(orgId?: string) {
    return this.s.getSystemHealth(orgId);
  }

  async getErrorLogs(filters?: {
    orgId?: string;
    level?: string;
    source?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>> {
    const { errorLogs } = await import("@shared/schema-runtime");
    const { eq, and, sql: sqlFn } = await import("drizzle-orm");
    const drizzleTypes = await import("drizzle-orm");
    type SQL = ReturnType<typeof drizzleTypes.sql>;
    const { db: database } = await import("../../db-config");
    const conditions: SQL[] = [];
    if (filters?.orgId) {
      conditions.push(eq(errorLogs.orgId, filters.orgId));
    }
    if (filters?.level) {
      conditions.push(eq(errorLogs.severity, filters.level));
    }
    if (filters?.source) {
      conditions.push(eq(errorLogs.category, filters.source));
    }
    let query = database.select().from(errorLogs).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    query = query.orderBy(sqlFn`${errorLogs.timestamp} DESC`);
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    return query;
  }

  async createErrorLog(
    log: Record<string, unknown> & { orgId?: string }
  ): Promise<Record<string, unknown>> {
    if (!log.orgId) {
      throw new Error("orgId is required for createErrorLog");
    }
    const { errorLogs } = await import("@shared/schema-runtime");
    const { db: database } = await import("../../db-config");
    const now = new Date();
    const message =
      typeof log["message"] === "string" && log["message"]
        ? log["message"]
        : String(log["errorMessage"] ?? "Unknown error");
    const category =
      typeof log["category"] === "string" && log["category"]
        ? log["category"]
        : typeof log["errorType"] === "string" && log["errorType"]
          ? log["errorType"]
          : "application";
    const errorType =
      typeof log["errorType"] === "string" && log["errorType"] ? log["errorType"] : category;
    const context =
      isLocalMode && typeof log["context"] === "object" && log["context"] !== null
        ? JSON.stringify(log["context"])
        : log["context"];
    const values = {
      ...log,
      ...(isLocalMode && { id: typeof log["id"] === "string" ? log["id"] : randomUUID() }),
      category,
      context,
      createdAt: log["createdAt"] instanceof Date ? log["createdAt"] : now,
      errorMessage:
        typeof log["errorMessage"] === "string" && log["errorMessage"]
          ? log["errorMessage"]
          : message,
      errorType,
      message,
      timestamp: log["timestamp"] instanceof Date ? log["timestamp"] : now,
    };
    const [newLog] = await database
      .insert(errorLogs)
      .values(values as never)
      .returning();
    if (!newLog) {
      throw new Error("Failed to create error log");
    }
    return newLog as Record<string, unknown>;
  }

  async deleteErrorLog(id: string, orgId?: string): Promise<void> {
    const { errorLogs } = await import("@shared/schema-runtime");
    const { eq, and } = await import("drizzle-orm");
    const { db: database } = await import("../../db-config");
    const conditions = orgId
      ? and(eq(errorLogs.id, id), eq(errorLogs.orgId, orgId))
      : eq(errorLogs.id, id);
    await database.delete(errorLogs).where(conditions);
  }

  async clearErrorLogs(olderThan?: Date, orgId?: string): Promise<void> {
    const { errorLogs } = await import("@shared/schema-runtime");
    const { sql: sqlFn, eq, and } = await import("drizzle-orm");
    const drizzleTypes = await import("drizzle-orm");
    type SQL = ReturnType<typeof drizzleTypes.sql>;
    const { db: database } = await import("../../db-config");
    const conditions: SQL[] = [];
    if (orgId) {
      conditions.push(eq(errorLogs.orgId, orgId));
    }
    if (olderThan) {
      conditions.push(sqlFn`${errorLogs.timestamp} < ${olderThan}`);
    }
    if (conditions.length > 0) {
      await database.delete(errorLogs).where(and(...conditions));
    } else {
      await database.delete(errorLogs);
    }
  }
}

export const dbSystemAdminStorage = new DatabaseSystemAdminStorage();

logger.info("[System Admin Repository] Loaded 6 modular files");
