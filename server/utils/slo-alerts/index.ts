/**
 * SLO Alerts - Modular Exports
 */

export type { SLOConfig, SLOViolation, BucketData, SLOStatusMetrics, SLOStatusConfig, SLOStatusEntry, SLOStatusResponse } from "./types.js";
export { loadSLOConfigs, customSLOs, reloadSLOConfigs, addCustomSLO, getSLOConfigs, getWindowMinutes, getBucketMinutes } from "./config.js";
export { recordLatencySample, cleanupOldBuckets, routeBuckets, calculatePercentile, calculateBurnRate, getWindowBuckets, normalizeRoute, getBucketKey } from "./calculations.js";
export { checkSLOViolations, getRecentViolations } from "./violations.js";
export { getSLOStatus } from "./status.js";

import { cleanupOldBuckets } from "./calculations.js";
import { checkSLOViolations } from "./violations.js";

setInterval(cleanupOldBuckets, 60000);
setInterval(() => checkSLOViolations(), 30000);
