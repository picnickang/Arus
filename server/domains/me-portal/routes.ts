/**
 * Me Portal Routes (BFF)
 *
 * `/api/me/*` — authenticated, returns the caller's role-aware dashboard,
 * tasks, and visible safety alarms; plus self password change.
 * `/api/portal/login` — public regular-user login.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { mePortalService, MePortalError, type MeUser } from "./me-portal-service";
import { requireAuthentication } from "../../security/authentication";
import { auditService } from "../../compliance/immutable-audit";
import { withErrorHandling } from "../../lib/route-utils";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import type { AuthenticatedRequest } from "../../middleware/auth";

const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(128),
  orgId: z.string().min(1).optional(),
});
const ackSchema = z.object({ comment: z.string().max(1000).optional() });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

function resolveMeUser(req: Request): MeUser {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;
  if (!user) {
    throw new MePortalError("Authentication required", "UNAUTHENTICATED", 401);
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
    orgId: authReq.orgId,
  };
}

function handleMeError(error: unknown, res: Response): boolean {
  if (error instanceof MePortalError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return true;
  }
  return false;
}

export function registerMePortalRoutes(
  app: Express,
  rateLimit: {
    generalApiRateLimit: import("../../lib/rate-limit-factory").RateLimit;
    loginRateLimit?: import("../../lib/rate-limit-factory").RateLimit;
  },
) {
  const { generalApiRateLimit, loginRateLimit } = rateLimit;
  const loginLimit = loginRateLimit || generalApiRateLimit;

  /* ------------------------------ Login ---------------------------- */

  app.post(
    "/api/portal/login",
    loginLimit,
    withErrorHandling("portal login", async (req: Request, res: Response) => {
      const { username, password, orgId } = loginSchema.parse(req.body);
      try {
        const result = await mePortalService.login(orgId ?? DEFAULT_ORG_ID, username, password, {
          ip: req.ip,
          userAgent: req.get("user-agent") ?? undefined,
        });
        return res.json(result);
      } catch (error) {
        if (handleMeError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  /* ----------------------------- Dashboard ------------------------- */

  app.get(
    "/api/me/dashboard",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("me dashboard", async (req: Request, res: Response) => {
      try {
        return res.json(await mePortalService.getDashboard(resolveMeUser(req)));
      } catch (error) {
        if (handleMeError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.get(
    "/api/me/tasks",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("me tasks", async (req: Request, res: Response) => {
      try {
        return res.json(await mePortalService.getTasks(resolveMeUser(req)));
      } catch (error) {
        if (handleMeError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  /* --------------------------- Safety alarms ----------------------- */

  app.get(
    "/api/me/safety-alarms",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("me safety alarms", async (req: Request, res: Response) => {
      try {
        return res.json(await mePortalService.getVisibleAlarms(resolveMeUser(req)));
      } catch (error) {
        if (handleMeError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  app.post(
    "/api/me/safety-alarms/:id/acknowledge",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("acknowledge safety alarm", async (req: Request, res: Response) => {
      const { comment } = ackSchema.parse(req.body ?? {});
      const meUser = resolveMeUser(req);
      try {
        await mePortalService.acknowledgeAlarm(meUser, req.params['id'], comment);
        await auditService.logEvent({
          orgId: meUser.orgId,
          eventCategory: "compliance_event",
          eventType: "alert_acknowledged",
          entityType: "safety_alarm",
          entityId: req.params['id'],
          performedBy: meUser.id,
          performedByName: meUser.name ?? meUser.email,
          performedByRole: meUser.role,
          ipAddress: req.ip,
          metadata: { source: "user_portal", comment: comment ?? null },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleMeError(error, res)) return undefined;
        throw error;
      }
    }),
  );

  /* --------------------------- Change password --------------------- */

  app.post(
    "/api/me/change-password",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("me change password", async (req: Request, res: Response) => {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const meUser = resolveMeUser(req);
      try {
        await mePortalService.changePassword(meUser, currentPassword, newPassword);
        await auditService.logEvent({
          orgId: meUser.orgId,
          eventCategory: "security_event",
          eventType: "config_updated",
          entityType: "user_credentials",
          entityId: meUser.id,
          performedBy: meUser.id,
          performedByName: meUser.name ?? meUser.email,
          performedByRole: meUser.role,
          ipAddress: req.ip,
          changedFields: ["passwordHash"],
          newState: { selfPasswordChange: true },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleMeError(error, res)) return undefined;
        throw error;
      }
    }),
  );
}
