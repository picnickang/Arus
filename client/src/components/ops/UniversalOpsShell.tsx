import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link } from "wouter";
import { LayoutGrid, Menu, Search } from "lucide-react";
import { pruneOverrideToPolicyIds } from "@/application/navigation/role-navigation-policy";
import {
  readUserRole,
  readNavOverride,
  writeNavOverride,
  clearNavOverride,
} from "@/infrastructure/navigation/nav-storage";
import {
  buildUniversalOpsNavModel,
  resolveActiveOpsHubId,
} from "@/application/navigation/universal-ops-navigation";
import { usePermissions } from "@/contexts/PermissionsContext";
import { type NavigationItem } from "@/config/navigationConfig";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OpsShell } from "./OpsShell";
import { OpsSidebar, type OpsSidebarItem } from "./OpsSidebar";
import { OpsTopBar } from "./OpsTopBar";

interface UniversalOpsShellProps {
  currentPath: string;
  activeHubId?: string | null;
  children: ReactNode;
}

function splitPath(path: string): { base: string; params: URLSearchParams } {
  const [base, query = ""] = path.split("?");
  return {
    base: (base ?? path).split("#")[0] ?? path,
    params: new URLSearchParams(query.split("#")[0] ?? ""),
  };
}

function routeMatches(currentPath: string, href: string): boolean {
  const current = splitPath(currentPath);
  const target = splitPath(href);
  if (target.params.size > 0) {
    if (current.base !== target.base) {
      return false;
    }
    for (const [key, value] of target.params) {
      if (current.params.get(key) !== value) {
        return false;
      }
    }
    return true;
  }
  return current.base === target.base || current.base.startsWith(`${target.base}/`);
}

function childIsActive(currentPath: string, child: NavigationItem): boolean {
  return routeMatches(currentPath, child.href);
}

function buildSidebarItems({
  currentPath,
  activeHubId,
  primaryHubs,
}: {
  currentPath: string;
  activeHubId: string | null;
  primaryHubs: ReturnType<typeof buildUniversalOpsNavModel>["primaryHubs"];
}): OpsSidebarItem[] {
  return primaryHubs.map((hub) => {
    const Icon = hub.icon;
    return {
      id: hub.id,
      label: hub.name,
      href: hub.hubRoute,
      icon: <Icon className="h-4 w-4" aria-hidden="true" />,
      isActive: activeHubId === hub.id || routeMatches(currentPath, hub.hubRoute),
    };
  });
}

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex flex-col items-center gap-1 text-[11px] font-semibold text-primary"
      data-testid="universal-ops-brand"
    >
      <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
        ARUS
      </span>
      <span className="text-[10px] text-muted-foreground">OPS</span>
    </Link>
  );
}

function UniversalSubnav({ currentPath, items }: { currentPath: string; items: NavigationItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      className="border-b border-border/60 bg-background/80 px-3 py-2 backdrop-blur md:px-5"
      data-testid="universal-ops-subnav"
      aria-label="Hub navigation"
    >
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = childIsActive(currentPath, item);
          return (
            <Link
              key={`${item.name}-${item.href}`}
              href={item.href}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
              data-testid={`universal-ops-subnav-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function UniversalMobileDrawer({
  currentPath,
  sidebarItems,
  activeChildren,
}: {
  currentPath: string;
  sidebarItems: OpsSidebarItem[];
  activeChildren: NavigationItem[];
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 md:hidden"
          aria-label="Open admin navigation"
          data-testid="universal-ops-mobile-menu-trigger"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="ops-surface w-[86vw] max-w-sm border-border/70 p-0"
        data-testid="universal-ops-mobile-drawer"
      >
        <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
          <SheetTitle className="text-foreground">ARUS Admin Hubs</SheetTitle>
          <SheetDescription>Open a hub or jump within the active hub.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-3 py-4">
          <nav className="space-y-1" aria-label="Admin hubs">
            {sidebarItems.map((item) => (
              <SheetClose key={item.id} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                    item.isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                  )}
                  data-testid={`universal-ops-drawer-hub-${item.id}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </SheetClose>
            ))}
          </nav>

          {activeChildren.length > 0 && (
            <div>
              <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
                Active Hub
              </p>
              <nav className="mt-2 space-y-1" aria-label="Active hub links">
                {activeChildren.map((child) => {
                  const Icon = child.icon;
                  const active = childIsActive(currentPath, child);
                  return (
                    <SheetClose key={`${child.name}-${child.href}`} asChild>
                      <Link
                        href={child.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                          active
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                        )}
                        data-testid={`universal-ops-drawer-child-${child.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{child.name}</span>
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function UniversalOpsShell({ currentPath, activeHubId, children }: UniversalOpsShellProps) {
  const { permissions } = usePermissions();

  // #194 override self-heal — mirrors BottomNav. On ops-shell routes the
  // BottomNav launcher is intentionally not mounted (App.tsx gates it on
  // `!usesUniversalOpsShell`), so its prune effect would not run here. Run
  // the same prune so a stale/tampered admin override never lingers in
  // localStorage for accounts that only ever see the ops shell.
  const navOverride = readNavOverride();
  const navRoleId = readUserRole();
  useEffect(() => {
    if (!navOverride) {
      return;
    }
    const pruned = pruneOverrideToPolicyIds(navRoleId, navOverride);
    if (pruned === null) {
      return;
    }
    if (pruned.length === 0) {
      clearNavOverride();
    } else {
      writeNavOverride(pruned);
    }
  }, [navOverride, navRoleId]);
  const resolvedHubId = activeHubId ?? resolveActiveOpsHubId(currentPath);
  const navModel = buildUniversalOpsNavModel({
    currentPath,
    hubAccess: permissions.hubAccess,
    activeHubId: resolvedHubId,
  });
  const sidebarItems = buildSidebarItems({
    currentPath,
    activeHubId: resolvedHubId,
    primaryHubs: navModel.primaryHubs,
  });
  const activeHub = navModel.activeHub;

  return (
    <OpsShell
      className="ops-surface"
      testId="universal-ops-shell"
      sidebar={
        <OpsSidebar
          variant="compact"
          brand={<BrandMark />}
          items={sidebarItems}
          testId="universal-ops-rail"
        />
      }
      topBar={
        <>
          <OpsTopBar
            leading={
              <UniversalMobileDrawer
                currentPath={currentPath}
                sidebarItems={sidebarItems}
                activeChildren={navModel.activeChildren}
              />
            }
            title={
              <span className="inline-flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" />
                {activeHub?.name ?? "ARUS Admin"}
              </span>
            }
            subtitle={activeHub?.description ?? "Universal admin hub navigation"}
            trailing={
              <span className="inline-flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => window.dispatchEvent(new CustomEvent("arus:open-command-palette"))}
                  aria-label="Search (Ctrl+K)"
                  title="Search (Ctrl+K)"
                  data-testid="button-global-search"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                </button>
                {activeHub ? (
                  <Badge variant="outline" data-testid="universal-ops-active-hub">
                    {activeHub.name}
                  </Badge>
                ) : null}
              </span>
            }
          />
          <UniversalSubnav currentPath={currentPath} items={navModel.activeChildren} />
        </>
      }
    >
      {children}
    </OpsShell>
  );
}

export default UniversalOpsShell;
