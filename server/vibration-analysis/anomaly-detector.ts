/**
 * Anomaly Detection Module
 * Detects mechanical faults from vibration spectrum
 */

import type { FFTResult, AnomalyDetection, BearingDefectFrequency } from "./types";

/**
 * Calculate bearing defect frequencies for common bearing types
 */
export function getBearingDefectFrequencies(shaftFreq: number): BearingDefectFrequency[] {
  const ballPassFreqOuter = shaftFreq * 3.5;
  const ballPassFreqInner = shaftFreq * 5.5;
  const ballSpinFreq = shaftFreq * 2.3;
  const cageFreq = shaftFreq * 0.4;

  return [
    { type: "BPFO", freq: ballPassFreqOuter },
    { type: "BPFI", freq: ballPassFreqInner },
    { type: "BSF", freq: ballSpinFreq },
    { type: "FTF", freq: cageFreq },
  ];
}

/**
 * Detect mechanical anomalies based on frequency patterns
 */
export function detectAnomalies(fftResult: FFTResult): AnomalyDetection {
  const { dominantFreq, dominantMagnitude, harmonics } = fftResult;

  let anomalyScore = 0;
  let anomalyType: AnomalyDetection["anomalyType"] = "normal";
  let confidence = 0.5;

  if (dominantFreq >= 10 && dominantFreq <= 500) {
    const bearingFreqs = getBearingDefectFrequencies(dominantFreq);
    for (const defectFreq of bearingFreqs) {
      if (Math.abs(dominantFreq - defectFreq.freq) < 5) {
        anomalyScore = Math.min(1, dominantMagnitude / 100);
        anomalyType = "bearing_fault";
        confidence = 0.8;
        break;
      }
    }
  }

  if (dominantFreq >= 5 && dominantFreq <= 100) {
    const imbalanceScore = dominantMagnitude / 50;
    if (imbalanceScore > anomalyScore) {
      anomalyScore = Math.min(1, imbalanceScore);
      anomalyType = "imbalance";
      confidence = 0.7;
    }
  }

  const secondHarmonic = harmonics.find(
    (h) => h.freq >= dominantFreq * 1.8 && h.freq <= dominantFreq * 2.2
  );
  if ((secondHarmonic?.magnitude ?? 0) > dominantMagnitude * 0.5) {
    const misalignmentScore = (secondHarmonic as any).magnitude / 75;
    if (misalignmentScore > anomalyScore) {
      anomalyScore = Math.min(1, misalignmentScore);
      anomalyType = "misalignment";
      confidence = 0.75;
    }
  }

  const strongHarmonics = harmonics.filter((h) => h.magnitude > dominantMagnitude * 0.3);
  if (strongHarmonics.length >= 3) {
    const loosenessScore = strongHarmonics.length / 10;
    if (loosenessScore > anomalyScore) {
      anomalyScore = Math.min(1, loosenessScore);
      anomalyType = "looseness";
      confidence = 0.6;
    }
  }

  return {
    isAnomalous: anomalyScore > 0.3,
    anomalyScore,
    anomalyType,
    confidence,
  };
}
