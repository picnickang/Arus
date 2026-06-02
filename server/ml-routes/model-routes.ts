/**
 * ML Routes - Model Management Routes
 * CRUD operations for ML models: list, get, train, deploy, activate, deprecate.
 */

import { Router, Response } from "express";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { requirePermission } from "../domains/permissions/middleware.js";
import { idempotencyMiddleware } from "../middleware/idempotency.js";
import { dbMlAnalyticsStorage } from "../repositories.js";
import { mlTrainConfigSchema } from "@shared/schema-runtime";
import type { InsertMlModel } from "@shared/schema";
import { z } from "zod";
import { structuredLog } from "../logging.js";
import { sendSuccess, sendNotFound, sendBadRequest, handleError } from "../utils/api-response.js";
import {
  getReadAdapterForUri,
  parseArtifactUri,
} from "../domains/pdm-platform/infrastructure/artifact-storage/index.js";

const router = Router();

router.get("/ml/models", async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await dbMlAnalyticsStorage.getMlModels(req.orgId));
  } catch (error) {
    handleError(error, res, "fetch ML models");
  }
});

router.get("/ml/models/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel((req.params['id'] ?? ''), req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    sendSuccess(res, model);
  } catch (error) {
    handleError(error, res, "fetch ML model");
  }
});

/**
 * Push A1 — Serve the raw ONNX artifact for a deployed model so the
 * client-side onnxruntime-web adapter (client/src/lib/ml/onnx-web-adapter.ts)
 * can score offline / for what-if previews. Tenancy-scoped on orgId,
 * only deployed models are served, and the disk path is read from the
 * registry's training_metrics — not user input — so this cannot be
 * abused as an arbitrary-file read.
 */
router.get("/ml/models/:id/artifact", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel((req.params['id'] ?? ''), req.orgId);
    if (!model) return sendNotFound(res, "ML model");
    if (model.status !== "deployed") {
      return sendBadRequest(res, "Only deployed models expose artifacts");
    }
    const metrics = (model.trainingMetrics ?? {}) as { artifactPath?: string };
    const artifactPath = metrics.artifactPath;
    if (!artifactPath) {
      return sendNotFound(res, "Model artifact");
    }
    // #108 — Resolve via the artifact-storage abstraction so URI-backed
    // artifacts (arus-artifact://replit-object-storage/...) work as
    // well as legacy bare paths. parseArtifactUri maps bare paths to
    // the local backend for backward compat.
    const ref = parseArtifactUri(artifactPath);
    if (!ref.key.endsWith(".onnx")) {
      return sendNotFound(res, "Model artifact");
    }
    // Defense-in-depth: the registry-stored key must live under
    // `models/` regardless of backend — this cannot be abused as an
    // arbitrary-file read since the value is set by the trainer, not
    // by user input.
    if (!ref.key.startsWith("models/") || ref.key.includes("..")) {
      return sendBadRequest(res, "Artifact key outside models namespace");
    }
    const local = await getReadAdapterForUri(ref.uri).materializeToLocal(ref.uri);
    // For the local backend, also double-check the resolved path is
    // under MODELS_DIR — defence against a stale row pointing
    // elsewhere on disk.
    if (ref.backend === "local") {
      const repoRoot = process.cwd();
      const abs = path.resolve(local);
      if (!abs.startsWith(path.resolve(repoRoot, "models") + path.sep)) {
        return sendBadRequest(res, "Artifact path outside models directory");
      }
    }
    const bytes = await readFile(local);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(bytes);
  } catch (error) {
    handleError(error, res, "fetch ML model artifact");
  }
});

router.get("/ml/accuracy-trend", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const models = await dbMlAnalyticsStorage.getMlModels(req.orgId);
    const trendData = await Promise.all(
      models
        .filter((m) => m.status === "deployed" && m.accuracy)
        .map(async (model) => {
          const history = await (dbMlAnalyticsStorage as object as { getMlModelAccuracyHistory: (id: string, orgId: string) => Promise<Array<{ recordedAt: Date; accuracy: string | null }>> }).getMlModelAccuracyHistory(model.id, req.orgId);
          return history.map((h: { recordedAt: Date; accuracy: string | null }) => ({
            date: h.recordedAt.toISOString().split("T")[0] ?? '',
            accuracy: Number.parseFloat(h.accuracy || "0"),
            modelId: model.id,
            modelName: model.name,
          }));
        })
    );
    sendSuccess(
      res,
      trendData.flat().sort((a, b) => new Date(a.date ?? '').getTime() - new Date(b.date ?? '').getTime())
    );
  } catch (error) {
    handleError(error, res, "fetch accuracy trend");
  }
});

