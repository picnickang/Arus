export interface CalibrationDataPoint {
  predictedProbability: number;
  actualOutcome: 0 | 1;
}

export interface PlattParameters {
  a: number;
  b: number;
}

export interface IsotonicMapping {
  thresholds: number[];
  values: number[];
}

export interface CalibrationModel {
  method: "platt" | "isotonic";
  plattParams?: PlattParameters | undefined;
  isotonicMapping?: IsotonicMapping | undefined;
  dataPointCount: number;
  fittedAt: Date;
  metrics: {
    brierScoreBefore: number;
    brierScoreAfter: number;
    ece: number;
    mce: number;
  };
}

export interface CalibrationBin {
  binStart: number;
  binEnd: number;
  avgPredicted: number;
  avgActual: number;
  count: number;
  gap: number;
}

export interface CalibrationReport {
  modelId: string;
  orgId: string;
  method: string;
  dataPoints: number;
  fittedAt: Date;
  brierScoreBefore: number;
  brierScoreAfter: number;
  expectedCalibrationError: number;
  maxCalibrationError: number;
  reliabilityDiagram: CalibrationBin[];
  isCalibrated: boolean;
}

export function fitPlattScaling(
  data: CalibrationDataPoint[],
  maxIter = 100,
  lr = 0.01
): PlattParameters {
  let a = 0;
  let b = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    let gradA = 0;
    let gradB = 0;

    for (const { predictedProbability: f, actualOutcome: y } of data) {
      const p = 1 / (1 + Math.exp(a * f + b));
      const diff = p - y;
      gradA += diff * f;
      gradB += diff;
    }

    gradA /= data.length;
    gradB /= data.length;

    a -= lr * gradA;
    b -= lr * gradB;

    if (Math.abs(gradA) < 1e-8 && Math.abs(gradB) < 1e-8) {
      break;
    }
  }

  return { a, b };
}

export function applyPlattScaling(rawProbability: number, params: PlattParameters): number {
  const calibrated = 1 / (1 + Math.exp(params.a * rawProbability + params.b));
  return Math.max(0, Math.min(1, calibrated));
}

export function fitIsotonicRegression(data: CalibrationDataPoint[]): IsotonicMapping {
  const sorted = [...data].sort((a, b) => a.predictedProbability - b.predictedProbability);
  const n = sorted.length;
  const values: number[] = sorted.map((d) => d.actualOutcome as number);
  const weights: number[] = new Array(n).fill(1);

  let i = 0;
  while (i < n - 1) {
    const vi = values[i] ?? 0;
    const vj = values[i + 1] ?? 0;
    if (vi > vj) {
      const wi = weights[i] ?? 1;
      const wj = weights[i + 1] ?? 1;
      const totalWeight = wi + wj;
      const pooledValue = (vi * wi + vj * wj) / totalWeight;

      values[i] = pooledValue;
      weights[i] = totalWeight;

      values.splice(i + 1, 1);
      weights.splice(i + 1, 1);
      sorted.splice(i + 1, 1);

      if (i > 0) {
        i--;
      }
    } else {
      i++;
    }
  }

  return {
    thresholds: sorted.map((d) => d.predictedProbability),
    values,
  };
}

export function applyIsotonicRegression(rawProbability: number, mapping: IsotonicMapping): number {
  const { thresholds, values } = mapping;

  if (thresholds.length === 0) {
    return rawProbability;
  }
  const t0 = thresholds[0];
  const v0 = values[0];
  const tLast = thresholds[thresholds.length - 1];
  const vLast = values[values.length - 1];
  if (t0 === undefined || v0 === undefined || tLast === undefined || vLast === undefined) {
    return rawProbability;
  }
  if (rawProbability <= t0) {
    return v0;
  }
  if (rawProbability >= tLast) {
    return vLast;
  }

  let lo = 0;
  let hi = thresholds.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    const tm = thresholds[mid] ?? 0;
    if (tm <= rawProbability) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const tLo = thresholds[lo] ?? 0;
  const tHi = thresholds[hi] ?? 1;
  const vLo = values[lo] ?? 0;
  const vHi = values[hi] ?? 0;
  const denom = tHi - tLo;
  const t = denom === 0 ? 0 : (rawProbability - tLo) / denom;
  const calibrated = vLo + t * (vHi - vLo);
  return Math.max(0, Math.min(1, calibrated));
}

export function computeBrierScore(
  data: CalibrationDataPoint[],
  calibrateFn?: (p: number) => number
): number {
  let sum = 0;
  for (const { predictedProbability, actualOutcome } of data) {
    const p = calibrateFn ? calibrateFn(predictedProbability) : predictedProbability;
    sum += (p - actualOutcome) ** 2;
  }
  return sum / data.length;
}

export function computeCalibrationBins(
  data: CalibrationDataPoint[],
  numBins = 10,
  calibrateFn?: (p: number) => number
): CalibrationBin[] {
  const bins: CalibrationBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const binStart = i / numBins;
    const binEnd = (i + 1) / numBins;

    const binData = data.filter((d) => {
      const p = calibrateFn ? calibrateFn(d.predictedProbability) : d.predictedProbability;
      return p >= binStart && (i === numBins - 1 ? p <= binEnd : p < binEnd);
    });

    if (binData.length === 0) {
      bins.push({
        binStart,
        binEnd,
        avgPredicted: (binStart + binEnd) / 2,
        avgActual: 0,
        count: 0,
        gap: 0,
      });
      continue;
    }

    const avgPredicted =
      binData.reduce((s, d) => {
        const p = calibrateFn ? calibrateFn(d.predictedProbability) : d.predictedProbability;
        return s + p;
      }, 0) / binData.length;

    const avgActual = binData.reduce((s, d) => s + d.actualOutcome, 0) / binData.length;

    bins.push({
      binStart,
      binEnd,
      avgPredicted,
      avgActual,
      count: binData.length,
      gap: Math.abs(avgPredicted - avgActual),
    });
  }

  return bins;
}

export function computeECE(bins: CalibrationBin[], totalPoints: number): number {
  let ece = 0;
  for (const bin of bins) {
    if (bin.count === 0) {
      continue;
    }
    ece += (bin.count / totalPoints) * bin.gap;
  }
  return ece;
}

export function computeMCE(bins: CalibrationBin[]): number {
  return Math.max(...bins.filter((b) => b.count > 0).map((b) => b.gap), 0);
}
