/**
 * FFT Processing Module
 * Handles FFT computation and frequency analysis
 */

import * as fftjs from "fft-js";
const FFT = fftjs.fft;

import type { VibrationData, FFTResult } from "./types";

const SAMPLE_RATE = 1000;
const WINDOW_SIZE = 512;

/**
 * Apply Hanning window to reduce spectral leakage
 */
function applyHanningWindow(signal: number[]): number[] {
  return signal.map((value, index) => {
    const windowValue = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (signal.length - 1)));
    return value * windowValue;
  });
}

/**
 * Extract harmonic components from frequency spectrum
 */
function extractHarmonics(
  frequencies: number[],
  magnitudes: number[],
  fundamental: number
): Array<{ freq: number; magnitude: number }> {
  const harmonics = [];
  const tolerance = 5;

  for (let harmonic = 2; harmonic <= 10; harmonic++) {
    const targetFreq = fundamental * harmonic;
    const closestIndex = frequencies.findIndex((freq) => Math.abs(freq - targetFreq) < tolerance);

    if (closestIndex !== -1) {
      harmonics.push({
        freq: frequencies[closestIndex],
        magnitude: magnitudes[closestIndex],
      });
    }
  }

  return harmonics.sort((a, b) => b.magnitude - a.magnitude).slice(0, 5);
}

/**
 * Perform FFT on vibration signal
 */
export function performFFT(data: VibrationData[]): FFTResult {
  const signal = data.slice(-WINDOW_SIZE).map((d) => d.value);
  const windowedSignal = applyHanningWindow(signal);
  const fftOutput = FFT(windowedSignal);

  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  const nyquist = SAMPLE_RATE / 2;
  const frequencyResolution = nyquist / (WINDOW_SIZE / 2);

  for (let i = 0; i < WINDOW_SIZE / 2; i++) {
    const real = fftOutput[i][0];
    const imag = fftOutput[i][1];
    const magnitude = Math.sqrt(real * real + imag * imag);
    frequencies.push(i * frequencyResolution);
    magnitudes.push(magnitude);
  }

  const maxMagnitudeIndex = magnitudes.indexOf(Math.max(...magnitudes));
  const dominantFreq = frequencies[maxMagnitudeIndex];
  const dominantMagnitude = magnitudes[maxMagnitudeIndex];
  const harmonics = extractHarmonics(frequencies, magnitudes, dominantFreq);

  return { frequencies, magnitudes, dominantFreq, dominantMagnitude, harmonics };
}

export { SAMPLE_RATE, WINDOW_SIZE };
