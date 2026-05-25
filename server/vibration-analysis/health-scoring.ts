/**
 * Health Scoring and Band Calculations
 */

import type { FFTResult, AnomalyDetection } from "./types";
import { getBearingDefectFrequencies } from "./anomaly-detector";

/**
 * Calculate overall equipment health score from vibration analysis
 */
export function calculateHealthScore(fftResult: FFTResult, anomaly: AnomalyDetection): number {
  let healthScore = 100;

  healthScore -= anomaly.anomalyScore * 50 * anomaly.confidence;

  const rmsValue = Math.sqrt(
    fftResult.magnitudes.reduce((sum, mag) => sum + mag * mag, 0) / fftResult.magnitudes.length
  );
  const energyPenalty = Math.min(30, rmsValue / 10);
  healthScore -= energyPenalty;

  const harmonicPenalty = Math.min(20, fftResult.harmonics.length * 2);
  healthScore -= harmonicPenalty;

  return Math.max(0, Math.round(healthScore));
}

/**
 * Calculate energy in a specific frequency band
 */
export function calculateBandEnergy(
  fftResult: FFTResult,
  minFreq: number,
  maxFreq: number
): number {
  const { frequencies, magnitudes } = fftResult;
  let energy = 0;
  let count = 0;

  for (let i = 0; i < frequencies.length; i++) {
    const f = frequencies[i];
    const m = magnitudes[i];
    if (f !== undefined && m !== undefined && f >= minFreq && f <= maxFreq) {
      energy += m * m;
      count++;
    }
  }

  return count > 0 ? Math.sqrt(energy / count) : 0;
}

/**
 * Calculate ISO frequency bands for standardized vibration analysis
 */
export function calculateISOBands(fftResult: FFTResult): Record<string, number> {
  const { frequencies, magnitudes } = fftResult;

  const bands = {
    "2-10Hz": { min: 2, max: 10 },
    "10-100Hz": { min: 10, max: 100 },
    "100-1000Hz": { min: 100, max: 1000 },
  };

  const isoBands: Record<string, number> = {};

  for (const [bandName, range] of Object.entries(bands)) {
    let bandEnergy = 0;
    let bandCount = 0;

    for (let i = 0; i < frequencies.length; i++) {
      const f = frequencies[i];
      const m = magnitudes[i];
      if (f !== undefined && m !== undefined && f >= range.min && f <= range.max) {
        bandEnergy += m * m;
        bandCount++;
      }
    }

    isoBands[bandName] = bandCount > 0 ? Math.sqrt(bandEnergy / bandCount) : 0;
  }

  return isoBands;
}

/**
 * Calculate fault-specific frequency bands
 */
export function calculateFaultBands(
  fftResult: FFTResult,
  anomaly: AnomalyDetection
): Record<string, number> {
  const faultBands: Record<string, number> = {};

  if (anomaly.anomalyType === "bearing_fault") {
    const shaftFreq = fftResult.dominantFreq;
    const bearingFreqs = getBearingDefectFrequencies(shaftFreq);

    for (const defect of bearingFreqs) {
      const energy = calculateBandEnergy(fftResult, defect.freq - 2, defect.freq + 2);
      faultBands[defect.type] = energy;
    }
  }

  faultBands["gear_mesh"] = calculateBandEnergy(fftResult, 200, 800);
  faultBands["hf_bearing"] = calculateBandEnergy(fftResult, 1000, 5000);

  return faultBands;
}
