// @ts-nocheck
/**
 * LSTM Model - Sequence Preparation
 * Prepare time series sequences for LSTM
 */

import type { TimeSeriesFeatures } from "../ml-training-data.js";

export function prepareSequences(
  data: TimeSeriesFeatures[],
  sequenceLength: number,
  featureNames: string[]
): { sequences: number[][][]; labels: number[] } {
  const sequences: number[][][] = [];
  const labels: number[] = [];

  const equipmentGroups = new Map<string, TimeSeriesFeatures[]>();
  for (const point of data) {
    if (!equipmentGroups.has(point.equipmentId)) {
      equipmentGroups.set(point.equipmentId, []);
    }
    equipmentGroups.get(point.equipmentId)!.push(point);
  }

  for (const [_, points] of equipmentGroups.entries()) {
    points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = sequenceLength; i < points.length; i++) {
      const sequence: number[][] = [];
      for (let j = i - sequenceLength; j < i; j++) {
        const features: number[] = [];
        for (const featureName of featureNames) {
          features.push(points[j].features[featureName] ?? 0);
        }
        sequence.push(features);
      }
      sequences.push(sequence);
      labels.push(points[i].label);
    }
  }

  return { sequences, labels };
}
