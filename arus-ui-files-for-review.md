# ARUS Marine PdM - Main UI Files for Review

## Project Overview
Full-stack marine predictive maintenance system. React 18 + TypeScript frontend with shadcn/ui, Wouter routing, TanStack Query, Tailwind CSS. Dark mode default. Mobile-first with PWA support, Capacitor (mobile), and Tauri v2 (desktop).

## File Structure
```
client/src/
  App.tsx                    - Root component, routing, provider tree
  main.tsx                   - Entry point, PWA init
  index.css                  - Tailwind config, CSS variables, mobile utilities
  config/
    navigationConfig.ts      - Single source of truth for all navigation
  pages/
    home.tsx                 - Home page with icon grid + dock
    dashboard-improved.tsx   - Main dashboard with metrics, tables, WebSocket
    operations-hub.tsx       - Example hub page (IconGridLayout pattern)
    (60+ more pages)
  components/
    BottomNav.tsx            - Mobile bottom navigation
    ErrorBoundary.tsx        - Global error boundary with backend logging
    theme-provider.tsx       - Dark/light/system theme management
    layouts/
      IconGridLayout.tsx     - Hub page layout with icon grid + detail pane
      TabbedPageLayout.tsx   - Tabbed page layout with URL sync
      PageLoader.tsx         - Loading skeleton variants
    navigation/
      NavigationCard.tsx     - Reusable nav card with dock context menu
      PageHeader.tsx         - Sticky header with back/home buttons
    shared/
      UnifiedMetricCard.tsx  - Consolidated metric/KPI card (7 color variants, 4 display variants)
      (+ 14 more shared components)
    ui/                      - shadcn/ui primitives (40+ components)
  lib/
    queryClient.ts           - TanStack Query setup, apiRequest, cache config
```

---

## 1. `client/src/App.tsx` (411 lines)
Root component with lazy-loaded pages, provider tree, desktop setup wizard, and all routing.

