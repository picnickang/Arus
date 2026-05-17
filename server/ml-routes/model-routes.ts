// @ts-nocheck
/**
 * ML Routes - Model Management Routes
 * CRUD operations for ML models: list, get, train, deploy, activate, deprecate.
 */

import { Router, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { dbMlAnalyticsStorage } from "../repositories.js";
import { mlTrainConfigSchema } from "@shared/schema-runtime";
import type { InsertMlModel } from "@shared/schema";
import { z } from "zod";
import { structuredLog } from "../logging.js";
import { sendSuccess, sendNotFound, sendBadRequest, handleError } from "../utils/api-response.js";

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

router.get("/ml/accuracy-trend", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const models = await dbMlAnalyticsStorage.getMlModels(req.orgId);
    const trendData = await Promise.all(
      models
        .filter((m) => m.status === "deployed" && m.accuracy)
        .map(async (model) => {
          const history = await dbMlAnalyticsStorage.getMlModelAccuracyHistory(model.id, req.orgId);
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
    const newModel = await dbMlAnalyticsStorage.createMlModel(modelData);
    const { mlTrainingQueue } = await import("../ml-training-queue.js");
    const trainingJob = await mlTrainingQueue.enqueue({
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
      return sendBadRequest(res, "Invalid training configuration", error.errors);
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
    const historyEntry = await dbMlAnalyticsStorage.addMlModelAccuracyHistory(
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

export const modelRoutes = router;
