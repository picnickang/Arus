/**
 * IP Security Tracking - Monitor and block suspicious IPs
 *
 * SonarQube Fix: Added named constants for magic numbers
 */

import { type IPSecurityInfo } from "./types";

/** Time constants for IP tracking */
const IP_TRACKING_CONSTANTS = {
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
  STALE_THRESHOLD_MS: 24 * 60 * 60 * 1000,
} as const;

export const flaggedIPs: Map<string, IPSecurityInfo> = new Map();
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Cleanup stale IP entries periodically
 */
function cleanupStaleEntries(): void {
  if (flaggedIPs.size === 0) {
    return;
  }

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - IP_TRACKING_CONSTANTS.STALE_THRESHOLD_MS);

  for (const [ip, info] of flaggedIPs.entries()) {
    const isStale = info.lastSeen < staleThreshold;
    const isUnblocked = !info.blockedUntil || info.blockedUntil < now;

    if (isStale && isUnblocked) {
      flaggedIPs.delete(ip);
    }
  }
}

if (process.env["DISABLE_SECURITY_TIMERS"] !== "true" && process.env["NODE_ENV"] !== "test") {
  cleanupInterval = setInterval(cleanupStaleEntries, IP_TRACKING_CONSTANTS.CLEANUP_INTERVAL_MS);
  cleanupInterval.unref?.();
}

/** Export for testing */
export const _internals = {
  cleanupStaleEntries,
  stopCleanupInterval: () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  },
  IP_TRACKING_CONSTANTS,
};
