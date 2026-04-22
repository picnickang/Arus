/**
 * Vibration Analysis Module - Public API
 */

export * from "./types";
export { performFFT, SAMPLE_RATE, WINDOW_SIZE } from "./fft-processor";
export { detectAnomalies, getBearingDefectFrequencies } from "./anomaly-detector";
export {
  calculateHealthScore,
  calculateBandEnergy,
  calculateISOBands,
  calculateFaultBands,
} from "./health-scoring";
export { VibrationAnalyzer, vibrationAnalyzer } from "./analyzer";
