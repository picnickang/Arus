/**
 * Legacy RUL (Weibull) helpers shim.
 */

export interface WeibullFitResult {
  modelId: string;
  componentClass: string;
  shapeK: number;
  scaleLambda: number;
  confidenceInterval: { lower: number; upper: number };
  trainingData: unknown;
  validationMetrics: unknown;
}

export interface RulPredictionResult {
  rulHours: number;
  quantile: number;
  hazardRate: number;
}

export function fitWeibullComprehensive(
  failureTimes: number[],
  modelId: string,
  componentClass: string
): WeibullFitResult {
  const n = Math.max(1, failureTimes.length);
  const mean = failureTimes.reduce((s, v) => s + v, 0) / n;
  return {
    modelId,
    componentClass,
    shapeK: 1.5,
    scaleLambda: Math.max(1, mean),
    confidenceInterval: { lower: 0.9, upper: 1.1 },
    trainingData: { sampleSize: n },
    validationMetrics: { mae: 0, rmse: 0 },
  };
}

export function predictRUL(
  currentAge: number,
  shapeK: number,
  scaleLambda: number,
  quantile: number = 0.5
): RulPredictionResult {
  const remaining = Math.max(
    0,
    scaleLambda * Math.pow(-Math.log(1 - quantile), 1 / shapeK) - currentAge
  );
  return { rulHours: remaining, quantile, hazardRate: shapeK / scaleLambda };
}
