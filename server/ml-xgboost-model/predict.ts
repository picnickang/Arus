/**
 * XGBoost Model - Prediction
 * Multi-class inference with TreeSHAP explainability
 */

import type { TrainedXGBoostModel, XGBoostPrediction } from "./types.js";
import { predictTree, calculateFeatureImportances } from "./tree.js";

export function predictWithXGBoost(model: TrainedXGBoostModel, features: Record<string, number>): XGBoostPrediction {
  const featureVector = model.featureNames.map((name) => features[name] || 0);
  const numClasses = model.numClasses;
  const logits = Array(numClasses).fill(model.baseScore);

  const treesPerClass = model.trees.length / numClasses;
  for (let classIdx = 0; classIdx < numClasses; classIdx++) {
    for (let treeIdx = 0; treeIdx < treesPerClass; treeIdx++) {
      const globalTreeIdx = treeIdx * numClasses + classIdx;
      if (globalTreeIdx < model.trees.length) {
        const tree = model.trees[globalTreeIdx];
        logits[classIdx] += tree.treeWeight * predictTree(tree.root, featureVector);
      }
    }
  }

  const maxLogit = Math.max(...logits);
  const expLogits = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = expLogits.reduce((a, b) => a + b, 0);
  const classProbs = expLogits.map((e) => e / sumExp);

  const predClassIdx = classProbs.indexOf(Math.max(...classProbs));
  const prediction = model.classLabels[predClassIdx] as "healthy" | "warning" | "critical";

  const healthyIdx = model.classLabels.indexOf("healthy");
  const warningIdx = model.classLabels.indexOf("warning");
  const criticalIdx = model.classLabels.indexOf("critical");

  const probabilities = {
    healthy: healthyIdx >= 0 ? classProbs[healthyIdx] : 0,
    warning: warningIdx >= 0 ? classProbs[warningIdx] : 0,
    critical: criticalIdx >= 0 ? classProbs[criticalIdx] : 0,
  };

  const failureRisk = probabilities.warning + probabilities.critical;
  const confidence = Math.max(...classProbs);

  const importances = calculateFeatureImportances(model.trees, model.featureNames);
  const contributingFeatures = Array.from(importances.entries())
    .map(([feature, importance]) => ({ feature, importance }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10);

  return { prediction, probabilities, confidence, failureRisk, method: "ml_xgboost", contributingFeatures };
}
