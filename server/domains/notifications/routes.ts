import type { Express, RequestHandler } from "express";
import { dbNotificationsStorage } from "../../repositories";
import { withErrorHandling, sendNotFound, sendCreated, sendDeleted } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { RateLimit } from "../../lib/rate-limit-factory";

interface RateLimiters {
  writeOperationRateLimit: RateLimit;
  criticalOperationRateLimit: RateLimit;
  generalApiRateLimit: RateLimit;
}

export function registerNotificationRoutes(app: Express, rateLimiters?: RateLimiters): void {
  const passThrough: RequestHandler = (_req, _res, next) => next();
  const writeOperationRateLimit: RateLimit =
    rateLimiters?.writeOperationRateLimit ?? passThrough;

  // ===== NOTIFICATION SETTINGS ROUTES =====

  app.get(
    "/api/notifications/settings",
    withErrorHandling("get notification settings", async (req, res) => {
      const orgId = req.orgId;
      const filters = {
        vesselId: req.query.vesselId as string | undefined,
        notificationType: req.query.notificationType as string | undefined,
      };

      const settings = await dbNotificationsStorage.getNotificationSettings(orgId);
      res.json(settings);
    })
  );

  app.get(
    "/api/notifications/settings/:id",
    withErrorHandling("get notification setting", async (req, res) => {
      const orgId = req.orgId;
      const all = await dbNotificationsStorage.getNotificationSettings(orgId);
      const setting = all.find((s) => s.id === req.params.id);

      if (!setting) {
        return sendNotFound(res, "Notification setting");
      }

      res.json(setting);
    })
  );

  app.post(
    "/api/notifications/settings",
    writeOperationRateLimit,
    withErrorHandling("create notification setting", async (req, res) => {
      const orgId = req.orgId;
      const setting = await dbNotificationsStorage.createNotificationSettings({
        ...req.body,
        orgId,
      });
      sendCreated(res, setting);
    })
  );

  app.patch(
    "/api/notifications/settings/:id",
    writeOperationRateLimit,
    withErrorHandling("update notification setting", async (req, res) => {
      const orgId = req.orgId;
      const all = await dbNotificationsStorage.getNotificationSettings(orgId);
      const existing = all.find((s) => s.id === req.params.id);
      if (!existing) {
        return sendNotFound(res, "Notification setting");
      }
      const setting = await dbNotificationsStorage.updateNotificationSettings(
        req.params.id,
        req.body,
        orgId
      );
      res.json(setting);
    })
  );

  app.delete(
    "/api/notifications/settings/:id",
    writeOperationRateLimit,
    withErrorHandling("delete notification setting", async (req, res) => {
      const orgId = req.orgId;
      const all = await dbNotificationsStorage.getNotificationSettings(orgId);
      const existing = all.find((s) => s.id === req.params.id);
      if (!existing) {
        return sendNotFound(res, "Notification setting");
      }
      await dbNotificationsStorage.deleteNotificationSettings(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  // ===== NOTIFICATION QUEUE ROUTES =====

  app.get(
    "/api/notifications/queue",
    withErrorHandling("get notification queue", async (req, res) => {
      const orgId = req.orgId;
      const status = req.query.status as string | undefined;
      const queue = await dbNotificationsStorage.getNotificationQueue(
        status,
        undefined,
        orgId
      );
      res.json(queue);
    })
  );

  app.post(
    "/api/notifications/queue",
    writeOperationRateLimit,
    withErrorHandling("create notification queue item", async (req, res) => {
      const orgId = req.orgId;
      const item = await dbNotificationsStorage.createNotificationQueueItem({
        ...req.body,
        orgId,
      });
      sendCreated(res, item);
    })
  );

  app.delete(
    "/api/notifications/queue/:id",
    writeOperationRateLimit,
    withErrorHandling("delete notification queue item", async (req, res) => {
      const orgId = req.orgId;
      await dbNotificationsStorage.deleteNotificationQueueItem(req.params.id, orgId);
      sendDeleted(res);
    })
  );

  // ===== EMAIL NOTIFICATION ROUTES =====

  app.get(
    "/api/notifications/email/status",
    withErrorHandling("get email notification status", async (req, res) => {
      const { emailNotificationService } = await import(
        "../../services/email-notification-service"
      );
      res.json(emailNotificationService.getStatus());
    })
  );

  app.post(
    "/api/notifications/email/process-digest",
    writeOperationRateLimit,
    withErrorHandling("process digest queue", async (req, res) => {
      const { emailNotificationService } = await import(
        "../../services/email-notification-service"
      );
      const processedCount = await emailNotificationService.processDigestQueue();
      res.json({ success: true, processedCount });
    })
  );

  app.post(
    "/api/notifications/email/retry-failed",
    writeOperationRateLimit,
    withErrorHandling("retry failed notifications", async (req, res) => {
      const { emailNotificationService } = await import(
        "../../services/email-notification-service"
      );
      const maxAttempts = Number(req.query.maxAttempts) || 3;
      const retryCount = await emailNotificationService.retryFailedNotifications(maxAttempts);
      res.json({ success: true, retryCount });
    })
  );

  app.post(
    "/api/notifications/email/test",
    writeOperationRateLimit,
    withErrorHandling("send test notification", async (req, res) => {
      const { email, subject, message } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email address required" });
      }

      const orgId = req.orgId;
      await dbNotificationsStorage.createNotificationQueueItem({
        orgId,
        notificationType: "test",
        subject: subject || "ARUS Marine Test Notification",
        body: message || "This is a test notification from ARUS Marine.",
        bodyHtml: `<div style="font-family: Arial, sans-serif;"><h2>Test Notification</h2><p>${message || "This is a test notification from ARUS Marine."}</p></div>`,
        recipients: [email],
        status: "pending",
      });

      const { emailNotificationService } = await import(
        "../../services/email-notification-service"
      );
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
