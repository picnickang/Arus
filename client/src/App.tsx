import { Switch, Route, useLocation } from "wouter";
import { queryClient, replayQueuedApiRequests } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initializeGlobalErrorHandlers } from "@/lib/errorHandler";
import { FocusModeProvider } from "@/contexts/FocusModeContext";
import { AdminAccessProvider } from "@/contexts/AdminAccessContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { PermissionsProvider, usePermissions } from "@/contexts/PermissionsContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ConnectivityBanner } from "@/components/shared/ConnectivityBanner";
import { SessionGate } from "@/components/auth/SessionGate";
import { BottomNav } from "@/components/BottomNav";
import { CopilotFab } from "@/components/agent/CopilotFab";
import { useEffect, lazy, Suspense, useState, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { isDesktop } from "@/lib/desktop";
import {
  isDesktopSetupCompleteSync,
  bootstrapDesktopBackend,
  markSetupComplete,
} from "@/lib/desktopFetch";
import { trackPageVisit } from "@/lib/pageTracking";
import { getPendingCount } from "@/lib/offline-sync";

const HomePage = lazy(() => import("@/pages/home"));
const NotFound = lazy(() => import("@/pages/not-found"));
const DesktopSetup = lazy(() => import("@/pages/desktop-setup"));
const PortalLogin = lazy(() => import("@/pages/portal-login"));
const FeedbackPage = lazy(() => import("@/pages/feedback"));

const DevPerformanceOverlay = import.meta.env.DEV
  ? lazy(() =>
      import("@/components/DevPerformanceOverlay").then((m) => ({
        default: m.DevPerformanceOverlay,
      }))
    )
  : () => null;

import { operationsRoutes } from "@/routes/operations";
import { fleetRoutes } from "@/routes/fleet";
import {
  isAdminPortalAccess,
  isSuperAdminRole,
} from "@/application/navigation/role-navigation-policy";
import { getHubIdForRoute } from "@/config/navigationConfig";
import { ROLE_STORAGE_KEY } from "@/config/roles";
import { maintenanceRoutes } from "@/routes/maintenance";
import { crewRoutes } from "@/routes/crew";
import { logisticsRoutes } from "@/routes/logistics";
import { recordsRoutes } from "@/routes/records";
import { analyticsRoutes } from "@/routes/analytics";
import { systemRoutes } from "@/routes/system";
import { legacyRedirects, trackRedirectUsage } from "@/routes/legacy-redirects";

const allRoutes = [
  ...operationsRoutes,
  ...fleetRoutes,
  ...maintenanceRoutes,
  ...crewRoutes,
  ...logisticsRoutes,
  ...recordsRoutes,
  ...analyticsRoutes,
  ...systemRoutes,
];

// path → structural-group hub id, built from the actual route arrays so every
// registered hub route is covered by construction (no manual list to drift).
// Each route group corresponds 1:1 to an admin-portal hub; this is the
// fallback classification for deep routes that are not surfaced as nav
// children (those get their user-facing hub from `getHubIdForRoute`).
const ROUTE_GROUP_HUB_BY_PATH: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const groups: Array<[string, ReadonlyArray<{ path: string }>]> = [
    ["operations", operationsRoutes],
    ["fleet", fleetRoutes],
    ["maintenance", maintenanceRoutes],
    ["crew", crewRoutes],
    ["logistics", logisticsRoutes],
    ["records", recordsRoutes],
    ["analytics", analyticsRoutes],
    ["system", systemRoutes],
  ];
  for (const [hubId, routes] of groups) {
    for (const { path } of routes) {
      map[path] = hubId;
    }
  }
  return map;
})();

/**
 * Resolve the hub a route belongs to for access gating. Prefers the
 * user-facing nav classification (`getHubIdForRoute`, from
 * `navigationCategories`) so a page is gated by the hub it is *shown under*;
 * falls back to the route's structural group. Returns null only for routes
 * outside every hub group (home, portal-login, feedback) — those are never
 * hub-gated.
 */
function resolveRouteHubId(path: string): string | null {
  return getHubIdForRoute(path) ?? ROUTE_GROUP_HUB_BY_PATH[path] ?? null;
}

