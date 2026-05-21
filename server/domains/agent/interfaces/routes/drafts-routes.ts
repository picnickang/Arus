import { createLogger } from "../../../../lib/structured-logger";
const logger = createLogger("Domains:Agent:Interfaces:Routes:DraftsRoutes");
import type { Express, Request, Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../../../middleware/auth";

const draftListQuerySchema = z.object({ status: z.string().optional() });
const draftIdParamSchema = z.object({ id: z.string().min(1) });
const draftReviewBodySchema = z.object({ note: z.string().optional() });
import { agentRepo } from "../../infrastructure/repository";
import { executeDraftAction } from "../../../../composition/agent-draft-executor.js";
import { auditAction } from "../../../../utils/audit-helpers";
import type { RateLimitMiddleware, RoleMiddleware } from "./_shared";

export interface DraftsRouteDeps {
  rateLimit: RateLimitMiddleware;
  requireMaintenanceRole: RoleMiddleware;
}

export function registerDraftsRoutes(app: Express, deps: DraftsRouteDeps) {
  const { rateLimit, requireMaintenanceRole } = deps;

  app.get(
    "/api/agent/drafts",
    rateLimit.generalApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const { status } = draftListQuerySchema.parse(req.query);
        const drafts = await agentRepo.drafts.list(orgId, status);
        res.json(drafts);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/drafts/:id/approve",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const { id: draftIdParam } = draftIdParamSchema.parse(req.params);
        const { note: reviewNote } = draftReviewBodySchema.parse(req.body ?? {});
        const draft = await agentRepo.drafts.get(draftIdParam, orgId);
        if (!draft) {
          return res.status(404).json({ error: "Draft not found" });
        }
        if (draft.status !== "pending") {
          return res.status(400).json({ error: "Draft is not pending" });
        }

        const execResult = await executeDraftAction(
          draft.draftType,
          draft.data as Record<string, unknown>,
          orgId
        );

        if (execResult.error) {
          const statusCode = execResult.error.includes("Access denied")
            ? 403
            : execResult.error.includes("not found")
              ? 404
              : 502;
          return res.status(statusCode).json({
            error: execResult.error,
            details: execResult.partialFailures,
          });
        }

        if (execResult.partialFailures && execResult.partialFailures.length > 0) {
          logger.warn(`[Agent] Draft execution partial failure:`, { details: execResult.partialFailures });
        }

        const resultId = execResult.resultId;

        const updated = await agentRepo.drafts.update(draft.id, {
          status: "approved",
          reviewedById: userId,
          reviewNote: reviewNote,
          resultId,
        });

        await agentRepo.approvals.create({
          orgId,
          draftId: draft.id,
          conversationId: draft.conversationId,
          action: "approved",
          reviewedById: userId,
          reviewNote: reviewNote,
          resultId,
        });

        await auditAction(
          "agent_draft",
          draft.id,
          "update",
          {
            action: "approved",
            draftType: draft.draftType,
            reviewedBy: userId,
            resultId,
          },
          { orgId, userId }
        );

        res.json({ draft: updated, resultId });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );

  app.post(
    "/api/agent/drafts/:id/reject",
    rateLimit.writeOperationRateLimit,
    requireMaintenanceRole,
    async (req: Request, res: Response) => {
      try {
        const orgId = (req as AuthenticatedRequest).orgId;
        const userId = (req as AuthenticatedRequest).user?.id;
        const { id: draftIdParam } = draftIdParamSchema.parse(req.params);
        const { note: reviewNote } = draftReviewBodySchema.parse(req.body ?? {});
        const draft = await agentRepo.drafts.get(draftIdParam, orgId);
        if (!draft) {
          return res.status(404).json({ error: "Draft not found" });
        }
        if (draft.status !== "pending") {
          return res.status(400).json({ error: "Draft is not pending" });
        }

        const updated = await agentRepo.drafts.update(draft.id, {
          status: "rejected",
          reviewedById: userId,
          reviewNote: reviewNote,
        });

        await agentRepo.approvals.create({
          orgId,
          draftId: draft.id,
          conversationId: draft.conversationId,
          action: "rejected",
          reviewedById: userId,
          reviewNote: reviewNote,
        });

        await auditAction(
          "agent_draft",
          draft.id,
          "update",
          {
            action: "rejected",
            draftType: draft.draftType,
            reviewedBy: userId,
          },
          { orgId, userId }
        );

        res.json(updated);
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  );
}
