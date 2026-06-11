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
    const values: number[] = [];
    for (const row of data) {
      const v = row[featureIndex];
      if (v !== undefined) {
        values.push(v);
      }
    }
    const uniqueValues = Array.from(new Set(values)).sort((a, b) => a - b);

    for (let i = 0; i < uniqueValues.length - 1; i++) {
      const a = uniqueValues[i];
      const b = uniqueValues[i + 1];
      if (a === undefined || b === undefined) {
        continue;
      }
      const threshold = (a + b) / 2;
      let leftGradSum = 0,
        leftHessSum = 0,
        rightGradSum = 0,
        rightHessSum = 0;

      for (let j = 0; j < data.length; j++) {
        const row = data[j];
        const g = gradients[j];
        const h = hessians[j];
        if (!row || g === undefined || h === undefined) {
          continue;
        }
        const v = row[featureIndex];
        if (v === undefined) {
          continue;
        }
        if (v <= threshold) {
          leftGradSum += g;
          leftHessSum += h;
        } else {
          rightGradSum += g;
          rightHessSum += h;
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
    const picked = availableIndices[randomIndex];
    if (picked === undefined) {
      continue;
    }
    selectedIndices.push(picked);
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
    const row = data[i];
    const g = gradients[i];
    const h = hessians[i];
    if (!row || g === undefined || h === undefined) {
      continue;
    }
    const v = row[split.featureIndex];
    if (v === undefined) {
      continue;
    }
    if (v <= split.threshold) {
      leftData.push(row);
      leftGradients.push(g);
      leftHessians.push(h);
    } else {
      rightData.push(row);
      rightGradients.push(g);
      rightHessians.push(h);
    }
  }

  return {
    isLeaf: false,
    featureIndex: split.featureIndex,
    featureName: featureNames[split.featureIndex] ?? "",
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
  const v = sample[tree.featureIndex];
  if (v === undefined) {
    return 0;
  }
  if (v <= tree.threshold) {
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
