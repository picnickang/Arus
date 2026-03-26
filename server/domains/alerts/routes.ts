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
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }
      const { acknowledged } = req.query;
      const ackParam =
        acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const notifications = await alertsService.listNotifications(ackParam, orgId);
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
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }
      const { acknowledged } = req.query;
      const ackParam =
        acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const notifications = await alertsService.listNotifications(ackParam, orgId);
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
      const orgId = req.headers["x-org-id"] as string;
      if (!orgId) {
        return res.status(400).json({ message: "Organization ID (x-org-id header) is required" });
      }
      const suppressions = await alertsService.listSuppressions(orgId);
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
