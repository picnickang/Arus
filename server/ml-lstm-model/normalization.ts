/**
 * LSTM Model - Normalization
 * Feature normalization utilities
 */

export function normalizeFeatures(
  data: number[][],
  mean?: number[],
  std?: number[]
): { normalized: number[][]; mean: number[]; std: number[] } {
  if (!data || data.length === 0) {
    throw new Error("Cannot normalize empty dataset");
  }
  if (!data[0] || data[0].length === 0) {
    throw new Error("Cannot normalize data with no features");
  }

  const featureCount = data[0].length;

  if (!mean || !std) {
    mean = new Array(featureCount).fill(0);
    std = new Array(featureCount).fill(0);

    const meanLocal = mean;
    for (const row of data) {
      for (let i = 0; i < featureCount; i++) {
        meanLocal[i] = (meanLocal[i] ?? 0) + (row[i] ?? 0);
      }
    }
    mean = meanLocal.map((m) => m / data.length);

    const stdLocal = std;
    const meanRef = mean;
    for (const row of data) {
      for (let i = 0; i < featureCount; i++) {
        stdLocal[i] = (stdLocal[i] ?? 0) + Math.pow((row[i] ?? 0) - (meanRef[i] ?? 0), 2);
      }
    }
    std = stdLocal.map((s) => Math.sqrt(s / data.length));
    std = std.map((s) => (s === 0 ? 1 : s));
  }

  const finalMean = mean;
  const finalStd = std;
  const normalized = data.map((row) => row.map((val, i) => (val - (finalMean[i] ?? 0)) / (finalStd[i] ?? 1)));
  return { normalized, mean: finalMean, std: finalStd };
}
