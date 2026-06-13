// Phase 2 guard integration example (add near the shell logic):
import { classifyMobileRoute, shouldBlockUniversalOpsShellForMobile } from '@/features/mobile-readiness/mobile-readiness-route-contract';

// Inside the route rendering:
const currentClassification = classifyMobileRoute(routerLoc);
const shouldUseMobileShell = isMobileContext(routerLoc) || currentClassification.status === 'mobileReplacement';

const showUniversalOpsShell = usesUniversalOpsShell && !shouldBlockUniversalOpsShellForMobile(routerLoc);

// Updated conditional:
{showUniversalOpsShell ? (
  <UniversalOpsShell />
) : shouldUseMobileShell ? (
  <MobileShell path={routerLoc} />
) : (
  // normal desktop
  <>
    {!isLoginRoute && !usesUniversalOpsShell && <BottomNav />}
  </>
)}

// Additional runtime guard (dev warning if legacy shell shown on mobile):
if (import.meta.env.DEV && usesUniversalOpsShell && isMobileContext(routerLoc)) {
  console.warn('🚨 UniversalOpsShell shown on mobile context - guard triggered');
}
