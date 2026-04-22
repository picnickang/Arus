/**
 * XGBoost Model - Tree Building and Prediction
 * Gradient boosting tree construction
 */

import type { XGBoostConfig, TreeNode, GradientTree } from "./types.js";
import { cryptoRandomInt } from "@shared/crypto-random";

export function findBestSplitXGBoost(
  data: number[][],
  gradients: number[],
  hessians: number[],
  featureIndices: number[],
  config: XGBoostConfig
): {
  featureIndex: number;
  threshold: number;
  gain: number;
  leftCover: number;
  rightCover: number;
} | null {
  let bestGain = -Infinity;
  let bestFeatureIndex = -1;
  let bestThreshold = 0;
  let bestLeftCover = 0;
  let bestRightCover = 0;

  for (const featureIndex of featureIndices) {
    const values = data.map((row) => row[featureIndex]);
    const uniqueValues = Array.from(new Set(values)).sort((a, b) => a - b);

    for (let i = 0; i < uniqueValues.length - 1; i++) {
      const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
      let leftGradSum = 0,
        leftHessSum = 0,
        rightGradSum = 0,
        rightHessSum = 0;

      for (let j = 0; j < data.length; j++) {
        if (data[j][featureIndex] <= threshold) {
          leftGradSum += gradients[j];
          leftHessSum += hessians[j];
        } else {
          rightGradSum += gradients[j];
          rightHessSum += hessians[j];
        }
      }

      const leftScore = (leftGradSum * leftGradSum) / (leftHessSum + config.lambda);
      const rightScore = (rightGradSum * rightGradSum) / (rightHessSum + config.lambda);
      const totalScore =
        (leftGradSum + rightGradSum) ** 2 / (leftHessSum + rightHessSum + config.lambda);
      const gain = 0.5 * (leftScore + rightScore - totalScore) - config.gamma;

      if (
        gain > bestGain &&
        leftHessSum >= config.minChildWeight &&
        rightHessSum >= config.minChildWeight
      ) {
        bestGain = gain;
        bestFeatureIndex = featureIndex;
        bestThreshold = threshold;
        bestLeftCover = leftHessSum;
        bestRightCover = rightHessSum;
      }
    }
  }

  if (bestFeatureIndex === -1) {
    return null;
  }
  return {
    featureIndex: bestFeatureIndex,
    threshold: bestThreshold,
    gain: bestGain,
    leftCover: bestLeftCover,
    rightCover: bestRightCover,
  };
}

export function buildGradientTree(
  data: number[][],
  gradients: number[],
  hessians: number[],
  featureNames: string[],
  config: XGBoostConfig,
  depth: number = 0
): TreeNode {
  if (depth >= config.maxDepth || data.length < 2) {
    const gradSum = gradients.reduce((a, b) => a + b, 0);
    const hessSum = hessians.reduce((a, b) => a + b, 0);
    return { isLeaf: true, value: -gradSum / (hessSum + config.lambda), cover: hessSum };
  }

  const numFeatures = Math.max(1, Math.floor(featureNames.length * config.colsampleByTree));
  const availableIndices = Array.from({ length: featureNames.length }, (_, i) => i);
  const selectedIndices: number[] = [];
  for (let i = 0; i < numFeatures; i++) {
    const randomIndex = cryptoRandomInt(availableIndices.length);
    selectedIndices.push(availableIndices[randomIndex]);
    availableIndices.splice(randomIndex, 1);
  }

  const split = findBestSplitXGBoost(data, gradients, hessians, selectedIndices, config);

  if (!split || split.gain <= 0) {
    const gradSum = gradients.reduce((a, b) => a + b, 0);
    const hessSum = hessians.reduce((a, b) => a + b, 0);
    return { isLeaf: true, value: -gradSum / (hessSum + config.lambda), cover: hessSum };
  }

  const leftData: number[][] = [],
    rightData: number[][] = [];
  const leftGradients: number[] = [],
    rightGradients: number[] = [];
  const leftHessians: number[] = [],
    rightHessians: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (data[i][split.featureIndex] <= split.threshold) {
      leftData.push(data[i]);
      leftGradients.push(gradients[i]);
      leftHessians.push(hessians[i]);
    } else {
      rightData.push(data[i]);
      rightGradients.push(gradients[i]);
      rightHessians.push(hessians[i]);
    }
  }

  return {
    isLeaf: false,
    featureIndex: split.featureIndex,
    featureName: featureNames[split.featureIndex],
    threshold: split.threshold,
    left: buildGradientTree(leftData, leftGradients, leftHessians, featureNames, config, depth + 1),
    right: buildGradientTree(
      rightData,
      rightGradients,
      rightHessians,
      featureNames,
      config,
      depth + 1
    ),
    gain: split.gain,
    cover: split.leftCover + split.rightCover,
  };
}

export function predictTree(tree: TreeNode, sample: number[]): number {
  if (tree.isLeaf) {
    return tree.value || 0;
  }
  if (tree.featureIndex === undefined || tree.threshold === undefined) {
    return 0;
  }
  if (sample[tree.featureIndex] <= tree.threshold) {
    return tree.left ? predictTree(tree.left, sample) : 0;
  }
  return tree.right ? predictTree(tree.right, sample) : 0;
}

export function calculateFeatureImportances(
  trees: GradientTree[],
  featureNames: string[]
): Map<string, number> {
  const importances = new Map<string, number>();
  featureNames.forEach((name) => importances.set(name, 0));

  for (const tree of trees) {
    traverseTreeForImportance(tree.root, importances, tree.treeWeight);
  }

  const total = Array.from(importances.values()).reduce((a, b) => a + b, 0);
  if (total > 0) {
    importances.forEach((value, key) => importances.set(key, value / total));
  }
  return importances;
}

function traverseTreeForImportance(
  node: TreeNode,
  importances: Map<string, number>,
  weight: number
): void {
  if (node.isLeaf || !node.featureName) {
    return;
  }
  const currentImportance = importances.get(node.featureName) || 0;
  importances.set(node.featureName, currentImportance + (node.gain || 0) * weight);
  if (node.left) {
    traverseTreeForImportance(node.left, importances, weight);
  }
  if (node.right) {
    traverseTreeForImportance(node.right, importances, weight);
  }
}
