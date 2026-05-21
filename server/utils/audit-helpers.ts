/**
 * Shared audit logging utilities
 * Provides consistent audit trail across all domains
 */

import type { Request } from "express";
import { recordAndPublish } from "../sync-events";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export interface AuditContext {
  userId?: string;
  orgId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuthenticatedRequest extends Request {
  user?: any;
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
  const authReq = req as AuthenticatedRequest;
  return {
    userId: authReq.user?.id,
    orgId: DEFAULT_ORG_ID,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.get("user-agent"),
  };
}
