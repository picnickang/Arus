import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
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
import { DevPerformanceOverlay } from "@/components/DevPerformanceOverlay";
import { ConnectivityBanner } from "@/components/shared/ConnectivityBanner";
import { BottomNav } from "@/components/BottomNav";
import { CopilotFab } from "@/components/agent/CopilotFab";
import { useEffect, lazy, Suspense, useState, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { isDesktop } from "@/lib/desktop";
import { isDesktopSetupCompleteSync, bootstrapDesktopBackend, markSetupComplete } from "@/lib/desktopFetch";
import { trackPageVisit } from "@/lib/pageTracking";

const HomePage = lazy(() => import("@/pages/home"));
const NotFound = lazy(() => import("@/pages/not-found"));
const DesktopSetup = lazy(() => import("@/pages/desktop-setup"));

import { operationsRoutes } from "@/routes/operations";
import { fleetRoutes } from "@/routes/fleet";
import { maintenanceRoutes } from "@/routes/maintenance";
import { crewRoutes } from "@/routes/crew";
import { logisticsRoutes } from "@/routes/logistics";
import { recordsRoutes } from "@/routes/records";
import { analyticsRoutes } from "@/routes/analytics";
import { systemRoutes } from "@/routes/system";
import { legacyRedirects } from "@/routes/legacy-redirects";

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

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [to, setLocation]);
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

function Router() {
  const { currentOrgId, isLoading } = useOrganization();
  useTrackPageVisit();

  if (isLoading || !currentOrgId) {
    return <FullPageLoader />;
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>

      <ConnectivityBanner />

      <main
        id="main-content"
        className="min-h-screen pb-14 md:pb-0"
        role="main"
        aria-label="Main content"
      >
        <Suspense fallback={<PageSkeleton />}>
          <FocusModeProvider>
            <Switch>
              <Route path="/" component={HomePage} />

              {allRoutes.map(({ path, component: Component }) => (
                <Route key={path} path={path} component={Component} />
              ))}

              {legacyRedirects.map(({ from, to }) => (
                <Route key={from} path={from}>
                  {() => <Redirect to={to} />}
                </Route>
              ))}

              <Route component={NotFound} />
            </Switch>
          </FocusModeProvider>
        </Suspense>

        <PWAInstallPrompt />
      </main>

      <BottomNav />
      <CopilotFab />
    </div>
  );
}

function ComposeProviders({
  providers,
  children,
}: {
  providers: Array<[React.ComponentType<any>, Record<string, any>?]>;
  children: ReactNode;
}) {
  return providers.reduceRight(
    (acc, [Provider, props = {}]) => <Provider {...props}>{acc}</Provider>,
    children
  ) as JSX.Element;
}

const SETUP_TIMEOUT_MS = 10000;

function App() {
  const [setupState, setSetupState] = useState<"loading" | "setup" | "ready">(() => {
    if (!isDesktop()) return "ready";
    return isDesktopSetupCompleteSync() ? "ready" : "loading";
  });

  useEffect(() => {
    initializeGlobalErrorHandlers();
  }, []);

  useEffect(() => {
    if (setupState !== "loading") return;

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
    <ComposeProviders
      providers={[
        [QueryClientProvider, { client: queryClient }],
        [TooltipProvider],
        [ThemeProvider, { defaultTheme: "dark", storageKey: "arus-ui-theme" }],
        [OrganizationProvider],
        [AdminAccessProvider],
        [PermissionsProvider],
      ]}
    >
      <Toaster />
      <ErrorBoundary>
        <Router />
      </ErrorBoundary>
      <DevPerformanceOverlay />
    </ComposeProviders>
  );
}

export default App;
