/**
 * System Admin Routes - Shared Types
 * Common interfaces and dependencies for all system admin route modules
 */

import type { Express } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { z } from "zod";

export type { Express, Request, Response };

export interface IStorage {
  getUserByEmail: (email: string, orgId: string) => Promise<any>;
  createUser: (data: any) => Promise<any>;
  createAdminSession: (data: any) => Promise<any>;
  invalidateAllAdminSessions: () => Promise<void>;
  getAdminAuditEvents: (orgId?: string, action?: string, limit?: number) => Promise<any[]>;
  createAdminAuditEvent: (data: any) => Promise<any>;
  getAuditEventsByUser: (userId: string, orgId?: string) => Promise<any[]>;
  getAuditEventsByResource: (resourceType: string, resourceId: string, orgId?: string) => Promise<any[]>;
  getAdminSystemSettings: (orgId?: string, category?: string) => Promise<any[]>;
  getAdminSystemSetting: (orgId: string, category: string, key: string) => Promise<any>;
  createAdminSystemSetting: (data: any) => Promise<any>;
  updateAdminSystemSetting: (id: string, data: any) => Promise<any>;
  deleteAdminSystemSetting: (id: string) => Promise<void>;
  getSettingsByCategory: (orgId: string, category: string) => Promise<any[]>;
  getIntegrationConfigs: (orgId?: string, type?: string) => Promise<any[]>;
  getIntegrationConfig: (id: string, orgId?: string) => Promise<any>;
  createIntegrationConfig: (data: any) => Promise<any>;
  updateIntegrationConfig: (id: string, data: any) => Promise<any>;
  deleteIntegrationConfig: (id: string) => Promise<void>;
  updateIntegrationHealth: (id: string, healthStatus: string, errorMessage?: string) => Promise<any>;
  getMaintenanceWindows: (orgId?: string, status?: string) => Promise<any[]>;
  getMaintenanceWindow: (id: string, orgId?: string) => Promise<any>;
  createMaintenanceWindow: (data: any) => Promise<any>;
  updateMaintenanceWindow: (id: string, data: any) => Promise<any>;
  deleteMaintenanceWindow: (id: string) => Promise<void>;
  getActiveMaintenanceWindows: (orgId?: string) => Promise<any[]>;
  getSystemPerformanceMetrics: (orgId?: string, category?: string, hours?: number) => Promise<any[]>;
  createSystemPerformanceMetric: (data: any) => Promise<any>;
  getLatestMetricsByCategory: (orgId: string, category: string) => Promise<any[]>;
  getMetricTrends: (orgId: string, metricName: string, hours?: number) => Promise<any[]>;
}

export interface ThresholdCalibrator {
  calibrateForEquipment: (orgId: string, equipmentId: string) => Promise<any>;
}

export interface SystemAdminDependencies {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
  thresholdCalibrator: ThresholdCalibrator;
  adminPasswordVerifySchema: z.ZodSchema;
  adminPasswordChangeSchema: z.ZodSchema;
  insertAdminAuditEventSchema: z.ZodSchema;
  insertAdminSystemSettingSchema: z.ZodSchema;
  insertIntegrationConfigSchema: z.ZodSchema;
  insertMaintenanceWindowSchema: z.ZodSchema;
  insertSystemPerformanceMetricSchema: z.ZodSchema;
  AdminSessionResponse: any;
}

export { z };
