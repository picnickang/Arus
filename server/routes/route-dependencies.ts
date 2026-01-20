/**
 * Route Dependencies - Centralized dependency injection for domain routers
 * Extracted from routes.ts for modularization
 */

import multer from "multer";

// Rate limiters
export {
  telemetryRateLimit,
  bulkImportRateLimit,
  generalApiRateLimit,
  writeOperationRateLimit,
  criticalOperationRateLimit,
  crewOperationRateLimit,
  reportGenerationRateLimit,
} from "../middleware/rate-limiters";

// HMAC validation
export { validateHMAC } from "../middleware/hmac-validation";

// Auth & Security
export { requireOrgId, type AuthenticatedRequest } from "../middleware/auth";
export { requireValidOrgId, validateImportOrgId } from "../utils/orgIdValidation";
export {
  requireAdminAuth,
  auditAdminAction,
  additionalSecurityHeaders,
  sanitizeRequestData,
  detectAttackPatterns,
} from "../security";
export { auditMiddleware } from "../compliance/audit-middleware";

// Observability
export {
  metricsMiddleware,
  healthzEndpoint,
  readyzEndpoint,
  metricsEndpoint,
  dbIndexesHealthEndpoint,
  initializeMetrics,
  incrementHorImport,
  incrementHorComplianceCheck,
  incrementHorPdfExport,
  incrementIdempotencyHit,
  incrementTelemetryProcessed,
  incrementTelemetryError,
  incrementAlertGenerated,
  incrementAlertAcknowledged,
  incrementWorkOrder,
  incrementMaintenanceSchedule,
  incrementVesselOperation,
  incrementRangeQuery,
  recordRangeQueryDuration,
  updateEquipmentHealthStatus,
  updateFleetHealthScore,
  recordPdmScore,
} from "../observability";

// Error handling
export {
  safeDbOperation,
  safeExternalOperation,
  gracefulFallbacks,
  getErrorHandlingHealth,
  circuitBreaker,
} from "../error-handling";

// Logging
export { loggingContextMiddleware } from "../logging";

// Storage
export { storage } from "../storage";

// Sync
export { getSyncMetrics, processPendingEvents, recordAndPublish } from "../sync-events";

// ML & Analytics
export * as adaptiveTrainingWindow from "../adaptive-training-window";

// Scheduler
export { schedulerEventBus } from "../events/scheduler-bus.js";

// WebSocket
export { setWebSocketServer, getWebSocketServer } from "../websocket-server";
export { TelemetryWebSocketServer } from "../websocket";

// STCW Compliance
export { checkMonthCompliance, normalizeRestDays, type RestDay } from "../stcw-compliance";
export { renderRestPdf, generatePdfFilename } from "../stcw-pdf-generator";

// Database utilities
export {
  getDatabaseHealth,
  enableTimescaleDB,
  createHypertable,
  createContinuousAggregate,
  applyTelemetryRetention,
  getRetentionPolicy,
  updateRetentionPolicy,
  enableCompression,
} from "../db-utils";

export {
  getDatabasePerformanceHealth,
  getIndexOptimizationSuggestions,
  monitoredQuery,
  startPerformanceMonitoring,
} from "../db-performance";

export {
  createFullBackup,
  createSchemaBackup,
  listBackups,
  cleanupOldBackups,
  verifyBackupIntegrity,
  getBackupStatus,
} from "../backup-recovery";

// Services
export { getFMCCService } from "../integrations/aquametro-fmcc";
export { mlAnalyticsService } from "../ml-analytics-service";
export { digitalTwinService } from "../digital-twin/index";
export { getBridgeState } from "../services/sqlite-bridge";
export { isIngestionRunning } from "../ingestion/startIngestion";
export { mqttIngestionService } from "../mqtt-ingestion-service";

// Database
export { db } from "../db";

// Schema exports (used for admin validation)
export {
  adminPasswordVerifySchema,
  adminPasswordChangeSchema,
  insertAdminAuditEventSchema,
  insertAdminSystemSettingSchema,
  insertIntegrationConfigSchema,
  insertMaintenanceWindowSchema,
  insertSystemPerformanceMetricSchema,
  configAuditLog,
} from "@shared/schema-runtime";

// Multer upload configuration
// NOSONAR: S5443 - /tmp used for temporary import processing; files processed and removed
export const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/data-imports',
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/gzip' || 
        file.originalname.endsWith('.tar.gz') ||
        file.originalname.endsWith('.gz')) {
      cb(null, true);
    } else {
      cb(new Error('Only .tar.gz files are allowed'));
    }
  },
});

// Type for rate limiter dependencies
import type { RateLimitRequestHandler } from "express-rate-limit";
export interface RateLimiterDeps {
  telemetryRateLimit: RateLimitRequestHandler;
  bulkImportRateLimit: RateLimitRequestHandler;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  crewOperationRateLimit: RateLimitRequestHandler;
  reportGenerationRateLimit: RateLimitRequestHandler;
}
