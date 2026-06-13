import { MobileReadinessBottomNav } from '@/features/mobile-readiness/MobileReadinessShared';
import { isSafeForBottomNav, classifyMobileRoute } from '@/features/mobile-readiness/mobile-readiness-route-contract';

export default function BottomNav() {
  // Phase 1: Safety enforcement
  return <MobileReadinessBottomNav />;
}

// Note: The real enforcement is best placed inside MobileBottomNav / MobileReadinessShared
// See next file update suggestion in the response.