```tsx
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
import { useEffect, lazy, Suspense, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isDesktop } from "@/lib/desktop";
import { BottomNav } from "@/components/BottomNav";
import { isDesktopSetupComplete, bootstrapDesktopBackend, markSetupComplete } from "@/lib/desktopFetch";

// Lazy load: All pages for better initial bundle size
const HomePage = lazy(() => import("@/pages/home"));

// Lazy load: All other pages for better performance
const Dashboard = lazy(() => import("@/pages/dashboard-improved"));
const VesselManagement = lazy(() => import("@/pages/vessel-management"));
const VesselDetail = lazy(() => import("@/pages/vessel-detail"));
const PdmEquipmentDetail = lazy(() => import("@/pages/pdm-equipment-detail"));
const AnalyticsHub = lazy(() => import("@/pages/analytics-hub"));
const SensorsHub = lazy(() => import("@/pages/sensors-hub"));
const ConfigurationHub = lazy(() => import("@/pages/configuration-hub"));
const InventoryManagement = lazy(() => import("@/pages/inventory-management"));
const VendorsPage = lazy(() => import("@/features/suppliers").then(m => ({ default: m.VendorsPage })));
const PurchaseRequestsPage = lazy(() => import("@/features/purchaseRequests").then(m => ({ default: m.PurchaseRequestsPage })));
const PRDetailPage = lazy(() => import("@/features/purchaseRequests").then(m => ({ default: m.PRDetailPage })));
const ServiceOrdersPage = lazy(() => import("@/features/serviceOrders").then(m => ({ default: m.ServiceOrdersPage })));
const ServiceRequestsPage = lazy(() => import("@/features/serviceRequests").then(m => ({ default: m.ServiceRequestsPage })));
const OptimizationTools = lazy(() => import("@/pages/optimization-tools"));
const WorkOrders = lazy(() => import("@/pages/work-orders"));
const MaintenanceSchedules = lazy(() => import("@/pages/maintenance-schedules"));
const ActionableInsights = lazy(() => import("@/pages/actionable-insights"));
// Fleet consolidated into FleetHub
const ManualTelemetryUpload = lazy(() => import("@/pages/manual-telemetry-upload"));
const CrewManagement = lazy(() => import("@/pages/crew-management"));
const CrewScheduler = lazy(() => import("@/pages/crew-scheduler"));
const SchedulePlanner = lazy(() => import("@/pages/schedule-planner"));
const HoursOfRest = lazy(() => import("@/pages/hours-of-rest"));
const DeckLogbook = lazy(() => import("@/pages/deck-logbook"));
const EngineLogbook = lazy(() => import("@/pages/engine-logbook"));
// NotificationSettings and EmailAlertsSettings consolidated into NotificationsHub
const NotificationsHub = lazy(() => import("@/pages/notifications-hub"));
const StormGeoSettings = lazy(() => import("@/pages/stormgeo-settings"));
const LogsComplianceHub = lazy(() => import("@/pages/logs-compliance-hub"));
const FuelEmissionsLog = lazy(() => import("@/pages/fuel-emissions-log"));
const VesselTrackLog = lazy(() => import("@/pages/vessel-track-log"));
const ConditionMonitoringLog = lazy(() => import("@/pages/condition-monitoring-log"));
const EquipmentRegistry = lazy(() => import("@/pages/equipment-registry"));
const SensorTemplatesPage = lazy(() => import("@/pages/sensor-templates"));
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base"));
const KnowledgeBaseChatPage = lazy(() => import("@/pages/kb-chat"));
const RagAnalyticsDashboard = lazy(() => import("@/features/kb/pages/RagAnalyticsDashboard"));
const OrganizationManagement = lazy(() => import("@/pages/organization-management"));
const SystemAdministration = lazy(() => import("@/pages/system-administration"));
const PdmPack = lazy(() => import("@/pages/pdm-pack"));
const PdmDashboard = lazy(() => import("@/pages/pdm-dashboard"));
const PdmSchedule = lazy(() => import("@/pages/pdm-schedule"));
const PdmPlatform = lazy(() => import("@/pages/pdm-platform"));
const DigitalTwin = lazy(() => import("@/pages/digital-twin"));
const Diagnostics = lazy(() => import("@/pages/DiagnosticsDashboard"));
const Equipment = lazy(() => import("@/pages/equipment"));
const MaintenanceTemplatesPage = lazy(() => import("@/pages/MaintenanceTemplatesPage"));
const MLTrainingPage = lazy(() => import("@/pages/ml-training"));
const AISensorAudits = lazy(() => import("@/pages/ai-sensor-audits"));
const AIStudioPage = lazy(() => import("@/pages/AIStudioPage"));
const GovernanceDashboard = lazy(() => import("@/pages/governance-dashboard"));
const ScheduledReports = lazy(() => import("@/pages/scheduled-reports"));
const ScheduledReportsSettings = lazy(() => import("@/pages/scheduled-reports-settings"));
const ActiveTelemetry = lazy(() => import("@/pages/active-telemetry"));
const AIHealthDashboard = lazy(() => import("@/pages/ai-health-dashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Consolidated Hub Pages (Phase 4 UX Consolidation)
const MaintenanceHub = lazy(() => import("@/pages/maintenance-hub"));
const CrewHub = lazy(() => import("@/pages/crew-hub"));
const LogsHub = lazy(() => import("@/pages/logs-hub"));
const OperationsHub = lazy(() => import("@/pages/operations-hub"));
const FleetHub = lazy(() => import("@/pages/fleet-hub"));
const LogisticsHub = lazy(() => import("@/pages/logistics-hub"));
const SystemHub = lazy(() => import("@/pages/system-hub"));
const DesktopSetup = lazy(() => import("@/pages/desktop-setup"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Redirect component for legacy routes
function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to);
  }, [to, setLocation]);
  return null;
}

function useTrackPageVisit() {
  const [loc] = useLocation();
  useEffect(() => {
    if (loc !== "/") {
      import("@/pages/home").then(m => m.trackPageVisit(loc));
    }
  }, [loc]);
}

function Router() {
  const { currentOrgId, isLoading } = useOrganization();
  useTrackPageVisit();

  if (isLoading || !currentOrgId) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Skip to main content
      </a>

      <main
        id="main-content"
        className="min-h-screen pb-14 md:pb-0"
        role="main"
        aria-label="Main content"
      >
        <Suspense fallback={<PageLoader />}>
          <Switch>
            {/* Home Page - Navigation Hub */}
            <Route path="/" component={HomePage} />
            
            {/* Dashboard - moved from / to /dashboard */}
            <Route path="/dashboard" component={Dashboard} />
                        <Route path="/vessels/:id" component={VesselDetail} />
            <Route path="/vessel-management" component={VesselManagement} />
            <Route path="/pdm/equipment/:equipmentId" component={PdmEquipmentDetail} />
            <Route path="/pdm/schedule" component={PdmSchedule} />
            <Route path="/equipment" component={Equipment} />
            <Route path="/diagnostics">{() => <Diagnostics />}</Route>
            <Route path="/actionable-insights" component={ActionableInsights} />
            <Route path="/active-telemetry" component={ActiveTelemetry} />
            <Route path="/ai-health" component={AIHealthDashboard} />

              {/* Consolidated Analytics Hub */}
              <Route path="/analytics" component={AnalyticsHub} />

              {/* Legacy Analytics Routes - Redirect to Analytics Hub with new consolidated tabs */}
              <Route path="/cost-savings">
                {() => <Redirect to="/analytics?tab=financial-reports" />}
              </Route>
              
              {/* AI Studio - Feature flagged route */}
              {isFeatureEnabled('mlAiStudio') && (
                <Route path="/ml-ai" component={AIStudioPage} />
              )}
              
              {/* Legacy ML/AI redirects - only used if feature flag is disabled */}
              {!isFeatureEnabled('mlAiStudio') && (
                <>
                  <Route path="/ml-ai">{() => <Redirect to="/ai-health?tab=training" />}</Route>
                  <Route path="/ml-training">
                    {() => <Redirect to="/ai-health?tab=training" />}
                  </Route>
                </>
              )}
              <Route path="/model-performance">
                {() => <Redirect to="/ai-health?tab=performance" />}
              </Route>
              <Route path="/ml-explainability">
                {() => <Redirect to="/ai-health?tab=performance" />}
              </Route>
              <Route path="/ai-insights">
                {() => <Redirect to="/ai-health?tab=insights" />}
              </Route>
              <Route path="/prediction-feedback">
                {() => <Redirect to="/ai-health?tab=insights" />}
              </Route>
              <Route path="/llm-costs">
                {() => <Redirect to="/analytics?tab=financial-reports" />}
              </Route>
              <Route path="/reports">
                {() => <Redirect to="/analytics?tab=financial-reports" />}
              </Route>

              {/* Consolidated Sensors Hub */}
              <Route path="/sensors" component={SensorsHub} />

              {/* Legacy Sensor Routes - Redirect to Sensors Hub with tab param */}
              <Route path="/sensor-config">
                {() => <Redirect to="/sensors?tab=configuration" />}
              </Route>
              <Route path="/sensor-optimization">
                {() => <Redirect to="/sensors?tab=optimization" />}
              </Route>
              <Route path="/sensor-management">
                {() => <Redirect to="/sensors?tab=management" />}
              </Route>

              {/* Consolidated Configuration Hub */}
              <Route path="/configuration">{() => <ConfigurationHub />}</Route>

              {/* Legacy Configuration Routes - Redirect to Configuration Hub with tab param */}
              <Route path="/settings">
                {() => <Redirect to="/configuration?tab=system-settings" />}
              </Route>
              <Route path="/transport-settings">
                {() => <Redirect to="/configuration?tab=data-transport" />}
              </Route>
              <Route path="/storage-settings">
                {() => <Redirect to="/configuration?tab=storage" />}
              </Route>
              <Route path="/operating-parameters">
                {() => <Redirect to="/configuration?tab=operating-parameters" />}
              </Route>

              {/* ============================================================= */}
              {/* CONSOLIDATED HUBS (Phase 4 UX Consolidation)                  */}
              {/* ============================================================= */}

              {/* New Hub Pages - Category-based Navigation */}
              <Route path="/operations" component={OperationsHub} />
              <Route path="/fleet" component={FleetHub} />
              <Route path="/logistics" component={LogisticsHub} />
              <Route path="/system" component={SystemHub} />

              {/* Consolidated Maintenance Hub */}
              <Route path="/maint" component={MaintenanceHub} />

              {/* Work Orders - main page with service & parts requests integration */}
              <Route path="/work-orders" component={WorkOrders} />
              <Route path="/maintenance" component={MaintenanceSchedules} />
              <Route path="/maintenance-templates" component={MaintenanceTemplatesPage} />
              <Route path="/pdm-pack" component={PdmPack} />
              <Route path="/pdm-dashboard" component={PdmDashboard} />
              <Route path="/pdm-platform" component={PdmPlatform} />
              <Route path="/digital-twin" component={DigitalTwin} />
              <Route path="/inventory-management" component={InventoryManagement} />
              <Route path="/vendors" component={VendorsPage} />
              <Route path="/suppliers">{() => <Redirect to="/vendors" />}</Route>
              <Route path="/service-providers">{() => <Redirect to="/vendors" />}</Route>
              <Route path="/purchase-requests" component={PurchaseRequestsPage} />
              <Route path="/purchase-requests/:id" component={PRDetailPage} />
              
              {/* Purchase Orders redirects to unified Purchasing tab */}
              <Route path="/purchase-orders">{() => <Redirect to="/purchase-requests" />}</Route>
              <Route path="/purchase-orders/:id">{() => <Redirect to="/purchase-requests" />}</Route>
              
              {/* TOP-LEVEL: Service Orders (work execution view) */}
              <Route path="/service-orders" component={ServiceOrdersPage} />
              
              {/* Service Requests - detail page, list redirects to Requests & Work */}
              <Route path="/service-requests" component={ServiceRequestsPage} />
              
              <Route path="/optimization-tools" component={OptimizationTools} />

              {/* Consolidated Crew Hub */}
              <Route path="/crew" component={CrewHub} />

              {/* Legacy Crew Routes - Keep working but also accessible via hub */}
              <Route path="/crew-management" component={CrewManagement} />
              <Route path="/crew-scheduler" component={CrewScheduler} />
              <Route path="/schedule-planner" component={SchedulePlanner} />
              <Route path="/schedule-generator">{() => <Redirect to="/schedule-planner" />}</Route>
              <Route path="/hours-of-rest" component={HoursOfRest} />
              
              {/* Consolidated Logs Hub */}
              <Route path="/logs" component={LogsHub} />

              {/* Legacy Logbook Routes - Keep working but also accessible via hub */}
              <Route path="/deck-logbook" component={DeckLogbook} />
              <Route path="/engine-logbook" component={EngineLogbook} />
              
              {/* Notifications Hub - consolidated email alerts, preferences, templates */}
              <Route path="/notifications" component={NotificationsHub} />
              {/* Legacy Notification Routes - Redirect to Notifications Hub */}
              <Route path="/notification-settings">{() => <Redirect to="/notifications" />}</Route>
              <Route path="/email-alerts-settings">{() => <Redirect to="/notifications" />}</Route>
              <Route path="/stormgeo-settings" component={StormGeoSettings} />
              
              {/* Legacy Logs & Compliance Routes - Keep working but also accessible via hub */}
              <Route path="/logs-compliance" component={LogsComplianceHub} />
              <Route path="/fuel-emissions-log" component={FuelEmissionsLog} />
              <Route path="/vessel-track-log" component={VesselTrackLog} />
              <Route path="/condition-monitoring-log" component={ConditionMonitoringLog} />

              {/* Other Routes */}
              {/* Legacy Equipment Routes - Redirect to consolidated Equipment page */}
              <Route path="/equipment-registry">{() => <Redirect to="/equipment" />}</Route>
              <Route path="/health-monitor">{() => <Redirect to="/equipment" />}</Route>
              <Route path="/health">{() => <Redirect to="/equipment" />}</Route>
              <Route path="/sensor-templates" component={SensorTemplatesPage} />
              <Route path="/knowledge-base" component={KnowledgeBasePage} />
              <Route path="/kb-chat" component={KnowledgeBaseChatPage} />
              <Route path="/kb-analytics" component={RagAnalyticsDashboard} />
              <Route path="/organization-management" component={OrganizationManagement} />
              <Route path="/system-administration" component={SystemAdministration} />
              <Route path="/ai-sensor-audits" component={AISensorAudits} />
              <Route path="/telemetry-upload" component={ManualTelemetryUpload} />
              {/* Legacy Fleet Routes - redirect to consolidated pages */}
              <Route path="/fleet-overview">{() => <Redirect to="/vessel-management" />}</Route>
              <Route path="/bridge-view">{() => <Redirect to="/fleet" />}</Route>
              
              {/* Legacy Alerts Route - redirect to Dashboard (includes alerts) */}
              <Route path="/alerts">{() => <Redirect to="/dashboard" />}</Route>
              <Route path="/governance-dashboard" component={GovernanceDashboard} />
              <Route path="/governance">{() => <Redirect to="/governance-dashboard" />}</Route>
              <Route path="/scheduled-reports" component={ScheduledReports} />
              <Route path="/scheduled-reports-settings" component={ScheduledReportsSettings} />

            {/* 404 */}
            <Route component={NotFound} />
          </Switch>
        </Suspense>


        {/* PWA Install Prompt */}
        <PWAInstallPrompt />
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  const [setupState, setSetupState] = useState<'loading' | 'setup' | 'ready'>(() => {
    if (!isDesktop()) return 'ready';
    return isDesktopSetupComplete() ? 'ready' : 'loading';
  });

  useEffect(() => {
    initializeGlobalErrorHandlers();
  }, []);

  useEffect(() => {
    if (setupState !== 'loading') return;
    bootstrapDesktopBackend().then((resolved) => {
      setSetupState(resolved ? 'ready' : 'setup');
    });
  }, [setupState]);

  const handleSetupComplete = useCallback(() => {
    markSetupComplete();
    queryClient.clear();
    setSetupState('ready');
  }, []);

  if (setupState === 'loading') {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="arus-ui-theme">
        <PageLoader />
      </ThemeProvider>
    );
  }

  if (setupState === 'setup') {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="arus-ui-theme">
          <Toaster />
          <Suspense fallback={<PageLoader />}>
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
              <PermissionsProvider>
                <FocusModeProvider>
                  <Toaster />
                  <ErrorBoundary>
                    <Router />
                  </ErrorBoundary>
                  <DevPerformanceOverlay />
                </FocusModeProvider>
              </PermissionsProvider>
            </AdminAccessProvider>
          </OrganizationProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
```