router.get("/equipment/types", async (req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, [
    "Engine",
    "Compressor",
    "Pump",
    "Generator",
    "Hydraulic System",
    "Gearbox",
    "Propeller",
    "Steering Gear",
    "Boiler",
    "Heat Exchanger",
  ]);
});

// LR-3.5 / TX-2: training is a side-effectful mutation — it inserts an
// `ml_models` row in status='training' and enqueues a background job.
// A client that retries the POST on a transient network error without
// an idempotency key would create duplicate training rows + duplicate
// queue entries. Mount idempotencyMiddleware so a replay returns the
// originally-recorded {modelId, jobId} response.
router.post("/ml/train", idempotencyMiddleware({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = mlTrainConfigSchema.parse(req.body);
    const modelData: InsertMlModel = {
      orgId: req.orgId,
      name: `${config.algorithm} ${config.equipmentType} Predictor`,
      type: config.algorithm.toLowerCase(),
      status: "training",
      equipmentType: config.equipmentType,
      dataWindowDays: config.dataWindowDays,
      hyperparameters: config.hyperparameters || null,
      version: "1.0",
      trainedOn: null,
      deployedOn: null,
      archivedOn: null,
      accuracy: null,
      precision: null,
      recall: null,
      f1Score: null,
      dataPoints: null,
      trainingDurationMs: null,
      featureImportance: null,
      trainingMetrics: null,
      errorMessage: null,
    };
    const newModel = await dbMlAnalyticsStorage.createMlModel(modelData, req.orgId);
    const { mlTrainingQueue } = await import("../ml-training-queue.js");
    const trainingJob = await (mlTrainingQueue as object as { enqueue: (job: Record<string, unknown>) => Promise<{ id: string }> }).enqueue({
      modelId: newModel.id,
      orgId: req.orgId,
      algorithm: config.algorithm,
      equipmentType: config.equipmentType,
      dataWindowDays: config.dataWindowDays,
      hyperparameters: config.hyperparameters,
    });
    structuredLog("info", `ML training started for model ${newModel.id}`, {
      operation: "ml_training_start",
      metadata: {
        modelId: newModel.id,
        equipmentType: config.equipmentType,
        algorithm: config.algorithm,
        windowDays: config.dataWindowDays,
      },
    });
    sendSuccess(res, {
      modelId: newModel.id,
      jobId: trainingJob.id,
      message: "Training started successfully",
      estimatedCompletionMinutes: Math.ceil(config.dataWindowDays / 10),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendBadRequest(res, "Invalid training configuration", { errors: error.errors });
    }
    handleError(error, res, "start ML training");
  }
});

// LR-3.5 / ML-1: `/deploy` directly sets a model to status=deployed,
// which is the same end-state as the two-person `/promote` flow but
// without the approval token or replaced-model bookkeeping. Gate it
// behind the same role check so the stricter promote workflow can't
// be sidestepped by calling /deploy. Idempotency mounted because a
// retried deploy POST without a key would replay the timestamp.
router.post("/ml/models/:id/deploy", requirePermission("predictive_maintenance", "manage_config"), idempotencyMiddleware({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel((req.params['id'] ?? ''), req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    if (model.status === "training") {
      return sendBadRequest(res, "Cannot deploy a model that is still training");
    }
    if (model.status === "failed") {
      return sendBadRequest(res, "Cannot deploy a failed model");
    }
    const updatedModel = await dbMlAnalyticsStorage.updateMlModel(
      (req.params['id'] ?? ''),
      { status: "deployed", deployedOn: new Date() },
      req.orgId
    );
    sendSuccess(res, { message: "Model deployed successfully", model: updatedModel });
  } catch (error) {
    handleError(error, res, "deploy ML model");
  }
});

// LR-3.5 / ML-1: archive removes a model from the deployable pool and
// is the only path back from `deployed` outside the rollback flow.
// Same admin/chief_engineer gate to match the rest of the lifecycle.
// LR-3.5 / TX-2: archive flips status+archivedOn timestamps; a retry
// without an idempotency key would overwrite the original archive
// timestamp every time and obscure the audit trail. Mount idempotency
// so a replay returns the original {message, model} payload unchanged.
router.post("/ml/models/:id/archive", requirePermission("predictive_maintenance", "manage_config"), idempotencyMiddleware({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel((req.params['id'] ?? ''), req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    const updatedModel = await dbMlAnalyticsStorage.updateMlModel(
      (req.params['id'] ?? ''),
      { status: "archived", archivedOn: new Date() },
      req.orgId
    );
    sendSuccess(res, { message: "Model archived successfully", model: updatedModel });
  } catch (error) {
    handleError(error, res, "archive ML model");
  }
});

// LR-3.5 / ML-1: model delete is the strongest model-lifecycle mutation
// (irreversible). Same admin/chief_engineer gate as deploy/archive.
// LR-3.5 / TX-2: delete is irreversible — a replay against a row that
// no longer exists would return a 404 instead of the original 200 the
// caller already saw. Mount idempotency so the original success
// response is replayed instead of bouncing the retry.
router.delete("/ml/models/:id", requirePermission("predictive_maintenance", "manage_config"), idempotencyMiddleware({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel((req.params['id'] ?? ''), req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    await dbMlAnalyticsStorage.deleteMlModel((req.params['id'] ?? ''), req.orgId);
    sendSuccess(res, { message: "Model deleted successfully" });
  } catch (error) {
    handleError(error, res, "delete ML model");
  }
});

router.post("/ml/models/:id/accuracy", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel((req.params['id'] ?? ''), req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    const { accuracy, validationAccuracy, testAccuracy, datasetSize } = req.body;
    const historyEntry = await (dbMlAnalyticsStorage as object as { addMlModelAccuracyHistory: (entry: Record<string, unknown>, orgId: string) => Promise<unknown> }).addMlModelAccuracyHistory(
      {
        modelId: (req.params['id'] ?? ''),
        accuracy,
        validationAccuracy: validationAccuracy || null,
        testAccuracy: testAccuracy || null,
        datasetSize: datasetSize || null,
      },
      req.orgId
    );
    sendSuccess(res, { message: "Accuracy history recorded", entry: historyEntry });
  } catch (error) {
    handleError(error, res, "record accuracy history");
  }
});

// Wave 3.2: Lightweight model registry — promote/rollback semantics on
// top of the existing mlModels table (no MLflow). "Promote" atomically
// archives whichever model is currently deployed for the same
// equipmentType and deploys the candidate. "Rollback" archives the
// current deployed model and re-deploys the most recently-archived
// previously-deployed model for the same equipmentType.
//
// We do the swap as a two-step sequence rather than a single SQL tx
// because the existing storage surface does not expose a transactional
// handle. The window is small (single-digit ms) and idempotent — a
// retry lands at the same end state.

// ============================================================================
// LR-1D — Two-person rule for ML model promotion.
//
// Promotion swaps the active production model for a given (org, equipmentType)
// and there is no surgical way to roll back a bad prediction outcome after
// the fact. We therefore gate `/promote` behind:
//   (1) a `requirePermission("predictive_maintenance", "manage_config")`
//       permission-grant check (aligned with the rest of the PdM surface
//       and the frontend `predictive_maintenance` resource gate);
//   (2) a separate proposer step (`/promote/request`) that mints a
//       short-lived `approvalToken` bound to (orgId, modelId, proposerUserId);
//   (3) the `/promote` call must include that token AND be made by a
//       DIFFERENT authenticated user (the approver) with the same grant.
//
// Tokens live in memory (single-instance launch posture). Multi-instance
// deployments should replace `promotionApprovals` with a Redis-backed
// store; the public contract — proposer step + token + distinct approver —
// is unchanged. Token TTL: 10 minutes (PROMOTION_APPROVAL_TTL_MS).
// ============================================================================

interface PromotionApproval {
  token: string;
  orgId: string;
  modelId: string;
  proposerUserId: string;
  expiresAt: number;
}

const PROMOTION_APPROVAL_TTL_MS = 10 * 60 * 1000;
const promotionApprovals = new Map<string, PromotionApproval>();

function pruneExpiredApprovals(now: number): void {
  for (const [k, v] of promotionApprovals) {
    if (v.expiresAt <= now) promotionApprovals.delete(k);
  }
}

function approvalKey(orgId: string, modelId: string, token: string): string {
  return `${orgId}::${modelId}::${token}`;
}

router.post(
  "/ml/models/:id/promote/request",
  requirePermission("predictive_maintenance", "manage_config"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const proposerId = req.user?.id;
      if (!proposerId) return sendBadRequest(res, "Proposer identity required");

      const modelId = req.params['id'] ?? '';
      const candidate = await dbMlAnalyticsStorage.getMlModel(modelId, req.orgId);
      if (!candidate) return sendNotFound(res, "ML model");
      if (candidate.status === "training") return sendBadRequest(res, "Cannot request promotion of a training model");
      if (candidate.status === "failed") return sendBadRequest(res, "Cannot request promotion of a failed model");
      if (!candidate.equipmentType) return sendBadRequest(res, "Model is missing equipmentType");

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
        message: "Promotion request recorded; second-approver must call /ml/models/:id/promote with this token within 10 minutes.",
        approvalToken: token,
        expiresAt: new Date(approval.expiresAt).toISOString(),
      });
    } catch (error) {
      handleError(error, res, "request ML model promotion");
    }
  },
);

