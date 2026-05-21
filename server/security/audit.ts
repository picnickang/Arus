/**
 * Audit Logging - Admin action tracking (fail-closed)
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("Security:Audit");
import { Request, Response, NextFunction } from "express";
import { dbSystemAdminStorage } from "../repositories";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export function auditAdminAction(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required for audited actions" });
    }

    const user = req.user;
    const startTime = Date.now();

    const auditDetails = {
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress,
      body: req.body,
      params: req.params,
      query: req.query,
    };

    let auditEventId: string;

    try {
      const auditEvent = await dbSystemAdminStorage.createAdminAuditEvent({
        orgId: DEFAULT_ORG_ID,
        userId: user.id,
        action,
        resourceType: "system",
        resourceId: req.params.id || req.body.id || null,
        details: auditDetails,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get("user-agent") || null,
        outcome: "success",
        severity: "info",
      });

      auditEventId = auditEvent.id;
    } catch (error) {
      logger.error("[CRITICAL] Admin audit logging failed - BLOCKING REQUEST:", undefined, error);

      return res.status(500).json({
        error: "Audit logging failed - operation cannot proceed",
        message:
          "This administrative action cannot be completed because audit logging is unavailable. Please contact system administrator.",
      });
    }

    const originalEnd = res.end;
    let outcomeUpdated = false;

    res.end = function (this: Response, ...args: unknown[]): Response {
      res.end = originalEnd;

      (async () => {
        if (outcomeUpdated) {
          return;
        }
        outcomeUpdated = true;

        const statusCode = res.statusCode;
        const duration = Date.now() - startTime;

        let outcome: "success" | "failure";
        let severity: "info" | "warning" | "error";

        if (statusCode >= 500) {
          outcome = "failure";
          severity = "error";
        } else if (statusCode >= 400) {
          outcome = "failure";
          severity = "warning";
        } else {
          outcome = "success";
          severity = "info";
        }

        try {
          await dbSystemAdminStorage.updateAdminAuditEvent(auditEventId, {
            outcome,
            severity,
            details: {
              ...auditDetails,
              statusCode,
              duration,
            },
          });
        } catch (error) {
          logger.error("[CRITICAL] Failed to update audit event outcome:", undefined, error);
        }
      })();

      return (originalEnd as (...a: unknown[]) => Response).apply(this, args);
    };

    next();
  };
}