---

## 2. `client/src/main.tsx` (43 lines)

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress Vite HMR WebSocket unhandled rejections in development
if (import.meta.env.DEV) {
  globalThis.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('string did not match')) {
      event.preventDefault();
    }
  });
}

// Initialize PWA functionality
import { pwaManager } from "./utils/pwa";

// Initialize PWA functionality
pwaManager.initialize().catch((error) => {
  console.error("Failed to initialize PWA:", error);
});

// Setup PWA event handlers
pwaManager.onInstallPrompt((prompt) => {
  console.info("PWA install prompt available");
  // Store prompt for later use in UI
  (window as unknown as { pwaInstallPrompt: BeforeInstallPromptEvent }).pwaInstallPrompt = prompt;
});

pwaManager.onInstalled(() => {
  console.info("PWA installed successfully");
});

pwaManager.onOnlineChange((online) => {
  console.info("Connection status changed:", online ? "online" : "offline");
});

pwaManager.onUpdateAvailable(() => {
  console.info("PWA update available");
});

createRoot(document.getElementById("root")!).render(<App />);
```

---

## 3. `client/src/index.css` (331 lines)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: hsl(0, 0%, 100%);
  --foreground: hsl(220, 13%, 9%);
  --card: hsl(0, 0%, 100%);
  --card-foreground: hsl(220, 13%, 9%);
  --popover: hsl(0, 0%, 100%);
  --popover-foreground: hsl(220, 13%, 9%);
  --primary: hsl(197, 71%, 52%);
  --primary-foreground: hsl(0, 0%, 100%);
  --secondary: hsl(220, 7%, 95%);
  --secondary-foreground: hsl(220, 13%, 9%);
  --muted: hsl(220, 7%, 96%);
  --muted-foreground: hsl(220, 9%, 40%);
  --accent: hsl(197, 71%, 52%);
  --accent-foreground: hsl(0, 0%, 100%);
  --destructive: hsl(0, 75%, 60%);
  --destructive-foreground: hsl(0, 0%, 100%);
  --border: hsl(220, 7%, 85%);
  --input: hsl(220, 7%, 85%);
  --ring: hsl(197, 71%, 52%);
  --chart-1: hsl(197, 71%, 52%);
  --chart-2: hsl(43, 96%, 56%);
  --chart-3: hsl(142, 76%, 36%);
  --chart-4: hsl(280, 87%, 47%);
  --chart-5: hsl(14, 100%, 57%);
  --sidebar: hsl(220, 7%, 98%);
  --sidebar-foreground: hsl(220, 13%, 9%);
  --sidebar-primary: hsl(197, 71%, 52%);
  --sidebar-primary-foreground: hsl(0, 0%, 100%);
  --sidebar-accent: hsl(197, 71%, 96%);
  --sidebar-accent-foreground: hsl(220, 13%, 9%);
  --sidebar-border: hsl(220, 7%, 85%);
  --sidebar-ring: hsl(197, 71%, 52%);
  --font-sans: "Inter", system-ui, sans-serif;
  --font-serif: Georgia, serif;
  --font-mono: Menlo, monospace;
  --radius: 0.5rem;
  --shadow-2xs: 0px 2px 0px 0px hsl(197, 71%, 52% / 0);
  --shadow-xs: 0px 2px 0px 0px hsl(197, 71%, 52% / 0);
  --shadow-sm: 0px 2px 0px 0px hsl(197, 71%, 52% / 0), 0px 1px 2px -1px hsl(197, 71%, 52% / 0);
  --shadow: 0px 2px 0px 0px hsl(197, 71%, 52% / 0), 0px 1px 2px -1px hsl(197, 71%, 52% / 0);
  --shadow-md: 0px 2px 0px 0px hsl(197, 71%, 52% / 0), 0px 2px 4px -1px hsl(197, 71%, 52% / 0);
  --shadow-lg: 0px 2px 0px 0px hsl(197, 71%, 52% / 0), 0px 4px 6px -1px hsl(197, 71%, 52% / 0);
  --shadow-xl: 0px 2px 0px 0px hsl(197, 71%, 52% / 0), 0px 8px 10px -1px hsl(197, 71%, 52% / 0);
  --shadow-2xl: 0px 2px 0px 0px hsl(197, 71%, 52% / 0);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

.dark {
  --background: hsl(220, 13%, 9%);
  --foreground: hsl(220, 9%, 95%);
  --card: hsl(220, 13%, 11%);
  --card-foreground: hsl(220, 9%, 95%);
  --popover: hsl(220, 13%, 11%);
  --popover-foreground: hsl(220, 9%, 95%);
  --primary: hsl(197, 71%, 52%);
  --primary-foreground: hsl(220, 9%, 5%);
  --secondary: hsl(220, 7%, 18%);
  --secondary-foreground: hsl(220, 9%, 95%);
  --muted: hsl(220, 7%, 15%);
  --muted-foreground: hsl(220, 9%, 65%);
  --accent: hsl(197, 71%, 45%);
  --accent-foreground: hsl(220, 9%, 95%);
  --destructive: hsl(0, 75%, 60%);
  --destructive-foreground: hsl(220, 9%, 95%);
  --border: hsl(220, 7%, 20%);
  --input: hsl(220, 7%, 20%);
  --ring: hsl(197, 71%, 52%);
  --chart-1: hsl(197, 71%, 52%);
  --chart-2: hsl(43, 96%, 56%);
  --chart-3: hsl(142, 76%, 36%);
  --chart-4: hsl(280, 87%, 47%);
  --chart-5: hsl(14, 100%, 57%);
  --sidebar: hsl(220, 13%, 11%);
  --sidebar-foreground: hsl(220, 9%, 95%);
  --sidebar-primary: hsl(197, 71%, 52%);
  --sidebar-primary-foreground: hsl(220, 9%, 5%);
  --sidebar-accent: hsl(197, 71%, 45%);
  --sidebar-accent-foreground: hsl(220, 9%, 95%);
  --sidebar-border: hsl(220, 7%, 20%);
  --sidebar-ring: hsl(197, 71%, 52%);
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply font-sans antialiased bg-background text-foreground;
  }

  /* Safe area support for mobile devices */
  @supports (padding: max(0px)) {
    .safe-top {
      padding-top: max(1rem, env(safe-area-inset-top));
    }

    .safe-left {
      padding-left: max(1rem, env(safe-area-inset-left));
    }

    .safe-right {
      padding-right: max(1rem, env(safe-area-inset-right));
    }
  }
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
}

.status-healthy {
  background-color: hsl(var(--chart-3));
}

.status-warning {
  background-color: hsl(var(--chart-2));
}

.status-critical {
  background-color: hsl(var(--destructive));
}

.status-offline {
  background-color: hsl(var(--muted-foreground));
}

.metric-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) + 2px);
  padding: 1.5rem;
  transition: all 0.2s ease;
}

.metric-card:hover {
  border-color: hsl(var(--accent));
  box-shadow: 0 4px 12px hsl(var(--accent) / 0.1);
}

/* Mobile-first responsive design improvements */
@layer components {
  /* Touch device optimizations */
  @media (hover: none) and (pointer: coarse) {
    button,
    [role="button"],
    input,
    select,
    textarea {
      min-height: 44px;
      min-width: 44px;
    }

    .hover\:scale-105:hover {
      transform: none;
    }

    * {
      -webkit-overflow-scrolling: touch;
    }
  }

  /* Mobile viewport optimizations */
  @media (max-width: 768px) {
    body {
      font-size: 16px;
      line-height: 1.5;
    }

    .container {
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .mobile-table {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .mobile-table table {
      min-width: 600px;
    }

    .mobile-card {
      margin-bottom: 0.75rem;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
  }

  /* PWA-specific styles */
  @media (display-mode: standalone) {
    body {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }
  }

  .touch-target {
    @apply min-h-[44px] min-w-[44px] flex items-center justify-center;
  }

  .touch-button {
    @apply touch-target px-6 py-3 text-base font-medium rounded-lg transition-colors active:scale-95;
  }

  .touch-input {
    @apply min-h-[44px] px-4 text-base rounded-lg border;
  }

  .mobile-container {
    @apply px-4 py-2 lg:px-6 lg:py-4;
  }

  .mobile-spacing {
    @apply space-y-4 lg:space-y-6;
  }

  .mobile-grid {
    @apply grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4;
  }

  .bottom-nav-safe {
    padding-bottom: max(6rem, calc(4rem + env(safe-area-inset-bottom) + 2rem));
  }

  @media (min-width: 768px) {
    .bottom-nav-safe {
      padding-bottom: 0;
    }
  }

  .fab-mobile {
    @apply bottom-24 md:bottom-8 right-4;
  }

  .mobile-scroll-container {
    @apply overflow-x-auto pb-4 -mx-4 px-4 md:overflow-visible md:mx-0 md:px-0;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .mobile-scroll-container::-webkit-scrollbar {
    display: none;
  }

  .mobile-scroll-items {
    @apply flex gap-4 md:grid md:gap-6;
  }

  .mobile-scroll-item {
    @apply flex-shrink-0 w-[280px] md:w-auto;
  }

  .touch-critical {
    @apply min-h-[56px] min-w-[56px];
  }

  /* Marine environment - outdoor readability */
  @media (prefers-contrast: high) {
    :root {
      --primary: hsl(197, 100%, 60%);
      --destructive: hsl(0, 100%, 70%);
      --border: hsl(220, 7%, 30%);
    }
  }

  .safe-bottom,
  .pb-safe {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }

  .mobile-form-field {
    @apply mb-6 md:mb-4;
  }

  .mobile-input {
    @apply h-12 text-base md:h-10 md:text-sm;
  }

  .mobile-select {
    @apply h-12 text-base md:h-10 md:text-sm;
  }

  .mobile-textarea {
    @apply min-h-[120px] text-base md:min-h-[80px] md:text-sm;
  }

  .mobile-label {
    @apply text-base font-medium mb-2 md:text-sm;
  }

  .sticky-form-actions {
    @apply sticky bottom-16 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 mt-6 -mx-4 md:static md:border-0 md:p-0 md:mt-4 md:mx-0;
  }

  @media (min-width: 768px) {
    .sticky-form-actions-with-nav {
      position: static;
    }
  }
}
```

