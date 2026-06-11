import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  isAdminPortalAccess,
  pruneOverrideToPolicyIds,
} from "@/application/navigation/role-navigation-policy";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  readUserRole,
  readNavOverride,
  writeNavOverride,
  clearNavOverride,
} from "@/infrastructure/navigation/nav-storage";
import { BOTTOM_NAV_OVERRIDE_STORAGE_KEY } from "@/config/roles";
import { LayoutGrid, Bell, Flag, User, type LucideIcon } from "lucide-react";

/**
 * Per-user override of which category ids appear in the bottom nav.
 *
 * Treated strictly as CACHE / personalisation — never authority.
 * The policy layer (`intersectOverrideWithPolicy`) drops any id the
 * role is not allowed to see. That is the security perimeter that
 * stops a stale or tampered localStorage value from leaking admin
 * categories into a user-portal session (follow-up #194). The bar
 * itself now renders a fixed four-tab launcher (Figma 1:1417), so the
 * override is no longer rendered — but the self-heal below must keep
 * pruning it so a stale value never lingers in storage.
 *
 * All storage I/O for the override + role hint goes through the
 * `@/infrastructure/navigation/nav-storage` adapter — this component
 * does not call `localStorage` directly. The `BOTTOM_NAV_OVERRIDE_STORAGE_KEY`
 * import is kept as a regression sentinel pinned by the #194 test
 * suite (proves the same key the adapter writes is the same key
 * SwitchPortalButton clears).
 */
void BOTTOM_NAV_OVERRIDE_STORAGE_KEY;

interface BottomTab {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}

// Fixed admin-portal launcher tabs (Figma 1:1417). Each href is a real
// registered route; the bar owns no RBAC — hub gating lives in
// role-navigation-policy.ts and the route guards.
const TABS: BottomTab[] = [
  { id: "hubs", href: "/", label: "Hubs", icon: LayoutGrid },
  { id: "alerts", href: "/attention-inbox", label: "Alerts", icon: Bell },
  { id: "flags", href: "/feedback", label: "Flags", icon: Flag },
  { id: "profile", href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const [location] = useLocation();

  const roleId = readUserRole();
  const override = readNavOverride();
  const { permissions } = usePermissions();

  // Admin-portal access is an explicit per-account grant (hubAdmin),
  // not an automatic property of the role. While permissions load we
  // fall back to the legacy role→portal map so an existing admin's bar
  // is not blanked on first paint.
  const hasAdminAccess = isAdminPortalAccess(
    roleId,
    permissions.hubAdmin || permissions.isDevMode,
    !permissions.isLoading
  );

  // Self-heal: if the stored override contains any id the current
  // role is not allowed to see, rewrite the storage with the pruned
  // list (or remove it entirely when nothing survives). Without this,
  // a stale admin override would silently follow the user across
  // portal switches and be observable to any other surface that reads
  // the raw key — defence-in-depth requires that the persisted value
  // never contain disallowed ids in the first place.
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

  // Render gate: the bottom nav (the hub launcher) is admin-portal
  // only. Without an explicit hub-admin grant the account has no hubs
  // to launch, so we hide the bar entirely and reclaim the ~56px
  // vertical strip — same treatment the user portal got in #218.
  //
  // Hooks above must still run unconditionally — the override
  // self-heal (#194) must keep working even for accounts that never
  // see the bar, so a stale admin override left over from a revoked
  // grant is still pruned out of localStorage.
  if (!hasAdminAccess) {
    return null;
  }

  const currentPath = location.split("?")[0] ?? "";
  const isTabActive = (href: string) =>
    href === "/" ? currentPath === "/" : currentPath === href || currentPath.startsWith(`${href}/`);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-slate-950/90 pb-safe text-foreground shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl md:hidden"
      role="navigation"
      aria-label="Bottom navigation"
      data-testid="bottom-nav"
    >
      <div className="flex h-16 items-center justify-around px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab.href);
          return (
            <Link key={tab.id} href={tab.href}>
              <div
                className={cn(
                  "flex h-12 min-w-[64px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 transition-colors",
                  active
                    ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`link-nav-${tab.id}`}
              >
                <Icon className={cn("h-5 w-5", active && "fill-primary/20")} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
