import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  insertAlertConfigSchema,
  insertAlertNotificationSchema,
  insertAlertCommentSchema,
  insertAlertSuppressionSchema,
} from "@shared/schema-runtime";
import { alertsService, type AlertsWsBroadcaster } from "./service";
import { withErrorHandling, handleApiError, sendNotFound } from "../../lib/route-utils";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

/**
 * Alerts Routes
 * Handles HTTP concerns for alerts domain (configurations, notifications, suppressions, comments)
 */
export function registerAlertsRoutes(
  app: Express,
  deps: {
    writeOperationRateLimit: import("../../lib/rate-limit-factory").RateLimit;
    criticalOperationRateLimit: import("../../lib/rate-limit-factory").RateLimit;
    generalApiRateLimit: import("../../lib/rate-limit-factory").RateLimit;
    wsServer?: AlertsWsBroadcaster & { broadcastWorkOrderCreated?: (wo: unknown) => void };
  }
) {
  const { writeOperationRateLimit, criticalOperationRateLimit, generalApiRateLimit } = deps;
  const wsServerInstance = deps.wsServer;

  // ========== Main Alerts Endpoints (Aliases for Notifications) ==========

  const ackQuerySchema = z.object({
    acknowledged: z.enum(["true", "false"]).optional(),
    equipmentId: z.string().optional(),
  });
  const idParamSchema = z.object({ id: z.string().min(1) });
  const ackBodySchema = z.object({ acknowledgedBy: z.string().min(1) });
  const commentBodySchema = z.object({
    comment: z.string().min(1),
    commentedBy: z.string().min(1),
  });

  // GET /api/alerts - List all alerts (alias for /api/alerts/notifications)
  app.get(
    "/api/alerts",
    generalApiRateLimit,
    withErrorHandling("fetch alerts", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { acknowledged } = ackQuerySchema.parse(req.query);
      const ackParam =
        acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const notifications = await alertsService.listNotifications(ackParam, orgId);
      return res.json(notifications);
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
      return res.status(201).json(notification);
    })
  );

  // ========== Alert Configurations ==========

  // GET /api/alerts/configurations
  app.get(
    "/api/alerts/configurations",
    generalApiRateLimit,
    withErrorHandling("fetch alert configurations", async (req: Request, res: Response) => {
      const { equipmentId } = ackQuerySchema.parse(req.query);
      const configurations = await alertsService.listConfigurations(equipmentId as string);
      return res.json(configurations);
    })
  );

  // POST /api/alerts/configurations
  app.post(
    "/api/alerts/configurations",
    writeOperationRateLimit,
    withErrorHandling("create alert configuration", async (req: Request, res: Response) => {
      const configData = insertAlertConfigSchema.parse(req.body);
      const configuration = await alertsService.createConfiguration(configData, req.user?.id);
      return res.status(201).json(configuration);
    })
  );

  // PUT /api/alerts/configurations/:id
  app.put(
    "/api/alerts/configurations/:id",
    writeOperationRateLimit,
    withErrorHandling("update alert configuration", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const configData = insertAlertConfigSchema.partial().parse(req.body);
      const configuration = await alertsService.updateConfiguration(
        id,
        configData,
        req.user?.id
      );
      return res.json(configuration);
    })
  );

  // DELETE /api/alerts/configurations/:id
  app.delete(
    "/api/alerts/configurations/:id",
    criticalOperationRateLimit,
    withErrorHandling("delete alert configuration", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      await alertsService.deleteConfiguration(id, req.user?.id);
      return res.status(204).send();
    })
  );

  // ========== Alert Notifications ==========

  // GET /api/alerts/notifications
  app.get(
    "/api/alerts/notifications",
    generalApiRateLimit,
    withErrorHandling("fetch alert notifications", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const { acknowledged } = ackQuerySchema.parse(req.query);
      const ackParam =
        acknowledged === "true" ? true : acknowledged === "false" ? false : undefined;
      const notifications = await alertsService.listNotifications(ackParam, orgId);
      return res.json(notifications);
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
      return res.status(201).json(notification);
    })
  );

  // PATCH /api/alerts/notifications/:id/acknowledge
  app.patch(
    "/api/alerts/notifications/:id/acknowledge",
    writeOperationRateLimit,
    withErrorHandling("acknowledge alert", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const parsed = ackBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "acknowledgedBy is required" });
      }

      const notification = await alertsService.acknowledgeNotification(
        id,
        parsed.data.acknowledgedBy,
        req.user?.id,
        wsServerInstance
      );

      return res.json(notification);
    })
  );

  // ========== Alert Comments ==========

  // POST /api/alerts/notifications/:id/comment
  app.post(
    "/api/alerts/notifications/:id/comment",
    writeOperationRateLimit,
    withErrorHandling("add comment", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const body = commentBodySchema.parse(req.body);
      const commentData = insertAlertCommentSchema.parse({
        alertId: id,
        comment: body.comment,
        commentedBy: body.commentedBy,
      });

      const result = await alertsService.addComment(commentData, req.user?.id);
      return res.json(result);
    })
  );

  // GET /api/alerts/notifications/:id/comments
  app.get(
    "/api/alerts/notifications/:id/comments",
    generalApiRateLimit,
    withErrorHandling("get comments", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      const comments = await alertsService.getComments(id);
      return res.json(comments);
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
      return res.json(result);
    })
  );

  // GET /api/alerts/suppressions
  app.get(
    "/api/alerts/suppressions",
    generalApiRateLimit,
    withErrorHandling("get suppressions", async (req: Request, res: Response) => {
      const orgId = DEFAULT_ORG_ID;
      const suppressions = await alertsService.listSuppressions(orgId);
      return res.json(suppressions);
    })
  );

  // DELETE /api/alerts/suppressions/:id
  app.delete(
    "/api/alerts/suppressions/:id",
    criticalOperationRateLimit,
    withErrorHandling("remove suppression", async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      await alertsService.deleteSuppression(id, req.user?.id);
      return res.json({ message: "Suppression removed" });
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

        const { workOrderService } = await import("../../repositories");

        type CreateWOArgs = Parameters<typeof workOrderService.createWorkOrder>[0];
        const createWorkOrderFn = async (data: CreateWOArgs) => {
          const workOrder = await workOrderService.createWorkOrder(data);

          if (wsServerInstance?.broadcastWorkOrderCreated) {
            wsServerInstance.broadcastWorkOrderCreated(workOrder);
          }

          return workOrder;
        };

        const { id } = idParamSchema.parse(req.params);
        const workOrder = await alertsService.escalateNotification(
          id,
          escalationData,
          createWorkOrderFn,
          req.user?.id
        );

        return res.json(workOrder);
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
      return res.json({ message: "All alerts and notifications cleared successfully" });
    })
  );
}
