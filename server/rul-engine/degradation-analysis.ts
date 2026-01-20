/**
 * RUL Engine Degradation Analysis
 * 
 * Analyzes degradation patterns and calculates component health status.
 */

import type { DegradationPattern, ComponentHealthStatus } from "./types.js";
import { MIN_DEGRADATION_POINTS, CRITICAL_DEGRADATION_THRESHOLD } from "./constants.js";

/**
 * Analyze degradation pattern from historical component data
 * Uses linear regression and trend analysis
 */
export function analyzeDegradationPattern(degradationData: any[]): DegradationPattern | null {
  if (degradationData.length < MIN_DEGRADATION_POINTS) {
    return null; // Need at least 3 data points for trend analysis
  }

  // Group by component type and analyze each
  const byComponent = new Map<string, any[]>();
  degradationData.forEach((d) => {
    if (!byComponent.has(d.componentType)) {
      byComponent.set(d.componentType, []);
    }
    byComponent.get(d.componentType)!.push(d);
  });

  // Find the component with highest degradation rate
  let worstTrend: DegradationPattern | null = null;
  let worstTimeToFailure = Infinity;

  for (const [componentType, data] of byComponent.entries()) {
    if (data.length < MIN_DEGRADATION_POINTS) {continue;}

    // Sort by time
    data.sort((a, b) => a.measurementTimestamp.getTime() - b.measurementTimestamp.getTime());

    // Calculate linear regression for degradation metric
    const n = data.length;
    const times = data.map((d, i) => i); // Use index as x
    const values = data.map((d) => d.degradationMetric);

    const sumX = times.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = times.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = times.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate variance (volatility) using squared residuals
    const predicted = times.map((x) => slope * x + intercept);
    const residuals = values.map((y, i) => Math.pow(y - predicted[i], 2));
    const volatility = Math.sqrt(residuals.reduce((a, b) => a + b, 0) / n);

    // Estimate time to failure (when degradation metric reaches critical threshold)
    const currentValue = values[values.length - 1];
    const daysPerPoint =
      data.length > 1
        ? (data[data.length - 1].measurementTimestamp.getTime() -
            data[0].measurementTimestamp.getTime()) /
          (1000 * 60 * 60 * 24) /
          (data.length - 1)
        : 1;

    const degradationPerDay = slope / daysPerPoint;
    const timeToFailure = slope > 0 
      ? (CRITICAL_DEGRADATION_THRESHOLD - currentValue) / degradationPerDay 
      : Infinity;

    // Calculate acceleration (second derivative approximation)
    const acceleration =
      data.length > 2 ? (values[n - 1] - values[n - 2] - (values[1] - values[0])) / n : 0;

    // Confidence based on R-squared and data quantity
    const meanY = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssResidual = residuals.reduce((a, b) => a + b, 0);
    const rSquared = 1 - ssResidual / (ssTotal + 0.0001);
    const confidence = Math.min(0.95, rSquared * (Math.min(n, 30) / 30));

    if (timeToFailure < worstTimeToFailure && timeToFailure > 0) {
      worstTimeToFailure = timeToFailure;
      worstTrend = {
        equipmentId: data[0].equipmentId,
        trendSlope: degradationPerDay,
        acceleration,
        volatility,
        timeToFailure,
        confidence,
      };
    }
  }

  return worstTrend;
}

/**
 * Calculate health status for each component
 */
export function calculateComponentHealth(degradationData: any[]): ComponentHealthStatus[] {
  const byComponent = new Map<string, any[]>();
  degradationData.forEach((d) => {
    if (!byComponent.has(d.componentType)) {
      byComponent.set(d.componentType, []);
    }
    byComponent.get(d.componentType)!.push(d);
  });

  const componentStatus: ComponentHealthStatus[] = [];

  for (const [componentType, data] of byComponent.entries()) {
    data.sort((a, b) => b.measurementTimestamp.getTime() - a.measurementTimestamp.getTime());
    const latest = data[0];

    // Health score is inverse of degradation metric (100 = perfect, 0 = failed)
    const healthScore = Math.max(0, 100 - (latest.degradationMetric || 0));

    // Identify critical metrics
    const criticalMetrics: string[] = [];
    if (latest.vibrationLevel && latest.vibrationLevel > 10) {criticalMetrics.push("vibration");}
    if (latest.temperature && latest.temperature > 80) {criticalMetrics.push("temperature");}
    if (latest.oilCondition && latest.oilCondition < 40) {criticalMetrics.push("oil_condition");}
    if (latest.wearParticleCount && latest.wearParticleCount > 1000)
      {criticalMetrics.push("wear_particles");}

    // Estimate days to failure for this component
    const predictedFailureDays = latest.predictedFailureDate
      ? Math.max(0, (latest.predictedFailureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : healthScore * 0.3; // Rough estimate: 30 days for 100% health

    componentStatus.push({
      componentType,
      healthScore,
      degradationMetric: latest.degradationMetric || 0,
      degradationRate: latest.degradationRate || 0,
      predictedFailureDays: Math.round(predictedFailureDays),
      confidence: latest.confidenceScore || 0.5,
      criticalMetrics,
    });
  }

  return componentStatus;
}
