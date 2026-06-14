import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { jsonRecordSchema } from "@shared/validation/json";
import { notificationsAppService } from "../application";
import type {
  CreateNotificationSettingsCommand,
  UpdateNotificationSettingsCommand,
  CreateNotificationQueueCommand,
} from "../domain/types";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../../lib/route-utils";
import { logger } from "../../../utils/logger.js";
import type { RateLimit } from "../../../lib/rate-limit-factory";

interface RateLimiters {
  writeOperationRateLimit: RateLimit;
  criticalOperationRateLimit: RateLimit;
  generalApiRateLimit: RateLimit;
}

const settingsQuerySchema = z.object({
  vesselId: z.string().optional(),
  notificationType: z.string().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

const queueQuerySchema = z.object({
  status: z.string().optional(),
  notificationType: z.string().optional(),
  scheduledBefore: z.string().optional(),
});

const retryQuerySchema = z.object({
  maxAttempts: z.coerce.number().int().positive().optional(),
});

const testEmailSchema = z.object({
  email: z.string().email(),
  subject: z.string().optional(),
  message: z.string().optional(),
});

const settingsBodySchema = jsonRecordSchema;

export function registerNotificationRoutes(app: Express, rateLimiters?: RateLimiters): void {
  const passThrough: RequestHandler = (_req, _res, next) => next();
  const writeOperationRateLimit: RateLimit = rateLimiters?.writeOperationRateLimit ?? passThrough;

  // ===== NOTIFICATION SETTINGS ROUTES =====

  app.get(
    "/api/notifications/settings",
    withErrorHandling("get notification settings", async (req, res) => {
      const orgId = req.orgId;
      settingsQuerySchema.parse(req.query);

      const settings = await notificationsAppService.listSettings(orgId);
      return res.json(settings);
    })
  );

  app.get(
    "/api/notifications/settings/:id",
    withErrorHandling("get notification setting", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const setting = await notificationsAppService.getSettingById(orgId, id);

      if (!setting) {
        return sendNotFound(res, "Notification setting");
      }

      return res.json(setting);
    })
  );

  app.post(
    "/api/notifications/settings",
    writeOperationRateLimit,
    withErrorHandling("create notification setting", async (req, res) => {
      const orgId = req.orgId;
      const body = settingsBodySchema.parse(req.body);
      const setting = await notificationsAppService.createSettings({
        ...body,
        orgId,
      } as CreateNotificationSettingsCommand);
      sendCreated(res, setting);
    })
  );

  app.patch(
    "/api/notifications/settings/:id",
    writeOperationRateLimit,
    withErrorHandling("update notification setting", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const body = settingsBodySchema.parse(req.body);
      const existing = await notificationsAppService.getSettingById(orgId, id);
      if (!existing) {
        return sendNotFound(res, "Notification setting");
      }
      const setting = await notificationsAppService.updateSettings(
        id,
        body as UpdateNotificationSettingsCommand,
        orgId
      );
      return res.json(setting);
    })
  );

  app.delete(
    "/api/notifications/settings/:id",
    writeOperationRateLimit,
    withErrorHandling("delete notification setting", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      const existing = await notificationsAppService.getSettingById(orgId, id);
      if (!existing) {
        return sendNotFound(res, "Notification setting");
      }
      await notificationsAppService.deleteSettings(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== NOTIFICATION QUEUE ROUTES =====

  app.get(
    "/api/notifications/queue",
    withErrorHandling("get notification queue", async (req, res) => {
      const orgId = req.orgId;
      const filters = queueQuerySchema.parse(req.query);
      const queue = await notificationsAppService.listQueue(filters.status, orgId);
      return res.json(queue);
    })
  );

  app.post(
    "/api/notifications/queue",
    writeOperationRateLimit,
    withErrorHandling("create notification queue item", async (req, res) => {
      const orgId = req.orgId;
      const body = settingsBodySchema.parse(req.body);
      const item = await notificationsAppService.createQueueItem({
        ...body,
        orgId,
      } as CreateNotificationQueueCommand);
      sendCreated(res, item);
    })
  );

  app.delete(
    "/api/notifications/queue/:id",
    writeOperationRateLimit,
    withErrorHandling("delete notification queue item", async (req, res) => {
      const orgId = req.orgId;
      const { id } = idParamSchema.parse(req.params);
      await notificationsAppService.deleteQueueItem(id, orgId);
      sendDeleted(res);
    })
  );

  // ===== EMAIL NOTIFICATION ROUTES =====

  app.get(
    "/api/notifications/email/status",
    withErrorHandling("get email notification status", async (req, res) => {
      const { emailNotificationService } = await import(
        "../../../services/email-notification-service"
      );
      return res.json(emailNotificationService.getStatus());
    })
  );

  app.post(
    "/api/notifications/email/process-digest",
    writeOperationRateLimit,
    withErrorHandling("process digest queue", async (req, res) => {
      const { emailNotificationService } = await import(
        "../../../services/email-notification-service"
      );
      const processedCount = await emailNotificationService.processDigestQueue();
      return res.json({ success: true, processedCount });
    })
  );

  app.post(
    "/api/notifications/email/retry-failed",
    writeOperationRateLimit,
    withErrorHandling("retry failed notifications", async (req, res) => {
      const { emailNotificationService } = await import(
        "../../../services/email-notification-service"
      );
      const { maxAttempts } = retryQuerySchema.parse(req.query);
      const retryCount = await emailNotificationService.retryFailedNotifications(maxAttempts ?? 3);
      return res.json({ success: true, retryCount });
    })
  );

  app.post(
    "/api/notifications/email/test",
    writeOperationRateLimit,
    withErrorHandling("send test notification", async (req, res) => {
      const parsed = testEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Email address required" });
      }
      const { email, subject, message } = parsed.data;

      const orgId = req.orgId;
      await notificationsAppService.createQueueItem({
        orgId,
        notificationType: "test",
        subject: subject || "ARUS Marine Test Notification",
        body: message || "This is a test notification from ARUS Marine.",
        bodyHtml: `<div style="font-family: Arial, sans-serif;"><h2>Test Notification</h2><p>${message || "This is a test notification from ARUS Marine."}</p></div>`,
        recipients: [email],
        status: "pending",
      });

      const { emailNotificationService } = await import(
        "../../../services/email-notification-service"
      );
      const status = emailNotificationService.getStatus();

      if (status.enabled) {
        await emailNotificationService.retryFailedNotifications(1);
      }

      return res.json({
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
