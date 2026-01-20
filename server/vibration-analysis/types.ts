/**
 * Vibration Analysis Types
 */

export interface VibrationData {
  timestamp: Date;
  value: number;
  equipmentId: string;
  sensorType: string;
}

export interface FFTResult {
  frequencies: number[];
  magnitudes: number[];
  dominantFreq: number;
  dominantMagnitude: number;
  harmonics: Array<{ freq: number; magnitude: number }>;
}

export interface AnomalyDetection {
  isAnomalous: boolean;
  anomalyScore: number;
  anomalyType: "bearing_fault" | "imbalance" | "misalignment" | "looseness" | "normal";
  confidence: number;
}

export interface BearingDefectFrequency {
  type: string;
  freq: number;
}
