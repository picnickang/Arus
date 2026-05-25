/**
 * Weibull Parameter Estimation
 *
 * Statistical estimation of Weibull distribution parameters using MLE.
 */

import type { WeibullParameters, EquipmentLifeData } from "./types.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("WeibullRul:ParameterEstimation");

export function estimateWeibullParameters(lifeData: EquipmentLifeData[]): WeibullParameters {
  if (lifeData.length === 0) {
    throw new Error("Cannot estimate Weibull parameters from empty dataset");
  }

  const failureTimes = lifeData.map((d) => d.age).filter((age) => age > 0);
  const n = failureTimes.length;

  if (n < 3) {
    throw new Error("Insufficient failure data for statistical estimation (need ≥3 samples)");
  }

  failureTimes.sort((a, b) => a - b);

  const meanTime = failureTimes.reduce((sum, t) => sum + t, 0) / n;
  const variance = failureTimes.reduce((sum, t) => sum + Math.pow(t - meanTime, 2), 0) / (n - 1);
  const cv = Math.sqrt(variance) / meanTime;

  let shape = estimateInitialShape(failureTimes, cv);
  let scale: number;
  const location = 0;

  for (let iteration = 0; iteration < 20; iteration++) {
    const oldShape = shape;

    const sumLogT = failureTimes.reduce((sum, t) => sum + Math.log(t), 0);
    const sumTBeta = failureTimes.reduce((sum, t) => sum + Math.pow(t, shape), 0);
    const sumTBetaLogT = failureTimes.reduce((sum, t) => sum + Math.pow(t, shape) * Math.log(t), 0);
    const sumTBetaLogT2 = failureTimes.reduce(
      (sum, t) => sum + Math.pow(t, shape) * Math.pow(Math.log(t), 2),
      0
    );

    const f = sumLogT / n - sumTBetaLogT / sumTBeta + 1 / shape;

    const term1 = sumTBetaLogT2 / sumTBeta;
    const term2 = Math.pow(sumTBetaLogT / sumTBeta, 2);
    const term3 = 1 / (shape * shape);
    const fPrime = -(term1 - term2) - term3;

    if (Math.abs(fPrime) < 1e-10) {
      logger.info(`[Weibull MLE] Derivative too small at iteration ${iteration}, stopping`);
      break;
    }

    const newShape = oldShape - f / fPrime;
    shape = Math.max(0.1, Math.min(10, newShape));

    if (Math.abs(shape - oldShape) < 1e-6) {
      logger.info(`[Weibull MLE] Converged after ${iteration + 1} iterations: β=${shape.toFixed(4)}`);
      break;
    }

    if (iteration === 19) {
      logger.info(`[Weibull MLE] Maximum iterations reached, using β=${shape.toFixed(4)}`);
    }
  }

  scale = Math.pow(failureTimes.reduce((sum, t) => sum + Math.pow(t, shape), 0) / n, 1 / shape);

  const rsquared = calculateWeibullGoodnessOfFit(failureTimes, shape, scale, location);

  logger.info(`[Weibull RUL] Estimated parameters: β=${shape.toFixed(2)}, η=${scale.toFixed(1)}h, γ=${location.toFixed(1)}h, R²=${rsquared.toFixed(3)}`);

  return {
    shape,
    scale,
    location,
    rsquared,
  };
}

export function estimateInitialShape(failureTimes: number[], cv: number): number {
  if (cv < 0.3) {
    return 3.5;
  }
  if (cv < 0.8) {
    return 2;
  }
  return 1;
}

export function calculateFisherInformation(
  shape: number,
  scale: number,
  n: number
): { betaBeta: number; etaEta: number } {
  const betaBeta = n * (1.109721 / (shape * shape));
  const etaEta = (n * (shape * shape)) / (scale * scale);
  return { betaBeta, etaEta };
}

export function calculateWeibullGoodnessOfFit(
  failureTimes: number[],
  shape: number,
  scale: number,
  location: number
): number {
  const n = failureTimes.length;
  if (n < 3) {
    return 0.5;
  }

  let sumXY = 0,
    sumX = 0,
    sumY = 0,
    sumX2 = 0,
    sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const ft = failureTimes[i];
    if (ft === undefined) continue;
    const rank = (i + 1) / (n + 1);
    const observedX = Math.log(Math.log(1 / (1 - rank)));
    const theoreticalY = Math.log(Math.max(0.01, ft - location)) - Math.log(scale);

    sumXY += observedX * theoreticalY;
    sumX += observedX;
    sumY += theoreticalY;
    sumX2 += observedX * observedX;
    sumY2 += theoreticalY * theoreticalY;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  const correlation = denominator !== 0 ? numerator / denominator : 0;
  return Math.max(0.3, Math.min(0.99, correlation * correlation));
}

export function gammaFunction(x: number): number {
  if (x === 1) {
    return 1;
  }
  if (x === 1.5) {
    return Math.sqrt(Math.PI) / 2;
  }
  if (x === 2) {
    return 1;
  }
  if (x === 2.5) {
    return (3 * Math.sqrt(Math.PI)) / 4;
  }
  return Math.sqrt((2 * Math.PI) / x) * Math.pow(x / Math.E, x);
}
