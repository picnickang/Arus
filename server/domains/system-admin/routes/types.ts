import type { Express } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";

export type { Express, Request, Response };

export interface AdminUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface AdminSession {
  id: string;
  orgId: string;
  sessionToken: string;
  userId: string;
  adminEmail: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

export interface AdminAuditEvent {
  id: string;
  orgId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  outcome: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface AdminSystemSetting {
  id: string;
  orgId: string;
  category: string;
  key: string;
  value: string;
  dataType: string;
  description?: string;
  isSensitive: boolean;
  lastModifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStorage {
  getUserByEmail: (email: string, orgId: string) => Promise<AdminUser | null>;
  createUser: (data: Omit<AdminUser, "id">) => Promise<AdminUser>;
  createAdminSession: (data: Omit<AdminSession, "id" | "createdAt">) => Promise<AdminSession>;
  invalidateAllAdminSessions: () => Promise<void>;
  getAdminAuditEvents: (orgId?: string, action?: string, limit?: number) => Promise<AdminAuditEvent[]>;
  createAdminAuditEvent: (data: Omit<AdminAuditEvent, "id" | "createdAt">) => Promise<AdminAuditEvent>;
  getAuditEventsByUser: (userId: string, orgId?: string) => Promise<AdminAuditEvent[]>;
  getAuditEventsByResource: (resourceType: string, resourceId: string, orgId?: string) => Promise<AdminAuditEvent[]>;
  getAdminSystemSettings: (orgId?: string, category?: string) => Promise<AdminSystemSetting[]>;
  getAdminSystemSetting: (orgId: string, category: string, key: string) => Promise<AdminSystemSetting | null>;
  createAdminSystemSetting: (data: Omit<AdminSystemSetting, "id" | "createdAt" | "updatedAt">) => Promise<AdminSystemSetting>;
  updateAdminSystemSetting: (id: string, data: Partial<AdminSystemSetting>) => Promise<AdminSystemSetting>;
  deleteAdminSystemSetting: (id: string) => Promise<void>;
  getSettingsByCategory: (orgId: string, category: string) => Promise<AdminSystemSetting[]>;
  getIntegrationConfigs: (orgId?: string, type?: string) => Promise<Record<string, unknown>[]>;
  getIntegrationConfig: (id: string, orgId?: string) => Promise<Record<string, unknown> | null>;
  createIntegrationConfig: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  updateIntegrationConfig: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  deleteIntegrationConfig: (id: string) => Promise<void>;
  updateIntegrationHealth: (id: string, healthStatus: string, errorMessage?: string) => Promise<Record<string, unknown>>;
  getMaintenanceWindows: (orgId?: string, status?: string) => Promise<Record<string, unknown>[]>;
  getMaintenanceWindow: (id: string, orgId?: string) => Promise<Record<string, unknown> | null>;
  createMaintenanceWindow: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  updateMaintenanceWindow: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  deleteMaintenanceWindow: (id: string) => Promise<void>;
  getActiveMaintenanceWindows: (orgId?: string) => Promise<Record<string, unknown>[]>;
  getSystemPerformanceMetrics: (orgId?: string, category?: string, hours?: number) => Promise<Record<string, unknown>[]>;
  createSystemPerformanceMetric: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getLatestMetricsByCategory: (orgId: string, category: string) => Promise<Record<string, unknown>[]>;
  getMetricTrends: (orgId: string, metricName: string, hours?: number) => Promise<Record<string, unknown>[]>;
}

export interface ThresholdCalibrator {
  calibrateForEquipment: (orgId: string, equipmentId: string) => Promise<Record<string, unknown>>;
}

export interface SystemAdminDependencies {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: (req: unknown, res: unknown, next: () => void) => void;
  auditAdminAction: (action: string) => (req: unknown, res: unknown, next: () => void) => void;
  thresholdCalibrator: ThresholdCalibrator;
  adminPasswordVerifySchema: z.ZodSchema;
  adminPasswordChangeSchema: z.ZodSchema;
  insertAdminAuditEventSchema: z.ZodSchema;
  insertAdminSystemSettingSchema: z.ZodSchema;
  insertIntegrationConfigSchema: z.ZodSchema;
  insertMaintenanceWindowSchema: z.ZodSchema;
  insertSystemPerformanceMetricSchema: z.ZodSchema;
  AdminSessionResponse: z.ZodSchema;
}

export { z };
