import { MobileCommandCenterPage } from "@/features/mobile-readiness/MobileReadinessScreens";
import { trackPageVisit } from "@/lib/pageTracking";
import type { RoleConfig } from "@/config/roles";

export { trackPageVisit };
export type { RoleConfig };

export default function HomePage() {
  return <MobileCommandCenterPage />;
}
