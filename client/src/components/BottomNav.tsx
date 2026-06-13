import { useEffect } from "react";
import { pruneOverrideToPolicyIds } from "@/application/navigation/role-navigation-policy";
import {
  readUserRole,
  readNavOverride,
  writeNavOverride,
  clearNavOverride,
} from "@/infrastructure/navigation/nav-storage";
import { BOTTOM_NAV_OVERRIDE_STORAGE_KEY } from "@/config/roles";
import { MobileReadinessBottomNav } from "@/features/mobile-readiness/MobileReadinessScreens";

/**
 * Mobile readiness bottom navigation.
 *
 * The legacy four-tab admin launcher has been replaced by the Figma-aligned
 * role-specific ARUS nav. The stale override self-heal remains because the
 * stored value is still a cache and must never retain unauthorized hub ids.
 */
void BOTTOM_NAV_OVERRIDE_STORAGE_KEY;

export function BottomNav() {
  const roleId = readUserRole();
  const override = readNavOverride();

  useEffect(() => {
    if (!override) {
      return;
    }
    const pruned = pruneOverrideToPolicyIds(roleId, override);
    if (pruned === null) {
      return;
    }
    if (pruned.length === 0) {
      clearNavOverride();
    } else {
      writeNavOverride(pruned);
    }
  }, [override, roleId]);

  return <MobileReadinessBottomNav />;
}