---

## 4. `client/src/config/navigationConfig.ts` (305 lines)

```tsx
import {
  Gauge, Ship, Wrench, BarChart3, Settings, Bell, Server, AlertCircle,
  Zap, Package, Users, ClipboardCheck, TrendingUp, LayoutDashboard,
  Shield, Activity, Building, Lightbulb, Boxes, ShoppingCart, Truck,
  Database, SlidersHorizontal, BookOpen, Clipboard, Anchor, Bot, Box,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  resource?: string;
}

export interface NavigationCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  hubRoute: string;
  description: string;
  children: NavigationItem[];
  resource?: string;
}

export const routeResourceMap: Record<string, string> = {
  "/dashboard": "dashboard",
  "/active-telemetry": "sensors",
  "/alerts": "alerts",
  "/actionable-insights": "ai_reports",
  "/governance-dashboard": "compliance_reports",
  "/diagnostics": "system_settings",
  "/fleet": "vessels",
  "/fleet-overview": "vessels",
  "/vessel-management": "vessels",
  "/equipment": "equipment",
  "/health": "equipment",
  "/maint": "work_orders",
  "/work-orders": "work_orders",
  "/maintenance": "maintenance_schedules",
  "/maintenance-templates": "maintenance_templates",
  "/pdm-pack": "predictive_maintenance",
  "/pdm-dashboard": "predictive_maintenance",
  "/pdm-platform": "predictive_maintenance",
  "/digital-twin": "predictive_maintenance",
  "/crew": "crew_members",
  "/crew-management": "crew_members",
  "/crew-scheduler": "crew_schedules",
  "/schedule-planner": "crew_schedules",
  "/hours-of-rest": "rest_hours",
  "/ops/schedule": "crew_schedules",
  "/logistics": "inventory",
  "/inventory-management": "inventory",
  "/purchase-orders": "purchase_requests",
  "/purchase-requests": "purchase_requests",
  "/service-orders": "service_orders",
  "/vendors": "suppliers",
  "/suppliers": "suppliers",
  "/service-providers": "suppliers",
  "/logs": "deck_logbook",
  "/logs/compliance": "compliance_reports",
  "/logs/deck": "deck_logbook",
  "/logs/engine": "engine_logbook",
  "/logs/equipment": "condition_monitoring",
  "/deck-logbook": "deck_logbook",
  "/engine-logbook": "engine_logbook",
  "/fuel-emissions-log": "engine_logbook",
  "/vessel-track-log": "deck_logbook",
  "/condition-monitoring-log": "condition_monitoring",
  "/logs-compliance": "compliance_reports",
  "/analytics": "analytics_dashboard",
  "/ai-health": "predictive_maintenance",
  "/knowledge-base": "ai_reports",
  "/ai-sensor-audits": "sensors",
  "/optimization-tools": "predictive_maintenance",
  "/system": "system_settings",
  "/configuration": "system_settings",
  "/notifications": "system_settings",
  "/organization-management": "organization_settings",
  "/sensor-templates": "sensors",
  "/sensors": "sensors",
  "/stormgeo-settings": "integrations",
  "/system-administration": "system_settings",
};

// 8 Top-Level Categories - Single Source of Truth
export const navigationCategories: NavigationCategory[] = [
  {
    id: "operations",
    name: "Operations",
    icon: Gauge,
    hubRoute: "/operations",
    description: "Dashboard, telemetry, and insights",
    children: [
      { name: "Dashboard", href: "/dashboard", icon: Gauge, description: "Overview, metrics, alerts" },
      { name: "Active Telemetry", href: "/active-telemetry", icon: Activity, description: "Live sensor streams and graphs" },
      { name: "Actionable Insights", href: "/actionable-insights", icon: Lightbulb, description: "AI recommendations" },
    ],
  },
  {
    id: "fleet",
    name: "Fleet",
    icon: Ship,
    hubRoute: "/fleet",
    description: "Vessels and equipment management",
    children: [
      { name: "Vessels", href: "/vessel-management", icon: Ship, description: "Fleet overview and vessel details" },
      { name: "Equipment", href: "/equipment", icon: Server, description: "Equipment registry and health" },
    ],
  },
  {
    id: "maintenance",
    name: "Maintenance",
    icon: Wrench,
    hubRoute: "/maint",
    description: "Work orders, schedules, and PDM",
    children: [
      { name: "Work Orders", href: "/work-orders", icon: ClipboardCheck, description: "Work order management" },
      { name: "Schedules", href: "/maintenance", icon: Wrench, description: "Maintenance schedules" },
      { name: "Templates", href: "/maintenance-templates", icon: Clipboard, description: "Maintenance templates" },
      { name: "PdM Pack", href: "/pdm-pack", icon: Zap, description: "Predictive maintenance tools" },
      { name: "PdM Dashboard", href: "/pdm-dashboard", icon: TrendingUp, description: "Risk queue & fleet health" },
      { name: "PdM Platform", href: "/pdm-platform", icon: Database, description: "Feature store, models, inference & monitoring" },
      { name: "Digital Twin", href: "/digital-twin", icon: Box, description: "Asset-level digital twins with state, residuals & scenarios" },
    ],
  },
  {
    id: "crew",
    name: "Crew",
    icon: Users,
    hubRoute: "/crew",
    description: "Crew management and scheduling",
    children: [
      { name: "Crew Management", href: "/crew-management", icon: Users, description: "Crew roster and details" },
      { name: "Schedule Planner", href: "/schedule-planner", icon: ClipboardCheck, description: "SmartPAL crew scheduling" },
      { name: "Hours of Rest", href: "/hours-of-rest", icon: Activity, description: "STCW compliance tracking" },
      { name: "Schedule Board", href: "/ops/schedule", icon: LayoutDashboard, description: "Visual schedule board" },
    ],
  },
  {
    id: "logistics",
    name: "Logistics",
    icon: Package,
    hubRoute: "/logistics",
    description: "Inventory, purchasing, and suppliers",
    children: [
      { name: "Inventory", href: "/inventory-management", icon: Boxes, description: "Parts and stock management" },
      { name: "Purchasing", href: "/purchase-requests", icon: ClipboardCheck, description: "Purchase requests & orders" },
      { name: "Service Orders", href: "/service-orders", icon: Wrench, description: "Service order management" },
      { name: "Vendors", href: "/vendors", icon: Building, description: "Suppliers & service providers" },
    ],
  },
  {
    id: "records",
    name: "Records",
    icon: Clipboard,
    hubRoute: "/logs",
    description: "Logbooks and compliance records",
    children: [
      { name: "Compliance", href: "/logs/compliance", icon: Shield, description: "Compliance & governance" },
      { name: "Deck Log", href: "/logs/deck", icon: Anchor, description: "Deck logbook & vessel track" },
      { name: "Engine Log", href: "/logs/engine", icon: Wrench, description: "Engine room & fuel" },
      { name: "Equipment Log", href: "/logs/equipment", icon: Activity, description: "Condition & decommissioned" },
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    icon: BarChart3,
    hubRoute: "/analytics",
    description: "Reports, AI, and performance tracking",
    children: [
      { name: "AI Health", href: "/ai-health", icon: TrendingUp, description: "Fleet AI status and predictions" },
      { name: "Analytics Dashboard", href: "/analytics", icon: BarChart3, description: "Reports and analytics" },
      { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, description: "Documentation and RAG" },
      { name: "KB Assistant", href: "/kb-chat", icon: Bot, description: "AI-powered knowledge assistant" },
      { name: "AI Sensor Audits", href: "/ai-sensor-audits", icon: Activity, description: "AI sensor analysis" },
      { name: "Optimizer", href: "/optimization-tools", icon: Zap, description: "Maintenance optimization tools" },
    ],
  },
  {
    id: "system",
    name: "System",
    icon: Settings,
    hubRoute: "/system",
    description: "Settings, admin, and sensors",
    children: [
      { name: "Configuration", href: "/configuration", icon: Settings, description: "System configuration" },
      { name: "Notifications", href: "/notifications", icon: Bell, description: "Email alerts, preferences & templates" },
      { name: "Organizations", href: "/organization-management", icon: Building, description: "Multi-tenant settings" },
      { name: "Sensor Templates", href: "/sensor-templates", icon: SlidersHorizontal, description: "Sensor templates" },
      { name: "Sensors", href: "/sensors", icon: Activity, description: "Sensor management" },
      { name: "StormGeo", href: "/stormgeo-settings", icon: Database, description: "Weather integration" },
      { name: "System Admin", href: "/system-administration", icon: Shield, description: "Admin tools" },
      { name: "Diagnostics", href: "/diagnostics", icon: AlertCircle, description: "System diagnostics" },
    ],
  },
];

export function getCategoryById(id: string): NavigationCategory | undefined {
  return navigationCategories.find(cat => cat.id === id);
}

const routeMigrations: Record<string, string> = {
  "/governance": "/logs/compliance",
  "/governance-dashboard": "/logs/compliance",
  "/logs-compliance": "/logs/compliance",
  "/deck-logbook": "/logs/deck",
  "/vessel-track-log": "/logs/deck",
  "/engine-logbook": "/logs/engine",
  "/fuel-emissions-log": "/logs/engine",
  "/condition-monitoring-log": "/logs/equipment",
  "/decommissioned-equipment-log": "/logs/equipment",
  "/devices": "/equipment",
  "/equipment-registry": "/equipment",
  "/health-monitor": "/equipment",
  "/health": "/equipment",
  "/fleet-overview": "/vessel-management",
  "/bridge-view": "/fleet",
  "/settings": "/configuration",
  "/transport-settings": "/configuration",
  "/storage-settings": "/configuration",
  "/operating-parameters": "/configuration",
  "/sensor-config": "/sensors",
  "/sensor-optimization": "/sensors",
  "/sensor-management": "/sensors",
  "/cost-savings": "/analytics",
  "/reports": "/analytics",
  "/model-performance": "/analytics",
  "/ml-explainability": "/analytics",
  "/prediction-feedback": "/analytics",
  "/llm-costs": "/analytics",
  "/alerts": "/dashboard",
};

export function migrateRoute(href: string): string {
  return routeMigrations[href] || href;
}

export function getAllNavigationItems(): NavigationItem[] {
  return navigationCategories.flatMap(cat => cat.children);
}

export interface HomePageGroup {
  id: string;
  name: string;
  items: NavigationItem[];
}

export const homePageGroups: HomePageGroup[] = navigationCategories.map(cat => ({
  id: cat.id,
  name: cat.name,
  items: cat.children,
}));
```

