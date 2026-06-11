/**
 * Acoustic Monitoring - Spectral Analysis
 * Spectral feature calculation functions
 */

export function calculateZeroCrossingRate(values: number[]): number {
  let crossings = 0;
  for (let i = 1; i < values.length; i++) {
    const a = values[i];
    const b = values[i - 1];
    if (a === undefined || b === undefined) {
      continue;
    }
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) {
      crossings++;
    }
  }
  return crossings / values.length;
}

export function calculateSpectralCentroid(frequencies: number[], magnitudes: number[]): number {
  let weightedSum = 0;
  let totalMagnitude = 0;
  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    const m = magnitudes[i];
    if (f === undefined || m === undefined) {
      continue;
    }
    weightedSum += f * m;
    totalMagnitude += m;
  }
  return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
}

export function calculateSpectralRolloff(frequencies: number[], magnitudes: number[]): number {
  const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag, 0);
  const threshold = 0.85 * totalEnergy;
  let cumulativeEnergy = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    const m = magnitudes[i];
    if (m === undefined) {
      continue;
    }
    cumulativeEnergy += m;
    if (cumulativeEnergy >= threshold) {
      return frequencies[i] ?? 0;
    }
  }
  return frequencies[frequencies.length - 1] ?? 0;
}

export function calculateHarmonicRatio(magnitudes: number[], dominantIdx: number): number {
  if (dominantIdx === 0) {
    return 0;
  }
  const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag, 0);
  let harmonicEnergy = magnitudes[dominantIdx] ?? 0;
  const harmonicIndices = [dominantIdx * 2, dominantIdx * 3, dominantIdx * 4];
  for (const idx of harmonicIndices) {
    if (idx < magnitudes.length) {
      harmonicEnergy += magnitudes[idx] ?? 0;
    }
  }
  return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
}
