/**
 * Acoustic Monitoring - Spectral Analysis
 * Spectral feature calculation functions
 */

export function calculateZeroCrossingRate(values: number[]): number {
  let crossings = 0;
  for (let i = 1; i < values.length; i++) {
    if ((values[i] >= 0 && values[i - 1] < 0) || (values[i] < 0 && values[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / values.length;
}

export function calculateSpectralCentroid(frequencies: number[], magnitudes: number[]): number {
  let weightedSum = 0;
  let totalMagnitude = 0;
  for (let i = 0; i < frequencies.length; i++) {
    weightedSum += frequencies[i] * magnitudes[i];
    totalMagnitude += magnitudes[i];
  }
  return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
}

export function calculateSpectralRolloff(frequencies: number[], magnitudes: number[]): number {
  const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag, 0);
  const threshold = 0.85 * totalEnergy;
  let cumulativeEnergy = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    cumulativeEnergy += magnitudes[i];
    if (cumulativeEnergy >= threshold) {
      return frequencies[i];
    }
  }
  return frequencies[frequencies.length - 1];
}

export function calculateHarmonicRatio(magnitudes: number[], dominantIdx: number): number {
  if (dominantIdx === 0) {
    return 0;
  }
  const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag, 0);
  let harmonicEnergy = magnitudes[dominantIdx];
  const harmonicIndices = [dominantIdx * 2, dominantIdx * 3, dominantIdx * 4];
  for (const idx of harmonicIndices) {
    if (idx < magnitudes.length) {
      harmonicEnergy += magnitudes[idx];
    }
  }
  return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
}