function PageSkeleton() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function buildRedirectTarget(to: string): string {
  if (typeof window === "undefined") {
    return to;
  }

  const [targetPath, targetQuery = ""] = to.split("?");
  const merged = new URLSearchParams(targetQuery);
  const current = new URLSearchParams(window.location.search);

  current.forEach((value, key) => {
    if (!merged.has(key)) {
      merged.set(key, value);
    }
  });

  const query = merged.toString();
  return `${targetPath}${query ? `?${query}` : ""}${window.location.hash || ""}`;
}

function Redirect({ from, to }: { from: string; to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const target = buildRedirectTarget(to);
    trackRedirectUsage(from, target);
    setLocation(target, { replace: true });
  }, [from, to, setLocation]);
  return null;
}

/**
 * Routes that are admin-portal-only. User-portal roles
 * (`deck_officer`, `viewer`) are redirected to `/` if they try to
 * deep-link in (old bookmark, copy/pasted URL, stray in-app link).
 *
 * The server enforces the same boundary on the underlying
 * `/api/attention/*` endpoints; this client guard is a UX layer so
 * the page itself never paints for a regular user.
 */
const ADMIN_ONLY_ROUTES = new Set<string>(["/attention-inbox", "/admin/access-diagnostic"]);

function readCurrentRole(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function AdminPortalRouteGuard({
  path,
  hubId,
  children,
}: {
  path: string;
  hubId: string | null;
  children: ReactNode;
}) {
  const [, setLocation] = useLocation();
  const { permissions } = usePermissions();
  const role = readCurrentRole();
  const ready = !permissions.isLoading;
  // Tier 1 — portal access: super-admins are always-on, others need the
  // explicit hub-admin grant (dev-mode bypasses). While permissions load we
  // fall back to the legacy role→portal map so an admin's first paint is not
  // a flash-redirect.
  let allowed = isAdminPortalAccess(
    role,
    permissions.hubAdmin || permissions.isDevMode,
    ready,
  );
  // Tier 2 — per-hub allow-list: once permissions have loaded, a granted
  // (non-super-admin, non-dev) account may only reach hubs in its allow-list.
  // `permissions.hubAccess === null` means "all hubs" (super-admins / dev
  // resolve to null server-side), so only a populated list restricts access.
  if (
    allowed &&
    ready &&
    hubId &&
    !permissions.isDevMode &&
    !isSuperAdminRole(role)
  ) {
    const access = permissions.hubAccess;
    if (access && !access.includes(hubId)) {
      allowed = false;
    }
  }
  useEffect(() => {
    if (!allowed) {
      trackRedirectUsage(path, "/");
      setLocation("/", { replace: true });
    }
  }, [allowed, path, setLocation]);
  if (!allowed) {
    return null;
  }
  return <>{children}</>;
}

function useTrackPageVisit() {
  const [loc] = useLocation();
  useEffect(() => {
    if (loc !== "/") {
      trackPageVisit(loc);
    }
  }, [loc]);
}

function ConnectivityBannerWithSync() {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    const cache = queryClient.getMutationCache();
    const activeMutations = cache.getAll().filter((m) => m.state.status === "pending").length;
    const offlinePending = await getPendingCount().catch(() => 0);
    setPendingCount(activeMutations + offlinePending);
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const cache = queryClient.getMutationCache();
    const unsubscribe = cache.subscribe(() => {
      void refreshPendingCount();
    });
    const handleSyncChange = () => void refreshPendingCount();
    const handleOnline = () => {
      void replayQueuedApiRequests().finally(refreshPendingCount);
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "ARUS_SYNC_OUTBOX_REQUEST") {
        void replayQueuedApiRequests().finally(refreshPendingCount);
      }
    };
    const interval = window.setInterval(refreshPendingCount, 15000);
    window.addEventListener("arus:offline-sync-changed", handleSyncChange);
    window.addEventListener("online", handleOnline);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

    if (navigator.onLine) {
      void replayQueuedApiRequests().finally(refreshPendingCount);
    }

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("arus:offline-sync-changed", handleSyncChange);
      window.removeEventListener("online", handleOnline);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [refreshPendingCount]);
  return <ConnectivityBanner pendingSyncCount={pendingCount} />;
}

