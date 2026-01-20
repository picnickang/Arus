/**
 * FFT Utility Functions for Vibration Analysis
 * Provides frequency analysis and band power calculations
 */

import { mean, standardDeviation } from "simple-statistics";

/**
 * Generate ISO frequency bands around equipment orders (1x-4x RPM)
 */
export function getISOBands(rpm: number): Array<[number, number]> {
  const baseFreq = rpm / 60;
  return [
    [0.8 * baseFreq, 1.2 * baseFreq],
    [1.8 * baseFreq, 2.2 * baseFreq],
    [2.8 * baseFreq, 3.2 * baseFreq],
    [3.8 * baseFreq, 4.2 * baseFreq],
  ];
}

/**
 * Calculate power in a specific frequency band using trapezoidal integration
 */
export function calculateBandPower(
  frequencies: number[],
  powerSpectrum: number[],
  lowHz: number,
  highHz: number
): number {
  const indices: number[] = [];
  const values: number[] = [];

  for (let i = 0; i < frequencies.length; i++) {
    if (frequencies[i] >= lowHz && frequencies[i] <= highHz) {
      indices.push(i);
      values.push(powerSpectrum[i]);
    }
  }

  if (indices.length === 0) {return 0;}

  let integral = 0;
  for (let i = 0; i < indices.length - 1; i++) {
    const dx = frequencies[indices[i + 1]] - frequencies[indices[i]];
    const avgHeight = (values[i] + values[i + 1]) / 2;
    integral += dx * avgHeight;
  }

  return integral;
}

/**
 * Calculate kurtosis (fourth moment) of signal distribution
 */
export function calculateKurtosis(values: number[]): number {
  if (values.length < 4) {return 0;}

  const meanVal = mean(values);
  const stdVal = standardDeviation(values);

  if (stdVal === 0) {return 0;}

  return values.reduce((sum, x) => {
      const normalized = (x - meanVal) / stdVal;
      return sum + Math.pow(normalized, 4);
    }, 0) / values.length;
}

/**
 * Generate frequency array for FFT results
 */
export function generateFrequencyArray(sampleCount: number, sampleRate: number): number[] {
  const nyquist = sampleRate / 2;
  const freqStep = nyquist / (sampleCount / 2);
  const frequencies: number[] = [];

  for (let i = 0; i <= sampleCount / 2; i++) {
    frequencies.push(i * freqStep);
  }

  return frequencies;
}
