import { MobileReadinessBottomNav } from '@/features/mobile-readiness/MobileReadinessShared';

export default function BottomNav() {
  // Consolidated: Always delegate to the rich mobile-readiness nav for md:hidden
  return <MobileReadinessBottomNav />;
}
