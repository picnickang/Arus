/**
 * LSTM Model - Normalization
 * Feature normalization utilities
 */

export function normalizeFeatures(data: number[][], mean?: number[], std?: number[]): { normalized: number[][]; mean: number[]; std: number[] } {
  if (!data || data.length === 0) { throw new Error("Cannot normalize empty dataset"); }
  if (!data[0] || data[0].length === 0) { throw new Error("Cannot normalize data with no features"); }

  const featureCount = data[0].length;

  if (!mean || !std) {
    mean = new Array(featureCount).fill(0);
    std = new Array(featureCount).fill(0);

    for (const row of data) {
      for (let i = 0; i < featureCount; i++) {mean[i] += row[i];}
    }
    mean = mean.map((m) => m / data.length);

    for (const row of data) {
      for (let i = 0; i < featureCount; i++) {std[i] += Math.pow(row[i] - mean[i], 2);}
    }
    std = std.map((s) => Math.sqrt(s / data.length));
    std = std.map((s) => (s === 0 ? 1 : s));
  }

  const normalized = data.map((row) => row.map((val, i) => (val - mean![i]) / std![i]));
  return { normalized, mean, std };
}
