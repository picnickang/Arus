/**
 * Shared audit logging utilities
 * Provides consistent audit trail across all domains
 */

import type { Request } from "express";
import { recordAndPublish } from "../sync-events";

export interface AuditContext {
  userId?: string;
  orgId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuthenticatedRequest extends Request {
  user?: { id: string };
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
  await recordAndPublish(entityType, entityId, action, data, context?.userId);
}

/**
 * Extract audit context from Express request
 */
export function getAuditContext(req: Request): AuditContext {
  const authReq = req as AuthenticatedRequest;
  return {
    userId: authReq.user?.id,
    orgId: req.headers["x-org-id"] as string,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.get("user-agent"),
  };
}