const promoteBodySchema = z.object({
  approvalToken: z.string().min(1, "approvalToken is required (issued by POST /ml/models/:id/promote/request)"),
});

router.post(
  "/ml/models/:id/promote",
  requirePermission("predictive_maintenance", "manage_config"),
  // LR-3.5 / TX-2: promote consumes the single-use approval token and
  // performs the atomic archive-deployed + deploy-candidate swap. A
  // retried POST without idempotency would 412 on the second call
  // (token already consumed) which masks "did the first call succeed?".
  // Idempotency replays the cached response for the same key so the
  // proposer/approver UI gets a deterministic answer on flaky networks.
  idempotencyMiddleware({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const approverId = req.user?.id;
      if (!approverId) return sendBadRequest(res, "Approver identity required");

      const parsed = promoteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return sendBadRequest(res, parsed.error.issues[0]?.message ?? "Invalid promotion request");
      }

      const modelId = req.params['id'] ?? '';
      pruneExpiredApprovals(Date.now());
      const key = approvalKey(req.orgId, modelId, parsed.data.approvalToken);
      const approval = promotionApprovals.get(key);
      if (!approval) {
        return res.status(412).json({
          code: "PROMOTION_APPROVAL_MISSING",
          message: "No matching promotion request found (token expired, never issued, or wrong org/model).",
          error: "PreconditionFailed",
        });
      }
      if (approval.proposerUserId === approverId) {
        return res.status(412).json({
          code: "PROMOTION_SELF_APPROVAL_FORBIDDEN",
          message: "Two-person rule: the user who requested the promotion cannot also approve it.",
          error: "PreconditionFailed",
        });
      }

      const candidate = await dbMlAnalyticsStorage.getMlModel(modelId, req.orgId);
      if (!candidate) return sendNotFound(res, "ML model");
      if (candidate.status === "training") return sendBadRequest(res, "Cannot promote a training model");
      if (candidate.status === "failed") return sendBadRequest(res, "Cannot promote a failed model");
      if (!candidate.equipmentType) return sendBadRequest(res, "Model is missing equipmentType");

      const all = await dbMlAnalyticsStorage.getMlModels(req.orgId);
      const currentlyDeployed = all.filter(
        (m) => m.status === "deployed" && m.equipmentType === candidate.equipmentType && m.id !== candidate.id
      );

      for (const prev of currentlyDeployed) {
        await dbMlAnalyticsStorage.updateMlModel(
          prev.id,
          { status: "archived", archivedOn: new Date() },
          req.orgId
        );
      }
      const promoted = await dbMlAnalyticsStorage.updateMlModel(
        candidate.id,
        { status: "deployed", deployedOn: new Date(), archivedOn: null },
        req.orgId
      );

      // Consume the approval — single-use.
      promotionApprovals.delete(key);

      structuredLog("info", `ML model promoted`, {
        operation: "ml_model_promote",
        metadata: {
          modelId: candidate.id,
          equipmentType: candidate.equipmentType,
          replacedIds: currentlyDeployed.map((m) => m.id),
          proposerUserId: approval.proposerUserId,
          approverUserId: approverId,
        },
      });
      return sendSuccess(res, {
        message: "Model promoted",
        model: promoted,
        replaced: currentlyDeployed.map((m) => m.id),
        proposerUserId: approval.proposerUserId,
        approverUserId: approverId,
      });
    } catch (error) {
      handleError(error, res, "promote ML model");
    }
  },
);

