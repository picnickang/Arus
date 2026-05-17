/**
 * Legacy ML calibration shim.
 */

export type CalibrationMethod = "none" | "platt" | "isotonic";

export function applyCalibration(
  scores: number[],
  _method: CalibrationMethod
): number[] {
  return scores;
}
