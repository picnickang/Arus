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
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ConnectivityBanner } from "@/components/shared/ConnectivityBanner";
import { SessionGate } from "@/components/auth/SessionGate";
import { BottomNav } from "@/components/BottomNav";
import { CopilotFab } from "@/components/agent/CopilotFab";
import { useEffect, lazy, Suspense, useState, useCallback } from "react";
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
  const [routerLoc] = useLocation();
  useTrackPageVisit();

  if (isLoading || !currentOrgId) {
    return <FullPageLoader />;
  }

  const isLoginRoute = routerLoc === "/portal-login";

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
        className={`min-h-screen ${isLoginRoute ? "" : "pb-14 md:pb-0"}`}
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
                  {(params) => (
                    <ErrorBoundary key={path}>
                      <Component {...(params as object as Record<string, string>)} />
                    </ErrorBoundary>
                  )}
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
