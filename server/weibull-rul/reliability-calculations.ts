/**
 * Weibull Reliability Calculations
 * 
 * Calculate reliability, RUL, confidence intervals, and failure probability.
 */

import type { WeibullParameters } from "./types.js";
import { calculateFisherInformation } from "./parameter-estimation.js";

export function calculateReliability(age: number, params: WeibullParameters): number {
  const { shape, scale, location } = params;
  const adjustedAge = Math.max(0, age - location);
  const _reliability = Math.exp(-Math.pow(adjustedAge / scale, shape));
  return Math.max(0, Math.min(1, reliability));
}

export function predictRUL(
  currentAge: number,
  params: WeibullParameters,
  failureThreshold: number
): number {
  const { shape, scale, location } = params;
  const currentReliability = calculateReliability(currentAge, params);

  if (currentReliability <= failureThreshold) {
    return 0;
  }

  const targetReliability = failureThreshold;
  const targetAge = scale * Math.pow(-Math.log(targetReliability), 1 / shape) + location;

  return Math.max(0, targetAge - currentAge);
}

export function calculateConfidenceInterval(
  currentAge: number,
  params: WeibullParameters,
  confidence: number
): { lower: number; upper: number; level: number } {
  const rul = predictRUL(currentAge, params, 0.1);

  const { shape, scale } = params;
  const n = 10;

  const fisherInfo = calculateFisherInformation(shape, scale, n);
  const shapeVariance = 1 / fisherInfo.betaBeta;
  const scaleVariance = 1 / fisherInfo.etaEta;

  const rulDerivativeShape = calculateRULDerivativeShape(currentAge, params);
  const rulDerivativeScale = calculateRULDerivativeScale(currentAge, params);

  const rulVariance =
    Math.pow(rulDerivativeShape, 2) * shapeVariance +
    Math.pow(rulDerivativeScale, 2) * scaleVariance;

  const rulStdError = Math.sqrt(Math.max(0, rulVariance));

  const zScore = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const margin = zScore * rulStdError;

  return {
    lower: Math.max(0, rul - margin),
    upper: rul + margin,
    level: confidence,
  };
}

export function calculateFailureProbability(
  startAge: number,
  endAge: number,
  params: WeibullParameters
): number {
  const reliabilityStart = calculateReliability(startAge, params);
  const reliabilityEnd = calculateReliability(endAge, params);
  return Math.max(0, reliabilityStart - reliabilityEnd);
}

export function calculateRULDerivativeShape(currentAge: number, params: WeibullParameters): number {
  const { shape } = params;
  const failureThreshold = 0.1;

  const h = 0.001;
  const paramsUp = { ...params, shape: shape + h };
  const paramsDown = { ...params, shape: shape - h };

  const rulUp = predictRUL(currentAge, paramsUp, failureThreshold);
  const rulDown = predictRUL(currentAge, paramsDown, failureThreshold);

  return (rulUp - rulDown) / (2 * h);
}

export function calculateRULDerivativeScale(currentAge: number, params: WeibullParameters): number {
  const { scale } = params;
  const failureThreshold = 0.1;

  const h = scale * 0.001;
  const paramsUp = { ...params, scale: scale + h };
  const paramsDown = { ...params, scale: scale - h };

  const rulUp = predictRUL(currentAge, paramsUp, failureThreshold);
  const rulDown = predictRUL(currentAge, paramsDown, failureThreshold);

  return (rulUp - rulDown) / (2 * h);
}

export function generateMaintenanceRecommendation(
  rul: number,
  failureProbability: { next30days: number; next90days: number },
  reliability: number
): "immediate" | "urgent" | "scheduled" | "routine" {
  if (rul < 24 || failureProbability.next30days > 0.5) {
    return "immediate";
  }

  if (rul < 168 || failureProbability.next30days > 0.3) {
    return "urgent";
  }

  if (rul < 720 || failureProbability.next90days > 0.2) {
    return "scheduled";
  }

  return "routine";
}
