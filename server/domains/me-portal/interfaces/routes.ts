/**
 * Me Portal Routes (BFF)
 *
 * `/api/me/*` — authenticated, returns the caller's role-aware dashboard,
 * tasks, and visible safety alarms; plus self password change.
 * `/api/portal/login` — public regular-user login.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { mePortalService, MePortalError, type MeUser } from "../application/me-portal-service.js";
import { requireAuthentication } from "../../../security/authentication";
import { auditService } from "../../../compliance/immutable-audit";
import { withErrorHandling } from "../../../lib/route-utils";
import { broadcastSafetyAlarmEvent } from "../../../lib/safety-alarm-events";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { pilotFeedbackDraftSchema, pilotFeedbackReviewSchema } from "@shared/schema-runtime";
import { authenticatedRequest } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/role-auth";
import {
  createDevLoginSession,
  devLoginRequestSchema,
  isDevLoginEnabled,
  revokeDevLoginSessionToken,
} from "../../../security/dev-login";

// Feedback triage is an admin-portal surface: same role set as the
// Attention Inbox (mirrors `getPortalForRole` in
// `client/src/application/navigation/role-navigation-policy.ts`).
const FEEDBACK_REVIEW_ROLES = [
  "system_admin",
  "company_admin",
  "chief_engineer",
  "fleet_manager",
  "captain",
  "admin",
] as const;
const requireFeedbackReviewRole = requireRole(...FEEDBACK_REVIEW_ROLES);

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
  const authReq = authenticatedRequest(req);
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
    generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit;
    loginRateLimit?: import("../../../lib/rate-limit-factory").RateLimit;
  }
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
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/portal/dev-login",
    loginLimit,
    withErrorHandling("temporary dev login", async (req: Request, res: Response) => {
      if (!isDevLoginEnabled()) {
        return res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
      }
      const input = devLoginRequestSchema.parse(req.body);
      const result = createDevLoginSession(input, {
        ip: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      });
      return res.json(result);
    })
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
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.get(
    "/api/me/dashboard/preferences",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("get me dashboard preferences", async (req: Request, res: Response) => {
      try {
        return res.json(await mePortalService.getPreferences(resolveMeUser(req)));
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.put(
    "/api/me/dashboard/preferences",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("save me dashboard preferences", async (req: Request, res: Response) => {
      try {
        return res.json(await mePortalService.savePreferences(resolveMeUser(req), req.body));
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.get(
    "/api/me/tasks",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("me tasks", async (req: Request, res: Response) => {
      try {
        return res.json(await mePortalService.getTasks(resolveMeUser(req)));
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
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
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/me/safety-alarms/:id/acknowledge",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("acknowledge safety alarm", async (req: Request, res: Response) => {
      const { comment } = ackSchema.parse(req.body ?? {});
      const meUser = resolveMeUser(req);
      try {
        await mePortalService.acknowledgeAlarm(meUser, req.params["id"] ?? "", comment);
        await auditService.logEvent({
          orgId: meUser.orgId,
          eventCategory: "compliance_event",
          eventType: "alert_acknowledged",
          entityType: "safety_alarm",
          entityId: req.params["id"] ?? "",
          performedBy: meUser.id,
          performedByName: meUser.name ?? meUser.email,
          performedByRole: meUser.role,
          ipAddress: req.ip,
          metadata: { source: "user_portal", comment: comment ?? null },
        });
        broadcastSafetyAlarmEvent(meUser.orgId, "safety_alarm_acknowledged", {
          alarmId: req.params["id"],
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  /* ------------------------------ Logout --------------------------- */

  app.post(
    "/api/me/logout",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("me logout", async (req: Request, res: Response) => {
      const meUser = resolveMeUser(req);
      const authHeader = req.headers.authorization;
      const token =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ")
          ? authHeader.substring(7)
          : null;
      try {
        if (token) {
          if (!revokeDevLoginSessionToken(token)) {
            await mePortalService.logout(meUser, token);
            await auditService.logEvent({
              orgId: meUser.orgId,
              eventCategory: "security_event",
              eventType: "logout",
              entityType: "user_session",
              entityId: meUser.id,
              performedBy: meUser.id,
              performedByName: meUser.name ?? meUser.email,
              performedByRole: meUser.role,
              ipAddress: req.ip,
              metadata: { source: "user_portal" },
            });
          }
        }
        return res.json({ success: true });
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
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
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  /* --------------------------- Pilot feedback ---------------------- */

  app.post(
    "/api/me/feedback",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("submit me feedback", async (req: Request, res: Response) => {
      const draft = pilotFeedbackDraftSchema.parse(req.body);
      try {
        const row = await mePortalService.submitFeedback(resolveMeUser(req), draft);
        return res.status(201).json(row);
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.get(
    "/api/me/feedback",
    requireAuthentication,
    generalApiRateLimit,
    withErrorHandling("list me feedback", async (req: Request, res: Response) => {
      try {
        return res.json(await mePortalService.listMyFeedback(resolveMeUser(req)));
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  registerFeedbackReviewRoutes(app, generalApiRateLimit);
}

/* ------------------------ Feedback review (office) --------------------- */

function registerFeedbackReviewRoutes(
  app: Express,
  generalApiRateLimit: import("../../../lib/rate-limit-factory").RateLimit
) {
  app.get(
    "/api/feedback-review",
    requireAuthentication,
    requireFeedbackReviewRole,
    generalApiRateLimit,
    withErrorHandling("list feedback review queue", async (req: Request, res: Response) => {
      try {
        return res.json(await mePortalService.listFeedbackForReview(resolveMeUser(req)));
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.patch(
    "/api/feedback-review/:id",
    requireAuthentication,
    requireFeedbackReviewRole,
    generalApiRateLimit,
    withErrorHandling("review feedback report", async (req: Request, res: Response) => {
      const review = pilotFeedbackReviewSchema.parse(req.body);
      const meUser = resolveMeUser(req);
      try {
        const row = await mePortalService.reviewFeedback(meUser, req.params["id"] ?? "", review);
        await auditService.logEvent({
          orgId: meUser.orgId,
          eventCategory: "compliance_event",
          eventType: "config_updated",
          entityType: "pilot_feedback",
          entityId: row.id,
          performedBy: meUser.id,
          performedByName: meUser.name ?? meUser.email,
          performedByRole: meUser.role,
          ipAddress: req.ip,
          changedFields: Object.keys(review),
          newState: {
            status: row.status,
            linkedWorkOrderId: row.linkedWorkOrderId ?? null,
          },
        });
        return res.json(row);
      } catch (error) {
        if (handleMeError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );
}
