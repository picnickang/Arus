/**
 * SLO Alerts - Modular Exports
 */

export type {
  SLOConfig,
  SLOViolation,
  BucketData,
  SLOStatusMetrics,
  SLOStatusConfig,
  SLOStatusEntry,
  SLOStatusResponse,
} from "./types.js";
export {
  loadSLOConfigs,
  customSLOs,
  reloadSLOConfigs,
  addCustomSLO,
  getSLOConfigs,
  getWindowMinutes,
  getBucketMinutes,
} from "./config.js";
export {
  recordLatencySample,
  cleanupOldBuckets,
  routeBuckets,
  calculatePercentile,
  calculateBurnRate,
  getWindowBuckets,
  normalizeRoute,
  getBucketKey,
} from "./calculations.js";
export { checkSLOViolations, getRecentViolations } from "./violations.js";
export { getSLOStatus } from "./status.js";

import { cleanupOldBuckets } from "./calculations.js";
import { checkSLOViolations } from "./violations.js";

const shouldStartSLOIntervals =
  process.env["DISABLE_OBSERVABILITY_TIMERS"] !== "true" && process.env["NODE_ENV"] !== "test";

let cleanupInterval: NodeJS.Timeout | undefined;
let violationInterval: NodeJS.Timeout | undefined;

if (shouldStartSLOIntervals) {
  cleanupInterval = setInterval(cleanupOldBuckets, 60000);
  violationInterval = setInterval(() => checkSLOViolations(), 30000);
  cleanupInterval.unref?.();
  violationInterval.unref?.();
}

export const _internals = {
  stopIntervals() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = undefined;
    }
    if (violationInterval) {
      clearInterval(violationInterval);
      violationInterval = undefined;
    }
  },
};
