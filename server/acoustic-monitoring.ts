/**
 * Acoustic Monitoring - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export type {
  AcousticFeatures,
  AcousticFaultIndicators,
  AcousticAnalysisResult,
} from "./acoustic-monitoring/index.js";

export { analyzeAcoustic, performAcousticAnalysis } from "./acoustic-monitoring/index.js";
