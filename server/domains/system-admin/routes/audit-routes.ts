/**
 * System Admin Routes - Audit Events
 * Admin audit event logging and retrieval
 */

import { Express, Request, Response, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";
import { dbSystemAdminStorage } from "../../../db/system-admin/index.js";
import { z } from "zod";

/**
 * P2 #34 — Parse `limit` / `offset` from query strings with the
 * same defaults the storage layer enforces. The storage layer also
 * clamps, so this validator is the friendly outer fence (returns 400
 * on garbage input) rather than the security boundary.
 */
const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const auditQuerySchema = paginationSchema
  .extend({
    orgId: z.string().optional(),
    action: z.string().optional(),
  })
  .strip();
const userAuditParamsSchema = z.object({ userId: z.string().min(1) });
const resourceAuditParamsSchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
});

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
      const { orgId, action, limit, offset } = auditQuerySchema.parse(req.query);
      const events = await dbSystemAdminStorage.getAdminAuditEvents(orgId, action, limit, offset);
      res.json({ events, pagination: { limit, offset, count: events.length } });
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
      const { userId } = userAuditParamsSchema.parse(req.params);
      const { orgId, limit, offset } = auditQuerySchema.parse(req.query);
      const page = { limit, offset };
      const events = await dbSystemAdminStorage.getAuditEventsByUser(userId, orgId, page);
      res.json({ events, pagination: { ...page, count: events.length } });
    })
  );

  app.get(
    "/api/admin/audit/resource/:resourceType/:resourceId",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_RESOURCE_AUDIT_EVENTS"),
    withErrorHandling("fetch resource audit events", async (req: Request, res: Response) => {
      const { resourceType, resourceId } = resourceAuditParamsSchema.parse(req.params);
      const { orgId, limit, offset } = auditQuerySchema.parse(req.query);
      const page = { limit, offset };
      const events = await dbSystemAdminStorage.getAuditEventsByResource(
        resourceType,
        resourceId,
        orgId,
        page
      );
      res.json({ events, pagination: { ...page, count: events.length } });
    })
  );
}