---

## 5. `client/src/pages/home.tsx` (369 lines)
Home page with iOS-style icon grid, pinnable dock, recent pages, context menus, long-press support.

*(Full source included in the read above)*

---

## 6. `client/src/pages/dashboard-improved.tsx` (199 lines)
Main dashboard with 5 KPI metrics, collapsible sections (devices, telemetry, predictive maintenance, work orders), vessel filter, focus mode, WebSocket live status.

*(Full source included in the read above)*

---

## 7. `client/src/pages/operations-hub.tsx` (58 lines)
Example hub page showing the IconGridLayout pattern used by all 8 category hubs.

```tsx
import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Gauge, Lightbulb, Activity } from "lucide-react";

const Dashboard = lazy(() => import("./dashboard-improved"));
const ActiveTelemetry = lazy(() => import("./active-telemetry"));
const ActionableInsights = lazy(() => import("./actionable-insights"));

const operationsItems: GridItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    description: "Fleet overview and alerts",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <Dashboard />
      </Suspense>
    ),
    legacyRoutes: ["/dashboard", "/alerts"],
  },
  {
    id: "active-telemetry",
    label: "Active Telemetry",
    icon: Activity,
    description: "Live sensor streams",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ActiveTelemetry />
      </Suspense>
    ),
    legacyRoutes: ["/active-telemetry"],
  },
  {
    id: "insights",
    label: "Actionable Insights",
    icon: Lightbulb,
    description: "AI recommendations",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ActionableInsights />
      </Suspense>
    ),
    legacyRoutes: ["/actionable-insights"],
  },
];

export default function OperationsHub() {
  return (
    <IconGridLayout
      title="Operations"
      description="Dashboard, telemetry, and insights"
      items={operationsItems}
      defaultItemId="dashboard"
      baseRoute="/operations"
    />
  );
}
```

