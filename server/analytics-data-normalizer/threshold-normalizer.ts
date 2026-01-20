/**
 * Threshold Optimization Normalizer
 */

import type { ThresholdOptimization } from "@shared/schema-runtime";

export function normalizeThresholdOptimization(optimization: ThresholdOptimization): ThresholdOptimization {
  return {
    ...optimization,
    optimizationTimestamp: optimization.optimizationTimestamp || new Date(),
    currentThresholds: optimization.currentThresholds ?? { warning: null, critical: null, min: null, max: null },
    optimizedThresholds: optimization.optimizedThresholds ?? { warning: null, critical: null, min: null, max: null, confidence: 0 },
    improvementMetrics: optimization.improvementMetrics ?? { precision: null, recall: null, falsePositiveRate: null, falseNegativeRate: null, f1Score: null },
    optimizationMethod: optimization.optimizationMethod ?? "statistical",
    validationResults: optimization.validationResults ?? { validated: false, testDataSize: 0, accuracy: null },
    performance: optimization.performance ?? { applied: false, durationDays: 0, alertsGenerated: 0, truePositives: 0, falsePositives: 0, falseNegatives: 0 },
    metadata: optimization.metadata ?? {},
  };
}

export function normalizeThresholdOptimizations(optimizations: ThresholdOptimization[]): ThresholdOptimization[] {
  return optimizations.map(normalizeThresholdOptimization);
}
