/**
 * Acoustic Monitoring - Types
 * Interface definitions for acoustic analysis
 */

export interface AcousticFaultIndicators {
  bearingFault: { detected: boolean; confidence: number; frequency: number | null };
  gearFault: { detected: boolean; confidence: number; frequency: number | null };
  cavitation: { detected: boolean; confidence: number; intensity: number };
  leakage: { detected: boolean; confidence: number; location: "possible" | "likely" | "unknown" };
  imbalance: { detected: boolean; confidence: number };
}

export interface AcousticFeatures {
  rms: number;
  peakAmplitude: number;
  spectralCentroid: number;
  spectralRolloff: number;
  zeroCrossingRate: number;
  dominantFrequency: number;
  harmonicRatio: number;
  noiseFloor: number;
  snr: number;
  frequencyBands: {
    lowFreq: number;
    midFreq: number;
    highFreq: number;
    ultrasonic: number;
  };
  faultIndicators: AcousticFaultIndicators;
}

export interface AcousticAnalysisResult {
  features: AcousticFeatures;
  severity: "normal" | "warning" | "critical";
  primaryIssues: string[];
  recommendations: string[];
  healthScore: number;
}
