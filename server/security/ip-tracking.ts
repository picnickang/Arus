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

/**
 * Cleanup stale IP entries periodically
 */
function cleanupStaleEntries(): void {
  if (flaggedIPs.size === 0) {return;}

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

setInterval(cleanupStaleEntries, IP_TRACKING_CONSTANTS.CLEANUP_INTERVAL_MS);

/** Export for testing */
export const _internals = {
  cleanupStaleEntries,
  IP_TRACKING_CONSTANTS,
};
