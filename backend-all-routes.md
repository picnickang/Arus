# ARUS — Complete Backend Routes (All Categories)

Generated: 2026-03-26T02:29:08Z

Categories: Operations, Fleet, Maintenance, Crew, Logistics, Records, Analytics, System

---

## Operations (Alerts, Notifications, Telemetry, IoT, DTC)

### `server/domains/alerts/routes.ts` (276 lines)

```ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  insertAlertConfigSchema,
  insertAlertNotificationSchema,
  insertAlertCommentSchema,
  insertAlertSuppressionSchema,
} from "@shared/schema-runtime";
import { alertsService } from "./service";
import { withErrorHandling, handleApiError, sendNotFound } from "../../lib/route-utils";

/**
 * Alerts Routes
 * Handles HTTP concerns for alerts domain (configurations, notifications, suppressions, comments)
 */
export function registerAlertsRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  },
  wsServerInstance?: any
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ========== Main Alerts Endpoints (Aliases for Notifications) ==========

  // GET /api/alerts - List all alerts (alias for /api/alerts/notifications)
  app.get(
    "/api/alerts",
    generalApiRateLimit,
    withErrorHandling("fetch alerts", async (req: Request, res: Response) => {
      const { acknowledged } = req.query;
      const ackParam =
        acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const notifications = await alertsService.listNotifications(ackParam);
      res.json(notifications);
    })
  );

  // POST /api/alerts - Create alert (alias for /api/alerts/notifications)
  app.post(
    "/api/alerts",
    writeOperationRateLimit,
    withErrorHandling("create alert", async (req: Request, res: Response) => {
      const notificationData = insertAlertNotificationSchema.parse(req.body);
      const notification = await alertsService.createNotification(
        notificationData,
        req.user?.id,
        wsServerInstance
      );
      res.status(201).json(notification);
    })
  );

  // ========== Alert Configurations ==========

  // GET /api/alerts/configurations
  app.get(
    "/api/alerts/configurations",
    generalApiRateLimit,
    withErrorHandling("fetch alert configurations", async (req: Request, res: Response) => {
      const { equipmentId } = req.query;
      const configurations = await alertsService.listConfigurations(equipmentId as string);
      res.json(configurations);
    })
  );

  // POST /api/alerts/configurations
  app.post(
    "/api/alerts/configurations",
    writeOperationRateLimit,
    withErrorHandling("create alert configuration", async (req: Request, res: Response) => {
      const configData = insertAlertConfigSchema.parse(req.body);
      const configuration = await alertsService.createConfiguration(configData, req.user?.id);
      res.status(201).json(configuration);
    })
  );

  // PUT /api/alerts/configurations/:id
  app.put(
    "/api/alerts/configurations/:id",
    writeOperationRateLimit,
    withErrorHandling("update alert configuration", async (req: Request, res: Response) => {
      const configData = insertAlertConfigSchema.partial().parse(req.body);
      const configuration = await alertsService.updateConfiguration(
        req.params.id,
        configData,
        req.user?.id
      );
      res.json(configuration);
    })
  );

  // DELETE /api/alerts/configurations/:id
  app.delete(
    "/api/alerts/configurations/:id",
    criticalOperationRateLimit,
    withErrorHandling("delete alert configuration", async (req: Request, res: Response) => {
      await alertsService.deleteConfiguration(req.params.id, req.user?.id);
      res.status(204).send();
    })
  );

  // ========== Alert Notifications ==========

  // GET /api/alerts/notifications
  app.get(
    "/api/alerts/notifications",
    generalApiRateLimit,
    withErrorHandling("fetch alert notifications", async (req: Request, res: Response) => {
      const { acknowledged } = req.query;
      const ackParam =
        acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const notifications = await alertsService.listNotifications(ackParam);
      res.json(notifications);
    })
  );

  // POST /api/alerts/notifications
  app.post(
    "/api/alerts/notifications",
    writeOperationRateLimit,
    withErrorHandling("create alert notification", async (req: Request, res: Response) => {
      const notificationData = insertAlertNotificationSchema.parse(req.body);
      const notification = await alertsService.createNotification(
        notificationData,
        req.user?.id,
        wsServerInstance
      );
      res.status(201).json(notification);
    })
  );

  // PATCH /api/alerts/notifications/:id/acknowledge
  app.patch(
    "/api/alerts/notifications/:id/acknowledge",
    writeOperationRateLimit,
    withErrorHandling("acknowledge alert", async (req: Request, res: Response) => {
      const { acknowledgedBy } = req.body;
      if (!acknowledgedBy) {
        return res.status(400).json({ message: "acknowledgedBy is required" });
      }

      const notification = await alertsService.acknowledgeNotification(
        req.params.id,
        acknowledgedBy,
        req.user?.id,
        wsServerInstance
      );

      res.json(notification);
    })
  );

  // ========== Alert Comments ==========

  // POST /api/alerts/notifications/:id/comment
  app.post(
    "/api/alerts/notifications/:id/comment",
    writeOperationRateLimit,
    withErrorHandling("add comment", async (req: Request, res: Response) => {
      const commentData = insertAlertCommentSchema.parse({
        alertId: req.params.id,
        comment: req.body.comment,
        commentedBy: req.body.commentedBy,
      });

      const result = await alertsService.addComment(commentData, req.user?.id);
      res.json(result);
    })
  );

  // GET /api/alerts/notifications/:id/comments
  app.get(
    "/api/alerts/notifications/:id/comments",
    generalApiRateLimit,
    withErrorHandling("get comments", async (req: Request, res: Response) => {
      const comments = await alertsService.getComments(req.params.id);
      res.json(comments);
    })
  );

  // ========== Alert Suppressions ==========

  // POST /api/alerts/suppress
  app.post(
    "/api/alerts/suppress",
    writeOperationRateLimit,
    withErrorHandling("create alert suppression", async (req: Request, res: Response) => {
      const suppressionData = insertAlertSuppressionSchema.parse(req.body);
      const result = await alertsService.createSuppression(
        suppressionData,
        req.user?.id,
        wsServerInstance
      );
      res.json(result);
    })
  );

  // GET /api/alerts/suppressions
  app.get(
    "/api/alerts/suppressions",
    generalApiRateLimit,
    withErrorHandling("get suppressions", async (req: Request, res: Response) => {
      const suppressions = await alertsService.listSuppressions();
      res.json(suppressions);
    })
  );

  // DELETE /api/alerts/suppressions/:id
  app.delete(
    "/api/alerts/suppressions/:id",
    criticalOperationRateLimit,
    withErrorHandling("remove suppression", async (req: Request, res: Response) => {
      await alertsService.deleteSuppression(req.params.id, req.user?.id);
      res.json({ message: "Suppression removed" });
    })
  );

  // ========== Special Operations ==========

  // POST /api/alerts/notifications/:id/escalate - Escalate alert to work order
  app.post(
    "/api/alerts/notifications/:id/escalate",
    writeOperationRateLimit,
    async (req: Request, res: Response) => {
      try {
        const escalationSchema = z.object({
          reason: z.string().optional(),
          priority: z.number().min(1).max(3).optional(),
          description: z.string().optional(),
        });

        const escalationData = escalationSchema.parse(req.body);

        const { storage } = await import("../../storage");

        const createWorkOrderFn = async (data: any) => {
          const workOrder = await storage.createWorkOrder(data);

          if (wsServerInstance) {
            wsServerInstance.broadcastWorkOrderCreated(workOrder);
          }

          return workOrder;
        };

        const workOrder = await alertsService.escalateNotification(
          req.params.id,
          escalationData,
          createWorkOrderFn,
          req.user?.id
        );

        res.json(workOrder);
      } catch (error) {
        if (error instanceof Error && error.message === "Alert not found") {
          return sendNotFound(res, "Alert");
        }
        handleApiError(res, error, "escalate alert");
      }
    }
  );

  // DELETE /api/alerts/all - Clear all alerts and notifications
  app.delete(
    "/api/alerts/all",
    criticalOperationRateLimit,
    withErrorHandling("clear alerts", async (req: Request, res: Response) => {
      await alertsService.deleteAllNotifications(req.user?.id, wsServerInstance);
      res.json({ message: "All alerts and notifications cleared successfully" });
    })
  );
}

```

### `server/domains/notifications/routes.ts` (168 lines)

```ts
import type { Express } from "express";
import { storage } from "../../storage";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface RateLimiters {
  writeOperationRateLimit: any;
  criticalOperationRateLimit: any;
  generalApiRateLimit: any;
}

export function registerNotificationRoutes(app: Express, rateLimiters?: RateLimiters): void {
  const writeOperationRateLimit = rateLimiters?.writeOperationRateLimit || ((req: any, res: any, next: any) => next());

  // ===== NOTIFICATION SETTINGS ROUTES =====

  app.get("/api/notifications/settings",
    withErrorHandling("get notification settings", async (req, res) => {
      const orgId = req.orgId;
      const filters = {
        vesselId: req.query.vesselId as string | undefined,
        notificationType: req.query.notificationType as string | undefined,
      };
      
      const settings = await storage.getNotificationSettings(orgId, filters);
      res.json(settings);
    })
  );

  app.get("/api/notifications/settings/:id",
    withErrorHandling("get notification setting", async (req, res) => {
      const orgId = req.orgId;
      const setting = await storage.getNotificationSettingById(req.params.id, orgId);
      
      if (!setting) {
        return sendNotFound(res, "Notification setting");
      }
      
      res.json(setting);
    })
  );

  app.post("/api/notifications/settings", writeOperationRateLimit,
    withErrorHandling("create notification setting", async (req, res) => {
      const orgId = req.orgId;
      const setting = await storage.createNotificationSetting({
        ...req.body,
        orgId,
      });
      sendCreated(res, setting);
    })
  );

  app.patch("/api/notifications/settings/:id", writeOperationRateLimit,
    withErrorHandling("update notification setting", async (req, res) => {
      const orgId = req.orgId;
      const setting = await storage.updateNotificationSetting(req.params.id, req.body, orgId);
      res.json(setting);
    })
  );

  app.delete("/api/notifications/settings/:id", writeOperationRateLimit,
    withErrorHandling("delete notification setting", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteNotificationSetting(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  // ===== NOTIFICATION QUEUE ROUTES =====

  app.get("/api/notifications/queue",
    withErrorHandling("get notification queue", async (req, res) => {
      const orgId = req.orgId;
      const filters = {
        status: req.query.status as string | undefined,
        notificationType: req.query.notificationType as string | undefined,
        scheduledBefore: req.query.scheduledBefore ? new Date(req.query.scheduledBefore as string) : undefined,
      };
      
      const queue = await storage.getNotificationQueue(orgId, filters);
      res.json(queue);
    })
  );

  app.post("/api/notifications/queue", writeOperationRateLimit,
    withErrorHandling("create notification queue item", async (req, res) => {
      const orgId = req.orgId;
      const item = await storage.createNotificationQueueItem({
        ...req.body,
        orgId,
      });
      sendCreated(res, item);
    })
  );

  app.delete("/api/notifications/queue/:id", writeOperationRateLimit,
    withErrorHandling("delete notification queue item", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteNotificationQueueItem(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  // ===== EMAIL NOTIFICATION ROUTES =====

  app.get("/api/notifications/email/status",
    withErrorHandling("get email notification status", async (req, res) => {
      const { emailNotificationService } = await import("../../services/email-notification-service");
      res.json(emailNotificationService.getStatus());
    })
  );

  app.post("/api/notifications/email/process-digest", writeOperationRateLimit,
    withErrorHandling("process digest queue", async (req, res) => {
      const { emailNotificationService } = await import("../../services/email-notification-service");
      const processedCount = await emailNotificationService.processDigestQueue();
      res.json({ success: true, processedCount });
    })
  );

  app.post("/api/notifications/email/retry-failed", writeOperationRateLimit,
    withErrorHandling("retry failed notifications", async (req, res) => {
      const { emailNotificationService } = await import("../../services/email-notification-service");
      const maxAttempts = Number(req.query.maxAttempts) || 3;
      const retryCount = await emailNotificationService.retryFailedNotifications(maxAttempts);
      res.json({ success: true, retryCount });
    })
  );

  app.post("/api/notifications/email/test", writeOperationRateLimit,
    withErrorHandling("send test notification", async (req, res) => {
      const { email, subject, message } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email address required" });
      }
      
      const orgId = req.orgId;
      const item = await storage.createNotificationQueueItem({
        orgId,
        notificationType: "test",
        subject: subject || "ARUS Marine Test Notification",
        body: message || "This is a test notification from ARUS Marine.",
        bodyHtml: `<div style="font-family: Arial, sans-serif;"><h2>Test Notification</h2><p>${message || "This is a test notification from ARUS Marine."}</p></div>`,
        recipients: [email],
        status: "pending",
      });
      
      const { emailNotificationService } = await import("../../services/email-notification-service");
      const status = emailNotificationService.getStatus();
      
      if (status.enabled) {
        await emailNotificationService.retryFailedNotifications(1);
      }
      
      res.json({ 
        success: true, 
        queued: true,
        emailEnabled: status.enabled,
        message: status.enabled 
          ? "Test notification sent" 
          : "Test notification queued (email not configured - check logs)",
      });
    })
  );

  logger.info("NotificationRoutes", "Registered (settings: 5, queue: 3, email: 4)");
}

```

### `server/domains/telemetry/routes.ts` (137 lines)

```ts
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

const telemetryQuerySchema = z.object({
  equipmentId: z.string().uuid().optional(),
  vesselId: z.string().uuid().optional(),
  hours: z.coerce.number().int().positive().default(24),
});

/**
 * Telemetry Domain Routes
 * 
 * Handles telemetry data read operations:
 * - Latest readings query
 * - Telemetry history and trends
 * - Edge device heartbeats
 * - Bulk data cleanup
 * 
 * Note: Complex telemetry ingestion routes with HMAC validation 
 * and sensor configuration processing remain in routes.ts
 */
export function registerTelemetryRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
    telemetryRateLimit: any;
  }
) {
  const { criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ========== TELEMETRY READ ROUTES ==========

  // Get latest telemetry readings
  app.get("/api/telemetry/latest", generalApiRateLimit,
    withErrorHandling("fetch latest telemetry readings", async (req, res) => {
      const vesselId = req.query.vesselId as string | undefined;
      const equipmentId = req.query.equipmentId as string | undefined;
      const sensorType = req.query.sensorType as string | undefined;
      const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 500;

      const readings = await storage.getLatestTelemetryReadings(
        vesselId,
        equipmentId,
        sensorType,
        limit
      );

      res.json(readings);
    })
  );

  // Get telemetry trends (equipmentId is optional for fleet-wide view)
  app.get("/api/telemetry/trends", generalApiRateLimit,
    withErrorHandling("fetch telemetry trends", async (req, res) => {
      const queryValidation = telemetryQuerySchema.parse(req.query);
      const { equipmentId, hours } = queryValidation;

      const trends = await storage.getTelemetryTrends(equipmentId, hours);
      res.json(trends);
    })
  );

  // Get telemetry history for equipment/sensor
  app.get("/api/telemetry/history/:equipmentId/:sensorType", generalApiRateLimit,
    withErrorHandling("fetch telemetry history", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const hours = req.query.hours ? Number.parseInt(req.query.hours as string) : 24;
      const history = await storage.getTelemetryHistory(equipmentId, sensorType, hours);
      res.json(history);
    })
  );

  // Clear orphaned telemetry data
  app.delete("/api/telemetry/cleanup", criticalOperationRateLimit,
    withErrorHandling("clear telemetry data", async (req, res) => {
      await storage.clearOrphanedTelemetryData();
      res.json({
        ok: true,
        message: "Telemetry data cleared successfully",
      });
    })
  );

  // ========== EDGE HEARTBEAT ROUTES ==========

  // Get all edge heartbeats
  app.get("/api/edge/heartbeats", generalApiRateLimit,
    withErrorHandling("fetch heartbeats", async (req, res) => {
      const heartbeats = await storage.getHeartbeats();
      res.json(heartbeats);
    })
  );

  // ========== SENSOR CONFIGURATION ROUTES ==========

  // Get sensor configurations
  app.get("/api/sensor-configs", generalApiRateLimit,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = req.query;
      const orgId = req.orgId!;

      const configs = await storage.getSensorConfigurations(
        orgId,
        equipmentId as string,
        sensorType as string
      );
      res.json(configs);
    })
  );

  // Get single sensor configuration
  app.get("/api/sensor-config", generalApiRateLimit,
    withErrorHandling("fetch sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = req.query;
      const orgId = req.orgId!;

      const configs = await storage.getSensorConfigurations(
        orgId,
        equipmentId as string,
        sensorType as string
      );
      
      if (configs.length === 0) {
        return sendNotFound(res, "Sensor configuration");
      }
      
      res.json(configs[0]);
    })
  );

  logger.info("TelemetryRoutes", "Telemetry read routes registered (readings: 4, heartbeats: 1, configs: 2)");
}

```

### `server/routes/telemetry-ingestion-routes.ts` (288 lines)

```ts
import { Router } from 'express';
import { logger } from '../utils/logger';
import { rawTelemetryArchiveAdapter } from '../telemetry/adapters/raw-archive';
import { equipmentHeartbeatAdapter } from '../telemetry/adapters/equipment-heartbeat';
import { telemetryBatchAckAdapter } from '../telemetry/adapters/batch-ack';
import { schemaRegistryAdapter } from '../telemetry/adapters/schema-registry';
import { DEFAULT_ORG_ID } from '@shared/config/tenant';

export const telemetryIngestionRouter = Router();

telemetryIngestionRouter.get('/archive/status', async (_req, res) => {
  try {
    const metrics = await rawTelemetryArchiveAdapter.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get archive status', { error });
    res.status(500).json({ error: 'Failed to get archive status' });
  }
});

telemetryIngestionRouter.get('/archive/pending', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const archives = await rawTelemetryArchiveAdapter.getPendingArchives(limit);
    res.json({ archives, count: archives.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get pending archives', { error });
    res.status(500).json({ error: 'Failed to get pending archives' });
  }
});

telemetryIngestionRouter.get('/archive/failed', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const archives = await rawTelemetryArchiveAdapter.getFailedArchives(limit);
    res.json({ archives, count: archives.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get failed archives', { error });
    res.status(500).json({ error: 'Failed to get failed archives' });
  }
});

telemetryIngestionRouter.post('/archive/:id/retry', async (req, res) => {
  try {
    await rawTelemetryArchiveAdapter.retryFailed(req.params.id);
    res.json({ success: true, archiveId: req.params.id });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to retry archive', { error });
    res.status(500).json({ error: 'Failed to retry archive' });
  }
});

telemetryIngestionRouter.post('/archive/prune', async (req, res) => {
  try {
    const retentionDays = Number(req.query.retentionDays) || 30;
    const removed = await rawTelemetryArchiveAdapter.pruneOldArchives(retentionDays);
    res.json({ success: true, removed });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to prune archives', { error });
    res.status(500).json({ error: 'Failed to prune archives' });
  }
});

telemetryIngestionRouter.get('/heartbeat/status', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const metrics = await equipmentHeartbeatAdapter.getMetricsByOrg(orgId);
    res.json(metrics);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get heartbeat status', { error });
    res.status(500).json({ error: 'Failed to get heartbeat status' });
  }
});

telemetryIngestionRouter.get('/heartbeat/online', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const thresholdMs = req.query.thresholdMs ? Number(req.query.thresholdMs) : undefined;
    const equipment = await equipmentHeartbeatAdapter.getOnlineEquipment(orgId, thresholdMs);
    res.json({ equipment, count: equipment.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get online equipment', { error });
    res.status(500).json({ error: 'Failed to get online equipment' });
  }
});

telemetryIngestionRouter.get('/heartbeat/offline', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const thresholdMs = req.query.thresholdMs ? Number(req.query.thresholdMs) : undefined;
    const equipment = await equipmentHeartbeatAdapter.getOfflineEquipment(orgId, thresholdMs);
    res.json({ equipment, count: equipment.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get offline equipment', { error });
    res.status(500).json({ error: 'Failed to get offline equipment' });
  }
});

telemetryIngestionRouter.get('/heartbeat/:equipmentId', async (req, res) => {
  try {
    const heartbeat = await equipmentHeartbeatAdapter.getHeartbeat(req.params.equipmentId);
    if (!heartbeat) {
      return res.status(404).json({ error: 'Equipment heartbeat not found' });
    }
    res.json(heartbeat);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get equipment heartbeat', { error });
    res.status(500).json({ error: 'Failed to get equipment heartbeat' });
  }
});

telemetryIngestionRouter.post('/heartbeat/update-status', async (_req, res) => {
  try {
    const result = await equipmentHeartbeatAdapter.updateOnlineStatus();
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to update online status', { error });
    res.status(500).json({ error: 'Failed to update online status' });
  }
});

telemetryIngestionRouter.get('/batch/status', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const metrics = await telemetryBatchAckAdapter.getMetrics(orgId);
    res.json(metrics);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get batch status', { error });
    res.status(500).json({ error: 'Failed to get batch status' });
  }
});

telemetryIngestionRouter.get('/batch/recent', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const limit = Number(req.query.limit) || 100;
    const deviceId = req.query.deviceId as string | undefined;
    const source = req.query.source as string | undefined;
    
    const batches = await telemetryBatchAckAdapter.getRecentBatches(orgId, { limit, deviceId, source });
    res.json({ batches, count: batches.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get recent batches', { error });
    res.status(500).json({ error: 'Failed to get recent batches' });
  }
});

telemetryIngestionRouter.get('/batch/unacknowledged', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const limit = Number(req.query.limit) || 100;
    
    const batches = await telemetryBatchAckAdapter.getUnacknowledgedBatches(orgId, limit);
    res.json({ batches, count: batches.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get unacknowledged batches', { error });
    res.status(500).json({ error: 'Failed to get unacknowledged batches' });
  }
});

telemetryIngestionRouter.get('/batch/failed', async (req, res) => {
  try {
    const orgId = (req.query.orgId as string) || DEFAULT_ORG_ID;
    const limit = Number(req.query.limit) || 100;
    
    const batches = await telemetryBatchAckAdapter.getFailedBatches(orgId, limit);
    res.json({ batches, count: batches.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get failed batches', { error });
    res.status(500).json({ error: 'Failed to get failed batches' });
  }
});

telemetryIngestionRouter.get('/batch/:batchId', async (req, res) => {
  try {
    const batch = await telemetryBatchAckAdapter.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get batch', { error });
    res.status(500).json({ error: 'Failed to get batch' });
  }
});

telemetryIngestionRouter.post('/batch/:batchId/retry', async (req, res) => {
  try {
    await telemetryBatchAckAdapter.retryBatch(req.params.batchId);
    res.json({ success: true, batchId: req.params.batchId });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to retry batch', { error });
    res.status(500).json({ error: 'Failed to retry batch' });
  }
});

telemetryIngestionRouter.post('/batch/prune', async (req, res) => {
  try {
    const retentionDays = Number(req.query.retentionDays) || 7;
    const removed = await telemetryBatchAckAdapter.pruneOldBatches(retentionDays);
    res.json({ success: true, removed });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to prune batches', { error });
    res.status(500).json({ error: 'Failed to prune batches' });
  }
});

telemetryIngestionRouter.get('/schema', async (req, res) => {
  try {
    const protocol = req.query.protocol as string | undefined;
    const schemas = await schemaRegistryAdapter.listSchemas(protocol);
    res.json({ schemas, count: schemas.length });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to list schemas', { error });
    res.status(500).json({ error: 'Failed to list schemas' });
  }
});

telemetryIngestionRouter.get('/schema/:protocol', async (req, res) => {
  try {
    const version = req.query.version ? Number(req.query.version) : undefined;
    const schema = version 
      ? await schemaRegistryAdapter.getSchema(req.params.protocol, version)
      : await schemaRegistryAdapter.getActiveSchema(req.params.protocol);
    
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    res.json(schema);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to get schema', { error });
    res.status(500).json({ error: 'Failed to get schema' });
  }
});

telemetryIngestionRouter.post('/schema', async (req, res) => {
  try {
    const schema = await schemaRegistryAdapter.registerSchema(req.body);
    res.status(201).json(schema);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to register schema', { error });
    const message = error instanceof Error ? error.message : 'Failed to register schema';
    res.status(400).json({ error: message });
  }
});

telemetryIngestionRouter.post('/schema/:protocol/:version/deprecate', async (req, res) => {
  try {
    await schemaRegistryAdapter.deprecateSchema(req.params.protocol, Number(req.params.version));
    res.json({ success: true });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to deprecate schema', { error });
    res.status(500).json({ error: 'Failed to deprecate schema' });
  }
});

telemetryIngestionRouter.post('/schema/:protocol/:version/activate', async (req, res) => {
  try {
    await schemaRegistryAdapter.activateSchema(req.params.protocol, Number(req.params.version));
    res.json({ success: true });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to activate schema', { error });
    res.status(500).json({ error: 'Failed to activate schema' });
  }
});

telemetryIngestionRouter.post('/schema/validate', async (req, res) => {
  try {
    const { protocol, version, payload } = req.body;
    const result = await schemaRegistryAdapter.validatePayload(protocol, version, payload);
    res.json(result);
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to validate payload', { error });
    res.status(500).json({ error: 'Failed to validate payload' });
  }
});

telemetryIngestionRouter.post('/schema/seed-defaults', async (_req, res) => {
  try {
    await schemaRegistryAdapter.seedDefaultSchemas();
    res.json({ success: true, message: 'Default schemas seeded' });
  } catch (error) {
    logger.error('TelemetryIngestionRoutes', 'Failed to seed default schemas', { error });
    res.status(500).json({ error: 'Failed to seed default schemas' });
  }
});

console.log('[TelemetryIngestionRoutes] Registered: archive, heartbeat, batch, schema endpoints');

```

### `server/routes/telemetry-dlq-routes.ts` (135 lines)

```ts
import { Router } from 'express';
import { getBridgeDeadLetterQueue, getBridgeCircuitBreaker, getBridgeState } from '../services/sqlite-bridge';
import { logger } from '../utils/logger';

export const telemetryDlqRouter = Router();

telemetryDlqRouter.get('/status', async (_req, res) => {
  const dlq = getBridgeDeadLetterQueue();
  const circuitBreaker = getBridgeCircuitBreaker();
  const bridgeState = getBridgeState();

  const dlqMetrics = 'getMetricsAsync' in dlq ? await (dlq as any).getMetricsAsync() : dlq.getMetrics();

  res.json({
    dlq: dlqMetrics,
    circuitBreaker: {
      state: circuitBreaker.getState(),
      metrics: circuitBreaker.getMetrics(),
    },
    bridge: {
      isRunning: bridgeState.isRunning,
      pgOffline: bridgeState.pgOffline,
      lagFrames: bridgeState.lagFrames,
      lastSuccessAt: bridgeState.lastSuccessAt ? new Date(bridgeState.lastSuccessAt).toISOString() : null,
      retryBackoffMs: bridgeState.retryBackoffMs,
    },
  });
});

telemetryDlqRouter.get('/entries', async (_req, res) => {
  const dlq = getBridgeDeadLetterQueue();
  const limit = Number(_req.query.limit) || 100;
  const offset = Number(_req.query.offset) || 0;
  const source = _req.query.source as string | undefined;

  const entries = 'listAsync' in dlq 
    ? await (dlq as any).listAsync({ limit, offset, source }) 
    : dlq.list({ limit, offset, source });
  res.json({ entries, count: entries.length });
});

telemetryDlqRouter.get('/entries/:id', async (req, res) => {
  const dlq = getBridgeDeadLetterQueue();
  const entry = 'getAsync' in dlq 
    ? await (dlq as any).getAsync(req.params.id) 
    : dlq.get(req.params.id);

  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  res.json(entry);
});

telemetryDlqRouter.post('/entries/:id/replay', async (req, res) => {
  const dlq = getBridgeDeadLetterQueue();
  const circuitBreaker = getBridgeCircuitBreaker();

  if (circuitBreaker.isOpen()) {
    return res.status(503).json({
      success: false,
      error: 'Circuit breaker is open - PostgreSQL unavailable',
      circuitState: circuitBreaker.getState(),
    });
  }

  const result = await dlq.replay(req.params.id);
  
  if (result.success) {
    logger.info('TelemetryDLQRoutes', 'Entry replayed successfully', { entryId: req.params.id });
    res.json(result);
  } else {
    logger.warn('TelemetryDLQRoutes', 'Entry replay failed', { entryId: req.params.id, error: result.error });
    res.status(400).json(result);
  }
});

telemetryDlqRouter.post('/replay-all', async (req, res) => {
  const dlq = getBridgeDeadLetterQueue();
  const circuitBreaker = getBridgeCircuitBreaker();

  if (circuitBreaker.isOpen()) {
    return res.status(503).json({
      success: false,
      error: 'Circuit breaker is open - PostgreSQL unavailable',
      circuitState: circuitBreaker.getState(),
    });
  }

  const limit = Number(req.query.limit) || 100;
  const source = req.query.source as string | undefined;

  const results = await dlq.replayAll({ limit, source });
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  logger.info('TelemetryDLQRoutes', 'Replay all completed', { successCount, failureCount });

  res.json({
    total: results.length,
    successCount,
    failureCount,
    results,
  });
});

telemetryDlqRouter.delete('/entries/:id', async (req, res) => {
  const dlq = getBridgeDeadLetterQueue();
  const entry = 'getAsync' in dlq 
    ? await (dlq as any).getAsync(req.params.id) 
    : dlq.get(req.params.id);

  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }

  if ('deleteAsync' in dlq) {
    await (dlq as any).deleteAsync(req.params.id);
  }

  res.json({ success: true, entryId: req.params.id, message: 'Entry removed' });
});

telemetryDlqRouter.post('/prune', async (_req, res) => {
  const dlq = getBridgeDeadLetterQueue();
  const removed = 'pruneAsync' in dlq 
    ? await (dlq as any).pruneAsync() 
    : dlq.prune();
  
  logger.info('TelemetryDLQRoutes', 'DLQ pruned', { removedCount: removed });
  res.json({ success: true, removed });
});

console.log('[TelemetryDLQRoutes] Registered: GET/POST /status, /entries, /entries/:id, /replay-all, /prune');

```

### `server/domains/iot-processing/routes.ts` (180 lines)

```ts
/**
 * IoT Processing Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 * 
 * Provides MQTT device management, ML analytics, and Digital Twin operations
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

interface MqttIngestionService {
  registerMqttDevice: (deviceData: any) => Promise<any>;
  getMqttDevices: () => Promise<any[]>;
  getHealthStatus: () => any;
}

interface MlAnalyticsService {
  detectAnomalies: (orgId: string, equipmentId: string, sensorType: string, value: number, timestamp: Date) => Promise<any>;
  getHealthStatus: () => any;
}

interface DigitalTwinService {
  createDigitalTwin: (vesselId: string, twinType: string, name: string, specifications: any, physicsModel: any) => Promise<any>;
  getDigitalTwins: (vesselId?: string) => Promise<any[]>;
  runSimulation: (twinId: string, scenarioName: string, scenario: any) => Promise<any>;
  getHealthStatus: () => any;
}

interface IotProcessingDependencies {
  writeOperationRateLimit: RateLimitRequestHandler;
  mqttIngestionService: MqttIngestionService;
  mlAnalyticsService: MlAnalyticsService;
  digitalTwinService: DigitalTwinService;
}

export function registerIotProcessingRoutes(
  app: Express,
  deps: IotProcessingDependencies
): void {
  const {
    writeOperationRateLimit,
    mqttIngestionService,
    mlAnalyticsService,
    digitalTwinService,
  } = deps;

  // ========================================
  // MQTT Real-time Data Ingestion API Routes
  // ========================================

  // Register MQTT device
  app.post("/api/mqtt/devices", writeOperationRateLimit,
    withErrorHandling("register MQTT device", async (req: Request, res: Response) => {
      const deviceData = req.body;
      const mqttDevice = await mqttIngestionService.registerMqttDevice(deviceData);
      res.status(201).json(mqttDevice);
    })
  );

  // Get MQTT devices
  app.get("/api/mqtt/devices",
    withErrorHandling("fetch MQTT devices", async (req: Request, res: Response) => {
      const devices = await mqttIngestionService.getMqttDevices();
      res.json(devices);
    })
  );

  // MQTT service health check
  app.get("/api/mqtt/health",
    withErrorHandling("get MQTT health status", async (req: Request, res: Response) => {
      const health = mqttIngestionService.getHealthStatus();
      res.json({
        service: "MQTT Ingestion Service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // ========================================
  // ML Analytics API Routes
  // ========================================

  // Detect anomalies for equipment/sensor
  app.post("/api/ml/anomaly-detection", writeOperationRateLimit,
    withErrorHandling("detect anomalies", async (req: Request, res: Response) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, sensorType, value, timestamp } = req.body;

      const result = await mlAnalyticsService.detectAnomalies(
        orgId,
        equipmentId,
        sensorType,
        value,
        timestamp ? new Date(timestamp) : new Date()
      );

      res.json(result);
    })
  );

  // Predict equipment failure (DEPRECATED - redirects to /api/ml/predict/failure)
  app.post("/api/ml/failure-prediction", writeOperationRateLimit, async (req: Request, res: Response) => {
    res.setHeader(
      "X-Deprecation-Warning",
      "This endpoint is deprecated. Use /api/ml/predict/failure instead."
    );
    res.setHeader("X-New-Endpoint", "/api/ml/predict/failure");
    res.redirect(307, "/api/ml/predict/failure");
  });

  // ML Analytics service health check
  app.get("/api/ml/health",
    withErrorHandling("get ML Analytics health status", async (req: Request, res: Response) => {
      const health = mlAnalyticsService.getHealthStatus();
      res.json({
        service: "ML Analytics Service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // ========================================
  // Digital Twin API Routes
  // ========================================

  // Create digital twin
  app.post("/api/digital-twins", writeOperationRateLimit,
    withErrorHandling("create digital twin", async (req: Request, res: Response) => {
      const { vesselId, twinType, name, specifications, physicsModel } = req.body;

      const digitalTwin = await digitalTwinService.createDigitalTwin(
        vesselId,
        twinType,
        name,
        specifications,
        physicsModel
      );

      res.status(201).json(digitalTwin);
    })
  );

  // Get digital twins
  app.get("/api/digital-twins",
    withErrorHandling("fetch digital twins", async (req: Request, res: Response) => {
      const { vesselId } = req.query;
      const twins = await digitalTwinService.getDigitalTwins(vesselId as string);
      res.json(twins);
    })
  );

  // Run simulation scenario
  app.post("/api/digital-twins/:twinId/simulate", writeOperationRateLimit,
    withErrorHandling("run simulation", async (req: Request, res: Response) => {
      const { twinId } = req.params;
      const { scenarioName, scenario } = req.body;

      const simulation = await digitalTwinService.runSimulation(twinId, scenarioName, scenario);
      res.status(201).json(simulation);
    })
  );

  // Digital Twin service health check
  app.get("/api/digital-twins/health",
    withErrorHandling("get Digital Twin health status", async (req: Request, res: Response) => {
      const health = digitalTwinService.getHealthStatus();
      res.json({
        service: "Digital Twin Service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  logger.info("IoTProcessingRoutes", "Registered (mqtt: 3, ml-analytics: 3, digital-twin: 4)");
}

```

### `server/domains/dtc/routes.ts` (347 lines)

```ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { insertDtcFaultSchema } from "../../../shared/schema.js";
import { withErrorHandling, sendNotFound, sendCreated } from "../../lib/route-utils.js";
import { logger } from "../../utils/logger.js";

interface DtcRoutesConfig {
  storage: any;
  writeOperationRateLimit: any;
  getWebSocketServer: () => any;
}

const dtcDefinitionsQuerySchema = z.object({
  spn: z.string().regex(/^\d+$/).transform(Number).optional(),
  fmi: z.string().regex(/^\d+$/).transform(Number).optional(),
  manufacturer: z.string().optional(),
});

const dtcHistoryQuerySchema = z.object({
  spn: z.string().regex(/^\d+$/).transform(Number).optional(),
  fmi: z.string().regex(/^\d+$/).transform(Number).optional(),
  severity: z
    .string()
    .regex(/^[1-4]$/)
    .transform(Number)
    .optional(),
  from: z
    .string()
    .datetime()
    .transform((s) => new Date(s))
    .optional(),
  to: z
    .string()
    .datetime()
    .transform((s) => new Date(s))
    .optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const dtcActiveQuerySchema = z.object({
  vesselId: z.string().optional(),
  severity: z
    .string()
    .regex(/^[1-4]$/)
    .transform(Number)
    .optional(),
});

export function registerDtcRoutes(app: Express, config: DtcRoutesConfig) {
  const { storage, writeOperationRateLimit, getWebSocketServer } = config;

  app.get("/api/dtc/definitions",
    withErrorHandling("fetch DTC definitions", async (req: Request, res: Response) => {
      const validation = dtcDefinitionsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const { spn, fmi, manufacturer } = validation.data;
      const definitions = await storage.getDtcDefinitions(spn, fmi, manufacturer);

      res.json(definitions);
    })
  );

  app.get("/api/equipment/:id/dtc/active",
    withErrorHandling("fetch active DTCs", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(id, orgId);
      res.json(activeDtcs);
    })
  );

  app.get("/api/equipment/:id/dtc/history",
    withErrorHandling("fetch DTC history", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const validation = dtcHistoryQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const filters = validation.data;
      const history = await storage.getDtcHistory(id, orgId, filters);
      res.json(history);
    })
  );

  app.get("/api/dtc/active",
    withErrorHandling("fetch all active DTCs", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const validation = dtcActiveQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: validation.error.errors,
        });
      }

      const { vesselId, severity } = validation.data;

      const equipmentList = vesselId
        ? await storage.getEquipmentByVessel(vesselId, orgId)
        : await storage.getEquipmentRegistry(orgId);

      const allActiveDtcs = await Promise.all(
        equipmentList.map(async (eq: any) => {
          const dtcs = await storage.getActiveDtcs(eq.id, orgId);
          return dtcs.map((dtc: any) => ({ ...dtc, equipment: eq }));
        })
      );

      let flatDtcs = allActiveDtcs.flat();
      if (severity) {
        flatDtcs = flatDtcs.filter((dtc: any) => dtc.definition?.severity === severity);
      }

      res.json(flatDtcs);
    })
  );

  app.post("/api/dtc/faults", writeOperationRateLimit,
    withErrorHandling("create DTC fault", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const faultData = insertDtcFaultSchema.parse({ ...req.body, orgId });

      const equipment = await storage.getEquipment(orgId, faultData.equipmentId);
      if (!equipment) {
        return sendNotFound(res, "Equipment");
      }

      const dtcFault = await storage.upsertDtcFault(faultData);

      const activeDtcs = await storage.getActiveDtcs(dtcFault.equipmentId, orgId);
      const enrichedFault = activeDtcs.find(
        (d: any) => d.spn === dtcFault.spn && d.fmi === dtcFault.fmi
      );

      sendCreated(res, enrichedFault || dtcFault);
    })
  );

  app.get("/api/dtc/dashboard-stats",
    withErrorHandling("fetch DTC dashboard statistics", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const stats = await dtcService.getDtcDashboardStats(orgId);

      res.json(stats);
    })
  );

  app.post("/api/dtc/:equipmentId/:spn/:fmi/create-work-order",
    withErrorHandling("create work order from DTC", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcs.find((d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi));

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const workOrder = await dtcService.createWorkOrderFromDtc(dtc, orgId);

      if (!workOrder) {
        return res.status(400).json({
          message: "Work order not created - DTC is not critical or work order already exists",
        });
      }

      sendCreated(res, workOrder);
    })
  );

  app.post("/api/dtc/:equipmentId/:spn/:fmi/create-alert",
    withErrorHandling("create alert from DTC", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcs.find((d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi));

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const alert = await dtcService.createDtcAlert(dtc, orgId);

      if (!alert) {
        return res.status(400).json({
          message: "Alert not created - DTC does not meet alert criteria or recent alert exists",
        });
      }

      if (getWebSocketServer()) {
        getWebSocketServer().broadcast("alerts", {
          type: "new_alert",
          alert,
          timestamp: new Date().toISOString(),
        });
      }

      sendCreated(res, alert);
    })
  );

  app.get("/api/equipment/:id/dtc/health-impact",
    withErrorHandling("calculate DTC health impact", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(id, orgId);
      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const healthPenalty = dtcService.calculateDtcHealthImpact(activeDtcs);

      res.json({
        equipmentId: id,
        activeDtcCount: activeDtcs.length,
        healthPenalty,
        estimatedHealthScore: Math.max(0, 100 - healthPenalty),
      });
    })
  );

  app.get("/api/vessel/:vesselId/dtc/financial-impact",
    withErrorHandling("calculate vessel financial impact", async (req: Request, res: Response) => {
      const { vesselId } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const impact = await dtcService.calculateDtcFinancialImpact(vesselId, orgId);

      res.json(impact);
    })
  );

  app.get("/api/equipment/:id/dtc/report-summary",
    withErrorHandling("get DTC report summary", async (req: Request, res: Response) => {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const summary = await dtcService.getDtcSummaryForReports(id, orgId);

      res.json(summary);
    })
  );

  app.get("/api/dtc/:equipmentId/:spn/:fmi/telemetry-correlation",
    withErrorHandling("correlate DTC with telemetry", async (req: Request, res: Response) => {
      const { equipmentId, spn, fmi } = req.params;
      const orgId = req.headers["x-org-id"] as string;
      const timeWindow = req.query.timeWindow ? Number.parseInt(req.query.timeWindow as string) : 60;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }

      const activeDtcs = await storage.getActiveDtcs(equipmentId, orgId);
      const dtc = activeDtcs.find((d: any) => d.spn === Number.parseInt(spn) && d.fmi === Number.parseInt(fmi));

      if (!dtc) {
        return sendNotFound(res, "DTC not found or not active");
      }

      const { getDtcIntegrationService } = await import("../../dtc-integration-service.js");
      const dtcService = getDtcIntegrationService();
      const telemetry = await dtcService.correlateDtcWithTelemetry(dtc, orgId, timeWindow);

      res.json({
        dtc: {
          spn: dtc.spn,
          fmi: dtc.fmi,
          description: dtc.definition?.description,
          firstSeen: dtc.firstSeen,
          lastSeen: dtc.lastSeen,
        },
        telemetryReadings: telemetry,
        timeWindowMinutes: timeWindow,
      });
    })
  );

  logger.info("DTCRoutes", "Registered (definitions: 1, faults: 5, integration: 6)");
}

```

### `server/domains/devices/routes.ts` (90 lines)

```ts
import type { Express } from "express";
import { insertDeviceSchema } from "@shared/schema-runtime";
import { deviceService } from "./service";
import { safeDbOperation } from "../../error-handling";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../middleware/auth";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";

/**
 * Devices Routes
 * Handles HTTP concerns for devices domain
 */
export function registerDeviceRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // GET /api/devices
  app.get("/api/devices", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch devices", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const devices = await safeDbOperation(
        () => deviceService.getDevicesWithStatus(orgId),
        "getDevicesWithStatus",
        { defaultValue: [] }
      );

      res.json(devices);
    })
  );

  // GET /api/devices/:id
  app.get("/api/devices/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch device", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const device = await deviceService.getDeviceById(req.params.id, orgId);

      if (!device) {
        return sendNotFound(res, "Device");
      }

      res.json(device);
    })
  );

  // POST /api/devices
  app.post("/api/devices", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("create device", async (req, res) => {
      const deviceData = insertDeviceSchema.parse(req.body);
      const device = await deviceService.createDevice(deviceData, req.user?.id);

      sendCreated(res, device);
    })
  );

  // PUT /api/devices/:id
  app.put("/api/devices/:id", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("update device", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const deviceData = insertDeviceSchema.partial().parse(req.body);
      const device = await deviceService.updateDevice(
        req.params.id,
        deviceData,
        orgId,
        req.user?.id
      );

      res.json(device);
    })
  );

  // DELETE /api/devices/:id
  app.delete("/api/devices/:id", requireOrgId, criticalOperationRateLimit,
    withErrorHandling("delete device", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await deviceService.deleteDevice(req.params.id, orgId, req.user?.id);

      sendDeleted(res);
    })
  );
}

```

---

## Fleet (Vessels, Vessel Performance, CII, StormGeo, Sync)

### `server/domains/vessels/routes.ts` (208 lines)

```ts
import type { Express } from "express";
import { vesselsService } from "./service";
import { insertVesselSchema } from "@shared/schema-runtime";
import { requireAdminAuth, auditAdminAction } from "../../security";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
} from "../../middleware/auth";
import {
  withErrorHandling,
  handleApiError,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../lib/route-utils";
import { requirePermission } from "../permissions/middleware";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

function getOrgIdFromRequest(req: any): string {
  return req.orgId || DEFAULT_ORG_ID;
}

export function registerVesselsRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimiters;

  app.get(
    "/api/vessels",
    generalApiRateLimit,
    withErrorHandling("fetch vessels", async (req, res) => {
      const { org_id } = req.query;
      const vessels = await vesselsService.listVessels(org_id as string | undefined);
      res.json(vessels);
    })
  );

  app.post(
    "/api/vessels",
    requireOrgIdAndValidateBody,
    requirePermission("vessels", "create"),
    writeOperationRateLimit,
    withErrorHandling("create vessel", async (req, res) => {
      const validationResult = insertVesselSchema.safeParse({
        ...req.body,
        orgId: getOrgIdFromRequest(req),
      });

      if (!validationResult.success) {
        return handleApiError(res, validationResult.error, "create vessel");
      }

      const vessel = await vesselsService.createVessel(validationResult.data);
      sendCreated(res, vessel);
    })
  );

  app.get(
    "/api/vessels/:id",
    generalApiRateLimit,
    withErrorHandling("fetch vessel", async (req, res) => {
      const vessel = await vesselsService.getVesselById(req.params.id);
      if (!vessel) {
        return sendNotFound(res, "Vessel");
      }
      res.json(vessel);
    })
  );

  app.put(
    "/api/vessels/:id",
    requireOrgIdAndValidateBody,
    requirePermission("vessels", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update vessel", async (req, res) => {
      const validationResult = insertVesselSchema.partial().safeParse(req.body);

      if (!validationResult.success) {
        return handleApiError(res, validationResult.error, "update vessel");
      }

      const vessel = await vesselsService.updateVessel(req.params.id, validationResult.data);
      if (!vessel) {
        return sendNotFound(res, "Vessel");
      }
      res.json(vessel);
    })
  );

  app.delete(
    "/api/vessels/:id",
    ...requireAdminAuth,
    requirePermission("vessels", "delete"),
    auditAdminAction("delete_vessel"),
    criticalOperationRateLimit,
    withErrorHandling("delete vessel", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      await vesselsService.deleteVessel(req.params.id, true, orgId);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/vessels/:id/export",
    ...requireAdminAuth,
    auditAdminAction("export_vessel"),
    criticalOperationRateLimit,
    withErrorHandling("export vessel", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const exportData = await vesselsService.exportVessel(req.params.id, orgId);

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="vessel-${req.params.id}-export.json"`
      );
      res.json(exportData);
    })
  );

  app.post(
    "/api/vessels/import",
    ...requireAdminAuth,
    auditAdminAction("import_vessel"),
    criticalOperationRateLimit,
    withErrorHandling("import vessel", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const result = await vesselsService.importVessel(req.body, orgId);
      sendCreated(res, result);
    })
  );

  app.post(
    "/api/vessels/:id/reset-downtime",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("reset vessel downtime", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const result = await vesselsService.resetDowntime(req.params.id, orgId);
      res.json(result);
    })
  );

  app.post(
    "/api/vessels/:id/reset-operation",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("reset vessel operation", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const result = await vesselsService.resetOperation(req.params.id, orgId);
      res.json(result);
    })
  );

  app.post(
    "/api/vessels/:id/wipe-data",
    ...requireAdminAuth,
    auditAdminAction("wipe_vessel_data"),
    criticalOperationRateLimit,
    withErrorHandling("wipe vessel data", async (req, res) => {
      const orgId = DEFAULT_ORG_ID;
      const result = await vesselsService.wipeData(req.params.id, orgId);
      res.json(result);
    })
  );

  app.get(
    "/api/vessels/:id/equipment",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch vessel equipment", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const equipment = await vesselsService.getVesselEquipment(req.params.id, orgId);
      res.json(equipment);
    })
  );

  app.post(
    "/api/vessels/:vesselId/equipment/:equipmentId",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("assign equipment to vessel", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const { vesselId, equipmentId } = req.params;

      const result = await vesselsService.assignEquipment(vesselId, equipmentId, orgId);
      res.json(result);
    })
  );

  app.delete(
    "/api/vessels/:vesselId/equipment/:equipmentId",
    requireOrgId,
    writeOperationRateLimit,
    withErrorHandling("unassign equipment from vessel", async (req, res) => {
      const orgId = getOrgIdFromRequest(req);
      const { vesselId, equipmentId } = req.params;

      const result = await vesselsService.unassignEquipment(vesselId, equipmentId, orgId);
      res.json(result);
    })
  );
}

```

### `server/domains/vessel-performance/routes/types.ts` (20 lines)

```ts
/**
 * Vessel Performance Routes - Shared Types
 */

import type { Express, Request, Response } from "express";
import type { IStorage } from "../../../storage";
import type { RateLimitRequestHandler } from "express-rate-limit";

export interface AuthenticatedRequest extends Request {
  orgId?: string;
}

export interface VesselPerformanceRoutesConfig {
  storage: IStorage;
  crewOperationRateLimit: RateLimitRequestHandler;
}

export type RouteRegisterFn = (app: Express, config: VesselPerformanceRoutesConfig) => void;

export { Request, Response };

```

### `server/domains/vessel-performance/routes/index.ts` (26 lines)

```ts
/**
 * Vessel Performance Routes - Modular Registration
 */

import type { Express } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { registerVPSRoutes } from "./vps-routes.js";
import { registerCIIRoutes } from "./cii-routes.js";
import { registerModeRoutes } from "./mode-routes.js";
import { registerNarrativeRoutes } from "./narrative-routes.js";
import { registerSchedulingRoutes } from "./scheduling-routes.js";
import { logger } from "../../../utils/logger.js";

export type { VesselPerformanceRoutesConfig } from "./types.js";

export function registerVesselPerformanceRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  logger.info("VesselPerformanceRoutes", "Registering VPS API endpoints");

  registerVPSRoutes(app, config);
  registerCIIRoutes(app, config);
  registerModeRoutes(app, config);
  registerNarrativeRoutes(app, config);
  registerSchedulingRoutes(app, config);

  logger.info("VesselPerformanceRoutes", "Registered (vps: 2, cii: 2, mode: 1, narrative: 1, enhanced-scheduling: 1)");
}

```

### `server/domains/vessel-performance/routes/vps-routes.ts` (83 lines)

```ts
/**
 * Vessel Performance Routes - VPS Analysis Endpoints
 * Power vs Speed Through Water + Fleet Benchmarks
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";

export function registerVPSRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  const { storage } = config;

  app.get("/api/vessels/:id/power-stw-analysis", withErrorHandling("compute power-STW analysis", async (req: Request, res: Response) => {
    const vesselId = req.params.id, orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const vessel = await storage.getVessel(vesselId, orgId);
    if (!vessel) {return res.status(404).json({ message: "Vessel not found" });}

    const now = new Date(), defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : defaultStart;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {return res.status(400).json({ message: "Invalid date format. Use ISO 8601 strings." });}
    if (startDate > endDate) {return res.status(400).json({ message: "Start date must be before end date" });}

    const vesselEquipment = await storage.getEquipmentByVessel(vesselId, orgId);
    const allTelemetry: any[] = [];
    for (const equipment of vesselEquipment) {
      const telemetry = await storage.getTelemetryByEquipment(equipment.id, startDate, endDate, orgId);
      allTelemetry.push(...telemetry);
    }

    const telemetryMap = new Map<number, { rpm?: number; torque?: number; stw?: number }>();
    for (const reading of allTelemetry) {
      const timestamp = new Date(reading.timestamp).getTime();
      if (!telemetryMap.has(timestamp)) {telemetryMap.set(timestamp, {});}
      const entry = telemetryMap.get(timestamp)!;
      if (reading.sensor_type === "rpm" || reading.sensor_type === "engine_rpm") {entry.rpm = reading.value;}
      else if (reading.sensor_type === "shaft_torque" || reading.sensor_type === "torque") {entry.torque = reading.value;}
      else if (reading.sensor_type === "speed" || reading.sensor_type === "stw" || reading.sensor_type === "gps_speed") {entry.stw = reading.value;}
    }

    const completeReadings = Array.from(telemetryMap.entries()).filter(([_, data]) => data.rpm && data.torque).map(([timestamp, data]) => ({ timestamp, rpm: data.rpm!, torque: data.torque!, stw: data.stw }));
    const { calculatePowerSTWCurve } = await import("../../../vps-kpi-service.js");
    const rpm = completeReadings.map(r => r.rpm), torque = completeReadings.map(r => r.torque), stw = completeReadings.map(r => r.stw).filter(s => s !== undefined) as number[];
    const actualCurve = calculatePowerSTWCurve(rpm, torque, stw.length > 0 ? stw : undefined);
    const sortedActual = actualCurve.filter((p: any) => p.y > 0 && p.x > 0).sort((a: any, b: any) => a.x - b.x);
    const baselineCurve: { x: number; y: number }[] = [];

    if (sortedActual.length > 0) {
      const medianIndex = Math.floor(sortedActual.length / 2), refSpeed = sortedActual[medianIndex].x, refPower = sortedActual[medianIndex].y;
      const minSpeed = Math.min(...sortedActual.map((p: any) => p.x)), maxSpeed = Math.max(...sortedActual.map((p: any) => p.x)), speedStep = (maxSpeed - minSpeed) / 20;
      for (let speed = minSpeed; speed <= maxSpeed; speed += speedStep) {baselineCurve.push({ x: speed, y: refPower * Math.pow(speed / refSpeed, 3) });}
    }

    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ actual: actualCurve, baseline: baselineCurve, metadata: { vesselId, vesselName: vessel.name, sampleCount: completeReadings.length, period: { start: startDate.toISOString(), end: endDate.toISOString() }, timezone: "UTC", hasSTWData: stw.length > 0, estimatedSTW: stw.length === 0 } });
  }));

  app.get("/api/fleet/benchmarks", withErrorHandling("compute fleet benchmarks", async (req: Request, res: Response) => {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const now = new Date(), defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : defaultStart;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {return res.status(400).json({ message: "Invalid date format. Use ISO 8601 strings." });}
    if (startDate > endDate) {return res.status(400).json({ message: "Start date must be before end date" });}

    const vesselType = req.query.vesselType as string | undefined;
    const { computeFleetLoadBenchmarks, computeFleetPowerSTWBenchmarks } = await import("../../../vps-kpi-service.js");
    const [loadBenchmarks, powerSTWBenchmarks] = await Promise.all([
      computeFleetLoadBenchmarks(orgId, { start: startDate, end: endDate }, vesselType),
      computeFleetPowerSTWBenchmarks(orgId, { start: startDate, end: endDate }, vesselType)
    ]);

    const vessels = await storage.getVessels(orgId);
    const vesselCount = vesselType ? vessels.filter(v => v.type === vesselType).length : vessels.length;

    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ loadDistribution: loadBenchmarks, powerSTW: powerSTWBenchmarks, vesselCount, periodStart: startDate.toISOString(), periodEnd: endDate.toISOString(), filter: vesselType ? { vesselType } : null });
  }));
}

```

### `server/domains/vessel-performance/routes/cii-routes.ts` (41 lines)

```ts
/**
 * Vessel Performance Routes - CII Compliance Endpoints
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";

export function registerCIIRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  const { storage } = config;

  app.get("/api/compliance/cii/:vesselId", withErrorHandling("calculate CII rating", async (req: Request, res: Response) => {
    const { vesselId } = req.params, orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const { CIIService } = await import("../../../cii-service.js");
    const ciiService = new CIIService(storage);

    const now = new Date();
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;

    const rating = await ciiService.calculateCIIFromTelemetry(vesselId, orgId, startDate, endDate);
    if (!rating) {return res.status(404).json({ message: "Insufficient data to calculate CII rating", suggestion: "Ensure vessel has fuel consumption and speed telemetry data" });}

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(rating);
  }));

  app.get("/api/compliance/cii/:vesselId/trend", withErrorHandling("get CII trend", async (req: Request, res: Response) => {
    const { vesselId } = req.params, orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const { CIIService } = await import("../../../cii-service.js");
    const ciiService = new CIIService(storage);
    const trend = await ciiService.getCIITrend(vesselId, orgId);

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({ vesselId, trend, monthsAvailable: trend.length });
  }));
}

```

### `server/domains/vessel-performance/routes/mode-routes.ts` (40 lines)

```ts
/**
 * Vessel Performance Routes - Operating Mode Detection
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";

export function registerModeRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  const { storage } = config;

  app.get("/api/vessels/:id/operating-mode", withErrorHandling("detect operating mode", async (req: Request, res: Response) => {
    const { id: vesselId } = req.params, orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const now = new Date(), oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const equipment = await storage.listEquipment(orgId);
    const vesselEquipment = equipment.filter(e => e.vesselId === vesselId);

    if (vesselEquipment.length === 0) {return res.status(404).json({ message: "No equipment found for vessel" });}

    const { ModeDetector } = await import("../../../context/mode-detector.js");
    const detector = new ModeDetector();
    let latestMode: any = null;

    for (const eq of vesselEquipment) {
      const telemetry = await storage.getTelemetry(eq.id, oneHourAgo, now, orgId);
      if (telemetry.length > 0) {
        const windows = telemetry.map(t => detector.toTelemetryWindow(t));
        const detection = detector.detectModeFromWindow(windows);
        if (!latestMode || detection.confidence > latestMode.confidence) {latestMode = detection;}
      }
    }

    if (!latestMode) {return res.json({ mode: "Unknown", confidence: 0, indicators: ["No recent telemetry data"], timestamp: now.toISOString() });}

    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ ...latestMode, timestamp: latestMode.timestamp.toISOString(), color: detector.getModeColor(latestMode.mode), label: detector.getModeLabel(latestMode.mode) });
  }));
}

```

### `server/domains/vessel-performance/routes/narrative-routes.ts` (27 lines)

```ts
/**
 * Vessel Performance Routes - Narrative Summary
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";

export function registerNarrativeRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  const { storage } = config;

  app.post("/api/analytics/narrative-summary", withErrorHandling("generate narrative summary", async (req: Request, res: Response) => {
    const orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const { NarrativeSummaryService } = await import("../../../narrative-summary-service.js");
    const narrativeService = new NarrativeSummaryService(storage);

    const input = req.body;
    if (!input.vesselId || !input.chartType) {return res.status(400).json({ message: "vesselId and chartType are required" });}

    const summary = await narrativeService.generateSummary(input);

    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(summary);
  }));
}

```

### `server/domains/vessel-performance/routes/scheduling-routes.ts` (77 lines)

```ts
/**
 * Vessel Performance Routes - Enhanced Crew Scheduling
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import type { RestDay } from "../../../stcw-compliance";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";

export function registerSchedulingRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  const { storage, crewOperationRateLimit } = config;

  app.post("/api/crew/schedule/plan-enhanced", crewOperationRateLimit, withErrorHandling("run enhanced crew scheduling", async (req: Request, res: Response) => {
    const { engine = "greedy", days, shifts, crew, leaves = [], portCalls = [], drydocks = [], certifications = {}, preferences = {}, validate_stcw = false } = req.body;

    if (!Array.isArray(days) || !Array.isArray(shifts) || !Array.isArray(crew)) {return res.status(400).json({ error: "Invalid input: days, shifts, and crew must be arrays" });}

    let planWithEngine, ConstraintScheduleRequest, ENGINE_GREEDY, ENGINE_OR_TOOLS;
    try {
      const ortoolsModule = await import("../../../crew-scheduler-ortools");
      planWithEngine = ortoolsModule.planWithEngine;
      ConstraintScheduleRequest = ortoolsModule.ConstraintScheduleRequest;
      ENGINE_GREEDY = ortoolsModule.ENGINE_GREEDY;
      ENGINE_OR_TOOLS = ortoolsModule.ENGINE_OR_TOOLS;
    } catch (error) {
      logger.warn("SchedulingRoutes", "OR-Tools crew scheduler not available (native bindings missing), falling back to greedy algorithm", error);
      return res.status(200).json({ scheduled: [], unfilled: [], warning: "OR-Tools optimizer not available in this environment. Use the basic crew scheduler endpoint instead." });
    }

    const scheduleRequest: typeof ConstraintScheduleRequest = { engine, days, shifts, crew, leaves, portCalls, drydocks, certifications, preferences };
    const { scheduled, unfilled } = planWithEngine(scheduleRequest);
    const compliance: { overall_ok: boolean; per_crew: any[]; rows_by_crew: { [crewId: string]: RestDay[] } } = { overall_ok: true, per_crew: [], rows_by_crew: {} };

    if (validate_stcw) {
      try {
        const { mergeHistoryWithPlan, summarizeHoRContext } = await import("../../../hor-plan-utils");
        const { checkMonthCompliance } = await import("../../../stcw-compliance");

        const startDate = days[0], endDate = days[days.length - 1];

        const getHistoryRows = async (crewId: string): Promise<RestDay[]> => {
          try {
            const startPlanDate = new Date(startDate), results: RestDay[] = [];
            const historyStart = new Date(startPlanDate); historyStart.setMonth(historyStart.getMonth() - 1);
            const current = new Date(historyStart.getFullYear(), historyStart.getMonth(), 1);
            const endLimit = new Date(startPlanDate.getFullYear(), startPlanDate.getMonth(), 1);

            while (current <= endLimit) {
              const year = current.getFullYear(), month = current.getMonth() + 1;
              try { const restData = await storage.getCrewRestMonth(crewId, year, month); if (restData.days && restData.days.length > 0) {results.push(...restData.days);} } catch { /* month data not found */ }
              current.setMonth(current.getMonth() + 1);
            }
            return results;
          } catch { /* history retrieval failed */ return []; }
        };

        for (const crewMember of crew) {
          const crewId = crewMember.id, historyRows = await getHistoryRows(crewId);
          const crewAssignments = scheduled.filter((a: any) => a.crewId === crewId).map((a: any) => ({ date: a.date, start: a.start, end: a.end, crewId: a.crewId, shiftId: a.shiftId, vesselId: a.vesselId }));
          const mergedRows = mergeHistoryWithPlan(historyRows, crewAssignments, startDate, endDate);
          const crewCompliance = checkMonthCompliance(mergedRows), context = summarizeHoRContext(historyRows);
          compliance.rows_by_crew[crewId] = mergedRows;
          compliance.per_crew.push({ crew_id: crewId, name: crewMember.name || crewId, ok: crewCompliance.ok, min_rest_24: context.min_rest_24, rest_7d: context.rest_7d, nights_this_week: context.nights_this_week, violations: crewCompliance.ok ? 0 : crewCompliance.days.filter((d: any) => !d.day_ok).length });
          if (!crewCompliance.ok) {compliance.overall_ok = false;}
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("SchedulingRoutes", "Failed to validate STCW compliance", error);
        compliance.overall_ok = false;
        compliance.per_crew.push({ error: "Failed to validate STCW compliance", details: msg });
      }
    }

    res.json({ engine, scheduled, unfilled, compliance, summary: { totalShifts: shifts.length * days.length, scheduledAssignments: scheduled.length, unfilledPositions: unfilled.reduce((sum: number, u: any) => sum + u.need, 0), coverage: (scheduled.length / (shifts.length * days.length)) * 100 } });
  }));
}

```

### `server/domains/stormgeo/routes.ts` (226 lines)

```ts
import { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface StormGeoConfig {
  storage: any;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

export function registerStormGeoRoutes(app: Express, config: StormGeoConfig) {
  const { storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit } = config;

  app.get("/api/stormgeo/settings",
    withErrorHandling("get StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const vesselId = req.query.vesselId as string | undefined;
      const settings = await storage.getStormgeoSettings(orgId, vesselId);
      res.json(settings || null);
    })
  );

  app.post("/api/stormgeo/settings", writeOperationRateLimit,
    withErrorHandling("save StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { stormgeoIntegrationService } = await import("../../services/stormgeo-integration-service");
      const settings = await stormgeoIntegrationService.upsertSettings({
        ...req.body,
        orgId,
      });
      res.json(settings);
    })
  );

  app.delete("/api/stormgeo/settings/:id", writeOperationRateLimit,
    withErrorHandling("delete StormGeo settings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      await storage.deleteStormgeoSettings(req.params.id, orgId);
      res.json({ success: true });
    })
  );

  app.post("/api/stormgeo/import", writeOperationRateLimit,
    withErrorHandling("import StormGeo data", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, fileName, fileContent, fileType } = req.body;
      
      if (!vesselId || !fileContent) {
        res.status(400).json({ error: "vesselId and fileContent are required" });
        return;
      }

      const { stormgeoIntegrationService } = await import("../../services/stormgeo-integration-service");
      
      let result;
      if (fileType === 'json' || fileName?.endsWith('.json')) {
        result = await stormgeoIntegrationService.importJSON(
          orgId,
          vesselId,
          fileContent,
          fileName || 'import.json'
        );
      } else {
        result = await stormgeoIntegrationService.importCSV(
          orgId,
          vesselId,
          fileContent,
          fileName || 'import.csv'
        );
      }

      res.json(result);
    })
  );

  app.get("/api/stormgeo/import-history",
    withErrorHandling("get StormGeo import history", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const vesselId = req.query.vesselId as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const history = await storage.getStormgeoImportHistory(orgId, { vesselId, limit });
      res.json(history);
    })
  );

  app.get("/api/stormgeo/snapshots",
    withErrorHandling("get StormGeo snapshots", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const vesselId = req.query.vesselId as string;
      const startTime = req.query.startTime ? new Date(req.query.startTime as string) : undefined;
      const endTime = req.query.endTime ? new Date(req.query.endTime as string) : undefined;
      
      if (!vesselId) {
        res.status(400).json({ error: "vesselId is required" });
        return;
      }

      const { stormgeoIntegrationService } = await import("../../services/stormgeo-integration-service");
      const snapshots = await stormgeoIntegrationService.getSnapshots(orgId, vesselId, startTime, endTime);
      res.json(snapshots);
    })
  );

  app.get("/api/stormgeo/weather-for-time",
    withErrorHandling("get weather for time", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const vesselId = req.query.vesselId as string;
      const timestamp = req.query.timestamp as string;
      
      if (!vesselId || !timestamp) {
        res.status(400).json({ error: "vesselId and timestamp are required" });
        return;
      }

      const { stormgeoIntegrationService } = await import("../../services/stormgeo-integration-service");
      const snapshot = await stormgeoIntegrationService.getWeatherForTime(
        vesselId,
        new Date(timestamp),
        orgId
      );
      res.json(snapshot || null);
    })
  );

  app.post("/api/stormgeo/autofill-hourly", writeOperationRateLimit,
    withErrorHandling("auto-fill hourly entry", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, logDate, hour } = req.body;
      
      if (!vesselId || !logDate || hour === undefined) {
        res.status(400).json({ error: "vesselId, logDate, and hour are required" });
        return;
      }

      const { stormgeoIntegrationService } = await import("../../services/stormgeo-integration-service");
      const result = await stormgeoIntegrationService.autoFillHourlyEntry(
        vesselId,
        logDate,
        hour,
        orgId
      );

      if (!result) {
        res.json({ 
          success: false, 
          message: "No weather data available for this time" 
        });
        return;
      }

      res.json({ 
        success: true, 
        fields: result.fields,
        source: result.source,
        snapshotId: result.snapshotId,
      });
    })
  );

  app.post("/api/stormgeo/autofill-daily", writeOperationRateLimit,
    withErrorHandling("bulk auto-fill hourly entries", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      if (!orgId) {
        res.status(401).json({ error: "Organization ID required" });
        return;
      }
      
      const bulkAutoFillSchema = z.object({
        vesselId: z.string().uuid(),
        logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        skipExisting: z.boolean().optional().default(true),
      });
      
      const parseResult = bulkAutoFillSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.errors 
        });
        return;
      }
      
      const { vesselId, logDate } = parseResult.data;

      const { stormgeoIntegrationService } = await import("../../services/stormgeo-integration-service");
      const results: Record<number, { fields: Record<string, unknown>; source: string; snapshotId?: string }> = {};
      let filledCount = 0;

      for (let hour = 0; hour < 24; hour++) {
        try {
          const result = await stormgeoIntegrationService.autoFillHourlyEntry(
            vesselId,
            logDate,
            hour,
            orgId
          );

          if (result) {
            results[hour] = result;
            filledCount++;
          }
        } catch (_error) {
          logger.info("StormGeo", `No weather data for hour ${hour}`);
        }
      }

      res.json({ 
        success: filledCount > 0, 
        filledCount,
        results,
      });
    })
  );

  app.delete("/api/stormgeo/snapshots/route/:routeId", writeOperationRateLimit,
    withErrorHandling("delete StormGeo snapshots", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      await storage.deleteStormgeoSnapshotsByRoute(req.params.routeId, orgId);
      res.json({ success: true });
    })
  );

  logger.info("StormGeoRoutes", "Registered (10 endpoints)");
}

```

### `server/domains/sync/routes.ts` (307 lines)

```ts
import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { IStorage } from "../../storage";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface SyncRoutesConfig {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  getSyncMetrics: () => Promise<Record<string, unknown>>;
  processPendingEvents: (limit?: number) => Promise<number>;
  recordAndPublish: (category: string, action: string, type: string, data: unknown) => Promise<void>;
}

export function registerSyncRoutes(app: Express, config: SyncRoutesConfig): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    getSyncMetrics,
    processPendingEvents,
    recordAndPublish,
  } = config;

  app.get("/api/sync/health", requireOrgId, generalApiRateLimit,
    withErrorHandling("get sync health status", async (req: Request, res: Response) => {
      const metrics = await getSyncMetrics();
      res.json({
        status: "active",
        timestamp: new Date().toISOString(),
        ...metrics,
      });
    })
  );

  app.post("/api/sync/reconcile", requireOrgId, generalApiRateLimit,
    withErrorHandling("reconcile sync data", async (req: Request, res: Response) => {
      const results = {
        costSync: 0,
        eventsProcessed: 0,
        partsChecked: 0,
        timestamp: new Date().toISOString(),
      };

      results.eventsProcessed = await processPendingEvents();

      try {
        const allParts = await storage.getParts();
        results.partsChecked = allParts.length;

        for (const part of allParts) {
          try {
            await storage.syncPartCostToStock(part.id);
            results.costSync++;
          } catch (syncError: unknown) {
            const msg = syncError instanceof Error ? syncError.message : String(syncError);
            logger.warn("Sync", `Failed to sync cost for part ${part.id}`, msg);
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn("Sync", "Cost reconciliation skipped - storage method not available", msg);
      }

      await recordAndPublish("sync", "reconcile", "reconcile", results);

      res.json({
        ok: true,
        ...results,
        message: `Reconciliation completed: ${results.costSync} parts synchronized, ${results.eventsProcessed} events processed`,
      });
    })
  );

  app.post("/api/sync/process-events", requireOrgId, generalApiRateLimit,
    withErrorHandling("process sync events", async (req: Request, res: Response) => {
      const limit = Number.parseInt(req.query.limit as string) || 100;
      const processed = await processPendingEvents(limit);

      res.json({
        ok: true,
        processed,
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.get("/api/sync/metrics", requireOrgId, generalApiRateLimit,
    withErrorHandling("get sync metrics", async (req: Request, res: Response) => {
      const metrics = await getSyncMetrics();
      res.json(metrics);
    })
  );

  app.get("/api/sync/status", requireOrgId, generalApiRateLimit,
    withErrorHandling("get sync status", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { getReconciliationSummary } = await import("../../sync-jobs.js");
      const summary = await getReconciliationSummary(orgId);
      const metrics = await getSyncMetrics();

      res.json({
        status: "active",
        timestamp: new Date().toISOString(),
        sync: {
          lastRun: summary.lastRun,
          totalIssues: summary.totalIssues,
          criticalIssues: summary.criticalIssues,
          recentActivity: summary.recentActivity,
        },
        metrics,
      });
    })
  );

  app.post("/api/sync/reconcile/comprehensive", requireOrgId, generalApiRateLimit,
    withErrorHandling("comprehensive reconciliation", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { reconcileAll } = await import("../../sync-jobs.js");
      const reconciliationResult = await reconcileAll(orgId);

      await recordAndPublish("sync", "reconcile", "comprehensive", reconciliationResult);

      res.json({
        ok: reconciliationResult.success,
        ...reconciliationResult,
        message: reconciliationResult.success
          ? `Comprehensive reconciliation completed: ${reconciliationResult.stats.totalIssues} issues found across ${reconciliationResult.stats.checkedEntities} entities`
          : `Comprehensive reconciliation failed: ${reconciliationResult.issues.length} errors encountered`,
      });
    })
  );

  app.post("/api/sync/check-conflicts", requireOrgId, generalApiRateLimit,
    withErrorHandling("check conflicts", async (req: Request, res: Response) => {
      const { table, recordId, data, version, timestamp, user, device, orgId } = req.body;

      if (!table || !recordId || !data || !version || !user || !device || !orgId) {
        res.status(400).json({
          message: "Missing required fields: table, recordId, data, version, user, device, orgId",
        });
        return;
      }

      const { detectConflicts, logConflict } = await import("../../conflict-resolution-service.js");

      const result = await detectConflicts(
        table,
        recordId,
        data,
        version,
        new Date(timestamp),
        user,
        device,
        orgId
      );

      if (result.hasConflict && result.conflicts.length > 0) {
        const conflictIds = [];
        for (const conflict of result.conflicts) {
          const conflictId = await logConflict(
            conflict,
            user,
            device,
            null,
            null,
            orgId
          );
          conflictIds.push(conflictId);
        }

        await recordAndPublish("sync", "conflict", "detected", {
          table,
          recordId,
          conflictCount: conflictIds.length,
          requiresManual: result.requiresManualResolution,
        });

        res.json({
          ...result,
          conflictIds,
        });
      } else {
        res.json(result);
      }
    })
  );

  app.get("/api/sync/pending-conflicts", requireOrgId, generalApiRateLimit,
    withErrorHandling("get pending conflicts", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { getPendingConflicts } = await import("../../conflict-resolution-service.js");
      const conflicts = await getPendingConflicts(orgId);

      res.json({ conflicts });
    })
  );

  app.post("/api/sync/resolve-conflict", requireOrgId, writeOperationRateLimit,
    withErrorHandling("resolve conflict", async (req: Request, res: Response) => {
      const { conflictId, resolvedValue, resolvedBy, resolutionNotes } = req.body;

      if (!conflictId || resolvedValue === undefined || !resolvedBy) {
        res.status(400).json({
          message: "Missing required fields: conflictId, resolvedValue, resolvedBy",
        });
        return;
      }

      const { manuallyResolveConflict } = await import("../../conflict-resolution-service.js");

      await manuallyResolveConflict(conflictId, resolvedValue, resolvedBy);

      await recordAndPublish("sync", "conflict", "resolved", {
        conflictId,
        resolvedBy,
        notes: resolutionNotes,
      });

      res.json({
        ok: true,
        message: "Conflict resolved successfully",
      });
    })
  );

  app.post("/api/sync/auto-resolve", requireOrgId, writeOperationRateLimit,
    withErrorHandling("auto-resolve conflicts", async (req: Request, res: Response) => {
      const { conflictIds, resolvedBy } = req.body;

      if (!conflictIds || !Array.isArray(conflictIds) || !resolvedBy) {
        res.status(400).json({
          message: "Missing required fields: conflictIds (array), resolvedBy",
        });
        return;
      }

      const { db } = await import("../../db.js");
      const { syncConflicts } = await import("@shared/sync-conflicts-schema.js");
      const { eq, and, inArray } = await import("drizzle-orm");

      const conflicts = await db
        .select()
        .from(syncConflicts)
        .where(and(inArray(syncConflicts.id, conflictIds), eq(syncConflicts.resolved, false)));

      if (conflicts.length === 0) {
        sendNotFound(res, "Unresolved conflicts");
        return;
      }

      const safetyCriticalConflicts = conflicts.filter((c) => c.isSafetyCritical);
      if (safetyCriticalConflicts.length > 0) {
        res.status(400).json({
          message: "Cannot auto-resolve safety-critical conflicts",
          safetyCriticalIds: safetyCriticalConflicts.map((c) => c.id),
        });
        return;
      }

      const { manuallyResolveConflict } = await import("../../conflict-resolution-service.js");
      const resolved: Array<{ conflictId: string; field: string; resolvedValue: unknown }> = [];

      for (const conflict of conflicts) {
        let resolvedValue;
        const localValue = conflict.localValue ? JSON.parse(conflict.localValue) : null;
        const serverValue = conflict.serverValue ? JSON.parse(conflict.serverValue) : null;

        const resolutionStrategies: Record<string, () => unknown> = {
          max: () => Math.max(Number(localValue), Number(serverValue)),
          min: () => Math.min(Number(localValue), Number(serverValue)),
          append: () => (typeof localValue === "string" && typeof serverValue === "string")
            ? `${serverValue}\n---\n${localValue}` : localValue,
          lww: () => {
            const localTime = conflict.localTimestamp?.getTime() || 0;
            const serverTime = conflict.serverTimestamp?.getTime() || 0;
            return localTime > serverTime ? localValue : serverValue;
          },
          or: () => Boolean(localValue) || Boolean(serverValue),
          server: () => serverValue,
        };
        const strategyFn = resolutionStrategies[conflict.resolutionStrategy ?? ""];
        resolvedValue = strategyFn ? strategyFn() : localValue;

        await manuallyResolveConflict(conflict.id, resolvedValue, `system:auto-${resolvedBy}`);
        resolved.push({
          conflictId: conflict.id,
          field: conflict.fieldName,
          resolvedValue,
        });
      }

      res.json({
        ok: true,
        resolved,
        resolvedCount: resolved.length,
      });
    })
  );

  logger.info("SyncRoutes", "Registered (health, reconcile, process-events, metrics, status, check-conflicts, pending-conflicts, resolve-conflict, auto-resolve)");
}

```

---

## Maintenance (Schedules, Templates, Equipment, Work Orders, Condition Monitoring, Vibration)

### `server/domains/maintenance/interfaces/routes.ts` (218 lines)

```ts
import type { Express, Request, Response } from "express";
import { insertMaintenanceScheduleSchema, insertMaintenanceTemplateSchema } from "@shared/schema-runtime";
import { maintenanceService } from "../service";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../../middleware/auth";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";

/**
 * Maintenance Routes (Interfaces Layer)
 * Handles HTTP concerns for maintenance domain (schedules and templates)
 */
export function registerMaintenanceRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ========== Maintenance Schedules ==========

  // GET /api/maintenance-schedules
  app.get("/api/maintenance-schedules", generalApiRateLimit,
    withErrorHandling("fetch maintenance schedules", async (req: Request, res: Response) => {
      const { equipmentId, status } = req.query;
      const schedules = await maintenanceService.listSchedules(
        equipmentId as string | undefined,
        status as string | undefined
      );
      res.json(schedules);
    })
  );

  // GET /api/maintenance-schedules/upcoming
  app.get(
    "/api/maintenance-schedules/upcoming",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch upcoming maintenance schedules", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const daysAhead = req.query.daysAhead ? Number.parseInt(req.query.daysAhead as string) : 30;

      const schedules = await maintenanceService.getUpcomingSchedules(orgId, daysAhead);
      res.json(schedules);
    })
  );

  // GET /api/maintenance-schedules/:id
  app.get("/api/maintenance-schedules/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const schedule = await maintenanceService.getScheduleById(req.params.id, orgId);

      if (!schedule) {
        return sendNotFound(res, "Maintenance schedule");
      }

      res.json(schedule);
    })
  );

  // POST /api/maintenance-schedules
  app.post(
    "/api/maintenance-schedules",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create maintenance schedule", async (req: Request, res: Response) => {
      const scheduleData = insertMaintenanceScheduleSchema.parse(req.body);
      const schedule = await maintenanceService.createSchedule(scheduleData, (req as AuthenticatedRequest).user?.id);

      sendCreated(res, schedule);
    })
  );

  // PUT /api/maintenance-schedules/:id
  app.put(
    "/api/maintenance-schedules/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const scheduleData = insertMaintenanceScheduleSchema.partial().parse(req.body);
      const schedule = await maintenanceService.updateSchedule(
        req.params.id,
        scheduleData,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );

      res.json(schedule);
    })
  );

  // DELETE /api/maintenance-schedules/:id
  app.delete(
    "/api/maintenance-schedules/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete maintenance schedule", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await maintenanceService.deleteSchedule(req.params.id, orgId, (req as AuthenticatedRequest).user?.id);
      sendDeleted(res);
    })
  );

  // POST /api/maintenance-schedules/auto-schedule/:equipmentId
  app.post(
    "/api/maintenance-schedules/auto-schedule/:equipmentId",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("auto-schedule maintenance", async (req: Request, res: Response) => {
      const equipmentId = req.params.equipmentId;
      const { pdmScore } = req.body;

      if (pdmScore === undefined || pdmScore === null) {
        return res.status(400).json({
          message: "pdmScore is required in request body",
        });
      }

      if (typeof pdmScore !== "number" || pdmScore < 0 || pdmScore > 100) {
        return res.status(400).json({
          message: "pdmScore must be a number between 0 and 100",
        });
      }

      const schedule = await maintenanceService.autoScheduleForEquipment(
        equipmentId,
        pdmScore,
        (req as AuthenticatedRequest).user?.id
      );

      sendCreated(res, schedule);
    })
  );

  // ========== Maintenance Templates ==========

  // GET /api/maintenance-templates
  app.get("/api/maintenance-templates", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch maintenance templates", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentType, isActive } = req.query;

      const templates = await maintenanceService.listTemplates(
        orgId,
        equipmentType as string | undefined,
        isActive === undefined ? undefined : isActive === "true"
      );
      res.json(templates);
    })
  );

  // GET /api/maintenance-templates/:id
  app.get("/api/maintenance-templates/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const template = await maintenanceService.getTemplateById(req.params.id, orgId);

      if (!template) {
        return sendNotFound(res, "Maintenance template");
      }

      res.json(template);
    })
  );

  // POST /api/maintenance-templates
  app.post(
    "/api/maintenance-templates",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create maintenance template", async (req: Request, res: Response) => {
      const templateData = insertMaintenanceTemplateSchema.parse(req.body);
      const template = await maintenanceService.createTemplate(templateData, (req as AuthenticatedRequest).user?.id);

      sendCreated(res, template);
    })
  );

  // PUT /api/maintenance-templates/:id
  app.put(
    "/api/maintenance-templates/:id",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const templateData = insertMaintenanceTemplateSchema.partial().parse(req.body);
      const template = await maintenanceService.updateTemplate(
        req.params.id,
        templateData,
        orgId,
        (req as AuthenticatedRequest).user?.id
      );

      res.json(template);
    })
  );

  // DELETE /api/maintenance-templates/:id
  app.delete(
    "/api/maintenance-templates/:id",
    requireOrgId,
    criticalOperationRateLimit,
    withErrorHandling("delete maintenance template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      await maintenanceService.deleteTemplate(req.params.id, orgId, (req as AuthenticatedRequest).user?.id);
      sendDeleted(res);
    })
  );
}

```

### `server/domains/equipment/routes.ts` (508 lines)

```ts
import type { Express, Request, Response } from "express";
import { equipmentService } from "./service";
import { insertEquipmentSchema, insertDecommissionEventSchema } from "@shared/schema-runtime";
import { db } from "../../db";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../middleware/auth";
import { withErrorHandling, handleApiError, sendNotFound } from "../../lib/route-utils";
import {
  equipmentLifecycleService,
  decommissionEquipmentSchema,
  reinstateEquipmentSchema,
} from "./lifecycle";
import { requirePermission } from "../permissions/middleware";

// Simple in-memory cache for equipment queries (30 second TTL)
const equipmentCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 30000;

function getCached<T>(key: string): T | null {
  const entry = equipmentCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data as T;
  }
  if (entry) equipmentCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown): void {
  equipmentCache.set(key, { data, timestamp: Date.now() });
  // Prune old entries periodically
  if (equipmentCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of equipmentCache) {
      if (now - v.timestamp > CACHE_TTL_MS) equipmentCache.delete(k);
    }
  }
}

function invalidateCache(pattern: string): void {
  for (const key of equipmentCache.keys()) {
    if (key.startsWith(pattern)) equipmentCache.delete(key);
  }
}

/**
 * Register Equipment routes
 */
export function registerEquipmentRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimiters;

  // GET all equipment (with optional pagination and filtering)
  app.get("/api/equipment", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment registry", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const paginatedParam = req.query.paginated === "true";
      const pageParam = req.query.page;
      const pageSizeParam = req.query.pageSize;
      const page = pageParam ? Number.parseInt(pageParam as string, 10) : 1;
      const pageSize = pageSizeParam ? Number.parseInt(pageSizeParam as string, 10) : 20;
      const search = req.query.q || req.query.search;
      const type = req.query.type;
      const status = req.query.status;
      const vesselId = req.query.vesselId;
      const manufacturer = req.query.manufacturer;

      const hasFilters =
        search !== undefined ||
        type !== undefined ||
        status !== undefined ||
        vesselId !== undefined ||
        manufacturer !== undefined;

      const usePagination =
        paginatedParam || pageParam !== undefined || pageSizeParam !== undefined || hasFilters;

      if (usePagination) {
        if (Number.isNaN(page) || page < 1) {
          res.status(400).json({ message: "Invalid page number" });
          return;
        }

        if (Number.isNaN(pageSize) || pageSize < 1 || pageSize > 1000) {
          res.status(400).json({ message: "Invalid page size (must be 1-1000)" });
          return;
        }

        const result = await equipmentService.listEquipmentPaginated(orgId, {
          page,
          pageSize,
          search: search as string,
          type: type as string,
          status: status as "active" | "inactive",
          vesselId: vesselId as string,
          manufacturer: manufacturer as string,
        });
        res.json(result);
      } else {
        // Use cache for non-paginated full list
        const cacheKey = `equipment:list:${orgId}`;
        const cached = getCached(cacheKey);
        if (cached) {
          return res.json(cached);
        }
        const equipment = await equipmentService.listEquipment(orgId);
        setCache(cacheKey, equipment);
        res.json(equipment);
      }
    })
  );

  // GET equipment health - must come before /:id route to avoid routing conflicts
  app.get("/api/equipment/health", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment health", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      let vesselId = req.query.vesselId as string | undefined;
      let equipmentId = req.query.equipmentId as string | undefined;

      if (vesselId && (vesselId === "[object Object]" || vesselId.startsWith("[object"))) {
        vesselId = undefined;
      }

      if (equipmentId && (equipmentId === "[object Object]" || equipmentId.startsWith("[object"))) {
        equipmentId = undefined;
      }

      // Use cache for equipment health
      const cacheKey = `equipment:health:${orgId}:${vesselId || 'all'}:${equipmentId || 'all'}`;
      const cached = getCached(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const health = await equipmentService.getEquipmentHealth(orgId, vesselId, equipmentId);
      setCache(cacheKey, health);
      res.json(health);
    })
  );

  // GET equipment with sensor issues
  app.get("/api/equipment/sensor-issues", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment with sensor issues", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipment = await equipmentService.getEquipmentWithSensorIssues(orgId);
      res.json(equipment);
    })
  );

  // RUL Prediction - single equipment
  app.get("/api/equipment/:id/rul", requireOrgId, generalApiRateLimit,
    withErrorHandling("calculate RUL prediction", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;

      const { RulEngine } = await import("../../rul-engine.js");
      const rulEngine = new RulEngine(db);

      const prediction = await rulEngine.calculateRul(equipmentId, orgId);

      if (!prediction) {
        res.status(404).json({
          message: "No RUL prediction available for this equipment",
          hint: "Ensure equipment has degradation data or ML predictions",
        });
        return;
      }

      res.json(prediction);
    })
  );

  // Batch RUL predictions
  app.post("/api/equipment/rul/batch", requireOrgId, generalApiRateLimit,
    withErrorHandling("calculate batch RUL predictions", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentIds } = req.body;

      if (!Array.isArray(equipmentIds) || equipmentIds.length === 0) {
        res.status(400).json({ message: "equipmentIds array is required" });
        return;
      }

      const { RulEngine } = await import("../../rul-engine.js");
      const rulEngine = new RulEngine(db);

      const predictions = await rulEngine.calculateBatchRul(equipmentIds, orgId);
      const result = Object.fromEntries(predictions);

      res.json(result);
    })
  );

  // Record component degradation
  app.post("/api/equipment/:id/degradation", requireOrgIdAndValidateBody, writeOperationRateLimit,
    withErrorHandling("record degradation", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;

      const {
        componentType,
        degradationMetric,
        vibrationLevel,
        temperature,
        oilCondition,
        acousticSignature,
        wearParticleCount,
        operatingHours,
        cycleCount,
        loadFactor,
      } = req.body;

      if (!componentType || degradationMetric === undefined) {
        res.status(400).json({
          message: "componentType and degradationMetric are required",
        });
        return;
      }

      const { RulEngine } = await import("../../rul-engine.js");
      const rulEngine = new RulEngine(db);

      await rulEngine.recordDegradation(orgId, equipmentId, componentType, {
        degradationMetric,
        vibrationLevel,
        temperature,
        oilCondition,
        acousticSignature,
        wearParticleCount,
        operatingHours,
        cycleCount,
        loadFactor,
      });

      res.status(201).json({
        message: "Degradation recorded successfully",
        equipmentId,
        componentType,
      });
    })
  );

  // GET single equipment by ID
  app.get("/api/equipment/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const equipment = await equipmentService.getEquipmentById(req.params.id, orgId);
      if (!equipment) {
        sendNotFound(res, "Equipment");
        return;
      }

      res.json(equipment);
    })
  );

  // POST create equipment
  app.post("/api/equipment", requireOrgIdAndValidateBody, requirePermission("equipment", "create"), writeOperationRateLimit,
    withErrorHandling("create equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const validationResult = insertEquipmentSchema.safeParse({
        ...req.body,
        orgId,
      });

      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "create equipment");
        return;
      }

      const equipment = await equipmentService.createEquipment(validationResult.data);
      invalidateCache(`equipment:`);
      res.status(201).json(equipment);
    })
  );

  // PUT update equipment
  app.put("/api/equipment/:id", requireOrgIdAndValidateBody, requirePermission("equipment", "edit"), writeOperationRateLimit,
    withErrorHandling("update equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { orgId: _, id: __, createdAt: ___, updatedAt: ____, ...safeUpdateData } = req.body;

      const validationResult = insertEquipmentSchema.partial().safeParse(safeUpdateData);
      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "update equipment");
        return;
      }

      try {
        const equipment = await equipmentService.updateEquipment(
          req.params.id,
          validationResult.data,
          orgId
        );
        invalidateCache(`equipment:`);
        res.json(equipment);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  // DELETE disassociate equipment from vessel
  app.delete("/api/equipment/:id/disassociate-vessel", requireOrgId, requirePermission("equipment", "edit"), writeOperationRateLimit,
    withErrorHandling("disassociate equipment from vessel", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      try {
        await equipmentService.disassociateVessel(req.params.id, orgId);
        res.json({ message: "Equipment successfully disassociated from vessel" });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  // DELETE equipment
  app.delete("/api/equipment/:id", requireOrgId, requirePermission("equipment", "delete"), criticalOperationRateLimit,
    withErrorHandling("delete equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      try {
        await equipmentService.deleteEquipment(req.params.id, orgId);
        invalidateCache(`equipment:`);
        res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  // POST decommission equipment (using lifecycle service)
  app.post("/api/equipment/:id/decommission", requireOrgIdAndValidateBody, requirePermission("equipment", "manage_config"), criticalOperationRateLimit,
    withErrorHandling("decommission equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;
      const userId = (req as AuthenticatedRequest).userId;

      const validationResult = decommissionEquipmentSchema.safeParse(req.body);

      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "decommission equipment");
        return;
      }

      try {
        const result = await equipmentLifecycleService.decommissionEquipment(
          equipmentId,
          orgId,
          validationResult.data,
          userId
        );
        invalidateCache(`equipment:`);
        res.json(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        if (error instanceof Error && error.message.includes("already decommissioned")) {
          res.status(409).json({ message: error.message });
          return;
        }
        throw error;
      }
    })
  );

  // POST reinstate equipment
  app.post("/api/equipment/:id/reinstate", requireOrgIdAndValidateBody, requirePermission("equipment", "manage_config"), criticalOperationRateLimit,
    withErrorHandling("reinstate equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;
      const userId = (req as AuthenticatedRequest).userId;

      const validationResult = reinstateEquipmentSchema.safeParse(req.body);

      if (!validationResult.success) {
        handleApiError(res, validationResult.error, "reinstate equipment");
        return;
      }

      try {
        const result = await equipmentLifecycleService.reinstateEquipment(
          equipmentId,
          orgId,
          validationResult.data,
          userId
        );
        invalidateCache(`equipment:`);
        res.json(result);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Decommissioned Equipment");
          return;
        }
        if (error instanceof Error && error.message.includes("already active")) {
          res.status(409).json({ message: error.message });
          return;
        }
        throw error;
      }
    })
  );

  // GET equipment lifecycle history
  app.get("/api/equipment/:id/history", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch equipment history", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipmentId = req.params.id;

      try {
        const history = await equipmentLifecycleService.getEquipmentHistory(equipmentId, orgId);
        res.json(history);
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          sendNotFound(res, "Equipment");
          return;
        }
        throw error;
      }
    })
  );

  // GET decommissioned equipment list (using lifecycle service)
  app.get("/api/equipment/decommissioned", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch decommissioned equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const withHistory = req.query.withHistory === "true";

      if (withHistory) {
        const decommissioned = await equipmentLifecycleService.getDecommissionedEquipmentWithHistory(orgId);
        res.json(decommissioned);
      } else {
        const decommissioned = await equipmentLifecycleService.getDecommissionedEquipment(orgId);
        res.json(decommissioned);
      }
    })
  );

  // GET equipment sensor coverage
  app.get("/api/equipment/:id/sensor-coverage", requireOrgId, generalApiRateLimit,
    withErrorHandling("analyze equipment sensor coverage", async (req: Request, res: Response) => {
      const equipmentId = req.params.id;
      const orgId = (req as AuthenticatedRequest).orgId;

      const coverage = await equipmentService.getSensorCoverage(equipmentId, orgId);
      res.json(coverage);
    })
  );

  // POST setup missing sensor configurations
  app.post("/api/equipment/:id/setup-sensors", requireOrgId, criticalOperationRateLimit,
    withErrorHandling("setup missing sensor configurations", async (req: Request, res: Response) => {
      const equipmentId = req.params.id;
      const orgId = (req as AuthenticatedRequest).orgId;

      const result = await equipmentService.setupSensors(equipmentId, orgId);
      res.json(result);
    })
  );

  // GET compatible parts for equipment
  app.get("/api/equipment/:equipmentId/compatible-parts", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch compatible parts", async (req: Request, res: Response) => {
      const equipmentId = req.params.equipmentId;
      const orgId = (req as AuthenticatedRequest).orgId;

      const parts = await equipmentService.getCompatibleParts(equipmentId, orgId);
      res.json(parts);
    })
  );

  // GET suggested parts for equipment
  app.get("/api/equipment/:equipmentId/suggested-parts", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch suggested parts", async (req: Request, res: Response) => {
      const equipmentId = req.params.equipmentId;
      const orgId = (req as AuthenticatedRequest).orgId;

      const parts = await equipmentService.getSuggestedParts(equipmentId, orgId);
      res.json(parts);
    })
  );
}

```

### `server/domains/condition-monitoring/routes.ts` (213 lines)

```ts
import { Express, Request, Response } from "express";
import { z } from "zod";
import { RateLimitRequestHandler } from "express-rate-limit";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { insertOilAnalysisSchema, insertWearParticleAnalysisSchema } from "@shared/schema-runtime";
import { IStorage } from "../../storage";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface ConditionMonitoringRoutesConfig {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
}

export function registerConditionMonitoringRoutes(
  app: Express,
  config: ConditionMonitoringRoutesConfig
): void {
  const { storage, generalApiRateLimit } = config;

  // ===== OIL ANALYSIS ROUTES =====

  app.get("/api/condition/oil-analysis", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch oil analyses", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = req.query;
      const analyses = await storage.getOilAnalyses(orgId, equipmentId as string);
      res.json(analyses);
    })
  );

  app.get("/api/condition/oil-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch oil analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await storage.getOilAnalysis(id, orgId);
      if (!analysis) {return sendNotFound(res, "Oil analysis");}
      res.json(analysis);
    })
  );

  app.post("/api/condition/oil-analysis", requireOrgId, generalApiRateLimit,
    withErrorHandling("create oil analysis", async (req, res) => {
      const oilAnalysisSchema = insertOilAnalysisSchema.extend({
        sampleDate: z.string().or(z.date()).transform((val) => typeof val === "string" ? new Date(val) : val),
      });
      const validatedData = oilAnalysisSchema.parse(req.body);
      const analysis = await storage.createOilAnalysis(validatedData);
      sendCreated(res, analysis);
    })
  );

  app.put("/api/condition/oil-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("update oil analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await storage.updateOilAnalysis(id, req.body, orgId);
      res.json(analysis);
    })
  );

  app.delete("/api/condition/oil-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("delete oil analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      await storage.deleteOilAnalysis(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== WEAR PARTICLE ANALYSIS ROUTES =====

  app.get("/api/condition/wear-analysis", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch wear particle analyses", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = req.query;
      const analyses = await storage.getWearParticleAnalyses(orgId, equipmentId as string);
      res.json(analyses);
    })
  );

  app.get("/api/condition/wear-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch wear particle analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await storage.getWearParticleAnalysis(id, orgId);
      if (!analysis) {return sendNotFound(res, "Wear particle analysis");}
      res.json(analysis);
    })
  );

  app.post("/api/condition/wear-analysis", requireOrgId, generalApiRateLimit,
    withErrorHandling("create wear particle analysis", async (req, res) => {
      const wearAnalysisSchema = insertWearParticleAnalysisSchema.extend({
        analysisDate: z.string().or(z.date()).transform((val) => typeof val === "string" ? new Date(val) : val),
      });
      const validatedData = wearAnalysisSchema.parse(req.body);
      const analysis = await storage.createWearParticleAnalysis(validatedData);
      sendCreated(res, analysis);
    })
  );

  app.put("/api/condition/wear-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("update wear particle analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const analysis = await storage.updateWearParticleAnalysis(id, req.body, orgId);
      res.json(analysis);
    })
  );

  app.delete("/api/condition/wear-analysis/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("delete wear particle analysis", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      await storage.deleteWearParticleAnalysis(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== CONDITION MONITORING ASSESSMENT ROUTES =====

  app.get("/api/condition/assessments", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch condition monitoring assessments", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = req.query;
      const assessments = await storage.getConditionMonitoringAssessments(orgId, equipmentId as string);
      res.json(assessments);
    })
  );

  app.get("/api/condition/assessments/:id", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch condition monitoring assessment", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const assessment = await storage.getConditionMonitoringAssessment(id, orgId);
      if (!assessment) {return sendNotFound(res, "Condition monitoring assessment");}
      res.json(assessment);
    })
  );

  app.post("/api/condition/assessments", requireOrgId, generalApiRateLimit,
    withErrorHandling("create condition monitoring assessment", async (req, res) => {
      const assessment = await storage.createConditionMonitoringAssessment(req.body);
      sendCreated(res, assessment);
    })
  );

  // ===== OIL CHANGE RECORDS ROUTES =====

  app.get("/api/condition/oil-changes", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch oil change records", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentId } = req.query;
      const records = await storage.getOilChangeRecords(orgId, equipmentId as string);
      res.json(records);
    })
  );

  app.post("/api/condition/oil-changes", requireOrgId, generalApiRateLimit,
    withErrorHandling("create oil change record", async (req, res) => {
      const record = await storage.createOilChangeRecord(req.body);
      sendCreated(res, record);
    })
  );

  // ===== CONDITION ASSESSMENT GENERATION =====

  app.post("/api/condition/generate-assessment", requireOrgId, generalApiRateLimit,
    withErrorHandling("generate condition assessment", async (req, res) => {
      const { oilAnalysisId, wearAnalysisId, vibrationScore } = req.body;

      const oilAnalysis = await storage.getOilAnalysis(oilAnalysisId);
      if (!oilAnalysis) {return sendNotFound(res, "Oil analysis");}

      let wearAnalysis;
      if (wearAnalysisId) {
        wearAnalysis = await storage.getWearParticleAnalysis(wearAnalysisId);
        if (!wearAnalysis) {return sendNotFound(res, "Wear particle analysis");}
      }

      const { generateConditionAssessment } = await import("../../condition-monitoring.js");
      const assessmentData = generateConditionAssessment(oilAnalysis, wearAnalysis, vibrationScore);
      const savedAssessment = await storage.createConditionMonitoringAssessment(assessmentData);
      sendCreated(res, savedAssessment);
    })
  );

  // ===== LATEST CONDITION DATA =====

  app.get("/api/condition/latest/:equipmentId", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch latest condition data", async (req, res) => {
      const { equipmentId } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;

      const [latestOil, latestWear, latestAssessment, latestOilChange] = await Promise.all([
        storage.getLatestOilAnalysis(equipmentId, orgId),
        storage.getLatestWearParticleAnalysis(equipmentId, orgId),
        storage.getLatestConditionAssessment(equipmentId, orgId),
        storage.getLatestOilChange(equipmentId, orgId),
      ]);

      res.json({
        oilAnalysis: latestOil,
        wearAnalysis: latestWear,
        conditionAssessment: latestAssessment,
        lastOilChange: latestOilChange,
      });
    })
  );

  logger.info("ConditionMonitoringRoutes", "Registered: oil-analysis, wear-analysis, assessments, oil-changes, generate-assessment, latest");
}

```

### `server/domains/vibration/routes.ts` (329 lines)

```ts
import { Express, Request, Response, RequestHandler } from "express";
import { withErrorHandling } from "../../lib/route-utils";

interface VibrationConfig {
  storage: any;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
}

export function registerVibrationRoutes(app: Express, config: VibrationConfig) {
  const { storage, requireOrgId, generalApiRateLimit } = config;

  app.post(
    "/api/vibration/analyze",
    requireOrgId,
    withErrorHandling("analyze vibration data", async (req: Request, res: Response) => {
      const { equipmentId, sensorId, data, sampleRate } = req.body;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: "Vibration data array is required" });
      }

      const n = data.length;
      const frequencies: number[] = [];
      const amplitudes: number[] = [];

      for (let k = 0; k < n / 2; k++) {
        let realSum = 0;
        let imagSum = 0;
        for (let t = 0; t < n; t++) {
          const angle = (2 * Math.PI * k * t) / n;
          realSum += data[t] * Math.cos(angle);
          imagSum -= data[t] * Math.sin(angle);
        }
        const amplitude = Math.sqrt(realSum * realSum + imagSum * imagSum) / n;
        const frequency = (k * (sampleRate || 1000)) / n;
        frequencies.push(frequency);
        amplitudes.push(amplitude);
      }

      const peakIndices = amplitudes
        .map((amp, idx) => ({ amp, idx }))
        .sort((a, b) => b.amp - a.amp)
        .slice(0, 10)
        .map((item) => item.idx);

      const dominantFrequencies = peakIndices.map((idx) => ({
        frequency: frequencies[idx],
        amplitude: amplitudes[idx],
      }));

      const rmsValue = Math.sqrt(data.reduce((sum: number, v: number) => sum + v * v, 0) / n);
      const peakValue = Math.max(...data.map(Math.abs));
      const crestFactor = peakValue / rmsValue;

      res.json({
        equipmentId,
        sensorId,
        analysis: {
          rms: rmsValue,
          peak: peakValue,
          crestFactor,
          dominantFrequencies,
          spectrum: {
            frequencies: frequencies.slice(0, 100),
            amplitudes: amplitudes.slice(0, 100),
          },
        },
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.post(
    "/api/vibration/enhanced-analysis",
    requireOrgId,
    withErrorHandling("perform enhanced analysis", async (req: Request, res: Response) => {
      const { equipmentId, data, sampleRate, equipmentType } = req.body;

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ message: "Vibration data array is required" });
      }

      const n = data.length;
      const rmsValue = Math.sqrt(data.reduce((sum: number, v: number) => sum + v * v, 0) / n);
      const peakValue = Math.max(...data.map(Math.abs));

      const thresholds: Record<string, any> = {
        pump: { warning: 4.5, critical: 7.1 },
        motor: { warning: 2.8, critical: 4.5 },
        compressor: { warning: 4.5, critical: 7.1 },
        default: { warning: 4.5, critical: 7.1 },
      };

      const limits = thresholds[equipmentType] || thresholds.default;
      let severity = "normal";
      if (rmsValue > limits.critical) {
        severity = "critical";
      } else if (rmsValue > limits.warning) {
        severity = "warning";
      }

      const faultIndicators = [];
      if (rmsValue > limits.warning) {
        faultIndicators.push({
          type: "high_vibration",
          description: "Elevated vibration levels detected",
          confidence: Math.min(100, (rmsValue / limits.warning) * 50),
        });
      }

      res.json({
        equipmentId,
        severity,
        metrics: {
          rms: rmsValue,
          peak: peakValue,
          crestFactor: peakValue / rmsValue,
        },
        thresholds: limits,
        faultIndicators,
        recommendation: severity === "critical"
          ? "Immediate inspection recommended"
          : severity === "warning"
            ? "Schedule inspection within 7 days"
            : "Continue normal monitoring",
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.post(
    "/api/vibration/iso-assessment",
    requireOrgId,
    withErrorHandling("perform ISO assessment", async (req: Request, res: Response) => {
      const { equipmentId, rmsVelocity, machineClass } = req.body;

      const isoLimits: Record<string, any> = {
        class1: { A: 0.71, B: 1.8, C: 4.5, D: 11.2 },
        class2: { A: 1.12, B: 2.8, C: 7.1, D: 18 },
        class3: { A: 1.8, B: 4.5, C: 11.2, D: 28 },
        class4: { A: 2.8, B: 7.1, C: 18, D: 45 },
      };

      const limits = isoLimits[machineClass] || isoLimits.class2;
      let zone = "A";
      if (rmsVelocity > limits.D) {
        zone = "D";
      } else if (rmsVelocity > limits.C) {
        zone = "C";
      } else if (rmsVelocity > limits.B) {
        zone = "B";
      }

      const zoneDescriptions: Record<string, string> = {
        A: "Good condition - newly commissioned machines",
        B: "Acceptable - unrestricted long-term operation",
        C: "Unsatisfactory - restricted continuous operation",
        D: "Unacceptable - damage may occur",
      };

      res.json({
        equipmentId,
        machineClass,
        rmsVelocity,
        zone,
        description: zoneDescriptions[zone],
        limits,
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.post(
    "/api/vibration/bearing-fault-detection",
    requireOrgId,
    withErrorHandling("detect bearing faults", async (req: Request, res: Response) => {
      const { equipmentId, frequencies, amplitudes, bearingSpec } = req.body;

      const faultFrequencies = {
        BPFO: bearingSpec?.bpfo || 0,
        BPFI: bearingSpec?.bpfi || 0,
        BSF: bearingSpec?.bsf || 0,
        FTF: bearingSpec?.ftf || 0,
      };

      const detectedFaults: any[] = [];

      if (frequencies && amplitudes) {
        Object.entries(faultFrequencies).forEach(([faultType, targetFreq]) => {
          if (targetFreq === 0) {return;}

          for (let harmonic = 1; harmonic <= 3; harmonic++) {
            const searchFreq = targetFreq * harmonic;
            const tolerance = searchFreq * 0.05;

            const matchIdx = frequencies.findIndex(
              (f: number) => Math.abs(f - searchFreq) < tolerance
            );

            if (matchIdx !== -1 && amplitudes[matchIdx] > 0.1) {
              detectedFaults.push({
                faultType,
                harmonic,
                frequency: frequencies[matchIdx],
                amplitude: amplitudes[matchIdx],
                expectedFrequency: searchFreq,
              });
            }
          }
        });
      }

      res.json({
        equipmentId,
        bearingSpec,
        faultFrequencies,
        detectedFaults,
        severity: detectedFaults.length > 2 ? "high" : detectedFaults.length > 0 ? "medium" : "low",
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.post(
    "/api/vibration/bearing-frequencies",
    requireOrgId,
    withErrorHandling("calculate bearing frequencies", async (req: Request, res: Response) => {
      const { ballCount, ballDiameter, pitchDiameter, contactAngle, shaftRpm } = req.body;

      const n = ballCount || 8;
      const Bd = ballDiameter || 10;
      const Pd = pitchDiameter || 50;
      const theta = ((contactAngle || 0) * Math.PI) / 180;
      const rpm = shaftRpm || 1800;
      const fr = rpm / 60;

      const bpfo = (n / 2) * fr * (1 - (Bd / Pd) * Math.cos(theta));
      const bpfi = (n / 2) * fr * (1 + (Bd / Pd) * Math.cos(theta));
      const bsf = (Pd / (2 * Bd)) * fr * (1 - Math.pow((Bd / Pd) * Math.cos(theta), 2));
      const ftf = (fr / 2) * (1 - (Bd / Pd) * Math.cos(theta));

      res.json({
        input: { ballCount: n, ballDiameter: Bd, pitchDiameter: Pd, contactAngle, shaftRpm: rpm },
        frequencies: {
          BPFO: Math.round(bpfo * 100) / 100,
          BPFI: Math.round(bpfi * 100) / 100,
          BSF: Math.round(bsf * 100) / 100,
          FTF: Math.round(ftf * 100) / 100,
        },
        unit: "Hz",
      });
    })
  );

  app.post(
    "/api/vibration/features",
    requireOrgId,
    withErrorHandling("extract features", async (req: Request, res: Response) => {
      const { data } = req.body;

      if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ message: "Data array is required" });
      }

      const n = data.length;
      const mean = data.reduce((a: number, b: number) => a + b, 0) / n;
      const variance = data.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / n;
      const std = Math.sqrt(variance);
      const rms = Math.sqrt(data.reduce((a: number, b: number) => a + b * b, 0) / n);
      const peak = Math.max(...data.map(Math.abs));
      const crestFactor = peak / rms;
      const kurtosis =
        data.reduce((a: number, b: number) => a + Math.pow((b - mean) / std, 4), 0) / n;
      const skewness =
        data.reduce((a: number, b: number) => a + Math.pow((b - mean) / std, 3), 0) / n;

      res.json({
        features: {
          mean,
          std,
          variance,
          rms,
          peak,
          crestFactor,
          kurtosis,
          skewness,
          peakToPeak: Math.max(...data) - Math.min(...data),
        },
        sampleCount: n,
      });
    })
  );

  app.post(
    "/api/acoustic/analyze",
    requireOrgId,
    withErrorHandling("analyze acoustic data", async (req: Request, res: Response) => {
      const { equipmentId, audioData, sampleRate } = req.body;

      const analysis = {
        equipmentId,
        timestamp: new Date().toISOString(),
        metrics: {
          averageLevel: 0,
          peakLevel: 0,
          noiseFloor: 0,
        },
        anomalyDetected: false,
        recommendation: "Continue normal monitoring",
      };

      res.json(analysis);
    })
  );

  app.get(
    "/api/acoustic/history",
    requireOrgId,
    withErrorHandling("fetch acoustic history", async (req: Request, res: Response) => {
      const { equipmentId, hours } = req.query;
      const history = await storage.getAcousticHistory?.(
        equipmentId as string,
        hours ? Number.parseInt(hours as string) : 24
      );
      res.json(history ?? []);
    })
  );
}

```

### `server/domains/cost-savings/routes.ts` (146 lines)

```ts
import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import {
  costSavingsSummaryQuerySchema,
  costSavingsTrendQuerySchema,
  costSavingsCalculateOptionsSchema,
  costSavingsListQuerySchema,
  costSavings,
} from "@shared/schema-runtime";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface CostSavingsRoutesConfig {
  writeOperationRateLimit: RateLimitRequestHandler;
}

export function registerCostSavingsRoutes(
  app: Express,
  config: CostSavingsRoutesConfig
): void {
  const { writeOperationRateLimit } = config;

  app.get("/api/cost-savings/summary", requireOrgId,
    withErrorHandling("fetch cost savings summary", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsSummaryQuerySchema.parse(req.query);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - validatedQuery.months);

      const { getSavingsSummary } = await import("../../cost-savings-engine");
      const summary = await getSavingsSummary(orgId, startDate, endDate);

      res.json(summary);
    })
  );

  app.get("/api/cost-savings/trend", requireOrgId,
    withErrorHandling("fetch cost savings trend", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsTrendQuerySchema.parse(req.query);

      const { getMonthlySavingsTrend } = await import("../../cost-savings-engine");
      const trend = await getMonthlySavingsTrend(orgId, validatedQuery.months);

      res.json(trend);
    })
  );

  app.post("/api/cost-savings/calculate/:workOrderId", requireOrgId, writeOperationRateLimit,
    withErrorHandling("calculate cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { workOrderId } = req.params;
      const validatedOptions = costSavingsCalculateOptionsSchema.parse(req.body);

      const { calculateWorkOrderSavings } = await import("../../cost-savings-engine");
      const calculation = await calculateWorkOrderSavings(
        workOrderId,
        orgId,
        validatedOptions ?? {}
      );

      if (!calculation) {
        return res.status(400).json({
          message:
            "No savings to calculate. This work order is not preventive/predictive maintenance.",
        });
      }

      res.json(calculation);
    })
  );

  app.post("/api/cost-savings/process/:workOrderId", requireOrgId, writeOperationRateLimit,
    withErrorHandling("process cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { workOrderId } = req.params;

      const { processWorkOrderCompletion } = await import("../../cost-savings-engine");
      const result = await processWorkOrderCompletion(workOrderId, orgId);

      res.json(result);
    })
  );

  app.get("/api/cost-savings", requireOrgId,
    withErrorHandling("fetch cost savings", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const validatedQuery = costSavingsListQuerySchema.parse(req.query);

      const { db } = await import("../../db");
      const { eq, and, sql } = await import("drizzle-orm");

      let query = db
        .select()
        .from(costSavings)
        .where(eq(costSavings.orgId, orgId))
        .orderBy(sql`${costSavings.calculatedAt} DESC`)
        .limit(validatedQuery.limit);

      if (validatedQuery.equipmentId) {
        query = query.where(
          and(eq(costSavings.orgId, orgId), eq(costSavings.equipmentId, validatedQuery.equipmentId))
        );
      }

      if (validatedQuery.vesselId) {
        query = query.where(
          and(eq(costSavings.orgId, orgId), eq(costSavings.vesselId, validatedQuery.vesselId))
        );
      }

      const savings = await query;
      res.json(savings);
    })
  );

  app.get("/api/cost-savings/equipment-financials", requireOrgId,
    withErrorHandling("fetch equipment financial summary", async (req, res) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const { equipmentService } = await import("../equipment/service");
      const financials = await equipmentService.getEquipmentFinancialSummary(orgId);

      const { getSavingsSummary } = await import("../../cost-savings-engine");
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      const savingsSummary = await getSavingsSummary(orgId, startDate, endDate);

      const assetROI = financials.totalFleetValue > 0
        ? ((savingsSummary.totalSavings + financials.totalCapitalRecovered) / financials.totalFleetValue) * 100
        : 0;

      res.json({
        ...financials,
        assetROI: Math.round(assetROI * 100) / 100,
        totalMaintenanceSavings: savingsSummary.totalSavings,
      });
    })
  );

  logger.info("CostSavingsRoutes", "Registered: summary, trend, calculate, process, list, equipment-financials");
}

```

---

## Crew (Members, Scheduling, STCW, Extensions)

### `server/domains/scheduling/routes.ts` (384 lines)

```ts
import { Express, Request, Response, RequestHandler } from "express";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { schedulingSettingsService } from "../../services/scheduling-settings/service";
import { logger } from "../../utils/logger";

interface SchedulingConfig {
  storage: any;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

export function registerSchedulingRoutes(app: Express, config: SchedulingConfig) {
  const { storage, requireOrgId, writeOperationRateLimit } = config;

  app.get("/api/schedule", requireOrgId,
    withErrorHandling("fetch maintenance schedules", async (req: Request, res: Response) => {
      const { vesselId, equipmentId, status, dateFrom, dateTo } = req.query;
      const schedules = await storage.getMaintenanceSchedules({
        vesselId: vesselId as string,
        equipmentId: equipmentId as string,
        status: status as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      });
      res.json(schedules);
    })
  );

  app.get("/api/schedule/:id", requireOrgId,
    withErrorHandling("fetch schedule", async (req: Request, res: Response) => {
      const schedule = await storage.getMaintenanceSchedule(req.params.id);
      if (!schedule) {
        return sendNotFound(res, "Schedule");
      }
      res.json(schedule);
    })
  );

  app.post("/api/schedule", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create schedule", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const scheduleData = { ...req.body, orgId };
      const schedule = await storage.createMaintenanceSchedule(scheduleData);
      sendCreated(res, schedule);
    })
  );

  app.put("/api/schedule/:id", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update schedule", async (req: Request, res: Response) => {
      const schedule = await storage.updateMaintenanceSchedule(req.params.id, req.body);
      res.json(schedule);
    })
  );

  app.delete("/api/schedule/:id", requireOrgId, writeOperationRateLimit,
    withErrorHandling("delete schedule", async (req: Request, res: Response) => {
      await storage.deleteMaintenanceSchedule(req.params.id);
      sendDeleted(res);
    })
  );

  app.post("/api/schedule/bulk", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create bulk schedules", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const { schedules } = req.body;
      if (!Array.isArray(schedules)) {
        res.status(400).json({ message: "schedules must be an array" });
        return;
      }
      const results = await Promise.all(
        schedules.map((s: any) => storage.createMaintenanceSchedule({ ...s, orgId }))
      );
      sendCreated(res, results);
    })
  );

  app.get("/api/schedule/conflicts", requireOrgId,
    withErrorHandling("detect conflicts", async (req: Request, res: Response) => {
      const { dateFrom, dateTo, vesselId } = req.query;
      const schedules = await storage.getMaintenanceSchedules({
        vesselId: vesselId as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      });

      const conflicts: any[] = [];
      for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
          const s1 = schedules[i];
          const s2 = schedules[j];
          if (
            s1.scheduledDate === s2.scheduledDate &&
            s1.assignedCrewId === s2.assignedCrewId
          ) {
            conflicts.push({
              schedule1: s1,
              schedule2: s2,
              conflictType: "crew_overlap",
            });
          }
        }
      }

      res.json(conflicts);
    })
  );

  app.get("/api/optimization/configurations", requireOrgId,
    withErrorHandling("fetch optimization configurations", async (req: Request, res: Response) => {
      const configs = await storage.getOptimizationConfigurations();
      res.json(configs);
    })
  );

  app.post("/api/optimization/configurations", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create optimization configuration", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const config = await storage.createOptimizationConfiguration({ ...req.body, orgId });
      sendCreated(res, config);
    })
  );

  app.get("/api/optimization/results", requireOrgId,
    withErrorHandling("fetch optimization results", async (req: Request, res: Response) => {
      const { configId, dateFrom, dateTo } = req.query;
      const results = await storage.getOptimizationResults({
        configId: configId as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      });
      res.json(results);
    })
  );

  app.post("/api/optimization/results", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create optimization result", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const result = await storage.createOptimizationResult({ ...req.body, orgId });
      sendCreated(res, result);
    })
  );

  app.post("/api/optimization/run", requireOrgId, writeOperationRateLimit,
    withErrorHandling("run optimization", async (req: Request, res: Response) => {
      const { configId, targetDate } = req.body;
      const orgId = req.headers["x-org-id"] as string;

      const schedules = await storage.getMaintenanceSchedules({
        dateFrom: new Date(),
        dateTo: targetDate ? new Date(targetDate) : undefined,
      });

      const optimizedSchedules = schedules.map((s: any, index: number) => ({
        ...s,
        optimizedScore: (index % 10) * 10 + 5,
        suggestedDate: s.scheduledDate,
        suggestedCrew: s.assignedCrewId,
      }));

      const result = await storage.createOptimizationResult({
        configId,
        orgId,
        inputSchedules: schedules.length,
        outputSchedules: optimizedSchedules.length,
        improvementScore: 15.5,
        status: "completed",
        results: optimizedSchedules,
      });

      res.json(result);
    })
  );

  app.get("/api/schedule/calendar", requireOrgId,
    withErrorHandling("fetch calendar data", async (req: Request, res: Response) => {
      const { month, year, vesselId } = req.query;
      const targetMonth = month ? Number.parseInt(month as string) : new Date().getMonth();
      const targetYear = year ? Number.parseInt(year as string) : new Date().getFullYear();

      const startDate = new Date(targetYear, targetMonth, 1);
      const endDate = new Date(targetYear, targetMonth + 1, 0);

      const schedules = await storage.getMaintenanceSchedules({
        vesselId: vesselId as string,
        dateFrom: startDate,
        dateTo: endDate,
      });

      const calendarData: Record<string, any[]> = {};
      schedules.forEach((schedule: any) => {
        const dateKey = schedule.scheduledDate?.split("T")[0] || schedule.scheduledDate;
        if (!calendarData[dateKey]) {
          calendarData[dateKey] = [];
        }
        calendarData[dateKey].push(schedule);
      });

      res.json(calendarData);
    })
  );

  app.get("/api/schedule/stats", requireOrgId,
    withErrorHandling("fetch schedule statistics", async (req: Request, res: Response) => {
      const { vesselId, months } = req.query;
      const monthsNum = months ? Number.parseInt(months as string) : 3;
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - monthsNum);

      const schedules = await storage.getMaintenanceSchedules({
        vesselId: vesselId as string,
        dateFrom: cutoffDate,
      });

      const stats = {
        total: schedules.length,
        completed: schedules.filter((s: any) => s.status === "completed").length,
        pending: schedules.filter((s: any) => s.status === "pending").length,
        overdue: schedules.filter((s: any) => {
          const dueDate = new Date(s.scheduledDate);
          return s.status !== "completed" && dueDate < new Date();
        }).length,
        byPriority: {
          critical: schedules.filter((s: any) => s.priority === "critical").length,
          high: schedules.filter((s: any) => s.priority === "high").length,
          medium: schedules.filter((s: any) => s.priority === "medium").length,
          low: schedules.filter((s: any) => s.priority === "low").length,
        },
        completionRate: schedules.length > 0
          ? (schedules.filter((s: any) => s.status === "completed").length / schedules.length) * 100
          : 0,
      };

      res.json(stats);
    })
  );

  app.get("/api/schedule/upcoming", requireOrgId,
    withErrorHandling("fetch upcoming maintenance", async (req: Request, res: Response) => {
      const { days, vesselId, limit } = req.query;
      const daysNum = days ? Number.parseInt(days as string) : 30;
      const limitNum = limit ? Number.parseInt(limit as string) : 50;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysNum);

      const schedules = await storage.getMaintenanceSchedules({
        vesselId: vesselId as string,
        dateFrom: new Date(),
        dateTo: endDate,
        status: "pending",
      });

      const upcoming = schedules
        .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .slice(0, limitNum);

      res.json(upcoming);
    })
  );

  // ========================================
  // Scheduling Settings API Routes
  // ========================================

  app.get("/api/scheduling-settings", requireOrgId,
    withErrorHandling("fetch scheduling settings", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vesselId = req.query.vesselId as string | undefined;
      
      const effective = await schedulingSettingsService.resolveEffectiveSettings(orgId, vesselId);
      const settings = await schedulingSettingsService.getSettings(orgId, vesselId);
      
      res.json({
        id: settings?.id || "",
        orgId,
        vesselId: vesselId || null,
        notificationSettings: effective.notificationSettings,
        ruleThresholds: effective.ruleThresholds,
        ruleEnforcement: effective.ruleEnforcement,
        aiWeights: effective.aiWeights,
        publishBehavior: effective.publishBehavior,
        rotationTemplates: effective.rotationTemplates,
        source: effective.source,
      });
    })
  );

  app.patch("/api/scheduling-settings/notifications", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update notification settings", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vesselId = req.query.vesselId as string | undefined;
      
      const updated = await schedulingSettingsService.updateNotificationSettings(
        orgId,
        req.body,
        vesselId
      );
      
      logger.info("[SchedulingSettings] Notifications updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch("/api/scheduling-settings/rules", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update rule settings", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vesselId = req.query.vesselId as string | undefined;
      const { thresholds, enforcement } = req.body;
      
      const updated = await schedulingSettingsService.updateRuleThresholds(
        orgId,
        thresholds,
        enforcement,
        vesselId
      );
      
      logger.info("[SchedulingSettings] Rules updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch("/api/scheduling-settings/ai-weights", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update AI weights", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vesselId = req.query.vesselId as string | undefined;
      
      const updated = await schedulingSettingsService.updateAiWeights(
        orgId,
        req.body,
        vesselId
      );
      
      logger.info("[SchedulingSettings] AI weights updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch("/api/scheduling-settings/publish-behavior", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update publish behavior", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vesselId = req.query.vesselId as string | undefined;
      
      const updated = await schedulingSettingsService.updatePublishBehavior(
        orgId,
        req.body,
        vesselId
      );
      
      logger.info("[SchedulingSettings] Publish behavior updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.patch("/api/scheduling-settings/rotation-templates", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update rotation templates", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vesselId = req.query.vesselId as string | undefined;
      
      const updated = await schedulingSettingsService.updateRotationTemplates(
        orgId,
        req.body,
        vesselId
      );
      
      logger.info("[SchedulingSettings] Rotation templates updated", { orgId, vesselId });
      res.json(updated);
    })
  );

  app.post("/api/scheduling-settings/reset", requireOrgId, writeOperationRateLimit,
    withErrorHandling("reset scheduling settings", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vesselId = req.query.vesselId as string | undefined;
      
      const reset = await schedulingSettingsService.resetToDefaults(orgId, vesselId);
      
      logger.info("[SchedulingSettings] Settings reset to defaults", { orgId, vesselId });
      res.json(reset);
    })
  );

  logger.info("[SchedulingRoutes] Scheduling settings routes registered");
}

```

### `server/domains/stcw-rest/routes/types.ts` (41 lines)

```ts
/**
 * STCW Rest Routes Types
 *
 * Shared types and schemas for STCW hours of rest API.
 */

import { z } from "zod";
import { IStorage } from "../../../storage";
import { RateLimitRequestHandler } from "express-rate-limit";

export interface RestDay {
  date: string;
  h0?: number; h1?: number; h2?: number; h3?: number;
  h4?: number; h5?: number; h6?: number; h7?: number;
  h8?: number; h9?: number; h10?: number; h11?: number;
  h12?: number; h13?: number; h14?: number; h15?: number;
  h16?: number; h17?: number; h18?: number; h19?: number;
  h20?: number; h21?: number; h22?: number; h23?: number;
  [key: string]: string | number | undefined;
}

export const rangeQuerySchema = z.object({
  vesselId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  complianceFilter: z.enum(["all", "compliant", "non-compliant"]).optional().default("all"),
});

export interface StcwRestDependencies {
  storage: IStorage;
  writeOperationRateLimit: RateLimitRequestHandler;
  checkMonthCompliance: (rows: RestDay[]) => any;
  normalizeRestDays: (rows: any[]) => RestDay[];
  generatePdfFilename: (crewId: string, year: number, month: string) => string;
  renderRestPdf: (sheet: any, days: RestDay[], options: { outputPath: string; title: string }) => Promise<void>;
  incrementIdempotencyHit: (endpoint: string) => void;
  incrementHorImport: (crewId: string, format: string, rowCount: number) => void;
  incrementHorPdfExport: (crewId: string, month: string, year: number) => void;
  incrementRangeQuery: (queryType: string, id: string) => void;
  recordRangeQueryDuration: (queryType: string, durationMs: number) => void;
}

```

### `server/domains/stcw-rest/routes/index.ts` (35 lines)

```ts
/**
 * STCW Rest Routes - Modular Entry Point
 *
 * Orchestrates registration of all STCW hours of rest route modules.
 *
 * @see ./import.ts - Import and compliance check routes
 * @see ./data.ts - Data retrieval and export routes
 * @see ./range.ts - Range queries and planning preparation
 * @see ./fatigue.ts - Fatigue risk assessment routes
 * @see ./admin.ts - Data management operations
 */

import { Express } from "express";
import { registerImportRoutes } from "./import";
import { registerDataRoutes } from "./data";
import { registerRangeRoutes } from "./range";
import { registerFatigueRoutes } from "./fatigue";
import { registerAdminRoutes } from "./admin";
import type { StcwRestDependencies } from "./types";
import { logger } from "../../../utils/logger.js";

export function registerStcwRestRoutes(
  app: Express,
  deps: StcwRestDependencies
): void {
  registerImportRoutes(app, deps);
  registerDataRoutes(app, deps);
  registerRangeRoutes(app, deps);
  registerFatigueRoutes(app, deps);
  registerAdminRoutes(app, deps);

  logger.info("STCWRestRoutes", "Registered (import: 2, export: 2, compliance: 2, fatigue: 3, range: 3, data: 6)");
}

export type { StcwRestDependencies, RestDay } from "./types";

```

### `server/domains/stcw-rest/routes/admin.ts` (33 lines)

```ts
/**
 * STCW Rest Admin Routes
 *
 * Data management and clear operations.
 */

import { Express, Request, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies } from "./types";

export function registerAdminRoutes(app: Express, deps: StcwRestDependencies): void {
  const { storage } = deps;

  app.delete("/api/work-orders/clear",
    withErrorHandling("clear work orders", async (_req: Request, res: Response) => {
      await storage.clearAllWorkOrders();
      res.json({
        ok: true,
        message: "All work orders cleared successfully",
      });
    })
  );

  app.delete("/api/maintenance/schedules/clear",
    withErrorHandling("clear maintenance schedules", async (_req: Request, res: Response) => {
      await storage.clearAllMaintenanceSchedules();
      res.json({
        ok: true,
        message: "All maintenance schedules cleared successfully",
      });
    })
  );
}

```

### `server/domains/stcw-rest/routes/data.ts` (154 lines)

```ts
/**
 * STCW Rest Data Routes
 *
 * Data retrieval, export, and sheet management endpoints.
 */

import { Express, Request, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies } from "./types";

export function registerDataRoutes(app: Express, deps: StcwRestDependencies): void {
  const {
    storage,
    generatePdfFilename,
    renderRestPdf,
    incrementHorPdfExport,
  } = deps;

  app.get("/api/stcw/rest/:crewId/:year/:month",
    withErrorHandling("fetch rest data", async (req: Request, res: Response) => {
      const { crewId, year, month } = req.params;

      if (!crewId || !year || !month) {
        res.status(400).json({
          error: "crewId, year, and month are required",
        });
        return;
      }

      const restData = await storage.getCrewRestMonth(crewId, Number.parseInt(year), month);

      if (!restData.sheet) {
        res.status(404).json({
          error: "No rest sheet found for this crew member and month",
        });
        return;
      }

      res.json(restData);
    })
  );

  app.get("/api/stcw/export/:crewId/:year/:month",
    withErrorHandling("export STCW PDF", async (req: Request, res: Response) => {
      const { crewId, year, month } = req.params;

      if (!crewId || !year || !month) {
        res.status(400).json({
          error: "crewId, year, and month are required",
        });
        return;
      }

      const restData = await storage.getCrewRestMonth(crewId, Number.parseInt(year), month);

      if (!restData.sheet) {
        res.status(404).json({
          error: "No rest sheet found for this crew member and month",
        });
        return;
      }

      const pdfPath = generatePdfFilename(crewId, Number.parseInt(year), month);

      await renderRestPdf(restData.sheet, restData.days, {
        outputPath: pdfPath,
        title: `STCW Hours of Rest - ${restData.sheet.crewName}`,
      });

      incrementHorPdfExport(crewId, month, Number.parseInt(year));

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="stcw_rest_${crewId}_${year}_${month}.pdf"`
      );

      const fs = await import("fs");
      const pdfBuffer = fs.readFileSync(pdfPath);
      res.send(pdfBuffer);
    })
  );

  app.get("/api/crew/rest/export_pdf",
    withErrorHandling("export STCW rest PDF", async (req: Request, res: Response) => {
      const { crew_id, year, month } = req.query;

      if (!crew_id || !year || !month) {
        res.status(400).json({
          error: "crew_id, year, and month are required",
        });
        return;
      }

      const restData = await storage.getCrewRestMonth(
        crew_id as string,
        Number.parseInt(year as string),
        month as string
      );

      if (!restData.sheet) {
        res.status(404).json({
          ok: false,
          error: "No rest sheet found for this crew member and month",
        });
        return;
      }

      const pdfPath = generatePdfFilename(
        crew_id as string,
        Number.parseInt(year as string),
        month as string
      );

      await renderRestPdf(restData.sheet, restData.days, {
        outputPath: pdfPath,
        title: `STCW Hours of Rest - ${restData.sheet.crewName}`,
      });

      res.json({
        ok: true,
        path: pdfPath,
      });
    })
  );

  app.get("/api/crew/rest/sheet",
    withErrorHandling("fetch STCW rest sheet", async (req: Request, res: Response) => {
      const { crew_id, year, month } = req.query;

      if (!crew_id || !year || !month) {
        res.status(400).json({
          error: "crew_id, year, and month are required",
        });
        return;
      }

      const restData = await storage.getCrewRestMonth(
        crew_id as string,
        Number.parseInt(year as string),
        month as string
      );

      if (!restData.sheet) {
        res.status(404).json({
          error: "No rest sheet found for this crew member and month",
        });
        return;
      }

      res.json(restData);
    })
  );
}

```

### `server/domains/stcw-rest/routes/fatigue.ts` (153 lines)

```ts
/**
 * STCW Rest Fatigue Routes
 *
 * Fatigue risk assessment for crew, vessel, and fleet.
 */

import { Express, Request, Response } from "express";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies } from "./types";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerFatigueRoutes(app: Express, deps: StcwRestDependencies): void {
  const { storage } = deps;

  app.get("/api/hor/fatigue/:crewId",
    withErrorHandling("calculate fatigue risk", async (req: Request, res: Response) => {
      const { crewId } = req.params;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const { days: restDays } = await storage.getCrewRestRange(
        crewId,
        startDateStr,
        endDateStr
      );

      const crewMember = await storage.getCrewMember(crewId);

      const { calculateFatigueRisk, normalizeRestDays: normalizeForFatigue } = await import("../../../stcw-compliance");
      const normalizedDays = normalizeForFatigue(restDays);
      const fatigueResult = calculateFatigueRisk(
        crewId,
        normalizedDays,
        crewMember?.name
      );

      res.json(fatigueResult);
    })
  );

  app.get("/api/hor/fatigue/vessel/:vesselId",
    withErrorHandling("calculate vessel fatigue summary", async (req: Request, res: Response) => {
      const { vesselId } = req.params;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const crewMembers = await storage.getCrew(undefined, vesselId);

      const { calculateFatigueRisk, calculateVesselFatigueSummary, normalizeRestDays: normalizeForFatigue } = 
        await import("../../../stcw-compliance");

      const fatigueResults = await Promise.all(
        crewMembers.map(async (crew) => {
          const { days: restDays } = await storage.getCrewRestRange(
            crew.id,
            startDateStr,
            endDateStr
          );
          const normalizedDays = normalizeForFatigue(restDays);
          return calculateFatigueRisk(crew.id, normalizedDays, crew.name);
        })
      );

      const summary = calculateVesselFatigueSummary(fatigueResults);

      res.json({
        vesselId,
        lookbackDays,
        startDate: startDateStr,
        endDate: endDateStr,
        summary,
        crewFatigue: fatigueResults,
      });
    })
  );

  app.get("/api/hor/fatigue/fleet",
    withErrorHandling("calculate fleet fatigue overview", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { days = "14" } = req.query;
      const lookbackDays = Number.parseInt(days as string) || 14;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      const vessels = await storage.getVessels(orgId);
      const { calculateFatigueRisk, calculateVesselFatigueSummary, normalizeRestDays: normalizeForFatigue } = 
        await import("../../../stcw-compliance");

      const vesselSummaries = await Promise.all(
        vessels.map(async (vessel) => {
          const crewMembers = await storage.getCrew(undefined, vessel.id);
          
          const fatigueResults = await Promise.all(
            crewMembers.map(async (crew) => {
              const { days: restDays } = await storage.getCrewRestRange(
                crew.id,
                startDateStr,
                endDateStr
              );
              const normalizedDays = normalizeForFatigue(restDays);
              return calculateFatigueRisk(crew.id, normalizedDays, crew.name);
            })
          );

          const summary = calculateVesselFatigueSummary(fatigueResults);
          return {
            vesselId: vessel.id,
            vesselName: vessel.name,
            ...summary,
          };
        })
      );

      const allCrew = vesselSummaries.flatMap((v: any) => v.highestRiskCrew ?? []);
      const fleetSummary = {
        totalVessels: vessels.length,
        totalCrew: vesselSummaries.reduce((sum, v: any) => sum + (v.totalCrew ?? 0), 0),
        criticalCount: vesselSummaries.reduce((sum, v: any) => sum + (v.criticalCount ?? 0), 0),
        highCount: vesselSummaries.reduce((sum, v: any) => sum + (v.highCount ?? 0), 0),
        mediumCount: vesselSummaries.reduce((sum, v: any) => sum + (v.mediumCount ?? 0), 0),
        lowCount: vesselSummaries.reduce((sum, v: any) => sum + (v.lowCount ?? 0), 0),
        highestRiskCrew: allCrew.sort((a: any, b: any) => b.score - a.score).slice(0, 10),
      };

      res.json({
        lookbackDays,
        startDate: startDateStr,
        endDate: endDateStr,
        fleetSummary,
        vesselSummaries,
      });
    })
  );
}

```

### `server/domains/stcw-rest/routes/import.ts` (225 lines)

```ts
/**
 * STCW Rest Import Routes
 *
 * Import, compliance check, and STCW data import endpoints.
 */

import { Express, Request, Response } from "express";
import { insertCrewRestSheetSchema } from "@shared/schema";
import { withErrorHandling } from "../../../lib/route-utils";
import { StcwRestDependencies, RestDay } from "./types";

export function registerImportRoutes(app: Express, deps: StcwRestDependencies): void {
  const {
    storage,
    checkMonthCompliance,
    normalizeRestDays,
    incrementIdempotencyHit,
    incrementHorImport,
  } = deps;

  app.post("/api/crew/rest/import",
    withErrorHandling("import STCW rest data", async (req: Request, res: Response) => {
      const startTime = Date.now();

      const idempotencyKey = req.header("Idempotency-Key");
      if (idempotencyKey) {
        const isDuplicate = await storage.checkIdempotency(idempotencyKey, "/api/crew/rest/import");
        if (isDuplicate) {
          incrementIdempotencyHit("/api/crew/rest/import");
          res.json({
            ok: true,
            duplicate: true,
            message: "Request already processed - idempotent response",
          });
          return;
        }
      }

      let rows: RestDay[] = [];
      const format = req.body.csv ? "csv" : "json";

      if (req.body.csv) {
        const lines = req.body.csv.trim().split("\n");
        const headers = lines[0].split(",");

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",");
          const row: any = { date: values[0] };

          for (let h = 0; h < 24; h++) {
            const headerIndex = headers.indexOf(`h${h}`);
            if (headerIndex >= 0) {
              row[`h${h}`] = Number.parseInt(values[headerIndex] || "0");
            }
          }
          rows.push(row);
        }
      } else if (req.body.rows) {
        rows = req.body.rows;
      }

      rows = normalizeRestDays(rows);

      const orgId = (req as any).orgId || req.header("x-org-id") || "default-org-id";
      const crewId = req.body.sheet?.crewId || req.body.sheet?.crew_id;
      const crewName = req.body.sheet?.crewName || req.body.sheet?.crew_name || "Unknown";
      const sheetData = insertCrewRestSheetSchema.parse({
        ...req.body.sheet,
        crewId,
        crewName,
        orgId,
      });

      const sheet = await storage.createCrewRestSheet(sheetData);

      let rowCount = 0;
      for (const dayData of rows) {
        await storage.upsertCrewRestDay(sheet.id, { ...dayData, orgId: sheetData.orgId });
        rowCount++;
      }

      if (idempotencyKey) {
        await storage.recordIdempotency(idempotencyKey, "/api/crew/rest/import");
      }

      incrementHorImport(sheetData.crewId, format, rowCount);

      const processingTime = Date.now() - startTime;

      res.json({
        ok: true,
        sheet_id: sheet.id,
        rows: rowCount,
        processing_time_ms: processingTime,
      });
    })
  );

  app.post("/api/crew/rest/check",
    withErrorHandling("check STCW compliance", async (req: Request, res: Response) => {
      let rows: RestDay[] = [];

      if (req.body.rows) {
        rows = normalizeRestDays(req.body.rows);
      } else {
        const { crew_id, year, month } = req.body;
        if (!crew_id || !year || !month) {
          res.status(400).json({
            error: "crew_id, year, and month are required",
          });
          return;
        }

        const restData = await storage.getCrewRestMonth(crew_id, Number.parseInt(year), month);
        if (!restData.sheet) {
          res.status(404).json({
            ok: false,
            error: "No rest sheet found for this crew member and month",
          });
          return;
        }

        rows = restData.days;
      }

      const compliance = checkMonthCompliance(rows);
      res.json(compliance);
    })
  );

  app.get("/api/stcw/compliance/:crewId/:year/:month",
    withErrorHandling("check STCW compliance", async (req: Request, res: Response) => {
      const { crewId, year, month } = req.params;

      if (!crewId || !year || !month) {
        res.status(400).json({
          error: "crewId, year, and month are required",
        });
        return;
      }

      const restData = await storage.getCrewRestMonth(crewId, Number.parseInt(year), month);
      if (!restData.sheet) {
        res.status(200).json({
          ok: false,
          error: "No rest sheet found",
          message: "Upload or import rest data first to check compliance",
          days: [],
          rolling7d: [],
        });
        return;
      }

      const compliance = checkMonthCompliance(restData.days);
      res.json(compliance);
    })
  );

  app.post("/api/stcw/import",
    withErrorHandling("import STCW data", async (req: Request, res: Response) => {
      const startTime = Date.now();

      const idempotencyKey = req.header("Idempotency-Key");
      if (idempotencyKey) {
        const isDuplicate = await storage.checkIdempotency(idempotencyKey, "/api/stcw/import");
        if (isDuplicate) {
          incrementIdempotencyHit("/api/stcw/import");
          res.json({
            success: true,
            duplicate: true,
            message: "Request already processed - idempotent response",
          });
          return;
        }
      }

      const { crewId, year, month, data } = req.body;

      if (!crewId || !year || !month || !data) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: crewId, year, month, data",
        });
        return;
      }

      let rows: RestDay[] = typeof data === "string" ? JSON.parse(data) : data;
      rows = normalizeRestDays(rows);

      const orgId = (req as any).orgId || req.header("x-org-id") || "default-org-id";
      // Get crew name from storage if not provided
      const crewMember = await storage.getCrewMember(crewId);
      const crewName = crewMember?.name || "Unknown";
      const sheet = await storage.createCrewRestSheet({
        crewId,
        crewName,
        year: Number.parseInt(year),
        month,
        status: "draft",
        orgId,
      });

      let rowCount = 0;
      for (const dayData of rows) {
        await storage.upsertCrewRestDay(sheet.id, { ...dayData, orgId });
        rowCount++;
      }

      if (idempotencyKey) {
        await storage.recordIdempotency(idempotencyKey, "/api/stcw/import");
      }

      incrementHorImport(crewId, "json", rowCount);

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        sheetId: sheet.id,
        rowsImported: rowCount,
        processingTimeMs: processingTime,
      });
    })
  );
}

```

### `server/domains/stcw-rest/routes/range.ts` (164 lines)

```ts
/**
 * STCW Rest Range Routes
 *
 * Range queries, planning preparation, and advanced search endpoints.
 */

import { Express, Request, Response } from "express";
import { z } from "zod";
import { withErrorHandling, handleApiError } from "../../../lib/route-utils";
import { StcwRestDependencies, RestDay, rangeQuerySchema } from "./types";
import { logger } from "../../../utils/logger.js";

export function registerRangeRoutes(app: Express, deps: StcwRestDependencies): void {
  const {
    storage,
    incrementRangeQuery,
    recordRangeQueryDuration,
  } = deps;

  app.post("/api/crew/rest/prepare_for_plan",
    withErrorHandling("prepare HoR context for planning", async (req: Request, res: Response) => {
      const { crew, range } = req.body;

      if (!crew || !range || !range.start || !range.end) {
        res.status(400).json({
          ok: false,
          error: "Missing crew or range parameters",
        });
        return;
      }

      const { prepareCrewHoRContext } = await import("../../../hor-plan-utils");

      const crewIds = crew.map((c: { id: string }) => c.id);

      const getHistoryRows = async (
        crewId: string,
        start: string,
        end: string
      ): Promise<RestDay[]> => {
        try {
          const startDate = new Date(start);
          const endDate = new Date(end);

          const results: RestDay[] = [];

          const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const endLimit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

          while (current <= endLimit) {
            const year = current.getFullYear();
            const month = current.getMonth() + 1;

            try {
              const restData = await storage.getCrewRestMonth(crewId, year, month);
              if (restData.days && restData.days.length > 0) {
                const filteredDays = restData.days.filter((day: RestDay) => {
                  const dayDate = new Date(day.date);
                  return dayDate >= startDate && dayDate <= endDate;
                });
                results.push(...filteredDays);
              }
            } catch (_error) {
              logger.warn("STCWRestRange", `No rest data found for crew ${crewId} in ${year}-${month}`);
            }

            current.setMonth(current.getMonth() + 1);
          }

          return results;
        } catch (error) {
          logger.error("STCWRestRange", `Failed to get history for crew ${crewId}`, error);
          return [];
        }
      };

      const contexts = await prepareCrewHoRContext(crewIds, range.start, range.end, getHistoryRows);

      res.json({
        ok: true,
        contexts: contexts.map((ctx: any) => ({
          crew_id: ctx.crew_id,
          context: ctx.context,
          history_available: ctx.history_rows.length > 0,
        })),
      });
    })
  );

  app.get("/api/stcw/rest/range/:crewId/:startDate/:endDate",
    withErrorHandling("fetch crew rest range data", async (req: Request, res: Response) => {
      const startTime = Date.now();
      const { crewId, startDate, endDate } = req.params;

      if (!crewId || !startDate || !endDate) {
        res.status(400).json({
          error: "Missing required parameters: crewId, startDate, endDate",
        });
        return;
      }

      incrementRangeQuery("crew_range", crewId);

      const result = await storage.getCrewRestRange(crewId, startDate, endDate);

      recordRangeQueryDuration("crew_range", Date.now() - startTime);

      res.json(result);
    })
  );

  app.get("/api/stcw/rest/vessel/:vesselId/:year/:month",
    withErrorHandling("fetch vessel crew rest data", async (req: Request, res: Response) => {
      const startTime = Date.now();
      const { vesselId, year, month } = req.params;

      if (!vesselId || !year || !month) {
        res.status(400).json({
          error: "vesselId, year, and month are required",
        });
        return;
      }

      incrementRangeQuery("vessel_crew", vesselId);

      const result = await storage.getVesselCrewRest(vesselId, Number.parseInt(year), month);

      recordRangeQueryDuration("vessel_crew", Date.now() - startTime);

      res.json(result);
    })
  );

  app.get("/api/stcw/rest/search", async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const queryValidation = rangeQuerySchema.parse(req.query);
      const { vesselId, startDate, endDate, complianceFilter } = queryValidation;

      incrementRangeQuery("advanced_search", vesselId || "fleet");

      const result = await storage.getCrewRestByDateRange(
        vesselId || "",
        startDate,
        endDate,
        complianceFilter
      );

      recordRangeQueryDuration("advanced_search", Date.now() - startTime);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Invalid query parameters",
          errors: error.errors,
          code: "VALIDATION_ERROR",
        });
        return;
      }
      handleApiError(res, error, "search crew rest data");
    }
  });
}

```

---

## Logistics (Inventory, Inventory Optimization, Hub Sync)

### `server/domains/inventory/interfaces/routes.ts` (359 lines)

```ts
import type { Express, Request, Response } from "express";
import { inventoryService } from "../service";
import { inventorySupplierRouter } from "./supplier-routes";
import { insertPartsInventorySchema } from "@shared/schema-runtime";
import {
  requireOrgId,
  requireOrgIdAndValidateBody,
  AuthenticatedRequest,
} from "../../../middleware/auth";
import {
  withErrorHandling,
  sendNotFound,
  sendCreated,
  sendDeleted,
} from "../../../lib/route-utils";
import { requirePermission } from "../../permissions/middleware";

/**
 * Inventory (Parts) Routes - Interfaces Layer
 * Handles HTTP concerns for inventory domain (parts catalog and inventory)
 */
export function registerInventoryRoutes(
  app: Express,
  rateLimit: {
    writeOperationRateLimit: any;
    criticalOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = rateLimit;

  // ========== Parts (Enhanced Catalog) Endpoints ==========

  // GET /api/parts - List all parts
  app.get(
    "/api/parts",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch parts", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const parts = await inventoryService.listParts(orgId);
      res.json(parts);
    })
  );

  // DELETE /api/parts/:id - Delete part
  app.delete(
    "/api/parts/:id",
    requireOrgId,
    requirePermission("inventory", "delete"),
    criticalOperationRateLimit,
    withErrorHandling("delete part", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      await inventoryService.deletePart(req.params.id, orgId, req.user?.id);
      sendDeleted(res);
    })
  );

  // POST /api/parts/availability - Check part availability
  app.post(
    "/api/parts/availability",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("check part availability", async (req: Request, res: Response) => {
      const { partId, quantity } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      if (!partId || !quantity) {
        return res.status(400).json({
          message: "partId and quantity are required",
        });
      }

      const availability = await inventoryService.checkAvailability(partId, quantity, orgId);
      res.json(availability);
    })
  );

  // POST /api/parts/:id/sync-costs - Sync part costs to stock
  app.post(
    "/api/parts/:id/sync-costs",
    requireOrgId,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("sync part costs", async (req: Request, res: Response) => {
      await inventoryService.syncPartCosts(req.params.id, req.user?.id);
      res.json({
        message: "Part costs synchronized successfully",
        partId: req.params.id,
      });
    })
  );

  // GET /api/parts/:partId/compatible-equipment - Get compatible equipment for part
  app.get(
    "/api/parts/:partId/compatible-equipment",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch compatible equipment", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipment = await inventoryService.getCompatibleEquipment(req.params.partId, orgId);
      res.json(equipment);
    })
  );

  // PATCH /api/parts/:partId/compatibility - Update part compatibility
  app.patch(
    "/api/parts/:partId/compatibility",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update part compatibility", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { equipmentIds } = req.body;

      if (!Array.isArray(equipmentIds)) {
        return res.status(400).json({
          message: "equipmentIds must be an array",
        });
      }

      const part = await inventoryService.updateCompatibility(
        req.params.partId,
        equipmentIds,
        orgId,
        req.user?.id
      );
      res.json(part);
    })
  );

  // ========== Parts Inventory (CMMS-lite) Endpoints ==========

  // GET /api/parts-inventory - List all parts inventory
  app.get(
    "/api/parts-inventory",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch parts inventory", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { category, search, sortBy, sortOrder } = req.query;

      const inventory = await inventoryService.listPartsInventory(
        category as string | undefined,
        orgId,
        search as string | undefined,
        sortBy as string | undefined,
        sortOrder as "asc" | "desc" | undefined
      );

      // Transform the flat response to match frontend expectations (nested stock object)
      const transformedParts = inventory.map((part: any) => {
        const quantityOnHand = part.quantityOnHand || 0;
        const quantityReserved = part.quantityReserved || 0;
        const availableQuantity = quantityOnHand - quantityReserved;
        const unitCost = part.unitCost || 0;

        return {
          id: part.id,
          partNumber: part.partNumber,
          partName: part.partName,
          description: part.description,
          category: part.category,
          unitOfMeasure: part.unitOfMeasure || "ea",
          standardCost: unitCost,
          criticality: part.criticality || "medium",
          leadTimeDays: part.leadTimeDays || 7,
          minStockLevel: part.minStockLevel || 0,
          maxStockLevel: part.maxStockLevel || 100,
          supplierName: part.supplierName,
          stock:
            part.quantityOnHand !== undefined
              ? {
                  id: `stock-${part.id}`,
                  quantityOnHand,
                  quantityReserved,
                  quantityOnOrder: part.quantityOnOrder || 0,
                  availableQuantity,
                  unitCost,
                  location: part.location || "MAIN",
                  status: part.stockStatus || "unknown",
                }
              : null,
        };
      });

      res.json(transformedParts);
    })
  );

  // POST /api/parts-inventory - Create new inventory item
  app.post(
    "/api/parts-inventory",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "create"),
    writeOperationRateLimit,
    withErrorHandling("create parts inventory item", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;

      const dbData = {
        orgId: req.body.orgId || orgId,
        partNumber: req.body.partNumber,
        partName: req.body.partName,
        description: req.body.description,
        category: req.body.category,
        manufacturer: req.body.manufacturer,
        unitCost: req.body.unitCost,
        quantityOnHand: req.body.quantityOnHand || 0,
        quantityReserved: 0,
        minStockLevel: req.body.minStockLevel,
        maxStockLevel: req.body.maxStockLevel,
        location: req.body.location,
        supplierName: req.body.supplierName,
        supplierPartNumber: req.body.supplierPartNumber,
        leadTimeDays: req.body.leadTimeDays || 7,
        isActive: true,
      };

      const validationResult = insertPartsInventorySchema.safeParse(dbData);
      if (!validationResult.success) {
        throw validationResult.error;
      }

      const item = await inventoryService.createInventoryItem(
        validationResult.data,
        req.user?.id
      );

      sendCreated(res, item);
    })
  );

  // PUT /api/parts-inventory/:id - Update inventory item
  app.put(
    "/api/parts-inventory/:id",
    requireOrgIdAndValidateBody,
    requirePermission("inventory", "edit"),
    writeOperationRateLimit,
    withErrorHandling("update parts inventory item", async (req: Request, res: Response) => {
      const dbData: any = {};
      if (req.body.partNumber !== undefined) { dbData.partNumber = req.body.partNumber; }
      if (req.body.partName !== undefined) { dbData.partName = req.body.partName; }
      if (req.body.description !== undefined) { dbData.description = req.body.description; }
      if (req.body.category !== undefined) { dbData.category = req.body.category; }
      if (req.body.manufacturer !== undefined) { dbData.manufacturer = req.body.manufacturer; }
      if (req.body.unitCost !== undefined) { dbData.unitCost = req.body.unitCost; }
      if (req.body.quantityOnHand !== undefined) { dbData.quantityOnHand = req.body.quantityOnHand; }
      if (req.body.minStockLevel !== undefined) { dbData.minStockLevel = req.body.minStockLevel; }
      if (req.body.maxStockLevel !== undefined) { dbData.maxStockLevel = req.body.maxStockLevel; }
      if (req.body.location !== undefined) { dbData.location = req.body.location; }
      if (req.body.supplierName !== undefined) { dbData.supplierName = req.body.supplierName; }
      if (req.body.supplierPartNumber !== undefined) {
        dbData.supplierPartNumber = req.body.supplierPartNumber;
      }
      if (req.body.leadTimeDays !== undefined) { dbData.leadTimeDays = req.body.leadTimeDays; }
      if (req.body.isActive !== undefined) { dbData.isActive = req.body.isActive; }

      const validationResult = insertPartsInventorySchema.partial().safeParse(dbData);
      if (!validationResult.success) {
        throw validationResult.error;
      }

      const orgId = (req as AuthenticatedRequest).orgId;

      const item = await inventoryService.updateInventoryItem(
        req.params.id,
        validationResult.data,
        req.user?.id,
        orgId
      );

      if (!item) {
        return sendNotFound(res, "Part");
      }

      res.json(item);
    })
  );

  // PATCH /api/parts-inventory/:id/cost - Update part cost
  app.patch(
    "/api/parts-inventory/:id/cost",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update part cost", async (req: Request, res: Response) => {
      const { unitCost, supplier } = req.body;

      if (unitCost === undefined || !supplier) {
        return res.status(400).json({
          message: "unitCost and supplier are required",
        });
      }

      if (typeof unitCost !== "number" || unitCost < 0) {
        return res.status(400).json({
          message: "unitCost must be a non-negative number",
        });
      }

      const item = await inventoryService.updatePartCost(
        req.params.id,
        { unitCost, supplier },
        req.user?.id
      );

      if (!item) {
        return sendNotFound(res, "Part");
      }

      res.json(item);
    })
  );

  // PATCH /api/parts-inventory/:id/stock - Update part stock quantities
  app.patch(
    "/api/parts-inventory/:id/stock",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("update part stock", async (req: Request, res: Response) => {
      const { quantityOnHand, quantityReserved, minStockLevel, maxStockLevel } = req.body;

      const updateData: any = {};
      if (quantityOnHand !== undefined) { updateData.quantityOnHand = quantityOnHand; }
      if (quantityReserved !== undefined) { updateData.quantityReserved = quantityReserved; }
      if (minStockLevel !== undefined) { updateData.minStockLevel = minStockLevel; }
      if (maxStockLevel !== undefined) { updateData.maxStockLevel = maxStockLevel; }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          message:
            "At least one stock field must be provided (quantityOnHand, quantityReserved, minStockLevel, maxStockLevel)",
        });
      }

      for (const [key, value] of Object.entries(updateData)) {
        if (typeof value !== "number" || value < 0) {
          return res.status(400).json({
            message: `${key} must be a non-negative number`,
          });
        }
      }

      const item = await inventoryService.updatePartStock(
        req.params.id,
        updateData,
        req.user?.id
      );

      if (!item) {
        return sendNotFound(res, "Part");
      }

      res.json(item);
    })
  );

  // Register inventory supplier routes
  app.use("/api", inventorySupplierRouter);
}

```

### `server/domains/inventory-optimization/routes.ts` (182 lines)

```ts
/**
 * Inventory Optimization Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 * 
 * Advanced inventory optimization, cost planning, and supplier performance
 * Refactored using Extract Method pattern per SonarQube guidance
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../storage";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { sendBadRequest } from "../../lib/api-helpers";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

interface InventoryOptimizationDependencies {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
}

export function registerInventoryOptimizationRoutes(
  app: Express,
  deps: InventoryOptimizationDependencies
): void {
  const { storage, generalApiRateLimit, writeOperationRateLimit } = deps;

  app.post("/api/parts/:id/sync-costs-legacy", writeOperationRateLimit,
    withErrorHandling("sync part costs", async (req, res) => {
      const { id } = req.params;
      try {
        await storage.syncPartCostToStock(id);
        res.json({
          success: true,
          message: "Cost synchronization completed successfully",
          partId: id,
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes("not found")) {
          return sendNotFound(res, "Part");
        }
        throw error;
      }
    })
  );

  app.post("/api/inventory/cost-planning", generalApiRateLimit,
    withErrorHandling("plan maintenance costs", async (req, res) => {
      const { workOrderIds } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      const allOrders = await storage.getWorkOrders(undefined, orgId);
      const workOrderIdSet = new Set(workOrderIds as string[]);
      const validWorkOrders = allOrders.filter(wo => workOrderIdSet.has(wo.id));

      const { planMaintenanceCosts } = await import("../../inventory");
      const costPlan = await planMaintenanceCosts(validWorkOrders, storage, orgId);

      res.json(costPlan);
    })
  );

  app.get("/api/inventory/substitutions/:partNo", generalApiRateLimit,
    async (req: Request, res: Response, next) => {
      const { cacheMiddleware } = await import("../../middleware/cache-middleware");
      return cacheMiddleware({
        ttl: 900,
        keyGenerator: (r: Request) => `substitutions:${r.params.partNo}:${(r as AuthenticatedRequest).orgId}`,
      })(req, res, next);
    },
    withErrorHandling("find part substitutions", async (req, res) => {
      const { partNo } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;

      const { findPartSubstitutions } = await import("../../inventory");
      const substitutions = await findPartSubstitutions(partNo, storage, orgId);

      res.json(substitutions);
    })
  );

  app.post("/api/inventory/optimize", generalApiRateLimit,
    withErrorHandling("optimize inventory levels", async (req, res) => {
      const { partNumbers, usageHistory, costs, currentStock, options } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      if (!partNumbers || !usageHistory || !costs) {
        return sendBadRequest(res, "Missing required fields: partNumbers, usageHistory, costs");
      }

      const parts = await Promise.all(
        partNumbers.map((partNo: string) => storage.getPartByNumber(partNo, orgId))
      );
      const validParts = parts.filter((p) => p !== null);

      const usageHistoryArray = Object.entries(usageHistory).map(([partNo, monthlyUsage]) => ({
        partNo,
        monthlyUsage: monthlyUsage as number[],
      }));

      const currentStockByPart: Record<string, number> = currentStock ?? {};

      const firstPart = Object.keys(costs)[0];
      const costParams = {
        orderingCost: costs[firstPart]?.ordering || costs.orderingCost || 25,
        holdingCostRate: costs[firstPart]?.holding || costs.holdingCostRate || 0.1,
        stockoutCostRate: costs.stockoutCostRate || 0.5,
      };

      const { optimizeInventoryLevels } = await import("../../inventory");
      const optimizations = optimizeInventoryLevels(
        validParts,
        usageHistoryArray,
        costParams,
        currentStockByPart,
        options
      );

      res.json(optimizations);
    })
  );

  app.post("/api/inventory/optimize/auto", generalApiRateLimit,
    withErrorHandling("auto-optimize inventory", async (req, res) => {
      const { partNumbers, daysHistory } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      if (!partNumbers || !Array.isArray(partNumbers)) {
        return sendBadRequest(res, "Missing or invalid required field: partNumbers (must be an array)");
      }

      if (partNumbers.length > 100) {
        return sendBadRequest(res, "Too many parts requested. Maximum 100 parts per request.");
      }

      const days =
        daysHistory && typeof daysHistory === "number"
          ? Math.min(Math.max(30, daysHistory), 730)
          : 365;

      const { autoOptimizeInventory } = await import("../../inventory/auto-optimization");
      const results = await autoOptimizeInventory(orgId, partNumbers, days, storage);

      if (results.length === 0) {
        res.status(400).json({
          error: "Insufficient usage data for optimization",
          details: {
            message: "No parts have usage history in the specified period",
            requestedParts: partNumbers.length,
            daysAnalyzed: days,
          },
        });
        return;
      }

      res.json({
        success: true,
        optimizations: results,
        summary: {
          partsAnalyzed: results.length,
          daysHistory: days,
          timestamp: new Date().toISOString(),
        },
      });
    })
  );

  app.post("/api/inventory/suppliers/performance", generalApiRateLimit,
    withErrorHandling("analyze supplier performance", async (req, res) => {
      const { supplierIds, dateRange } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;

      const { analyzeSupplierPerformance } = await import("../../inventory/supplier-analytics");
      const performance = await analyzeSupplierPerformance(orgId, supplierIds, dateRange, storage);

      res.json(performance);
    })
  );

  logger.info("InventoryOptimizationRoutes", "Registered (cost-planning: 2, substitutions: 1, optimize: 2, suppliers: 1)");
}

```

### `server/domains/hub-sync/routes.ts` (289 lines)

```ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { hubSyncService } from "./service";
import { insertReplayIncomingSchema, insertSheetVersionSchema, insertOptimizerConfigurationSchema } from "@shared/schema-runtime";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { withErrorHandling, handleApiError, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

export function registerHubSyncRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimiters;

  // ===== REPLAY HELPER ENDPOINTS =====
  app.post("/api/replay", generalApiRateLimit,
    withErrorHandling("log replay request", async (req: Request, res: Response) => {
      const validatedData = insertReplayIncomingSchema.parse(req.body);
      const request = await hubSyncService.logReplayRequest(validatedData);
      res.status(201).json(request);
    })
  );

  app.get("/api/replay/history", generalApiRateLimit,
    withErrorHandling("get replay history", async (req: Request, res: Response) => {
      const replayHistoryQuerySchema = z.object({
        deviceId: z.string().optional(),
        endpoint: z.string().optional(),
      });

      const validatedQuery = replayHistoryQuerySchema.parse(req.query);
      const history = await hubSyncService.getReplayHistory(
        validatedQuery.deviceId,
        validatedQuery.endpoint
      );
      res.json(history);
    })
  );

  // ===== SHEET LOCKING ENDPOINTS =====
  app.post("/api/sheets/lock", generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const { sheetKey, holder, token, expiresAt } = req.body;

      if (!sheetKey || !holder || !token || !expiresAt) {
        return res.status(400).json({
          error: "Missing required fields: sheetKey, holder, token, expiresAt",
        });
      }

      const lock = await hubSyncService.acquireSheetLock(sheetKey, holder, token, new Date(expiresAt));
      res.status(201).json(lock);
    } catch (error) {
      if (error instanceof Error && error.message.includes("already locked")) {
        return res.status(409).json({ error: error.message });
      }
      handleApiError(res, error, "acquire sheet lock");
    }
  });

  app.delete("/api/sheets/lock", generalApiRateLimit,
    withErrorHandling("release sheet lock", async (req: Request, res: Response) => {
      const { sheetKey, token } = req.body;

      if (!sheetKey || !token) {
        res.status(400).json({
          error: "Missing required fields: sheetKey, token",
        });
        return;
      }

      await hubSyncService.releaseSheetLock(sheetKey, token);
      res.json({ ok: true, message: "Sheet lock released successfully" });
    })
  );

  app.get("/api/sheets/lock/:sheetKey", generalApiRateLimit,
    withErrorHandling("get sheet lock", async (req: Request, res: Response) => {
      const lock = await hubSyncService.getSheetLock(req.params.sheetKey);
      if (!lock) {
        return sendNotFound(res, "Sheet lock");
      }
      res.json(lock);
    })
  );

  app.get("/api/sheets/lock/:sheetKey/status", generalApiRateLimit,
    withErrorHandling("check sheet lock status", async (req: Request, res: Response) => {
      const isLocked = await hubSyncService.isSheetLocked(req.params.sheetKey);
      res.json({ sheetKey: req.params.sheetKey, isLocked });
    })
  );

  // ===== SHEET VERSIONING ENDPOINTS =====
  app.get("/api/sheets/version/:sheetKey", generalApiRateLimit,
    withErrorHandling("get sheet version", async (req: Request, res: Response) => {
      const version = await hubSyncService.getSheetVersion(req.params.sheetKey);
      if (!version) {
        return sendNotFound(res, "Sheet version");
      }
      res.json(version);
    })
  );

  app.post("/api/sheets/version/:sheetKey/increment", generalApiRateLimit,
    withErrorHandling("increment sheet version", async (req: Request, res: Response) => {
      const { modifiedBy } = req.body;

      if (!modifiedBy) {
        res.status(400).json({
          error: "Missing required field: modifiedBy",
        });
        return;
      }

      const version = await hubSyncService.incrementSheetVersion(req.params.sheetKey, modifiedBy);
      res.json(version);
    })
  );

  app.post("/api/sheets/version", generalApiRateLimit,
    withErrorHandling("set sheet version", async (req: Request, res: Response) => {
      const validatedData = insertSheetVersionSchema.parse(req.body);
      const version = await hubSyncService.setSheetVersion(validatedData);
      res.json(version);
    })
  );

  // ===== OPTIMIZATION TOOLS API =====
  app.get("/api/optimization/configurations", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch optimizer configurations", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || (req.query.orgId as string);
      const configs = await hubSyncService.getOptimizerConfigurations(orgId);
      res.json(configs);
    })
  );

  app.post("/api/optimization/configurations", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create optimizer configuration", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || req.body.orgId;
      const configData = {
        ...req.body,
        orgId,
        config: JSON.stringify(req.body.config ?? {}),
      };

      const validatedConfig = insertOptimizerConfigurationSchema.parse(configData);
      const config = await hubSyncService.createOptimizerConfiguration(validatedConfig);
      res.status(201).json(config);
    })
  );

  app.delete("/api/optimization/configurations/:id", writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await hubSyncService.deleteOptimizerConfiguration(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return sendNotFound(res, "Optimizer configuration");
      }
      handleApiError(res, error, "delete optimizer configuration");
    }
  });

  app.get("/api/optimization/results", requireOrgId, generalApiRateLimit,
    withErrorHandling("fetch optimization results", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || (req.query.orgId as string);
      const results = await hubSyncService.getOptimizationResults(orgId);
      res.json(results);
    })
  );

  app.post("/api/optimization/run", writeOperationRateLimit,
    withErrorHandling("start optimization run", async (req: Request, res: Response) => {
      const runOptimizationSchema = z.object({
        configId: z.string().uuid("Configuration ID must be a valid UUID"),
        equipmentScope: z.array(z.string()).optional(),
        timeHorizon: z.number().int().min(1).max(365).optional(),
      });

      const validatedData = runOptimizationSchema.parse(req.body);
      const { configId, equipmentScope, timeHorizon } = validatedData;

      const result = await hubSyncService.runOptimization(configId, equipmentScope, timeHorizon);
      res.json(result);
    })
  );

  app.delete("/api/optimization/cancel/:id", writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await hubSyncService.cancelOptimization(id);
      res.json({ message: "Optimization cancelled successfully", result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found")) {
        return res.status(404).json({ message });
      }
      if (message.includes("Cannot cancel")) {
        return res.status(400).json({ message });
      }
      handleApiError(res, error, "cancel optimization");
    }
  });

  app.post("/api/optimization/:id/apply", writeOperationRateLimit, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await hubSyncService.applyOptimizationToProduction(id);
      res.json({ message: "Optimization applied to production successfully", result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found")) {
        return res.status(404).json({ message });
      }
      if (message.includes("Cannot apply") || message.includes("already applied")) {
        return res.status(400).json({ message });
      }
      handleApiError(res, error, "apply optimization to production");
    }
  });

  app.get("/api/optimization/:id/download", generalApiRateLimit,
    withErrorHandling("download optimization result", async (req: Request, res: Response) => {
      const { id } = req.params;
      const result = await hubSyncService.getOptimizationResult(id);
      if (!result) {
        return sendNotFound(res, "Optimization result");
      }

      const filename = `optimization-${id}-${new Date().toISOString().split("T")[0]}.json`;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      res.json(result);
    })
  );

  app.delete("/api/optimization/results/:id", writeOperationRateLimit,
    withErrorHandling("delete optimization result", async (req: Request, res: Response) => {
      const { id } = req.params;
      await hubSyncService.deleteOptimizationResult(id);
      res.status(204).send();
    })
  );

  app.delete("/api/optimization/results", requireOrgId, writeOperationRateLimit,
    withErrorHandling("delete all optimization results", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || (req.query.orgId as string);
      const deletedCount = await hubSyncService.deleteAllOptimizationResults(orgId);
      res.json({
        message: "All optimization results deleted successfully",
        deletedCount,
      });
    })
  );

  // ===== SHIFT TEMPLATES =====
  app.get("/api/shift-templates", generalApiRateLimit,
    withErrorHandling("get shift templates", async (req: Request, res: Response) => {
      const { orgId } = req.query;
      const templates = await hubSyncService.getShiftTemplates(orgId as string);
      res.json(templates);
    })
  );

  app.post("/api/shift-templates", writeOperationRateLimit,
    withErrorHandling("create shift template", async (req: Request, res: Response) => {
      const template = await hubSyncService.createShiftTemplate(req.body);
      res.json(template);
    })
  );

  app.delete("/api/shift-templates/:id", writeOperationRateLimit,
    withErrorHandling("delete shift template", async (req: Request, res: Response) => {
      await hubSyncService.deleteShiftTemplate(req.params.id);
      res.json({
        ok: true,
        message: "Shift template deleted successfully",
      });
    })
  );

  logger.info("HubSyncRoutes", "Registered (replay: 2, sheets: 7, optimization: 10, templates: 3)");
}

```

---

## Records (Logbook, Compliance, Autofill Logs)

### `server/domains/logbook/routes/types.ts` (43 lines)

```ts
/**
 * Logbook Routes - Shared Types
 * 
 * Common types and interfaces for logbook route handlers.
 */

export interface RateLimiters {
  writeOperationRateLimit: any;
  criticalOperationRateLimit: any;
  generalApiRateLimit: any;
}

export interface DeckLogFilters {
  vesselId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface EngineLogFilters {
  vesselId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface EventFilters {
  eventType?: string;
  source?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface SignatureDetails {
  signedByCrewId: string;
  signedByName: string;
  signedByRank: string;
}

export interface LockDetails {
  lockedByUserId: string;
  lockedByUserName: string;
}

```

### `server/domains/logbook/routes/index.ts` (52 lines)

```ts
/**
 * Logbook Domain Routes - Aggregator
 * 
 * Re-exports all logbook route modules and provides the main registration function.
 * 
 * Module structure (1,150 lines → 8 modules):
 * - types.ts (~45 lines): Shared types
 * - deck-log-daily-routes.ts (~215 lines): Daily deck log CRUD
 * - deck-log-entries-routes.ts (~220 lines): Hourly, watches, events
 * - engine-log-daily-routes.ts (~235 lines): Daily engine log CRUD
 * - engine-log-entries-routes.ts (~280 lines): Hourly, generators, watches, events
 * - autofill-routes.ts (~165 lines): Auto-fill & anomaly detection
 * - index.ts (~50 lines): This aggregator
 */

import type { Express } from "express";
import type { RateLimiters } from "./types";
import { registerDeckLogDailyRoutes } from "./deck-log-daily-routes";
import { registerDeckLogEntriesRoutes } from "./deck-log-entries-routes";
import { registerEngineLogDailyRoutes } from "./engine-log-daily-routes";
import { registerEngineLogEntriesRoutes } from "./engine-log-entries-routes";
import { registerAutofillRoutes } from "./autofill-routes";
import { logger } from "../../../utils/logger.js";

export * from "./types";
export { registerDeckLogDailyRoutes } from "./deck-log-daily-routes";
export { registerDeckLogEntriesRoutes } from "./deck-log-entries-routes";
export { registerEngineLogDailyRoutes } from "./engine-log-daily-routes";
export { registerEngineLogEntriesRoutes } from "./engine-log-entries-routes";
export { registerAutofillRoutes } from "./autofill-routes";

/**
 * Register all logbook routes
 * 
 * This is the main entry point for logbook route registration.
 * It composes all sub-modules and provides backward compatibility.
 */
export function registerLogbookRoutes(
  app: Express,
  rateLimit: RateLimiters
) {
  const deckDailyCount = registerDeckLogDailyRoutes(app, rateLimit);
  const deckEntriesCount = registerDeckLogEntriesRoutes(app, rateLimit);
  const engineDailyCount = registerEngineLogDailyRoutes(app, rateLimit);
  const engineEntriesCount = registerEngineLogEntriesRoutes(app, rateLimit);
  const autofillCount = registerAutofillRoutes(app, rateLimit);

  const deckTotal = deckDailyCount + deckEntriesCount;
  const engineTotal = engineDailyCount + engineEntriesCount + autofillCount;

  logger.info("LogbookRoutes", `All logbook routes registered (deck: ${deckTotal}, engine: ${engineTotal})`);
}

```

### `server/domains/logbook/routes/deck-log-daily-routes.ts` (202 lines)

```ts
/**
 * Deck Log Daily Routes
 * 
 * Core CRUD operations for daily deck logs.
 */

import type { Express } from "express";
import { storage } from "../../../storage";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";
import type { RateLimiters, DeckLogFilters, SignatureDetails, LockDetails } from "./types";

export function registerDeckLogDailyRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit, criticalOperationRateLimit } = rateLimit;

  app.get("/api/logbook/deck/daily",
    withErrorHandling("get deck log daily entries", async (req, res) => {
      const orgId = req.orgId;
      const filters: DeckLogFilters = {
        vesselId: req.query.vesselId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
      };
      
      const entries = await storage.getDeckLogDaily(orgId, filters);
      res.json(entries);
    })
  );

  app.get("/api/logbook/deck/daily/:id",
    withErrorHandling("get deck log daily entry", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.getDeckLogDailyById(req.params.id, orgId);
      
      if (!entry) {
        return sendNotFound(res, "Deck log entry");
      }
      
      res.json(entry);
    })
  );

  app.get("/api/logbook/deck/daily/:id/complete",
    withErrorHandling("get complete deck log", async (req, res) => {
      const orgId = req.orgId;
      const complete = await storage.getDeckLogComplete(req.params.id, orgId);
      
      if (!complete) {
        return sendNotFound(res, "Deck log entry");
      }
      
      res.json(complete);
    })
  );

  app.get("/api/logbook/deck/vessel/:vesselId/date/:logDate",
    withErrorHandling("get deck log by date", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, logDate } = req.params;
      
      let entry = await storage.getDeckLogDailyByDate(vesselId, logDate, orgId);
      
      if (!entry) {
        entry = await storage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate,
          status: 'draft',
        });
      }
      
      const complete = await storage.getDeckLogComplete(entry.id, orgId);
      res.json(complete);
    })
  );

  app.post("/api/logbook/deck/daily", writeOperationRateLimit,
    withErrorHandling("create deck log daily", async (req, res) => {
      const orgId = req.orgId;
      
      const existing = await storage.getDeckLogDailyByDate(
        req.body.vesselId,
        req.body.logDate,
        orgId
      );
      
      if (existing) {
        return res.status(409).json({ 
          error: "Deck log already exists for this vessel and date",
          existingId: existing.id
        });
      }
      
      const entry = await storage.createDeckLogDaily({
        ...req.body,
        orgId,
      });
      
      sendCreated(res, entry);
    })
  );

  app.patch("/api/logbook/deck/daily/:id", writeOperationRateLimit,
    withErrorHandling("update deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.updateDeckLogDaily(req.params.id, req.body, orgId);
      res.json(entry);
    })
  );

  app.post("/api/logbook/deck/daily/:id/sign", writeOperationRateLimit,
    withErrorHandling("sign deck log", async (req, res) => {
      const orgId = req.orgId;
      const { signedByCrewId, signedByName, signedByRank }: SignatureDetails = req.body;
      
      if (!signedByCrewId || !signedByName || !signedByRank) {
        return res.status(400).json({ error: "Signature details required" });
      }
      
      const entry = await storage.signDeckLogDaily(
        req.params.id,
        { signedByCrewId, signedByName, signedByRank },
        orgId
      );
      
      res.json(entry);
    })
  );

  app.delete("/api/logbook/deck/daily/:id", criticalOperationRateLimit,
    withErrorHandling("delete deck log daily", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteDeckLogDaily(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.post("/api/logbook/deck/daily/:id/lock", writeOperationRateLimit,
    withErrorHandling("lock deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const { lockedByUserId, lockedByUserName }: LockDetails = req.body;
      
      if (!lockedByUserId || !lockedByUserName) {
        return res.status(400).json({ error: "lockedByUserId and lockedByUserName required" });
      }
      
      const locked = await storage.lockDeckLogDaily(req.params.id, {
        lockedByUserId,
        lockedByUserName,
      }, orgId);
      res.json(locked);
    })
  );

  app.post("/api/logbook/deck/daily/:id/unlock", writeOperationRateLimit,
    withErrorHandling("unlock deck log daily", async (req, res) => {
      const orgId = req.orgId;
      const unlocked = await storage.unlockDeckLogDaily(req.params.id, orgId);
      res.json(unlocked);
    })
  );

  app.get("/api/logbook/deck/days",
    withErrorHandling("get deck log days", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, from, to } = req.query;
      
      const entries = await storage.getDeckLogDaily(orgId, {
        vesselId: vesselId as string | undefined,
        startDate: from as string | undefined,
        endDate: to as string | undefined,
      });
      res.json(entries);
    })
  );

  app.post("/api/logbook/deck/days/ensure", writeOperationRateLimit,
    withErrorHandling("ensure deck log day", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, date } = req.body;
      
      if (!vesselId || !date) {
        return res.status(400).json({ error: "vesselId and date required" });
      }
      
      let entry = await storage.getDeckLogDailyByDate(vesselId, date, orgId);
      
      if (!entry) {
        entry = await storage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate: date,
          status: 'open',
        });
      }
      
      res.json(entry);
    })
  );

  return 12;
}

```

### `server/domains/logbook/routes/deck-log-entries-routes.ts` (181 lines)

```ts
/**
 * Deck Log Entries Routes
 * 
 * Hourly entries, watches, and events for deck logs.
 */

import type { Express } from "express";
import { storage } from "../../../storage";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";
import type { RateLimiters, EventFilters } from "./types";

export function registerDeckLogEntriesRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit } = rateLimit;

  app.get("/api/logbook/deck/daily/:dailyLogId/hourly",
    withErrorHandling("get deck log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = await storage.getDeckLogHourly(req.params.dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put("/api/logbook/deck/hourly", writeOperationRateLimit,
    withErrorHandling("save deck log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.upsertDeckLogHourly({
        ...req.body,
        orgId,
      });
      res.json(entry);
    })
  );

  app.put("/api/logbook/deck/hourly/bulk", writeOperationRateLimit,
    withErrorHandling("bulk save deck log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = req.body.entries as Array<any>;
      
      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }
      
      const withOrgId = entries.map(e => ({ ...e, orgId }));
      const results = await storage.bulkUpsertDeckLogHourly(withOrgId);
      res.json(results);
    })
  );

  app.delete("/api/logbook/deck/hourly/:id", writeOperationRateLimit,
    withErrorHandling("delete deck log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteDeckLogHourly(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/logbook/deck/daily/:dailyLogId/watches",
    withErrorHandling("get deck log watch assignments", async (req, res) => {
      const orgId = req.orgId;
      const watches = await storage.getDeckLogWatch(req.params.dailyLogId, orgId);
      res.json(watches);
    })
  );

  app.put("/api/logbook/deck/watch", writeOperationRateLimit,
    withErrorHandling("save deck log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      const watch = await storage.upsertDeckLogWatch({
        ...req.body,
        orgId,
      });
      res.json(watch);
    })
  );

  app.delete("/api/logbook/deck/watch/:id", writeOperationRateLimit,
    withErrorHandling("delete deck log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteDeckLogWatch(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/logbook/deck/daily/:dayId/events",
    withErrorHandling("get deck log events", async (req, res) => {
      const orgId = req.orgId;
      const { dayId } = req.params;
      const filters: EventFilters = {
        eventType: req.query.eventType as string | undefined,
        source: req.query.source as string | undefined,
        startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
        endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
      };
      
      const events = await storage.getDeckLogEvents(dayId, orgId, filters);
      res.json(events);
    })
  );

  app.get("/api/logbook/deck/events/:id",
    withErrorHandling("get deck log event", async (req, res) => {
      const orgId = req.orgId;
      const event = await storage.getDeckLogEventById(req.params.id, orgId);
      
      if (!event) {
        sendNotFound(res, "Event");
        return;
      }
      
      res.json(event);
    })
  );

  app.post("/api/logbook/deck/events", writeOperationRateLimit,
    withErrorHandling("create deck log event", async (req, res) => {
      const orgId = req.orgId;
      
      const day = await storage.getDeckLogDailyById(req.body.dayId, orgId);
      if (!day) {
        sendNotFound(res, "Deck log day");
        return;
      }

      if (day.status === 'locked') {
        res.status(403).json({ error: "Cannot add events to a locked deck log" });
        return;
      }
      
      const event = await storage.createDeckLogEvent({
        ...req.body,
        orgId,
      });
      sendCreated(res, event);
    })
  );

  app.patch("/api/logbook/deck/events/:id", writeOperationRateLimit,
    withErrorHandling("update deck log event", async (req, res) => {
      const orgId = req.orgId;
      
      const existingEvent = await storage.getDeckLogEventById(req.params.id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }
      
      const day = await storage.getDeckLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === 'locked') {
        res.status(403).json({ error: "Cannot modify events in a locked deck log" });
        return;
      }
      
      const event = await storage.updateDeckLogEvent(req.params.id, req.body, orgId);
      res.json(event);
    })
  );

  app.delete("/api/logbook/deck/events/:id", writeOperationRateLimit,
    withErrorHandling("delete deck log event", async (req, res) => {
      const orgId = req.orgId;
      
      const existingEvent = await storage.getDeckLogEventById(req.params.id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }
      
      const day = await storage.getDeckLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === 'locked') {
        res.status(403).json({ error: "Cannot delete events from a locked deck log" });
        return;
      }
      
      await storage.deleteDeckLogEvent(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  return 13;
}

```

### `server/domains/logbook/routes/engine-log-daily-routes.ts` (214 lines)

```ts
/**
 * Engine Log Daily Routes
 * 
 * Core CRUD operations for daily engine logs.
 */

import type { Express } from "express";
import { storage } from "../../../storage";
import type { RateLimiters, EngineLogFilters, SignatureDetails, LockDetails } from "./types";
import { validateUUID } from "../../../utils/validation";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";

export function registerEngineLogDailyRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit, criticalOperationRateLimit } = rateLimit;

  app.get("/api/logbook/engine/daily",
    withErrorHandling("get engine log daily entries", async (req, res) => {
      const orgId = req.orgId;
      const filters: EngineLogFilters = {
        vesselId: req.query.vesselId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        status: req.query.status as string | undefined,
      };
      
      const entries = await storage.getEngineLogDaily(orgId, filters);
      res.json(entries);
    })
  );

  app.get("/api/logbook/engine/daily/:id",
    withErrorHandling("get engine log daily entry", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const entry = await storage.getEngineLogDailyById(id, orgId);
      if (!entry) {
        return sendNotFound(res, "Engine log entry");
      }
      
      res.json(entry);
    })
  );

  app.get("/api/logbook/engine/daily/:id/complete",
    withErrorHandling("get complete engine log", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const complete = await storage.getEngineLogComplete(id, orgId);
      if (!complete) {
        return sendNotFound(res, "Engine log entry");
      }
      
      res.json(complete);
    })
  );

  app.get("/api/logbook/engine/vessel/:vesselId/date/:logDate",
    withErrorHandling("get engine log by date", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, logDate } = req.params;
      
      let entry = await storage.getEngineLogDailyByDate(vesselId, logDate, orgId);
      
      if (!entry) {
        entry = await storage.createEngineLogDaily({
          orgId,
          vesselId,
          logDate,
          status: 'open',
        });
      }
      
      const complete = await storage.getEngineLogComplete(entry.id, orgId);
      res.json(complete);
    })
  );

  app.post("/api/logbook/engine/daily", writeOperationRateLimit,
    withErrorHandling("create engine log daily", async (req, res) => {
      const orgId = req.orgId;
      
      const existing = await storage.getEngineLogDailyByDate(
        req.body.vesselId,
        req.body.logDate,
        orgId
      );
      
      if (existing) {
        return res.status(409).json({ 
          error: "Engine log already exists for this vessel and date",
          existingId: existing.id
        });
      }
      
      const entry = await storage.createEngineLogDaily({
        ...req.body,
        orgId,
      });
      
      sendCreated(res, entry);
    })
  );

  app.patch("/api/logbook/engine/daily/:id", writeOperationRateLimit,
    withErrorHandling("update engine log daily", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const entry = await storage.updateEngineLogDaily(id, req.body, orgId);
      res.json(entry);
    })
  );

  app.post("/api/logbook/engine/daily/:id/sign", writeOperationRateLimit,
    withErrorHandling("sign engine log", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const { signedByCrewId, signedByName, signedByRank }: SignatureDetails = req.body;
      if (!signedByCrewId || !signedByName || !signedByRank) {
        return res.status(400).json({ error: "Signature details required" });
      }
      
      const entry = await storage.signEngineLogDaily(id, { signedByCrewId, signedByName, signedByRank }, orgId);
      res.json(entry);
    })
  );

  app.delete("/api/logbook/engine/daily/:id", criticalOperationRateLimit,
    withErrorHandling("delete engine log daily", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteEngineLogDaily(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.post("/api/logbook/engine/daily/:id/lock", writeOperationRateLimit,
    withErrorHandling("lock engine log", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const { lockedByUserId, lockedByUserName }: LockDetails = req.body;
      if (!lockedByUserId || !lockedByUserName) {
        return res.status(400).json({ error: "lockedByUserId and lockedByUserName required" });
      }
      
      try {
        const locked = await storage.lockEngineLogDaily(id, { lockedByUserId, lockedByUserName }, orgId);
        res.json(locked);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('already locked')) {
          return res.status(409).json({ error: message });
        }
        throw error;
      }
    })
  );

  app.post("/api/logbook/engine/daily/:id/unlock", writeOperationRateLimit,
    withErrorHandling("unlock engine log", async (req, res) => {
      const orgId = req.orgId;
      const unlocked = await storage.unlockEngineLogDaily(req.params.id, orgId);
      res.json(unlocked);
    })
  );

  app.get("/api/logbook/engine/days",
    withErrorHandling("get engine log days", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, from, to } = req.query;
      
      const entries = await storage.getEngineLogDaily(orgId, {
        vesselId: vesselId as string | undefined,
        startDate: from as string | undefined,
        endDate: to as string | undefined,
      });
      res.json(entries);
    })
  );

  app.post("/api/logbook/engine/days/ensure", writeOperationRateLimit,
    withErrorHandling("ensure engine log day", async (req, res) => {
      const orgId = req.orgId;
      const { vesselId, date } = req.body;
      
      if (!vesselId || !date) {
        return res.status(400).json({ error: "vesselId and date required" });
      }
      
      let entry = await storage.getEngineLogDailyByDate(vesselId, date, orgId);
      
      if (!entry) {
        entry = await storage.createEngineLogDaily({
          orgId,
          vesselId,
          logDate: date,
          status: 'open',
        });
      }
      
      res.json(entry);
    })
  );

  return 13;
}

```

### `server/domains/logbook/routes/engine-log-entries-routes.ts` (227 lines)

```ts
/**
 * Engine Log Entries Routes
 * 
 * Hourly entries, generators, watches, and events for engine logs.
 */

import type { Express } from "express";
import { storage } from "../../../storage";
import type { RateLimiters, EventFilters } from "./types";
import { validateUUID } from "../../../utils/validation";
import { withErrorHandling, sendNotFound, sendDeleted, sendCreated } from "../../../lib/route-utils";

export function registerEngineLogEntriesRoutes(app: Express, rateLimit: RateLimiters): number {
  const { writeOperationRateLimit } = rateLimit;

  app.get("/api/logbook/engine/daily/:dailyLogId/hourly",
    withErrorHandling("get engine log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = await storage.getEngineLogHourly(req.params.dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put("/api/logbook/engine/hourly", writeOperationRateLimit,
    withErrorHandling("save engine log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.upsertEngineLogHourly({
        ...req.body,
        orgId,
      });
      res.json(entry);
    })
  );

  app.put("/api/logbook/engine/hourly/bulk", writeOperationRateLimit,
    withErrorHandling("save engine log hourly entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = req.body.entries as Array<any>;
      
      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }
      
      const withOrgId = entries.map(e => ({ ...e, orgId }));
      const results = await storage.bulkUpsertEngineLogHourly(withOrgId);
      res.json(results);
    })
  );

  app.delete("/api/logbook/engine/hourly/:id", writeOperationRateLimit,
    withErrorHandling("delete engine log hourly entry", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteEngineLogHourly(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/logbook/engine/daily/:dailyLogId/generators",
    withErrorHandling("get engine log generator entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = await storage.getEngineLogGenerator(req.params.dailyLogId, orgId);
      res.json(entries);
    })
  );

  app.put("/api/logbook/engine/generator", writeOperationRateLimit,
    withErrorHandling("save engine log generator entry", async (req, res) => {
      const orgId = req.orgId;
      const entry = await storage.upsertEngineLogGenerator({
        ...req.body,
        orgId,
      });
      res.json(entry);
    })
  );

  app.put("/api/logbook/engine/generator/bulk", writeOperationRateLimit,
    withErrorHandling("save engine log generator entries", async (req, res) => {
      const orgId = req.orgId;
      const entries = req.body.entries as Array<any>;
      
      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: "entries array required" });
        return;
      }
      
      const withOrgId = entries.map(e => ({ ...e, orgId }));
      const results = await storage.bulkUpsertEngineLogGenerator(withOrgId);
      res.json(results);
    })
  );

  app.delete("/api/logbook/engine/generator/:id", writeOperationRateLimit,
    withErrorHandling("delete engine log generator entry", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteEngineLogGenerator(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/logbook/engine/daily/:dailyLogId/watches",
    withErrorHandling("get engine log watches", async (req, res) => {
      const orgId = req.orgId;
      const watches = await storage.getEngineLogWatch(req.params.dailyLogId, orgId);
      res.json(watches);
    })
  );

  app.put("/api/logbook/engine/watch", writeOperationRateLimit,
    withErrorHandling("save engine log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      const watch = await storage.upsertEngineLogWatch({
        ...req.body,
        orgId,
      });
      res.json(watch);
    })
  );

  app.delete("/api/logbook/engine/watch/:id", writeOperationRateLimit,
    withErrorHandling("delete engine log watch assignment", async (req, res) => {
      const orgId = req.orgId;
      await storage.deleteEngineLogWatch(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  app.get("/api/logbook/engine/daily/:dayId/events",
    withErrorHandling("get engine log events", async (req, res) => {
      const orgId = req.orgId;
      const { dayId } = req.params;
      const filters: EventFilters = {
        eventType: req.query.eventType as string | undefined,
        source: req.query.source as string | undefined,
        startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
        endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
      };
      
      const events = await storage.getEngineLogEvents(dayId, orgId, filters);
      res.json(events);
    })
  );

  app.get("/api/logbook/engine/events/:id",
    withErrorHandling("get engine log event", async (req, res) => {
      const orgId = req.orgId;
      const event = await storage.getEngineLogEventById(req.params.id, orgId);
      
      if (!event) {
        sendNotFound(res, "Event");
        return;
      }
      
      res.json(event);
    })
  );

  app.post("/api/logbook/engine/events", writeOperationRateLimit,
    withErrorHandling("create engine log event", async (req, res) => {
      const orgId = req.orgId;
      
      const day = await storage.getEngineLogDailyById(req.body.dayId, orgId);
      if (!day) {
        sendNotFound(res, "Engine log day");
        return;
      }

      if (day.status === 'locked') {
        res.status(403).json({ error: "Cannot add events to a locked engine log" });
        return;
      }
      
      const event = await storage.createEngineLogEvent({
        ...req.body,
        orgId,
      });
      sendCreated(res, event);
    })
  );

  app.patch("/api/logbook/engine/events/:id", writeOperationRateLimit,
    withErrorHandling("update engine log event", async (req, res) => {
      const orgId = req.orgId;
      const id = req.params.id;
      if (!validateUUID(id, res)) {return;}
      
      const existingEvent = await storage.getEngineLogEventById(id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }
      
      const day = await storage.getEngineLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === 'locked') {
        res.status(403).json({ error: "Cannot modify events in a locked engine log" });
        return;
      }
      
      const event = await storage.updateEngineLogEvent(id, req.body, orgId);
      res.json(event);
    })
  );

  app.delete("/api/logbook/engine/events/:id", writeOperationRateLimit,
    withErrorHandling("delete engine log event", async (req, res) => {
      const orgId = req.orgId;
      
      const existingEvent = await storage.getEngineLogEventById(req.params.id, orgId);
      if (!existingEvent) {
        sendNotFound(res, "Event");
        return;
      }
      
      const day = await storage.getEngineLogDailyById(existingEvent.dayId, orgId);
      if (day?.status === 'locked') {
        res.status(403).json({ error: "Cannot delete events from a locked engine log" });
        return;
      }
      
      await storage.deleteEngineLogEvent(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  return 17;
}

```

### `server/domains/logbook/routes/autofill-routes.ts` (156 lines)

```ts
/**
 * Engine Log Auto-fill & Anomaly Detection Routes
 * 
 * Handles telemetry-based auto-fill and anomaly detection:
 * - Auto-fill hourly entries from telemetry
 * - Anomaly summary and thresholds
 * - Unsigned log notifications
 */

import type { Express } from "express";
import { z } from "zod";
import type { RateLimiters } from "./types";
import { withErrorHandling } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";

const autoFillRequestSchema = z.object({
  vesselId: z.string().uuid("Invalid vessel ID format"),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD required)"),
  hours: z.array(z.number().int().min(0).max(23)).optional(),
  overwriteManual: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
});

const notifyRequestSchema = z.object({
  vesselId: z.string().uuid().optional(),
  daysBack: z.number().int().min(1).max(90).optional().default(7),
});

export function registerAutofillRoutes(app: Express, rateLimit: RateLimiters) {
  const { writeOperationRateLimit } = rateLimit;

  app.post("/api/logbook/engine/autofill", writeOperationRateLimit,
    withErrorHandling("auto-fill engine log from telemetry", async (req, res) => {
      const orgId = req.orgId;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      
      const parseResult = autoFillRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.flatten().fieldErrors 
        });
      }
      
      const { vesselId, logDate, hours, overwriteManual, dryRun } = parseResult.data;

      const { autoFillFromTelemetry, autoFillGeneratorsFromTelemetry } = await import("../../../services/engine-log-autofill-service");
      
      const [mainEngineResult, generatorResult] = await Promise.all([
        autoFillFromTelemetry(vesselId, orgId, logDate, { hours, overwriteManual, dryRun }),
        autoFillGeneratorsFromTelemetry(vesselId, orgId, logDate, { hours, overwriteManual, dryRun }),
      ]);

      res.json({
        success: true,
        mainEngine: mainEngineResult,
        generators: generatorResult,
      });
    })
  );

  app.get("/api/logbook/engine/daily/:id/anomalies",
    withErrorHandling("get anomaly summary", async (req, res) => {
      const orgId = req.orgId;
      const { getAnomalySummary } = await import("../../../services/engine-log-autofill-service");
      
      const summary = await getAnomalySummary(req.params.id, orgId);
      res.json(summary);
    })
  );

  app.get("/api/logbook/engine/thresholds",
    withErrorHandling("get anomaly thresholds", async (req, res) => {
      const { ENGINE_ANOMALY_THRESHOLDS, GENERATOR_ANOMALY_THRESHOLDS } = await import("../../../services/engine-log-autofill-service");
      res.json({
        engine: ENGINE_ANOMALY_THRESHOLDS,
        generator: GENERATOR_ANOMALY_THRESHOLDS,
      });
    })
  );

  app.get("/api/logbook/engine/unsigned",
    withErrorHandling("get unsigned logs", async (req, res) => {
      const orgId = req.orgId;
      const vesselId = req.query.vesselId as string | undefined;
      const daysBack = req.query.daysBack ? Number.parseInt(req.query.daysBack as string) : 7;

      const { getUnsignedLogs } = await import("../../../services/engine-log-autofill-service");
      const unsignedLogs = await getUnsignedLogs(orgId, { vesselId, daysBack });

      res.json(unsignedLogs);
    })
  );

  app.post("/api/logbook/engine/notify-unsigned", writeOperationRateLimit,
    withErrorHandling("send unsigned log notifications", async (req, res) => {
      const orgId = req.orgId;
      if (!orgId) {
        return res.status(401).json({ error: "Organization ID required" });
      }
      
      const parseResult = notifyRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.flatten().fieldErrors 
        });
      }
      
      const { vesselId, daysBack: parsedDaysBack } = parseResult.data;
      const daysBack = parsedDaysBack ?? 7;

      const { getUnsignedLogs } = await import("../../../services/engine-log-autofill-service");
      const { emailNotificationService } = await import("../../../services/email-notification-service");

      const unsignedLogs = await getUnsignedLogs(orgId, { vesselId, daysBack });

      if (unsignedLogs.length === 0) {
        return res.json({ message: "No unsigned logs found", sent: 0 });
      }

      let sentCount = 0;
      const errors: string[] = [];

      for (const log of unsignedLogs) {
        try {
          await emailNotificationService.sendLogbookReminderNotification(
            "engine",
            log.vesselId,
            log.vesselName,
            log.logDate,
            orgId
          );
          sentCount++;
        } catch (err) {
          logger.error("Logbook", `Failed to send notification for ${log.vesselName}`, err);
          errors.push(`${log.vesselName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      logger.info("Logbook", `Sent ${sentCount}/${unsignedLogs.length} notifications for org ${orgId}`);

      res.json({ 
        message: `Sent ${sentCount} of ${unsignedLogs.length} notifications`,
        logs: unsignedLogs,
        sent: sentCount,
        total: unsignedLogs.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    })
  );

  return 5;
}

```

### `server/domains/compliance/routes.ts` (307 lines)

```ts
import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface RateLimiters {
  writeOperationRateLimit: any;
  criticalOperationRateLimit: any;
  generalApiRateLimit: any;
}

export function registerComplianceRoutes(app: Express, rateLimiters?: RateLimiters): void {
  const writeOperationRateLimit = rateLimiters?.writeOperationRateLimit || ((req: any, res: any, next: any) => next());
  const criticalOperationRateLimit = rateLimiters?.criticalOperationRateLimit || ((req: any, res: any, next: any) => next());

  // ===== COMPLIANCE RULES ENGINE ROUTES =====

  app.get("/api/compliance/findings",
    withErrorHandling("get compliance findings", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const filters = {
        vesselId: req.query.vesselId as string | undefined,
        sourceType: req.query.sourceType as string | undefined,
        severity: req.query.severity as string | undefined,
        status: req.query.status as string | undefined,
        ruleCode: req.query.ruleCode as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      
      const findings = await storage.getComplianceFindings(orgId, filters);
      res.json(findings);
    })
  );

  app.get("/api/compliance/findings/:id",
    withErrorHandling("get compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const finding = await storage.getComplianceFindingById(req.params.id, orgId);
      
      if (!finding) {
        return sendNotFound(res, "Compliance finding");
      }
      
      res.json(finding);
    })
  );

  app.post("/api/compliance/findings", writeOperationRateLimit,
    withErrorHandling("create compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const finding = await storage.createComplianceFinding({
        ...req.body,
        orgId,
      });
      res.status(201).json(finding);
    })
  );

  app.post("/api/compliance/findings/:id/acknowledge", writeOperationRateLimit,
    withErrorHandling("acknowledge compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { acknowledgedByUserId, acknowledgedByUserName } = req.body;
      
      if (!acknowledgedByUserId || !acknowledgedByUserName) {
        return res.status(400).json({ error: "User details required for acknowledgment" });
      }
      
      const finding = await storage.acknowledgeComplianceFinding(
        req.params.id,
        { acknowledgedByUserId, acknowledgedByUserName },
        orgId
      );
      res.json(finding);
    })
  );

  app.post("/api/compliance/findings/:id/resolve", writeOperationRateLimit,
    withErrorHandling("resolve compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { resolvedByUserId, resolvedByUserName, resolutionNotes } = req.body;
      
      if (!resolvedByUserId || !resolvedByUserName) {
        return res.status(400).json({ error: "User details required for resolution" });
      }
      
      const finding = await storage.resolveComplianceFinding(
        req.params.id,
        { resolvedByUserId, resolvedByUserName, resolutionNotes },
        orgId
      );
      res.json(finding);
    })
  );

  app.post("/api/compliance/findings/:id/suppress", writeOperationRateLimit,
    withErrorHandling("suppress compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { suppressedUntil, suppressedReason } = req.body;
      
      if (!suppressedUntil || !suppressedReason) {
        return res.status(400).json({ error: "Suppression details required" });
      }
      
      const finding = await storage.suppressComplianceFinding(
        req.params.id,
        { suppressedUntil: new Date(suppressedUntil), suppressedReason },
        orgId
      );
      res.json(finding);
    })
  );

  app.delete("/api/compliance/findings/:id", criticalOperationRateLimit,
    withErrorHandling("delete compliance finding", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      await storage.deleteComplianceFinding(req.params.id, orgId);
      res.status(204).send();
    })
  );

  app.get("/api/compliance/rules",
    withErrorHandling("get compliance rules", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const filters = {
        sourceType: req.query.sourceType as string | undefined,
        category: req.query.category as string | undefined,
        enabled: req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined,
      };
      
      const rules = await storage.getComplianceRules(orgId, filters);
      res.json(rules);
    })
  );

  app.get("/api/compliance/rules/:id",
    withErrorHandling("get compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const rule = await storage.getComplianceRuleById(req.params.id, orgId);
      
      if (!rule) {
        return sendNotFound(res, "Compliance rule");
      }
      
      res.json(rule);
    })
  );

  app.post("/api/compliance/rules", writeOperationRateLimit,
    withErrorHandling("create compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const rule = await storage.createComplianceRule({
        ...req.body,
        orgId,
      });
      res.status(201).json(rule);
    })
  );

  app.patch("/api/compliance/rules/:id", writeOperationRateLimit,
    withErrorHandling("update compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const rule = await storage.updateComplianceRule(req.params.id, req.body, orgId);
      res.json(rule);
    })
  );

  app.delete("/api/compliance/rules/:id", criticalOperationRateLimit,
    withErrorHandling("delete compliance rule", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      await storage.deleteComplianceRule(req.params.id, orgId);
      res.status(204).send();
    })
  );

  app.post("/api/compliance/check", writeOperationRateLimit,
    withErrorHandling("run compliance check", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, logDate, logType } = req.body;

      if (!vesselId || !logDate || !logType) {
        return res.status(400).json({ error: "vesselId, logDate, and logType are required" });
      }

      if (!["deck", "engine"].includes(logType)) {
        return res.status(400).json({ error: "logType must be 'deck' or 'engine'" });
      }

      const { complianceRulesEngine } = await import("../../services/compliance-rules-engine");
      
      const result = await complianceRulesEngine.runComplianceCheck({
        orgId,
        vesselId,
        logDate,
        logType,
      });

      res.json({
        checked: true,
        vesselId,
        logDate,
        logType,
        newFindingsCount: result.newFindings.length,
        autoResolvedCount: result.autoResolved.length,
        stillOpenCount: result.stillOpen.length,
        newFindings: result.newFindings,
        autoResolved: result.autoResolved,
        stillOpen: result.stillOpen,
      });
    })
  );

  app.post("/api/compliance/rules/seed", writeOperationRateLimit,
    withErrorHandling("seed compliance rules", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { complianceRulesEngine } = await import("../../services/compliance-rules-engine");
      
      await complianceRulesEngine.seedDefaultRules(orgId);
      res.json({ success: true, message: "Default compliance rules seeded" });
    })
  );

  app.get("/api/compliance/summary/:vesselId",
    withErrorHandling("get compliance summary", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = req.params;

      const findings = await storage.getComplianceFindings(orgId, {
        vesselId,
        status: "open",
      });

      const summary = {
        vesselId,
        totalOpenFindings: findings.length,
        bySeverity: {
          critical: findings.filter((f) => f.severity === "critical").length,
          warning: findings.filter((f) => f.severity === "warning").length,
          info: findings.filter((f) => f.severity === "info").length,
        },
        bySource: {
          logbook_deck: findings.filter((f) => f.sourceType === "logbook_deck").length,
          logbook_engine: findings.filter((f) => f.sourceType === "logbook_engine").length,
          crew: findings.filter((f) => f.sourceType === "crew").length,
          maintenance: findings.filter((f) => f.sourceType === "maintenance").length,
          telemetry: findings.filter((f) => f.sourceType === "telemetry").length,
        },
        byCategory: {
          operational: findings.filter((f) => f.category === "operational").length,
          safety: findings.filter((f) => f.category === "safety").length,
          data_integrity: findings.filter((f) => f.category === "data_integrity").length,
          regulatory: findings.filter((f) => f.category === "regulatory").length,
        },
        recentFindings: findings.slice(0, 10),
      };

      res.json(summary);
    })
  );

  // ===== STCW COMPLIANCE DASHBOARD ROUTES =====

  app.get("/api/dashboard/stcw-summary",
    withErrorHandling("fetch fleet STCW summary", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { days = "30" } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getFleetSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getFleetSTCWSummary(orgId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get("/api/dashboard/stcw-summary/vessel/:vesselId",
    withErrorHandling("fetch vessel STCW summary", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { vesselId } = req.params;
      const { days = "30" } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getVesselSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getVesselSTCWSummary(orgId, vesselId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get("/api/dashboard/stcw-trends",
    withErrorHandling("fetch STCW trends", async (req: Request, res: Response) => {
      const orgId = req.orgId!;
      const { days = "30", vesselId } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getSTCWComplianceTrends } = await import("../../scheduler/stcw-dashboard");
      const trends = await getSTCWComplianceTrends(orgId, lookbackDays, vesselId as string | undefined);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(trends);
    })
  );

  logger.info("ComplianceRoutes", "Registered (findings: 7, rules: 6, dashboard: 3)");
}

```

### `server/domains/autofill-logs/routes.ts` (371 lines)

```ts
/**
 * Auto-Filled Logs Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 * 
 * Routes for fuel emissions, vessel track, and condition monitoring logs
 * These logs are auto-filled from telemetry data
 */

import { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface AutofillLogsDependencies {
  writeOperationRateLimit: RequestHandler;
}

export function registerAutofillLogsRoutes(
  app: Express,
  deps: AutofillLogsDependencies
): void {
  const { writeOperationRateLimit } = deps;

  // ==================================================================================
  // FUEL & EMISSIONS LOG ROUTES
  // ==================================================================================

  app.get("/api/logbook/fuel-emissions",
    withErrorHandling("get fuel emissions logs", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, startDate, endDate, periodType } = req.query;
      
      const { fuelEmissionsLog } = await import("@shared/schema");
      const { eq, and, gte, lte, sql } = await import("drizzle-orm");
      const { db } = await import("../../db");
      
      const conditions = [eq(fuelEmissionsLog.orgId, orgId)];
      if (vesselId) {
        conditions.push(eq(fuelEmissionsLog.vesselId, vesselId as string));
      }

      if (startDate) {
        conditions.push(gte(fuelEmissionsLog.periodStart, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(fuelEmissionsLog.periodEnd, new Date(endDate as string)));
      }

      if (periodType) {
        conditions.push(eq(fuelEmissionsLog.periodType, periodType as string));
      }
      
      const logs = await db
        .select()
        .from(fuelEmissionsLog)
        .where(and(...conditions))
        .orderBy(sql`${fuelEmissionsLog.periodStart} DESC`)
        .limit(1000);
      
      res.json(logs);
    })
  );

  app.get("/api/logbook/fuel-emissions/summary",
    withErrorHandling("get fuel emissions summary", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, startDate, endDate } = req.query;
      
      if (!vesselId || !startDate || !endDate) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }
      
      const { fuelEmissionsAutoFillService } = await import("../../services/fuel-emissions-autofill-service");
      const summary = await fuelEmissionsAutoFillService.getFuelEmissionsSummary(
        orgId,
        vesselId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json(summary);
    })
  );

  app.post("/api/logbook/fuel-emissions/autofill", writeOperationRateLimit,
    withErrorHandling("auto-fill fuel emissions", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const autoFillSchema = z.object({
        vesselId: z.string().uuid(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        periodType: z.enum(['hourly', 'daily']).optional().default('hourly'),
      });
      
      const parseResult = autoFillSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
        return;
      }
      
      const { vesselId, startDate, endDate, periodType } = parseResult.data;
      
      const { fuelEmissionsAutoFillService } = await import("../../services/fuel-emissions-autofill-service");
      const result = await fuelEmissionsAutoFillService.autoFillFuelEmissions(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate),
        periodType
      );
      
      res.json(result);
    })
  );

  // ==================================================================================
  // VESSEL TRACK LOG ROUTES
  // ==================================================================================

  app.get("/api/logbook/track",
    withErrorHandling("get vessel track", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, startDate, endDate, limit } = req.query;
      
      if (!vesselId || !startDate || !endDate) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }
      
      const { trackLogService } = await import("../../services/track-log-service");
      const tracks = await trackLogService.getTrackHistory(
        orgId,
        vesselId as string,
        new Date(startDate as string),
        new Date(endDate as string),
        limit ? Number.parseInt(limit as string) : undefined
      );
      
      res.json(tracks);
    })
  );

  app.get("/api/logbook/track/stats",
    withErrorHandling("get track stats", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, startDate, endDate } = req.query;
      
      if (!vesselId || !startDate || !endDate) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }
      
      const { trackLogService } = await import("../../services/track-log-service");
      const stats = await trackLogService.getTrackStats(
        orgId,
        vesselId as string,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json(stats);
    })
  );

  app.get("/api/logbook/track/last-position",
    withErrorHandling("get last position", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = req.query;
      
      if (!vesselId) {
        res.status(400).json({ error: "vesselId is required" });
        return;
      }
      
      const { trackLogService } = await import("../../services/track-log-service");
      const position = await trackLogService.getLastPosition(orgId, vesselId as string);
      
      if (!position) {
        sendNotFound(res, "Position");
        return;
      }
      
      res.json(position);
    })
  );

  app.get("/api/logbook/track/export/gpx",
    withErrorHandling("export track as GPX", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, vesselName, startDate, endDate } = req.query;
      
      if (!vesselId || !startDate || !endDate) {
        res.status(400).json({ error: "vesselId, startDate, and endDate are required" });
        return;
      }
      
      const { trackLogService } = await import("../../services/track-log-service");
      const gpx = await trackLogService.exportToGPX(
        orgId,
        vesselId as string,
        (vesselName as string) || 'Vessel',
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.setHeader('Content-Type', 'application/gpx+xml');
      res.setHeader('Content-Disposition', `attachment; filename="track-${vesselId}-${startDate}.gpx"`);
      res.send(gpx);
    })
  );

  app.post("/api/logbook/track/process-telemetry", writeOperationRateLimit,
    withErrorHandling("process GPS telemetry", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const processSchema = z.object({
        vesselId: z.string().uuid(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      });
      
      const parseResult = processSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
        return;
      }
      
      const { vesselId, startDate, endDate } = parseResult.data;
      
      const { trackLogService } = await import("../../services/track-log-service");
      const result = await trackLogService.processGpsTelemetry(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate)
      );
      
      res.json(result);
    })
  );

  // ==================================================================================
  // CONDITION MONITORING LOG ROUTES
  // ==================================================================================

  app.get("/api/logbook/condition",
    withErrorHandling("get condition logs", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId, equipmentId, startDate, endDate, periodType, limit } = req.query;
      
      const { conditionLogSummary } = await import("@shared/schema");
      const { eq, and, gte, lte, sql } = await import("drizzle-orm");
      const { db } = await import("../../db");
      
      const conditions = [eq(conditionLogSummary.orgId, orgId)];
      if (vesselId) {
        conditions.push(eq(conditionLogSummary.vesselId, vesselId as string));
      }

      if (equipmentId) {
        conditions.push(eq(conditionLogSummary.equipmentId, equipmentId as string));
      }

      if (startDate) {
        conditions.push(gte(conditionLogSummary.periodStart, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(conditionLogSummary.periodEnd, new Date(endDate as string)));
      }

      if (periodType) {
        conditions.push(eq(conditionLogSummary.periodType, periodType as string));
      }
      
      let query = db
        .select()
        .from(conditionLogSummary)
        .where(and(...conditions))
        .orderBy(sql`${conditionLogSummary.periodStart} DESC`);
      
      if (limit) {
        query = query.limit(Number.parseInt(limit as string)) as typeof query;
      }
      
      const logs = await query;
      res.json(logs);
    })
  );

  app.get("/api/logbook/condition/equipment/:equipmentId",
    withErrorHandling("get condition log history", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { equipmentId } = req.params;
      const { startDate, endDate, limit } = req.query;
      
      if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
      }
      
      const { conditionLogService } = await import("../../services/condition-log-service");
      const history = await conditionLogService.getConditionLogHistory(
        orgId,
        equipmentId,
        new Date(startDate as string),
        new Date(endDate as string),
        limit ? Number.parseInt(limit as string) : undefined
      );
      
      res.json(history);
    })
  );

  app.get("/api/logbook/condition/vessel/:vesselId/summary",
    withErrorHandling("get vessel condition summary", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const { vesselId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        res.status(400).json({ error: "startDate and endDate are required" });
        return;
      }
      
      const { conditionLogService } = await import("../../services/condition-log-service");
      const summary = await conditionLogService.getVesselConditionSummary(
        orgId,
        vesselId,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json(summary);
    })
  );

  app.post("/api/logbook/condition/autofill", writeOperationRateLimit,
    withErrorHandling("auto-fill condition logs", async (req: Request, res: Response) => {
      const orgId = req.orgId;
      const autoFillSchema = z.object({
        vesselId: z.string().uuid(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        periodType: z.enum(['hourly', 'daily']).optional().default('hourly'),
      });
      
      const parseResult = autoFillSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
        return;
      }
      
      const { vesselId, startDate, endDate, periodType } = parseResult.data;
      
      const { conditionLogService } = await import("../../services/condition-log-service");
      const result = await conditionLogService.autoFillConditionLogs(
        orgId,
        vesselId,
        new Date(startDate),
        new Date(endDate),
        periodType
      );
      
      res.json(result);
    })
  );

  logger.info("AutofillLogsRoutes", "Registered (fuel: 3, track: 5, condition: 4)");
}

```

---

## Analytics (Analytics, ML Analytics, ML Pipeline, PdM Platform, Insights, LLM, RAG, Knowledge Base)

### `server/routes/analytics.ts` (7 lines)

```ts
/**
 * Analytics Routes with Redis Caching & DTO Validation
 * DEPRECATED: Use imports from './analytics/index.js' directly
 * This file re-exports for backward compatibility
 */

export { mountAnalyticsRoutes, getOrgId, sendValidatedResponse, handleError, toFailurePredictionUuid } from "./analytics/index.js";

```

### `server/routes/analytics/index.ts` (26 lines)

```ts
/**
 * Analytics Routes - Modularized Entry Point
 */
import { Router, type Express } from "express";
import { cacheConfig } from "../../lib/cache";
import { mountHealthMetricsRoutes } from "./health-metrics.js";
import { mountPredictionsRoutes } from "./predictions.js";
import { mountModelGovernanceRoutes } from "./model-governance.js";
import { mountCostsAndFeedbackRoutes } from "./costs-and-feedback.js";
import { mountCacheReconciliationRoutes } from "./cache-reconciliation.js";

export function mountAnalyticsRoutes(app: Express) {
  const router = Router();
  mountHealthMetricsRoutes(router);
  mountPredictionsRoutes(router);
  mountModelGovernanceRoutes(router);
  mountCostsAndFeedbackRoutes(router);
  mountCacheReconciliationRoutes(router);
  app.use("/api/analytics", router);
  console.log("[Analytics Routes] Mounted with Redis caching support");
  console.log("[Analytics Routes] Data reconciliation endpoints registered");
  if (cacheConfig.analyticsEnabled) { console.log("[Analytics Routes] Redis caching ENABLED (5min default TTL)"); }
  else { console.log("[Analytics Routes] Redis caching DISABLED (direct queries)"); }
}

export { getOrgId, sendValidatedResponse, handleError, toFailurePredictionUuid } from "./helpers.js";

```

### `server/routes/analytics/helpers.ts` (42 lines)

```ts
/**
 * Analytics Routes - Shared Helpers
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";

const FAILURE_PREDICTION_NAMESPACE = "f8e7d6c5-b4a3-4a2b-8c1d-0e9f8a7b6c5d";

export function toFailurePredictionUuid(id: number): string {
  const hash = createHash("sha256").update(`${FAILURE_PREDICTION_NAMESPACE}:${id}`).digest("hex");
  return [hash.substring(0, 8), hash.substring(8, 12), `4${  hash.substring(13, 16)}`, ((Number.parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.substring(18, 20), hash.substring(20, 32)].join("-");
}

export function getOrgId(req: Request, _res: Response): string {
  const orgId = req.headers["x-org-id"] as string;
  if (orgId && typeof orgId === "string" && orgId.trim() !== "") {
    return orgId.trim();
  }
  return "default-org";
}

export function sendValidatedResponse<T>(res: Response, data: unknown, schema: z.ZodSchema<T>): boolean {
  try {
    const validated = schema.parse(data);
    res.json(validated);
    return true;
  } catch (error) {
    console.error("[Analytics API] Response validation failed:", error);
    res.status(500).json({ error: { code: "RESPONSE_VALIDATION_ERROR", message: "Response failed DTO validation", details: process.env.NODE_ENV === "development" ? error : undefined }, metadata: { timestamp: new Date(), version: "1.0" } });
    return false;
  }
}

export function handleError(res: Response, error: unknown, operation: string) {
  console.error(`[Analytics API] ${operation} error:`, error);
  if (error instanceof Error && error.message.includes("not found")) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: error.message }, metadata: { timestamp: new Date(), version: "1.0" } });
    return;
  }
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "An unexpected error occurred", details: process.env.NODE_ENV === "development" ? error : undefined }, metadata: { timestamp: new Date(), version: "1.0" } });
}

```

### `server/routes/analytics/health-metrics.ts` (189 lines)

```ts
/**
 * Analytics Routes - Equipment Health and RUL Predictions
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import { equipmentHealthResponseSchema, rulBatchResponseSchema, type EquipmentHealthResponse, type RulBatchResponse } from "../../../shared/analytics-types";
import { storage } from "../../storage";
import { getOrgId, sendValidatedResponse, handleError } from "./helpers.js";

type EquipmentHealthItem = {
  id: string;
  name: string | null;
  type: string | null;
  vesselId: string | null;
  status: string;
  healthIndex: number;
};

type WorkOrderItem = {
  id: string;
  equipmentId: string;
  status: string;
  createdAt: Date;
  actualEndDate?: Date | null;
  plannedStartDate?: Date | null;
};

type AlertItem = {
  id: string;
  equipmentId: string;
  acknowledged: boolean;
};

function mapCondition(status: string, healthIndex: number): "excellent" | "good" | "fair" | "poor" | "critical" {
  if (status === "healthy") {return healthIndex >= 80 ? "excellent" : "good";}
  if (status === "warning") {return healthIndex >= 50 ? "fair" : "poor";}
  if (status === "critical") {return "critical";}
  return "fair";
}

function mapRiskLevel(status: string, healthIndex: number): "low" | "medium" | "high" | "critical" {
  if (status === "healthy") {return "low";}
  if (status === "warning") {return healthIndex >= 50 ? "medium" : "high";}
  if (status === "critical") {return "critical";}
  return "medium";
}

function mapEquipmentToHealthResult(
  eq: EquipmentHealthItem,
  allWorkOrders: WorkOrderItem[],
  allAlerts: AlertItem[],
  vesselMap: Map<string, string>
) {
  const equipmentWorkOrders = allWorkOrders
    .filter(wo => wo.equipmentId === eq.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastCompleted = equipmentWorkOrders.find(wo => wo.status === "completed");
  const nextScheduled = equipmentWorkOrders.find(wo => wo.status === "open" || wo.status === "in_progress");
  const equipmentAlerts = allAlerts.filter(a => a.equipmentId === eq.id && !a.acknowledged);
  return {
    id: eq.id,
    name: eq.name || "Unknown Equipment",
    type: eq.type || "Unknown",
    vesselId: eq.vesselId || null,
    vesselName: eq.vesselId ? vesselMap.get(eq.vesselId) : undefined,
    condition: mapCondition(eq.status, eq.healthIndex),
    healthScore: eq.healthIndex,
    riskLevel: mapRiskLevel(eq.status, eq.healthIndex),
    lastMaintenanceDate: lastCompleted?.actualEndDate ? new Date(lastCompleted.actualEndDate) : null,
    nextMaintenanceDate: nextScheduled?.plannedStartDate ? new Date(nextScheduled.plannedStartDate) : null,
    alertCount: equipmentAlerts.length,
    operatingHours: 0,
    telemetryStatus: "active" as const,
  };
}

type PdmScoreItem = {
  equipmentId: string;
  predictedDueDate?: Date | null;
  pFail30d?: number | null;
  healthIdx?: number | null;
  ts?: Date | null;
};

type EquipmentRegistryItem = {
  id: string;
  name: string;
  orgId: string;
};

function calculateRemainingDays(predictedDueDate: Date | null | undefined): number {
  if (!predictedDueDate) {return 30;}
  const now = new Date();
  return Math.max(0, Math.ceil((new Date(predictedDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function mapRiskFromProbability(failProb: number): "low" | "medium" | "high" | "critical" {
  if (failProb >= 0.75) {return "critical";}
  if (failProb >= 0.5) {return "high";}
  if (failProb >= 0.25) {return "medium";}
  return "low";
}

function mapPdmScoreToRulResult(score: PdmScoreItem, equipmentMap: Map<string, EquipmentRegistryItem>) {
  const equip = equipmentMap.get(score.equipmentId);
  const remainingDays = calculateRemainingDays(score.predictedDueDate);
  const failProb = score.pFail30d ?? 0;
  const riskLevel = mapRiskFromProbability(failProb);
  const recs = riskLevel === "critical"
    ? ["Schedule immediate inspection", "Prepare replacement parts"]
    : riskLevel === "high"
      ? ["Monitor closely", "Plan maintenance within 2 weeks"]
      : [];
  return {
    equipmentId: score.equipmentId,
    equipmentName: equip?.name || "Unknown Equipment",
    remainingDays,
    confidence: Math.max(0.5, 1 - failProb * 0.5),
    riskLevel,
    dataQuality: score.healthIdx ? Math.min(1, score.healthIdx / 100) : 0.7,
    predictionDate: score.ts || new Date(),
    methodology: "ml-hybrid" as const,
    contributingFactors: [],
    maintenanceRecommendations: recs,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string): boolean { return UUID_REGEX.test(id); }

export function mountHealthMetricsRoutes(router: Router) {
  router.get("/equipment-health", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      const { equipmentId } = req.query;
      const cacheKey = analyticsCacheKeys.equipmentHealth(orgId, equipmentId as string | undefined);
      const response = await cachedAnalytics<EquipmentHealthResponse>(cacheKey, async () => {
        const rawHealthData = await storage.getEquipmentHealth(orgId, undefined, equipmentId as string | undefined);
        const healthData = rawHealthData.filter(eq => isValidUuid(eq.id));
        const [allWorkOrders, rawAlerts, vesselList] = await Promise.all([
          storage.getWorkOrders(undefined, orgId),
          storage.getAlertNotifications(undefined),
          storage.getVessels(orgId),
        ]);
        const vesselMap = new Map(vesselList.map(v => [v.id, v.name]));
        const orgEquipmentIds = new Set(healthData.map(eq => eq.id));
        const allAlerts = rawAlerts.filter(a => orgEquipmentIds.has(a.equipmentId));
        const results = healthData.map(eq => mapEquipmentToHealthResult(eq, allWorkOrders, allAlerts, vesselMap));
        return { results, metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: 100, hasMore: false } };
      }, 300);
      sendValidatedResponse(res, response, equipmentHealthResponseSchema);
    } catch (error) {
      handleError(res, error, "Equipment Health");
    }
  });

  router.get("/rul-predictions", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      const { equipmentId } = req.query;
      const cacheKey = analyticsCacheKeys.rulPredictions(orgId, equipmentId as string | undefined);
      const response = await cachedAnalytics<RulBatchResponse>(cacheKey, async () => {
        const pdmScores = await storage.getPdmScores(equipmentId as string | undefined, orgId);
        const equipmentList = await storage.getEquipmentRegistry(orgId);
        const equipmentMap = new Map(equipmentList.map(e => [e.id, e]));
        const orgPdmScores = pdmScores.filter(s => equipmentMap.get(s.equipmentId)?.orgId === orgId);
        const results = orgPdmScores.map(score => mapPdmScoreToRulResult(score, equipmentMap));
        return {
          results,
          metadata: {
            orgId,
            timestamp: new Date(),
            version: "1.0",
            total: results.length,
            page: 1,
            pageSize: 100,
            hasMore: false,
            requestedCount: equipmentId ? 1 : orgPdmScores.length,
            successCount: results.length,
            failedCount: 0,
          },
        };
      }, 300);
      sendValidatedResponse(res, response, rulBatchResponseSchema);
    } catch (error) {
      handleError(res, error, "RUL Predictions");
    }
  });
}

```

### `server/routes/analytics/predictions.ts` (113 lines)

```ts
/**
 * Analytics Routes - Failure Predictions and Anomalies
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import { failurePredictionListResponseSchema, anomalyDetectionListResponseSchema, type FailurePredictionListResponse, type AnomalyDetectionListResponse } from "../../../shared/analytics-types";
import { db } from "../../db";
import { anomalyDetections, failurePredictions } from "../../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "../../storage";
import { getOrgId, sendValidatedResponse, handleError, toFailurePredictionUuid } from "./helpers.js";

type MaintRecRaw = { action?: string; priority?: string } | null;
type MaintRec = { action: string; priority: "low" | "medium" | "high" | "urgent" };

function parseMaintenanceRecs(raw: unknown): MaintRec[] {
  if (!raw) {return [];}
  if (Array.isArray(raw)) {
    return raw.map((rec: MaintRecRaw) => ({
      action: rec?.action || "Schedule inspection",
      priority: (rec?.priority as MaintRec["priority"]) || "medium",
    }));
  }
  if (typeof raw === "object") {
    const rec = raw as MaintRecRaw;
    return [{ action: rec?.action || "Schedule inspection", priority: (rec?.priority as MaintRec["priority"]) || "medium" }];
  }
  return [];
}

type EquipmentRegistryItem = { id: string; name: string; equipmentType?: string };
type FailurePredictionRow = typeof failurePredictions.$inferSelect;

function mapPredictionToResult(p: FailurePredictionRow, equipmentMap: Map<string, EquipmentRegistryItem>) {
  const equip = equipmentMap.get(p.equipmentId);
  const ciRaw = p.confidenceInterval as { lower?: number; upper?: number } | null;
  const ciParsed = ciRaw ?? { lower: 0.7, upper: 0.95 };
  const costImpactRaw = p.costImpact as { estimatedRepairCost?: number; estimatedDowntime?: number; revenueImpact?: number } | null;
  const maintRecs = parseMaintenanceRecs(p.maintenanceRecommendations);
  return {
    id: toFailurePredictionUuid(p.id),
    equipmentId: p.equipmentId,
    equipmentName: equip?.name || "Unknown Equipment",
    equipmentType: equip?.equipmentType || "General",
    predictionDate: p.predictionTimestamp || new Date(),
    failureProbability: p.failureProbability,
    predictedFailureDate: p.predictedFailureDate,
    remainingUsefulLife: p.remainingUsefulLife ?? 30,
    confidenceInterval: { lower: ciParsed.lower ?? 0.7, upper: ciParsed.upper ?? 0.95 },
    failureMode: p.failureMode || "Unknown",
    riskLevel: p.riskLevel as "low" | "medium" | "high" | "critical",
    maintenanceRecommendations: maintRecs,
    costImpact: {
      estimatedRepairCost: costImpactRaw?.estimatedRepairCost ?? 0,
      estimatedDowntime: costImpactRaw?.estimatedDowntime ?? 0,
      revenueImpact: costImpactRaw?.revenueImpact ?? 0,
    },
    modelUsed: p.modelId || "hybrid-ensemble-v1",
    modelConfidence: 0.85,
  };
}

export function mountPredictionsRoutes(router: Router) {
  router.get("/anomalies", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      const { equipmentId, severity } = req.query;
      const cacheKey = analyticsCacheKeys.anomalies(orgId, equipmentId as string | undefined, severity as string | undefined);
      const response = await cachedAnalytics<AnomalyDetectionListResponse>(cacheKey, async () => {
        const filters = [eq(anomalyDetections.orgId, orgId)];
        if (equipmentId) {filters.push(eq(anomalyDetections.equipmentId, equipmentId as string));}
        if (severity) {filters.push(eq(anomalyDetections.severity, severity as any));}
        const results = await db.select().from(anomalyDetections).where(and(...filters)).orderBy(sql`${anomalyDetections.detectionTimestamp} DESC`).limit(100);
        const unacknowledged = results.filter(r => !r.acknowledgedAt).length;
        const critical = results.filter(r => r.severity === "critical").length;
        return {
          results,
          metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: Math.max(results.length, 1), hasMore: false, unacknowledgedCount: unacknowledged, criticalCount: critical },
        };
      }, 120);
      sendValidatedResponse(res, response, anomalyDetectionListResponseSchema);
    } catch (error) {
      handleError(res, error, "Anomalies");
    }
  });

  router.get("/failure-predictions", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      const { equipmentId, riskLevel } = req.query;
      const cacheKey = analyticsCacheKeys.failurePredictions(orgId, equipmentId as string | undefined, riskLevel as string | undefined);
      const response = await cachedAnalytics<FailurePredictionListResponse>(cacheKey, async () => {
        const filters = [eq(failurePredictions.orgId, orgId)];
        if (equipmentId) {filters.push(eq(failurePredictions.equipmentId, equipmentId as string));}
        if (riskLevel) {filters.push(eq(failurePredictions.riskLevel, riskLevel as any));}
        const predictions = await db.select().from(failurePredictions).where(and(...filters)).orderBy(sql`${failurePredictions.predictionTimestamp} DESC`).limit(100);
        const equipmentIds = [...new Set(predictions.map(p => p.equipmentId))];
        const equipmentData = equipmentIds.length > 0 ? await storage.getEquipmentRegistry(orgId) : [];
        const equipmentMap = new Map(equipmentData.map(e => [e.id, e]));
        const results = predictions.map(p => mapPredictionToResult(p, equipmentMap));
        const highRisk = results.filter(r => r.riskLevel === "high").length;
        const criticalRisk = results.filter(r => r.riskLevel === "critical").length;
        return {
          results,
          metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: Math.max(results.length, 1), hasMore: false, highRiskCount: highRisk, criticalRiskCount: criticalRisk },
        };
      }, 180);
      sendValidatedResponse(res, response, failurePredictionListResponseSchema);
    } catch (error) {
      handleError(res, error, "Failure Predictions");
    }
  });
}

```

### `server/routes/analytics/costs-and-feedback.ts` (53 lines)

```ts
/**
 * Analytics Routes - LLM Costs and Prediction Feedback
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import { predictionExplainabilityResponseSchema, featureImportanceListResponseSchema, type PredictionFeedbackListResponse, type LlmCostListResponse } from "../../../shared/analytics-types";
import { db } from "../../db";
import { predictionFeedback, llmCostTracking } from "../../../shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getOrgId, sendValidatedResponse, handleError } from "./helpers.js";

export function mountCostsAndFeedbackRoutes(router: Router) {
  router.get("/prediction-feedback", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { equipmentId } = req.query;
      const cacheKey = analyticsCacheKeys.predictionFeedback(orgId, equipmentId as string | undefined);
      const response = await cachedAnalytics<PredictionFeedbackListResponse>(cacheKey, async () => {
        const filters = [eq(predictionFeedback.orgId, orgId)];
        if (equipmentId) { filters.push(eq(predictionFeedback.equipmentId, equipmentId as string)); }
        const results = await db.select().from(predictionFeedback).where(and(...filters)).orderBy(sql`${predictionFeedback.submittedAt} DESC`).limit(100);
        return { results, metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: Math.max(results.length, 1), hasMore: false } };
      }, 240);
      sendValidatedResponse(res, response, predictionExplainabilityResponseSchema);
    } catch (error) { handleError(res, error, "Prediction Feedback"); }
  });

  router.get("/llm-costs", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { period } = req.query;
      const cacheKey = analyticsCacheKeys.llmCosts(orgId, period as string | undefined);
      const response = await cachedAnalytics<LlmCostListResponse>(cacheKey, async () => {
        const filters = [eq(llmCostTracking.orgId, orgId)];
        if (period) {
          const now = new Date();
          const periodOffsets: Record<string, () => Date> = {
            today: () => new Date(now.setHours(0, 0, 0, 0)),
            week: () => new Date(now.setDate(now.getDate() - 7)),
            month: () => new Date(now.setMonth(now.getMonth() - 1)),
          };
          const startDate = (periodOffsets[period as string] ?? (() => new Date(now.setDate(now.getDate() - 30))))();
          filters.push(gte(llmCostTracking.timestamp, startDate));
        }
        const results = await db.select().from(llmCostTracking).where(and(...filters)).orderBy(sql`${llmCostTracking.timestamp} DESC`).limit(100);
        return { results, metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: Math.max(results.length, 1), hasMore: false } };
      }, 300);
      sendValidatedResponse(res, response, featureImportanceListResponseSchema);
    } catch (error) { handleError(res, error, "LLM Costs"); }
  });
}

```

### `server/routes/analytics/model-governance.ts` (118 lines)

```ts
/**
 * Analytics Routes - ML Models, Performance, and Drift
 */
import type { Router, Request, Response } from "express";
import { cachedAnalytics, analyticsCacheKeys } from "../../lib/cache";
import { mlModelListResponseSchema, mlModelResponseSchema, modelPerformanceListResponseSchema, anomalyDetectionListResponseSchema, modelDriftListResponseSchema, type MlModelListResponse, type MlModelResponse, type ModelPerformanceListResponse, type ModelPerformanceSummaryResponse, type ModelDriftListResponse } from "../../../shared/analytics-types";
import { db } from "../../db";
import { mlModels, modelPerformanceValidations } from "../../../shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getOrgId, sendValidatedResponse, handleError } from "./helpers.js";

export function mountModelGovernanceRoutes(router: Router) {
  router.get("/ml-models", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { modelType, status } = req.query;
      const cacheKey = analyticsCacheKeys.mlModels(orgId, modelType as string | undefined);
      const response = await cachedAnalytics<MlModelListResponse>(cacheKey, async () => {
        const filters = [eq(mlModels.orgId, orgId)];
        if (modelType) { filters.push(eq(mlModels.modelType, modelType as string)); }
        if (status) { filters.push(eq(mlModels.status, status as any)); }
        const models = await db.select().from(mlModels).where(and(...filters)).orderBy(sql`${mlModels.trainedAt} DESC`);
        return { results: models, metadata: { orgId, timestamp: new Date(), version: "1.0", total: models.length, page: 1, pageSize: Math.max(models.length, 1), hasMore: false } };
      }, 300);
      sendValidatedResponse(res, response, mlModelListResponseSchema);
    } catch (error) { handleError(res, error, "ML Models List"); }
  });

  router.get("/ml-models/:id", async (req: Request, res: Response) => {
    const orgId = getOrgId(req, res);
    if (!orgId) { return; }
    try {
      const { id } = req.params;
      const cacheKey = `${orgId}:ml-model:${id}`;
      const response = await cachedAnalytics<MlModelResponse>(cacheKey, async () => {
        const [model] = await db.select().from(mlModels).where(and(eq(mlModels.id, id), eq(mlModels.orgId, orgId))).limit(1);
        if (!model) { throw new Error("Model not found"); }
        return { result: model, metadata: { orgId, timestamp: new Date(), version: "1.0" } };
      }, 180);
      sendValidatedResponse(res, response, mlModelResponseSchema);
    } catch (error) {
      if (error instanceof Error && error.message === "Model not found") { res.status(404).json({ error: { code: "NOT_FOUND", message: "ML model not found" }, metadata: { orgId, timestamp: new Date(), version: "1.0" } }); }
      else { handleError(res, error, "ML Model"); }
    }
  });

  router.get("/model-performance", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { modelId } = req.query;
      const cacheKey = analyticsCacheKeys.modelPerformance(orgId, modelId as string | undefined);
      const response = await cachedAnalytics<ModelPerformanceListResponse>(cacheKey, async () => {
        const filters = [eq(modelPerformanceValidations.orgId, orgId)];
        if (modelId) { filters.push(eq(modelPerformanceValidations.modelId, modelId as string)); }
        const results = await db.select().from(modelPerformanceValidations).where(and(...filters)).orderBy(sql`${modelPerformanceValidations.validatedAt} DESC`).limit(100);
        return { results, metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: Math.max(results.length, 1), hasMore: false } };
      }, 240);
      sendValidatedResponse(res, response, modelPerformanceListResponseSchema);
    } catch (error) { handleError(res, error, "Model Performance"); }
  });

  router.get("/model-performance/summary", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const cacheKey = `${orgId}:model-performance:summary`;
      const response = await cachedAnalytics<ModelPerformanceSummaryResponse>(cacheKey, async () => {
        const validations = await db.select().from(modelPerformanceValidations).where(eq(modelPerformanceValidations.orgId, orgId)).limit(1);
        if (validations.length === 0) {
          return { result: { summaryByModel: [], overallStats: { totalModels: 0, totalValidations: 0, avgAccuracyAcrossModels: 0 } }, metadata: { orgId, timestamp: new Date(), version: "1.0" } };
        }
        const summary = await db.select({ modelId: modelPerformanceValidations.modelId, modelType: mlModels.modelType, avgAccuracy: sql<number>`AVG(${modelPerformanceValidations.accuracy})`, avgPrecision: sql<number>`AVG(${modelPerformanceValidations.precision})`, avgRecall: sql<number>`AVG(${modelPerformanceValidations.recall})`, avgF1Score: sql<number>`AVG(${modelPerformanceValidations.f1Score})`, totalValidations: sql<number>`COUNT(*)`, lastValidation: sql<Date>`MAX(${modelPerformanceValidations.validatedAt})` }).from(modelPerformanceValidations).innerJoin(mlModels, eq(modelPerformanceValidations.modelId, mlModels.id)).where(eq(modelPerformanceValidations.orgId, orgId)).groupBy(modelPerformanceValidations.modelId, mlModels.modelType);
        return { result: { summaryByModel: summary, overallStats: { totalModels: summary.length, totalValidations: summary.reduce((sum, s) => sum + Number(s.totalValidations), 0), avgAccuracyAcrossModels: summary.reduce((sum, s) => sum + Number(s.avgAccuracy), 0) / summary.length || 0 } }, metadata: { orgId, timestamp: new Date(), version: "1.0" } };
      }, 300);
      res.json(response);
    } catch (error) { handleError(res, error, "Model Performance Summary"); }
  });

  router.get("/model-drift", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { modelId } = req.query;
      const cacheKey = analyticsCacheKeys.modelDrift(orgId, modelId as string | undefined);
      const response = await cachedAnalytics<ModelDriftListResponse>(cacheKey, async () => {
        const modelFilters = [eq(mlModels.orgId, orgId)];
        if (modelId) { modelFilters.push(eq(mlModels.id, modelId as string)); }
        const models = await db.select().from(mlModels).where(and(...modelFilters));
        const results = [];
        let criticalCount = 0;
        for (const model of models) {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const validations = await db.select().from(modelPerformanceValidations).where(and(eq(modelPerformanceValidations.modelId, model.id), gte(modelPerformanceValidations.createdAt, thirtyDaysAgo))).orderBy(sql`${modelPerformanceValidations.createdAt} DESC`).limit(100);
          if (validations.length < 2) { continue; }
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const recent = validations.filter((v) => new Date(v.createdAt || 0) >= sevenDaysAgo);
          const historical = validations.filter((v) => new Date(v.createdAt || 0) < sevenDaysAgo);
          if (recent.length === 0 || historical.length === 0) { continue; }
          const recentAccuracy = recent.filter((v) => v.wasCorrect).length / recent.length;
          const historicalAccuracy = historical.filter((v) => v.wasCorrect).length / historical.length;
          const performanceDrop = historicalAccuracy - recentAccuracy;
          const driftScore = Math.min(1, Math.max(0, performanceDrop * 2));
          let severity: "low" | "medium" | "high" | "critical" = "low";
          if (driftScore >= 0.3) { severity = "critical"; } else if (driftScore >= 0.2) { severity = "high"; } else if (driftScore >= 0.1) { severity = "medium"; }
          if (severity === "critical") {
            criticalCount++;
          }

          if (driftScore >= 0.05) { results.push({ id: model.id, modelId: model.id, modelType: model.modelType || 'unknown', detectedAt: new Date(), driftScore, driftType: 'performance' as const, severity, affectedFeatures: [], performanceDegradation: performanceDrop * 100, recommendedAction: severity === 'critical' ? 'urgent_retrain' as const : severity === 'high' ? 'retrain' as const : 'monitor' as const, explanation: `Model accuracy dropped from ${(historicalAccuracy * 100).toFixed(1)}% to ${(recentAccuracy * 100).toFixed(1)}% over the last 7 days.` }); }
        }
        return { results, metadata: { orgId, timestamp: new Date(), version: "1.0", total: results.length, page: 1, pageSize: 100, hasMore: false, criticalCount } };
      }, 300);
      sendValidatedResponse(res, response, modelDriftListResponseSchema);
    } catch (error) { handleError(res, error, "Model Drift"); }
  });
}

```

### `server/routes/analytics/cache-reconciliation.ts` (75 lines)

```ts
/**
 * Analytics Routes - Cache Management and Data Reconciliation
 */
import type { Router, Request, Response } from "express";
import { invalidateAnalyticsCache } from "../../lib/cache";
import { getOrgId, handleError } from "./helpers.js";

export function mountCacheReconciliationRoutes(router: Router) {
  router.post("/cache/invalidate", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { scope } = req.body;
      const cacheInvalidators: Record<string, (orgId: string) => Promise<void>> = {
        all: invalidateAnalyticsCache.allForOrg,
        "equipment-health": invalidateAnalyticsCache.equipmentHealth,
        anomalies: invalidateAnalyticsCache.anomalies,
        "failure-predictions": invalidateAnalyticsCache.failurePredictions,
        "ml-models": invalidateAnalyticsCache.mlModels,
      };
      const invalidator = cacheInvalidators[scope];
      if (!invalidator) {throw new Error("Invalid cache scope");}
      await invalidator(orgId);
      res.json({ success: true, message: `Cache invalidated for scope: ${scope}`, metadata: { orgId, timestamp: new Date(), version: "1.0" } });
    } catch (error) { handleError(res, error, "Cache Invalidation"); }
  });

  router.post("/reconciliation/run", async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req, res);
      if (!orgId) { return; }
      const { dataReconciliationService } = await import("../../services/data-reconciliation.js");
      const report = await dataReconciliationService.runReconciliation(orgId);
      res.json({ success: true, report, metadata: { orgId, timestamp: new Date(), version: "1.0" } });
    } catch (error) { handleError(res, error, "Data Reconciliation"); }
  });

  router.get("/reconciliation/status", async (req: Request, res: Response) => {
    const orgId = getOrgId(req, res);
    if (!orgId) { return; }
    try {
      const { dataReconciliationService } = await import("../../services/data-reconciliation.js");
      const status = dataReconciliationService.getStatus();
      res.json({ ...status, metadata: { orgId, timestamp: new Date(), version: "1.0" } });
    } catch (error) { handleError(res, error, "Reconciliation Status"); }
  });

  router.get("/reconciliation/latest-report", async (req: Request, res: Response) => {
    const orgId = getOrgId(req, res);
    if (!orgId) { return; }
    try {
      const { dataReconciliationService } = await import("../../services/data-reconciliation.js");
      const report = dataReconciliationService.getLatestReport();
      if (!report) { return res.status(404).json({ error: { code: "NOT_FOUND", message: "No reconciliation report available yet" }, metadata: { orgId, timestamp: new Date(), version: "1.0" } }); }
      const issueGroups = new Map<string, { type: string; severity: string; table: string; count: number; description: string }>();
      report.issues.forEach((issue) => {
        const issueTypeMap: Record<string, string> = {
          missing_equipment: "missing_reference",
          invalid_sensor: "validation_failure",
          data_quality: "quality_issue",
          org_mismatch: "inconsistent",
          timestamp_anomaly: "temporal_issue",
          orphaned_record: "orphaned",
        };
        const frontendType = issueTypeMap[issue.type] ?? "unknown";
        const frontendSeverity = issue.severity === "low" ? "info" : issue.severity === "medium" ? "warning" : "critical";
        const table = (issue.metadata?.table as string) || "unknown";
        const groupKey = `${frontendType}:${frontendSeverity}:${table}`;
        if (issueGroups.has(groupKey)) { issueGroups.get(groupKey)!.count++; }
        else { issueGroups.set(groupKey, { type: frontendType, severity: frontendSeverity, table, count: 1, description: issue.message }); }
      });
      res.json({ timestamp: report.endTime, duration: report.duration, totalChecks: report.recordsScanned, issuesFound: report.issuesDetected, issues: Array.from(issueGroups.values()), status: "completed", metadata: { orgId, timestamp: new Date(), version: "1.0" } });
    } catch (error) { handleError(res, error, "Latest Reconciliation Report"); }
  });
}

```

### `server/domains/ml-analytics/routes/types.ts` (12 lines)

```ts
/**
 * ML Analytics Route Configuration Types
 */

import type { IStorage } from "../../../storage";

export interface MlAnalyticsConfig {
  storage: IStorage;
  writeOperationRateLimit: any;
  schedulerEventBus: any;
  adaptiveTrainingWindow: any;
}

```

### `server/domains/ml-analytics/routes/index.ts` (30 lines)

```ts
/**
 * ML Analytics Domain Routes - Main Entry Point
 * 
 * Orchestrates registration of all ML analytics route modules.
 */

import type { Express } from "express";
import type { MlAnalyticsConfig } from "./types.js";
import { registerExportCompleteRoutes } from "./export-complete.js";
import { registerExportPartialRoutes } from "./export-partial.js";
import { registerAnomalyRoutes } from "./anomaly-routes.js";
import { registerPredictionRoutes } from "./prediction-routes.js";
import { registerThresholdRoutes } from "./threshold-routes.js";
import { registerTwinRoutes } from "./twin-routes.js";
import { registerInsightRoutes } from "./insight-routes.js";
import { logger } from "../../../utils/logger.js";

export type { MlAnalyticsConfig } from "./types.js";

export function registerMlAnalyticsRoutes(app: Express, config: MlAnalyticsConfig) {
  registerExportCompleteRoutes(app, config);
  registerExportPartialRoutes(app, config);
  registerAnomalyRoutes(app, config);
  registerPredictionRoutes(app, config);
  registerThresholdRoutes(app, config);
  registerTwinRoutes(app, config);
  registerInsightRoutes(app, config);

  logger.info("MlAnalyticsRoutes", "Registered (exports: 4, anomalies: 4, predictions: 3, thresholds: 4, twins: 4, insights: 2)");
}

```

### `server/domains/ml-analytics/routes/anomaly-routes.ts` (93 lines)

```ts
/**
 * ML Analytics - Anomaly Detection Routes
 * 
 * CRUD operations for anomaly detections.
 */

import type { Express } from "express";
import { insertAnomalyDetectionSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerAnomalyRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage, writeOperationRateLimit, schedulerEventBus } = config;

  app.get("/api/analytics/anomaly-detections",
    withErrorHandling("fetch anomaly detections", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, severity } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const detections = await storage.getAnomalyDetections(
        orgId as string,
        equipmentId as string,
        severity as string
      );
      const { normalizeAnomalyDetections } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeAnomalyDetections(detections));
    })
  );

  app.get("/api/analytics/anomaly-detections/:id",
    withErrorHandling("fetch anomaly detection", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const detection = await storage.getAnomalyDetection(Number.parseInt(req.params.id), orgId as string);
      if (!detection) {
        return sendNotFound(res, "Anomaly detection");
      }
      const { normalizeAnomalyDetection } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeAnomalyDetection(detection));
    })
  );

  app.post("/api/analytics/anomaly-detections", writeOperationRateLimit,
    withErrorHandling("create anomaly detection", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, ...detectionData } = req.body;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const validatedData = insertAnomalyDetectionSchema.parse(detectionData);
      const detection = await storage.createAnomalyDetection(validatedData, orgId);

      if (detection.severity === "high" || detection.severity === "critical") {
        try {
          const equipment = await storage.getEquipment(orgId as string, detection.equipmentId);
          if (equipment) {
            schedulerEventBus.emitAnomalyCreated({
              orgId: orgId as string,
              vesselId: equipment.vesselId || "unknown",
              equipmentId: detection.equipmentId,
              severity: detection.severity as "low" | "medium" | "high" | "critical",
              anomalyType: detection.anomalyType || "unknown",
            });
          }
        } catch (eventError) {
          logger.error("AnomalyRoutes", "Failed to emit anomaly event", eventError);
        }
      }

      const { normalizeAnomalyDetection } = await import("../../../analytics-data-normalizer.js");
      res.status(201).json(normalizeAnomalyDetection(detection));
    })
  );

  app.patch("/api/analytics/anomaly-detections/:id/acknowledge", writeOperationRateLimit,
    withErrorHandling("acknowledge anomaly", async (req, res) => {
      const { acknowledgedBy, orgId = (req as AuthenticatedRequest).orgId } = req.body;
      if (!acknowledgedBy) {
        return res.status(400).json({ message: "acknowledgedBy is required" });
      }
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const detection = await storage.acknowledgeAnomaly(Number.parseInt(req.params.id), acknowledgedBy, orgId);
      const { normalizeAnomalyDetection } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeAnomalyDetection(detection));
    })
  );
}

```

### `server/domains/ml-analytics/routes/prediction-routes.ts` (85 lines)

```ts
/**
 * ML Analytics - Failure Prediction Routes
 * 
 * CRUD operations for failure predictions.
 */

import type { Express } from "express";
import { insertFailurePredictionSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerPredictionRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage, writeOperationRateLimit, schedulerEventBus } = config;

  app.get("/api/analytics/failure-predictions",
    withErrorHandling("fetch failure predictions", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, riskLevel } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const predictions = await storage.getFailurePredictions(
        orgId as string,
        equipmentId as string,
        riskLevel as string
      );
      const { normalizeFailurePredictions } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeFailurePredictions(predictions));
    })
  );

  app.get("/api/analytics/failure-predictions/:id",
    withErrorHandling("fetch failure prediction", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const prediction = await storage.getFailurePrediction(Number.parseInt(req.params.id), orgId as string);
      if (!prediction) {
        return sendNotFound(res, "Failure prediction");
      }
      const { normalizeFailurePrediction } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeFailurePrediction(prediction));
    })
  );

  app.post("/api/analytics/failure-predictions", writeOperationRateLimit,
    withErrorHandling("create failure prediction", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, ...predictionData } = req.body;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const validatedData = insertFailurePredictionSchema.parse(predictionData);
      const prediction = await storage.createFailurePrediction(validatedData, orgId);

      try {
        const equipment = await storage.getEquipment(orgId as string, validatedData.equipmentId);
        if (equipment) {
          const remainingDays = validatedData.predictedFailureDate
            ? Math.max(
                0,
                Math.floor(
                  (new Date(validatedData.predictedFailureDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                )
              )
            : 30;

          schedulerEventBus.emitRulUpdate({
            orgId: orgId as string,
            vesselId: equipment.vesselId || "unknown",
            equipmentId: validatedData.equipmentId,
            remainingDays,
            confidenceScore: validatedData.failureProbability || 0.8,
          });
        }
      } catch (eventError) {
        logger.error("PredictionRoutes", "Failed to emit RUL update event", eventError);
      }

      const { normalizeFailurePrediction } = await import("../../../analytics-data-normalizer.js");
      res.status(201).json(normalizeFailurePrediction(prediction));
    })
  );
}

```

### `server/domains/ml-analytics/routes/threshold-routes.ts` (71 lines)

```ts
/**
 * ML Analytics - Threshold Optimization Routes
 * 
 * CRUD operations for threshold optimizations.
 */

import type { Express } from "express";
import { insertThresholdOptimizationSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerThresholdRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage, writeOperationRateLimit } = config;

  app.get("/api/analytics/threshold-optimizations",
    withErrorHandling("fetch threshold optimizations", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, status } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const optimizations = await storage.getThresholdOptimizations(
        orgId as string,
        equipmentId as string,
        status as string
      );
      const { normalizeThresholdOptimizations } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeThresholdOptimizations(optimizations));
    })
  );

  app.get("/api/analytics/threshold-optimizations/:id",
    withErrorHandling("fetch threshold optimization", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const optimization = await storage.getThresholdOptimization(Number.parseInt(req.params.id), orgId as string);
      if (!optimization) {
        return sendNotFound(res, "Threshold optimization");
      }
      const { normalizeThresholdOptimization } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeThresholdOptimization(optimization));
    })
  );

  app.post("/api/analytics/threshold-optimizations", writeOperationRateLimit,
    withErrorHandling("create threshold optimization", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, ...optimizationData } = req.body;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const validatedData = insertThresholdOptimizationSchema.parse(optimizationData);
      const optimization = await storage.createThresholdOptimization(validatedData, orgId);
      const { normalizeThresholdOptimization } = await import("../../../analytics-data-normalizer.js");
      res.status(201).json(normalizeThresholdOptimization(optimization));
    })
  );

  app.patch("/api/analytics/threshold-optimizations/:id/apply", writeOperationRateLimit,
    withErrorHandling("apply threshold optimization", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.body;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const optimization = await storage.applyThresholdOptimization(Number.parseInt(req.params.id), orgId);
      const { normalizeThresholdOptimization } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeThresholdOptimization(optimization));
    })
  );
}

```

### `server/domains/ml-analytics/routes/twin-routes.ts` (71 lines)

```ts
/**
 * ML Analytics - Digital Twin Routes
 * 
 * Routes for digital twins and twin simulations.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerTwinRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage } = config;

  app.get("/api/analytics/digital-twins",
    withErrorHandling("fetch digital twins", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, vesselId, twinType } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const twins = await storage.getDigitalTwins(orgId as string, vesselId as string, twinType as string);
      const { normalizeDigitalTwins } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeDigitalTwins(twins));
    })
  );

  app.get("/api/analytics/digital-twins/:id",
    withErrorHandling("fetch digital twin", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const twin = await storage.getDigitalTwin(req.params.id, orgId as string);
      if (!twin) {
        return sendNotFound(res, "Digital twin");
      }
      const { normalizeDigitalTwin } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeDigitalTwin(twin));
    })
  );

  app.get("/api/analytics/twin-simulations",
    withErrorHandling("fetch twin simulations", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, digitalTwinId, scenarioType, status } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const simulations = await storage.getTwinSimulations(
        orgId as string,
        digitalTwinId as string,
        scenarioType as string,
        status as string
      );
      res.json(simulations);
    })
  );

  app.get("/api/analytics/twin-simulations/:id",
    withErrorHandling("fetch twin simulation", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const simulation = await storage.getTwinSimulation(req.params.id, orgId as string);
      if (!simulation) {
        return sendNotFound(res, "Twin simulation");
      }
      res.json(simulation);
    })
  );
}

```

### `server/domains/ml-analytics/routes/insight-routes.ts` (45 lines)

```ts
/**
 * ML Analytics - Insight Snapshot Routes
 * 
 * Routes for insight snapshots.
 */

import type { Express } from "express";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerInsightRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage } = config;

  app.get("/api/analytics/insight-snapshots",
    withErrorHandling("fetch insight snapshots", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, scope, limit } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const snapshots = await storage.getInsightSnapshots(
        orgId as string,
        scope as string,
        limit ? Number.parseInt(limit as string) : undefined
      );
      const { normalizeInsightSnapshots } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeInsightSnapshots(snapshots));
    })
  );

  app.get("/api/analytics/insight-snapshots/latest",
    withErrorHandling("fetch latest insight snapshot", async (req, res) => {
      const { scope = "fleet", orgId = (req as AuthenticatedRequest).orgId } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }
      const snapshot = await storage.getLatestInsightSnapshot(scope as string, orgId as string);
      if (!snapshot) {
        return sendNotFound(res, "Insight snapshot");
      }
      const { normalizeInsightSnapshot } = await import("../../../analytics-data-normalizer.js");
      res.json(normalizeInsightSnapshot(snapshot));
    })
  );
}

```

### `server/domains/ml-analytics/routes/export-complete.ts` (153 lines)

```ts
/**
 * ML Analytics - Complete ML/PDM Export Route
 * 
 * Comprehensive export of all ML/PDM data in industry-standard format.
 */

import type { Express } from "express";
import type { MlAnalyticsConfig } from "./types.js";
import { logger } from "../../../utils/logger.js";

export function registerExportCompleteRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage, adaptiveTrainingWindow } = config;

  app.get("/api/analytics/export/ml-pdm-complete", async (req, res) => {
    try {
      const { orgId, format = "json" } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId parameter is required" });
      }

      const { rawTelemetry, vessels } = await import("../../../../shared/schema.js");
      const { db } = await import("../../../db.js");
      const { eq } = await import("drizzle-orm");

      const [
        mlModels,
        failurePredictions,
        anomalyDetections,
        thresholdOptimizations,
        pdmScores,
        telemetryData,
      ] = await Promise.all([
        storage.getMlModels(orgId as string),
        storage.getFailurePredictions(orgId as string),
        storage.getAnomalyDetections(orgId as string),
        storage.getThresholdOptimizations(orgId as string),
        storage.getPdmScores(),
        db
          .select({
            id: rawTelemetry.id,
            vessel: rawTelemetry.vessel,
            ts: rawTelemetry.ts,
            src: rawTelemetry.src,
            sig: rawTelemetry.sig,
            value: rawTelemetry.value,
            unit: rawTelemetry.unit,
            createdAt: rawTelemetry.createdAt,
          })
          .from(rawTelemetry)
          .innerJoin(vessels, eq(rawTelemetry.vessel, vessels.id))
          .where(eq(vessels.orgId, orgId as string)),
      ]);

      const enrichedModels = mlModels.map((model) => {
        const hyperparams = (model.hyperparameters ?? {}) as Record<string, unknown>;
        if (hyperparams.dataQualityTier) {return model;}
        if (hyperparams.lookbackDays) {
          const { tier, confidenceMultiplier } =
            adaptiveTrainingWindow.calculateTierFromLookbackDays(hyperparams.lookbackDays);
          return {
            ...model,
            hyperparameters: {
              ...hyperparams,
              dataQualityTier: tier,
              confidenceMultiplier,
              isLegacyEnriched: true,
            },
          };
        }
        return {
          ...model,
          hyperparameters: {
            ...hyperparams,
            dataQualityTier: "bronze",
            confidenceMultiplier: 0.85,
            lookbackDays: 30,
            isLegacyEnriched: true,
            enrichmentNote: "Default Bronze tier applied - no historical lookback data available",
          },
        };
      });

      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          orgId,
          dataVersion: "1.0",
          format: "ARUS ML/PDM Export",
          compatibility:
            "Industry-standard predictive maintenance format compatible with IBM Maximo, Azure IoT, SAP PM, Oracle EAM",
          note: "Includes raw telemetry data for model training in external platforms",
        },
        mlModels: enrichedModels,
        failurePredictions,
        anomalyDetections,
        thresholdOptimizations,
        pdmScores,
        telemetry: telemetryData,
        statistics: {
          totalModels: enrichedModels.length,
          totalPredictions: failurePredictions.length,
          totalAnomalies: anomalyDetections.length,
          totalOptimizations: thresholdOptimizations.length,
          totalPdmScores: pdmScores.length,
          totalTelemetryRecords: telemetryData.length,
        },
      };

      if (format === "csv") {
        const escapeCsv = (value: unknown) => {
          if (value === null || value === undefined) {return "";}
          const str = String(value);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replaceAll('"', '""')}"`;
          }
          return str;
        };

        const csvRows = [
          [
            "ModelID", "ModelName", "ModelType", "EquipmentType", "Status", "Version",
            "Accuracy", "Precision", "Recall", "F1Score", "DataQualityTier",
            "ConfidenceMultiplier", "LookbackDays", "IsLegacyEnriched", "DeployedAt", "CreatedAt",
          ].join(","),
          ...enrichedModels.map((m) => {
            const perf = (m.performanceMetrics ?? {}) as Record<string, unknown>;
            const hyper = (m.hyperparameters ?? {}) as Record<string, unknown>;
            return [
              escapeCsv(m.id), escapeCsv(m.name), escapeCsv(m.modelType),
              escapeCsv(m.equipmentType || "all"), escapeCsv(m.status), escapeCsv(m.version),
              escapeCsv(perf.accuracy), escapeCsv(perf.precision), escapeCsv(perf.recall),
              escapeCsv(perf.f1Score), escapeCsv(hyper.dataQualityTier),
              escapeCsv(hyper.confidenceMultiplier), escapeCsv(hyper.lookbackDays),
              escapeCsv(hyper.isLegacyEnriched), escapeCsv(m.deployedAt), escapeCsv(m.createdAt),
            ].join(",");
          }),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="arus-ml-models-export-${Date.now()}.csv"`);
        res.setHeader("X-Export-Note", "CSV contains ML models only. Use JSON format for complete multi-dataset export.");
        return res.send(csvRows);
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="ml-pdm-export-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error) {
      logger.error("ExportComplete", "Failed to export ML/PDM data", error);
      res.status(500).json({ message: "Failed to export ML/PDM data" });
    }
  });
}

```

### `server/domains/ml-analytics/routes/export-partial.ts` (168 lines)

```ts
/**
 * ML Analytics - Partial Export Routes
 * 
 * Individual export routes for ML models, telemetry, and predictions.
 */

import type { Express } from "express";
import { withErrorHandling } from "../../../lib/route-utils.js";
import type { MlAnalyticsConfig } from "./types.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerExportPartialRoutes(app: Express, config: MlAnalyticsConfig) {
  const { storage, adaptiveTrainingWindow } = config;

  app.get("/api/analytics/export/ml-models",
    withErrorHandling("export ML models", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, format = "json" } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }

      const models = await storage.getMlModels(orgId as string);

      const enrichedModels = models.map((model) => {
        const hyperparams = (model.hyperparameters ?? {}) as Record<string, unknown>;
        if (!hyperparams.dataQualityTier && hyperparams.lookbackDays) {
          const { tier, confidenceMultiplier } =
            adaptiveTrainingWindow.calculateTierFromLookbackDays(hyperparams.lookbackDays);
          return {
            ...model,
            hyperparameters: { ...hyperparams, dataQualityTier: tier, confidenceMultiplier },
          };
        }
        return model;
      });

      const exportData = {
        format: "ML Model Export v1.0",
        compatibility: ["TensorFlow", "PyTorch", "scikit-learn", "IBM Maximo", "Azure ML"],
        exportedAt: new Date().toISOString(),
        models: enrichedModels.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.modelType,
          equipmentType: m.equipmentType,
          status: m.status,
          version: m.version,
          hyperparameters: m.hyperparameters,
          performanceMetrics: m.performanceMetrics,
          featureImportance: m.featureImportance,
          deployedAt: m.deployedAt,
          createdAt: m.createdAt,
        })),
      };

      if (format === "csv") {
        const csvData = [
          "id,name,type,equipmentType,status,version,accuracy,precision,recall,f1Score,deployedAt,createdAt",
          ...enrichedModels.map((m) => {
            const perf = (m.performanceMetrics ?? {}) as Record<string, unknown>;
            return `${m.id},${m.name},${m.modelType},${m.equipmentType || ""},${m.status},${m.version},${perf.accuracy || ""},${perf.precision || ""},${perf.recall || ""},${perf.f1Score || ""},${m.deployedAt || ""},${m.createdAt}`;
          }),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="ml-models-export-${Date.now()}.csv"`);
        return res.send(csvData);
      }

      res.json(exportData);
    })
  );

  app.get("/api/analytics/export/telemetry",
    withErrorHandling("export telemetry", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, equipmentId, startDate, endDate, format = "json" } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const telemetry = equipmentId
        ? await storage.getTelemetryByEquipment(equipmentId as string, start, end, orgId as string)
        : await storage.getTelemetryByDateRange(start, end, orgId as string);

      const exportData = {
        format: "Telemetry Export v1.0",
        compatibility: ["Azure IoT", "AWS IoT", "Google Cloud IoT", "InfluxDB", "TimescaleDB"],
        exportedAt: new Date().toISOString(),
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        recordCount: telemetry.length,
        telemetry: telemetry.map((t) => ({
          timestamp: t.ts,
          equipmentId: t.equipmentId,
          vesselId: t.vesselId,
          sensorType: t.sensorType,
          value: t.value,
          unit: t.unit,
          status: t.status,
          threshold: t.threshold,
        })),
      };

      if (format === "csv") {
        const csvData = [
          "timestamp,equipmentId,vesselId,sensorType,value,unit,status,threshold",
          ...telemetry.map(
            (t) =>
              `${t.ts},${t.equipmentId},${t.vesselId || ""},${t.sensorType},${t.value},${t.unit},${t.status},${t.threshold || ""}`
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="telemetry-export-${Date.now()}.csv"`);
        return res.send(csvData);
      }

      res.json(exportData);
    })
  );

  app.get("/api/analytics/export/predictions",
    withErrorHandling("export predictions", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, format = "json" } = req.query;
      if (!orgId) {
        return res.status(400).json({ message: "orgId is required" });
      }

      const predictions = await storage.getFailurePredictions(orgId as string);

      const exportData = {
        format: "Predictive Maintenance Export v1.0",
        compatibility: ["IBM Maximo", "SAP PM", "Oracle EAM", "Infor EAM"],
        exportedAt: new Date().toISOString(),
        predictions: predictions.map((p) => ({
          id: p.id,
          equipmentId: p.equipmentId,
          failureProbability: p.failureProbability,
          predictedFailureDate: p.predictedFailureDate,
          remainingUsefulLife: p.remainingUsefulLife,
          healthIndex: p.healthIndex,
          riskLevel: p.riskLevel,
          modelId: p.modelId,
          recommendations: p.recommendations,
          createdAt: p.createdAt,
        })),
      };

      if (format === "csv") {
        const csvData = [
          "id,equipmentId,failureProbability,predictedFailureDate,remainingUsefulLife,healthIndex,riskLevel,modelId,createdAt",
          ...predictions.map(
            (p) =>
              `${p.id},${p.equipmentId},${p.failureProbability},${p.predictedFailureDate || ""},${p.remainingUsefulLife || ""},${p.healthIndex},${p.riskLevel},${p.modelId || ""},${p.createdAt}`
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="predictions-export-${Date.now()}.csv"`);
        return res.send(csvData);
      }

      res.json(exportData);
    })
  );
}

```

### `server/domains/ml-pipeline/routes.ts` (386 lines)

```ts
import type { Express, Request, Response } from "express";
import type { IStorage } from "../../storage";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface AuthenticatedRequest extends Request {
  orgId?: string;
}

interface MlPipelineRoutesConfig {
  storage: IStorage;
  generalApiRateLimit: RateLimitRequestHandler;
}

export function registerMlPipelineRoutes(
  app: Express,
  config: MlPipelineRoutesConfig
): void {
  const { storage, generalApiRateLimit } = config;

  logger.info("MLPipelineRoutes", "Registering ML pipeline API endpoints");

  // ============================================================================
  // Acoustic Monitoring Routes
  // ============================================================================

  app.post("/api/acoustic/analyze", generalApiRateLimit,
    withErrorHandling("analyze acoustic data", async (req: Request, res: Response) => {
      const { acousticData, sampleRate, equipmentType, rpm } = req.body;

      if (!Array.isArray(acousticData) || typeof sampleRate !== "number") {
        return res.status(400).json({
          error: "Invalid input. Requires acousticData (array) and sampleRate (number)",
        });
      }

      const { performAcousticAnalysis } = await import("../../acoustic-monitoring");
      const analysis = performAcousticAnalysis(acousticData, sampleRate, equipmentType, rpm);

      res.json(analysis);
    })
  );

  app.post("/api/acoustic/features", generalApiRateLimit,
    withErrorHandling("extract acoustic features", async (req: Request, res: Response) => {
      const { acousticData, sampleRate, rpm } = req.body;

      if (!Array.isArray(acousticData) || typeof sampleRate !== "number") {
        return res.status(400).json({
          error: "Invalid input. Requires acousticData (array) and sampleRate (number)",
        });
      }

      const { analyzeAcoustic } = await import("../../acoustic-monitoring");
      const features = analyzeAcoustic(acousticData, sampleRate, rpm);

      res.json(features);
    })
  );

  // ============================================================================
  // ML Training Routes
  // ============================================================================

  app.post("/api/ml/train/lstm", generalApiRateLimit,
    withErrorHandling("train LSTM model", async (req: AuthenticatedRequest, res: Response) => {
      const { orgId = req.orgId!, equipmentType, lstmConfig } = req.body;

      const { trainLSTMForFailurePrediction } = await import("../../ml-training-pipeline");

      const config = {
        orgId,
        equipmentType,
        modelType: "lstm" as const,
        targetMetric: "failure_prediction" as const,
        lstmConfig: lstmConfig || {
          sequenceLength: 7,
          featureCount: 0,
          lstmUnits: 32,
          dropoutRate: 0.2,
          learningRate: 0.001,
          epochs: 20,
          batchSize: 64,
          useEarlyStopping: true,
          earlyStoppingPatience: 5,
          verbose: true,
        },
      };

      const result = await trainLSTMForFailurePrediction(storage, config);
      res.json(result);
    })
  );

  app.post("/api/ml/train/random-forest", generalApiRateLimit,
    withErrorHandling("train Random Forest model", async (req: AuthenticatedRequest, res: Response) => {
      const { orgId = req.orgId!, equipmentType, rfConfig } = req.body;

      const { trainRFForHealthClassification } = await import("../../ml-training-pipeline");

      const config = {
        orgId,
        equipmentType,
        modelType: "random_forest" as const,
        targetMetric: "health_classification" as const,
        rfConfig: rfConfig || {
          numTrees: 50,
          maxDepth: 10,
          minSamplesSplit: 5,
          maxFeatures: 8,
          bootstrapSampleRatio: 0.8,
        },
      };

      const result = await trainRFForHealthClassification(storage, config);
      res.json(result);
    })
  );

  app.post("/api/ml/train/xgboost", generalApiRateLimit,
    withErrorHandling("train XGBoost model", async (req: AuthenticatedRequest, res: Response) => {
      const { orgId = req.orgId!, equipmentType, xgboostConfig } = req.body;

      const { trainXGBoostForHealthClassification } = await import("../../ml-training-pipeline");

      const config = {
        orgId,
        equipmentType,
        modelType: "xgboost" as const,
        targetMetric: "health_classification" as const,
        xgboostConfig: xgboostConfig || {
          maxDepth: 6,
          learningRate: 0.1,
          numRounds: 100,
          objective: "binary:logistic",
          eval_metric: "logloss",
        },
      };

      const result = await trainXGBoostForHealthClassification(storage, config);
      res.json(result);
    })
  );

  app.post("/api/ml/train/all", generalApiRateLimit,
    withErrorHandling("batch train all models", async (req: AuthenticatedRequest, res: Response) => {
      const { orgId = req.orgId! } = req.body;

      const { retrainAllModels } = await import("../../ml-training-pipeline");
      const results = await retrainAllModels(storage, orgId);

      res.json({
        message: `Successfully trained ${results.length} models`,
        results,
      });
    })
  );

  // ============================================================================
  // ML Prediction Routes
  // ============================================================================

  /**
   * POST /api/ml/predict/failure - Production-ready equipment failure prediction
   *
   * Features:
   * - Circuit breaker protection (prevents cascading failures)
   * - ML observability logging (success/failure metrics, latency tracking)
   * - Multiple prediction methods with controlled rollout via feature flags
   * - Automatic prediction storage in database
   *
   * Method Options:
   * - 'ensemble' (recommended): 90-95% accuracy target, combines LSTM + XGBoost + Random Forest
   * - 'lstm': Time-series neural network for temporal patterns
   * - 'random_forest': Classification model for health status
   * - 'hybrid' (default): Weighted averaging of all available models
   */
  app.post("/api/ml/predict/failure", generalApiRateLimit,
    withErrorHandling("predict equipment failure", async (req: AuthenticatedRequest, res: Response) => {
      const { equipmentId, orgId = req.orgId!, method = "hybrid" } = req.body;

      if (!equipmentId) {
        return res.status(400).json({ error: "equipmentId is required" });
      }

      const {
        predictFailureWithLSTM,
        predictHealthWithRandomForest,
        predictWithHybridModel,
        predictWithEnsemble,
        storePrediction,
      } = await import("../../ml-prediction-service");

      let prediction = null;

      if (method === "lstm") {
        prediction = await predictFailureWithLSTM(storage, equipmentId, orgId);
      } else if (method === "random_forest") {
        prediction = await predictHealthWithRandomForest(storage, equipmentId, orgId);
      } else if (method === "ensemble") {
        prediction = await predictWithEnsemble(storage, equipmentId, orgId);
      } else {
        prediction = await predictWithHybridModel(storage, equipmentId, orgId);
      }

      if (!prediction) {
        return res.status(404).json({
          error: "No ML models available for prediction",
          hint: "Train models first using /api/ml/train endpoints",
        });
      }

      await storePrediction(storage, equipmentId, orgId, prediction);
      res.json(prediction);
    })
  );

  // ============================================================================
  // ML Retraining & Training Window Routes
  // ============================================================================

  app.get("/api/ml/retraining-triggers", generalApiRateLimit,
    withErrorHandling("evaluate retraining triggers", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;

      const { evaluateRetrainingTriggers } = await import("../../ml-retraining-service");
      const triggers = await evaluateRetrainingTriggers(storage, orgId);

      res.json(triggers);
    })
  );

  app.get("/api/ml/training-window/:equipmentType?", generalApiRateLimit,
    withErrorHandling("determine training window", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;
      const equipmentType = req.params.equipmentType;

      const { determineOptimalTrainingWindow } = await import("../../adaptive-training-window");
      const windowConfig = await determineOptimalTrainingWindow(storage, orgId, equipmentType);

      res.json(windowConfig);
    })
  );

  // ============================================================================
  // ML Health & Metrics Routes
  // ============================================================================

  app.get("/api/ml/health",
    withErrorHandling("check ML health", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId!;

      const {
        lstmCircuitBreaker,
        randomForestCircuitBreaker,
        xgboostCircuitBreaker,
        ensembleCircuitBreaker,
      } = await import("../../ml-circuit-breaker");

      const { getModelRegistry } = await import("../../ml-model-registry");
      const registry = getModelRegistry();

      const circuitBreakers = {
        lstm: {
          state: lstmCircuitBreaker.state,
          failures: lstmCircuitBreaker.failureCount,
          lastFailure: lstmCircuitBreaker.lastFailureTime,
        },
        randomForest: {
          state: randomForestCircuitBreaker.state,
          failures: randomForestCircuitBreaker.failureCount,
          lastFailure: randomForestCircuitBreaker.lastFailureTime,
        },
        xgboost: {
          state: xgboostCircuitBreaker.state,
          failures: xgboostCircuitBreaker.failureCount,
          lastFailure: xgboostCircuitBreaker.lastFailureTime,
        },
        ensemble: {
          state: ensembleCircuitBreaker.state,
          failures: ensembleCircuitBreaker.failureCount,
          lastFailure: ensembleCircuitBreaker.lastFailureTime,
        },
      };

      const cacheStats = registry.getCacheStats();
      const cachedModels = registry.listCachedModels();

      const mlModels = await storage.getMlModels(orgId);
      const modelCounts = {
        lstm: mlModels.filter((m) => m.modelType === "lstm").length,
        randomForest: mlModels.filter((m) => m.modelType === "random_forest").length,
        xgboost: mlModels.filter((m) => m.modelType === "xgboost").length,
      };

      const allCircuitsClosed = Object.values(circuitBreakers).every(
        (cb) => cb.state.toUpperCase() === "CLOSED"
      );
      const hasModels = mlModels.length > 0;
      const status = allCircuitsClosed && hasModels ? "healthy" : "degraded";

      res.json({
        status,
        timestamp: new Date().toISOString(),
        circuitBreakers,
        modelRegistry: {
          cacheStats,
          cachedModelsCount: cachedModels.length,
        },
        availableModels: modelCounts,
        totalModels: mlModels.length,
      });
    })
  );

  app.get("/api/ml/metrics",
    withErrorHandling("retrieve ML metrics", async (req: Request, res: Response) => {
      const { getMetrics, getMetricsContentType } = await import("../../ml-prometheus-metrics");
      const metrics = await getMetrics();

      res.set("Content-Type", getMetricsContentType());
      res.send(metrics);
    })
  );

  // ============================================================================
  // RUL (Remaining Useful Life) Analysis Routes
  // ============================================================================

  app.get("/api/rul/models", generalApiRateLimit,
    withErrorHandling("get RUL models", async (req: AuthenticatedRequest, res: Response) => {
      const { componentClass, orgId = req.orgId! } = req.query;
      const models = await storage.getRulModels(componentClass as string, orgId as string);
      res.json(models);
    })
  );

  app.post("/api/rul/fit", generalApiRateLimit,
    withErrorHandling("fit RUL model", async (req: AuthenticatedRequest, res: Response) => {
      const { modelId, componentClass, failureTimes } = req.body;
      const orgId = req.orgId!;

      const { fitWeibullComprehensive } = await import("../../rul");
      const fitResult = fitWeibullComprehensive(failureTimes, modelId, componentClass);

      const model = await storage.createRulModel({
        orgId,
        modelId: fitResult.modelId,
        componentClass: fitResult.componentClass,
        shapeK: fitResult.shapeK,
        scaleLambda: fitResult.scaleLambda,
        confidenceLo: fitResult.confidenceInterval.lower,
        confidenceHi: fitResult.confidenceInterval.upper,
        trainingData: fitResult.trainingData,
        validationMetrics: fitResult.validationMetrics,
        isActive: true,
        createdAt: new Date(),
      });

      res.json({ fitResult, storedModel: model });
    })
  );

  app.post("/api/rul/predict", generalApiRateLimit,
    withErrorHandling("predict RUL", async (req: AuthenticatedRequest, res: Response) => {
      const { modelId, currentAge, quantile = 0.5 } = req.body;
      const orgId = req.orgId!;

      const model = await storage.getRulModel(modelId, orgId);
      if (!model) {
        return sendNotFound(res, "RUL model");
      }

      const { predictRUL } = await import("../../rul");
      const prediction = predictRUL(currentAge, model.shapeK, model.scaleLambda, quantile);

      res.json({
        prediction,
        model: { modelId: model.modelId, componentClass: model.componentClass },
      });
    })
  );

  logger.info("MLPipelineRoutes", "Registered (acoustic: 2, ml-training: 4, ml-prediction: 1, ml-health: 4, rul: 3)");
}

```

### `server/domains/insights/routes.ts` (164 lines)

```ts
import type { Express, RequestHandler } from "express";
import type { IStorage } from "../../storage";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

interface InsightsRouteDependencies {
  storage: IStorage;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  reportGenerationRateLimit: RequestHandler;
}

export function registerInsightsV2Routes(
  app: Express,
  deps: InsightsRouteDependencies
): void {
  const { storage, generalApiRateLimit, reportGenerationRateLimit } = deps;

  logger.info("InsightsV2Routes", "Registering insights V2 API endpoints");

  // Get all insight snapshots (with optional filtering)
  app.get("/api/insights/snapshots", generalApiRateLimit,
    withErrorHandling("fetch insight snapshots", async (req, res) => {
      const { orgId, scope } = req.query;
      const snapshots = await storage.getInsightSnapshots(
        orgId as string | undefined,
        scope as string | undefined
      );
      res.json(snapshots);
    })
  );

  // Get latest insight snapshot for specific scope
  app.get("/api/insights/snapshots/latest", generalApiRateLimit,
    withErrorHandling("fetch latest insight snapshot", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, scope = "fleet" } = req.query;
      const snapshot = await storage.getLatestInsightSnapshot(orgId as string, scope as string);

      if (!snapshot) {
        return sendNotFound(res, `Insight snapshots for org: ${orgId}, scope: ${scope}`);
      }

      res.json(snapshot);
    })
  );

  // Manually trigger insights generation (for testing or immediate updates)
  app.post("/api/insights/generate", reportGenerationRateLimit,
    withErrorHandling("trigger insights generation", async (req, res) => {
      const { orgId = (req as AuthenticatedRequest).orgId, scope = "fleet" } = req.body;

      const { triggerInsightsGeneration } = await import("../../insights-scheduler");
      const jobId = await triggerInsightsGeneration(orgId, scope);

      res.status(202).json({
        message: "Insights generation job scheduled successfully",
        jobId,
        orgId,
        scope,
        estimatedCompletionTime: "1-2 minutes",
      });
    })
  );

  // Get insight generation job statistics
  app.get("/api/insights/jobs/stats", generalApiRateLimit,
    withErrorHandling("get insights job statistics", async (req, res) => {
      const { getInsightsJobStats } = await import("../../insights-scheduler");
      const stats = getInsightsJobStats();
      res.json(stats);
    })
  );

  // Get insight reports (structured analysis results)
  app.get("/api/insights/reports", generalApiRateLimit,
    withErrorHandling("fetch insight reports", async (req, res) => {
      const { orgId, scope } = req.query;
      const reports = await storage.getInsightReports(
        orgId as string | undefined,
        scope as string | undefined
      );
      res.json(reports);
    })
  );

  // GET /api/insights/v2/equipment/:id - Technician-friendly insight for specific equipment
  app.get("/api/insights/v2/equipment/:id", generalApiRateLimit,
    withErrorHandling("generate technician insight", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;

      if (!orgId) {
        return res.status(400).json({
          message: "Organization ID required",
        });
      }

      const { generateTechnicianInsight } = await import("../../insights-engine");
      const insight = await generateTechnicianInsight(id, orgId);

      if (!insight) {
        return sendNotFound(res, "Equipment or prediction");
      }

      res.json(insight);
    })
  );

  // GET /api/insights/v2/fleet-overview - Technician-friendly insights for all equipment
  app.get("/api/insights/v2/fleet-overview", generalApiRateLimit,
    withErrorHandling("generate fleet technician insights", async (req, res) => {
      const startTime = Date.now();

      const { logInfo, logError, createRequestContext } = await import("../../structured-logging");
      const { generateFleetTechnicianInsights } = await import("../../insights-engine");
      const { fleetOverviewRequests, fleetOverviewResponseTime } = await import(
        "../../ml-prometheus-metrics"
      );

      const { vesselId } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;
      const requestContext = createRequestContext(req, { orgId });

      if (!orgId) {
        logError("Fleet overview request missing orgId", requestContext);
        fleetOverviewRequests.inc({ org_id: "unknown", status: "error" });
        return res.status(400).json({
          message: "Organization ID required",
        });
      }

      logInfo("Generating fleet technician insights", {
        ...requestContext,
        vesselId: vesselId || "all",
      });

      const fleetInsights = await generateFleetTechnicianInsights(
        orgId,
        vesselId as string | undefined
      );

      const duration = Date.now() - startTime;
      fleetOverviewRequests.inc({ org_id: orgId, status: "success" });
      fleetOverviewResponseTime.observe({ org_id: orgId }, duration);

      logInfo("Fleet technician insights generated successfully", {
        ...requestContext,
        vesselCount: fleetInsights.length,
        totalEquipment: fleetInsights.reduce((sum, v) => sum + v.insights.length, 0),
        durationMs: duration,
      });

      res.json({
        orgId,
        vesselId: vesselId || null,
        vessels: fleetInsights,
        generatedAt: new Date().toISOString(),
      });
    })
  );

  logger.info("InsightsV2Routes", "Registered (snapshots: 2, reports: 1, jobs: 1, v2: 2, generate: 1)");
}

```

### `server/routes/insights-routes.ts` (311 lines)

```ts
import type { Express } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { actionableInsights, equipment } from '@shared/schema-runtime';
import { InsightEngine } from '../core/insights/insightEngine';
import { logger } from '../utils/logger.js';

const acknowledgeInsightSchema = z.object({
  orgId: z.string().optional().default("default-org"),
  acknowledgedBy: z.string(),
});

const resolveInsightSchema = z.object({
  orgId: z.string().optional().default("default-org"),
  resolvedBy: z.string(),
  resolutionNotes: z.string().optional(),
  workOrderId: z.string().optional(),
});

export function registerInsightsRoutes(app: Express) {
  app.get('/api/insights', async (req, res) => {
    try {
      const { vesselId, equipmentId, severity, resolved, acknowledged } = req.query;

      let query = db
        .select({
          insight: actionableInsights,
          equipment: {
            id: equipment.id,
            name: equipment.name,
            type: equipment.type,
            vesselId: equipment.vesselId,
          },
        })
        .from(actionableInsights)
        .leftJoin(equipment, eq(actionableInsights.equipmentId, equipment.id))
        .$dynamic();

      if (vesselId) {
        query = query.where(eq(actionableInsights.vesselId, vesselId as string));
      }

      if (equipmentId) {
        query = query.where(eq(actionableInsights.equipmentId, equipmentId as string));
      }

      if (severity) {
        query = query.where(eq(actionableInsights.severity, severity as string));
      }

      if (resolved !== undefined) {
        query = query.where(eq(actionableInsights.resolved, resolved === 'true'));
      }

      if (acknowledged !== undefined) {
        query = query.where(eq(actionableInsights.acknowledged, acknowledged === 'true'));
      }

      const results = await query.orderBy(sql`${actionableInsights.createdAt} DESC`);

      const insights = results.map((r) => ({
        ...r.insight,
        equipment: r.equipment,
        supportingSignals: r.insight.supportingSignals
          ? JSON.parse(r.insight.supportingSignals)
          : null,
        relatedProcedures: r.insight.relatedProcedures
          ? JSON.parse(r.insight.relatedProcedures)
          : null,
      }));

      res.json(insights);
    } catch (error) {
      logger.error('Failed to fetch insights', { error });
      res.status(500).json({ error: 'Failed to fetch insights' });
    }
  });

  // Note: These specific routes MUST be registered BEFORE the /:id catch-all route
  // to prevent "snapshots" from being treated as an ID parameter
  app.get('/api/insights/snapshots', async (req, res) => {
    try {
      const { scope } = req.query;
      // Query database directly since adapter method may not exist
      const { insightSnapshots } = await import('@shared/schema-runtime');
      let query = db.select().from(insightSnapshots).$dynamic();
      if (scope) {
        query = query.where(eq(insightSnapshots.scope, scope as string));
      }
      const snapshots = await query.orderBy(sql`${insightSnapshots.createdAt} DESC`).limit(100);
      res.json(snapshots);
    } catch (error) {
      logger.error('Failed to fetch insight snapshots', { error });
      res.status(500).json({ error: 'Failed to fetch insight snapshots' });
    }
  });

  app.get('/api/insights/snapshots/latest', async (req, res) => {
    try {
      const { scope = 'fleet' } = req.query;
      // Query database directly
      const { insightSnapshots } = await import('@shared/schema-runtime');
      const [snapshot] = await db.select().from(insightSnapshots)
        .where(eq(insightSnapshots.scope, scope as string))
        .orderBy(sql`${insightSnapshots.createdAt} DESC`)
        .limit(1);
      // Return null if no snapshot found - frontend handles empty state
      res.json(snapshot || null);
    } catch (error) {
      logger.error('Failed to fetch latest insight snapshot', { error });
      res.status(500).json({ error: 'Failed to fetch latest insight snapshot' });
    }
  });

  app.get('/api/insights/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const [result] = await db
        .select({
          insight: actionableInsights,
          equipment: {
            id: equipment.id,
            name: equipment.name,
            type: equipment.type,
            vesselId: equipment.vesselId,
          },
        })
        .from(actionableInsights)
        .leftJoin(equipment, eq(actionableInsights.equipmentId, equipment.id))
        .where(eq(actionableInsights.id, id))
        .limit(1);

      if (!result) {
        return res.status(403).json({ error: 'Insight not found or access denied' });
      }

      const insight = {
        ...result.insight,
        equipment: result.equipment,
        supportingSignals: result.insight.supportingSignals
          ? JSON.parse(result.insight.supportingSignals)
          : null,
        relatedProcedures: result.insight.relatedProcedures
          ? JSON.parse(result.insight.relatedProcedures)
          : null,
      };

      res.json(insight);
    } catch (error) {
      logger.error('Failed to fetch insight', { error });
      res.status(500).json({ error: 'Failed to fetch insight' });
    }
  });

  app.post('/api/insights/evaluate/:equipmentId', async (req, res) => {
    try {
      const { equipmentId } = req.params;
      const { vesselId } = req.body;
      const orgId = req.body.orgId || (req.headers["x-org-id"] as string) || "default-org";

      // Verify equipment exists
      const [equipmentRecord] = await db
        .select()
        .from(equipment)
        .where(eq(equipment.id, equipmentId))
        .limit(1);

      if (!equipmentRecord) {
        return res.status(404).json({ error: 'Equipment not found' });
      }

      const insightIds = await InsightEngine.evaluateAndStoreInsights(
        equipmentId,
        orgId,
        vesselId
      );

      res.json({
        success: true,
        equipmentId,
        insightsCreated: insightIds.length,
        insightIds,
      });
    } catch (error) {
      logger.error('Failed to evaluate equipment', { error });
      res.status(500).json({ error: 'Failed to evaluate equipment' });
    }
  });

  app.patch('/api/insights/:id/acknowledge', async (req, res) => {
    try {
      const { id } = req.params;
      const body = acknowledgeInsightSchema.parse(req.body);

      const [updated] = await db
        .update(actionableInsights)
        .set({
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: body.acknowledgedBy,
        })
        .where(eq(actionableInsights.id, id))
        .returning();

      if (!updated) {
        return res.status(403).json({ error: 'Insight not found or access denied' });
      }

      res.json(updated);
    } catch (error) {
      logger.error('Failed to acknowledge insight', { error });
      res.status(500).json({ error: 'Failed to acknowledge insight' });
    }
  });

  app.patch('/api/insights/:id/resolve', async (req, res) => {
    try {
      const { id } = req.params;
      const body = resolveInsightSchema.parse(req.body);

      const [updated] = await db
        .update(actionableInsights)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: body.resolvedBy,
          resolutionNotes: body.resolutionNotes || null,
          workOrderId: body.workOrderId || null,
        })
        .where(eq(actionableInsights.id, id))
        .returning();

      if (!updated) {
        return res.status(403).json({ error: 'Insight not found or access denied' });
      }

      res.json(updated);
    } catch (error) {
      logger.error('Failed to resolve insight', { error });
      res.status(500).json({ error: 'Failed to resolve insight' });
    }
  });

  app.get('/api/insights/stats/summary', async (req, res) => {
    try {
      const { vesselId } = req.query;

      let baseQuery = db
        .select({
          severity: actionableInsights.severity,
          resolved: actionableInsights.resolved,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(actionableInsights)
        .$dynamic();

      if (vesselId) {
        baseQuery = baseQuery.where(eq(actionableInsights.vesselId, vesselId as string));
      }

      const stats = await baseQuery
        .groupBy(actionableInsights.severity, actionableInsights.resolved);

      const summary = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        resolved: 0,
        unresolved: 0,
      };

      stats.forEach((stat) => {
        const count = Number(stat.count);
        summary.total += count;

        if (stat.severity === 'critical') {
          summary.critical += count;
        }

        if (stat.severity === 'high') {
          summary.high += count;
        }

        if (stat.severity === 'medium') {
          summary.medium += count;
        }

        if (stat.severity === 'low') {
          summary.low += count;
        }

        if (stat.resolved) {
          summary.resolved += count;
        } else {
          summary.unresolved += count;
        }
      });

      res.json(summary);
    } catch (error) {
      logger.error('Failed to fetch insight stats', { error });
      res.status(500).json({ error: 'Failed to fetch insight stats' });
    }
  });

  logger.info('Actionable Insights API routes registered');
}

```

### `server/domains/llm/routes/index.ts` (34 lines)

```ts
/**
 * LLM Routes Index
 * 
 * Register all LLM API route modules.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../../storage";
import { registerLlmAnalysisRoutes } from "./llm-analysis.js";
import { registerHealthReportRoutes } from "./health-report.js";
import { registerMaintenanceReportRoutes } from "./maintenance-report.js";
import { registerComplianceReportRoutes } from "./compliance-report.js";
import { registerFleetSummaryRoutes } from "./fleet-summary.js";
import { logger } from "../../../utils/logger.js";

export function registerLlmRoutesModular(
  app: Express,
  storage: IStorage,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
    reportGenerationRateLimit: RateLimitRequestHandler;
  }
) {
  logger.info("LLMRoutes", "Registering LLM API endpoints");

  registerLlmAnalysisRoutes(app, storage, rateLimiters);
  registerHealthReportRoutes(app, storage, rateLimiters);
  registerMaintenanceReportRoutes(app, storage, rateLimiters);
  registerComplianceReportRoutes(app, storage, rateLimiters);
  registerFleetSummaryRoutes(app, storage, rateLimiters);

  logger.info("LLMRoutes", "Registered (llm: 5, reports: 5)");
}

```

### `server/domains/llm/routes/llm-analysis.ts` (238 lines)

```ts
/**
 * LLM Analysis Routes
 * 
 * Equipment and fleet analysis endpoints using AI.
 */

import { Express } from "express";
import { z } from "zod";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../../storage";
import { withErrorHandling } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";

export function registerLlmAnalysisRoutes(
  app: Express,
  storage: IStorage,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
    reportGenerationRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit, reportGenerationRateLimit } = rateLimiters;

  app.post("/api/llm/equipment/analyze", reportGenerationRateLimit,
    withErrorHandling("analyze equipment health", async (req, res) => {
      const { equipmentId, sensorType, hours = 24, equipmentType } = req.body;

      if (!equipmentId || !sensorType) {
        return res.status(400).json({
          message: "Equipment ID and sensor type are required",
        });
      }

      const { analyzeEquipmentHealth } = await import("../../../openai");
      const telemetryData = await storage.getTelemetryHistory(equipmentId, sensorType, hours);

      if (telemetryData.length === 0) {
        return res.status(404).json({
          message: "No telemetry data found for equipment",
          equipmentId,
          sensorType,
        });
      }

      const analysis = await analyzeEquipmentHealth(telemetryData, equipmentId, equipmentType);
      res.json(analysis);
    })
  );

  app.post("/api/llm/fleet/analyze", reportGenerationRateLimit,
    withErrorHandling("analyze fleet health", async (req, res) => {
      const { hours = 24 } = req.body;
      const { analyzeFleetHealth } = await import("../../../openai");

      const [equipmentHealth, telemetryTrends] = await Promise.all([
        storage.getEquipmentHealth(),
        storage.getTelemetryTrends(undefined, hours),
      ]);

      if (equipmentHealth.length === 0) {
        return res.status(404).json({
          message: "No equipment health data available for fleet analysis",
        });
      }

      const fleetAnalysis = await analyzeFleetHealth(equipmentHealth, telemetryTrends, storage);
      res.json(fleetAnalysis);
    })
  );

  app.post("/api/llm/maintenance/recommend", generalApiRateLimit,
    withErrorHandling("generate maintenance recommendations", async (req, res) => {
      const { alertType, equipmentId, sensorData, equipmentType } = req.body;

      if (!alertType || !equipmentId) {
        return res.status(400).json({
          message: "Alert type and equipment ID are required",
        });
      }

      const { generateMaintenanceRecommendations } = await import("../../../openai");
      const recommendations = await generateMaintenanceRecommendations(
        alertType,
        equipmentId,
        sensorData,
        equipmentType
      );

      res.json(recommendations);
    })
  );

  app.get("/api/llm/equipment/:equipmentId/insights", generalApiRateLimit,
    withErrorHandling("generate equipment insights", async (req, res) => {
      const { equipmentId } = req.params;
      const { includeRecommendations = "true", hours = "24" } = req.query;

      const { analyzeEquipmentHealth, generateMaintenanceRecommendations } = await import(
        "../../../openai"
      );

      const [device, equipmentHealth, alerts, telemetryTrends, pdmScore] = await Promise.all([
        storage.getDevice(equipmentId),
        storage.getEquipmentHealth(),
        storage.getAlertNotifications(),
        storage.getTelemetryTrends(equipmentId, Number.parseInt(hours as string)),
        storage.getLatestPdmScore(equipmentId),
      ]);

      const recentAlerts = alerts.filter((alert) => alert.equipmentId === equipmentId).slice(0, 10);
      const equipmentHealthData = equipmentHealth.find((h) => h.equipmentId === equipmentId);

      if (telemetryTrends.length === 0) {
        return res.status(404).json({
          message: "No telemetry data found for equipment",
          equipmentId,
        });
      }

      const analysis = await analyzeEquipmentHealth(telemetryTrends, equipmentId, device?.type);

      let alertRecommendations: any[] = [];
      if (includeRecommendations === "true" && recentAlerts.length > 0) {
        try {
          const combinedAlertContext = recentAlerts.slice(0, 3).map((alert) => ({
            alertType: alert.alertType,
            sensorType: alert.sensorType,
            severity: alert.severity || "medium",
            timestamp: alert.createdAt,
          }));

          const combinedRecommendation = await generateMaintenanceRecommendations(
            "combined_analysis",
            equipmentId,
            { recentAlerts: combinedAlertContext },
            device?.type
          );
          alertRecommendations = [combinedRecommendation];
        } catch (error) {
          logger.warn("LlmAnalysis", "Failed to generate combined recommendations, skipping", error);
          alertRecommendations = [];
        }
      }

      res.json({
        equipment: {
          device,
          health: equipmentHealthData,
          pdmScore,
        },
        analysis,
        alerts: recentAlerts,
        alertRecommendations,
        timestamp: new Date().toISOString(),
      });
    })
  );

  app.get("/api/llm/vessel/:vesselId/intelligence", generalApiRateLimit,
    withErrorHandling("load vessel intelligence", async (req, res) => {
      const paramsSchema = z.object({
        vesselId: z.string().uuid("Invalid vessel ID format"),
      });
      const querySchema = z.object({
        lookbackDays: z.string().regex(/^\d+$/).optional().default("365"),
      });

      const { vesselId } = paramsSchema.parse(req.params);
      const { lookbackDays } = querySchema.parse(req.query);

      const vessel = await storage.getVessel(vesselId);
      if (!vessel) {
        return res.status(404).json({
          success: false,
          error: "Vessel not found",
        });
      }

      const [equipment, alerts, telemetry, pdmScores] = await Promise.all([
        storage.getEquipmentHealth().then((all) => all.filter((e) => e.vessel === vesselId)),
        storage
          .getAlertNotifications()
          .then((all) => all.filter((a) => a.vesselId === vesselId).slice(0, 20)),
        storage.getLatestTelemetry(vesselId).catch(() => []),
        storage.getPdmScores().then((scores) => scores.filter((s) => s.vessel === vesselId)),
      ]);

      const intelligence = {
        vesselName: vessel.name,
        vesselId: vessel.id,
        vesselType: vessel.type,
        operationalStatus: vessel.operational_status || "active",
        totalEquipment: equipment.length,
        healthyEquipment: equipment.filter((e) => (e.healthIndex || 0) > 70).length,
        atRiskEquipment: equipment.filter((e) => {
          const health = e.healthIndex || 0;
          return health >= 30 && health <= 70;
        }).length,
        criticalEquipment: equipment.filter((e) => (e.healthIndex || 0) < 30).length,
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
        unresolvedAlerts: alerts.filter((a) => a.status !== "resolved").length,
        averagePdmScore:
          pdmScores.length > 0
            ? pdmScores.reduce((sum, s) => sum + (s.anomalyScore || 0), 0) / pdmScores.length
            : null,
        failurePredictions: pdmScores.filter((s) => (s.failureProbability || 0) > 0.5).length,
        recentTelemetryPoints: telemetry.length,
        dataFreshness:
          telemetry.length > 0 && telemetry[0].timestamp
            ? new Date(telemetry[0].timestamp).toISOString()
            : null,
        topIssues: alerts
          .filter((a) => a.status !== "resolved")
          .sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return (
              (severityOrder[a.severity as keyof typeof severityOrder] || 4) -
              (severityOrder[b.severity as keyof typeof severityOrder] || 4)
            );
          })
          .slice(0, 5)
          .map((a) => ({
            alertType: a.alertType,
            severity: a.severity,
            equipmentId: a.equipmentId,
            createdAt: a.createdAt,
          })),
        analysisTimestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        intelligence,
      });
    })
  );
}

```

### `server/domains/llm/routes/fleet-summary.ts` (90 lines)

```ts
/**
 * Fleet Summary Report Routes
 * 
 * Fleet summary report generation endpoint.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../../storage";
import { analyzeFleetHealth } from "../../../openai";
import { withErrorHandling } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";

export function registerFleetSummaryRoutes(
  app: Express,
  storage: IStorage,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post("/api/report/fleet-summary", generalApiRateLimit,
    withErrorHandling("generate fleet summary", async (req, res) => {
      const { lookbackHours = 168 } = req.body;

      const [equipmentHealth, telemetryData, workOrders, pdmScores] = await Promise.all([
        storage.getEquipmentHealth(),
        storage.getTelemetryTrends("", lookbackHours),
        storage.getWorkOrders(),
        storage.getPdmScores(),
      ]);

      let fleetAnalysis: any;
      try {
        const analysisPromise = analyzeFleetHealth(equipmentHealth, telemetryData);
        fleetAnalysis = await Promise.race([
          analysisPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI analysis timeout")), 10000)
          ),
        ]);
      } catch (error) {
        logger.warn("FleetSummary", "Fleet analysis failed, using fallback", error);
        fleetAnalysis = {
          totalEquipment: equipmentHealth.length,
          healthyEquipment: equipmentHealth.filter((eq) => eq.healthIndex > 70).length,
          equipmentAtRisk: equipmentHealth.filter(
            (eq) => eq.healthIndex >= 30 && eq.healthIndex <= 70
          ).length,
          criticalEquipment: equipmentHealth.filter((eq) => eq.healthIndex < 30).length,
          topRecommendations: [
            "Review equipment with declining health scores",
            "Schedule preventive maintenance for at-risk equipment",
            "Monitor critical systems for immediate attention",
          ],
          costEstimate: equipmentHealth.length * 3000,
          summary: "Fleet summary generated using fallback analysis",
        };
      }

      const criticalWorkOrders = workOrders.filter(
        (wo) => wo.priority === 1 && wo.status === "open"
      );
      const avgHealthIndex =
        equipmentHealth.length > 0
          ? equipmentHealth.reduce((sum, eq) => sum + eq.healthIndex, 0) / equipmentHealth.length
          : 0;

      res.json({
        metadata: {
          title: "Fleet Summary Report",
          generatedAt: new Date().toISOString(),
          reportType: "fleet-summary",
          lookbackHours,
        },
        sections: {
          summary: {
            ...fleetAnalysis,
            avgHealthIndex: Math.round(avgHealthIndex),
            criticalWorkOrders: criticalWorkOrders.length,
          },
          equipment: equipmentHealth,
          criticalIssues: criticalWorkOrders,
          recentPdmScores: pdmScores.slice(0, 20),
        },
      });
    })
  );
}

```

### `server/domains/llm/routes/health-report.ts` (111 lines)

```ts
/**
 * Health Report Routes
 * 
 * Fleet health report generation endpoint.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../../storage";
import { analyzeFleetHealth } from "../../../openai";
import { withErrorHandling } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";

export function registerHealthReportRoutes(
  app: Express,
  storage: IStorage,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post("/api/report/health", generalApiRateLimit,
    withErrorHandling("generate health report", async (req, res) => {
      const { vesselId, equipmentId, lookbackHours = 24 } = req.body;

      const equipmentHealth = await storage.getEquipmentHealth();
      const filteredEquipmentHealth = vesselId
        ? equipmentHealth.filter((eq) => eq.vessel === vesselId)
        : equipmentId
          ? equipmentHealth.filter((eq) => eq.id === equipmentId)
          : equipmentHealth;

      const telemetryData = equipmentId
        ? await storage.getTelemetryTrends(equipmentId, lookbackHours)
        : await storage.getTelemetryTrends("", lookbackHours);

      let fleetAnalysis: any;
      try {
        const analysisPromise = analyzeFleetHealth(filteredEquipmentHealth, telemetryData, storage);
        fleetAnalysis = await Promise.race([
          analysisPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI analysis timeout")), 10000)
          ),
        ]);
      } catch (error) {
        logger.warn("HealthReport", "Fleet analysis failed, using fallback", error);
        fleetAnalysis = {
          totalEquipment: filteredEquipmentHealth.length,
          healthyEquipment: filteredEquipmentHealth.filter((eq) => eq.healthIndex > 70).length,
          equipmentAtRisk: filteredEquipmentHealth.filter(
            (eq) => eq.healthIndex >= 30 && eq.healthIndex <= 70
          ).length,
          criticalEquipment: filteredEquipmentHealth.filter((eq) => eq.healthIndex < 30).length,
          topRecommendations: [
            "Schedule maintenance for equipment with health scores below 70%",
            "Monitor critical equipment closely for deteriorating conditions",
            "Review recent alert patterns for early warning signs",
          ],
          costEstimate: filteredEquipmentHealth.length * 2500,
          summary: "Fleet analysis completed using fallback mode due to AI service timeout",
          riskMatrix: [],
          prioritizedActions: [],
          systemIntegration: {
            linkedWorkOrders: 0,
            pendingComplianceItems: 0,
            scheduledMaintenanceOverlap: 0,
          },
          fleetBenchmarks: {
            fleetAverage: { healthIndex: 0, predictedDueDays: 0, maintenanceFrequency: 0 },
            performancePercentiles: { top10Percent: 0, median: 0, bottom10Percent: 0 },
            bestPerformers: [],
            worstPerformers: [],
          },
          equipmentComparisons: [],
        };
      }

      const [workOrders, alerts] = await Promise.all([
        storage.getWorkOrders(),
        storage.getAlertNotifications(),
      ]);

      const filteredWorkOrders = equipmentId
        ? workOrders.filter((wo) => wo.equipmentId === equipmentId)
        : workOrders;

      res.json({
        metadata: {
          title: "Fleet Health Report",
          generatedAt: new Date().toISOString(),
          reportType: "health",
          equipmentFilter: equipmentId || vesselId || "all",
        },
        sections: {
          summary: {
            totalEquipment: fleetAnalysis.totalEquipment,
            healthyEquipment: fleetAnalysis.healthyEquipment,
            criticalEquipment: fleetAnalysis.criticalEquipment,
            openWorkOrders: filteredWorkOrders.filter((wo) => wo.status === "open").length,
          },
          analysis: fleetAnalysis,
          equipmentHealth: filteredEquipmentHealth,
          workOrders: filteredWorkOrders.slice(0, 20),
          alerts: alerts.slice(0, 10),
        },
      });
    })
  );
}

```

### `server/domains/llm/routes/maintenance-report.ts` (79 lines)

```ts
/**
 * Maintenance Report Routes
 * 
 * Maintenance report generation endpoint.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../../storage";
import { withErrorHandling } from "../../../lib/route-utils";

export function registerMaintenanceReportRoutes(
  app: Express,
  storage: IStorage,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post("/api/report/maintenance", generalApiRateLimit,
    withErrorHandling("generate maintenance report", async (req, res) => {
      const { vesselId, equipmentId } = req.body;

      const [maintenanceSchedules, maintenanceRecords, workOrders, equipmentHealth] =
        await Promise.all([
          storage.getMaintenanceSchedules(),
          storage.getMaintenanceRecords(),
          storage.getWorkOrders(),
          storage.getEquipmentHealth(),
        ]);

      const filteredSchedules = equipmentId
        ? maintenanceSchedules.filter((ms) => ms.equipmentId === equipmentId)
        : vesselId
          ? maintenanceSchedules.filter((ms) => {
              const equipment = equipmentHealth.find((eh) => eh.id === ms.equipmentId);
              return equipment?.vessel === vesselId;
            })
          : maintenanceSchedules;

      const filteredRecords = equipmentId
        ? maintenanceRecords.filter((mr) => mr.equipmentId === equipmentId)
        : maintenanceRecords;

      const now = new Date();
      const overdueSchedules = filteredSchedules.filter(
        (s) => new Date(s.scheduledDate) < now && s.status !== "completed"
      );
      const upcomingSchedules = filteredSchedules.filter((s) => {
        const schedDate = new Date(s.scheduledDate);
        return schedDate > now && schedDate < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      });

      res.json({
        metadata: {
          title: "Maintenance Report",
          generatedAt: new Date().toISOString(),
          reportType: "maintenance",
          equipmentFilter: equipmentId || vesselId || "all",
        },
        sections: {
          summary: {
            totalSchedules: filteredSchedules.length,
            overdueCount: overdueSchedules.length,
            upcomingCount: upcomingSchedules.length,
            completedThisMonth: filteredRecords.filter(
              (r) => new Date(r.completedDate) > new Date(now.getFullYear(), now.getMonth(), 1)
            ).length,
          },
          schedules: filteredSchedules,
          records: filteredRecords.slice(0, 50),
          overdue: overdueSchedules,
          upcoming: upcomingSchedules,
        },
      });
    })
  );
}

```

### `server/domains/llm/routes/compliance-report.ts` (141 lines)

```ts
/**
 * Compliance Report Routes
 * 
 * Maintenance and alert compliance report endpoints.
 */

import { Express } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import type { IStorage } from "../../../storage";
import type { AuthenticatedRequest } from "../../../types";
import { withErrorHandling } from "../../../lib/route-utils";

export function registerComplianceReportRoutes(
  app: Express,
  storage: IStorage,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit } = rateLimiters;

  app.post("/api/report/compliance/maintenance", generalApiRateLimit,
    withErrorHandling("generate maintenance compliance report", async (req: AuthenticatedRequest, res) => {
      const { period = "QTD", equipmentId, standard = "ISM" } = req.body;

      const periodCalculators: Record<string, () => Date> = {
        QTD: () => { const quarter = Math.floor(new Date().getMonth() / 3); return new Date(new Date().getFullYear(), quarter * 3, 1); },
        YTD: () => new Date(new Date().getFullYear(), 0, 1),
        MTD: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      };
      const startDate = (periodCalculators[period] ?? (() => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)))();

      const equipmentFilter = equipmentId !== "all" ? equipmentId : undefined;

      const orgId = req.orgId!;
      const [maintenanceSchedules, alerts] = await Promise.all([
        storage.getMaintenanceSchedules(equipmentFilter),
        storage.getAlertNotifications(false, orgId),
      ]);

      const overdue = maintenanceSchedules.filter(
        (s) => s.status === "scheduled" && new Date(s.scheduledDate) < new Date()
      ).length;
      const totalSchedules = maintenanceSchedules.length;
      const complianceRate =
        totalSchedules > 0 ? Math.round(((totalSchedules - overdue) / totalSchedules) * 100) : 0;

      const response = {
        metadata: {
          title: "Maintenance Compliance Report",
          generatedAt: new Date().toISOString(),
          reportType: "maintenance-compliance",
          period,
          standard,
        },
        sections: {
          summary: {
            totalMaintenanceSchedules: totalSchedules,
            overdueCount: overdue,
            complianceRate: `${complianceRate}%`,
            standard,
            reportingPeriod: period,
          },
          schedules: maintenanceSchedules.slice(0, 20),
          overdue: maintenanceSchedules
            .filter((s) => s.status === "scheduled" && new Date(s.scheduledDate) < new Date())
            .slice(0, 10),
          upcoming: maintenanceSchedules
            .filter((s) => s.status === "scheduled" && new Date(s.scheduledDate) >= new Date())
            .slice(0, 10),
        },
      };

      res.json(response);
    })
  );

  app.post("/api/report/compliance/alerts", generalApiRateLimit,
    withErrorHandling("generate alert response compliance report", async (req: AuthenticatedRequest, res) => {
      const { slaHours = 24, lookbackHours = 168, standard = "SOLAS" } = req.body;

      const lookbackDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
      const orgId = req.orgId!;

      const alertNotifications = await storage.getAlertNotifications(undefined, orgId);

      const recentAlerts = alertNotifications.filter(
        (alert) => new Date(alert.createdAt) >= lookbackDate
      );

      const acknowledgedWithinSLA = recentAlerts.filter((alert) => {
        if (!alert.acknowledged || !alert.acknowledgedAt) { return false; }
        const responseTime =
          new Date(alert.acknowledgedAt).getTime() - new Date(alert.createdAt).getTime();
        return responseTime <= slaHours * 60 * 60 * 1000;
      }).length;

      const criticalAlerts = recentAlerts.filter((a) => a.severity === "critical").length;
      const acknowledgedAlerts = recentAlerts.filter((a) => a.acknowledged).length;
      const responseRate =
        recentAlerts.length > 0 ? Math.round((acknowledgedAlerts / recentAlerts.length) * 100) : 0;
      const slaComplianceRate =
        recentAlerts.length > 0
          ? Math.round((acknowledgedWithinSLA / recentAlerts.length) * 100)
          : 0;

      const response = {
        metadata: {
          title: "Alert Response Compliance Report",
          generatedAt: new Date().toISOString(),
          reportType: "alert-compliance",
          standard,
        },
        sections: {
          summary: {
            totalAlerts: recentAlerts.length,
            acknowledgedAlerts,
            criticalAlerts,
            responseRate: `${responseRate}%`,
            slaComplianceRate: `${slaComplianceRate}%`,
            slaTarget: `${slaHours} hours`,
            standard,
            lookbackPeriod: `${lookbackHours} hours`,
          },
          recentAlerts: recentAlerts.slice(0, 20),
          critical: recentAlerts.filter((a) => a.severity === "critical").slice(0, 10),
          slaViolations: recentAlerts
            .filter((alert) => {
              if (!alert.acknowledged || !alert.acknowledgedAt) { return true; }
              const responseTime =
                new Date(alert.acknowledgedAt).getTime() - new Date(alert.createdAt).getTime();
              return responseTime > slaHours * 60 * 60 * 1000;
            })
            .slice(0, 10),
        },
      };

      res.json(response);
    })
  );
}

```

### `server/routes/rag-routes.ts` (580 lines)

```ts
/**
 * RAG API Routes
 * 
 * API endpoints for the RAG (Retrieval-Augmented Generation) system.
 * Provides endpoints for:
 * - Asking questions and getting AI-powered answers
 * - Managing conversations
 * - Submitting feedback
 * - Cache management
 * 
 * Security hardened with:
 * - Session-based authentication (with streaming token support for SSE)
 * - Per-user rate limiting with Redis backing
 * - Input sanitization for prompt injection protection
 * - Audit logging for all operations
 */

import { Express, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RateLimitRequestHandler } from 'express-rate-limit';
import { withErrorHandling } from '../lib/route-utils';
import { 
  getRagOrchestrator,
  getConversationService,
  getFeedbackService,
  getSemanticCache,
} from '../services/rag';
import { logger } from '../utils/logger';
import { streamingService } from '../services/rag/streaming';
import { createRateLimitMiddleware } from '../services/rag/rate-limiter';
import { suggestionEngine } from '../services/rag/suggestions';
import { exportService } from '../services/rag/export';
import { analyticsAggregator } from '../services/rag/analytics';
import { confidenceDetector } from '../services/rag/confidence';
import { comparisonService } from '../services/rag/comparison';
import { getOpenAIApiKey } from '../openai/client';
import { searchKnowledgeBase } from '../vector-search-service';
import { 
  ragAuthMiddleware, 
  ragRateLimitMiddleware, 
  ragInputSanitizationMiddleware,
  type RagSecuredRequest 
} from '../services/rag/security/middleware';
import { 
  initializeRagSecurity, 
  getRagSecurityServices,
  getRagSecurityConfig 
} from '../services/rag/security';

const askRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  maxSources: z.number().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(4096).optional(),
});

const feedbackSchema = z.object({
  messageId: z.string().optional(),
  chunkId: z.string().optional(),
  feedbackType: z.enum(['helpful', 'not_helpful', 'inaccurate', 'missing_info', 'outdated']),
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
  queryText: z.string().optional(),
});

const conversationUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

export function registerRagRoutes(
  app: Express,
  rateLimiters: {
    generalApiRateLimit: RateLimitRequestHandler;
    reportGenerationRateLimit: RateLimitRequestHandler;
  }
) {
  const { generalApiRateLimit, reportGenerationRateLimit } = rateLimiters;

  // Initialize RAG security services
  initializeRagSecurity();

  // Helper to extract org context from secured request
  const getOrgContext = (req: Request) => {
    const securedReq = req as RagSecuredRequest;
    return {
      orgId: securedReq.ragContext?.orgId || req.headers['x-org-id'] as string || 'default-org-id',
      userId: securedReq.ragContext?.userId || req.headers['x-user-id'] as string || undefined,
      userRoles: req.headers['x-user-roles'] 
        ? (req.headers['x-user-roles'] as string).split(',') 
        : undefined,
    };
  };

  // Apply security middleware to all RAG routes
  app.use('/api/rag', ragAuthMiddleware as any);

  app.post('/api/rag/ask', 
    ragRateLimitMiddleware as any,
    ragInputSanitizationMiddleware as any,
    withErrorHandling('ask RAG question', async (req, res) => {
      const { orgId, userId, userRoles } = getOrgContext(req);
      const { auditLogger } = getRagSecurityServices();
      const startTime = Date.now();

      // Use sanitized query if available
      const securedReq = req as RagSecuredRequest;
      const parsed = askRequestSchema.parse(req.body);
      const query = securedReq.ragContext?.sanitizedQuery || parsed.query;
      
      const orchestrator = getRagOrchestrator();
      const response = await orchestrator.ask({
        orgId,
        userId,
        userRoles,
        query,
        conversationId: parsed.conversationId,
        maxSources: parsed.maxSources,
        threshold: parsed.threshold,
        temperature: parsed.temperature,
        maxTokens: parsed.maxTokens,
      });

      // Log successful response
      auditLogger.logResponse({
        userId,
        orgId,
        conversationId: response.conversationId || 'direct',
        responseLength: response.answer?.length || 0,
        chunksUsed: response.sources?.length || 0,
        confidence: response.confidence?.score,
        cached: response.cached || false,
        duration: Date.now() - startTime,
      });

      res.json(response);
    })
  );

  app.post('/api/rag/conversations', generalApiRateLimit,
    withErrorHandling('create RAG conversation', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const userId = req.headers['x-user-id'] as string || undefined;
      const { title } = req.body;

      const conversationService = getConversationService();
      const conversation = await conversationService.createConversation({
        orgId,
        userId,
        title,
      });

      res.status(201).json(conversation);
    })
  );

  app.get('/api/rag/conversations', generalApiRateLimit,
    withErrorHandling('list RAG conversations', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const userId = req.headers['x-user-id'] as string || undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      const conversationService = getConversationService();
      const conversations = await conversationService.listConversations({
        orgId,
        userId,
        limit,
        activeOnly: true,
      });

      res.json(conversations);
    })
  );

  app.get('/api/rag/conversations/:id', generalApiRateLimit,
    withErrorHandling('get RAG conversation', async (req, res) => {
      const { id } = req.params;

      const conversationService = getConversationService();
      const conversation = await conversationService.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.json(conversation);
    })
  );

  app.get('/api/rag/conversations/:id/messages', generalApiRateLimit,
    withErrorHandling('get conversation messages', async (req, res) => {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;

      const conversationService = getConversationService();
      const messages = await conversationService.getMessages(id, limit);

      res.json(messages);
    })
  );

  app.patch('/api/rag/conversations/:id', generalApiRateLimit,
    withErrorHandling('update RAG conversation', async (req, res) => {
      const { id } = req.params;
      const parsed = conversationUpdateSchema.parse(req.body);

      const conversationService = getConversationService();
      const updated = await conversationService.updateConversation(id, parsed);

      if (!updated) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.json(updated);
    })
  );

  app.delete('/api/rag/conversations/:id', generalApiRateLimit,
    withErrorHandling('delete RAG conversation', async (req, res) => {
      const { id } = req.params;

      const conversationService = getConversationService();
      const deleted = await conversationService.deleteConversation(id);

      if (!deleted) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      res.status(204).send();
    })
  );

  app.post('/api/rag/feedback', generalApiRateLimit,
    withErrorHandling('submit RAG feedback', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const userId = req.headers['x-user-id'] as string || undefined;

      const parsed = feedbackSchema.parse(req.body);
      
      const orchestrator = getRagOrchestrator();
      await orchestrator.submitFeedback({
        orgId,
        userId,
        ...parsed,
      });

      res.status(201).json({ success: true });
    })
  );

  app.get('/api/rag/feedback/stats', generalApiRateLimit,
    withErrorHandling('get RAG feedback stats', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';

      const feedbackService = getFeedbackService();
      const stats = await feedbackService.getOrgStats(orgId);

      res.json(stats);
    })
  );

  app.get('/api/rag/cache/stats', generalApiRateLimit,
    withErrorHandling('get RAG cache stats', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';

      const cache = getSemanticCache();
      const stats = await cache.getStats(orgId);

      res.json(stats);
    })
  );

  app.post('/api/rag/cache/cleanup', generalApiRateLimit,
    withErrorHandling('cleanup RAG cache', async (req, res) => {
      const cache = getSemanticCache();
      const cleaned = await cache.cleanup();

      res.json({ cleanedEntries: cleaned });
    })
  );

  app.delete('/api/rag/cache', generalApiRateLimit,
    withErrorHandling('invalidate RAG cache', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const { query } = req.query;

      const cache = getSemanticCache();
      const invalidated = await cache.invalidate(orgId, query as string | undefined);

      res.json({ invalidatedEntries: invalidated });
    })
  );

  // === STREAMING ENDPOINT ===
  // Uses orchestrator for tenant isolation and persistence
  // Uses streaming tokens for SSE authentication (EventSource can't send headers)
  app.get('/api/rag/ask-stream', 
    ragRateLimitMiddleware as any,
    async (req: Request, res: Response) => {
      const { auditLogger, sanitizer, tokenService, config } = getRagSecurityServices();
      
      // Track client disconnect
      let isClientConnected = true;
      req.on('close', () => {
        isClientConnected = false;
        logger.info('[RAG Stream] Client disconnected');
      });

      try {
        // Authenticate via streaming token (preferred) or session
        let orgId: string;
        let userId: string | undefined;
        
        const streamingToken = req.query.token as string;
        if (streamingToken) {
          const tokenPayload = tokenService.validateToken(streamingToken);
          if (!tokenPayload) {
            auditLogger.logAuthFailure({
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              reason: 'Invalid or expired streaming token',
            });
            res.status(401).json({ error: 'Invalid or expired streaming token' });
            return;
          }
          orgId = tokenPayload.orgId;
          userId = tokenPayload.userId;
        } else if (config.auth.allowHeaderOrgId) {
          // Fallback for dev mode
          orgId = (req.query.orgId as string) || 
                        (req.headers['x-org-id'] as string) || 
                        'default-org-id';
          userId = (req.query.userId as string) ||
                         (req.headers['x-user-id'] as string) || 
                         undefined;
        } else {
          res.status(401).json({ error: 'Streaming token required. Use POST /api/rag/security/streaming-token to obtain one.' });
          return;
        }
        
        let query = req.query.query as string;
        const conversationId = req.query.conversationId as string | undefined;

        // Sanitize query
        const sanitizeResult = sanitizer.sanitize(query || '');
        if (sanitizeResult.blockedPatterns.length > 0) {
          auditLogger.logPromptInjectionAttempt({
            userId,
            orgId,
            ipAddress: req.ip,
            blockedPatterns: sanitizeResult.blockedPatterns,
            queryPreview: query.slice(0, 200),
          });
        }
        query = sanitizeResult.sanitized;

        if (!query) {
          res.status(400).json({ error: 'Query is required' });
          return;
        }

        const apiKey = await getOpenAIApiKey();
        if (!apiKey) {
          res.status(503).json({ error: 'OpenAI API key not configured' });
          return;
        }

        if (!streamingService.isInitialized()) {
          await streamingService.initialize(apiKey);
        }

        // Use orchestrator for proper tenant-scoped search
        const orchestrator = getRagOrchestrator();
        const searchResults = await searchKnowledgeBase(query, orgId, 5, 0.5);
        
        const relevantChunks = searchResults.map((r: any) => ({
          content: r.content,
          documentId: r.documentId,
          documentTitle: r.documentTitle,
          score: r.score,
        }));

        // Get conversation history if conversationId provided
        let conversationHistory: Array<{ role: string; content: string }> | undefined;
        if (conversationId) {
          const conversationService = getConversationService();
          const messages = await conversationService.getMessages(conversationId, 10);
          conversationHistory = messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          }));
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Accumulate full response for persistence
        let fullResponse = '';
        
        await streamingService.streamResponse(
          { query, relevantChunks, conversationHistory },
          res,
          async (chunk) => {
            // Check if client disconnected
            if (!isClientConnected) {
              logger.warn('[RAG Stream] Skipping chunk - client disconnected');
              return;
            }

            // Accumulate content for persistence
            if (chunk.type === 'content' && chunk.content) {
              fullResponse += chunk.content;
            }

            // On completion, persist the full message if conversation exists
            if (chunk.type === 'done' && conversationId && fullResponse) {
              try {
                const conversationService = getConversationService();
                // Add user's query first
                await conversationService.addMessage(conversationId, {
                  role: 'user',
                  content: query,
                });
                // Add full AI response
                await conversationService.addMessage(conversationId, {
                  role: 'assistant',
                  content: fullResponse,
                });
                logger.info(`[RAG Stream] Persisted ${fullResponse.length} chars to conversation ${conversationId}`);
              } catch (persistError) {
                logger.warn('[RAG Stream] Failed to persist message:', persistError);
              }
            }
          }
        );
      } catch (error: any) {
        logger.error('[RAG Stream] Error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: error.message || 'Streaming failed' });
        } else {
          // Send error event through SSE
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        }
      }
    }
  );

  // === SUGGESTIONS ENDPOINT ===
  app.get('/api/rag/suggestions', generalApiRateLimit,
    withErrorHandling('get RAG suggestions', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const conversationId = req.query.conversationId as string | undefined;

      const apiKey = await getOpenAIApiKey();
      if (apiKey && !suggestionEngine.isInitialized()) {
        await suggestionEngine.initialize(apiKey);
      }

      const suggestions = await suggestionEngine.generateSuggestions({
        documentTopics: ['marine maintenance', 'engine systems', 'safety procedures'],
      }, 5);

      res.json({ success: true, suggestions });
    })
  );

  // === EXPORT ENDPOINT ===
  app.get('/api/rag/conversations/:id/export', generalApiRateLimit,
    withErrorHandling('export conversation', async (req, res) => {
      const { id } = req.params;
      const format = (req.query.format as 'pdf' | 'markdown') || 'markdown';
      const includeCitations = req.query.includeCitations !== 'false';
      const includeTimestamps = req.query.includeTimestamps !== 'false';

      const conversationService = getConversationService();
      const conversation = await conversationService.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const messages = await conversationService.getMessages(id, 1000);

      const exportData = {
        id: conversation.conversation.id,
        title: conversation.conversation.title || 'Untitled Conversation',
        createdAt: new Date(conversation.conversation.createdAt),
        messages: messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
          citations: m.citations,
        })),
      };

      const result = await exportService.exportConversation(exportData, {
        format,
        includeCitations,
        includeTimestamps,
      });

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    })
  );

  // === ANALYTICS ENDPOINT ===
  app.get('/api/rag/analytics', generalApiRateLimit,
    withErrorHandling('get RAG analytics', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';

      const analytics = await analyticsAggregator.getSummary(orgId);

      res.json({ success: true, analytics });
    })
  );

  // === COMPARISON ENDPOINT ===
  const comparisonSchema = z.object({
    query: z.string().min(1).max(2000),
    documentIds: z.array(z.string()).min(2).max(5),
    maxChunksPerDoc: z.number().optional(),
  });

  app.post('/api/rag/compare', reportGenerationRateLimit,
    withErrorHandling('compare documents', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const parsed = comparisonSchema.parse(req.body);

      const apiKey = await getOpenAIApiKey();
      if (!apiKey) {
        return res.status(503).json({ error: 'OpenAI API key not configured' });
      }

      if (!comparisonService.isInitialized()) {
        await comparisonService.initialize(apiKey);
      }

      const result = await comparisonService.compare(parsed, orgId);

      res.json({ success: true, result });
    })
  );

  // === CONFIDENCE ALERTS ENDPOINT ===
  app.get('/api/rag/alerts', generalApiRateLimit,
    withErrorHandling('get confidence alerts', async (req, res) => {
      const orgId = req.headers['x-org-id'] as string || 'default-org-id';
      const includeAcknowledged = req.query.includeAcknowledged === 'true';

      const alerts = confidenceDetector.getAlerts(orgId, includeAcknowledged);

      res.json({ success: true, alerts });
    })
  );

  app.post('/api/rag/alerts/:alertId/acknowledge', generalApiRateLimit,
    withErrorHandling('acknowledge alert', async (req, res) => {
      const { alertId } = req.params;

      const acknowledged = confidenceDetector.acknowledgeAlert(alertId);

      if (!acknowledged) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({ success: true });
    })
  );

  logger.info('[RAG Routes] Registered (ask, ask-stream, conversations, feedback, cache, suggestions, export, analytics, compare, alerts)');
}

```

### `server/routes/rag-security-routes.ts` (326 lines)

```ts
/**
 * RAG Security Settings Routes
 * API endpoints for managing RAG security configuration
 * 
 * SECURITY: All config modification routes require admin authentication
 */

import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { withErrorHandling } from "../lib/route-utils.js";
import {
  getRagSecurityConfig,
  updateRagSecurityConfig,
  getRagSecurityServices,
} from "../services/rag/security/index.js";

/**
 * Strict Zod schema for config updates - only allow safe, whitelisted fields
 */
const ragSecurityConfigUpdateSchema = z.object({
  auth: z.object({
    requireSession: z.boolean().optional(),
    allowHeaderOrgId: z.boolean().optional(),
    streamingTokenTTLSeconds: z.number().min(60).max(3600).optional(),
  }).optional(),
  rateLimiting: z.object({
    enabled: z.boolean().optional(),
    requestsPerMinute: z.number().min(1).max(1000).optional(),
    burstLimit: z.number().min(1).max(100).optional(),
    windowSizeSeconds: z.number().min(10).max(3600).optional(),
    useRedis: z.boolean().optional(),
  }).optional(),
  ingestion: z.object({
    maxFileSizeMB: z.number().min(1).max(500).optional(),
    quarantineOnSuspicious: z.boolean().optional(),
    enableMalwareScan: z.boolean().optional(),
  }).optional(),
  promptSecurity: z.object({
    enabled: z.boolean().optional(),
    sanitizeUserInput: z.boolean().optional(),
    useBoundaryMarkers: z.boolean().optional(),
    filterOutputPatterns: z.boolean().optional(),
    maxQueryLength: z.number().min(100).max(50000).optional(),
    // blockedPatterns intentionally excluded - use dedicated endpoint
  }).strict().optional(),
  audit: z.object({
    enabled: z.boolean().optional(),
    logQueries: z.boolean().optional(),
    logResponses: z.boolean().optional(),
    logDocumentAccess: z.boolean().optional(),
    retentionDays: z.number().min(7).max(365).optional(),
  }).optional(),
}).strict();

/**
 * Admin-only middleware for RAG security routes
 * Requires valid session with admin privileges
 */
function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const session = (req as any).session;
  
  // In development, allow with dev user
  if (process.env.NODE_ENV === 'development') {
    if (session?.userId === 'dev-user-id' || req.get('x-org-id')) {
      return next();
    }
  }
  
  // Check for valid session
  if (!session?.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  
  // Check for admin role (using existing RBAC)
  const userRoles = session.roles || [];
  const isAdmin = userRoles.some((role: any) => 
    role.name === 'admin' || 
    role.name === 'system_admin' || 
    role.name === 'developer'
  );
  
  if (!isAdmin) {
    logger.warn("RagSecurityRoutes", "Unauthorized access attempt to security config", {
      userId: session.userId,
      roles: userRoles.map((r: any) => r.name),
    });
    res.status(403).json({ error: "Admin privileges required" });
    return;
  }
  
  next();
}

export function registerRagSecurityRoutes(app: Express): void {
  /**
   * Get current RAG security configuration (read-only, safe for non-admins)
   */
  app.get(
    "/api/rag/security/config",
    withErrorHandling("get RAG security config", async (req: Request, res: Response) => {
      const config = getRagSecurityConfig();
      
      // Return config with pattern count only (not actual patterns)
      const safeConfig = {
        ...config,
        promptSecurity: {
          ...config.promptSecurity,
          blockedPatterns: config.promptSecurity.blockedPatterns.length,
        },
      };

      res.json(safeConfig);
    })
  );

  /**
   * Get full RAG security configuration (admin only)
   * Includes blocked patterns list
   */
  app.get(
    "/api/rag/security/config/full",
    requireAdminAuth,
    withErrorHandling("get full RAG security config", async (req: Request, res: Response) => {
      const config = getRagSecurityConfig();
      res.json(config);
    })
  );

  /**
   * Update RAG security configuration (admin only)
   * Uses strict Zod validation with whitelisted fields only
   */
  app.put(
    "/api/rag/security/config",
    requireAdminAuth,
    withErrorHandling("update RAG security config", async (req: Request, res: Response) => {
      // Parse and validate with strict schema
      const parseResult = ragSecurityConfigUpdateSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        logger.warn("RagSecurityRoutes", "Invalid config update rejected", {
          errors: parseResult.error.issues,
        });
        res.status(400).json({ 
          error: "Invalid configuration", 
          details: parseResult.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }

      const updates = parseResult.data;
      const newConfig = updateRagSecurityConfig(updates);

      const { auditLogger } = getRagSecurityServices();
      const session = (req as any).session;
      
      auditLogger.log({
        eventType: 'config_change',
        userId: session?.userId || 'unknown',
        orgId: session?.orgId || req.get('x-org-id') || 'unknown',
        details: {
          action: 'security_config_update',
          changedSections: Object.keys(updates),
        },
        success: true,
      });

      logger.info("RagSecurityRoutes", "Security configuration updated by admin", {
        userId: session?.userId,
        changes: Object.keys(updates),
      });

      res.json({ 
        success: true, 
        config: {
          ...newConfig,
          promptSecurity: {
            ...newConfig.promptSecurity,
            blockedPatterns: newConfig.promptSecurity.blockedPatterns.length,
          },
        },
      });
    })
  );

  /**
   * Get streaming token for EventSource connections
   */
  app.post(
    "/api/rag/security/streaming-token",
    withErrorHandling("generate streaming token", async (req: Request, res: Response) => {
      const { tokenService, config } = getRagSecurityServices();
      
      // Get org context from session or header
      const session = (req as any).session;
      const userId = session?.userId || req.body?.userId || 'anonymous';
      const orgId = session?.orgId || req.get('x-org-id') || req.body?.orgId;

      if (!orgId) {
        res.status(400).json({ error: "Organization context required" });
        return;
      }

      const token = tokenService.generateToken(userId, orgId);

      res.json({
        token,
        expiresIn: config.auth.streamingTokenTTLSeconds,
      });
    })
  );

  /**
   * Get audit log events (admin only)
   */
  app.get(
    "/api/rag/security/audit",
    requireAdminAuth,
    withErrorHandling("get RAG audit logs", async (req: Request, res: Response) => {
      const { auditLogger } = getRagSecurityServices();
      
      const limit = parseInt(req.query.limit as string) || 100;
      const eventType = req.query.eventType as string;
      const orgId = req.get('x-org-id') || (req as any).session?.orgId;

      const events = auditLogger.getEvents({
        limit,
        eventType: eventType as any,
        orgId,
      });

      res.json({ events });
    })
  );

  /**
   * Get audit statistics (admin only)
   */
  app.get(
    "/api/rag/security/audit/stats",
    requireAdminAuth,
    withErrorHandling("get RAG audit stats", async (req: Request, res: Response) => {
      const { auditLogger } = getRagSecurityServices();
      const orgId = req.get('x-org-id') || (req as any).session?.orgId;

      const stats = auditLogger.getStats(orgId);
      res.json(stats);
    })
  );

  /**
   * Get rate limit status for current user
   */
  app.get(
    "/api/rag/security/rate-limit/status",
    withErrorHandling("get rate limit status", async (req: Request, res: Response) => {
      const { rateLimiter, config } = getRagSecurityServices();
      
      const session = (req as any).session;
      const userId = session?.userId || 'anonymous';
      const orgId = session?.orgId || req.get('x-org-id') || 'default-org-id';

      const identifier = session?.orgId 
        ? `user:${userId}:${orgId}`
        : `ip:${req.ip}`;

      const status = await rateLimiter.getStatus(identifier);

      res.json({
        ...status,
        limit: config.rateLimiting.requestsPerMinute,
        windowSeconds: config.rateLimiting.windowSizeSeconds,
      });
    })
  );

  /**
   * Test input sanitization (admin only - for debugging)
   */
  app.post(
    "/api/rag/security/test/sanitize",
    requireAdminAuth,
    withErrorHandling("test input sanitization", async (req: Request, res: Response) => {
      const { sanitizer } = getRagSecurityServices();
      const { input } = req.body;

      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: "Input string required" });
        return;
      }

      const result = sanitizer.sanitize(input);
      res.json(result);
    })
  );

  /**
   * Test file validation (admin only - for debugging)
   */
  app.post(
    "/api/rag/security/test/validate-file",
    requireAdminAuth,
    withErrorHandling("test file validation", async (req: Request, res: Response) => {
      const { fileValidator } = getRagSecurityServices();
      const { filename, mimeType, sizeBytes } = req.body;

      if (!filename) {
        res.status(400).json({ error: "Filename required" });
        return;
      }

      // Create a dummy buffer for size checking
      const dummyBuffer = Buffer.alloc(sizeBytes || 1024);
      const result = await fileValidator.validate(filename, dummyBuffer, mimeType);

      res.json(result);
    })
  );

  logger.info("RagSecurityRoutes", "RAG security routes registered");
}

```

### `server/routes/kb-routes.ts` (478 lines)

```ts
/**
 * Knowledge Base Routes
 * 
 * Security Note (S5443 - publicly writable directories):
 * /tmp/kb-uploads is used for temporary file staging during document ingestion.
 * Files are processed asynchronously and removed after ingestion.
 * In production, consider a secure application-owned directory.
 */
import { Router, type Express } from "express";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { requireOrgId } from "../middleware/auth";
import {
  additionalSecurityHeaders,
  sanitizeRequestData,
} from "../security";
import {
  ingestDocument,
  deleteDocument,
  listDocuments,
} from "../document-ingestion-service";
import { searchKnowledgeBase } from "../vector-search-service";
import { getKnowledgeBaseStats } from "../vector-search-service";
import { jobQueueService, type DocumentIngestionJob } from "../job-queue-service";
import { db } from "../db";
import { kbDocs, kbDocVersions, equipment } from "@shared/schema-runtime";
import { eq, and, desc } from "drizzle-orm";
import {
  updateDocumentVersion,
  getDocumentVersionHistory,
  updateDocumentVisibility,
  listDocumentsWithAccess,
  recordDocumentCreation,
} from "../services/document-ingestion/repository";

// Helper to validate equipmentId belongs to org (optional field validation)
async function validateEquipmentOwnership(equipmentId: string | null | undefined, orgId: string): Promise<boolean> {
  if (!equipmentId) {
    return true; // No equipment specified is valid
  }
  
  const [equip] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
    .limit(1);
  
  return !!equip;
}

// Configure multer for disk storage (async processing)
// NOSONAR: S5443 - /tmp used for temporary upload processing; files processed immediately
const asyncUpload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/kb-uploads',
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PNG, and JPEG are allowed.'));
    }
  },
});

// Configure multer for in-memory file uploads (sync processing)
const syncUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PNG, and JPEG are allowed.'));
    }
  },
});

// Request validation schemas
const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  threshold: z.coerce.number().min(0).max(1).optional().default(0.5),
});

export async function registerKnowledgeBaseRoutes(app: Express, rateLimits: {
  generalApiRateLimit: any;
  writeOperationRateLimit: any;
}) {
  const { generalApiRateLimit, writeOperationRateLimit } = rateLimits;
  const router = Router();

  // Apply middleware to all KB routes
  router.use(requireOrgId);
  router.use(additionalSecurityHeaders);
  router.use(sanitizeRequestData);

  // Async upload endpoint (recommended for larger files)
  router.post(
    '/upload/async',
    writeOperationRateLimit,
    asyncUpload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const orgId = req.orgId;
        const userId = req.user?.id;
        const documentId = randomUUID();
        const equipmentId = req.body?.equipmentId || null; // Optional: Link document to specific equipment

        // Validate equipmentId belongs to org (security: prevent cross-tenant linking)
        if (equipmentId && !(await validateEquipmentOwnership(equipmentId, orgId))) {
          return res.status(400).json({ error: 'Invalid equipmentId or equipment does not belong to your organization' });
        }

        console.log(`[KB Upload Async] Enqueuing ${req.file.originalname} for org ${orgId}${equipmentId ? ` (equipment: ${equipmentId})` : ''}`);

        // Create document record with 'processing' status
        await db.insert(kbDocs).values({
          id: documentId,
          orgId,
          equipmentId,
          name: req.file.originalname,
          source: req.file.originalname,
          fileType: req.file.mimetype,
          sizeBytes: req.file.size,
          uploadedBy: userId,
          status: 'processing',
        });

        // Enqueue job
        const jobId = await jobQueueService.enqueueDocumentIngestion({
          documentId,
          orgId,
          filePath: req.file.path,
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          uploadedBy: userId,
        });

        res.status(202).json({
          success: true,
          jobId,
          documentId,
          message: 'Document upload queued for processing',
        });
      } catch (error) {
        console.error('[KB Upload Async] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Document upload failed', details: errorMessage });
      }
    }
  );

  // Synchronous upload endpoint (for small files or immediate processing)
  router.post(
    '/upload',
    writeOperationRateLimit,
    syncUpload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const orgId = req.orgId;
        const userId = req.user?.id;
        const equipmentId = req.body?.equipmentId || null; // Optional: Link document to specific equipment

        // Validate equipmentId belongs to org (security: prevent cross-tenant linking)
        if (equipmentId && !(await validateEquipmentOwnership(equipmentId, orgId))) {
          return res.status(400).json({ error: 'Invalid equipmentId or equipment does not belong to your organization' });
        }

        // Determine file type from mimetype
        let fileType: 'pdf' | 'png' | 'jpg' | 'jpeg';
        if (req.file.mimetype === 'application/pdf') {
          fileType = 'pdf';
        } else if (req.file.mimetype === 'image/png') {
          fileType = 'png';
        } else if (req.file.mimetype === 'image/jpeg') {
          fileType = 'jpeg';
        } else {
          return res.status(400).json({ error: 'Unsupported file type' });
        }

        console.log(`[KB Upload Sync] Processing ${req.file.originalname} for org ${orgId}${equipmentId ? ` (equipment: ${equipmentId})` : ''}`);

        const result = await ingestDocument({
          orgId,
          fileName: req.file.originalname,
          fileBuffer: req.file.buffer,
          fileType,
          uploadedBy: userId,
          equipmentId,
          openAiKey: process.env.OPENAI_API_KEY,
        });

        res.status(201).json({
          success: true,
          docId: result.docId,
          chunksCreated: result.chunksCreated,
          metadata: result.metadata,
        });
      } catch (error) {
        console.error('[KB Upload Sync] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Document upload failed', details: errorMessage });
      }
    }
  );

  // Job status endpoint
  router.get(
    '/jobs/:jobId',
    generalApiRateLimit,
    async (req, res) => {
      try {
        const { jobId } = req.params;
        const orgId = req.orgId;
        
        const job = await jobQueueService.getJobStatus(jobId);

        if (!job) {
          return res.status(404).json({ error: 'Job not found' });
        }

        // Security: Verify org ownership via job payload
        const jobData = job.data as DocumentIngestionJob;
        if (jobData.orgId !== orgId) {
          console.warn(`[KB Job Status] Unauthorized access attempt: job ${jobId} belongs to org ${jobData.orgId}, requested by org ${orgId}`);
          return res.status(404).json({ error: 'Job not found' }); // Don't leak existence
        }

        // Return minimal safe information
        res.json({
          jobId,
          state: job.state,
          documentId: jobData.documentId,
          filename: jobData.filename,
          createdOn: job.createdon,
          startedOn: job.startedon,
          completedOn: job.completedon,
          output: job.output,
        });
      } catch (error) {
        console.error('[KB Job Status] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to get job status', details: errorMessage });
      }
    }
  );

  // Search documents endpoint
  router.get(
    '/search',
    generalApiRateLimit,
    async (req, res) => {
      try {
        const validatedQuery = searchQuerySchema.parse(req.query);
        const orgId = req.orgId;

        console.log(`[KB Search] Query: "${validatedQuery.q}" for org ${orgId}`);

        const results = await searchKnowledgeBase({
          orgId,
          query: validatedQuery.q,
          limit: validatedQuery.limit,
          threshold: validatedQuery.threshold,
          openAiKey: process.env.OPENAI_API_KEY,
        });

        res.json({
          query: validatedQuery.q,
          results,
          count: results.length,
        });
      } catch (_error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
        }
        console.error('[KB Search] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Search failed', details: errorMessage });
      }
    }
  );

  // List documents endpoint (with access control)
  router.get(
    '/documents',
    generalApiRateLimit,
    async (req, res) => {
      try {
        const orgId = req.orgId;
        const userId = req.user?.id || null;
        const userRoles = (req.user?.roles as string[]) || [];
        const equipmentId = req.query.equipmentId as string | undefined;
        
        // Validate equipmentId belongs to org if provided (security: prevent cross-tenant probing)
        if (equipmentId && !(await validateEquipmentOwnership(equipmentId, orgId))) {
          return res.status(400).json({ error: 'Invalid equipmentId or equipment does not belong to your organization' });
        }
        
        // Get documents with access control filtering
        let documents = await listDocumentsWithAccess(orgId, userId, userRoles);
        
        // Further filter by equipmentId if provided
        if (equipmentId) {
          documents = documents.filter(doc => doc.equipmentId === equipmentId);
        }
        
        res.json({
          documents,
          count: documents.length,
          ...(equipmentId && { equipmentId }),
        });
      } catch (error) {
        console.error('[KB List] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to list documents', details: errorMessage });
      }
    }
  );

  // Delete document endpoint
  router.delete(
    '/documents/:id',
    writeOperationRateLimit,
    async (req, res) => {
      try {
        const orgId = req.orgId;
        const { id } = req.params;

        await deleteDocument(id, orgId);

        res.status(204).send();
      } catch (_error) {
        console.error('[KB Delete] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
          return res.status(404).json({ error: errorMessage });
        }
        
        res.status(500).json({ error: 'Failed to delete document', details: errorMessage });
      }
    }
  );

  // Get knowledge base stats endpoint
  router.get(
    '/stats',
    generalApiRateLimit,
    async (req, res) => {
      try {
        const orgId = req.orgId;
        const stats = await getKnowledgeBaseStats(orgId);
        
        res.json(stats);
      } catch (error) {
        console.error('[KB Stats] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: 'Failed to get stats', details: errorMessage });
      }
    }
  );

  // Get document version history
  router.get(
    '/documents/:id/versions',
    generalApiRateLimit,
    async (req, res) => {
      try {
        const orgId = req.orgId;
        const { id } = req.params;

        const versions = await getDocumentVersionHistory(id, orgId);
        res.json({ documentId: id, versions, count: versions.length });
      } catch (error) {
        console.error('[KB Versions] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('not found')) {
          return res.status(404).json({ error: errorMessage });
        }
        res.status(500).json({ error: 'Failed to get version history', details: errorMessage });
      }
    }
  );

  // Update document version (create new version record)
  router.post(
    '/documents/:id/versions',
    writeOperationRateLimit,
    async (req, res) => {
      try {
        const orgId = req.orgId;
        const userId = req.user?.id;
        const { id } = req.params;
        const { changeType, changeNotes } = req.body;

        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        if (!changeType || !['updated', 'replaced'].includes(changeType)) {
          return res.status(400).json({ error: 'changeType must be "updated" or "replaced"' });
        }

        const result = await updateDocumentVersion(id, orgId, userId, changeType, changeNotes);
        res.json({
          success: true,
          document: result.doc,
          versionRecord: result.version,
        });
      } catch (error) {
        console.error('[KB Version Update] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('not found')) {
          return res.status(404).json({ error: errorMessage });
        }
        res.status(500).json({ error: 'Failed to update version', details: errorMessage });
      }
    }
  );

  // Update document visibility/access control
  router.patch(
    '/documents/:id/visibility',
    writeOperationRateLimit,
    async (req, res) => {
      try {
        const orgId = req.orgId;
        const { id } = req.params;
        const { visibility, allowedRoles } = req.body;

        if (!visibility || !['org', 'private', 'role-based'].includes(visibility)) {
          return res.status(400).json({ error: 'visibility must be "org", "private", or "role-based"' });
        }

        if (visibility === 'role-based' && (!allowedRoles || !Array.isArray(allowedRoles))) {
          return res.status(400).json({ error: 'allowedRoles array required for role-based visibility' });
        }

        const updated = await updateDocumentVisibility(id, orgId, visibility, allowedRoles);
        res.json({ success: true, document: updated });
      } catch (error) {
        console.error('[KB Visibility Update] Failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('not found')) {
          return res.status(404).json({ error: errorMessage });
        }
        res.status(500).json({ error: 'Failed to update visibility', details: errorMessage });
      }
    }
  );

  // Mount router
  app.use('/api/kb', router);
  
  console.log('[KB Routes] Knowledge Base API routes registered');
}

```

---

## System (Admin, Permissions, Settings, Config, Diagnostics, Observability, Sensors, Scheduled Reports)

### `server/domains/system-admin/routes/types.ts` (67 lines)

```ts
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

```

### `server/domains/system-admin/routes/index.ts` (42 lines)

```ts
/**
 * System Admin Routes - Index Aggregator
 * Combines all modular system admin route handlers
 */

import type { Express } from "express";
import type { SystemAdminDependencies, IStorage, ThresholdCalibrator } from "./types.js";
import { logger } from "../../../utils/logger.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { registerAuditRoutes } from "./audit-routes.js";
import { registerSettingsRoutes } from "./settings-routes.js";
import { registerSimulationRoutes } from "./simulation-routes.js";
import { registerIntegrationsRoutes } from "./integrations-routes.js";
import { registerWindowsRoutes } from "./windows-routes.js";
import { registerMetricsRoutes } from "./metrics-routes.js";

export type { SystemAdminDependencies, IStorage, ThresholdCalibrator };

export function registerSystemAdminRoutes(
  app: Express,
  deps: SystemAdminDependencies
): void {
  registerAuthRoutes(app, deps);
  registerAuditRoutes(app, deps);
  registerSettingsRoutes(app, deps);
  registerSimulationRoutes(app, deps);
  registerIntegrationsRoutes(app, deps);
  registerWindowsRoutes(app, deps);
  registerMetricsRoutes(app, deps);

  logger.info("SystemAdminRoutes", "Registered (auth: 2, audit: 4, settings: 7, integrations: 7, windows: 7, metrics: 4, simulation: 4)");
}

export {
  registerAuthRoutes,
  registerAuditRoutes,
  registerSettingsRoutes,
  registerSimulationRoutes,
  registerIntegrationsRoutes,
  registerWindowsRoutes,
  registerMetricsRoutes,
};

```

### `server/domains/system-admin/routes/auth-routes.ts` (261 lines)

```ts
/**
 * System Admin Routes - Authentication
 * Admin login verification and password management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";

export function registerAuthRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    adminPasswordVerifySchema,
    adminPasswordChangeSchema,
  } = deps;

  app.post(
    "/api/admin/auth/verify",
    generalApiRateLimit,
    withErrorHandling("verify admin authentication", async (req: Request, res: Response) => {
      const { password } = adminPasswordVerifySchema.parse(req.body);

      const validAdminToken = process.env.ADMIN_TOKEN;

      if (!validAdminToken) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      if (password !== validAdminToken) {
        logger.warn("AdminAuth", `Failed admin password verification from ${req.ip}`);
        res.status(401).json({
          error: "Invalid password",
          code: "INVALID_PASSWORD",
        });
        return;
      }

      const crypto = await import("crypto");
      const sessionToken = crypto.randomBytes(32).toString("hex");

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 2);

      const mockOrgId = "default-org-id";
      let adminUser = await storage.getUserByEmail("admin@example.com", mockOrgId);

      if (!adminUser) {
        adminUser = await storage.createUser({
          orgId: mockOrgId,
          email: "admin@example.com",
          name: "System Administrator",
          role: "admin",
          isActive: true,
        });
      }

      await storage.createAdminSession({
        orgId: mockOrgId,
        sessionToken,
        userId: adminUser.id,
        adminEmail: "admin@example.com",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        expiresAt,
        lastActivityAt: new Date(),
      });

      logger.info("AdminAuth", `Admin session created from ${req.ip}`);

      const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      res.json({
        sessionToken,
        expiresAt: expiresAt.toISOString(),
        expiresIn,
      });
    })
  );

  app.get(
    "/api/admin/auth/status",
    generalApiRateLimit,
    withErrorHandling("check admin auth status", async (_req: Request, res: Response) => {
      const configured = !!process.env.ADMIN_TOKEN;
      res.json({ configured });
    })
  );

  app.post(
    "/api/admin/auth/setup",
    criticalOperationRateLimit,
    withErrorHandling("initial admin password setup", async (req: Request, res: Response) => {
      if (process.env.ADMIN_TOKEN) {
        res.status(409).json({
          error: "Admin password is already configured",
          code: "ALREADY_CONFIGURED",
        });
        return;
      }

      const { password } = adminPasswordVerifySchema.parse(req.body);

      if (!password || password.length < 8) {
        res.status(400).json({
          error: "Password must be at least 8 characters",
          code: "PASSWORD_TOO_SHORT",
        });
        return;
      }

      if (/[\r\n\0]/.test(password)) {
        res.status(400).json({
          error: "Password contains invalid characters",
          code: "INVALID_CHARACTERS",
        });
        return;
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");

      try {
        let envContent = "";
        try {
          envContent = await fs.readFile(envPath, "utf-8");
        } catch {
          envContent = "";
        }

        const finalContent = envContent
          ? `${envContent.trimEnd()}\nADMIN_TOKEN=${password}\n`
          : `ADMIN_TOKEN=${password}\n`;

        await fs.writeFile(envPath, finalContent, "utf-8");
        process.env.ADMIN_TOKEN = password;

        const crypto = await import("crypto");
        const sessionToken = crypto.randomBytes(32).toString("hex");

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2);

        const mockOrgId = "default-org-id";
        let adminUser = await storage.getUserByEmail("admin@example.com", mockOrgId);

        if (!adminUser) {
          adminUser = await storage.createUser({
            orgId: mockOrgId,
            email: "admin@example.com",
            name: "System Administrator",
            role: "admin",
            isActive: true,
          });
        }

        await storage.createAdminSession({
          orgId: mockOrgId,
          sessionToken,
          userId: adminUser.id,
          adminEmail: "admin@example.com",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          expiresAt,
          lastActivityAt: new Date(),
        });

        logger.info("AdminAuth", `Initial admin password configured from ${req.ip}`);

        const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
        res.json({
          success: true,
          sessionToken,
          expiresAt: expiresAt.toISOString(),
          expiresIn,
        });
      } catch (fileError) {
        logger.error("AdminAuth", "Failed to write .env file during setup", fileError);
        res.status(500).json({
          error: "Failed to persist admin password",
          code: "FILE_UPDATE_FAILED",
        });
      }
    })
  );

  app.post(
    "/api/admin/auth/change-password",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CHANGE_ADMIN_PASSWORD"),
    withErrorHandling("change admin password", async (req: Request, res: Response) => {
      const { currentPassword, newPassword } = adminPasswordChangeSchema.parse(req.body);

      const validAdminToken = process.env.ADMIN_TOKEN;

      if (!validAdminToken) {
        res.status(503).json({
          error: "Admin authentication is not configured",
          code: "ADMIN_SERVICE_DISABLED",
        });
        return;
      }

      if (currentPassword !== validAdminToken) {
        logger.warn("AdminAuth", `Failed admin password change attempt from ${req.ip}`);
        res.status(401).json({
          error: "Current password is incorrect",
          code: "INVALID_CURRENT_PASSWORD",
        });
        return;
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");

      try {
        const envContent = await fs.readFile(envPath, "utf-8");

        const updatedContent = envContent.replace(
          /^ADMIN_TOKEN=.*/m,
          `ADMIN_TOKEN=${newPassword}`
        );

        const finalContent = updatedContent.includes("ADMIN_TOKEN=")
          ? updatedContent
          : `${updatedContent}\nADMIN_TOKEN=${newPassword}\n`;

        await fs.writeFile(envPath, finalContent, "utf-8");

        process.env.ADMIN_TOKEN = newPassword;

        await storage.invalidateAllAdminSessions();

        logger.info("AdminAuth", `Admin password changed successfully from ${req.ip}`);

        res.json({
          success: true,
          message:
            "Password changed successfully. All admin sessions have been invalidated. Please log in again with your new password.",
        });
      } catch (fileError) {
        logger.error("AdminAuth", "Failed to update .env file", fileError);
        res.status(500).json({
          error:
            "Failed to persist password change. Please update ADMIN_TOKEN in your environment secrets manually.",
          code: "FILE_UPDATE_FAILED",
        });
      }
    })
  );
}

```

### `server/domains/system-admin/routes/audit-routes.ts` (76 lines)

```ts
/**
 * System Admin Routes - Audit Events
 * Admin audit event logging and retrieval
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";

export function registerAuditRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertAdminAuditEventSchema,
  } = deps;

  app.get(
    "/api/admin/audit",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_AUDIT_EVENTS"),
    withErrorHandling("fetch admin audit events", async (req: Request, res: Response) => {
      const { orgId, action, limit } = req.query;
      const events = await storage.getAdminAuditEvents(
        orgId as string,
        action as string,
        limit ? Number.parseInt(limit as string) : undefined
      );
      res.json(events);
    })
  );

  app.post(
    "/api/admin/audit",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_AUDIT_EVENT"),
    withErrorHandling("create admin audit event", async (req: Request, res: Response) => {
      const validatedData = insertAdminAuditEventSchema.parse(req.body);
      const event = await storage.createAdminAuditEvent(validatedData);
      sendCreated(res, event);
    })
  );

  app.get(
    "/api/admin/audit/user/:userId",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_USER_AUDIT_EVENTS"),
    withErrorHandling("fetch user audit events", async (req: Request, res: Response) => {
      const { userId } = req.params;
      const { orgId } = req.query;
      const events = await storage.getAuditEventsByUser(userId, orgId as string);
      res.json(events);
    })
  );

  app.get(
    "/api/admin/audit/resource/:resourceType/:resourceId",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_RESOURCE_AUDIT_EVENTS"),
    withErrorHandling("fetch resource audit events", async (req: Request, res: Response) => {
      const { resourceType, resourceId } = req.params;
      const { orgId } = req.query;
      const events = await storage.getAuditEventsByResource(
        resourceType,
        resourceId,
        orgId as string
      );
      res.json(events);
    })
  );
}

```

### `server/domains/system-admin/routes/settings-routes.ts` (138 lines)

```ts
/**
 * System Admin Routes - System Settings
 * Admin system settings CRUD and ML threshold calibration
 */

import { Express, Request, Response, z, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";

export function registerSettingsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    thresholdCalibrator,
    insertAdminSystemSettingSchema,
  } = deps;

  app.get(
    "/api/admin/settings",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SYSTEM_SETTINGS"),
    withErrorHandling("fetch admin system settings", async (req: Request, res: Response) => {
      const { orgId, category } = req.query;
      const settings = await storage.getAdminSystemSettings(orgId as string, category as string);
      res.json(settings);
    })
  );

  app.get(
    "/api/admin/settings/:orgId/:category/:key",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SYSTEM_SETTING"),
    withErrorHandling("fetch admin system setting", async (req: Request, res: Response) => {
      const { orgId, category, key } = req.params;
      const setting = await storage.getAdminSystemSetting(orgId, category, key);
      if (!setting) {
        return sendNotFound(res, "System setting");
      }
      res.json(setting);
    })
  );

  app.post(
    "/api/admin/settings",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_SYSTEM_SETTING"),
    withErrorHandling("create admin system setting", async (req: Request, res: Response) => {
      const validatedData = insertAdminSystemSettingSchema.parse(req.body);
      const setting = await storage.createAdminSystemSetting(validatedData);
      sendCreated(res, setting);
    })
  );

  app.put(
    "/api/admin/settings/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_SYSTEM_SETTING"),
    withErrorHandling("update admin system setting", async (req: Request, res: Response) => {
      const { id } = req.params;
      const validatedData = insertAdminSystemSettingSchema.partial().parse(req.body);
      const setting = await storage.updateAdminSystemSetting(id, validatedData);
      res.json(setting);
    })
  );

  app.delete(
    "/api/admin/settings/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_SYSTEM_SETTING"),
    withErrorHandling("delete admin system setting", async (req: Request, res: Response) => {
      const { id } = req.params;
      await storage.deleteAdminSystemSetting(id);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/admin/settings/:orgId/:category",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_SETTINGS_BY_CATEGORY"),
    withErrorHandling("fetch settings by category", async (req: Request, res: Response) => {
      const { orgId, category } = req.params;
      const settings = await storage.getSettingsByCategory(orgId, category);
      res.json(settings);
    })
  );

  app.post(
    "/api/admin/calibrate-threshold",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CALIBRATE_ML_THRESHOLD"),
    withErrorHandling("calibrate ML threshold", async (req: Request, res: Response) => {
      const calibrationSchema = z.object({
        equipmentId: z.string().min(1, "Equipment ID is required"),
      });

      const { equipmentId } = calibrationSchema.parse(req.body);

      const orgId = (req as Request & { session?: { orgId?: string } }).session?.orgId;
      if (!orgId) {
        res.status(401).json({ error: "Organization context required" });
        return;
      }

      logger.info("AdminSettings", `Calibrating threshold for equipment ${equipmentId} (org: ${orgId})`);

      const result = await thresholdCalibrator.calibrateForEquipment(orgId, equipmentId);

      try {
        const { realtimePredictionEngine } = await import("../../../ml-realtime-prediction.js");
        realtimePredictionEngine.invalidateThresholdCache(equipmentId);
      } catch (cacheError) {
        logger.warn("AdminSettings", "Could not invalidate threshold cache", cacheError);
      }

      res.status(200).json({
        success: true,
        equipmentId,
        threshold: result.threshold,
        sampleCount: result.sampleCount,
        statistics: result.statistics,
        calibratedAt: result.calibratedAt,
        method: result.method,
      });
    })
  );
}

```

### `server/domains/system-admin/routes/integrations-routes.ts` (97 lines)

```ts
/**
 * System Admin Routes - Integration Configs
 * External integration configuration management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";

export function registerIntegrationsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertIntegrationConfigSchema,
  } = deps;

  app.get(
    "/api/admin/integrations",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_INTEGRATION_CONFIGS"),
    withErrorHandling("fetch integration configs", async (req: Request, res: Response) => {
      const { orgId, type } = req.query;
      const integrations = await storage.getIntegrationConfigs(orgId as string, type as string);
      res.json(integrations);
    })
  );

  app.get(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_INTEGRATION_CONFIG"),
    withErrorHandling("fetch integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { orgId } = req.query;
      const integration = await storage.getIntegrationConfig(id, orgId as string);
      if (!integration) {
        return sendNotFound(res, "Integration config");
      }
      res.json(integration);
    })
  );

  app.post(
    "/api/admin/integrations",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_INTEGRATION_CONFIG"),
    withErrorHandling("create integration config", async (req: Request, res: Response) => {
      const validatedData = insertIntegrationConfigSchema.parse(req.body);
      const integration = await storage.createIntegrationConfig(validatedData);
      sendCreated(res, integration);
    })
  );

  app.put(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_INTEGRATION_CONFIG"),
    withErrorHandling("update integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      const validatedData = insertIntegrationConfigSchema.partial().parse(req.body);
      const integration = await storage.updateIntegrationConfig(id, validatedData);
      res.json(integration);
    })
  );

  app.delete(
    "/api/admin/integrations/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_INTEGRATION_CONFIG"),
    withErrorHandling("delete integration config", async (req: Request, res: Response) => {
      const { id } = req.params;
      await storage.deleteIntegrationConfig(id);
      sendDeleted(res);
    })
  );

  app.patch(
    "/api/admin/integrations/:id/health",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_INTEGRATION_HEALTH"),
    withErrorHandling("update integration health", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { healthStatus, errorMessage } = req.body;
      const integration = await storage.updateIntegrationHealth(id, healthStatus, errorMessage);
      res.json(integration);
    })
  );
}

```

### `server/domains/system-admin/routes/windows-routes.ts` (96 lines)

```ts
/**
 * System Admin Routes - Maintenance Windows
 * Scheduled maintenance window management
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";

export function registerWindowsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertMaintenanceWindowSchema,
  } = deps;

  app.get(
    "/api/admin/maintenance-windows",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_MAINTENANCE_WINDOWS"),
    withErrorHandling("fetch maintenance windows", async (req: Request, res: Response) => {
      const { orgId, status } = req.query;
      const windows = await storage.getMaintenanceWindows(orgId as string, status as string);
      res.json(windows);
    })
  );

  app.get(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_MAINTENANCE_WINDOW"),
    withErrorHandling("fetch maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      const { orgId } = req.query;
      const window = await storage.getMaintenanceWindow(id, orgId as string);
      if (!window) {
        return sendNotFound(res, "Maintenance window");
      }
      res.json(window);
    })
  );

  app.post(
    "/api/admin/maintenance-windows",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_MAINTENANCE_WINDOW"),
    withErrorHandling("create maintenance window", async (req: Request, res: Response) => {
      const validatedData = insertMaintenanceWindowSchema.parse(req.body);
      const window = await storage.createMaintenanceWindow(validatedData);
      sendCreated(res, window);
    })
  );

  app.put(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_MAINTENANCE_WINDOW"),
    withErrorHandling("update maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      const validatedData = insertMaintenanceWindowSchema.partial().parse(req.body);
      const window = await storage.updateMaintenanceWindow(id, validatedData);
      res.json(window);
    })
  );

  app.delete(
    "/api/admin/maintenance-windows/:id",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_MAINTENANCE_WINDOW"),
    withErrorHandling("delete maintenance window", async (req: Request, res: Response) => {
      const { id } = req.params;
      await storage.deleteMaintenanceWindow(id);
      sendDeleted(res);
    })
  );

  app.get(
    "/api/admin/maintenance-windows/active",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_ACTIVE_MAINTENANCE_WINDOWS"),
    withErrorHandling("fetch active maintenance windows", async (req: Request, res: Response) => {
      const { orgId } = req.query;
      const windows = await storage.getActiveMaintenanceWindows(orgId as string);
      res.json(windows);
    })
  );
}

```

### `server/domains/system-admin/routes/metrics-routes.ts` (75 lines)

```ts
/**
 * System Admin Routes - Performance Metrics
 * System performance monitoring and trends
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";

export function registerMetricsRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    insertSystemPerformanceMetricSchema,
  } = deps;

  app.get(
    "/api/admin/performance-metrics",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_PERFORMANCE_METRICS"),
    withErrorHandling("fetch system performance metrics", async (req: Request, res: Response) => {
      const { orgId, category, hours } = req.query;
      const metrics = await storage.getSystemPerformanceMetrics(
        orgId as string,
        category as string,
        hours ? Number.parseInt(hours as string) : undefined
      );
      res.json(metrics);
    })
  );

  app.post(
    "/api/admin/performance-metrics",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("CREATE_PERFORMANCE_METRIC"),
    withErrorHandling("create system performance metric", async (req: Request, res: Response) => {
      const validatedData = insertSystemPerformanceMetricSchema.parse(req.body);
      const metric = await storage.createSystemPerformanceMetric(validatedData);
      sendCreated(res, metric);
    })
  );

  app.get(
    "/api/admin/performance-metrics/:orgId/:category/latest",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_LATEST_METRICS"),
    withErrorHandling("fetch latest performance metrics", async (req: Request, res: Response) => {
      const { orgId, category } = req.params;
      const metrics = await storage.getLatestMetricsByCategory(orgId, category);
      res.json(metrics);
    })
  );

  app.get(
    "/api/admin/performance-metrics/:orgId/:metricName/trends",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_METRIC_TRENDS"),
    withErrorHandling("fetch metric trends", async (req: Request, res: Response) => {
      const { orgId, metricName } = req.params;
      const { hours } = req.query;
      const trends = await storage.getMetricTrends(
        orgId,
        metricName,
        hours ? Number.parseInt(hours as string) : 24
      );
      res.json(trends);
    })
  );
}

```

### `server/domains/system-admin/routes/simulation-routes.ts` (173 lines)

```ts
/**
 * System Admin Routes - Telemetry Simulation
 * Vessel telemetry simulation and stress testing
 */

import { Express, Request, Response, z, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";

export function registerSimulationRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    storage,
    generalApiRateLimit,
    writeOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
  } = deps;

  app.post(
    "/api/admin/simulate-telemetry",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("SIMULATE_TELEMETRY"),
    withErrorHandling("generate simulated telemetry", async (req: Request, res: Response) => {
      const { orgId } = req.body;

      if (!orgId) {
        res.status(400).json({ error: "orgId is required" });
        return;
      }

      const simulationConfigSchema = z.object({
        orgId: z.string(),
        vesselType: z.enum([
          "tug",
          "workboat",
          "pilot",
          "psv",
          "ahts",
          "crewboat",
          "survey",
          "multicat",
          "lct",
          "bunker",
          "errv",
        ]),
        equipmentId: z.string(),
        deviceId: z.string(),
        durationMinutes: z.number().min(1).max(480).default(60),
        samplingIntervalSeconds: z.number().min(1).max(60).default(1),
        injectFault: z.boolean().optional(),
        faultStartMinute: z.number().optional(),
        faultSeverity: z.number().min(0).max(1).optional(),
        signals: z.array(z.string()).optional(),
      });

      const config = simulationConfigSchema.parse(req.body);

      logger.info("AdminSimulation", `Generating simulated telemetry for ${config.vesselType} (${config.durationMinutes} min)`);

      const { getVesselSimulator } = await import("../../../vessel-simulator.js");
      const simulator = getVesselSimulator();

      const result = await simulator.simulateAndIngest(config);

      sendCreated(res, {
        success: true,
        vesselType: result.vesselType,
        equipmentId: result.equipmentId,
        pointsGenerated: result.dataPoints.length,
        statistics: result.statistics,
        message: `Successfully generated ${result.dataPoints.length} telemetry points`,
      });
    })
  );

  app.get(
    "/api/admin/vessel-types",
    requireAdminAuth,
    generalApiRateLimit,
    withErrorHandling("fetch vessel types", async (req: Request, res: Response) => {
      const { VESSEL_TYPE_PRESETS } = await import("../../../vessel-simulator-types.js");

      const vesselTypes = Object.entries(VESSEL_TYPE_PRESETS).map(([type, preset]) => ({
        type,
        ...preset,
      }));

      res.json({ vesselTypes });
    })
  );

  app.post(
    "/api/admin/telemetry/stress-test",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("RUN_TELEMETRY_STRESS_TEST"),
    withErrorHandling("run telemetry stress test", async (req: Request, res: Response) => {
      const stressTestSchema = z.object({
        equipmentId: z.string().min(1),
        orgId: z.string().min(1),
        durationSeconds: z.number().min(1).max(300).default(30),
        messagesPerSecond: z.number().min(10).max(2000).default(100),
        sensorTypes: z.array(z.string()).default(["temperature", "pressure", "vibration"]),
        useBatchWriter: z.boolean().default(true),
      });

      const config = stressTestSchema.parse(req.body);

      logger.info("AdminSimulation", `Starting telemetry stress test: ${config.messagesPerSecond} msg/sec for ${config.durationSeconds}s`);

      const { TelemetryStressTest } = await import("../../../vessel-simulator.js");
      const stressTest = new TelemetryStressTest(storage);
      const result = await stressTest.run(config);

      res.json({
        success: true,
        result,
        message: `Stress test completed: ${result.totalMessages} messages at ${result.actualMsgPerSec} msg/sec`,
      });
    })
  );

  app.post(
    "/api/admin/telemetry/fleet-stress-test",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("RUN_FLEET_STRESS_TEST"),
    withErrorHandling("run fleet stress test", async (req: Request, res: Response) => {
      const fleetStressSchema = z.object({
        vesselCount: z.number().min(1).max(50).default(20),
        sensorsPerVessel: z.number().min(1).max(50).default(30),
        durationSeconds: z.number().min(5).max(600).default(30),
        messagesPerSecondPerSensor: z.number().min(0.1).max(10).default(1),
        orgId: z.string().min(1),
        useBatchWriter: z.boolean().default(true),
      });

      const config = fleetStressSchema.parse(req.body);
      const totalSensors = config.vesselCount * config.sensorsPerVessel;
      const targetMsgPerSec = totalSensors * config.messagesPerSecondPerSensor;

      logger.info("AdminSimulation", `Starting fleet stress test: ${config.vesselCount} vessels, ${config.sensorsPerVessel} sensors each (${totalSensors} total), target ${targetMsgPerSec} msg/sec for ${config.durationSeconds}s`);

      const { initFleetStressTest, getFleetStressTest } = await import("../../../vessel-simulator.js");
      let fleetStressTest;
      try {
        fleetStressTest = getFleetStressTest();
      } catch {
        fleetStressTest = initFleetStressTest(storage);
      }
      const result = await fleetStressTest.run(config);

      res.json({
        success: true,
        result,
        summary: {
          totalVessels: result.totalVessels,
          totalSensors: result.totalSensors,
          totalMessages: result.totalMessages,
          actualMsgPerSec: result.actualMsgPerSec,
          targetMsgPerSec: result.targetMsgPerSec,
          efficiency: `${Math.round(result.actualMsgPerSec / result.targetMsgPerSec * 100)}%`,
          errors: result.errors,
          dropped: result.dropped,
          memoryUsageMB: result.memoryUsageMB,
          avgLatencyMs: result.avgLatencyMs,
        },
        message: `Fleet stress test completed: ${result.totalMessages} messages from ${result.totalVessels} vessels at ${result.actualMsgPerSec} msg/sec`,
      });
    })
  );
}

```

### `server/domains/permissions/routes.ts` (436 lines)

```ts
/**
 * Permission Routes - API Endpoints for Permission Management
 * 
 * CRUD operations for roles, permissions, and user assignments.
 */

import type { Express, Request, Response } from "express";
import { permissionRepository } from "./repository";
import { permissionService, compileUserPermissions } from "./service";
import { requireOrgId, AuthenticatedRequest } from "../../middleware/auth";
import { withErrorHandling, sendCreated, sendDeleted } from "../../lib/route-utils";
import { insertRoleSchema, insertUserRoleAssignmentSchema } from "../../../shared/schema/permissions";
import { RESOURCES, ACTIONS, RESOURCE_CATEGORIES } from "../../config/permission-registry";
import { z } from "zod";

const DEV_MODE = process.env.NODE_ENV === "development";
const DEV_ORG_ID = "default-org-id";
const DEV_USER_ID = "dev-user-id";

export function registerPermissionRoutes(app: Express) {
  app.get("/api/permissions/me", requireOrgId,
    withErrorHandling("get current user permissions", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId || DEV_ORG_ID;
      const userId = (req as AuthenticatedRequest).user?.id || DEV_USER_ID;
      
      if (DEV_MODE) {
        const allPermissions: Record<string, Record<string, boolean>> = {};
        for (const resource of RESOURCES) {
          allPermissions[resource.code] = {};
          for (const action of resource.actions) {
            allPermissions[resource.code][action] = true;
          }
        }
        return res.json({
          userId: DEV_USER_ID,
          orgId: DEV_ORG_ID,
          roles: [{ id: "dev-role", name: "developer", displayName: "Developer (Dev Mode)" }],
          permissions: allPermissions,
          isDevMode: true,
        });
      }
      
      const compiled = await compileUserPermissions(userId, orgId);
      res.json({
        ...compiled,
        isDevMode: false,
      });
    })
  );

  app.get("/api/permissions/resources", requireOrgId,
    withErrorHandling("list permission resources", async (_req: Request, res: Response) => {
      const resources = await permissionRepository.listResources();
      res.json(resources);
    })
  );

  app.get("/api/permissions/actions", requireOrgId,
    withErrorHandling("list permission actions", async (_req: Request, res: Response) => {
      const actions = await permissionRepository.listActions();
      res.json(actions);
    })
  );

  app.get("/api/permissions/registry", requireOrgId,
    withErrorHandling("get permission registry", async (_req: Request, res: Response) => {
      res.json({
        resources: RESOURCES,
        actions: ACTIONS,
        categories: RESOURCE_CATEGORIES,
      });
    })
  );

  app.get("/api/permissions/roles", requireOrgId,
    withErrorHandling("list roles", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const roles = await permissionRepository.listRoles(orgId);
      res.json(roles);
    })
  );

  app.get("/api/permissions/roles/:id", requireOrgId,
    withErrorHandling("get role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const role = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    })
  );

  app.post("/api/permissions/roles", requireOrgId,
    withErrorHandling("create role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const data = insertRoleSchema.parse({ ...req.body, orgId });
      const role = await permissionRepository.createRole(data);
      
      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "create_role",
        "role",
        role.id,
        null,
        JSON.stringify({ name: role.name, displayName: role.displayName })
      );
      
      sendCreated(res, role);
    })
  );

  app.put("/api/permissions/roles/:id", requireOrgId,
    withErrorHandling("update role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      // Security: Strip orgId from body to prevent cross-tenant mutation
      const { orgId: _, ...bodyWithoutOrgId } = req.body;
      const data = insertRoleSchema.partial().parse(bodyWithoutOrgId);
      const updated = await permissionRepository.updateRole(req.params.id, orgId, data);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_role",
        "role",
        req.params.id,
        JSON.stringify(existing),
        JSON.stringify(updated)
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      res.json(updated);
    })
  );

  app.patch("/api/permissions/roles/:id", requireOrgId,
    withErrorHandling("partial update role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      if (existing.isSystemRole) {
        return res.status(400).json({ message: "Cannot modify system roles" });
      }

      // Security: Strip orgId from body to prevent cross-tenant mutation
      const { orgId: _, ...bodyWithoutOrgId } = req.body;
      const data = insertRoleSchema.partial().parse(bodyWithoutOrgId);
      const updated = await permissionRepository.updateRole(req.params.id, orgId, data);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_role",
        "role",
        req.params.id,
        JSON.stringify(existing),
        JSON.stringify(updated)
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      res.json(updated);
    })
  );

  app.delete("/api/permissions/roles/:id", requireOrgId,
    withErrorHandling("delete role", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!existing) {
        return res.status(404).json({ message: "Role not found" });
      }

      if (existing.isSystemRole) {
        return res.status(400).json({ message: "Cannot delete system roles" });
      }

      // Check if any crew members are assigned to this role
      const crewWithRole = await permissionRepository.getCrewCountByRoleId(req.params.id, orgId);
      if (crewWithRole > 0) {
        return res.status(400).json({ 
          message: `Cannot delete role: ${crewWithRole} crew member(s) are currently assigned to this role. Please reassign them first.`,
          crewCount: crewWithRole
        });
      }

      await permissionRepository.deleteRole(req.params.id, orgId);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "delete_role",
        "role",
        req.params.id,
        JSON.stringify(existing),
        null
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      sendDeleted(res);
    })
  );

  app.get("/api/permissions/roles/:id/grants", requireOrgId,
    withErrorHandling("get role permission grants", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const grants = await permissionRepository.getPermissionGrantsForRole(req.params.id, orgId);
      res.json(grants);
    })
  );

  const grantSchema = z.object({
    resourceCode: z.string(),
    actionCode: z.string(),
    isGranted: z.boolean(),
  });

  app.put("/api/permissions/roles/:id/grants", requireOrgId,
    withErrorHandling("update role permission grants", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const role = await permissionRepository.getRoleById(req.params.id, orgId);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }

      const grantsArray = z.array(grantSchema).parse(req.body.grants || req.body);

      await permissionRepository.bulkSetPermissionGrants(orgId, req.params.id, grantsArray);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "update_grants",
        "role",
        req.params.id,
        null,
        JSON.stringify({ grants: grantsArray.length })
      );

      permissionService.invalidateOrgPermissionCache(orgId);

      res.json({ success: true, message: `Updated ${grantsArray.length} permission grants` });
    })
  );

  app.get("/api/permissions/templates", requireOrgId,
    withErrorHandling("list role templates", async (_req: Request, res: Response) => {
      const templates = await permissionRepository.listRoleTemplates();
      res.json(templates);
    })
  );

  app.post("/api/permissions/roles/from-template", requireOrgId,
    withErrorHandling("create role from template", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const { templateId, overrides } = req.body;

      if (!templateId) {
        return res.status(400).json({ message: "templateId is required" });
      }

      const role = await permissionRepository.createRoleFromTemplate(templateId, orgId, overrides);

      const authReq = req as AuthenticatedRequest;
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "create_role_from_template",
        "role",
        role.id,
        null,
        JSON.stringify({ templateId, name: role.name })
      );

      sendCreated(res, role);
    })
  );

  app.get("/api/permissions/users/:userId/assignments", requireOrgId,
    withErrorHandling("list user role assignments", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const assignments = await permissionRepository.listUserRoleAssignments(
        req.params.userId,
        orgId
      );
      res.json(assignments);
    })
  );

  app.post("/api/permissions/users/:userId/assignments", requireOrgId,
    withErrorHandling("assign role to user", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const authReq = req as AuthenticatedRequest;

      const data = insertUserRoleAssignmentSchema.parse({
        ...req.body,
        orgId,
        userId: req.params.userId,
        assignedBy: authReq.user?.id,
      });

      const assignment = await permissionRepository.assignRoleToUser(data);

      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "assign_role",
        "user_role_assignment",
        assignment.id,
        null,
        JSON.stringify({ userId: req.params.userId, roleId: data.roleId })
      );

      permissionService.invalidateUserPermissionCache(req.params.userId, orgId);

      sendCreated(res, assignment);
    })
  );

  app.delete("/api/permissions/users/:userId/assignments/:roleId", requireOrgId,
    withErrorHandling("remove role from user", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const authReq = req as AuthenticatedRequest;

      await permissionRepository.removeRoleFromUser(req.params.userId, req.params.roleId, orgId);

      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "remove_role",
        "user_role_assignment",
        null,
        JSON.stringify({ userId: req.params.userId, roleId: req.params.roleId }),
        null
      );

      permissionService.invalidateUserPermissionCache(req.params.userId, orgId);

      sendDeleted(res);
    })
  );

  app.get("/api/permissions/users-with-roles", requireOrgId,
    withErrorHandling("list users with role assignments", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const usersWithRoles = await permissionRepository.listUsersWithRoles(orgId);
      res.json(usersWithRoles);
    })
  );

  app.get("/api/permissions/me", requireOrgId,
    withErrorHandling("get my permissions", async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;
      const orgId = authReq.orgId;

      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const permissions = await permissionService.getAllUserPermissions(userId, orgId);
      const roles = await permissionService.getUserRoles(userId, orgId);

      res.json({ userId, orgId, roles, permissions });
    })
  );

  app.get("/api/permissions/audit", requireOrgId,
    withErrorHandling("get permission audit log", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const auditLog = await permissionRepository.getPermissionAuditLog(orgId, limit);
      res.json(auditLog);
    })
  );

  app.post("/api/permissions/seed", requireOrgId,
    withErrorHandling("seed permission resources", async (_req: Request, res: Response) => {
      await permissionRepository.seedResourcesAndActions();
      res.json({ success: true, message: "Permission resources seeded" });
    })
  );

  app.post("/api/permissions/seed-templates", requireOrgId,
    withErrorHandling("seed default role templates", async (_req: Request, res: Response) => {
      const result = await permissionRepository.seedDefaultRoleTemplates();
      res.json({ 
        success: true, 
        message: `Role templates seeded: ${result.created} created, ${result.skipped} skipped`,
        ...result 
      });
    })
  );

  app.post("/api/permissions/setup", requireOrgId,
    withErrorHandling("initial permission setup", async (req: Request, res: Response) => {
      const orgId = (req as AuthenticatedRequest).orgId;
      const authReq = req as AuthenticatedRequest;
      
      await permissionRepository.seedResourcesAndActions();
      const templatesResult = await permissionRepository.seedDefaultRoleTemplates();
      
      await permissionRepository.logPermissionChange(
        orgId,
        authReq.user?.id || "system",
        "initial_setup",
        "system",
        null,
        null,
        JSON.stringify({ templatesCreated: templatesResult.created })
      );
      
      res.json({
        success: true,
        message: "Permission system initialized",
        templates: templatesResult,
      });
    })
  );
}

```

### `server/domains/settings/routes.ts` (205 lines)

```ts
import { Express, Request, Response, RequestHandler } from "express";
import { insertSettingsSchema } from "@shared/schema-runtime";
import { withErrorHandling, sendDeleted, sendCreated } from "../../lib/route-utils";
import { getOpenAIApiKey, type SettingsAccessor } from "../../openai/client";

interface SettingsConfig {
  storage: any;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
}

export function registerSettingsRoutes(app: Express, config: SettingsConfig) {
  const { storage, requireOrgId, writeOperationRateLimit } = config;

  // System settings
  app.get("/api/settings", requireOrgId,
    withErrorHandling("fetch settings", async (_req: Request, res: Response) => {
      const settings = await storage.getSettings();
      res.json(settings);
    })
  );

  app.put("/api/settings", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update settings", async (req: Request, res: Response) => {
      const settingsData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(settingsData);
      res.json(settings);
    })
  );

  app.get("/api/settings/validate-openai-key", requireOrgId, writeOperationRateLimit,
    withErrorHandling("validate OpenAI API key", async (_req: Request, res: Response) => {
      try {
        // Use injected storage instance to avoid circular dependency and respect tenant isolation
        const settingsAccessor: SettingsAccessor = async () => storage.getSettings();
        const apiKey = await getOpenAIApiKey(settingsAccessor);
        
        if (!apiKey) {
          res.json({
            valid: false,
            status: 'not_configured',
            message: 'No OpenAI API key configured',
            source: null,
          });
          return;
        }

        const keySource = apiKey.startsWith('sk-') ? 'user_configured' : 'ai_integrations';

        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey, timeout: 10000 });
        
        await client.models.list();
        
        res.json({
          valid: true,
          status: 'active',
          message: 'API key is valid and working',
          source: keySource,
        });
      } catch (error: any) {
        const errorMessage = error?.message?.toLowerCase() || '';
        
        if (errorMessage.includes('invalid_api_key') || errorMessage.includes('authentication')) {
          res.json({
            valid: false,
            status: 'invalid',
            message: 'API key is invalid or expired',
            source: 'unknown',
          });
        } else if (errorMessage.includes('rate_limit')) {
          res.json({
            valid: true,
            status: 'rate_limited',
            message: 'API key is valid but rate limited',
            source: 'unknown',
          });
        } else {
          res.json({
            valid: false,
            status: 'error',
            message: `Validation failed: ${error.message}`,
            source: 'unknown',
          });
        }
      }
    })
  );

  // Context events (for AI/ML context)
  app.get("/api/context/events", requireOrgId,
    withErrorHandling("fetch context events", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const { equipmentId, eventType, limit } = req.query;
      const events = await storage.getContextEvents?.({
        orgId,
        equipmentId: equipmentId as string,
        eventType: eventType as string,
        limit: limit ? Number.parseInt(limit as string) : 100,
      });
      res.json(events ?? []);
    })
  );

  app.post("/api/context/events", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create context event", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const event = await storage.createContextEvent?.({ ...req.body, orgId });
      sendCreated(res, event || req.body);
    })
  );

  app.delete("/api/context/events/:id", requireOrgId, writeOperationRateLimit,
    withErrorHandling("delete context event", async (req: Request, res: Response) => {
      await storage.deleteContextEvent?.(req.params.id);
      sendDeleted(res);
    })
  );

  // Development utilities (only in non-production)
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/dev/debug", requireOrgId,
      withErrorHandling("fetch debug info", async (_req: Request, res: Response) => {
        const debug = {
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          uptime: process.uptime(),
        };
        res.json(debug);
      })
    );

    app.post("/api/dev/reset-cache", requireOrgId,
      withErrorHandling("reset cache", async (_req: Request, res: Response) => {
        res.json({ message: "Cache reset successfully", timestamp: new Date().toISOString() });
      })
    );

    app.get("/api/dev/config", requireOrgId,
      withErrorHandling("fetch config", async (_req: Request, res: Response) => {
        const configData = {
          database: process.env.DATABASE_URL ? "postgresql" : "sqlite",
          redis: !!process.env.REDIS_URL,
          environment: process.env.NODE_ENV,
        };
        res.json(configData);
      })
    );
  }

  // Fleet management
  app.get("/api/fleet/summary", requireOrgId,
    withErrorHandling("fetch fleet summary", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vessels = await storage.getVessels(orgId);
      const equipment = await storage.getEquipmentRegistry(orgId);

      const summary = {
        vesselCount: vessels.length,
        equipmentCount: equipment.length,
        activeVessels: vessels.filter((v: any) => v.status === "active").length,
        timestamp: new Date().toISOString(),
      };

      res.json(summary);
    })
  );

  app.get("/api/fleet/status", requireOrgId,
    withErrorHandling("fetch fleet status", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const vessels = await storage.getVessels(orgId);

      const status = vessels.map((vessel: any) => ({
        id: vessel.id,
        name: vessel.name,
        status: vessel.status || "unknown",
        lastUpdate: vessel.updatedAt,
      }));

      res.json(status);
    })
  );

  // Telemetry replay (for debugging/analysis)
  app.get("/api/replay/sessions", requireOrgId,
    withErrorHandling("fetch replay sessions", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const sessions = await storage.getReplaySessions?.(orgId);
      res.json(sessions ?? []);
    })
  );

  app.post("/api/replay/sessions", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create replay session", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const session = await storage.createReplaySession?.({ ...req.body, orgId });
      sendCreated(res, session || req.body);
    })
  );
}

```

### `server/domains/config-management/routes.ts` (218 lines)

```ts
/**
 * Configuration Management Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 * 
 * Provides hot config reload, config CRUD, and config audit
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { sql } from "drizzle-orm";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

interface ConfigManagementDependencies {
  db: any;
  configAuditLog: any;
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
}

export function registerConfigManagementRoutes(
  app: Express,
  deps: ConfigManagementDependencies
): void {
  const {
    db,
    configAuditLog,
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
  } = deps;

  app.post(
    "/api/admin/config/reload",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("RELOAD_CONFIGURATION"),
    withErrorHandling("reload configuration", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const orgId = req.header("x-org-id") || "default-org-id";

      const result = await configManager.reloadConfig({
        orgId,
        changedBy: (req as AuthenticatedRequest).user?.id,
        changedByName: (req as AuthenticatedRequest).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        autoReload: false,
      });

      if (result.success && result.changed.length > 0) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast({
          type: "config_updated",
          timestamp: new Date().toISOString(),
          changesCount: result.changed.length,
          requiresRestart: result.requiresRestart,
        });
      }

      res.json(result);
    })
  );

  app.get(
    "/api/admin/config",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_CONFIGURATION"),
    withErrorHandling("get configuration", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const config = configManager.getAll();

      const sanitized: Record<string, string> = {};
      const sensitiveKeys = ["PASSWORD", "SECRET", "KEY", "TOKEN", "PRIVATE"];

      for (const [key, value] of Object.entries(config)) {
        if (sensitiveKeys.some((s) => key.includes(s))) {
          sanitized[key] = "***REDACTED***";
        } else {
          sanitized[key] = value;
        }
      }

      res.json({ config: sanitized });
    })
  );

  app.get(
    "/api/admin/config/:key",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_CONFIG_VALUE"),
    withErrorHandling("get configuration value", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const { key } = req.params;
      const value = configManager.get(key);
      const isCritical = configManager.isCritical(key);

      if (value === undefined) {
        return res.status(404).json({ error: "Configuration key not found" });
      }

      const sensitiveKeys = ["PASSWORD", "SECRET", "KEY", "TOKEN", "PRIVATE"];
      const isSensitive = sensitiveKeys.some((s) => key.includes(s));

      res.json({
        key,
        value: isSensitive ? "***REDACTED***" : value,
        isCritical,
        isSensitive,
      });
    })
  );

  app.put(
    "/api/admin/config/:key",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("UPDATE_CONFIG_VALUE"),
    withErrorHandling("update configuration value", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined || value === null) {
        return res.status(400).json({ error: "Value is required" });
      }

      const orgId = req.header("x-org-id") || "default-org-id";

      const result = await configManager.set(key, String(value), {
        orgId,
        changedBy: (req as AuthenticatedRequest).user?.id,
        changedByName: (req as AuthenticatedRequest).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      if (result.success) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast({
          type: "config_updated",
          timestamp: new Date().toISOString(),
          key,
          requiresRestart: result.requiresRestart,
        });
      }

      res.json(result);
    })
  );

  app.delete(
    "/api/admin/config/:key",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_CONFIG_VALUE"),
    withErrorHandling("delete configuration value", async (req: Request, res: Response) => {
      const { configManager } = await import("../../services/config-manager");
      const { key } = req.params;
      const orgId = req.header("x-org-id") || "default-org-id";

      const result = await configManager.delete(key, {
        orgId,
        changedBy: (req as AuthenticatedRequest).user?.id,
        changedByName: (req as AuthenticatedRequest).user?.name || "Admin",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      if (result.success) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcast({
          type: "config_updated",
          timestamp: new Date().toISOString(),
          key,
          deleted: true,
          requiresRestart: result.requiresRestart,
        });
      }

      res.json(result);
    })
  );

  app.get(
    "/api/admin/config/audit",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_CONFIG_AUDIT"),
    withErrorHandling("fetch config audit log", async (req: Request, res: Response) => {
      const orgId = req.header("x-org-id") || "default-org-id";
      const { key, limit } = req.query;

      const auditLogs = await db
        .select()
        .from(configAuditLog)
        .where(
          key
            ? sql`${configAuditLog.orgId} = ${orgId} AND ${configAuditLog.key} = ${key}`
            : sql`${configAuditLog.orgId} = ${orgId}`
        )
        .orderBy(sql`${configAuditLog.changedAt} DESC`)
        .limit(limit ? Number.parseInt(limit as string) : 100);

      res.json(auditLogs);
    })
  );

  logger.info("ConfigManagementRoutes", "Registered (reload: 1, config: 4, audit: 1)");
}

```

### `server/domains/software-updates/routes.ts` (252 lines)

```ts
/**
 * Software Updates Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 * 
 * Provides update checking, patch management, and rollback functionality
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling, handleApiError } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

interface SoftwareUpdatesDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  writeOperationRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
}

export function registerSoftwareUpdatesRoutes(
  app: Express,
  deps: SoftwareUpdatesDependencies
): void {
  const {
    generalApiRateLimit,
    writeOperationRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
  } = deps;

  app.post(
    "/api/admin/updates/check",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("CHECK_FOR_UPDATES"),
    withErrorHandling("check for updates", async (req: Request, res: Response) => {
      const { getUpdateChecker } = await import("../../services/update-checker");
      const updateChecker = await getUpdateChecker();
      const orgId = req.header("x-org-id") || "default-org-id";
      const { channel } = req.query;

      const manifest = await updateChecker.checkForUpdates(
        orgId,
        (channel as string) || "stable"
      );

      if (manifest) {
        const patch = await updateChecker.registerPatch(orgId, manifest);

        const { wsServer } = await import("../../websocket");
        wsServer.broadcast({
          type: "update_available",
          version: manifest.version,
          severity: manifest.severity,
          patchId: patch.id,
        });

        res.json({ available: true, manifest, patchId: patch.id });
      } else {
        res.json({ available: false });
      }
    })
  );

  app.get(
    "/api/admin/patches",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_PATCHES"),
    withErrorHandling("fetch patches", async (req: Request, res: Response) => {
      const { getUpdateChecker } = await import("../../services/update-checker");
      const updateChecker = await getUpdateChecker();
      const orgId = req.header("x-org-id") || "default-org-id";

      const patches = await updateChecker.getAvailablePatches(orgId);
      res.json(patches);
    })
  );

  app.get(
    "/api/admin/patches/history",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_PATCH_HISTORY"),
    withErrorHandling("fetch patch history", async (req: Request, res: Response) => {
      const { getUpdateChecker } = await import("../../services/update-checker");
      const updateChecker = await getUpdateChecker();
      const orgId = req.header("x-org-id") || "default-org-id";
      const { limit } = req.query;

      const patches = await updateChecker.getPatchHistory(
        orgId,
        limit ? Number.parseInt(limit as string) : 50
      );
      res.json(patches);
    })
  );

  app.post(
    "/api/admin/patches/:id/download",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("DOWNLOAD_PATCH"),
    withErrorHandling("download patch", async (req: Request, res: Response) => {
      const { getUpdateChecker } = await import("../../services/update-checker");
      const updateChecker = await getUpdateChecker();
      const { id } = req.params;
      const orgId = req.header("x-org-id") || "default-org-id";

      const patchPath = await updateChecker.downloadPatch(id, orgId);

      res.json({
        success: true,
        patchId: id,
        path: patchPath,
      });
    })
  );

  app.post(
    "/api/admin/patches/:id/apply",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("APPLY_PATCH"),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      try {
        const { patchApplicator } = await import("../../services/patch-applicator");
        const { patchPath } = req.body;

        if (!patchPath) {
          return res.status(400).json({ error: "Patch path is required" });
        }

        const { wsServer } = await import("../../websocket");
        const startTimestamp = new Date().toISOString();
        wsServer.broadcastUpdateNotification({
          id: `patch-started-${id}-${Date.now()}`,
          type: "update_started",
          message: `Patch ${id} is being applied...`,
          severity: "info",
          timestamp: startTimestamp,
          metadata: {
            patchId: id,
            initiatedBy: (req as AuthenticatedRequest).user?.id,
          },
        });

        const result = await patchApplicator.applyPatch(id, patchPath, (req as AuthenticatedRequest).user?.id);

        if (result.success) {
          wsServer.broadcastUpdateNotification({
            id: `patch-applied-${id}-${Date.now()}`,
            type: "update_completed",
            message: `Patch ${id} was successfully applied. Restart may be required.`,
            severity: "info",
            metadata: {
              patchId: id,
              appliedBy: (req as AuthenticatedRequest).user?.id,
              requiresRestart: true,
            },
          });
        } else {
          wsServer.broadcastUpdateNotification({
            id: `patch-failed-${id}-${Date.now()}`,
            type: "update_failed",
            message: `Patch ${id} application failed: ${result.error || "Unknown error"}`,
            severity: "critical",
            metadata: {
              patchId: id,
              error: result.error,
            },
          });
        }

        res.json(result);
      } catch (error) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcastUpdateNotification({
          id: `patch-error-${id}-${Date.now()}`,
          type: "update_failed",
          message: `Patch application encountered an error`,
          severity: "critical",
          metadata: {
            patchId: id,
            error: String(error),
          },
        });
        handleApiError(res, error, "apply patch");
      }
    }
  );

  app.post(
    "/api/admin/patches/rollback/:backupId",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("ROLLBACK_PATCH"),
    async (req: Request, res: Response) => {
      const { backupId } = req.params;
      try {
        const { patchApplicator } = await import("../../services/patch-applicator");

        await patchApplicator.rollback(backupId);

        const { wsServer } = await import("../../websocket");
        wsServer.broadcastUpdateNotification({
          id: `rollback-${backupId}-${Date.now()}`,
          type: "update_rollback",
          message: `System has been rolled back to backup ${backupId}`,
          severity: "warning",
          metadata: {
            backupId,
            rolledBackBy: (req as AuthenticatedRequest).user?.id,
          },
        });

        res.json({ success: true, backupId });
      } catch (error) {
        const { wsServer } = await import("../../websocket");
        wsServer.broadcastUpdateNotification({
          id: `rollback-error-${backupId}-${Date.now()}`,
          type: "update_failed",
          message: `Rollback to backup ${backupId} failed`,
          severity: "critical",
          metadata: {
            backupId,
            error: String(error),
          },
        });
        handleApiError(res, error, "rollback patch");
      }
    }
  );

  app.get(
    "/api/admin/backups",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_BACKUPS"),
    withErrorHandling("list backups", async (req: Request, res: Response) => {
      const { patchApplicator } = await import("../../services/patch-applicator");
      const backups = patchApplicator.listBackups();
      res.json(backups);
    })
  );

  logger.info("SoftwareUpdatesRoutes", "Registered (updates: 1, patches: 5, backups: 1)");
}

```

### `server/domains/data-export/routes.ts` (162 lines)

```ts
/**
 * Data Export/Import Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 * 
 * Provides data export, import, and backup management
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling, sendNotFound } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

interface DataExportDependencies {
  generalApiRateLimit: RateLimitRequestHandler;
  criticalOperationRateLimit: RateLimitRequestHandler;
  requireAdminAuth: any;
  auditAdminAction: (action: string) => any;
  upload: any;
}

export function registerDataExportRoutes(
  app: Express,
  deps: DataExportDependencies
): void {
  const {
    generalApiRateLimit,
    criticalOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
    upload,
  } = deps;

  // Export org data
  app.post(
    "/api/admin/export",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("EXPORT_DATA"),
    withErrorHandling("export data", async (req: Request, res: Response) => {
      const { getDataExportImportService } = await import("../../services/data-export-import");
      const service = getDataExportImportService();
      const orgId = req.header("x-org-id") || req.body.orgId || "default-org-id";
      const exportedBy = (req as AuthenticatedRequest).user?.id || "admin";

      const result = await service.exportOrg(orgId, {
        includeTelemetry: req.body.includeTelemetry ?? false,
        telemetryDays: req.body.telemetryDays ?? 30,
        includeKnowledgeBase: req.body.includeKnowledgeBase ?? true,
        includeAuditLogs: req.body.includeAuditLogs ?? false,
      }, exportedBy);

      if (result.success) {
        res.json({
          success: true,
          exportId: result.exportId,
          downloadUrl: `/api/admin/export/download/${result.exportId}`,
          manifest: result.manifest,
          duration: result.duration,
        });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    })
  );

  // Download export file
  app.get(
    "/api/admin/export/download/:exportId",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("DOWNLOAD_EXPORT"),
    withErrorHandling("download export", async (req: Request, res: Response) => {
      const { getDataExportImportService } = await import("../../services/data-export-import");
      const service = getDataExportImportService();
      const exports = await service.listExports();
      const exportFile = exports.find((e: any) => e.id === req.params.exportId);

      if (!exportFile) {
        return sendNotFound(res, "Export");
      }

      const fs = await import("fs");

      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename="${req.params.exportId}.tar.gz"`);

      const fileStream = fs.createReadStream(exportFile.path);
      fileStream.pipe(res);
    })
  );

  // List available exports
  app.get(
    "/api/admin/exports",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_EXPORTS"),
    withErrorHandling("list exports", async (req: Request, res: Response) => {
      const { getDataExportImportService } = await import("../../services/data-export-import");
      const service = getDataExportImportService();
      const exports = await service.listExports();

      res.json(exports.map((e: any) => ({
        id: e.id,
        createdAt: e.createdAt,
        size: e.size,
        downloadUrl: `/api/admin/export/download/${e.id}`,
      })));
    })
  );

  // Delete an export
  app.delete(
    "/api/admin/export/:exportId",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("DELETE_EXPORT"),
    withErrorHandling("delete export", async (req: Request, res: Response) => {
      const { getDataExportImportService } = await import("../../services/data-export-import");
      const service = getDataExportImportService();
      const deleted = await service.deleteExport(req.params.exportId);

      if (deleted) {
        res.json({ success: true });
      } else {
        sendNotFound(res, "Export");
      }
    })
  );

  // Import data (file upload)
  app.post(
    "/api/admin/import",
    requireAdminAuth,
    criticalOperationRateLimit,
    auditAdminAction("IMPORT_DATA"),
    upload.single("file"),
    withErrorHandling("import data", async (req: Request, res: Response) => {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { getDataExportImportService } = await import("../../services/data-export-import");
      const service = getDataExportImportService();

      const result = await service.importData(req.file.path, {
        targetOrgId: req.body.targetOrgId || req.header("x-org-id"),
        dryRun: req.body.dryRun === "true",
        skipTelemetry: req.body.skipTelemetry === "true",
        conflictResolution: req.body.conflictResolution || "upsert",
      });

      const fs = await import("fs");
      fs.unlinkSync(req.file.path);

      res.json(result);
    })
  );

  logger.info("DataExportRoutes", "Registered (export: 2, import: 1, list: 2)");
}

```

### `server/domains/storage-config/routes.ts` (171 lines)

```ts
/**
 * Storage Config Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 * 
 * Object storage configuration, ops database, and file management
 */

import { Express, Request, Response } from "express";
import { withErrorHandling, sendNotFound, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface StorageConfigDependencies {}

export function registerStorageConfigRoutes(
  app: Express,
  deps: StorageConfigDependencies
): void {
  // Get storage configuration
  app.get("/api/storage/config",
    withErrorHandling("list storage configurations", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { kind } = req.query;
      const configs = await storageConfigService.list(kind as string);
      res.json(configs);
    })
  );

  // Create/update storage configuration
  app.post("/api/storage/config",
    withErrorHandling("save storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { insertStorageConfigSchema } = await import("@shared/schema");
      const validatedData = insertStorageConfigSchema.parse(req.body);
      await storageConfigService.upsert(validatedData);
      res.json({ success: true });
    })
  );

  // Delete storage configuration
  app.delete("/api/storage/config/:id",
    withErrorHandling("delete storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      await storageConfigService.delete(req.params.id);
      sendDeleted(res);
    })
  );

  // Test storage configuration
  app.post("/api/storage/config/test",
    withErrorHandling("test storage configuration", async (req: Request, res: Response) => {
      const { storageConfigService } = await import("../../storage-config");
      const { insertStorageConfigSchema } = await import("@shared/schema");
      const validatedData = insertStorageConfigSchema.parse(req.body);
      const result = await storageConfigService.test(validatedData);
      res.json(result);
    })
  );

  // Get current ops database
  app.get("/api/storage/ops-db/current",
    withErrorHandling("get current operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const current = await opsDbService.getCurrent();
      res.json(current);
    })
  );

  // Stage ops database URL
  app.post("/api/storage/ops-db/stage",
    withErrorHandling("stage operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      await opsDbService.stage(url);
      res.json({ success: true });
    })
  );

  // Get staged ops database
  app.get("/api/storage/ops-db/staged",
    withErrorHandling("get staged operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const staged = await opsDbService.getStaged();
      res.json(staged);
    })
  );

  // Test ops database connection
  app.post("/api/storage/ops-db/test",
    withErrorHandling("test operational database", async (req: Request, res: Response) => {
      const { opsDbService } = await import("../../storage-config");
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      const result = await opsDbService.test(url);
      res.json(result);
    })
  );

  // Public object access
  app.get("/public-objects/:filePath(*)",
    withErrorHandling("search for public object", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const filePath = req.params.filePath;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return sendNotFound(res, "File");
      }
      objectStorageService.downloadObject(file, res);
    })
  );

  // Upload object
  app.post("/api/objects/upload",
    withErrorHandling("get upload URL", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      if (!(await objectStorageService.isConfigured())) {
        return res.status(503).json({
          error: "Object storage not configured",
          message: "Please configure PUBLIC_OBJECT_SEARCH_PATHS and PRIVATE_OBJECT_DIR environment variables",
        });
      }
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    })
  );

  // Get object (private with ACL)
  app.get("/objects/:objectPath(*)",
    withErrorHandling("access object", async (req: Request, res: Response) => {
      const { ObjectStorageService, ObjectNotFoundError } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(req.path);
        objectStorageService.downloadObject(objectFile, res);
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          return res.sendStatus(404);
        }
        throw error;
      }
    })
  );

  // App storage status
  app.get("/api/storage/app-storage/status",
    withErrorHandling("check app storage status", async (req: Request, res: Response) => {
      const { ObjectStorageService } = await import("../../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const configured = objectStorageService.isConfigured();
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      const privateDir = objectStorageService.getPrivateObjectDir();
      const isReplit = objectStorageService.isReplitEnvironment();

      res.json({
        configured,
        publicObjectSearchPaths: publicPaths,
        privateObjectDir: privateDir,
        replicationEnabled: isReplit,
        environment: isReplit ? "replit" : "external",
      });
    })
  );

  logger.info("StorageConfigRoutes", "Registered (config: 4, ops-db: 4, objects: 4)");
}

```

### `server/domains/health-monitoring/routes.ts` (381 lines)

```ts
import { Express, Request, Response, RequestHandler } from "express";
import { withErrorHandling } from "../../lib/route-utils";

interface IHealthStorage {
  getEquipmentRegistry(orgId: string): Promise<any[]>;
  getAlertNotifications(): Promise<any[]>;
  getPdmScores(equipmentId?: string): Promise<any[]>;
  getErrorLogs?(filters: Record<string, any>): Promise<any[]>;
  createErrorLog?(data: Record<string, any>): Promise<any>;
  deleteErrorLog?(id: string): Promise<void>;
  clearErrorLogs?(olderThan?: Date): Promise<void>;
}

interface HealthMonitoringConfig {
  storage: IHealthStorage;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
}

export function registerHealthMonitoringRoutes(app: Express, config: HealthMonitoringConfig) {
  const { storage, requireOrgId, generalApiRateLimit } = config;

  // NOTE: /api/healthz and /api/readyz are handled by server/observability.ts
  // They are NOT registered here to preserve the existing security model

  // Application health (comprehensive version)
  app.get("/api/health", generalApiRateLimit,
    withErrorHandling("get health status", async (req: Request, res: Response) => {
      const health = {
        ok: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "arus-api",
        services: {
          database: "connected",
          storage: "available",
          cache: "available",
        },
        version: process.env.APP_VERSION ?? "1.0",
      };

      res.json(health);
    })
  );

  // Scalability and load balancer health
  app.get("/api/health/scalability", generalApiRateLimit,
    withErrorHandling("get scalability health", async (req: Request, res: Response) => {
      const { getLoadBalancerHealth } = await import("../../scalability");
      res.json(getLoadBalancerHealth());
    })
  );

  // Background jobs health
  app.get("/api/health/background-jobs", generalApiRateLimit,
    withErrorHandling("get background job status", async (req: Request, res: Response) => {
      const { jobQueue } = await import("../../background-jobs");
      res.json({
        status: "active",
        timestamp: new Date().toISOString(),
        statistics: jobQueue.getStats(),
        recentJobs: jobQueue.getRecentJobs(10),
      });
    })
  );

  // Cache health
  app.get("/api/health/cache", generalApiRateLimit,
    withErrorHandling("get cache status", async (req: Request, res: Response) => {
      const { cache } = await import("../../scalability");
      res.json({
        status: "active",
        timestamp: new Date().toISOString(),
        statistics: cache.getStats(),
      });
    })
  );

  // Telemetry health - batch writer and ingestion stats
  app.get("/api/health/telemetry", generalApiRateLimit,
    withErrorHandling("get telemetry health status", async (req: Request, res: Response) => {
      const { telemetryBatchWriter } = await import("../../telemetry-batch-writer");
      const { getBridgeState } = await import("../../services/sqlite-bridge");
      
      const batchWriterStats = telemetryBatchWriter.getStats();
      const bridgeState = getBridgeState();
      
      const bufferHealthy = batchWriterStats.totalQueued === 0 || 
        batchWriterStats.bufferSize < batchWriterStats.totalQueued * 0.8;
      const isHealthy = 
        batchWriterStats.isRunning && 
        batchWriterStats.totalErrors === 0 &&
        bufferHealthy &&
        !bridgeState.pgOffline;
      
      res.json({
        service: "Telemetry Ingestion Pipeline",
        status: isHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        batchWriter: {
          isActive: batchWriterStats.isRunning,
          bufferSize: batchWriterStats.bufferSize,
          totalQueued: batchWriterStats.totalQueued,
          totalFlushed: batchWriterStats.totalFlushed,
          totalEvicted: batchWriterStats.totalEvicted,
          totalErrors: batchWriterStats.totalErrors,
          totalDropped: batchWriterStats.totalDropped,
          lastFlushTime: batchWriterStats.lastFlushTime,
          lastFlushDurationMs: batchWriterStats.lastFlushDurationMs,
          lastFlushCount: batchWriterStats.lastFlushCount,
          avgFlushDurationMs: batchWriterStats.avgFlushDurationMs,
        },
        sqliteBridge: {
          isRunning: bridgeState.isRunning,
          lastSuccessAt: bridgeState.lastSuccessAt,
          cursorLastId: bridgeState.cursorLastId,
          lagFrames: bridgeState.lagFrames,
          pgOffline: bridgeState.pgOffline,
        },
        configuration: {
          batchIntervalMs: Number.parseInt(process.env.TELEMETRY_BATCH_INTERVAL_MS || "500", 10),
          maxBufferSize: Number.parseInt(process.env.TELEMETRY_MAX_BUFFER_SIZE || "10000", 10),
          evictionPercent: Number.parseFloat(process.env.TELEMETRY_EVICTION_PERCENT || "0.1"),
          maxRetries: Number.parseInt(process.env.TELEMETRY_MAX_RETRIES || "3", 10),
        },
      });
    })
  );

  app.get("/api/health/detailed", requireOrgId,
    withErrorHandling("fetch detailed health", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      const equipment = await storage.getEquipmentRegistry(orgId);
      const alerts = await storage.getAlertNotifications();
      const activeAlerts = alerts.filter((a: any) => !a.acknowledgedAt);

      const health = {
        status: activeAlerts.length > 10 ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
        metrics: {
          equipmentCount: equipment.length,
          activeAlerts: activeAlerts.length,
          criticalAlerts: activeAlerts.filter((a: any) => a.alertType === "critical").length,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };

      res.json(health);
    })
  );

  app.get("/api/health/equipment", requireOrgId,
    withErrorHandling("fetch equipment health", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const { equipmentId } = req.query;

      const pdmScores = await storage.getPdmScores(equipmentId as string);
      const latestScore = pdmScores[0];

      const health = {
        equipmentId: equipmentId ?? "all",
        timestamp: new Date().toISOString(),
        healthScore: latestScore?.healthIdx ?? 100,
        status: latestScore?.healthIdx < 30 ? "critical" : latestScore?.healthIdx < 60 ? "warning" : "healthy",
        lastUpdated: latestScore?.ts ?? null,
      };

      res.json(health);
    })
  );

  app.get("/api/health/fleet", requireOrgId,
    withErrorHandling("fetch fleet health", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;

      const equipment = await storage.getEquipmentRegistry(orgId);
      const pdmScores = await storage.getPdmScores();

      const equipmentHealth = equipment.map((eq: any) => {
        const scores = pdmScores.filter((s: any) => s.equipmentId === eq.id);
        const latestScore = scores[0];
        return {
          equipmentId: eq.id,
          name: eq.name,
          healthScore: latestScore?.healthIdx ?? 100,
          status: latestScore?.healthIdx < 30 ? "critical" : latestScore?.healthIdx < 60 ? "warning" : "healthy",
        };
      });

      const avgHealth = equipmentHealth.length > 0
        ? equipmentHealth.reduce((sum: number, e: any) => sum + e.healthScore, 0) / equipmentHealth.length
        : 100;

      res.json({
        timestamp: new Date().toISOString(),
        fleetHealth: avgHealth,
        equipmentCount: equipment.length,
        criticalCount: equipmentHealth.filter((e: any) => e.status === "critical").length,
        warningCount: equipmentHealth.filter((e: any) => e.status === "warning").length,
        healthyCount: equipmentHealth.filter((e: any) => e.status === "healthy").length,
        equipment: equipmentHealth,
      });
    })
  );

  // Error logs
  app.get("/api/error-logs", requireOrgId,
    withErrorHandling("fetch error logs", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const { level, source, dateFrom, dateTo, limit } = req.query;
      const logs = await storage.getErrorLogs?.({
        orgId,
        level: level as string,
        source: source as string,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: limit ? Number.parseInt(limit as string) : 100,
      });
      res.json(logs ?? []);
    })
  );

  app.post("/api/error-logs", requireOrgId,
    withErrorHandling("create error log", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const log = await storage.createErrorLog?.({ ...req.body, orgId });
      res.status(201).json(log || req.body);
    })
  );

  app.delete("/api/error-logs/:id", requireOrgId,
    withErrorHandling("delete error log", async (req: Request, res: Response) => {
      await storage.deleteErrorLog?.(req.params.id);
      res.status(204).send();
    })
  );

  app.delete("/api/error-logs", requireOrgId,
    withErrorHandling("clear error logs", async (req: Request, res: Response) => {
      const { olderThan } = req.query;
      await storage.clearErrorLogs?.(olderThan ? new Date(olderThan as string) : undefined);
      res.status(204).send();
    })
  );

  // Error health summary
  app.get("/api/error-health", requireOrgId,
    withErrorHandling("fetch error health", async (req: Request, res: Response) => {
      const orgId = req.headers["x-org-id"] as string;
      const logs = await storage.getErrorLogs?.({ orgId, limit: 1000 });
      
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentLogs = (logs ?? []).filter((log: any) => new Date(log.createdAt) >= last24h);

      const summary = {
        totalErrors: recentLogs.length,
        byLevel: {
          error: recentLogs.filter((l: any) => l.level === "error").length,
          warning: recentLogs.filter((l: any) => l.level === "warning").length,
          info: recentLogs.filter((l: any) => l.level === "info").length,
        },
        status: recentLogs.filter((l: any) => l.level === "error").length > 10 ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
      };

      res.json(summary);
    })
  );


  // Performance metrics
  app.get("/api/performance", requireOrgId,
    withErrorHandling("fetch performance metrics", async (req: Request, res: Response) => {
      const performance = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss,
        },
        cpu: process.cpuUsage(),
      };

      res.json(performance);
    })
  );

  // Circuit breaker status for external services
  app.get("/api/health/circuit-breakers", generalApiRateLimit,
    withErrorHandling("fetch circuit breaker status", async (req: Request, res: Response) => {
      const { getAllCircuitBreakerStatuses } = await import("../../services/external-circuit-breakers");
      const { circuitBreakerRegistry } = await import("../../ml-circuit-breaker");
      
      const externalStatuses = getAllCircuitBreakerStatuses();
      const mlStatuses = circuitBreakerRegistry.getAllStats();
      
      const allOpen = Object.values(externalStatuses).some(s => s.state === "OPEN") ||
        Object.values(mlStatuses).some(s => s.state === "OPEN");
      
      res.json({
        status: allOpen ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
        external: externalStatuses,
        ml: mlStatuses,
        summary: {
          totalBreakers: Object.keys(externalStatuses).length + Object.keys(mlStatuses).length,
          openBreakers: [
            ...Object.entries(externalStatuses).filter(([, s]) => s.state === "OPEN").map(([n]) => n),
            ...Object.entries(mlStatuses).filter(([, s]) => s.state === "OPEN").map(([n]) => n),
          ],
        },
      });
    })
  );

  // External dependencies health check
  app.get("/api/health/dependencies", generalApiRateLimit,
    withErrorHandling("check dependency health", async (req: Request, res: Response) => {
      const { inventoryCache, analyticsCache, cacheConfig } = await import("../../lib/cache");
      const { mqttReliableSyncService } = await import("../../mqtt-reliable-sync");
      const { setDependencyHealthStatus } = await import("../../observability");
      
      const redisInventoryHealthy = await inventoryCache.healthCheck();
      const redisAnalyticsHealthy = await analyticsCache.healthCheck();
      const mqttConnected = mqttReliableSyncService?.isConnected?.() ?? false;
      
      // Emit dependency health metrics
      setDependencyHealthStatus("redis_inventory", redisInventoryHealthy ? 1 : 0);
      setDependencyHealthStatus("redis_analytics", redisAnalyticsHealthy ? 1 : 0);
      setDependencyHealthStatus("mqtt", mqttConnected ? 1 : 0);
      setDependencyHealthStatus("postgres", 1); // If we got here, DB is working
      
      const issues: string[] = [];
      
      if (cacheConfig.enabled && !redisInventoryHealthy) {
        issues.push("Redis inventory cache unavailable - falling back to direct queries");
      }

      if (cacheConfig.analyticsEnabled && !redisAnalyticsHealthy) {
        issues.push("Redis analytics cache unavailable - falling back to direct queries");
      }

      if (!mqttConnected) {
        issues.push("MQTT broker disconnected - sync functionality may be delayed");
      }
      
      const hasIssues = issues.length > 0;
      
      res.json({
        status: hasIssues ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
        dependencies: {
          redis: {
            inventory: {
              status: redisInventoryHealthy ? "connected" : "disconnected",
              enabled: cacheConfig.enabled,
            },
            analytics: {
              status: redisAnalyticsHealthy ? "connected" : "disconnected",
              enabled: cacheConfig.analyticsEnabled,
            },
          },
          mqtt: {
            broker: mqttConnected ? "connected" : "disconnected",
          },
          database: {
            postgres: "connected",
          },
        },
        notes: hasIssues ? [
          "Some dependencies are unavailable. The application will use fallback mechanisms.",
          ...issues,
        ] : [],
      });
    })
  );
}

```

### `server/domains/scheduled-reports/interfaces/routes.ts` (335 lines)

```ts
/**
 * Scheduled Reports - REST API Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ReportSchedulerService } from '../application/report-scheduler-service.js';
import { ReportGenerationService } from '../application/report-generation-service.js';
import { isCloudMode, canUseCloudFeature } from '../../../config/runtimeEnv.js';
import { DEFAULT_ORG_ID } from '../../../../shared/config/tenant.js';
import { logger } from '../../../utils/logger.js';
import { DbSettingsStorage } from '../../../db/system-admin/db-settings.js';

const LOG_CTX = 'ScheduledReportsRoutes';
const SETTINGS_CATEGORY = 'scheduled_reports';

export interface ScheduledReportsSettings {
  reportRetentionDays: number;
  defaultTimezone: string;
  maxRecipientsPerSchedule: number;
  reportGenerationTimeoutSeconds: number;
}

export const DEFAULT_SCHEDULED_REPORTS_SETTINGS: ScheduledReportsSettings = {
  reportRetentionDays: 7,
  defaultTimezone: 'UTC',
  maxRecipientsPerSchedule: 10,
  reportGenerationTimeoutSeconds: 120,
};

const UpdateSettingsSchema = z.object({
  reportRetentionDays: z.number().min(1).max(365).optional(),
  defaultTimezone: z.string().min(1).optional(),
  maxRecipientsPerSchedule: z.number().min(1).max(50).optional(),
  reportGenerationTimeoutSeconds: z.number().min(30).max(600).optional(),
});

const REPORT_TYPES = ['fleet_health', 'maintenance_due', 'inventory_status', 'crew_compliance', 'cost_summary'] as const;
const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
const FORMATS = ['pdf', 'csv', 'json'] as const;

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  reportType: z.enum(REPORT_TYPES),
  frequency: z.enum(FREQUENCIES),
  cronExpression: z.string().optional(),
  timezone: z.string().default('UTC'),
  format: z.enum(FORMATS).default('pdf'),
  recipients: z.array(z.string().email()).min(1),
  vesselIds: z.array(z.string().uuid()).nullable().optional(),
  enabled: z.boolean().default(true),
});

const UpdateScheduleSchema = CreateScheduleSchema.partial();

const GenerateOnDemandSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  format: z.enum(FORMATS).default('pdf'),
  vesselIds: z.array(z.string().uuid()).nullable().optional(),
});

export function createScheduledReportsRouter(
  schedulerService: ReportSchedulerService,
  generationService: ReportGenerationService
): Router {
  const router = Router();

  const requireCloudFeature = (req: Request, res: Response, next: Function) => {
    if (!isCloudMode || !canUseCloudFeature('scheduledReports')) {
      return res.status(403).json({
        error: 'Scheduled reports are only available in cloud mode',
        code: 'FEATURE_DISABLED',
      });
    }
    next();
  };

  router.get('/schedules', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const schedules = await schedulerService.getSchedulesByOrg(orgId);
      res.json({ data: schedules });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to list schedules', String(error));
      res.status(500).json({ error: 'Failed to list schedules' });
    }
  });

  router.get('/schedules/:id', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const schedule = await schedulerService.getSchedule(req.params.id, orgId);
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      res.json({ data: schedule });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to get schedule', String(error));
      res.status(500).json({ error: 'Failed to get schedule' });
    }
  });

  router.post('/schedules', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const userId = (req as any).userId || 'system';

      const validation = CreateScheduleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const schedule = await schedulerService.createSchedule(orgId, validation.data, userId);
      res.status(201).json({ data: schedule });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to create schedule', String(error));
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  });

  router.patch('/schedules/:id', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const userId = (req as any).userId || 'system';

      const validation = UpdateScheduleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const schedule = await schedulerService.updateSchedule(
        req.params.id,
        orgId,
        validation.data,
        userId
      );
      res.json({ data: schedule });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      logger.error(LOG_CTX, 'Failed to update schedule', message);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  });

  router.delete('/schedules/:id', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const userId = (req as any).userId || 'system';

      await schedulerService.deleteSchedule(req.params.id, orgId, userId);
      res.status(204).send();
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to delete schedule', String(error));
      res.status(500).json({ error: 'Failed to delete schedule' });
    }
  });

  router.post('/schedules/:id/run', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      await schedulerService.runScheduleNow(req.params.id, orgId);
      res.json({ message: 'Report generation started' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      logger.error(LOG_CTX, 'Failed to run schedule', message);
      res.status(500).json({ error: 'Failed to run schedule' });
    }
  });

  router.get('/schedules/:id/history', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const limit = parseInt(req.query.limit as string) || 10;
      const reports = await schedulerService.getReportHistory(req.params.id, orgId, limit);
      res.json({ data: reports });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to get report history', String(error));
      res.status(500).json({ error: 'Failed to get report history' });
    }
  });

  router.get('/reports', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const limit = parseInt(req.query.limit as string) || 50;
      const reports = await schedulerService.getAllReports(orgId, limit);
      res.json({ data: reports });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to list reports', String(error));
      res.status(500).json({ error: 'Failed to list reports' });
    }
  });

  router.post('/reports/generate', async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;

      const validation = GenerateOnDemandSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const { reportType, format, vesselIds } = validation.data;
      const result = await generationService.generateOnDemand(
        orgId,
        reportType,
        vesselIds || null,
        format
      );

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.content);
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to generate report', String(error));
      res.status(500).json({ error: 'Failed to generate report' });
    }
  });

  router.get('/report-types', (req: Request, res: Response) => {
    res.json({
      data: REPORT_TYPES.map((type) => ({
        id: type,
        name: type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      })),
    });
  });

  // ============================================================================
  // SETTINGS ENDPOINTS
  // ============================================================================

  const settingsStorage = new DbSettingsStorage();

  async function getSettingsFromDb(orgId: string): Promise<ScheduledReportsSettings> {
    const dbSettings = await settingsStorage.getSettingsByCategory(orgId, SETTINGS_CATEGORY);
    const settings: ScheduledReportsSettings = { ...DEFAULT_SCHEDULED_REPORTS_SETTINGS };
    
    for (const setting of dbSettings) {
      if (setting.key === 'report_retention_days' && typeof setting.value === 'number') {
        settings.reportRetentionDays = setting.value;
      } else if (setting.key === 'default_timezone' && typeof setting.value === 'string') {
        settings.defaultTimezone = setting.value;
      } else if (setting.key === 'max_recipients_per_schedule' && typeof setting.value === 'number') {
        settings.maxRecipientsPerSchedule = setting.value;
      } else if (setting.key === 'report_generation_timeout_seconds' && typeof setting.value === 'number') {
        settings.reportGenerationTimeoutSeconds = setting.value;
      }
    }
    
    return settings;
  }

  async function upsertSetting(orgId: string, key: string, value: number | string, dataType: 'string' | 'number' | 'boolean' | 'object' | 'array'): Promise<void> {
    const existing = await settingsStorage.getAdminSystemSetting(orgId, SETTINGS_CATEGORY, key);
    if (existing) {
      await settingsStorage.updateAdminSystemSetting(existing.id, { value });
    } else {
      await settingsStorage.createAdminSystemSetting({
        orgId,
        category: SETTINGS_CATEGORY,
        key,
        value,
        dataType,
        description: `Scheduled reports setting: ${key}`,
      });
    }
  }

  router.get('/settings', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      const settings = await getSettingsFromDb(orgId);
      res.json({ data: settings });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to get settings', String(error));
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  router.patch('/settings', requireCloudFeature, async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || DEFAULT_ORG_ID;
      
      const validation = UpdateSettingsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: validation.error.errors,
        });
      }

      const updates = validation.data;
      
      if (updates.reportRetentionDays !== undefined) {
        await upsertSetting(orgId, 'report_retention_days', updates.reportRetentionDays, 'number');
      }
      if (updates.defaultTimezone !== undefined) {
        await upsertSetting(orgId, 'default_timezone', updates.defaultTimezone, 'string');
      }
      if (updates.maxRecipientsPerSchedule !== undefined) {
        await upsertSetting(orgId, 'max_recipients_per_schedule', updates.maxRecipientsPerSchedule, 'number');
      }
      if (updates.reportGenerationTimeoutSeconds !== undefined) {
        await upsertSetting(orgId, 'report_generation_timeout_seconds', updates.reportGenerationTimeoutSeconds, 'number');
      }

      const updatedSettings = await getSettingsFromDb(orgId);
      logger.info(LOG_CTX, 'Settings updated', { orgId, updates });
      res.json({ data: updatedSettings });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to update settings', String(error));
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  return router;
}

```

### `server/domains/sensor-management/routes/types.ts` (14 lines)

```ts
/**
 * Sensor Management Routes - Types
 * Interface definitions for route configuration
 */

import type { RequestHandler } from "express";

export interface SensorManagementConfig {
  storage: any;
  requireOrgId: RequestHandler;
  generalApiRateLimit: RequestHandler;
  writeOperationRateLimit: RequestHandler;
  criticalOperationRateLimit: RequestHandler;
}

```

### `server/domains/sensor-management/routes/index.ts` (24 lines)

```ts
/**
 * Sensor Management Routes - Main Entry Point
 * Re-exports and orchestrates all sensor management route modules
 */

import type { Express } from "express";
import type { SensorManagementConfig } from "./types.js";
import { registerTelemetryRoutes } from "./telemetry-routes.js";
import { registerSensorConfigRoutes } from "./sensor-config-routes.js";
import { registerSensorStatusRoutes } from "./sensor-status-routes.js";
import { registerSensorOptimizationRoutes } from "./sensor-optimization-routes.js";
import { registerJ1939Routes } from "./j1939-routes.js";
import { logger } from "../../../utils/logger.js";

export type { SensorManagementConfig } from "./types.js";

export function registerSensorManagementRoutes(app: Express, config: SensorManagementConfig) {
  registerTelemetryRoutes(app, config);
  registerSensorConfigRoutes(app, config);
  registerSensorStatusRoutes(app, config);
  registerSensorOptimizationRoutes(app, config);
  registerJ1939Routes(app, config);
  logger.info("SensorManagementRoutes", "Registered (configs, tuning, optimization, J1939, states)");
}

```

### `server/domains/sensor-management/routes/sensor-config-routes.ts` (110 lines)

```ts
/**
 * Sensor Configuration Routes
 * CRUD operations for sensor configurations
 */

import type { Express } from "express";
import { insertSensorConfigSchema, bulkSensorConfigSchema } from "@shared/schema-runtime";
import type { SensorManagementConfig } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerSensorConfigRoutes(app: Express, config: SensorManagementConfig) {
  const { storage, requireOrgId, writeOperationRateLimit, criticalOperationRateLimit } = config;

  app.get("/api/sensor-configs", requireOrgId,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;
      const configs = await storage.getSensorConfigurations(orgId, equipmentId as string, sensorType as string);
      res.json(configs);
    })
  );

  app.get("/api/sensor-config", requireOrgId,
    withErrorHandling("fetch sensor configurations", async (req, res) => {
      const { equipmentId, sensorType } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;
      const configs = await storage.getSensorConfigurations(orgId, equipmentId as string, sensorType as string);
      res.json(configs);
    })
  );

  app.get("/api/sensor-configs/:equipmentId/:sensorType", requireOrgId,
    withErrorHandling("fetch sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const config = await storage.getSensorConfiguration(equipmentId, sensorType, orgId);
      if (!config) {
        return sendNotFound(res, "Sensor configuration");
      }
      res.json(config);
    })
  );

  app.post("/api/sensor-configs", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create sensor configuration", async (req, res) => {
      const configData = insertSensorConfigSchema.parse(req.body);
      const orgId = (req as AuthenticatedRequest).orgId;
      const sensorConfig = await storage.createSensorConfiguration({ ...configData, orgId });
      sendCreated(res, sensorConfig);
    })
  );

  app.post("/api/sensor-config/bulk", requireOrgId, writeOperationRateLimit,
    withErrorHandling("bulk create sensor configurations", async (req, res) => {
      const payload = bulkSensorConfigSchema.parse(req.body);
      const { equipmentId, configs, overwriteExisting } = payload;
      const orgId = (req as AuthenticatedRequest).orgId;
      const equipment = await storage.getEquipment(orgId, equipmentId);
      if (!equipment) {
        return sendNotFound(res, "Equipment");
      }
      const fullConfigs = configs.map((config: Record<string, unknown>) => ({ ...config, equipmentId, orgId }));
      const created = await storage.bulkCreateSensorConfigurations(fullConfigs, overwriteExisting);
      sendCreated(res, {
        message: `Successfully created ${created.length} sensor configuration(s)`,
        created: created.length,
        sensors: created
      });
    })
  );

  app.put("/api/sensor-configs/:equipmentId/:sensorType", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const configData = insertSensorConfigSchema.partial().parse(req.body);
      const sensorConfig = await storage.updateSensorConfiguration(equipmentId, sensorType, configData, orgId);
      res.json(sensorConfig);
    })
  );

  app.put("/api/sensor-configs/:id", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update sensor configuration", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const configData = insertSensorConfigSchema.partial().parse(req.body);
      const sensorConfig = await storage.updateSensorConfigurationById(id, configData, orgId);
      res.json(sensorConfig);
    })
  );

  app.delete("/api/sensor-configs/:equipmentId/:sensorType", requireOrgId, criticalOperationRateLimit,
    withErrorHandling("delete sensor configuration", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      await storage.deleteSensorConfiguration(equipmentId, sensorType, orgId);
      sendDeleted(res);
    })
  );

  app.delete("/api/sensor-configs/:id", requireOrgId, criticalOperationRateLimit,
    withErrorHandling("delete sensor configuration", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      await storage.deleteSensorConfigurationById(id, orgId);
      sendDeleted(res);
    })
  );
}

```

### `server/domains/sensor-management/routes/sensor-optimization-routes.ts` (114 lines)

```ts
/**
 * Sensor Optimization Routes
 * AI-powered sensor optimization and threshold management
 */

import type { Express } from "express";
import type { SensorManagementConfig } from "./types.js";
import { withErrorHandling, sendNotFound } from "../../../lib/route-utils.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerSensorOptimizationRoutes(app: Express, config: SensorManagementConfig) {
  const { storage, requireOrgId, writeOperationRateLimit } = config;

  app.get("/api/sensor-optimization", requireOrgId,
    withErrorHandling("fetch threshold optimizations", async (req, res) => {
      const { equipmentId, sensorType, status } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;
      const optimizations = await storage.getThresholdOptimizations(orgId, equipmentId as string, sensorType as string, status as string);
      res.json(optimizations);
    })
  );

  app.get("/api/sensor-optimization/:optimizationId", requireOrgId,
    withErrorHandling("fetch threshold optimization", async (req, res) => {
      const { optimizationId } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const optimization = await storage.getThresholdOptimization(Number.parseInt(optimizationId), orgId);
      if (!optimization) {
        return sendNotFound(res, "Threshold optimization");
      }
      res.json(optimization);
    })
  );

  app.post("/api/sensor-optimization/apply/:optimizationId", requireOrgId, writeOperationRateLimit,
    withErrorHandling("apply optimization", async (req, res) => {
      const { optimizationId } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const result = await storage.applyThresholdOptimization(Number.parseInt(optimizationId), orgId);
      res.json({ success: true, applied: result });
    })
  );

  app.post("/api/sensor-optimization/reject/:optimizationId", requireOrgId, writeOperationRateLimit,
    withErrorHandling("reject optimization", async (req, res) => {
      const { optimizationId } = req.params;
      const { reason } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;
      const result = await storage.rejectThresholdOptimization(Number.parseInt(optimizationId), reason, orgId);
      res.json({ success: true, rejected: result });
    })
  );

  app.get("/api/sensor-tuning/recommendations/:equipmentId", requireOrgId,
    withErrorHandling("get AI recommendations", async (req, res) => {
      const { equipmentId } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const { llmSensorTuningService } = await import("../../../llm-sensor-tuning.js");
      const recommendations = await llmSensorTuningService.getRecommendations(equipmentId, orgId);
      res.json({ success: true, recommendations });
    })
  );

  app.get("/api/sensor-tuning/recommendations/:equipmentId/:sensorType", requireOrgId,
    withErrorHandling("get sensor recommendation", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const { llmSensorTuningService } = await import("../../../llm-sensor-tuning.js");
      const recommendation = await llmSensorTuningService.getSensorRecommendation(equipmentId, sensorType, orgId);
      if (!recommendation) {
        return sendNotFound(res, "Recommendation for this sensor");
      }
      res.json(recommendation);
    })
  );

  app.get("/api/sensor-tuning/compare/:equipmentId/:sensorType", requireOrgId,
    withErrorHandling("compare configurations", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const { llmSensorTuningService } = await import("../../../llm-sensor-tuning.js");
      const comparison = await llmSensorTuningService.compareConfiguration(equipmentId, sensorType, orgId);
      if (!comparison) {
        return sendNotFound(res, "Comparison");
      }
      res.json(comparison);
    })
  );

  app.post("/api/sensor-tuning/apply/:equipmentId/:sensorType", requireOrgId, writeOperationRateLimit,
    withErrorHandling("apply AI recommendations", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const { parameters } = req.body;
      const orgId = (req as AuthenticatedRequest).orgId;
      let configuration;
      try {
        configuration = await storage.updateSensorConfiguration(equipmentId, sensorType, parameters, orgId);
      } catch (updateError) {
        if (updateError instanceof Error && updateError.message?.includes("not found")) {
          configuration = await storage.createSensorConfiguration({
            equipmentId,
            sensorType,
            orgId,
            enabled: true,
            ...parameters
          });
        } else {
          throw updateError;
        }
      }
      res.json({ success: true, configuration });
    })
  );
}

```

### `server/domains/sensor-management/routes/sensor-status-routes.ts` (83 lines)

```ts
/**
 * Sensor Status Routes
 * Endpoints for sensor status and state management
 */

import type { Express } from "express";
import { z } from "zod";
import { insertSensorStateSchema } from "@shared/schema-runtime";
import type { SensorManagementConfig } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated } from "../../../lib/route-utils.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerSensorStatusRoutes(app: Express, config: SensorManagementConfig) {
  const { storage, requireOrgId } = config;

  app.get("/api/sensor-configs/status", requireOrgId,
    withErrorHandling("fetch sensor status", async (req, res) => {
      const { equipmentId } = z.object({ equipmentId: z.string().optional() }).parse(req.query);
      const orgId = (req as AuthenticatedRequest).orgId;
      const sensorConfigs = await storage.getSensorConfigurations(orgId, equipmentId);
      const DEFAULT_THRESHOLD_MS = 5 * 60 * 1000;
      const now = new Date();
      const sensors = sensorConfigs.map((config: any) => ({
        equipmentId: config.equipmentId,
        sensorType: config.sensorType
      }));
      const telemetryResults = await storage.getLatestTelemetryForSensors(sensors, orgId);
      const telemetryMap = new Map(
        telemetryResults.map((result: any) => [`${result.equipmentId}:${result.sensorType}`, result])
      );

      const sensorStatus = sensorConfigs.map((config: any) => {
        const key = `${config.equipmentId}:${config.sensorType}`;
        const telemetry = telemetryMap.get(key);
        let status: "disabled" | "inactive" | "offline" | "online";
        if (!config.enabled) {
          status = "disabled";
        } else if (!telemetry || !telemetry.ts) {
          status = "inactive";
        } else {
          const thresholdMs = config.expectedIntervalMs
            ? config.expectedIntervalMs * (config.graceMultiplier || 2)
            : DEFAULT_THRESHOLD_MS;
          const elapsedMs = now.getTime() - new Date(telemetry.ts).getTime();
          status = elapsedMs < thresholdMs ? "online" : "offline";
        }
        return {
          id: config.id,
          equipmentId: config.equipmentId,
          sensorType: config.sensorType,
          status,
          lastTelemetry: telemetry?.ts || null,
          lastValue: telemetry?.value || null,
          enabled: config.enabled,
          expectedIntervalMs: config.expectedIntervalMs || null,
          graceMultiplier: config.graceMultiplier || null
        };
      });
      res.json(sensorStatus);
    })
  );

  app.get("/api/sensor-states/:equipmentId/:sensorType", requireOrgId,
    withErrorHandling("fetch sensor state", async (req, res) => {
      const { equipmentId, sensorType } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const state = await storage.getSensorState(equipmentId, sensorType, orgId);
      if (!state) {
        return sendNotFound(res, "Sensor state");
      }
      res.json(state);
    })
  );

  app.post("/api/sensor-states", requireOrgId,
    withErrorHandling("create/update sensor state", async (req, res) => {
      const stateData = insertSensorStateSchema.parse(req.body);
      const orgId = (req as AuthenticatedRequest).orgId;
      const sensorState = await storage.upsertSensorState({ ...stateData, orgId });
      sendCreated(res, sensorState);
    })
  );
}

```

### `server/domains/sensor-management/routes/j1939-routes.ts` (71 lines)

```ts
/**
 * J1939 Configuration Routes
 * Marine protocol configuration management
 */

import type { Express } from "express";
import { insertJ1939ConfigurationSchema } from "@shared/schema-runtime";
import type { SensorManagementConfig } from "./types.js";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils.js";
import type { AuthenticatedRequest } from "../../../middleware/auth";

export function registerJ1939Routes(app: Express, config: SensorManagementConfig) {
  const { storage, requireOrgId, writeOperationRateLimit, criticalOperationRateLimit } = config;

  app.get("/api/j1939/configurations", requireOrgId,
    withErrorHandling("fetch J1939 configurations", async (req, res) => {
      const { deviceId } = req.query;
      const orgId = (req as AuthenticatedRequest).orgId;
      const configurations = await storage.getJ1939Configurations(orgId, deviceId as string);
      res.json(configurations);
    })
  );

  app.get("/api/j1939/configurations/:id", requireOrgId,
    withErrorHandling("fetch J1939 configuration", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const configuration = await storage.getJ1939Configuration(id, orgId);
      if (!configuration) {
        return sendNotFound(res, "J1939 configuration");
      }
      res.json(configuration);
    })
  );

  app.post("/api/j1939/configurations", requireOrgId, writeOperationRateLimit,
    withErrorHandling("create J1939 configuration", async (req, res) => {
      const configData = insertJ1939ConfigurationSchema.parse(req.body);
      const orgId = (req as AuthenticatedRequest).orgId;
      const configuration = await storage.createJ1939Configuration({ ...configData, orgId });
      sendCreated(res, configuration);
    })
  );

  app.put("/api/j1939/configurations/:id", requireOrgId, writeOperationRateLimit,
    withErrorHandling("update J1939 configuration", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const configData = insertJ1939ConfigurationSchema.partial().parse(req.body);
      const existing = await storage.getJ1939Configuration(id, orgId);
      if (!existing) {
        return sendNotFound(res, "J1939 configuration");
      }
      const configuration = await storage.updateJ1939Configuration(id, configData, orgId);
      res.json(configuration);
    })
  );

  app.delete("/api/j1939/configurations/:id", requireOrgId, criticalOperationRateLimit,
    withErrorHandling("delete J1939 configuration", async (req, res) => {
      const { id } = req.params;
      const orgId = (req as AuthenticatedRequest).orgId;
      const existing = await storage.getJ1939Configuration(id, orgId);
      if (!existing) {
        return sendNotFound(res, "J1939 configuration");
      }
      await storage.deleteJ1939Configuration(id, orgId);
      sendDeleted(res);
    })
  );
}

```

### `server/domains/sensor-management/routes/telemetry-routes.ts` (22 lines)

```ts
/**
 * Telemetry Routes
 * Telemetry history and data endpoints
 */

import type { Express } from "express";
import type { SensorManagementConfig } from "./types.js";

export function registerTelemetryRoutes(app: Express, config: SensorManagementConfig) {
  const { storage, requireOrgId } = config;

  app.get("/api/telemetry/history/:equipmentId/:sensorType", requireOrgId, async (req, res) => {
    try {
      const { equipmentId, sensorType } = req.params;
      const hours = req.query.hours ? Number.parseInt(req.query.hours as string) : 24;
      const history = await storage.getTelemetryHistory(equipmentId, sensorType, hours);
      res.json(history);
    } catch (_error) {
      res.status(500).json({ message: "Failed to fetch telemetry history" });
    }
  });
}

```

### `server/routes/observability-routes.ts` (98 lines)

```ts
/**
 * Observability Routes - Health, metrics, and performance endpoints
 * Extracted from routes.ts for modularization
 */

import type { Express, Request, Response } from "express";
import {
  healthzEndpoint,
  readyzEndpoint,
  metricsEndpoint,
  dbIndexesHealthEndpoint,
  getErrorHandlingHealth,
} from "./route-dependencies";

export function registerObservabilityRoutes(app: Express): void {
  // Health check endpoints (no rate limiting for load balancers)
  app.get("/api/healthz", healthzEndpoint);
  app.get("/api/readyz", readyzEndpoint);

  // Error handling health endpoint
  app.get("/api/error-health", (req: Request, res: Response) => {
    try {
      const errorHandlingHealth = getErrorHandlingHealth();
      res.json({
        ...errorHandlingHealth,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to get error handling health",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Prometheus metrics endpoint
  app.get("/api/metrics", metricsEndpoint);

  // Database indexes health endpoint (Option A: verify-only, no DDL in prod)
  app.get("/api/health/db-indexes", dbIndexesHealthEndpoint);

  // Performance stats endpoint (no auth needed for ops monitoring)
  app.get("/api/performance/stats", async (req: Request, res: Response) => {
    try {
      const { performanceStatsHandler } = await import("../middleware/performance");
      return performanceStatsHandler(req, res);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Request span statistics endpoint - shows detailed request tracing (no auth for ops)
  app.get("/api/performance/spans", async (req: Request, res: Response) => {
    try {
      const { getRecentSlowRequests, getRequestSpans, getRequestSpanSummary } = await import("../utils/request-spans");
      const thresholdMs = Number.parseInt(req.query.thresholdMs as string) || 200;
      const requestId = req.query.requestId as string | undefined;
      
      if (requestId) {
        const spans = getRequestSpans(requestId);
        const summary = getRequestSpanSummary(requestId);
        res.json({
          requestId,
          spans,
          summary,
          timestamp: new Date().toISOString(),
        });
      } else {
        const slowRequests = getRecentSlowRequests(thresholdMs);
        res.json({
          slowRequests,
          thresholdMs,
          count: slowRequests.length,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // SLO status endpoint - shows service level objectives and violations (no auth for ops)
  app.get("/api/performance/slo", async (req: Request, res: Response) => {
    try {
      const { getSLOStatus } = await import("../utils/slo-alerts");
      const status = getSLOStatus();
      
      res.json({
        ...status,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log("[Observability Routes] Registered (healthz, readyz, metrics, error-health, performance, spans, slo, db-indexes)");
}

```

### `server/routes/diagnostics/types.ts` (50 lines)

```ts
/**
 * Diagnostics Routes - Type Definitions
 */

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: CheckResult;
    telemetry: CheckResult;
    memory: CheckResult;
    services: ServiceStatus[];
  };
}

export interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  responseTimeMs?: number;
  message?: string;
  details?: Record<string, any>;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastHealthCheck?: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    externalMB: number;
    utilizationPercent: number;
  };
  uptime: number;
  nodeVersion: string;
  timestamp: string;
}

export interface SmokeSuite {
  name: string;
  description: string;
  file: string;
  category: string;
  runnable: boolean;
}

```

### `server/routes/diagnostics/index.ts` (21 lines)

```ts
/**
 * Diagnostics Routes - Main Entry Point
 * Re-exports and orchestrates all diagnostics route modules
 */

import { Router } from "express";
import { registerHealthRoutes } from "./health-routes.js";
import { registerMetricsRoutes } from "./metrics-routes.js";
import { registerTestsRoutes } from "./tests-routes.js";
import { registerConfigRoutes } from "./config-routes.js";

export type { HealthCheckResult, CheckResult, ServiceStatus, SystemMetrics, SmokeSuite } from "./types.js";

const router = Router();

registerHealthRoutes(router);
registerMetricsRoutes(router);
registerTestsRoutes(router);
registerConfigRoutes(router);

export default router;

```

### `server/routes/diagnostics/health-routes.ts` (47 lines)

```ts
/**
 * Diagnostics Routes - Health Check Endpoints
 */

import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import { runHealthChecks, determineOverallStatus, checkDatabase, startTime } from "./helpers.js";
import type { HealthCheckResult } from "./types.js";

export function registerHealthRoutes(router: Router) {
  router.get("/health", async (req: Request, res: Response) => {
    try {
      const checks = await runHealthChecks();
      const overallStatus = determineOverallStatus(checks);
      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0",
        uptime: Math.round((Date.now() - startTime) / 1000),
        checks,
      };
      const statusCode = overallStatus === 'healthy' ? 200 : 503;
      if (overallStatus !== 'healthy') {
        logger.warn('Diagnostics', `Health check returned ${overallStatus} status`, { checks: result.checks });
      }
      res.status(statusCode).json(result);
    } catch (error) {
      logger.error('Diagnostics', 'Health check failed', error instanceof Error ? error : new Error(String(error)));
      res.status(503).json({ status: 'unhealthy', timestamp: new Date().toISOString(), error: 'Health check failed' });
    }
  });

  router.get("/health/liveness", (req: Request, res: Response) => {
    res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  router.get("/health/readiness", async (req: Request, res: Response) => {
    try {
      const dbCheck = await checkDatabase();
      if (dbCheck.status === 'fail') {
        res.status(503).json({ status: 'not_ready', reason: 'Database unavailable', timestamp: new Date().toISOString() });
        return;
      }
      res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch { res.status(503).json({ status: 'not_ready', error: 'Readiness check failed', timestamp: new Date().toISOString() }); }
  });
}

```

### `server/routes/diagnostics/config-routes.ts` (29 lines)

```ts
/**
 * Diagnostics Routes - Configuration Endpoints
 */

import { Router, Request, Response } from "express";

export function registerConfigRoutes(router: Router) {
  router.get("/config", (req: Request, res: Response) => {
    const config = {
      telemetry: {
        batchIntervalMs: Number.parseInt(process.env.TELEMETRY_BATCH_INTERVAL_MS || '500'),
        maxBufferSize: Number.parseInt(process.env.TELEMETRY_MAX_BUFFER_SIZE || '10000'),
        evictionPercent: Number.parseFloat(process.env.TELEMETRY_EVICTION_PERCENT || '0.1'),
        maxRetries: Number.parseInt(process.env.TELEMETRY_MAX_RETRIES || '3'),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        deploymentMode: process.env.DEPLOYMENT_MODE || 'cloud',
      },
      features: {
        dualDatabase: process.env.ENABLE_DUAL_DB === 'true',
        mlPredictions: process.env.ENABLE_ML === 'true',
        fmccIntegration: !!process.env.FMCC_API_URL,
      },
      timestamp: new Date().toISOString(),
    };
    res.json(config);
  });
}

```

### `server/routes/diagnostics/metrics-routes.ts` (50 lines)

```ts
/**
 * Diagnostics Routes - Metrics Endpoints
 */

import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import { startTime } from "./helpers.js";
import type { SystemMetrics } from "./types.js";

export function registerMetricsRoutes(router: Router) {
  router.get("/metrics", async (req: Request, res: Response) => {
    try {
      const memoryUsage = process.memoryUsage();
      const metrics: SystemMetrics = {
        memory: {
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          externalMB: Math.round(memoryUsage.external / 1024 / 1024),
          utilizationPercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
        },
        uptime: Math.round((Date.now() - startTime) / 1000),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      };
      res.json(metrics);
    } catch (error) {
      logger.error('Diagnostics', 'Metrics collection failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  });

  router.get("/telemetry/stats", async (req: Request, res: Response) => {
    try {
      const { telemetryBatchWriter } = await import("../../telemetry-batch-writer.js");
      const stats = telemetryBatchWriter.getStats();
      res.json({
        batchWriter: stats,
        health: {
          bufferUtilization: stats.maxBufferSize > 0 ? Math.round((stats.currentBufferSize / stats.maxBufferSize) * 100) : 0,
          evictionRate: stats.totalQueued > 0 ? Math.round((stats.totalEvicted / stats.totalQueued) * 10000) / 100 : 0,
          writeSuccessRate: stats.totalQueued > 0 ? Math.round((stats.totalWritten / stats.totalQueued) * 10000) / 100 : 100,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Diagnostics', 'Telemetry stats collection failed', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to collect telemetry stats' });
    }
  });
}

```

### `server/routes/diagnostics/tests-routes.ts` (73 lines)

```ts
/**
 * Diagnostics Routes - Test Suite Endpoints
 */

import { Router, Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import type { SmokeSuite } from "./types.js";

const smokeSuites: SmokeSuite[] = [
  { name: 'health-smoke', description: 'Quick health check of diagnostics endpoints', file: 'server/diagnostics-smoke-tests.ts', category: 'smoke', runnable: true },
  { name: 'equipment-smoke', description: 'Equipment and vessel endpoint smoke tests', file: 'server/diagnostics-smoke-tests.ts', category: 'smoke', runnable: true },
  { name: 'work-orders-smoke', description: 'Work orders and inventory smoke tests', file: 'server/diagnostics-smoke-tests.ts', category: 'smoke', runnable: true },
  { name: 'alerts-smoke', description: 'Alert system endpoint smoke tests', file: 'server/diagnostics-smoke-tests.ts', category: 'smoke', runnable: true },
  { name: 'database-smoke', description: 'Database connectivity smoke tests', file: 'server/diagnostics-smoke-tests.ts', category: 'smoke', runnable: true },
  { name: 'crew-smoke', description: 'Crew management endpoint smoke tests', file: 'server/diagnostics-smoke-tests.ts', category: 'smoke', runnable: true },
  { name: 'integration-lite', description: 'Comprehensive integration tests (20 tests across 7 categories)', file: 'server/tests/integration-lite.test.ts', category: 'integration', runnable: true },
];

const jestSuites: SmokeSuite[] = [
  { name: 'engine-room-logbook', description: 'Engine Room Logbook auto-fill, hourly entries, generators, anomalies', file: 'server/tests/engine-room-logbook.test.ts', category: 'logbook', runnable: false },
  { name: 'deck-logbook', description: 'Deck Logbook voyage entries, weather, fuel/emissions', file: 'server/tests/deck-logbook.test.ts', category: 'logbook', runnable: false },
  { name: 'stcw-compliance', description: 'STCW Hours of Rest compliance validation', file: 'server/tests/stcw-compliance.test.ts', category: 'compliance', runnable: false },
  { name: 'work-orders-inventory', description: 'Work order lifecycle and inventory management', file: 'server/tests/work-orders-inventory.test.ts', category: 'operations', runnable: false },
  { name: 'alerts-engine', description: 'Alert configuration, triggering, and notifications', file: 'server/tests/alerts-engine.test.ts', category: 'alerts', runnable: false },
  { name: 'database-integrity', description: 'Database schema, constraints, and sync validation', file: 'server/tests/database-integrity.test.ts', category: 'database', runnable: false },
  { name: 'performance-stress', description: 'Throughput, latency, and stress testing', file: 'server/tests/performance-stress.test.ts', category: 'performance', runnable: false },
];

const testSuites = [...smokeSuites, ...jestSuites];
const testResults: Map<string, { status: 'running' | 'passed' | 'failed'; output: string; startedAt: string; completedAt?: string; tests?: any[] }> = new Map();

function formatSmokeTestOutput(result: { suite: string; passed: number; failed: number; total: number; duration: number; tests: any[]; timestamp: string }): string {
  let output = `\n🧪 Smoke Test Suite: ${result.suite}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const test of result.tests) { output += `${test.passed ? '✅' : '❌'} ${test.name} (${test.duration}ms)\n`; if (test.error) { output += `   └─ ${test.error}\n`; } }
  output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 Results: ${result.passed}/${result.total} passed`; if (result.failed > 0) { output += ` (${result.failed} failed)`; }
  output += `\n⏱️  Duration: ${result.duration}ms\n🕐 Completed: ${result.timestamp}\n`; return output;
}

export function registerTestsRoutes(router: Router) {
  router.get("/test-suites", (req: Request, res: Response) => {
    const suitesWithStatus = testSuites.map(suite => ({ ...suite, lastRun: testResults.get(suite.name) || null }));
    res.json({ suites: suitesWithStatus, totalCount: testSuites.length, categories: [...new Set(testSuites.map(s => s.category))] });
  });

  router.post("/test-suites/:name/run", async (req: Request, res: Response) => {
    const { name } = req.params; const suite = testSuites.find(s => s.name === name);
    if (!suite) { res.status(404).json({ error: `Test suite '${name}' not found` }); return; }
    if (!suite.runnable) { res.status(400).json({ error: `Test suite '${name}' requires too much memory to run in-app. Use CI/CD pipeline or run locally with: npx jest ${suite.file} --forceExit` }); return; }
    if (testResults.get(name)?.status === 'running') { res.status(409).json({ error: `Test suite '${name}' is already running` }); return; }
    testResults.set(name, { status: 'running', output: 'Starting smoke tests...\n', startedAt: new Date().toISOString() });
    res.json({ message: `Test suite '${name}' started`, status: 'running', startedAt: testResults.get(name)?.startedAt });
    try {
      const { smokeTestSuites } = await import('../../diagnostics-smoke-tests.js'); const runner = smokeTestSuites[name];
      if (runner) { const result = await runner(); const output = formatSmokeTestOutput(result); testResults.set(name, { status: result.failed === 0 ? 'passed' : 'failed', output, startedAt: testResults.get(name)?.startedAt || new Date().toISOString(), completedAt: new Date().toISOString(), tests: result.tests }); logger.info('Diagnostics', `Smoke test '${name}' completed: ${result.passed}/${result.total} passed`); }
      else { throw new Error(`Smoke test runner not found for: ${name}`); }
    } catch (_error) { testResults.set(name, { status: 'failed', output: `Error: ${error instanceof Error ? error.message : String(error)}`, startedAt: testResults.get(name)?.startedAt || new Date().toISOString(), completedAt: new Date().toISOString() }); logger.error('Diagnostics', `Smoke test '${name}' failed`, error instanceof Error ? error : new Error(String(error))); }
  });

  router.get("/test-suites/:name/status", (req: Request, res: Response) => {
    const { name } = req.params; const result = testResults.get(name);
    if (!result) { res.json({ status: 'not_run', message: 'Test has not been run yet' }); return; }
    res.json(result);
  });

  router.get("/test-simulators", (req: Request, res: Response) => {
    const simulators = [
      { name: 'vessel-simulator', description: 'Physics-aware vessel telemetry simulation', file: 'server/vessel-simulator.ts', capabilities: ['Engine RPM patterns', 'Thermal dynamics', 'Vibration components', 'Fault injection', 'Multiple vessel types'] },
      { name: 'logbook-test-simulator', description: 'Logbook-specific telemetry patterns', file: 'server/tests/helpers/logbook-test-simulator.ts', capabilities: ['Main engine telemetry', 'Generator telemetry', 'Weather data', 'Position tracking', 'Fuel consumption', 'Anomaly injection'] },
      { name: 'stress-test', description: 'High-throughput telemetry stress testing', file: 'server/vessel-simulator.ts', capabilities: ['Configurable message rate', 'Batch writer integration', 'Performance metrics'] },
    ];
    res.json({ simulators, totalCount: simulators.length });
  });
}

```

### `server/routes/diagnostics/helpers.ts` (58 lines)

```ts
/**
 * Diagnostics Routes - Helper Functions
 */

import { storage } from "../../storage.js";
import type { CheckResult, ServiceStatus } from "./types.js";

export const startTime = Date.now();

export async function runHealthChecks() {
  const [database, telemetry, memory] = await Promise.all([checkDatabase(), checkTelemetry(), checkMemory()]);
  const services = await checkServices();
  return { database, telemetry, memory, services };
}

export async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const orgs = await storage.getOrganizations();
    return { status: 'pass', responseTimeMs: Date.now() - start, details: { organizationCount: orgs.length } };
  } catch (error) {
    return { status: 'fail', responseTimeMs: Date.now() - start, message: error instanceof Error ? error.message : 'Database check failed' };
  }
}

export async function checkTelemetry(): Promise<CheckResult> {
  try {
    const { telemetryBatchWriter } = await import("../../telemetry-batch-writer.js");
    const stats = telemetryBatchWriter.getStats();
    const bufferUtilization = stats.maxBufferSize > 0 ? (stats.currentBufferSize / stats.maxBufferSize) * 100 : 0;
    if (bufferUtilization > 90) { return { status: 'warn', message: 'Telemetry buffer near capacity', details: { bufferUtilization: Math.round(bufferUtilization) } }; }
    return { status: 'pass', details: { bufferUtilization: Math.round(bufferUtilization), totalWritten: stats.totalWritten } };
  } catch { return { status: 'warn', message: 'Telemetry service not available' }; }
}

export async function checkMemory(): Promise<CheckResult> {
  const memoryUsage = process.memoryUsage();
  const utilizationPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  const details = { heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024), utilizationPercent: Math.round(utilizationPercent) };
  if (utilizationPercent > 90) { return { status: 'fail', message: 'Critical memory pressure', details }; }
  if (utilizationPercent > 70) { return { status: 'warn', message: 'Elevated memory usage', details }; }
  return { status: 'pass', details };
}

export async function checkServices(): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = [];
  try {
    await import("../../telemetry-batch-writer.js");
    services.push({ name: 'telemetry-batch-writer', status: 'running', lastHealthCheck: new Date().toISOString() });
  } catch { services.push({ name: 'telemetry-batch-writer', status: 'stopped' }); }
  return services;
}

export function determineOverallStatus(checks: { database: CheckResult; telemetry: CheckResult; memory: CheckResult; services: ServiceStatus[] }): 'healthy' | 'degraded' | 'unhealthy' {
  if (checks.database.status === 'fail' || checks.memory.status === 'fail') { return 'unhealthy'; }
  if (checks.database.status === 'warn' || checks.telemetry.status === 'warn' || checks.memory.status === 'warn') { return 'degraded'; }
  return 'healthy';
}

```

---

## PdM Platform (Feature Store, Fleet Analytics, Model Registry, Inference, Monitoring, Digital Twin, Training, Governance)

### `server/domains/pdm-platform/feature-store/routes.ts` (52 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { FeatureStoreAdapter } from "./adapter";

const router = Router();
const featureStore = new FeatureStoreAdapter();

const computeSchema = z.object({
  equipmentId: z.string().min(1),
  windowMinutes: z.number().int().positive().optional(),
});

router.post("/compute", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { equipmentId, windowMinutes } = parsed.data;
    const result = await featureStore.computeAndStore(orgId, equipmentId, windowMinutes);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/latest", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const equipmentId = req.query.equipmentId as string;
    if (!equipmentId) return res.status(400).json({ error: "equipmentId query param required" });
    const result = await featureStore.getLatest(orgId, equipmentId);
    res.json(result ?? { message: "No features found" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const equipmentId = req.query.equipmentId as string;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    if (!equipmentId) return res.status(400).json({ error: "equipmentId query param required" });
    const result = await featureStore.getHistory(orgId, equipmentId, from, to);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as featureStoreRouter };

```

### `server/domains/pdm-platform/fleet-analytics/routes.ts` (50 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { FleetAnalyticsAdapter } from "./adapter";

const router = Router();
const fleetAnalytics = new FleetAnalyticsAdapter();

const computeBaselinesSchema = z.object({
  equipmentType: z.string().min(1),
});

router.post("/baselines/compute", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = computeBaselinesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { equipmentType } = parsed.data;
    const result = await fleetAnalytics.computeBaselines(orgId, equipmentType);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/baselines", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const equipmentType = req.query.equipmentType as string;
    if (!equipmentType) return res.status(400).json({ error: "equipmentType query param required" });
    const result = await fleetAnalytics.getBaselines(orgId, equipmentType);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/compare", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const equipmentId = req.query.equipmentId as string;
    const equipmentType = req.query.equipmentType as string;
    if (!equipmentId || !equipmentType) return res.status(400).json({ error: "equipmentId and equipmentType required" });
    const result = await fleetAnalytics.compareToFleet(orgId, equipmentId, equipmentType);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as fleetAnalyticsRouter };

```

### `server/domains/pdm-platform/model-registry/routes.ts` (99 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ModelRegistryAdapter } from "./adapter";

const router = Router();
const registry = new ModelRegistryAdapter();

const createVersionSchema = z.object({
  version: z.string().min(1),
  artifactPath: z.string().optional(),
  changelog: z.string().optional(),
});

const deploySchema = z.object({
  modelVersionId: z.string().min(1),
  target: z.string().default("cloud"),
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.listModels(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:modelId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.getModel(orgId, req.params.modelId);
    if (!result) return res.status(404).json({ error: "Model not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:modelId/versions", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.listVersions(orgId, req.params.modelId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:modelId/versions", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const result = await registry.createVersion({
      orgId,
      modelId: req.params.modelId,
      ...parsed.data,
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:modelId/deployment", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.getActiveDeployment(orgId, req.params.modelId);
    res.json(result ?? { message: "No active deployment" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:modelId/deploy", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = deploySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { modelVersionId, target } = parsed.data;
    const result = await registry.deploy(orgId, req.params.modelId, modelVersionId, target);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/deployments/:deploymentId/rollback", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await registry.rollback(orgId, parseInt(req.params.deploymentId));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as modelRegistryRouter };

```

### `server/domains/pdm-platform/inference/routes.ts` (40 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { StubInferenceRunner } from "./stub-runner";
import { PredictionEngineService } from "./prediction-engine.service";

const router = Router();
const runner = new StubInferenceRunner();
const predictionEngine = new PredictionEngineService(runner);

const inferSchema = z.object({
  equipmentId: z.string().min(1),
  modelVersionId: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = inferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { equipmentId, modelVersionId } = parsed.data;
    const result = await predictionEngine.predict(orgId, equipmentId, modelVersionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/predictions/:predictionId/explanations", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const predictionId = parseInt(req.params.predictionId);
    if (isNaN(predictionId)) return res.status(400).json({ error: "Invalid predictionId" });
    const result = await predictionEngine.getExplanations(orgId, predictionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as inferenceRouter };

```

### `server/domains/pdm-platform/monitoring/routes.ts` (35 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ModelMonitoringAdapter } from "./adapter";

const router = Router();
const monitoring = new ModelMonitoringAdapter();

const computeDriftSchema = z.object({
  windowDays: z.number().int().positive().optional(),
});

router.post("/:modelVersionId/compute", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = computeDriftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { windowDays } = parsed.data;
    const result = await monitoring.computeDrift(orgId, req.params.modelVersionId, windowDays);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:modelVersionId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await monitoring.getDrift(orgId, req.params.modelVersionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as monitoringRouter };

```

### `server/domains/pdm-platform/training-pipeline/routes.ts` (141 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { TrainingPipelineService } from "./training-pipeline.service";

const router = Router();
const service = new TrainingPipelineService();

const createDatasetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sourceType: z.string().min(1),
  sourceConfig: z.record(z.unknown()).optional(),
  featureColumns: z.array(z.string()).optional(),
  labelColumn: z.string().optional(),
  targetType: z.string().optional(),
  timeRangeStart: z.string().datetime().optional(),
  timeRangeEnd: z.string().datetime().optional(),
  rowCount: z.number().int().positive().optional(),
  splitConfig: z.record(z.unknown()).optional(),
  createdBy: z.string().optional(),
});

const startRunSchema = z.object({
  datasetId: z.string().min(1),
  config: z.record(z.unknown()).optional().default({}),
  hyperparameters: z.record(z.unknown()).optional().default({}),
  initiatedBy: z.string().optional(),
});

const promoteSchema = z.object({
  modelId: z.string().min(1),
  version: z.string().min(1),
  changelog: z.string().optional(),
});

router.post("/datasets", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = createDatasetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const data = {
      ...parsed.data,
      orgId,
      timeRangeStart: parsed.data.timeRangeStart ? new Date(parsed.data.timeRangeStart) : undefined,
      timeRangeEnd: parsed.data.timeRangeEnd ? new Date(parsed.data.timeRangeEnd) : undefined,
    };
    const result = await service.createDataset(data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/datasets", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const status = req.query.status as string | undefined;
    const result = await service.listDatasets(orgId, status);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/datasets/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await service.getDataset(orgId, req.params.id);
    if (!result) return res.status(404).json({ error: "Dataset not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/runs", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = startRunSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { datasetId, config, hyperparameters, initiatedBy } = parsed.data;
    const result = await service.startTrainingRun(orgId, datasetId, config, hyperparameters, initiatedBy);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message.includes("not found")) return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get("/runs", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const status = req.query.status as string | undefined;
    const datasetId = req.query.datasetId as string | undefined;
    const result = await service.listRuns(orgId, { status, datasetId });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/runs/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await service.getRunStatus(orgId, req.params.id);
    if (!result) return res.status(404).json({ error: "Training run not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/runs/:id/promote", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = promoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { modelId, version, changelog } = parsed.data;
    const result = await service.promoteModelVersion(orgId, req.params.id, modelId, version, changelog);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message.includes("not found") || error.message.includes("not completed")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/artifacts", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const modelVersionId = req.query.modelVersionId as string;
    if (!modelVersionId) return res.status(400).json({ error: "modelVersionId query param required" });
    const result = await service.listArtifacts(orgId, modelVersionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as trainingPipelineRouter };

```

### `server/domains/pdm-platform/prediction-governance/routes.ts` (109 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { PredictionGovernanceAdapter } from "./adapter";
import { PredictionGovernanceService } from "./prediction-governance.service";

const router = Router();
const adapter = new PredictionGovernanceAdapter();
const service = new PredictionGovernanceService(adapter);

router.get("/predictions", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const reviewStatus = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const predictions = await service.listByGovernanceStatus({
      orgId,
      reviewStatus,
      limit,
      offset,
    });
    res.json(predictions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/predictions/:id", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid prediction ID" });

    const details = await service.getGovernanceDetails(orgId, id);
    if (!details) return res.status(404).json({ error: "Prediction not found" });
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function getReviewerIdentity(req: Request): string {
  return (req.headers["x-admin-id"] as string) ?? "system-admin";
}

router.patch("/predictions/:id/review", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid prediction ID" });

    const reviewedBy = getReviewerIdentity(req);
    const result = await service.reviewPrediction(orgId, id, reviewedBy);
    if (!result) return res.status(404).json({ error: "Prediction not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/predictions/:id/approve", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid prediction ID" });

    const reviewedBy = getReviewerIdentity(req);
    const result = await service.approvePrediction(orgId, id, reviewedBy);
    if (!result) return res.status(404).json({ error: "Prediction not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const suppressSchema = z.object({
  reason: z.string().min(1),
});

router.patch("/predictions/:id/suppress", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid prediction ID" });

    const parsed = suppressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });

    const reviewedBy = getReviewerIdentity(req);
    const result = await service.suppressPrediction(orgId, id, reviewedBy, parsed.data.reason);
    if (!result) return res.status(404).json({ error: "Prediction not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/predictions/expire-stale", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await service.expireStale(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as predictionGovernanceRouter };

```

### `server/domains/pdm-platform/twin-updates/routes.ts` (73 lines)

```ts
import { Router, type Request, type Response } from "express";
import { TwinUpdateService } from "./twin-update.service";
import { TwinFreshnessAdapter } from "./adapter";
import { TwinStateService } from "../digital-twin/twin-state/twin-state.service";
import { TwinStateAdapter } from "../digital-twin/twin-state/adapter";
import { TwinDefinitionAdapter } from "../digital-twin/twin-definition/adapter";
import { TelemetryAdapter } from "../feature-store/telemetry-adapter";
import { ResidualAnalysisService } from "../digital-twin/residual-analysis/residual-analysis.service";

const router = Router();

const freshnessAdapter = new TwinFreshnessAdapter();
const stateAdapter = new TwinStateAdapter();
const definitionAdapter = new TwinDefinitionAdapter();
const telemetryAdapter = new TelemetryAdapter();
const twinStateService = new TwinStateService(stateAdapter, definitionAdapter, telemetryAdapter);
const residualService = new ResidualAnalysisService();
const updateService = new TwinUpdateService(freshnessAdapter, twinStateService, residualService);

router.post("/refresh/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { twinId } = req.params;
    if (!twinId) return res.status(400).json({ error: "twinId is required" });
    const result = await updateService.refreshOneTwin(orgId, twinId);
    res.json({
      success: true,
      twinId,
      healthScore: result.state.healthScore,
      residualCount: result.residuals.length,
      timestamp: result.state.timestamp,
    });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/refresh-all", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await updateService.refreshAllActiveTwins(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/freshness", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const freshness = await updateService.getFreshnessStatus(orgId);
    res.json(freshness);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/freshness/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { twinId } = req.params;
    const freshness = await updateService.getTwinFreshness(orgId, twinId);
    if (!freshness) return res.status(404).json({ error: "Twin not found or not active" });
    res.json(freshness);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as twinUpdatesRouter };

```

### `server/domains/pdm-platform/digital-twin/twin-definition/routes.ts` (74 lines)

```ts
import { Router, type Request, type Response } from "express";
import { insertAssetTwinTemplateSchema, insertAssetTwinSchema } from "@shared/schema";
import { TwinDefinitionAdapter } from "./adapter";

const router = Router();
const adapter = new TwinDefinitionAdapter();

router.get("/templates", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await adapter.listTemplates(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/templates/:templateId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await adapter.getTemplate(orgId, req.params.templateId);
    if (!result) return res.status(404).json({ error: "Template not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/templates", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = insertAssetTwinTemplateSchema.safeParse({ ...req.body, orgId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const result = await adapter.createTemplate(parsed.data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/twins", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await adapter.listTwins(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/twins/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await adapter.getTwin(orgId, req.params.twinId);
    if (!result) return res.status(404).json({ error: "Twin not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/twins", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = insertAssetTwinSchema.safeParse({ ...req.body, orgId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const result = await adapter.createTwin(parsed.data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as twinDefinitionRouter };

```

### `server/domains/pdm-platform/digital-twin/twin-state/routes.ts` (62 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { TwinStateService } from "./twin-state.service";
import { TwinStateAdapter } from "./adapter";
import { TwinDefinitionAdapter } from "../twin-definition/adapter";
import { TelemetryAdapter } from "../../feature-store/telemetry-adapter";

const router = Router();
const stateAdapter = new TwinStateAdapter();
const definitionAdapter = new TwinDefinitionAdapter();
const telemetryAdapter = new TelemetryAdapter();
const stateService = new TwinStateService(stateAdapter, definitionAdapter, telemetryAdapter);

const computeSchema = z.object({
  twinId: z.string().min(1),
});

router.post("/compute", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const result = await stateService.computeState(orgId, parsed.data.twinId);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/latest/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { twinId } = req.params;
    const result = await stateService.getLatestState(orgId, twinId);
    if (!result) return res.status(404).json({ error: "No state found for twin" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

router.get("/history/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { twinId } = req.params;
    const parsed = historyQuerySchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : undefined;
    const result = await stateService.getStateHistory(orgId, twinId, limit);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as twinStateRouter };

```

### `server/domains/pdm-platform/digital-twin/residual-analysis/routes.ts` (58 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ResidualAnalysisService } from "./residual-analysis.service";

const router = Router();
const service = new ResidualAnalysisService();

const computeSchema = z.object({
  twinId: z.string().min(1),
});

router.post("/compute", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const result = await service.computeResiduals(orgId, parsed.data.twinId);
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

const limitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

router.get("/twin/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = limitSchema.safeParse(req.query);
    const limit = parsed.success ? parsed.data.limit : undefined;
    const result = await service.getResidualsByTwin(
      orgId,
      req.params.twinId,
      limit
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/rankings", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await service.getResidualRankings(orgId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as residualAnalysisRouter };

```

### `server/domains/pdm-platform/digital-twin/scenario-sim/routes.ts` (61 lines)

```ts
import { Router, type Request, type Response } from "express";
import { ScenarioSimAdapter } from "./adapter";
import { ScenarioSimService } from "./scenario-sim.service";
import { TwinStateAdapter } from "../twin-state/adapter";
import { z } from "zod";

const router = Router();
const scenarioAdapter = new ScenarioSimAdapter();
const stateAdapter = new TwinStateAdapter();
const service = new ScenarioSimService(scenarioAdapter, stateAdapter);

const runScenarioSchema = z.object({
  twinId: z.string().min(1),
  name: z.string().min(1),
  parameters: z.object({
    loadPercent: z.number().min(0).max(120).optional(),
    temperatureOffset: z.number().min(-50).max(50).optional(),
    maintenanceDelayDays: z.number().min(0).max(365).optional(),
  }),
});

router.post("/run", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = runScenarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { twinId, name, parameters } = parsed.data;
    const result = await service.runScenario(orgId, twinId, name, parameters);
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get("/twins/:twinId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await scenarioAdapter.listScenarios(orgId, req.params.twinId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:scenarioId", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const result = await scenarioAdapter.getScenario(orgId, req.params.scenarioId);
    if (!result) return res.status(404).json({ error: "Scenario not found" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as scenarioSimRouter };

```

### `server/domains/pdm-platform/digital-twin/replay/routes.ts` (71 lines)

```ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { insertTwinEventSchema } from "@shared/schema";
import { ReplayAdapter } from "./adapter";

const router = Router();
const adapter = new ReplayAdapter();

router.post("/events", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = insertTwinEventSchema.safeParse({ ...req.body, orgId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const result = await adapter.logEvent(parsed.data);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const timelineQuerySchema = z.object({
  twinId: z.string().min(1),
  startTime: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid startTime"),
  endTime: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid endTime"),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

router.get("/timeline", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = timelineQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { twinId, startTime, endTime, limit } = parsed.data;
    const result = await adapter.getTimeline({
      orgId,
      twinId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      limit,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const anomalyQuerySchema = z.object({
  twinId: z.string().min(1),
  anomalyTimestamp: z.string().refine((s) => !isNaN(Date.parse(s)), "Invalid anomalyTimestamp"),
  windowMinutes: z.coerce.number().int().min(1).max(1440).optional(),
});

router.get("/timeline/anomaly", async (req: Request, res: Response) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const parsed = anomalyQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { twinId, anomalyTimestamp, windowMinutes } = parsed.data;
    const result = await adapter.getTimelineAroundAnomaly({
      orgId,
      twinId,
      anomalyTimestamp: new Date(anomalyTimestamp),
      windowMinutes,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as replayRouter };

```

---

## Miscellaneous (Agent, Inline, Equipment Context, Route Dependencies, Domain Registry)

### `server/routes/agent-routes.ts` (126 lines)

```ts
import { Router, Request, Response } from 'express';
import { readHeartbeat, isAgentAlive, getHeartbeatAge } from '../services/agent-heartbeat';
import { getBridgeState } from '../services/sqlite-bridge';
import { isIngestionRunning } from '../ingestion/startIngestion';
import { telemetryBatchWriter } from '../telemetry-batch-writer';

const router = Router();

const HEARTBEAT_PATH = process.env.ARUS_HEARTBEAT_PATH || '/tmp/arus-agent-heartbeat.json';

router.get('/agent/status', (_req: Request, res: Response) => {
  try {
    const heartbeat = readHeartbeat(HEARTBEAT_PATH);
    const alive = isAgentAlive(heartbeat);
    const age = getHeartbeatAge(heartbeat);

    res.json({
      status: alive ? 'online' : 'offline',
      heartbeat: heartbeat || null,
      ageMs: age,
      maxAgeMs: 5000,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read agent status' });
  }
});

router.get('/bridge/status', (_req: Request, res: Response) => {
  try {
    const bridgeState = getBridgeState();
    const writerStats = telemetryBatchWriter.getStats();
    const isRunning = isIngestionRunning();

    res.json({
      bridge: {
        isRunning: bridgeState.isRunning,
        lastSuccessAt: bridgeState.lastSuccessAt,
        cursorLastId: bridgeState.cursorLastId,
        lagFrames: bridgeState.lagFrames,
        retryBackoffMs: bridgeState.retryBackoffMs,
        pgOffline: bridgeState.pgOffline,
      },
      writer: {
        bufferSize: writerStats.bufferSize,
        totalFlushed: writerStats.totalFlushed,
        totalEvicted: writerStats.totalEvicted,
        totalErrors: writerStats.totalErrors,
        lastFlushTime: writerStats.lastFlushTime,
        isRunning: writerStats.isRunning,
      },
      ingestion: {
        isRunning,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read bridge status' });
  }
});

router.get('/ingestion/verify', (_req: Request, res: Response) => {
  try {
    const heartbeat = readHeartbeat(HEARTBEAT_PATH);
    const agentAlive = isAgentAlive(heartbeat);
    const bridgeState = getBridgeState();
    const writerStats = telemetryBatchWriter.getStats();
    const writerActive = telemetryBatchWriter.isActive();

    // Thresholds for health checks
    const MAX_LAG_FRAMES = 1000;
    const MAX_COMMIT_AGE_MS = 60000; // 1 minute
    const MAX_BACKOFF_MS = 30000;

    // Calculate derived metrics
    const lagFrames = bridgeState.lagFrames ?? 0;
    const lastCommitAt = writerStats.lastFlushTime;
    const commitAgeMs = lastCommitAt ? Date.now() - new Date(lastCommitAt).getTime() : null;
    const backoffMs = bridgeState.retryBackoffMs ?? 0;
    
    // Check thresholds
    const lagOk = lagFrames < MAX_LAG_FRAMES;
    const commitRecent = commitAgeMs === null || commitAgeMs < MAX_COMMIT_AGE_MS;
    const backoffOk = backoffMs < MAX_BACKOFF_MS;

    // Pipeline healthy = all checks pass
    const pipelineHealthy = 
      agentAlive && 
      bridgeState.isRunning && 
      !bridgeState.pgOffline && 
      writerActive && 
      lagOk && 
      commitRecent && 
      backoffOk;

    res.json({
      pipelineHealthy,
      checks: {
        agentAlive,
        bridgeRunning: bridgeState.isRunning,
        pgOnline: !bridgeState.pgOffline,
        writerActive,
        lagOk,
        commitRecent,
        backoffOk,
      },
      metrics: {
        rawFramesRecentCount: heartbeat?.framesWritten ?? 0,
        bridgeLagFrames: lagFrames,
        cursorLastId: bridgeState.cursorLastId ?? 0,
        postgresLastCommitAt: lastCommitAt,
        postgresCommitAgeMs: commitAgeMs,
        backoffMs,
        totalFlushed: writerStats.totalFlushed,
        totalErrors: writerStats.totalErrors,
      },
      thresholds: {
        maxLagFrames: MAX_LAG_FRAMES,
        maxCommitAgeMs: MAX_COMMIT_AGE_MS,
        maxBackoffMs: MAX_BACKOFF_MS,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify ingestion', pipelineHealthy: false });
  }
});

export default router;

```

### `server/routes/inline-routes.ts` (194 lines)

```ts
/**
 * Inline Routes - Miscellaneous routes not part of domain modules
 * Extracted from routes.ts for modularization
 */

import type { Express, Request, Response } from "express";
import { generalApiRateLimit, storage } from "./route-dependencies";
import { cryptoRandom } from "@shared/crypto-random";
import { telemetryDlqRouter } from "./telemetry-dlq-routes";
import { telemetryIngestionRouter } from "./telemetry-ingestion-routes";

export function registerInlineRoutes(app: Express): void {
  // DEV ONLY: Direct batch writer stress test (bypasses auth for testing)
  if (process.env.NODE_ENV === "development") {
    app.post("/api/dev/telemetry/stress-test", generalApiRateLimit, async (req: Request, res: Response) => {
      try {
        const { telemetryBatchWriter } = await import("../telemetry-batch-writer");
        
        const { 
          messagesPerSecond = 500, 
          durationSeconds = 5,
          sensorTypes = ["temperature", "pressure", "vibration"]
        } = req.body;

        console.log(`[DEV] Starting batch writer stress test: ${messagesPerSecond} msg/sec for ${durationSeconds}s`);

        const startStats = telemetryBatchWriter.getStats();
        const startTime = Date.now();
        let messagesSent = 0;
        const targetMessages = messagesPerSecond * durationSeconds;
        const batchSize = 100;

        while (messagesSent < targetMessages) {
          const batchEnd = Math.min(messagesSent + batchSize, targetMessages);
          
          for (let i = messagesSent; i < batchEnd; i++) {
            const sensorType = sensorTypes[i % sensorTypes.length];
            telemetryBatchWriter.queue({
              equipmentId: `stress-test-equipment-${i % 5}`,
              sensorType,
              value: 50 + cryptoRandom() * 50,
              timestamp: new Date(),
              orgId: "stress-test-org",
              unit: sensorType === "temperature" ? "C" : sensorType === "pressure" ? "bar" : "mm/s",
              metadata: { stressTest: true, msgIndex: i },
            });
          }
          
          messagesSent = batchEnd;
          
          if (messagesSent % 1000 === 0) {
            await new Promise(r => setImmediate(r));
          }
        }

        await new Promise(r => setTimeout(r, 2000));

        const endStats = telemetryBatchWriter.getStats();
        const elapsedMs = Date.now() - startTime;

        const result = {
          messagesSent,
          targetMessages,
          durationMs: elapsedMs,
          actualMsgPerSec: Math.round(messagesSent / (elapsedMs / 1000)),
          stats: {
            queued: endStats.totalQueued - startStats.totalQueued,
            flushed: endStats.totalFlushed - startStats.totalFlushed,
            evicted: endStats.totalEvicted - startStats.totalEvicted,
            errors: endStats.totalErrors - startStats.totalErrors,
            avgFlushDurationMs: endStats.avgFlushDurationMs,
            currentBufferSize: endStats.bufferSize,
          },
        };

        console.log(`[DEV] Stress test complete:`, result);

        res.json({
          success: true,
          result,
          note: "DEV ONLY - This endpoint bypasses auth and uses fake equipment IDs. Data goes to batch writer but may fail on DB insert due to FK constraints.",
        });
      } catch (error) {
        console.error("[DEV] Stress test failed:", error);
        res.status(500).json({ 
          error: "Stress test failed", 
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
    console.log("[Inline Routes] DEV stress-test endpoint registered");
  }

  // MQTT Reliable Sync health endpoint
  app.get("/api/mqtt/reliable-sync/health", generalApiRateLimit, async (req: Request, res: Response) => {
    try {
      const { mqttReliableSync } = await import("../mqtt-reliable-sync");
      const healthStatus = mqttReliableSync.getHealthStatus();
      const metrics = mqttReliableSync.getMetrics();

      res.json({
        service: "MQTT Reliable Sync Service",
        status: healthStatus.status === "connected" ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        mqtt: healthStatus,
        detailedMetrics: metrics,
      });
    } catch (error) {
      res.status(500).json({
        service: "MQTT Reliable Sync Service",
        message: "Failed to get MQTT health status",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Load Distribution Analysis (VPS Feature)
  app.get("/api/equipment/:id/load-distribution", async (req: Request, res: Response) => {
    try {
      const equipmentId = req.params.id;
      const orgId = req.headers["x-org-id"] as string;

      if (!orgId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }

      const equipment = await storage.getEquipment(orgId, equipmentId);
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      const now = new Date();
      const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : defaultStart;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : now;

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Use ISO 8601 strings." });
      }

      if (startDate > endDate) {
        return res.status(400).json({ message: "Start date must be before end date" });
      }

      const { computeEquipmentLoadDistribution } = await import("../vps-kpi-service.js");

      const loadDistribution = await computeEquipmentLoadDistribution(equipmentId, orgId, {
        start: startDate,
        end: endDate,
      });

      const telemetry = await storage.getTelemetryByEquipment(
        equipmentId,
        startDate,
        endDate,
        orgId
      );

      const torqueCount = telemetry.filter(
        (t) => t.sensor_type === "shaft_torque" || t.sensor_type === "torque"
      ).length;

      res.setHeader("Cache-Control", "public, max-age=300");
      res.json({
        bins: loadDistribution,
        metadata: {
          equipmentId,
          equipmentName: equipment.name,
          equipmentType: equipment.type,
          sampleCount: torqueCount,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
          timezone: "UTC",
        },
      });
    } catch (error) {
      console.error("Failed to compute load distribution:", error);
      res.status(500).json({ message: "Failed to compute load distribution" });
    }
  });

  // Register Telemetry DLQ routes
  app.use("/api/telemetry/dlq", generalApiRateLimit, telemetryDlqRouter);

  // Register Telemetry Ingestion routes (archive, heartbeat, batch, schema)
  app.use("/api/telemetry/ingestion", generalApiRateLimit, telemetryIngestionRouter);

  console.log("[Inline Routes] Registered (mqtt-health, load-distribution, telemetry-dlq, telemetry-ingestion)");
}

```

### `server/routes/equipment-context-routes.ts` (10 lines)

```ts
/**
 * Equipment Context Routes - Backward-compatible shim
 *
 * MODULARIZED: 645 lines → 5 focused modules (~70-180 lines each)
 */

export type { EquipmentContext, ContextQueryOptions } from './equipment-context/types';
export { contextQuerySchema } from './equipment-context/types';
export { registerEquipmentContextRoutes } from './equipment-context/routes';
export { buildEquipmentContext } from './equipment-context/context-builder';

```

### `server/routes/route-dependencies.ts` (177 lines)

```ts
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

```

### `server/routes/domain-router-registry.ts` (255 lines)

```ts
/**
 * Domain Router Registry - Centralized domain router registration
 * Extracted from routes.ts for modularization
 * 
 * This file defines all domain routers and their dependencies in a declarative way,
 * dramatically reducing the main routes.ts file size.
 */

import type { Express } from "express";
import {
  storage,
  generalApiRateLimit,
  writeOperationRateLimit,
  criticalOperationRateLimit,
  crewOperationRateLimit,
  reportGenerationRateLimit,
  telemetryRateLimit,
  requireOrgId,
  requireValidOrgId,
  validateHMAC,
  requireAdminAuth,
  auditAdminAction,
  getSyncMetrics,
  processPendingEvents,
  recordAndPublish,
  schedulerEventBus,
  adaptiveTrainingWindow,
  getWebSocketServer,
  getFMCCService,
  updateFleetHealthScore,
  checkMonthCompliance,
  normalizeRestDays,
  generatePdfFilename,
  renderRestPdf,
  incrementIdempotencyHit,
  incrementHorImport,
  incrementHorPdfExport,
  incrementRangeQuery,
  recordRangeQueryDuration,
  getDatabaseHealth,
  enableTimescaleDB,
  createHypertable,
  createContinuousAggregate,
  enableCompression,
  getRetentionPolicy,
  updateRetentionPolicy,
  applyTelemetryRetention,
  getDatabasePerformanceHealth,
  getIndexOptimizationSuggestions,
  getBackupStatus,
  listBackups,
  createFullBackup,
  createSchemaBackup,
  cleanupOldBackups,
  verifyBackupIntegrity,
  mqttIngestionService,
  mlAnalyticsService,
  digitalTwinService,
  db,
  upload,
  adminPasswordVerifySchema,
  adminPasswordChangeSchema,
  insertAdminAuditEventSchema,
  insertAdminSystemSettingSchema,
  insertIntegrationConfigSchema,
  insertMaintenanceWindowSchema,
  insertSystemPerformanceMetricSchema,
  configAuditLog,
} from "./route-dependencies";

// Type for domain router registration
interface DomainRouterConfig {
  name: string;
  importPath: string;
  functionName: string;
  getDeps: () => Record<string, any>;
}

// All domain routers with their dependencies
const domainRouters: DomainRouterConfig[] = [
  // Core domain routers (basic CRUD)
  { name: "WorkOrder", importPath: "../domains/work-orders/index.js", functionName: "registerWorkOrderRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Equipment", importPath: "../domains/equipment/index.js", functionName: "registerEquipmentRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Vessels", importPath: "../domains/vessels/index.js", functionName: "registerVesselsRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Devices", importPath: "../domains/devices/index.js", functionName: "registerDeviceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Maintenance", importPath: "../domains/maintenance/index.js", functionName: "registerMaintenanceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Inventory", importPath: "../domains/inventory/index.js", functionName: "registerInventoryRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Crew", importPath: "../domains/crew/index.js", functionName: "registerCrewRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },

  // Alerts (special - needs websocket)
  { name: "Alerts", importPath: "../domains/alerts/index.js", functionName: "registerAlertsRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit, wsServer: getWebSocketServer() }) },
  { name: "AlertSettings", importPath: "../domains/alerts/index.js", functionName: "registerAlertSettingsRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },

  // Logbook & Telemetry
  { name: "Logbook", importPath: "../domains/logbook/index.js", functionName: "registerLogbookRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Telemetry", importPath: "../domains/telemetry/index.js", functionName: "registerTelemetryRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit, telemetryRateLimit }) },
  { name: "TelemetryIngestion", importPath: "../domains/telemetry/ingestion-routes.js", functionName: "registerTelemetryIngestionRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit, telemetryRateLimit, requireValidOrgId, validateHMAC }) },

  // Compliance & Notifications
  { name: "Compliance", importPath: "../domains/compliance/index.js", functionName: "registerComplianceRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },
  { name: "Notifications", importPath: "../domains/notifications/index.js", functionName: "registerNotificationRoutes",
    getDeps: () => ({ writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit }) },

  // Integrations
  { name: "Integrations", importPath: "../domains/integrations/index.js", functionName: "registerIntegrationsRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, getFMCCService, updateFleetHealthScore }) },
  { name: "DTC", importPath: "../domains/dtc/index.js", functionName: "registerDtcRoutes",
    getDeps: () => ({ storage, writeOperationRateLimit, getWebSocketServer }) },

  // ML & Analytics
  { name: "MLAnalytics", importPath: "../domains/ml-analytics/index.js", functionName: "registerMlAnalyticsRoutes",
    getDeps: () => ({ storage, writeOperationRateLimit, schedulerEventBus, adaptiveTrainingWindow }) },
  { name: "CostSavings", importPath: "../domains/cost-savings/index.js", functionName: "registerCostSavingsRoutes",
    getDeps: () => ({ writeOperationRateLimit }) },
  { name: "ConditionMonitoring", importPath: "../domains/condition-monitoring/index.js", functionName: "registerConditionMonitoringRoutes",
    getDeps: () => ({ storage, generalApiRateLimit }) },

  // Sync
  { name: "Sync", importPath: "../domains/sync/index.js", functionName: "registerSyncRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, writeOperationRateLimit, getSyncMetrics, processPendingEvents, recordAndPublish }) },
  // NOTE: CrewExtensions MUST be registered BEFORE Scheduling to ensure
  // /api/schedule/runs is matched before the generic /api/schedule/:id
  { name: "CrewExtensions", importPath: "../domains/crew-extensions/index.js", functionName: "registerCrewExtensionsRoutes",
    getDeps: () => ({ storage, crewOperationRateLimit, criticalOperationRateLimit }) },
  { name: "Scheduling", importPath: "../domains/scheduling/index.js", functionName: "registerSchedulingRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },

  // Weather & External
  { name: "StormGeo", importPath: "../domains/stormgeo/index.js", functionName: "registerStormGeoRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },
  { name: "Vibration", importPath: "../domains/vibration/index.js", functionName: "registerVibrationRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit }) },
  // Sensor Management
  { name: "SensorManagement", importPath: "../domains/sensor-management/index.js", functionName: "registerSensorManagementRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit }) },

  // Hub Sync & Insights
  { name: "HubSync", importPath: "../domains/hub-sync/index.js", functionName: "registerHubSyncRoutes",
    getDeps: () => ({ writeOperationRateLimit, generalApiRateLimit }) },
  { name: "InsightsV2", importPath: "../domains/insights/index.js", functionName: "registerInsightsV2Routes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, reportGenerationRateLimit }) },

  // LLM & ML Pipeline
  { name: "LLM", importPath: "../domains/llm/index.js", functionName: "registerLlmRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, reportGenerationRateLimit }) },
  { name: "MLPipeline", importPath: "../domains/ml-pipeline/index.js", functionName: "registerMlPipelineRoutes",
    getDeps: () => ({ storage, generalApiRateLimit }) },

  // Crew Extensions registered earlier (before Scheduling) for route priority
  // Vessel Performance
  { name: "VesselPerformance", importPath: "../domains/vessel-performance/index.js", functionName: "registerVesselPerformanceRoutes",
    getDeps: () => ({ storage, crewOperationRateLimit }) },

  // STCW Rest
  { name: "STCWRest", importPath: "../domains/stcw-rest/index.js", functionName: "registerStcwRestRoutes",
    getDeps: () => ({ storage, writeOperationRateLimit, checkMonthCompliance, normalizeRestDays, generatePdfFilename, renderRestPdf,
      incrementIdempotencyHit, incrementHorImport, incrementHorPdfExport, incrementRangeQuery, recordRangeQueryDuration }) },

  // IoT Processing
  { name: "IoTProcessing", importPath: "../domains/iot-processing/index.js", functionName: "registerIotProcessingRoutes",
    getDeps: () => ({ writeOperationRateLimit, mqttIngestionService, mlAnalyticsService, digitalTwinService }) },

  // System Admin
  { name: "SystemAdmin", importPath: "../domains/system-admin/index.js", functionName: "registerSystemAdminRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction,
      adminPasswordVerifySchema, adminPasswordChangeSchema, insertAdminAuditEventSchema, insertAdminSystemSettingSchema,
      insertIntegrationConfigSchema, insertMaintenanceWindowSchema, insertSystemPerformanceMetricSchema }) },

  // Config Management
  { name: "ConfigManagement", importPath: "../domains/config-management/index.js", functionName: "registerConfigManagementRoutes",
    getDeps: () => ({ db, configAuditLog, generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction }) },

  // Software Updates
  { name: "SoftwareUpdates", importPath: "../domains/software-updates/index.js", functionName: "registerSoftwareUpdatesRoutes",
    getDeps: () => ({ generalApiRateLimit, writeOperationRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction }) },

  // Data Export
  { name: "DataExport", importPath: "../domains/data-export/index.js", functionName: "registerDataExportRoutes",
    getDeps: () => ({ generalApiRateLimit, criticalOperationRateLimit, requireAdminAuth, auditAdminAction, upload }) },

  // Inventory Optimization
  { name: "InventoryOptimization", importPath: "../domains/inventory-optimization/index.js", functionName: "registerInventoryOptimizationRoutes",
    getDeps: () => ({ storage, generalApiRateLimit, writeOperationRateLimit }) },

  // Storage Config
  { name: "StorageConfig", importPath: "../domains/storage-config/index.js", functionName: "registerStorageConfigRoutes",
    getDeps: () => ({}) },

  // Autofill Logs
  { name: "AutofillLogs", importPath: "../domains/autofill-logs/index.js", functionName: "registerAutofillLogsRoutes",
    getDeps: () => ({ writeOperationRateLimit }) },

  // Health Monitoring
  { name: "HealthMonitoring", importPath: "../domains/health-monitoring/index.js", functionName: "registerHealthMonitoringRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit }) },

  // Settings
  { name: "Settings", importPath: "../domains/settings/index.js", functionName: "registerSettingsRoutes",
    getDeps: () => ({ storage, requireOrgId, generalApiRateLimit, writeOperationRateLimit }) },

  // Permissions
  { name: "Permissions", importPath: "../domains/permissions/routes.js", functionName: "registerPermissionRoutes",
    getDeps: () => ({}) },
];

/**
 * Register all domain routers
 */
export async function registerAllDomainRouters(app: Express): Promise<void> {
  console.log("→ Registering domain routers...");
  
  for (const config of domainRouters) {
    try {
      const module = await import(config.importPath);
      const registerFn = module[config.functionName];
      
      if (typeof registerFn !== "function") {
        console.error(`[Domain Registry] ${config.name}: Function ${config.functionName} not found`);
        continue;
      }
      
      const deps = config.getDeps();
      
      // Special handling for alerts (needs different signature)
      if (config.name === "Alerts") {
        const { wsServer, ...otherDeps } = deps;
        registerFn(app, otherDeps, wsServer);
      } else if (config.name === "TelemetryIngestion") {
        const { requireValidOrgId: reqValid, validateHMAC: valHMAC, ...otherDeps } = deps;
        registerFn(app, otherDeps, { requireValidOrgId: reqValid, validateHMAC: valHMAC });
      } else if (config.name === "LLM") {
        registerFn(app, deps.storage, { generalApiRateLimit: deps.generalApiRateLimit, reportGenerationRateLimit: deps.reportGenerationRateLimit });
      } else {
        registerFn(app, deps);
      }
    } catch (error) {
      console.error(`[Domain Registry] Failed to register ${config.name}:`, error);
    }
  }
  
  console.log(`✓ Domain routers registered (${domainRouters.length} modules)`);
}

```

### `server/domains/integrations/routes.ts` (319 lines)

```ts
/**
 * Integrations Domain Module - External Service Integration Routes
 * 
 * Handles integration endpoints for:
 * - FMCC (Aquametro Fuel Monitoring)
 * - Dashboard metrics with caching
 */

import { Express, RequestHandler } from "express";
import { IStorage } from "../../storage";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";

interface IntegrationsRoutesConfig {
  storage: IStorage;
  generalApiRateLimit: RequestHandler;
  getFMCCService: () => any;
  updateFleetHealthScore: (score: number) => void;
}

export function registerIntegrationsRoutes(
  app: Express,
  config: IntegrationsRoutesConfig
): void {
  const { storage, generalApiRateLimit, getFMCCService, updateFleetHealthScore } = config;

  // Dashboard metrics with TTL caching and ETag support
  const dashboardCache = new Map<string, { data: any; etag: string; timestamp: number }>();
  const DASHBOARD_TTL_MS = Number.parseInt(process.env.DASHBOARD_TTL_MS || "60000", 10);

  app.get("/api/dashboard",
    withErrorHandling("fetch dashboard metrics", async (req, res) => {
      const orgId = (req.headers["x-org-id"] as string) || "default-org-id";
      const cacheKey = `dashboard:${orgId}`;
      const now = Date.now();

      const cached = dashboardCache.get(cacheKey);
      if (cached && now - cached.timestamp < DASHBOARD_TTL_MS) {
        const clientEtag = req.headers["if-none-match"];
        if (clientEtag === cached.etag) {
          return res.status(304).end();
        }
        res.setHeader("ETag", cached.etag);
        res.setHeader("Cache-Control", "private, max-age=30");
        return res.json(cached.data);
      }

      const metrics = await storage.getDashboardMetrics(orgId);

      if (metrics.fleetHealth !== undefined) {
        updateFleetHealthScore(metrics.fleetHealth);
      }

      const etag = `"${Buffer.from(JSON.stringify(metrics)).toString("base64").slice(0, 16)}"`;

      dashboardCache.set(cacheKey, {
        data: metrics,
        etag,
        timestamp: now,
      });

      if (dashboardCache.size > 100) {
        const oldestKey = Array.from(dashboardCache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0][0];
        dashboardCache.delete(oldestKey);
      }

      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "private, max-age=30");
      res.json(metrics);
    })
  );

  // Consolidated dashboard summary - combines multiple queries into single response
  const summaryCache = new Map<string, { data: any; timestamp: number }>();
  const SUMMARY_TTL_MS = 60000; // 60 seconds cache

  app.get("/api/dashboard/summary",
    withErrorHandling("fetch dashboard summary", async (req, res) => {
      const orgId = (req.headers["x-org-id"] as string) || "default-org-id";
      const cacheKey = `summary:${orgId}`;
      const now = Date.now();

      const cached = summaryCache.get(cacheKey);
      if (cached && now - cached.timestamp < SUMMARY_TTL_MS) {
        res.setHeader("Cache-Control", "private, max-age=60");
        return res.json(cached.data);
      }

      // Fetch all dashboard data in parallel - extended to reduce frontend API calls
      const { getFleetSTCWSummary, getSTCWComplianceTrends } = await import("../../scheduler/stcw-dashboard");
      
      // Base queries that always work
      const [
        metrics,
        vessels,
        devices,
        equipmentHealth,
        workOrders,
        equipment,
      ] = await Promise.all([
        storage.getDashboardMetrics(orgId),
        storage.getVessels(orgId).catch(() => []),
        storage.getDevices(orgId).catch(() => []),
        storage.getEquipmentHealth(orgId).catch(() => []),
        storage.getWorkOrders(undefined, orgId).catch(() => []),
        storage.getEquipmentRegistry(orgId).catch(() => []),
      ]);
      
      // Extended queries with safe fallbacks (non-blocking)
      const [stcwSummary, stcwTrends] = await Promise.all([
        getFleetSTCWSummary(orgId, 30).catch(() => null),
        getSTCWComplianceTrends(orgId, 30).catch(() => null),
      ]);

      // Static fallback values for optional fields (these can be fetched by components if needed)
      const latestTelemetry: never[] = [];
      const dtcStats = { totalActiveDtcs: 0, criticalDtcs: 0, equipmentWithDtcs: 0, dtcTriggeredWorkOrders: 0 };
      const operatingAlerts: never[] = [];
      const insightsSnapshot = null;
      const insightsJobStats = { pending: 0, processing: 0, completed: 0, failed: 0, totalProcessed: 0, recentInsightsJobs: [] };

      const summary = {
        metrics,
        vessels,
        devices,
        equipmentHealth,
        workOrders: workOrders.slice(0, 50),
        equipment,
        latestTelemetry,
        dtcStats,
        operatingAlerts,
        insightsSnapshot,
        insightsJobStats,
        stcwSummary,
        stcwTrends,
        timestamp: new Date().toISOString(),
      };

      summaryCache.set(cacheKey, { data: summary, timestamp: now });

      if (summaryCache.size > 50) {
        const oldestKey = Array.from(summaryCache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0][0];
        summaryCache.delete(oldestKey);
      }

      res.setHeader("Cache-Control", "private, max-age=60");
      res.json(summary);
    })
  );

  // ===== FMCC (Aquametro Fuel Monitoring) STATUS ENDPOINTS =====

  app.get("/api/integrations/fmcc/status", generalApiRateLimit,
    withErrorHandling("get FMCC status", async (req, res) => {
      const fmccService = getFMCCService();
      const status = fmccService.getStatus();
      
      res.json({
        ok: true,
        fmcc: status,
        description: "Aquametro FMCC (Fuel Mass Consumption Computer) integration status",
        capabilities: status.enabled ? [
          "Real-time fuel flow measurement",
          "Fuel density compensation",
          "Cumulative fuel counters",
          "Multi-circuit monitoring"
        ] : [],
      });
    })
  );

  app.get("/api/integrations/fmcc/diagnostic", generalApiRateLimit,
    withErrorHandling("run FMCC diagnostic", async (req, res) => {
      const fmccService = getFMCCService();
      
      if (!fmccService.isEnabled()) {
        return res.json({
          ok: false,
          status: "disabled",
          message: "FMCC integration is not configured",
          configuration: {
            required: ["FMCC_ENABLED", "FMCC_API_URL"],
            optional: ["FMCC_MODBUS_HOST", "FMCC_API_KEY"],
          },
        });
      }

      const vesselId = req.query.vesselId as string;
      if (!vesselId) {
        return res.status(400).json({
          ok: false,
          message: "vesselId query parameter is required for diagnostic",
        });
      }

      const realtimeData = await fmccService.getRealTimeFuelData(vesselId);
      
      res.json({
        ok: realtimeData.success,
        status: realtimeData.success ? "connected" : "error",
        source: realtimeData.source,
        data: realtimeData.data ? {
          foFlowRate: realtimeData.data.foFlowRate,
          doFlowRate: realtimeData.data.doFlowRate,
          foDensity: realtimeData.data.foDensity,
          timestamp: realtimeData.data.timestamp,
        } : null,
        error: realtimeData.error,
      });
    })
  );

  app.get("/api/integrations/fmcc/fuel/:vesselId", generalApiRateLimit,
    withErrorHandling("retrieve FMCC fuel data", async (req, res) => {
      const { vesselId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          ok: false,
          message: "startDate and endDate query parameters are required (ISO format)",
        });
      }

      const fmccService = getFMCCService();
      
      if (!fmccService.isEnabled()) {
        return res.status(503).json({
          ok: false,
          message: "FMCC integration is not enabled",
        });
      }

      const periodStart = new Date(startDate as string);
      const periodEnd = new Date(endDate as string);
      
      if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
        return res.status(400).json({
          ok: false,
          message: "Invalid date format. Use ISO 8601 format (e.g., 2024-01-15T00:00:00Z)",
        });
      }

      const result = await fmccService.getCumulativeFuelCounters(vesselId, periodStart, periodEnd);
      
      res.json({
        ok: result.success,
        vesselId,
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        source: result.source,
        data: result.data ? {
          foConsumedMt: result.data.foConsumedMt,
          doConsumedMt: result.data.doConsumedMt,
          totalFuelMt: result.data.totalFuelMt,
          avgFoDensity: result.data.avgFoDensity,
          avgDoTemperature: result.data.avgDoTemperature,
          dataPoints: result.data.dataPoints,
          dataCompleteness: result.data.dataCompleteness,
        } : null,
        error: result.error,
      });
    })
  );

  // ===== FLEET STCW COMPLIANCE DASHBOARD ROUTES =====
  
  app.get("/api/dashboard/stcw-summary",
    withErrorHandling("fetch fleet STCW summary", async (req, res) => {
      const orgId = req.orgId!;
      const { days = "30" } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getFleetSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getFleetSTCWSummary(orgId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get("/api/dashboard/stcw-summary/vessel/:vesselId",
    withErrorHandling("fetch vessel STCW summary", async (req, res) => {
      const orgId = req.orgId!;
      const { vesselId } = req.params;
      const { days = "30" } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getVesselSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getVesselSTCWSummary(orgId, vesselId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  app.get("/api/dashboard/stcw-summary/crew/:crewId",
    withErrorHandling("fetch crew STCW summary", async (req, res) => {
      const orgId = req.orgId!;
      const { crewId } = req.params;
      const { days = "30" } = req.query;
      const lookbackDays = Number.parseInt(days as string, 10) || 30;

      const { getCrewSTCWSummary } = await import("../../scheduler/stcw-dashboard");
      const summary = await getCrewSTCWSummary(orgId, crewId, lookbackDays);

      res.setHeader("Cache-Control", "private, max-age=300");
      res.json(summary);
    })
  );

  logger.info("IntegrationsRoutes", "Registered (FMCC: 3, dashboard: 4)");
}

```


