/**
 * ML Routes - Model Management Routes
 * CRUD operations for ML models: list, get, train, deploy, activate, deprecate.
 */

import { Router, Response } from "express";
import { generalApiRateLimit } from "../middleware/rate-limiters";
import path from "node:path";
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
import { registerModelPromotionRoutes } from "./model-promotion-routes.js";

const router = Router();

// Rate-limit every handler on this router (CWE-770). No-op in tests/dev relax.
router.use(generalApiRateLimit);

router.get("/ml/models", async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendSuccess(res, await dbMlAnalyticsStorage.getMlModels(req.orgId));
  } catch (error) {
    handleError(error, res, "fetch ML models");
  }
});

router.get("/ml/models/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel(req.params["id"] ?? "", req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    sendSuccess(res, model);
  } catch (error) {
    handleError(error, res, "fetch ML model");
  }
});

/**
 * Push A1 — Serve the raw ONNX artifact for a deployed model so future
 * browser/offline scoring clients can consume the same deployed artifact.
 * Tenancy-scoped on orgId, only deployed models are served, and the disk path
 * is read from the registry's training_metrics — not user input — so this
 * cannot be abused as an arbitrary-file read.
 */
router.get("/ml/models/:id/artifact", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel(req.params["id"] ?? "", req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
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
          const history = await (
            dbMlAnalyticsStorage as object as {
              getMlModelAccuracyHistory: (
                id: string,
                orgId: string
              ) => Promise<Array<{ recordedAt: Date; accuracy: number | null }>>;
            }
          ).getMlModelAccuracyHistory(model.id, req.orgId);
          return history.map((h: { recordedAt: Date; accuracy: number | null }) => ({
            date: h.recordedAt.toISOString().split("T")[0] ?? "",
            accuracy: h.accuracy ?? 0,
            modelId: model.id,
            modelName: model.name,
          }));
        })
    );
    sendSuccess(
      res,
      trendData
        .flat()
        .sort((a, b) => new Date(a.date ?? "").getTime() - new Date(b.date ?? "").getTime())
    );
  } catch (error) {
    handleError(error, res, "fetch accuracy trend");
  }
});

// LR-3.5 / TX-2: training is a side-effectful mutation — it inserts an
// `ml_models` row in status='training' and enqueues a background job.
// A client that retries the POST on a transient network error without
// an idempotency key would create duplicate training rows + duplicate
// queue entries. Mount idempotencyMiddleware so a replay returns the
// originally-recorded {modelId, jobId} response.
router.post(
  "/ml/train",
  idempotencyMiddleware({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
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
      const trainingJob = await (
        mlTrainingQueue as object as {
          enqueue: (job: Record<string, unknown>) => Promise<{ id: string }>;
        }
      ).enqueue({
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
  }
);

// LR-3.5 / ML-1: `/deploy` directly sets a model to status=deployed,
// which is the same end-state as the two-person `/promote` flow but
// without the approval token or replaced-model bookkeeping. Gate it
// behind the same role check so the stricter promote workflow can't
// be sidestepped by calling /deploy. Idempotency mounted because a
// retried deploy POST without a key would replay the timestamp.
router.post(
  "/ml/models/:id/deploy",
  requirePermission("predictive_maintenance", "manage_config"),
  idempotencyMiddleware({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const model = await dbMlAnalyticsStorage.getMlModel(req.params["id"] ?? "", req.orgId);
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
        req.params["id"] ?? "",
        { status: "deployed", deployedOn: new Date() },
        req.orgId
      );
      sendSuccess(res, { message: "Model deployed successfully", model: updatedModel });
    } catch (error) {
      handleError(error, res, "deploy ML model");
    }
  }
);

// LR-3.5 / ML-1: archive removes a model from the deployable pool and
// is the only path back from `deployed` outside the rollback flow.
// Same admin/chief_engineer gate to match the rest of the lifecycle.
// LR-3.5 / TX-2: archive flips status+archivedOn timestamps; a retry
// without an idempotency key would overwrite the original archive
// timestamp every time and obscure the audit trail. Mount idempotency
// so a replay returns the original {message, model} payload unchanged.
router.post(
  "/ml/models/:id/archive",
  requirePermission("predictive_maintenance", "manage_config"),
  idempotencyMiddleware({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const model = await dbMlAnalyticsStorage.getMlModel(req.params["id"] ?? "", req.orgId);
      if (!model) {
        return sendNotFound(res, "ML model");
      }
      const updatedModel = await dbMlAnalyticsStorage.updateMlModel(
        req.params["id"] ?? "",
        { status: "archived", archivedOn: new Date() },
        req.orgId
      );
      sendSuccess(res, { message: "Model archived successfully", model: updatedModel });
    } catch (error) {
      handleError(error, res, "archive ML model");
    }
  }
);

// LR-3.5 / ML-1: model delete is the strongest model-lifecycle mutation
// (irreversible). Same admin/chief_engineer gate as deploy/archive.
// LR-3.5 / TX-2: delete is irreversible — a replay against a row that
// no longer exists would return a 404 instead of the original 200 the
// caller already saw. Mount idempotency so the original success
// response is replayed instead of bouncing the retry.
router.delete(
  "/ml/models/:id",
  requirePermission("predictive_maintenance", "manage_config"),
  idempotencyMiddleware({ required: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const model = await dbMlAnalyticsStorage.getMlModel(req.params["id"] ?? "", req.orgId);
      if (!model) {
        return sendNotFound(res, "ML model");
      }
      await dbMlAnalyticsStorage.deleteMlModel(req.params["id"] ?? "", req.orgId);
      sendSuccess(res, { message: "Model deleted successfully" });
    } catch (error) {
      handleError(error, res, "delete ML model");
    }
  }
);

router.post("/ml/models/:id/accuracy", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel(req.params["id"] ?? "", req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    const { accuracy, validationAccuracy, testAccuracy, datasetSize } = req.body;
    const historyEntry = await (
      dbMlAnalyticsStorage as object as {
        addMlModelAccuracyHistory: (
          entry: Record<string, unknown>,
          orgId: string
        ) => Promise<unknown>;
      }
    ).addMlModelAccuracyHistory(
      {
        modelId: req.params["id"] ?? "",
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

registerModelPromotionRoutes(router);

export const modelRoutes = router;
