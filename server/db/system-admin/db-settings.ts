/**
 * System Admin - Database Storage Settings, Integrations, Windows, Health
 */

import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db-config";
import {
  adminSystemSettings,
  integrationConfigs,
  maintenanceWindows,
  systemHealthChecks,
  systemPerformanceMetrics,
  systemSettings,
} from "@shared/schema-runtime";
import type {
  AdminSystemSetting,
  InsertAdminSystemSetting,
  IntegrationConfig,
  InsertIntegrationConfig,
  MaintenanceWindow,
  InsertMaintenanceWindow,
  SystemHealthCheck,
  InsertSystemHealthCheck,
  SystemPerformanceMetric,
} from "@shared/schema";
import type { SystemHealthResult } from "./types.js";

export class DbSettingsStorage {
  async getSettings() {
    const [settings] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.id, "system"));
    if (settings) {
      return settings;
    }
    const [created] = await db.insert(systemSettings).values({ id: "system" }).returning();
    return created;
  }

  async updateSettings(updates: Record<string, unknown>) {
    await this.getSettings();
    const [updated] = await db
      .update(systemSettings)
      .set(updates)
      .where(eq(systemSettings.id, "system"))
      .returning();
    return updated;
  }
  async getAdminSystemSettings(orgId?: string, category?: string): Promise<AdminSystemSetting[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(adminSystemSettings.orgId, orgId));
    }
    if (category) {
      conditions.push(eq(adminSystemSettings.category, category));
    }
    const base = db.select().from(adminSystemSettings);
    const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
    return query.orderBy(adminSystemSettings.key);
  }
  async getAdminSystemSetting(
    orgId: string,
    category: string,
    key: string
  ): Promise<AdminSystemSetting | undefined> {
    const [result] = await db
      .select()
      .from(adminSystemSettings)
      .where(
        and(
          eq(adminSystemSettings.orgId, orgId),
          eq(adminSystemSettings.category, category),
          eq(adminSystemSettings.key, key)
        )
      );
    return result;
  }
  async createAdminSystemSetting(setting: InsertAdminSystemSetting): Promise<AdminSystemSetting> {
    const [n] = await db
      .insert(adminSystemSettings)
      .values({ ...setting, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!n) {
      throw new Error("Failed to create admin system setting");
    }
    return n;
  }
  async updateAdminSystemSetting(
    id: string,
    setting: Partial<InsertAdminSystemSetting>
  ): Promise<AdminSystemSetting> {
    const [updated] = await db
      .update(adminSystemSettings)
      .set({ ...setting, updatedAt: new Date() })
      .where(eq(adminSystemSettings.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Admin system setting ${id} not found`);
    }
    return updated;
  }
  async deleteAdminSystemSetting(id: string): Promise<void> {
    const result = await db
      .delete(adminSystemSettings)
      .where(eq(adminSystemSettings.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`Admin system setting ${id} not found`);
    }
  }
  async getSettingsByCategory(orgId: string, category: string): Promise<AdminSystemSetting[]> {
    return db
      .select()
      .from(adminSystemSettings)
      .where(and(eq(adminSystemSettings.orgId, orgId), eq(adminSystemSettings.category, category)));
  }

  async getIntegrationConfigs(orgId?: string, type?: string): Promise<IntegrationConfig[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(integrationConfigs.orgId, orgId));
    }
    if (type) {
      conditions.push(eq(integrationConfigs.type, type));
    }
    const base = db.select().from(integrationConfigs);
    const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
    return query.orderBy(integrationConfigs.name);
  }
  async getIntegrationConfig(id: string, orgId?: string): Promise<IntegrationConfig | undefined> {
    const conditions = [eq(integrationConfigs.id, id)];
    if (orgId) {
      conditions.push(eq(integrationConfigs.orgId, orgId));
    }
    const [result] = await db
      .select()
      .from(integrationConfigs)
      .where(and(...conditions));
    return result;
  }
  async createIntegrationConfig(config: InsertIntegrationConfig): Promise<IntegrationConfig> {
    const [n] = await db
      .insert(integrationConfigs)
      .values({ ...config, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!n) {
      throw new Error("Failed to create integration config");
    }
    return n;
  }
  async updateIntegrationConfig(
    id: string,
    config: Partial<InsertIntegrationConfig>
  ): Promise<IntegrationConfig> {
    const [updated] = await db
      .update(integrationConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(integrationConfigs.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Integration config ${id} not found`);
    }
    return updated;
  }
  async deleteIntegrationConfig(id: string): Promise<void> {
    const result = await db
      .delete(integrationConfigs)
      .where(eq(integrationConfigs.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`Integration config ${id} not found`);
    }
  }
  async updateIntegrationHealth(
    id: string,
    healthStatus: string,
    errorMessage?: string
  ): Promise<IntegrationConfig> {
    const updates: Record<string, unknown> = {
      healthStatus,
      lastHealthCheck: new Date(),
      updatedAt: new Date(),
    };
    if (errorMessage !== undefined) {
      updates["errorMessage"] = errorMessage;
    }
    const [updated] = await db
      .update(integrationConfigs)
      .set(updates)
      .where(eq(integrationConfigs.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Integration config ${id} not found`);
    }
    return updated;
  }

  async getMaintenanceWindows(orgId?: string, status?: string): Promise<MaintenanceWindow[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(maintenanceWindows.orgId, orgId));
    }
    if (status) {
      conditions.push(eq(maintenanceWindows.status, status));
    }
    const base = db.select().from(maintenanceWindows);
    const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
    return query.orderBy(sql`${maintenanceWindows.startTime} DESC`);
  }
  async getMaintenanceWindow(id: string, orgId?: string): Promise<MaintenanceWindow | undefined> {
    const conditions = [eq(maintenanceWindows.id, id)];
    if (orgId) {
      conditions.push(eq(maintenanceWindows.orgId, orgId));
    }
    const [result] = await db
      .select()
      .from(maintenanceWindows)
      .where(and(...conditions));
    return result;
  }
  async createMaintenanceWindow(window: InsertMaintenanceWindow): Promise<MaintenanceWindow> {
    const [n] = await db
      .insert(maintenanceWindows)
      .values({ ...window, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!n) {
      throw new Error("Failed to create maintenance window");
    }
    return n;
  }
  async updateMaintenanceWindow(
    id: string,
    window: Partial<InsertMaintenanceWindow>
  ): Promise<MaintenanceWindow> {
    const [updated] = await db
      .update(maintenanceWindows)
      .set({ ...window, updatedAt: new Date() })
      .where(eq(maintenanceWindows.id, id))
      .returning();
    if (!updated) {
      throw new Error(`Maintenance window ${id} not found`);
    }
    return updated;
  }
  async deleteMaintenanceWindow(id: string): Promise<void> {
    const result = await db
      .delete(maintenanceWindows)
      .where(eq(maintenanceWindows.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error(`Maintenance window ${id} not found`);
    }
  }
  async getActiveMaintenanceWindows(orgId?: string): Promise<MaintenanceWindow[]> {
    const now = new Date();
    const conditions = [
      eq(maintenanceWindows.status, "active"),
      lte(maintenanceWindows.startTime, now),
      gte(maintenanceWindows.endTime, now),
    ];
    if (orgId) {
      conditions.push(eq(maintenanceWindows.orgId, orgId));
    }
    return db
      .select()
      .from(maintenanceWindows)
      .where(and(...conditions));
  }

  async getSystemHealthChecks(orgId?: string, category?: string): Promise<SystemHealthCheck[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(systemHealthChecks.orgId, orgId));
    }
    if (category) {
      conditions.push(eq(systemHealthChecks.category, category));
    }
    const base = db.select().from(systemHealthChecks);
    const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
    return query.orderBy(sql`${systemHealthChecks.updatedAt} DESC`);
  }
  async getSystemHealthCheck(id: string, orgId?: string): Promise<SystemHealthCheck | undefined> {
    const conditions = [eq(systemHealthChecks.id, id)];
    if (orgId) {
      conditions.push(eq(systemHealthChecks.orgId, orgId));
    }
    const [result] = await db
      .select()
      .from(systemHealthChecks)
      .where(and(...conditions));
    return result;
  }
  async createSystemHealthCheck(check: InsertSystemHealthCheck): Promise<SystemHealthCheck> {
    const [n] = await db
      .insert(systemHealthChecks)
      .values({ ...check, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    if (!n) {
      throw new Error("Failed to create system health check");
    }
    return n;
  }
  async updateSystemHealthCheck(
    id: string,
    check: Partial<InsertSystemHealthCheck>,
    orgId: string
  ): Promise<SystemHealthCheck> {
    const [updated] = await db
      .update(systemHealthChecks)
      .set({ ...check, updatedAt: new Date() })
      .where(and(eq(systemHealthChecks.id, id), eq(systemHealthChecks.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error(`System health check ${id} not found`);
    }
    return updated;
  }
  async deleteSystemHealthCheck(id: string, orgId: string): Promise<void> {
    const result = await db
      .delete(systemHealthChecks)
      .where(and(eq(systemHealthChecks.id, id), eq(systemHealthChecks.orgId, orgId)))
      .returning();
    if (result.length === 0) {
      throw new Error(`System health check ${id} not found`);
    }
  }
  async updateHealthCheckStatus(
    id: string,
    status: string,
    orgId: string,
    message?: string,
    responseTime?: number
  ): Promise<SystemHealthCheck> {
    const updates: Record<string, unknown> = {
      status,
      lastCheckAt: new Date(),
      updatedAt: new Date(),
    };
    if (message !== undefined) {
      updates["message"] = message;
    }
    if (responseTime !== undefined) {
      updates["responseTime"] = responseTime;
    }
    const [updated] = await db
      .update(systemHealthChecks)
      .set(updates)
      .where(and(eq(systemHealthChecks.id, id), eq(systemHealthChecks.orgId, orgId)))
      .returning();
    if (!updated) {
      throw new Error(`System health check ${id} not found`);
    }
    return updated;
  }
  async getFailingHealthChecks(orgId?: string): Promise<SystemHealthCheck[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(systemHealthChecks.orgId, orgId));
    }
    return db
      .select()
      .from(systemHealthChecks)
      .where(and(...conditions, eq(systemHealthChecks.status, "critical")))
      .orderBy(sql`${systemHealthChecks.updatedAt} DESC`);
  }
  async getMetricTrends(
    orgId: string,
    metricName: string,
    hours: number
  ): Promise<SystemPerformanceMetric[]> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    return db
      .select()
      .from(systemPerformanceMetrics)
      .where(
        and(
          eq(systemPerformanceMetrics.orgId, orgId),
          eq(systemPerformanceMetrics.metricName, metricName),
          gte(systemPerformanceMetrics.recordedAt, cutoff)
        )
      )
      .orderBy(systemPerformanceMetrics.recordedAt);
  }

  async getSystemHealth(orgId?: string): Promise<SystemHealthResult> {
    const checks = await this.getSystemHealthChecks(orgId);
    const configs = await this.getIntegrationConfigs(orgId);
    const windows = await this.getActiveMaintenanceWindows(orgId);
    const healthyCnt = checks.filter((c) => c.status === "healthy").length,
      warningCnt = checks.filter((c) => c.status === "warning").length,
      criticalCnt = checks.filter((c) => c.status === "critical").length;
    const healthyInt = configs.filter((c) => c.healthStatus === "healthy").length,
      unhealthyInt = configs.filter((c) => c.healthStatus === "unhealthy").length,
      unknownInt = configs.filter((c) => !c.healthStatus || c.healthStatus === "unknown").length;
    let overall: "healthy" | "warning" | "critical" = "healthy";
    if (criticalCnt > 0 || unhealthyInt > 2) {
      overall = "critical";
    } else if (warningCnt > 0 || unhealthyInt > 0) {
      overall = "warning";
    }
    return {
      overall,
      checks: { healthy: healthyCnt, warning: warningCnt, critical: criticalCnt },
      integrations: { healthy: healthyInt, unhealthy: unhealthyInt, unknown: unknownInt },
      activeMaintenanceWindows: windows.length,
      recentAuditEvents: 0,
      performanceIssues: 0,
    };
  }
}
