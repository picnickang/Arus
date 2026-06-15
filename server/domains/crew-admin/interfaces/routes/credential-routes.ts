import type { Express, Request, Response } from "express";
import { crewAdminService } from "../../service";
import { authenticatedRequest, requireOrgId } from "../../../../middleware/auth";
import { withErrorHandling } from "../../../../lib/route-utils";
import { auditService } from "../../../../compliance/immutable-audit";
import {
  auditCrewAdminChange as audit,
  createCrewAccountSchema,
  crewMemberParamsSchema,
  credentialsSchema,
  handleCrewError,
  idParamsSchema,
  linkAccountSchema,
  loginEnabledSchema,
  requireCrewAdminRole,
  resetPasswordSchema,
  type CrewAdminRouteContext,
} from "./shared";

export function registerCrewAdminCredentialRoutes(
  app: Express,
  context: CrewAdminRouteContext
): void {
  const { generalApiRateLimit, writeLimit } = context;
  /* ----------------------------- Credentials ----------------------- */

  app.patch(
    "/api/admin/crew/users/:id/login-enabled",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("toggle crew user login", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const { enabled } = loginEnabledSchema.parse(req.body);
      try {
        await crewAdminService.setLoginEnabled(authReq.orgId, id, enabled);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "config_updated",
          entityType: "user",
          entityId: id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { loginEnabled: enabled },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/admin/crew/users/:id/credentials",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("set crew user credentials", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const data = credentialsSchema.parse(req.body);
      try {
        await crewAdminService.setCredentials({
          orgId: authReq.orgId,
          userId: id,
          ...data,
        });
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "config_updated",
          entityType: "user_credentials",
          entityId: id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          changedFields: Object.keys(data),
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/admin/crew/users/:id/reset-password",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("reset crew user password", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { id } = idParamsSchema.parse(req.params);
      const { password } = resetPasswordSchema.parse(req.body);
      try {
        await crewAdminService.resetPassword(authReq.orgId, id, password);
        await auditService.logEvent({
          orgId: authReq.orgId,
          eventCategory: "security_event",
          eventType: "config_updated",
          entityType: "user_credentials",
          entityId: id,
          performedBy: authReq.user?.id ?? "unknown",
          performedByRole: authReq.user?.role,
          newState: { passwordReset: true },
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  /* -------------------- Crew member login accounts ------------------ */

  app.get(
    "/api/admin/crew/members/:crewId/account",
    requireOrgId,
    requireCrewAdminRole,
    generalApiRateLimit,
    withErrorHandling("get crew member account", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { crewId } = crewMemberParamsSchema.parse(req.params);
      try {
        const account = await crewAdminService.getCrewAccount(authReq.orgId, crewId);
        return res.json({ account });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/admin/crew/members/:crewId/account",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("create crew member account", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { crewId } = crewMemberParamsSchema.parse(req.params);
      const data = createCrewAccountSchema.parse(req.body);
      try {
        const account = await crewAdminService.createAndLinkAccount({
          orgId: authReq.orgId,
          crewId,
          assignedBy: authReq.user?.id,
          ...data,
        });
        await audit(authReq, "config_updated", "crew_account", account.id, {
          action: "create_and_link",
          crewId,
          role: account.role,
        });
        return res.status(201).json({ account });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.post(
    "/api/admin/crew/members/:crewId/link",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("link crew member account", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { crewId } = crewMemberParamsSchema.parse(req.params);
      const { userId } = linkAccountSchema.parse(req.body);
      try {
        await crewAdminService.linkExistingAccount(authReq.orgId, crewId, userId);
        await audit(authReq, "config_updated", "crew_account", userId, {
          action: "link",
          crewId,
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );

  app.delete(
    "/api/admin/crew/members/:crewId/account",
    requireOrgId,
    requireCrewAdminRole,
    writeLimit,
    withErrorHandling("unlink crew member account", async (req: Request, res: Response) => {
      const authReq = authenticatedRequest(req);
      const { crewId } = crewMemberParamsSchema.parse(req.params);
      try {
        await crewAdminService.unlinkAccount(authReq.orgId, crewId);
        await audit(authReq, "config_updated", "crew_account", crewId, {
          action: "unlink",
        });
        return res.json({ success: true });
      } catch (error) {
        if (handleCrewError(error, res)) {
          return undefined;
        }
        throw error;
      }
    })
  );
}
