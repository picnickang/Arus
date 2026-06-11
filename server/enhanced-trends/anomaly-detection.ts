/**
 * Anomaly Detection Functions for Enhanced Trends Analysis
 */

import { mean, standardDeviation } from "simple-statistics";
import type { AnomalyAnalysis, AnomalyPoint } from "./types";
import { percentile } from "./statistical-helpers";

export function classifyAnomalySeverity(
  deviation: number,
  scale: number
): "mild" | "moderate" | "severe" | "extreme" {
  const ratio = deviation / scale;
  if (ratio < 2) {
    return "mild";
  }
  if (ratio < 3) {
    return "moderate";
  }
  if (ratio < 5) {
    return "severe";
  }
  return "extreme";
}

export function detectIQRAnomalies(values: number[], timestamps: Date[]): AnomalyPoint[] {
  const sortedValues = [...values].sort((a, b) => a - b);
  const q1 = percentile(sortedValues, 25);
  const q3 = percentile(sortedValues, 75);
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const anomalies: AnomalyPoint[] = [];

  values.forEach((value, i) => {
    if (value < lowerBound || value > upperBound) {
      const ts = timestamps[i];
      if (!ts) {
        return;
      }
      const expectedValue = (q1 + q3) / 2;
      const deviation = Math.abs(value - expectedValue);
      const severity = classifyAnomalySeverity(deviation, iqr);

      anomalies.push({
        timestamp: ts,
        value,
        expectedValue,
        deviation,
        severity,
        confidence: 0.85,
        context: "IQR-based outlier detection",
      });
    }
  });

  return anomalies;
}

export function detectZScoreAnomalies(values: number[], timestamps: Date[]): AnomalyPoint[] {
  const meanValue = mean(values);
  const stdDev = standardDeviation(values);
  const anomalies: AnomalyPoint[] = [];

  values.forEach((value, i) => {
    const zScore = Math.abs((value - meanValue) / stdDev);

    if (zScore > 2.5) {
      const ts = timestamps[i];
      if (!ts) {
        return;
      }
      const deviation = Math.abs(value - meanValue);
      const severity = classifyAnomalySeverity(deviation, stdDev);

      anomalies.push({
        timestamp: ts,
        value,
        expectedValue: meanValue,
        deviation,
        severity,
        confidence: 0.9,
        context: `Z-score: ${zScore.toFixed(2)}`,
      });
    }
  });

  return anomalies;
}

export function detectIsolationAnomalies(values: number[], timestamps: Date[]): AnomalyPoint[] {
  const windowSize = Math.min(20, Math.floor(values.length / 5));
  const anomalies: AnomalyPoint[] = [];

  for (let i = windowSize; i < values.length - windowSize; i++) {
    const window = values.slice(i - windowSize, i + windowSize + 1);
    const windowMean = mean(window);
    const windowStd = standardDeviation(window);
    const currentValue = values[i];
    const ts = timestamps[i];

    if (windowStd === 0 || currentValue === undefined || !ts) {
      continue;
    }
    const isolationScore = Math.abs((currentValue - windowMean) / windowStd);

    if (isolationScore > 3) {
      const deviation = Math.abs(currentValue - windowMean);
      const severity = classifyAnomalySeverity(deviation, windowStd);

      anomalies.push({
        timestamp: ts,
        value: currentValue,
        expectedValue: windowMean,
        deviation,
        severity,
        confidence: 0.8,
        context: `Isolation score: ${isolationScore.toFixed(2)}`,
      });
    }
  }

  return anomalies;
}

export function combineAnomalies(anomalyLists: AnomalyPoint[][]): AnomalyPoint[] {
  const combined = new Map<number, AnomalyPoint>();

  anomalyLists.forEach((anomalies) => {
    anomalies.forEach((anomaly) => {
      const timeKey = anomaly.timestamp.getTime();

      if (combined.has(timeKey)) {
        const existing = combined.get(timeKey)!;
        if (anomaly.confidence > existing.confidence) {
          combined.set(timeKey, anomaly);
        }
      } else {
        combined.set(timeKey, anomaly);
      }
    });
  });

  return Array.from(combined.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );
}

export function detectAnomalies(values: number[], timestamps: Date[]): AnomalyAnalysis {
  const iqrAnomalies = detectIQRAnomalies(values, timestamps);
  const zScoreAnomalies = detectZScoreAnomalies(values, timestamps);
  const isolationAnomalies = detectIsolationAnomalies(values, timestamps);

  const combinedAnomalies = combineAnomalies([iqrAnomalies, zScoreAnomalies, isolationAnomalies]);

  const totalAnomalies = combinedAnomalies.length;
  const anomalyRate = totalAnomalies / values.length;

  let severity: "low" | "medium" | "high" | "critical";
  let recommendation: string;

  if (anomalyRate < 0.05) {
    severity = "low";
    recommendation = "Equipment operating within normal parameters. Continue routine monitoring.";
  } else if (anomalyRate < 0.15) {
    severity = "medium";
    recommendation =
      "Moderate anomaly rate detected. Increase monitoring frequency and investigate patterns.";
  } else if (anomalyRate < 0.3) {
    severity = "high";
    recommendation =
      "High anomaly rate indicates potential equipment degradation. Schedule diagnostic maintenance.";
  } else {
    severity = "critical";
    recommendation = "Critical anomaly rate detected. Immediate maintenance intervention required.";
  }

  return {
    method: "hybrid",
    anomalies: combinedAnomalies,
    summary: {
      totalAnomalies,
      anomalyRate,
      severity,
      recommendation,
    },
  };
}
