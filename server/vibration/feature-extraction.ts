/**
 * Vibration Feature Extraction Module
 * Core analysis and batch processing functions
 */

// @ts-ignore - fft-js lacks TypeScript declarations
import { fft } from "fft-js";
import { mean } from "simple-statistics";

import type { VibrationFeatures, ISO10816MachineClass, BearingGeometry } from "./types";
import { assessISO10816, accelerationToVelocity } from "./iso-assessment";
import { calculateBearingFaultFrequencies } from "./bearing-analysis";
import { getISOBands, calculateBandPower, calculateKurtosis, generateFrequencyArray } from "./fft-utils";

/**
 * Advanced vibration analysis with FFT and statistical features
 */
export function analyzeVibration(
  values: number[],
  sampleRate: number,
  rpm?: number,
  machineClass?: ISO10816MachineClass,
  bearingGeometry?: BearingGeometry
): VibrationFeatures {
  const n = values.length;

  if (n < 8) {
    return {
      rms: 0, crestFactor: 0, kurtosis: 0, peakFrequency: 0,
      bands: [0, 0, 0, 0], rawDataLength: n, sampleRate,
    };
  }

  const meanVal = mean(values);
  const acValues = values.map((x) => x - meanVal);

  const rms = Math.sqrt(mean(acValues.map((x) => x * x)));
  const peakValue = Math.max(...acValues.map(Math.abs));
  const crestFactor = rms > 0 ? peakValue / rms : 0;
  const kurtosis = calculateKurtosis(acValues);

  const fftInput = acValues.map((x) => [x, 0]);
  const fftResult = fft(fftInput);

  const powerSpectrum = fftResult
    .slice(0, Math.floor(n / 2) + 1)
    .map((complex: [number, number]) => {
      const [real, imag] = complex;
      return (real * real + imag * imag) / n;
    });

  const frequencies = generateFrequencyArray(n, sampleRate);

  let maxPowerIndex = 0;
  let maxPower = powerSpectrum[0];
  for (let i = 1; i < powerSpectrum.length; i++) {
    if (powerSpectrum[i] > maxPower) {
      maxPower = powerSpectrum[i];
      maxPowerIndex = i;
    }
  }
  const peakFrequency = frequencies[maxPowerIndex];

  const bands: [number, number, number, number] = [0, 0, 0, 0];
  if (rpm && rpm > 0) {
    const isoBands = getISOBands(rpm);
    for (let i = 0; i < 4; i++) {
      bands[i] = calculateBandPower(frequencies, powerSpectrum, isoBands[i][0], isoBands[i][1]);
    }
  }

  const totalPower = powerSpectrum.reduce((sum: number, power: number) => sum + power, 0);
  const noiseFloor = powerSpectrum.slice(1).reduce((min: number, power: number) => Math.min(min, power), powerSpectrum[1] || 0);

  let weightedSum = 0, powerSum = 0;
  for (let i = 0; i < frequencies.length; i++) {
    weightedSum += frequencies[i] * powerSpectrum[i];
    powerSum += powerSpectrum[i];
  }
  const spectralCentroid = powerSum > 0 ? weightedSum / powerSum : 0;

  let isoAssessment = undefined;
  if (machineClass && peakFrequency > 0) {
    const velocityRms = accelerationToVelocity(rms, peakFrequency);
    isoAssessment = assessISO10816(velocityRms, machineClass);
  }

  let bearingFaults = undefined;
  if (bearingGeometry && rpm && rpm > 0) {
    bearingFaults = calculateBearingFaultFrequencies(bearingGeometry, rpm);
  }

  return {
    rms, crestFactor, kurtosis, peakFrequency, bands, rawDataLength: n, sampleRate,
    analysisMetadata: { noiseFloor, spectralCentroid, totalPower },
    isoAssessment, bearingFaults,
  };
}

/**
 * Analyze multiple vibration signals simultaneously
 */
export function analyzeBatchVibration(
  signals: Array<{
    values: number[];
    sampleRate: number;
    rpm?: number;
    equipmentId: string;
    timestamp?: Date;
  }>
): Array<VibrationFeatures & { equipmentId: string; timestamp?: Date }> {
  return signals.map((signal) => ({
    ...analyzeVibration(signal.values, signal.sampleRate, signal.rpm),
    equipmentId: signal.equipmentId,
    timestamp: signal.timestamp,
  }));
}
