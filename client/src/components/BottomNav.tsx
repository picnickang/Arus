import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { navigationCategories, getCategoryById, routeMigrations, type NavigationCategory } from "@/config/navigationConfig";
import {
  getPortalForRole,
  getPrimaryCategoriesForRole,
} from "@/application/navigation/role-navigation-policy";
import { ROLE_STORAGE_KEY } from "@/config/roles";
import { Home, MoreHorizontal, X } from "lucide-react";

/**
 * Per-user override of which category ids appear in the bottom nav.
 * When set (via a future customisation UI), it wins over the
 * role-policy default. When unset, the role-policy decides — see
 * `client/src/application/navigation/role-navigation-policy.ts`.
 */
function readOverrideCategoryIds(): string[] | null {
  const stored = localStorage.getItem("arus-bottom-nav-items");
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every((v): v is string => typeof v === "string")) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function BottomNav() {
  const [location] = useLocation();
  const [showMore, setShowMore] = useState(false);

  const roleId = localStorage.getItem(ROLE_STORAGE_KEY);
  const override = readOverrideCategoryIds();
  const portal = getPortalForRole(roleId);

  // Visibility policy lives in the application layer — this component
  // only renders whatever the policy returns. See
  // role-navigation-policy.ts for the role→category mapping.
  const visibleCategories: NavigationCategory[] = override
    ? override
        .map((id) => getCategoryById(id))
        .filter((c): c is NavigationCategory => c !== undefined)
    : getPrimaryCategoriesForRole(roleId);

  // In the simplified User Portal, the "More" sheet would leak the
  // full 8-category admin surface and defeat the simplification —
  // restrict it to the policy's visible categories.
  const moreSheetCategories: NavigationCategory[] =
    portal === "user" ? visibleCategories : navigationCategories;

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
            className="absolute bottom-0 left-0 right-0 bg-background border-t rounded-t-2xl p-4 pb-safe animate-in slide-in-from-bottom"
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
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors cursor-pointer",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted"
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
        className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t md:hidden pb-safe"
        role="navigation"
        aria-label="Bottom navigation"
        data-testid="bottom-nav"
      >
        <div className="flex items-center justify-around h-14 px-1">
          <Link href="/">
            <div
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer min-w-[48px]",
                location === "/" ? "text-primary" : "text-muted-foreground"
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
                    "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer min-w-[48px]",
                    active ? "text-primary" : "text-muted-foreground"
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
              "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer min-w-[48px]",
              showMore ? "text-primary" : "text-muted-foreground"
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
