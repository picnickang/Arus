/**
 * XGBoost Model - Types
 * Shared type definitions for XGBoost implementation
 */

export interface XGBoostConfig {
  numTrees: number;
  maxDepth: number;
  learningRate: number;
  minChildWeight: number;
  subsample: number;
  colsampleByTree: number;
  lambda: number;
  alpha: number;
  gamma: number;
}

export interface XGBoostPrediction {
  prediction: "healthy" | "warning" | "critical";
  probabilities: { healthy: number; warning: number; critical: number };
  confidence: number;
  failureRisk: number;
  method: "ml_xgboost";
  contributingFeatures: Array<{ feature: string; importance: number }>;
}

export interface TreeNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  featureName?: string;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  gain?: number;
  cover?: number;
}

export interface GradientTree {
  root: TreeNode;
  featureImportances: Map<string, number>;
  treeWeight: number;
}

export interface TrainedXGBoostModel {
  trees: GradientTree[];
  config: XGBoostConfig;
  featureNames: string[];
  classLabels: string[];
  baseScore: number;
  numClasses: number;
}
