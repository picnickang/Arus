/**
 * Shared audit logging utilities
 * Provides consistent audit trail across all domains
 */

import type { Request } from "express";
import { recordAndPublish } from "../sync-events";
import { authenticatedRequest } from "../middleware/auth";

export interface AuditContext {
  userId?: string | undefined;
  orgId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Record an audit event with sync
 * Centralizes audit logging and event publishing
 */
export async function auditAction(
  entityType: string,
  entityId: string,
  action: "create" | "update" | "delete",
  data: Record<string, unknown>,
  context?: AuditContext
): Promise<void> {
  await recordAndPublish(entityType as Parameters<typeof recordAndPublish>[0], entityId, action, data, context?.userId);
}

/**
 * Extract audit context from Express request
 */
export function getAuditContext(req: Request): AuditContext {
  const authReq = authenticatedRequest(req);
  return {
    userId: authReq.user?.id,
    orgId: authReq.orgId,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.get("user-agent"),
  };
}