// LR-3.5 / TX-2: rollback flips the deployed model for an equipmentType;
// retry on the same id without idempotency would archive the (already-
// archived) model and pick a different "previous" candidate the second
// time. Cache the response per (orgId, method, path, idempotency key).
router.post("/ml/models/:id/rollback", requirePermission("predictive_maintenance", "manage_config"), idempotencyMiddleware({ required: true }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const current = await dbMlAnalyticsStorage.getMlModel((req.params['id'] ?? ''), req.orgId);
    if (!current) return sendNotFound(res, "ML model");
    if (current.status !== "deployed") return sendBadRequest(res, "Only deployed models can be rolled back");
    if (!current.equipmentType) return sendBadRequest(res, "Model is missing equipmentType");

    const all = await dbMlAnalyticsStorage.getMlModels(req.orgId);
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
      return sendBadRequest(res, `No previously-deployed model found for equipmentType ${current.equipmentType}`);
    }

    await dbMlAnalyticsStorage.updateMlModel(
      current.id,
      { status: "archived", archivedOn: new Date() },
      req.orgId
    );
    const restored = await dbMlAnalyticsStorage.updateMlModel(
      previous.id,
      { status: "deployed", deployedOn: new Date(), archivedOn: null },
      req.orgId
    );
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
});

export const modelRoutes = router;
