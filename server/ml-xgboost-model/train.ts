// @ts-nocheck
/**
 * XGBoost Model - Training
 * Multi-class gradient boosting training
 */

import type { ClassificationFeatures } from "../ml-training-data.js";
import type { XGBoostConfig, TrainedXGBoostModel, GradientTree } from "./types.js";
import { calculateGradients } from "./gradient.js";
import { buildGradientTree, predictTree, calculateFeatureImportances } from "./tree.js";
import { cryptoRandomInt } from "@shared/crypto-random";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("MlXgboostModel:Train");

export async function trainXGBoostModel(
  trainData: ClassificationFeatures[],
  validationData: ClassificationFeatures[],
  config: XGBoostConfig
): Promise<TrainedXGBoostModel> {
  logger.info("[XGBoost] Starting training with config:", { details: config });
  if (trainData.length === 0) {
    throw new Error("Training data is empty");
  }

  const featureNames = Object.keys(trainData[0].features);
  const classLabels = Array.from(new Set(trainData.map((d) => d.label)));
  const numClasses = classLabels.length;

  const X: number[][] = trainData.map((d) => featureNames.map((f) => d.features[f] || 0));
  const y: number[] = trainData.map((d) => classLabels.indexOf(d.label));

  const baseScore = 0;
  const predictions: number[][] = X.map(() => Array(numClasses).fill(baseScore));
  const trees: GradientTree[] = [];

  for (let round = 0; round < config.numTrees; round++) {
    const { gradients, hessians } = calculateGradients(predictions, y, numClasses);

    for (let classIdx = 0; classIdx < numClasses; classIdx++) {
      const sampleSize = Math.floor(X.length * config.subsample);
      const indices = Array.from({ length: X.length }, (_, i) => i);
      const sampledIndices: number[] = [];

      for (let i = 0; i < sampleSize; i++) {
        const randomIndex = cryptoRandomInt(indices.length);
        sampledIndices.push(indices[randomIndex]);
        indices.splice(randomIndex, 1);
      }

      const sampledX = sampledIndices.map((i) => X[i]);
      const sampledGrad = sampledIndices.map((i) => gradients[i][classIdx]);
      const sampledHess = sampledIndices.map((i) => hessians[i][classIdx]);

      const root = buildGradientTree(sampledX, sampledGrad, sampledHess, featureNames, config);

      for (let i = 0; i < X.length; i++) {
        const treeOutput = predictTree(root, X[i]);
        predictions[i][classIdx] += config.learningRate * treeOutput;
      }

      trees.push({ root, featureImportances: new Map(), treeWeight: config.learningRate });
    }

    if ((round + 1) % 5 === 0 || round === config.numTrees - 1) {
      let correct = 0;
      for (let i = 0; i < X.length; i++) {
        const predClass = predictions[i].indexOf(Math.max(...predictions[i]));
        if (predClass === y[i]) {
          correct++;
        }
      }
      logger.info(`[XGBoost] Round ${round + 1}/${config.numTrees} - Train Accuracy: ${((correct / X.length) * 100).toFixed(2)}%`);
    }
  }

  const featureImportances = calculateFeatureImportances(trees, featureNames);
  logger.info("[XGBoost] Training complete");
  logger.info("[XGBoost] Top 5 features:", { details: Array.from(featureImportances.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([n, i]) => `${n}: ${(i * 100).toFixed(2)}%`) });

  return { trees, config, featureNames, classLabels, baseScore, numClasses };
}
