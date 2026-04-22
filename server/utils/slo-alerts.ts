/**
 * SLO Alerts - Backward Compatible Shim
 * Delegates to modular files in ./slo-alerts/
 */

export type { SLOConfig, SLOViolation, SLOStatusResponse } from "./slo-alerts/index.js";
export {
  recordLatencySample,
  checkSLOViolations,
  getRecentViolations,
  getSLOStatus,
  cleanupOldBuckets,
  getSLOConfigs,
  addCustomSLO,
  reloadSLOConfigs,
} from "./slo-alerts/index.js";
