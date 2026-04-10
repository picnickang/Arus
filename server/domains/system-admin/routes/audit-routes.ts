/**
 * System Admin Routes - Audit Events
 * Admin audit event logging and retrieval
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";

export function registerAuditRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
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
      const events = await dbSystemAdminStorage.getAdminAuditEvents(
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
      const event = await dbSystemAdminStorage.createAdminAuditEvent(validatedData);
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
      const events = await dbSystemAdminStorage.getAuditEventsByUser(userId, orgId as string);
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
      const events = await dbSystemAdminStorage.getAuditEventsByResource(
        resourceType,
        resourceId,
        orgId as string
      );
      res.json(events);
    })
  );
}
