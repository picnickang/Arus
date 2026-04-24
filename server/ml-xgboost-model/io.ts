/**
 * XGBoost Model - I/O Operations
 * Save and load model to disk
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("MlXgboostModel:Io");
import * as fs from "node:fs/promises";
import type { TrainedXGBoostModel } from "./types.js";

export async function saveXGBoostModel(model: TrainedXGBoostModel, path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
  const modelJson = JSON.stringify(
    {
      trees: model.trees,
      config: model.config,
      featureNames: model.featureNames,
      classLabels: model.classLabels,
      baseScore: model.baseScore,
      numClasses: model.numClasses,
    },
    null,
    2
  );
  await fs.writeFile(`${path}/model.json`, modelJson);
  logger.info(`[XGBoost] Model saved to ${path}`);
}

export async function loadXGBoostModel(path: string): Promise<TrainedXGBoostModel> {
  const modelJson = await fs.readFile(`${path}/model.json`, "utf-8");
  const model = JSON.parse(modelJson);
  logger.info(`[XGBoost] Model loaded from ${path}`);
  return model;
}