---

## 8. `client/src/components/layouts/IconGridLayout.tsx` (250 lines)
Hub layout: sticky header with breadcrumbs, icon grid navigation strip, detail content pane. URL-synced tab state.

*(Full source included in the read above)*

---

## 9. `client/src/components/layouts/TabbedPageLayout.tsx` (153 lines)
Tab-based page layout with URL query param sync, mobile scroll, admin tab filtering.

*(Full source included in the read above)*

---

## 10. `client/src/components/BottomNav.tsx` (36 lines)

```tsx
import { Link, useLocation } from "wouter";
import { Home, Activity, Users, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/operations", label: "Operations", icon: Activity },
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/system", label: "System", icon: Settings },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t md:hidden pb-safe" data-testid="bottom-nav">
      <div className="flex items-center justify-around h-14 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <div className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors cursor-pointer",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                <Icon className={cn("h-5 w-5", active && "fill-primary/20")} />
                <span className="text-[10px] font-medium">{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

---

## 11. `client/src/components/theme-provider.tsx` (88 lines)

*(Full source included in the read above)*

---

## 12. `client/src/components/ErrorBoundary.tsx` (123 lines)

*(Full source included in the read above)*

---

## 13. `client/src/components/navigation/NavigationCard.tsx` (82 lines)

*(Full source included in the read above)*

---

## 14. `client/src/components/navigation/PageHeader.tsx` (62 lines)

*(Full source included in the read above)*

---

## 15. `client/src/components/shared/UnifiedMetricCard.tsx` (394 lines)
Consolidated metric/KPI card supporting 7 color variants, 4 display variants (default/minimal/compact/dark), trends, progress bars, thresholds, tooltips, timestamps.

*(Full source included in the read above)*

---

## 16. `client/src/lib/queryClient.ts` (187 lines)
TanStack Query v5 setup with default fetcher, org/device headers, error handling, cache tiers, optimistic update helpers.

*(Full source included in the read above)*

---

## Additional Shared Components (not shown in full)
```
client/src/components/shared/
  Breadcrumb.tsx, CollapsibleSection.tsx, ConfirmDialog.tsx, EmptyState.tsx,
  EquipmentSelector.tsx, MetricCard.tsx, NavigationCategory.tsx, NavigationItem.tsx,
  ResponsiveTable.tsx, StatusBadge.tsx, TableSkeleton.tsx, VesselSelector.tsx,
  WebSocketStatus.tsx
```

## Context Providers
```
client/src/contexts/
  FocusModeContext.tsx, AdminAccessContext.tsx, OrganizationContext.tsx, PermissionsContext.tsx
```

## UI Primitives (shadcn/ui - 40+ components)
```
client/src/components/ui/
  alert-dialog, alert, avatar, badge, breadcrumb, button, calendar, card, chart,
  checkbox, collapsible-section, collapsible, command, confidence-badge, context-menu,
  data-freshness-badge, dialog, drawer, dropdown-menu, export-button, form, hover-card,
  info-tooltip, input, label, pagination, popover, progress, radio-group, safe-markdown,
  scroll-area, select, separator, sheet, sidebar, skeleton, slider, stat-card, ...
```
