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

function parsePaginationQuery(
  query: Request["query"]
): { limit?: number | undefined; offset?: number | undefined } {
  const parsed = paginationSchema.safeParse({
    limit: query["limit"],
    offset: query["offset"],
  });
  if (!parsed.success) {
    return {};
  }
  return parsed.data;
}

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
      const { orgId, action } = req.query;
      const { limit, offset } = parsePaginationQuery(req.query);
      const events = await dbSystemAdminStorage.getAdminAuditEvents(
        orgId as string,
        action as string,
        limit,
        offset
      );
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
      const { userId = '' } = req.params;
      const { orgId } = req.query;
      const page = parsePaginationQuery(req.query);
      const events = await dbSystemAdminStorage.getAuditEventsByUser(
        userId,
        orgId as string,
        page
      );
      res.json({ events, pagination: { ...page, count: events.length } });
    })
  );

  app.get(
    "/api/admin/audit/resource/:resourceType/:resourceId",
    requireAdminAuth,
    generalApiRateLimit,
    auditAdminAction("VIEW_RESOURCE_AUDIT_EVENTS"),
    withErrorHandling("fetch resource audit events", async (req: Request, res: Response) => {
      const { resourceType = '', resourceId = '' } = req.params;
      const { orgId } = req.query;
      const page = parsePaginationQuery(req.query);
      const events = await dbSystemAdminStorage.getAuditEventsByResource(
        resourceType,
        resourceId,
        orgId as string,
        page
      );
      res.json({ events, pagination: { ...page, count: events.length } });
    })
  );
}
