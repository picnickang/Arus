import type { Response, Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requirePermission } from "../domains/permissions/middleware.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { mlModelStore } from "./model-promotion-data.js";
import { structuredLog } from "../logging.js";
import { sendSuccess, sendNotFound, sendBadRequest, handleError } from "../utils/api-response.js";

interface PromotionApproval {
  token: string;
  orgId: string;
  modelId: string;
  proposerUserId: string;
  expiresAt: number;
}

const PROMOTION_APPROVAL_TTL_MS = 10 * 60 * 1000;
const promotionApprovals = new Map<string, PromotionApproval>();

const promoteBodySchema = z.object({
  approvalToken: z
    .string()
    .min(1, "approvalToken is required (issued by POST /ml/models/:id/promote/request)"),
});

function pruneExpiredApprovals(now: number): void {
  for (const [k, v] of promotionApprovals) {
    if (v.expiresAt <= now) {
      promotionApprovals.delete(k);
    }
  }
}

function approvalKey(orgId: string, modelId: string, token: string): string {
  return `${orgId}::${modelId}::${token}`;
}

export function registerModelPromotionRoutes(router: Router): void {
  // Wave 3.2: Lightweight model registry promotion/rollback semantics on
  // top of the existing mlModels table. The public URL contract stays in
  // model-routes.ts via this registrar.
  registerPromotionRequestRoute(router);
  registerPromoteRoute(router);
  registerRollbackRoute(router);
}

function registerPromotionRequestRoute(router: Router): void {
  router.post(
    "/ml/models/:id/promote/request",
    requirePermission("predictive_maintenance", "manage_config"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const proposerId = req.user?.id;
        if (!proposerId) {
          return sendBadRequest(res, "Proposer identity required");
        }

        const modelId = req.params["id"] ?? "";
        const candidate = await mlModelStore.getMlModel(modelId, req.orgId);
        if (!candidate) {
          return sendNotFound(res, "ML model");
        }
        if (candidate.status === "training") {
          return sendBadRequest(res, "Cannot request promotion of a training model");
        }
        if (candidate.status === "failed") {
          return sendBadRequest(res, "Cannot request promotion of a failed model");
        }
        if (!candidate.equipmentType) {
          return sendBadRequest(res, "Model is missing equipmentType");
        }

        pruneExpiredApprovals(Date.now());
        const token = randomBytes(24).toString("base64url");
        const approval: PromotionApproval = {
          token,
          orgId: req.orgId,
          modelId,
          proposerUserId: proposerId,
          expiresAt: Date.now() + PROMOTION_APPROVAL_TTL_MS,
        };
        promotionApprovals.set(approvalKey(req.orgId, modelId, token), approval);

        structuredLog("info", `ML model promotion requested`, {
          operation: "ml_model_promote_request",
          metadata: {
            modelId,
            equipmentType: candidate.equipmentType,
            proposerUserId: proposerId,
          },
        });

        sendSuccess(res, {
          message:
            "Promotion request recorded; second-approver must call /ml/models/:id/promote with this token within 10 minutes.",
          approvalToken: token,
          expiresAt: new Date(approval.expiresAt).toISOString(),
        });
      } catch (error) {
        handleError(error, res, "request ML model promotion");
      }
    }
  );
}

function registerPromoteRoute(router: Router): void {
  router.post(
    "/ml/models/:id/promote",
    requirePermission("predictive_maintenance", "manage_config"),
    // Idempotency replays the cached response when a flaky network retries
    // after the single-use approval token has already been consumed.
    idempotencyMiddleware({ required: true }),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const approverId = req.user?.id;
        if (!approverId) {
          return sendBadRequest(res, "Approver identity required");
        }

        const parsed = promoteBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return sendBadRequest(
            res,
            parsed.error.issues[0]?.message ?? "Invalid promotion request"
          );
        }

        const modelId = req.params["id"] ?? "";
        pruneExpiredApprovals(Date.now());
        const key = approvalKey(req.orgId, modelId, parsed.data.approvalToken);
        const approval = promotionApprovals.get(key);
        if (!approval) {
          return res.status(412).json({
            code: "PROMOTION_APPROVAL_MISSING",
            message:
              "No matching promotion request found (token expired, never issued, or wrong org/model).",
            error: "PreconditionFailed",
          });
        }
        if (approval.proposerUserId === approverId) {
          return res.status(412).json({
            code: "PROMOTION_SELF_APPROVAL_FORBIDDEN",
            message:
              "Two-person rule: the user who requested the promotion cannot also approve it.",
            error: "PreconditionFailed",
          });
        }

        const candidate = await mlModelStore.getMlModel(modelId, req.orgId);
        if (!candidate) {
          return sendNotFound(res, "ML model");
        }
        if (candidate.status === "training") {
          return sendBadRequest(res, "Cannot promote a training model");
        }
        if (candidate.status === "failed") {
          return sendBadRequest(res, "Cannot promote a failed model");
        }
        if (!candidate.equipmentType) {
          return sendBadRequest(res, "Model is missing equipmentType");
        }

        const { promoted, replaced } = await mlModelStore.promoteMlModel(
          candidate.id,
          candidate.equipmentType,
          req.orgId
        );

        promotionApprovals.delete(key);

        structuredLog("info", `ML model promoted`, {
          operation: "ml_model_promote",
          metadata: {
            modelId: candidate.id,
            equipmentType: candidate.equipmentType,
            replacedIds: replaced,
            proposerUserId: approval.proposerUserId,
            approverUserId: approverId,
          },
        });
        return sendSuccess(res, {
          message: "Model promoted",
          model: promoted,
          replaced,
          proposerUserId: approval.proposerUserId,
          approverUserId: approverId,
        });
      } catch (error) {
        handleError(error, res, "promote ML model");
      }
    }
  );
}

function registerRollbackRoute(router: Router): void {
  router.post(
    "/ml/models/:id/rollback",
    requirePermission("predictive_maintenance", "manage_config"),
    idempotencyMiddleware({ required: true }),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const current = await mlModelStore.getMlModel(req.params["id"] ?? "", req.orgId);
        if (!current) {
          return sendNotFound(res, "ML model");
        }
        if (current.status !== "deployed") {
          return sendBadRequest(res, "Only deployed models can be rolled back");
        }
        if (!current.equipmentType) {
          return sendBadRequest(res, "Model is missing equipmentType");
        }

        const all = await mlModelStore.getMlModels(req.orgId);
        const previous = all
          .filter(
            (m) =>
              m.status === "archived" &&
              m.equipmentType === current.equipmentType &&
              m.id !== current.id &&
              m.deployedOn !== null
          )
          .sort((a, b) => {
            const ad = a.archivedOn ? new Date(a.archivedOn).getTime() : 0;
            const bd = b.archivedOn ? new Date(b.archivedOn).getTime() : 0;
            return bd - ad;
          })[0];

        if (!previous) {
          return sendBadRequest(
            res,
            `No previously-deployed model found for equipmentType ${current.equipmentType}`
          );
        }

        const restored = await mlModelStore.rollbackMlModel(current.id, previous.id, req.orgId);
        structuredLog("info", `ML model rolled back`, {
          operation: "ml_model_rollback",
          metadata: {
            from: current.id,
            to: previous.id,
            equipmentType: current.equipmentType,
          },
        });
        sendSuccess(res, { message: "Rolled back", restored, archived: current.id });
      } catch (error) {
        handleError(error, res, "rollback ML model");
      }
    }
  );
}
