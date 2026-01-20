/**
 * Bearing Fault Frequency Analysis Module
 * Calculates and detects bearing fault frequencies
 */

import type { BearingGeometry, BearingFaultFrequencies, BearingFaultDetection } from "./types";

/**
 * Calculate bearing fault frequencies based on geometry
 */
export function calculateBearingFaultFrequencies(
  geometry: BearingGeometry,
  rpm: number
): BearingFaultFrequencies {
  const { innerRaceDiameter, outerRaceDiameter, ballDiameter, numberOfBalls, contactAngle } = geometry;

  const pitchDiameter = (innerRaceDiameter + outerRaceDiameter) / 2;
  const shaftFreq = rpm / 60;
  const contactAngleRad = (contactAngle * Math.PI) / 180;
  const cosContactAngle = Math.cos(contactAngleRad);

  const bpfo = (numberOfBalls / 2) * shaftFreq * (1 - (ballDiameter * cosContactAngle) / pitchDiameter);
  const bpfi = (numberOfBalls / 2) * shaftFreq * (1 + (ballDiameter * cosContactAngle) / pitchDiameter);
  const ftf = (shaftFreq / 2) * (1 - (ballDiameter * cosContactAngle) / pitchDiameter);
  const bsf = ((pitchDiameter / ballDiameter) * shaftFreq *
    (1 - Math.pow((ballDiameter * cosContactAngle) / pitchDiameter, 2))) / 2;

  return { bpfo, bpfi, ftf, bsf, rpm, geometry };
}

/**
 * Detect bearing fault frequencies in vibration spectrum
 */
export function detectBearingFaults(
  frequencies: number[],
  powerSpectrum: number[],
  bearingFreqs: BearingFaultFrequencies,
  tolerance: number = 0.05
): BearingFaultDetection {
  const findPeakAmplitude = (targetFreq: number): number => {
    const freqTolerance = targetFreq * tolerance;
    const minFreq = targetFreq - freqTolerance;
    const maxFreq = targetFreq + freqTolerance;

    let maxAmplitude = 0;
    for (let i = 0; i < frequencies.length; i++) {
      if (frequencies[i] >= minFreq && frequencies[i] <= maxFreq) {
        maxAmplitude = Math.max(maxAmplitude, powerSpectrum[i]);
      }
    }
    return Math.sqrt(maxAmplitude);
  };

  const amplitudes = {
    bpfo: findPeakAmplitude(bearingFreqs.bpfo),
    bpfi: findPeakAmplitude(bearingFreqs.bpfi),
    ftf: findPeakAmplitude(bearingFreqs.ftf),
    bsf: findPeakAmplitude(bearingFreqs.bsf),
  };

  const noiseFloor = powerSpectrum
    .slice(1)
    .reduce((min, power) => Math.min(min, power), powerSpectrum[1] || 0);
  const detectionThreshold = Math.sqrt(noiseFloor) * 3;

  return {
    bpfoDetected: amplitudes.bpfo > detectionThreshold,
    bpfiDetected: amplitudes.bpfi > detectionThreshold,
    ftfDetected: amplitudes.ftf > detectionThreshold,
    bsfDetected: amplitudes.bsf > detectionThreshold,
    amplitudes,
  };
}
