/**
 * System Admin Domain - Ports
 *
 * Pure port interfaces for the system-admin domain. The threshold calibrator is
 * supplied by the pdm-platform decision path and injected via route deps; the
 * domain depends only on this narrow contract.
 */

export interface ThresholdCalibrator {
  calibrateForEquipment: (orgId: string, equipmentId: string) => Promise<Record<string, unknown>>;
}
