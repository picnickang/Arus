/**
 * System Admin - Types
 */

export type { AdminAuditEvent, InsertAdminAuditEvent, AdminSession, InsertAdminSession, AdminSystemSetting, InsertAdminSystemSetting, IntegrationConfig, InsertIntegrationConfig, MaintenanceWindow, InsertMaintenanceWindow, SystemHealthCheck, InsertSystemHealthCheck, SystemPerformanceMetric } from "@shared/schema-runtime";

export interface SystemHealthResult { overall: "healthy" | "warning" | "critical"; checks: { healthy: number; warning: number; critical: number }; integrations: { healthy: number; unhealthy: number; unknown: number }; activeMaintenanceWindows: number; recentAuditEvents: number; performanceIssues: number; }