function Router() {
  const { currentOrgId, isLoading } = useOrganization();
  const { permissions } = usePermissions();
  const [routerLoc] = useLocation();
  useTrackPageVisit();

  if (isLoading || !currentOrgId) {
    return <FullPageLoader />;
  }

  const isLoginRoute = routerLoc === "/portal-login";
  // #218: the user portal has no visible BottomNav, so the ~56px
  // mobile clearance the admin portal needs becomes orphan
  // padding. Skip the `pb-14` in that case. The BottomNav
  // component itself is still mounted on every non-login route
  // (see below) — it returns null for user-portal roles but its
  // hooks still run, so the #194 override self-heal effect keeps
  // pruning stale admin ids from localStorage even when the bar
  // is invisible. Same `getPortalForRole` policy used by the
  // route guard and the bar itself; reading localStorage at
  // render is fine because portal switches do a full reload.
  const isAdminPortal =
    !isLoginRoute &&
    isAdminPortalAccess(
      readCurrentRole(),
      permissions.hubAdmin || permissions.isDevMode,
      !permissions.isLoading,
    );

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>

      <ConnectivityBannerWithSync />

      <main
        id="main-content"
        className={`min-h-screen ${isAdminPortal ? "pb-14 md:pb-0" : ""}`}
        role="main"
        aria-label="Main content"
      >
        <Suspense fallback={<PageSkeleton />}>
          <FocusModeProvider>
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/portal-login" component={PortalLogin} />
              <Route path="/feedback" component={FeedbackPage} />

              {legacyRedirects.map(({ from, to }) => (
                <Route key={from} path={from}>
                  {() => <Redirect from={from} to={to} />}
                </Route>
              ))}

              {allRoutes.map(({ path, component: Component }) => (
                <Route key={path} path={path}>
                  {(params) => {
                    const page = (
                      <ErrorBoundary key={path}>
                        <Component {...(params as object as Record<string, string>)} />
                      </ErrorBoundary>
                    );
                    const hubId = resolveRouteHubId(path);
                    const guarded = ADMIN_ONLY_ROUTES.has(path) || hubId !== null;
                    return guarded ? (
                      <AdminPortalRouteGuard path={path} hubId={hubId}>
                        {page}
                      </AdminPortalRouteGuard>
                    ) : (
                      page
                    );
                  }}
                </Route>
              ))}

              <Route component={NotFound} />
            </Switch>
          </FocusModeProvider>
        </Suspense>

        <PWAInstallPrompt />
      </main>

      {!isLoginRoute && <BottomNav />}
      {!isLoginRoute && <CopilotFab />}
    </div>
  );
}

const SETUP_TIMEOUT_MS = 10000;

function App() {
  const [setupState, setSetupState] = useState<"loading" | "setup" | "ready">(() => {
    if (!isDesktop()) {
      return "ready";
    }
    return isDesktopSetupCompleteSync() ? "ready" : "loading";
  });

  useEffect(() => {
    initializeGlobalErrorHandlers();
  }, []);

  useEffect(() => {
    if (setupState !== "loading") {
      return;
    }

    const timeout = setTimeout(() => {
      setSetupState("setup");
    }, SETUP_TIMEOUT_MS);

    bootstrapDesktopBackend().then((resolved) => {
      clearTimeout(timeout);
      setSetupState(resolved ? "ready" : "setup");
    });

    return () => clearTimeout(timeout);
  }, [setupState]);

  const handleSetupComplete = useCallback(() => {
    markSetupComplete();
    queryClient.clear();
    setSetupState("ready");
  }, []);

  if (setupState === "loading") {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="arus-ui-theme">
        <FullPageLoader />
      </ThemeProvider>
    );
  }

  if (setupState === "setup") {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="arus-ui-theme">
          <Toaster />
          <Suspense fallback={<FullPageLoader />}>
            <DesktopSetup onComplete={handleSetupComplete} />
          </Suspense>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="dark" storageKey="arus-ui-theme">
          <OrganizationProvider>
            <AdminAccessProvider>
              <SessionGate>
                <PermissionsProvider>
                  <Toaster />
                  <ErrorBoundary>
                    <Router />
                  </ErrorBoundary>
                  <Suspense fallback={null}>
                    <DevPerformanceOverlay />
                  </Suspense>
                </PermissionsProvider>
              </SessionGate>
            </AdminAccessProvider>
          </OrganizationProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
