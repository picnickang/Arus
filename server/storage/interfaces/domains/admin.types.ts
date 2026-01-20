/**
 * Admin Storage Interface - Audit Events, Sessions, Settings, Health, Errors
 * Part of IStorage modularization for improved maintainability
 */

import type {
  AdminAuditEvent,
  InsertAdminAuditEvent,
  AdminSession,
  InsertAdminSession,
  AdminSystemSetting,
  InsertAdminSystemSetting,
  IntegrationConfig,
  InsertIntegrationConfig,
  MaintenanceWindow,
  InsertMaintenanceWindow,
  SystemPerformanceMetric,
  InsertSystemPerformanceMetric,
  SystemHealthCheck,
  InsertSystemHealthCheck,
  ErrorLog,
  InsertErrorLog,
  ContextEvent,
  InsertContextEvent,
} from "@shared/schema";

/**
 * Admin storage operations for system management and monitoring
 */
export interface IAdminStorage {
  // Admin Audit Events
  getAdminAuditEvents(filters?: { orgId?: string; adminUserId?: string; action?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<AdminAuditEvent[]>;
  createAdminAuditEvent(event: InsertAdminAuditEvent): Promise<AdminAuditEvent>;
  updateAdminAuditEvent(id: string, updates: Partial<Pick<AdminAuditEvent, "outcome" | "severity" | "details">>): Promise<AdminAuditEvent>;
  getAdminAuditEvent(id: string): Promise<AdminAuditEvent | undefined>;
  getAdminAuditStats(orgId?: string, days?: number): Promise<{ total: number; byAction: Record<string, number>; byUser: Record<string, number>; byDate: Record<string, number> }>;

  // Admin Sessions
  getAdminSessions(adminUserId?: string, isActive?: boolean): Promise<AdminSession[]>;
  createAdminSession(session: InsertAdminSession): Promise<AdminSession>;
  updateAdminSession(id: string, session: Partial<InsertAdminSession>): Promise<AdminSession>;
  endAdminSession(id: string, logoutType?: string): Promise<AdminSession>;
  cleanupExpiredSessions(): Promise<number>;

  // Admin System Settings
  getAdminSystemSettings(orgId?: string, category?: string): Promise<AdminSystemSetting[]>;
  getAdminSystemSetting(orgId: string, category: string, key: string): Promise<AdminSystemSetting | undefined>;
  createAdminSystemSetting(setting: InsertAdminSystemSetting): Promise<AdminSystemSetting>;
  updateAdminSystemSetting(id: string, setting: Partial<InsertAdminSystemSetting>): Promise<AdminSystemSetting>;
  deleteAdminSystemSetting(id: string): Promise<void>;
  getSettingsByCategory(orgId: string, category: string): Promise<AdminSystemSetting[]>;

  // Integration Configs
  getIntegrationConfigs(orgId?: string, type?: string): Promise<IntegrationConfig[]>;
  getIntegrationConfig(id: string, orgId?: string): Promise<IntegrationConfig | undefined>;
  createIntegrationConfig(config: InsertIntegrationConfig): Promise<IntegrationConfig>;
  updateIntegrationConfig(id: string, config: Partial<InsertIntegrationConfig>): Promise<IntegrationConfig>;
  deleteIntegrationConfig(id: string): Promise<void>;
  updateIntegrationHealth(id: string, healthStatus: string, errorMessage?: string): Promise<IntegrationConfig>;

  // Maintenance Windows
  getMaintenanceWindows(orgId?: string, status?: string): Promise<MaintenanceWindow[]>;
  getMaintenanceWindow(id: string, orgId?: string): Promise<MaintenanceWindow | undefined>;
  createMaintenanceWindow(window: InsertMaintenanceWindow): Promise<MaintenanceWindow>;
  updateMaintenanceWindow(id: string, window: Partial<InsertMaintenanceWindow>): Promise<MaintenanceWindow>;
  deleteMaintenanceWindow(id: string): Promise<void>;
  getActiveMaintenanceWindows(orgId?: string): Promise<MaintenanceWindow[]>;

  // System Performance Metrics
  getSystemPerformanceMetrics(orgId?: string, category?: string, hours?: number): Promise<SystemPerformanceMetric[]>;
  createSystemPerformanceMetric(metric: InsertSystemPerformanceMetric): Promise<SystemPerformanceMetric>;
  getLatestMetricsByCategory(orgId: string, category: string): Promise<SystemPerformanceMetric[]>;
  getMetricTrends(orgId: string, metricName: string, hours: number): Promise<SystemPerformanceMetric[]>;

  // System Health Checks
  getSystemHealthChecks(orgId?: string, category?: string): Promise<SystemHealthCheck[]>;
  getSystemHealthCheck(id: string, orgId?: string): Promise<SystemHealthCheck | undefined>;
  createSystemHealthCheck(check: InsertSystemHealthCheck): Promise<SystemHealthCheck>;
  updateSystemHealthCheck(id: string, check: Partial<InsertSystemHealthCheck>, orgId: string): Promise<SystemHealthCheck>;
  deleteSystemHealthCheck(id: string, orgId: string): Promise<void>;
  updateHealthCheckStatus(id: string, status: string, orgId: string, message?: string, responseTime?: number): Promise<SystemHealthCheck>;
  getFailingHealthChecks(orgId?: string): Promise<SystemHealthCheck[]>;
  getSystemHealth(orgId?: string): Promise<{ overall: "healthy" | "warning" | "critical"; checks: { healthy: number; warning: number; critical: number }; integrations: { healthy: number; unhealthy: number; unknown: number }; activeMaintenanceWindows: number; recentAuditEvents: number; performanceIssues: number }>;

  // Error Logs
  getErrorLogs(filters?: { orgId?: string; severity?: "info" | "warning" | "error" | "critical"; category?: "frontend" | "backend" | "api" | "database" | "security" | "performance"; resolved?: boolean; fromDate?: Date; toDate?: Date; limit?: number }): Promise<ErrorLog[]>;
  createErrorLog(log: InsertErrorLog): Promise<ErrorLog>;
  resolveErrorLog(id: string, resolvedBy: string): Promise<ErrorLog>;
  getErrorLogStats(orgId: string, days?: number): Promise<{ total: number; byCategory: Record<string, number>; bySeverity: Record<string, number>; resolved: number; unresolved: number }>;

  // Context Events
  getContextEvents(filters: { orgId: string; vesselId?: string; equipmentId?: string; from?: Date; to?: Date; type?: string }): Promise<ContextEvent[]>;
  getContextEvent(id: string, orgId: string): Promise<ContextEvent | undefined>;
  createContextEvent(event: InsertContextEvent): Promise<ContextEvent>;
  updateContextEvent(id: string, event: Partial<InsertContextEvent>, orgId: string): Promise<ContextEvent>;
  deleteContextEvent(id: string, orgId: string): Promise<void>;
}
