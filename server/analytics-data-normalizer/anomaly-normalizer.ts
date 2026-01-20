/**
 * Anomaly Detection Normalizer
 */

import type { AnomalyDetection } from "@shared/schema-runtime";
import { expandAnomalyType, clampToRange } from "./helpers";

export function normalizeAnomalyDetection(detection: AnomalyDetection): AnomalyDetection {
  return {
    ...detection,
    detectionTimestamp: detection.detectionTimestamp || new Date(),
    anomalyScore: clampToRange(detection.anomalyScore ?? 0.5, 0, 1),
    anomalyType: expandAnomalyType(detection.anomalyType),
    severity: detection.severity || "medium",
    detectedValue: detection.detectedValue ?? null,
    expectedValue: detection.expectedValue ?? null,
    deviation: detection.deviation ?? null,
    contributingFactors: detection.contributingFactors ?? [],
    recommendedActions: detection.recommendedActions ?? [],
    metadata: detection.metadata ?? {},
  };
}

export function normalizeAnomalyDetections(detections: AnomalyDetection[]): AnomalyDetection[] {
  return detections.map(normalizeAnomalyDetection);
}
