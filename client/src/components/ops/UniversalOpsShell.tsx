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
import { OpsStatusRail } from "./OpsStatusRail"; // Phase 1 remediation import

interface UniversalOpsShellProps {
  currentPath: string;
  activeHubId?: string | null;
  children: ReactNode;
}

// ... (rest of the helper functions remain unchanged: splitPath, routeMatches, childIsActive, buildSidebarItems, BrandMark, UniversalSubnav, UniversalMobileDrawer)

// Keeping the existing helper functions as-is for minimal diff

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
      data-mobile-horizontal-nav="true"
      data-overflow-affordance="edge-fade"
      aria-label="Hub navigation"
    >
      <div className="relative -mx-3 md:mx-0">
        <div
          className="flex scroll-px-3 gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:px-0"
          data-horizontal-scrollport="true"
          data-testid="universal-ops-subnav-scroll"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const active = childIsActive(currentPath, item);
            return (
              <Link
                key={`${item.name}-${item.href}`}
                href={item.href}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors md:min-h-9 md:text-xs",
                  active
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/70 bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
                data-testid={`universal-ops-subnav-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 md:h-3.5 md:w-3.5" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 right-0 top-0 w-8 bg-gradient-to-l from-background via-background/85 to-transparent md:hidden"
        />
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
          className="h-11 w-11 md:hidden"
          aria-label="Open admin navigation"
          data-testid="universal-ops-mobile-menu-trigger"
        >
          <Menu className="h-5 w-5" />
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

// Main UniversalOpsShell component
export function UniversalOpsShell({
  currentPath,
  activeHubId,
  children,
}: UniversalOpsShellProps) {
  const { hasPermission } = usePermissions();

  const navModel = buildUniversalOpsNavModel({
    currentPath,
    hasAdminAccess: hasPermission("admin:access"),
    hasSuperAdminAccess: hasPermission("superadmin:access"),
  });

  const sidebarItems = buildSidebarItems({
    currentPath,
    activeHubId: activeHubId ?? null,
    primaryHubs: navModel.primaryHubs,
  });

  const activeChildren =
    activeHubId
      ? navModel.primaryHubs.find((h) => h.id === activeHubId)?.children ?? []
      : [];

  // Phase 1: Basic props for OpsStatusRail (full wiring in follow-up)
  // In production these would come from real contexts (attention, outbox, handover, sensors)
  const railProps = {
    risks: [], // TODO: wire from attention inbox / AI findings
    outboxCount: 0, // TODO: wire from offline outbox
    outboxHasConflict: false,
    handoverMinutes: undefined, // TODO: wire from handover queue
    isVesselLocal: true, // TODO: from mode context
    cachedSensors: 2, // TODO: from sensor health
    onAction: (action: string, payload?: any) => {
      console.log("[OpsStatusRail] action:", action, payload);
      // TODO: implement real handlers (create WO, open outbox, open briefing, etc.)
    },
  };

  return (
    <div className="flex h-screen flex-col bg-background" data-testid="universal-ops-shell">
      <OpsTopBar currentPath={currentPath} />

      {/* Phase 1: Persistent Ops Status Rail - inserted right after top bar for maximum visibility */}
      <OpsStatusRail {...railProps} />

      <UniversalSubnav currentPath={currentPath} items={activeChildren} />

      <div className="flex flex-1 overflow-hidden">
        <OpsSidebar items={sidebarItems} />

        <OpsShell>
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </div>
        </OpsShell>
      </div>

      <div className="md:hidden">
        <UniversalMobileDrawer
          currentPath={currentPath}
          sidebarItems={sidebarItems}
          activeChildren={activeChildren}
        />
      </div>
    </div>
  );
}
