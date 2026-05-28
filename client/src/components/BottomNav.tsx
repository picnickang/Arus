import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { navigationCategories, routeMigrations, type NavigationCategory } from "@/config/navigationConfig";
import {
  getPortalForRole,
  intersectOverrideWithPolicy,
  pruneOverrideToPolicyIds,
} from "@/application/navigation/role-navigation-policy";
import {
  readUserRole,
  readNavOverride,
  writeNavOverride,
  clearNavOverride,
} from "@/infrastructure/navigation/nav-storage";
import { BOTTOM_NAV_OVERRIDE_STORAGE_KEY } from "@/config/roles";
import { Home, MoreHorizontal, X } from "lucide-react";

/**
 * Per-user override of which category ids appear in the bottom nav.
 *
 * Treated strictly as CACHE / personalisation — never authority.
 * The policy layer (`intersectOverrideWithPolicy`) drops any id the
 * role is not allowed to see before the component renders. That is
 * the security perimeter that stops a stale or tampered
 * localStorage value from leaking admin categories into a
 * user-portal session (follow-up #194).
 *
 * All storage I/O for the override + role hint goes through the
 * `@/infrastructure/navigation/nav-storage` adapter — this component
 * does not call `localStorage` directly. The `BOTTOM_NAV_OVERRIDE_STORAGE_KEY`
 * import is kept as a regression sentinel pinned by the #194 test
 * suite (proves the same key the adapter writes is the same key
 * SwitchPortalButton clears).
 */
void BOTTOM_NAV_OVERRIDE_STORAGE_KEY;

export function BottomNav() {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);

  const roleId = readUserRole();
  const override = readNavOverride();
  const portal = getPortalForRole(roleId);

  // Visibility policy lives in the application layer — this component
  // only renders whatever the policy returns. The intersect helper
  // guarantees the override may only reorder / subset the role's
  // allowed categories, never expand them.
  const visibleCategories: NavigationCategory[] = intersectOverrideWithPolicy(
    roleId,
    override,
  );

  // Self-heal: if the stored override contains any id the current
  // role is not allowed to see, rewrite the storage with the pruned
  // list (or remove it entirely when nothing survives). Without this,
  // a stale admin override would silently follow the user across
  // portal switches and be observable to any other surface that reads
  // the raw key — even though the intersect helper would still drop
  // the disallowed ids at render time, defence-in-depth requires that
  // the persisted value never contain disallowed ids in the first
  // place.
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

  // Render gate (#218): the user portal exposes only Dashboard (`/`)
  // and Feedback (`/feedback`). With the hardcoded Home button also
  // routing to `/`, three of four tap targets become redundant and
  // the "More" sheet reveals nothing new. Hide the bar entirely for
  // user-portal roles and reclaim the ~56px vertical strip.
  //
  // Hooks above must still run unconditionally — the override
  // self-heal (#194) must keep working even for users who never see
  // the bar, so a stale admin override left over from a portal switch
  // is still pruned out of localStorage.
  if (portal === "user") {
    return null;
  }

  // After the #218 render gate above, the only code path that
  // reaches here is `portal === "admin"`, so the "More" sheet always
  // shows the full admin category surface. The user-portal branch
  // is intentionally unreachable now (kept as a comment so the
  // intent stays documented for the next reader).
  const moreSheetCategories: NavigationCategory[] = navigationCategories;

  const currentPath = location.split("?")[0] ?? "";

  const isCategoryActive = (category: NavigationCategory) => {
    if (currentPath === category.hubRoute || currentPath.startsWith(`${category.hubRoute}/`)) {
      return true;
    }

    if (category.children.some((item) => currentPath === item.href || currentPath.startsWith(`${item.href}/`))) {
      return true;
    }

    const migrated = routeMigrations[currentPath];
    return Boolean(migrated && migrated.startsWith(category.hubRoute));
  };

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-border/60 bg-slate-950/95 p-4 pb-safe text-foreground backdrop-blur-xl animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">All Categories</h3>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 rounded-lg hover:bg-muted touch-target"
                data-testid="button-close-more"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {moreSheetCategories.map((cat) => {
                const Icon = cat.icon;
                const active = isCategoryActive(cat);
                return (
                  <Link key={cat.id} href={cat.hubRoute}>
                    <div
                      onClick={() => setShowMore(false)}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl p-3 transition-colors",
                        active
                          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/40"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                      data-testid={`link-category-${cat.id}`}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-[10px] font-medium text-center leading-tight">
                        {cat.name}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-slate-950/90 pb-safe text-foreground shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl md:hidden"
        role="navigation"
        aria-label="Bottom navigation"
        data-testid="bottom-nav"
      >
        <div className="flex items-center justify-around h-14 px-1">
          <Link href="/">
            <div
              className={cn(
                "flex min-w-[48px] cursor-pointer flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors",
                location === "/"
                  ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="link-nav-home"
            >
              <Home className={cn("h-5 w-5", location === "/" && "fill-primary/20")} />
              <span className="text-[10px] font-medium">Home</span>
            </div>
          </Link>

          {visibleCategories.map((cat) => {
            const Icon = cat.icon;
            const active = isCategoryActive(cat);
            return (
              <Link key={cat.id} href={cat.hubRoute}>
                <div
                  className={cn(
                    "flex min-w-[48px] cursor-pointer flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors",
                    active
                      ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`link-nav-${cat.id}`}
                >
                  <Icon className={cn("h-5 w-5", active && "fill-primary/20")} />
                  <span className="text-[10px] font-medium">{cat.name}</span>
                </div>
              </Link>
            );
          })}

          <button
            onClick={() => setShowMore(true)}
            className={cn(
              "flex min-w-[48px] cursor-pointer flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors",
              showMore
                ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="button-nav-more"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default BottomNav;
