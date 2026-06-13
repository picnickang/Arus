// Previous content + Phase 2 additions for UniversalOpsShell guard
export function shouldBlockUniversalOpsShellForMobile(path: string, roleHint: string | null = null): boolean {
  const classification = classifyMobileRoute(path, roleHint);
  return classification.status === 'universalAdminShell' && !classification.isSafeForMobileBottomNav;
}

export function getMobileFallbackPath(path: string): string {
  // Fallback to safe mobile landing
  return shouldBlockUniversalOpsShellForMobile(path) ? '/today' : path;
}

export function isMobileContext(path: string): boolean {
  return isMobileReadinessReplacementPath(path) || classifyMobileRoute(path).status === 'mobileReplacement';
}

// Existing functions remain...