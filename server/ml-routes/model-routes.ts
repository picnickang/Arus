/**
 * ML Routes - Model Management Routes
 * CRUD operations for ML models: list, get, train, deploy, activate, deprecate.
 */

import { Router, Response } from "express";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { AuthenticatedRequest } from "../middleware/auth.js";
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
    const model = await dbMlAnalyticsStorage.getMlModel(req.params.id, req.orgId);
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
    const model = await dbMlAnalyticsStorage.getMlModel(req.params.id, req.orgId);
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
          const history = await (dbMlAnalyticsStorage as any).getMlModelAccuracyHistory(model.id, req.orgId);
          return history.map((h: { recordedAt: Date; accuracy: string | null }) => ({
            date: h.recordedAt.toISOString().split("T")[0],
            accuracy: Number.parseFloat(h.accuracy || "0"),
            modelId: model.id,
            modelName: model.name,
          }));
        })
    );
    sendSuccess(
      res,
      trendData.flat().sort((a: { date: string }, b: { date: string }) => new Date(a.date).getTime() - new Date(b.date).getTime())
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

router.post("/ml/train", async (req: AuthenticatedRequest, res: Response) => {
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
    const newModel = await (dbMlAnalyticsStorage as any).createMlModel(modelData);
    const { mlTrainingQueue } = await import("../ml-training-queue.js");
    const trainingJob = await (mlTrainingQueue as any).enqueue({
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
      return sendBadRequest(res, "Invalid training configuration", error.errors as any);
    }
    handleError(error, res, "start ML training");
  }
});

router.post("/ml/models/:id/deploy", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel(req.params.id, req.orgId);
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
      req.params.id,
      { status: "deployed", deployedOn: new Date() },
      req.orgId
    );
    sendSuccess(res, { message: "Model deployed successfully", model: updatedModel });
  } catch (error) {
    handleError(error, res, "deploy ML model");
  }
});

router.post("/ml/models/:id/archive", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel(req.params.id, req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    const updatedModel = await dbMlAnalyticsStorage.updateMlModel(
      req.params.id,
      { status: "archived", archivedOn: new Date() },
      req.orgId
    );
    sendSuccess(res, { message: "Model archived successfully", model: updatedModel });
  } catch (error) {
    handleError(error, res, "archive ML model");
  }
});

router.delete("/ml/models/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel(req.params.id, req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    await dbMlAnalyticsStorage.deleteMlModel(req.params.id, req.orgId);
    sendSuccess(res, { message: "Model deleted successfully" });
  } catch (error) {
    handleError(error, res, "delete ML model");
  }
});

router.post("/ml/models/:id/accuracy", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const model = await dbMlAnalyticsStorage.getMlModel(req.params.id, req.orgId);
    if (!model) {
      return sendNotFound(res, "ML model");
    }
    const { accuracy, validationAccuracy, testAccuracy, datasetSize } = req.body;
    const historyEntry = await (dbMlAnalyticsStorage as any).addMlModelAccuracyHistory(
      {
        modelId: req.params.id,
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

router.post("/ml/models/:id/promote", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const candidate = await dbMlAnalyticsStorage.getMlModel(req.params.id, req.orgId);
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
    structuredLog("info", `ML model promoted`, {
      operation: "ml_model_promote",
      metadata: {
        modelId: candidate.id,
        equipmentType: candidate.equipmentType,
        replacedIds: currentlyDeployed.map((m) => m.id),
      },
    });
    sendSuccess(res, { message: "Model promoted", model: promoted, replaced: currentlyDeployed.map((m) => m.id) });
  } catch (error) {
    handleError(error, res, "promote ML model");
  }
});

router.post("/ml/models/:id/rollback", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const current = await dbMlAnalyticsStorage.getMlModel(req.params.id, req.orgId);
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
