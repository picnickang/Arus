# ARUS Frontend — Part 1: Core (App, Routing, Lib, Hooks, Utils)
Generated: 2026-03-26T02:38:14Z

### `client/src/App.tsx` (397 lines)

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
import { isDesktopSetupComplete, bootstrapDesktopBackend } from "@/lib/desktopFetch";

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
const _EquipmentRegistry = lazy(() => import("@/pages/equipment-registry")); // Reserved for future use
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
const _MLTrainingPage = lazy(() => import("@/pages/ml-training")); // Reserved for future use
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

function Router() {
  const { currentOrgId, isLoading } = useOrganization();

  // Wait for organization to be initialized before rendering routes
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
        className="min-h-screen"
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

### `client/src/main.tsx` (43 lines)

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
  // Could show toast notification here
});

pwaManager.onUpdateAvailable(() => {
  console.info("PWA update available");
  // Could show update notification here
});

createRoot(document.getElementById("root")!).render(<App />);

```

### `client/src/lib/desktop.ts` (152 lines)

```ts
export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export interface DesktopAPI {
  getAppVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  checkForUpdates: () => Promise<UpdateInfo | null>;
  installUpdate: () => Promise<void>;
  getAppDataDir: () => Promise<string>;
  getRuntimeMode: () => Promise<'packaged' | 'dev'>;
  getBackendUrl: () => Promise<string>;
}

declare global {
  interface Window {
    __TAURI__?: Record<string, unknown>;
    __TAURI_INTERNALS__?: Record<string, unknown>;
  }
}

export function isDesktop(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined)
  );
}

const TAURI_CORE = '@tauri-apps/api/core';
const TAURI_UPDATER = '@tauri-apps/plugin-updater';
const TAURI_PROCESS = '@tauri-apps/plugin-process';

function dynamicImport(mod: string): Promise<any> {
  return new Function('m', 'return import(m)')(mod).catch(() => null);
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const coreModule = await dynamicImport(TAURI_CORE);
  if (!coreModule) throw new Error('Tauri core not available');
  return coreModule.invoke<T>(cmd, args);
}

export function getDesktopAPI(): DesktopAPI | undefined {
  if (!isDesktop()) {
    return undefined;
  }

  return {
    async getAppVersion(): Promise<string> {
      try {
        const info = await tauriInvoke<{ version: string; name: string; identifier: string }>('get_app_version');
        return info.version;
      } catch {
        return 'unknown';
      }
    },

    async isPackaged(): Promise<boolean> {
      try {
        const state = await tauriInvoke<{ packaged: boolean }>('get_runtime_state');
        return state.packaged;
      } catch {
        return false;
      }
    },

    async checkForUpdates(): Promise<UpdateInfo | null> {
      try {
        const updaterModule = await dynamicImport(TAURI_UPDATER);
        if (!updaterModule) return null;
        const update = await updaterModule.check();
        if (!update) return null;
        return {
          version: update.version,
          date: update.date ?? undefined,
          body: update.body ?? undefined,
        };
      } catch {
        return null;
      }
    },

    async installUpdate(): Promise<void> {
      try {
        const updaterModule = await dynamicImport(TAURI_UPDATER);
        if (!updaterModule) return;
        const update = await updaterModule.check();
        if (update) {
          await update.downloadAndInstall();
          const processModule = await dynamicImport(TAURI_PROCESS);
          if (processModule) {
            await processModule.relaunch();
          }
        }
      } catch {
        // silently degrade in web mode
      }
    },

    async getAppDataDir(): Promise<string> {
      try {
        return await tauriInvoke<string>('get_app_data_dir');
      } catch {
        return '';
      }
    },

    async getRuntimeMode(): Promise<'packaged' | 'dev'> {
      try {
        const state = await tauriInvoke<{ packaged: boolean }>('get_runtime_state');
        return state.packaged ? 'packaged' : 'dev';
      } catch {
        return 'dev';
      }
    },

    async getBackendUrl(): Promise<string> {
      try {
        const config = await tauriInvoke<{ url: string; mode: string }>('get_backend_config');
        return config.url;
      } catch {
        return window.location.origin;
      }
    },
  };
}

export async function getAppVersion(): Promise<string> {
  const api = getDesktopAPI();
  if (!api) return 'web';
  return api.getAppVersion();
}

export async function isPackaged(): Promise<boolean> {
  const api = getDesktopAPI();
  if (!api) return false;
  return api.isPackaged();
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const api = getDesktopAPI();
  if (!api) return null;
  return api.checkForUpdates();
}

export async function installUpdate(): Promise<void> {
  const api = getDesktopAPI();
  if (!api) return;
  return api.installUpdate();
}

```

### `client/src/lib/desktopFetch.ts` (116 lines)

```ts
import { isDesktop, getDesktopAPI } from './desktop';

let cachedBackendUrl: string | null = null;

export async function resolveBackendUrl(): Promise<string> {
  if (cachedBackendUrl !== null) return cachedBackendUrl;

  const stored = localStorage.getItem('arus-backend-url');
  if (stored) {
    cachedBackendUrl = stored;
    return stored;
  }

  if (isDesktop()) {
    const api = getDesktopAPI();
    if (api) {
      const url = await api.getBackendUrl();
      if (url && url !== window.location.origin) {
        cachedBackendUrl = url;
        return url;
      }
    }
  }

  cachedBackendUrl = '';
  return '';
}

export function getBackendUrlSync(): string {
  if (cachedBackendUrl !== null) return cachedBackendUrl;
  return localStorage.getItem('arus-backend-url') || '';
}

export function setBackendUrl(url: string): void {
  const normalized = url.replace(/\/+$/, '');
  cachedBackendUrl = normalized;
  localStorage.setItem('arus-backend-url', normalized);
}

export function clearBackendUrl(): void {
  cachedBackendUrl = null;
  localStorage.removeItem('arus-backend-url');
}

export function isDesktopSetupComplete(): boolean {
  if (!isDesktop()) return true;
  return !!localStorage.getItem('arus-backend-url');
}

export async function bootstrapDesktopBackend(): Promise<boolean> {
  if (!isDesktop()) return true;

  const stored = localStorage.getItem('arus-backend-url');
  if (stored) {
    cachedBackendUrl = stored;
    return true;
  }

  const api = getDesktopAPI();
  if (api) {
    try {
      const url = await api.getBackendUrl();
      if (url && url !== window.location.origin && url !== '') {
        const result = await testBackendConnection(url);
        if (result.ok) {
          setBackendUrl(url);
          return true;
        }
      }
    } catch {
    }
  }

  return false;
}

export function getVesselId(): string {
  return localStorage.getItem('arus-vessel-id') || '';
}

export function setVesselId(vesselId: string): void {
  localStorage.setItem('arus-vessel-id', vesselId);
}

export function getVesselName(): string {
  return localStorage.getItem('arus-vessel-name') || '';
}

export function setVesselName(name: string): void {
  localStorage.setItem('arus-vessel-name', name);
}

export async function testBackendConnection(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const normalized = url.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${normalized}/api/healthz`, {
      signal: controller.signal,
      headers: { 'x-org-id': 'default-org-id' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      return { ok: true, message: 'Connected successfully' };
    }
    return { ok: false, message: `Server responded with status ${res.status}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('abort')) {
      return { ok: false, message: 'Connection timed out (5 seconds)' };
    }
    return { ok: false, message: `Could not connect: ${msg}` };
  }
}

```

### `client/src/lib/queryClient.ts` (217 lines)

```ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCurrentDeviceId } from "@/hooks/useDeviceId";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";
import { getBackendUrlSync } from "@/lib/desktopFetch";

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getBackendUrlSync();
  return base ? `${base}${url}` : url;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const statusPrefix = `${res.status}`;

    // Try to parse JSON error response for better error messages
    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      // Not JSON - use text with status code for diagnostics
      throw new Error(`${statusPrefix}: ${text || res.statusText}`);
    }

    // Handle Zod validation errors with specific field messages
    if (errorData.errors && Array.isArray(errorData.errors)) {
      const fieldErrors = errorData.errors
        .map((err: { path?: string[]; message: string }) => `${err.path?.join(".") || "Field"}: ${err.message}`)
        .join(", ");
      throw new Error(`${statusPrefix}: ${fieldErrors || errorData.message || text}`);
    }

    // Extract message from JSON error response with status prefix
    const message = errorData.message || errorData.error || text || res.statusText;
    throw new Error(`${statusPrefix}: ${message}`);
  }
}

// Helper function to create headers with device ID and organization ID
function createHeaders(includeContentType: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {};

  // Add Content-Type if needed
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  // SINGLE-TENANT MODE: Always include org-id header (defaults to default-org-id)
  const orgId = getCurrentOrgId() || "default-org-id";
  headers["x-org-id"] = orgId;

  // Add X-Device-Id header if available (Hub & Sync functionality)
  const deviceId = getCurrentDeviceId();
  if (deviceId) {
    headers["X-Device-Id"] = deviceId;
  }

  return headers;
}

export interface ApiRequestOptions {
  signal?: AbortSignal;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: ApiRequestOptions
): Promise<unknown> {
  const res = await fetch(resolveUrl(url), {
    method,
    headers: createHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: options?.signal,
  });

  await throwIfResNotOk(res);

  // Handle 204 No Content responses (e.g., successful DELETE operations)
  if (res.status === 204) {
    return null;
  }

  // Only parse JSON if there's a response body
  const text = await res.text();
  const result = text ? JSON.parse(text) : null;
  
  // Handle standardized API response format (unwrap { success, data } envelope)
  if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
    return result.data;
  }
  
  return result;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL with proper query parameter handling
    let url: string;

    if (queryKey.length === 1) {
      // Simple query key - just use as URL
      url = queryKey[0] as string;
    } else if (queryKey.length === 2 && typeof queryKey[1] === "object" && queryKey[1] !== null) {
      // Query key with parameters object - convert to query string
      const baseUrl = queryKey[0] as string;
      const params = queryKey[1] as Record<string, string | number | boolean | null | undefined>;
      const searchParams = new URLSearchParams();

      // Add non-null/undefined parameters to query string
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          searchParams.append(key, String(value));
        }
      });

      const queryString = searchParams.toString();
      url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    } else {
      // Legacy format - join with slashes (for backward compatibility)
      url = queryKey.join("/");
    }

    const res = await fetch(resolveUrl(url), {
      headers: createHeaders(false),
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const result = await res.json();
    
    // Handle standardized API response format (unwrap { success, data } envelope)
    if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
      return result.data;
    }
    
    return result;
  };

// Cache time constants for different data types (OPTIMIZED Oct 2025)
export const CACHE_TIMES = {
  REALTIME: 30000, // 30s - telemetry, truly real-time data
  MODERATE: 300000, // 5min - devices, work orders, fleet status
  STABLE: 3600000, // 60min - vessels, equipment catalog, users (was 30min)
  EXPENSIVE: 86400000, // 24hr - AI insights, reports, heavy computations (was 1hr)
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false, // Disable global polling - set per query based on data type
      refetchOnWindowFocus: false,
      staleTime: CACHE_TIMES.MODERATE, // 5min default - reasonable for most data
      retry: 1, // Single retry for network issues
    },
    mutations: {
      retry: 1, // Single retry for mutations
    },
  },
});

/**
 * Helper for optimistic mutations with automatic rollback on error
 *
 * @example
 * const mutation = useMutation({
 *   mutationFn: (data) => apiRequest('POST', '/api/work-orders', data),
 *   onMutate: optimisticUpdate('/api/work-orders', (old, newData) => [...(old ?? []), newData]),
 *   onError: rollbackUpdate('/api/work-orders'),
 *   onSettled: () => queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] }),
 * });
 */
export function optimisticUpdate<TData, TVariables>(
  queryKey: string | string[],
  updater: (oldData: TData | undefined, variables: TVariables) => TData
) {
  return async (variables: TVariables) => {
    const key = Array.isArray(queryKey) ? queryKey : [queryKey];

    // Cancel any outgoing refetches
    await queryClient.cancelQueries({ queryKey: key });

    // Snapshot the previous value
    const previousData = queryClient.getQueryData<TData>(key);

    // Optimistically update to the new value
    queryClient.setQueryData<TData>(key, (old) => updater(old, variables));

    // Return a context with the previous value
    return { previousData, queryKey: key };
  };
}

/**
 * Helper to rollback optimistic updates on error
 */
export function rollbackUpdate<TData>(_queryKey: string | string[]) {
  return (
    _error: Error,
    _variables: unknown,
    context?: { previousData?: TData; queryKey: string[] }
  ) => {
    if (context?.previousData !== undefined) {
      queryClient.setQueryData(context.queryKey, context.previousData);
    }
  };
}

```

### `client/src/hooks/use-toast.ts` (186 lines)

```ts
import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const _actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof _actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {dismiss();}
      },
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast, toast };

```

### `client/src/hooks/use-mobile.tsx` (19 lines)

```tsx
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = globalThis.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

```

### `client/src/utils/queryKeys.ts` (258 lines)

```ts
/**
 * Centralized Query Keys for TanStack Query
 *
 * This module provides type-safe, hierarchical query keys for all API endpoints.
 * Using consistent query key patterns ensures proper cache invalidation and prevents stale data.
 *
 * Pattern: [domain, ...hierarchy, params]
 * Example: ['equipment', 'list', { page: 1, type: 'main_engine' }]
 *
 * Benefits:
 * - Type safety: TypeScript ensures correct usage
 * - Consistency: All queries use same structure
 * - Invalidation: Easy to invalidate related queries
 * - Debugging: Clear cache keys in React Query DevTools
 */

export interface EquipmentFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  status?: "active" | "inactive" | "all";
  vesselId?: string;
  manufacturer?: string;
}

export interface SensorFilters {
  equipmentId?: string;
  sensorType?: string;
  enabled?: boolean;
}

export interface VesselFilters {
  active?: boolean;
  vesselType?: string;
}

export interface TelemetryFilters {
  equipmentId?: string;
  sensorType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Equipment-related query keys
 */
export const equipmentKeys = {
  all: ["equipment"] as const,

  lists: () => [...equipmentKeys.all, "list"] as const,
  list: (filters?: EquipmentFilters) => [...equipmentKeys.lists(), filters ?? {}] as const,

  details: () => [...equipmentKeys.all, "detail"] as const,
  detail: (id: string) => [...equipmentKeys.details(), id] as const,

  health: () => [...equipmentKeys.all, "health"] as const,
  healthByVessel: (vesselId?: string) => [...equipmentKeys.health(), { vesselId }] as const,

  sensorCoverage: (id: string) => [...equipmentKeys.detail(id), "sensor-coverage"] as const,

  compatibleParts: (id: string) => [...equipmentKeys.detail(id), "compatible-parts"] as const,

  suggestedParts: (id: string) => [...equipmentKeys.detail(id), "suggested-parts"] as const,

  rul: (id: string) => [...equipmentKeys.detail(id), "rul"] as const,

  decommissioned: () => [...equipmentKeys.all, "decommissioned"] as const,

  history: (id: string) => [...equipmentKeys.detail(id), "history"] as const,
} as const;

/**
 * Sensor configuration query keys
 */
export const sensorKeys = {
  all: ["sensors"] as const,

  lists: () => [...sensorKeys.all, "list"] as const,
  list: (filters?: SensorFilters) => [...sensorKeys.lists(), filters ?? {}] as const,

  byEquipment: (equipmentId: string) => [...sensorKeys.all, "equipment", equipmentId] as const,

  status: (equipmentId?: string) => [...sensorKeys.all, "status", equipmentId || "all"] as const,

  details: () => [...sensorKeys.all, "detail"] as const,
  detail: (id: string) => [...sensorKeys.details(), id] as const,
} as const;

/**
 * Sensor template query keys
 */
export const sensorTemplateKeys = {
  all: ["sensor-templates"] as const,

  lists: () => [...sensorTemplateKeys.all, "list"] as const,
  list: (equipmentType?: string) =>
    [...sensorTemplateKeys.lists(), { equipmentType: equipmentType || "all" }] as const,

  details: () => [...sensorTemplateKeys.all, "detail"] as const,
  detail: (id: string) => [...sensorTemplateKeys.details(), id] as const,
} as const;

/**
 * Vessel-related query keys
 */
export const vesselKeys = {
  all: ["vessels"] as const,

  lists: () => [...vesselKeys.all, "list"] as const,
  list: (filters?: VesselFilters) => [...vesselKeys.lists(), filters ?? {}] as const,

  details: () => [...vesselKeys.all, "detail"] as const,
  detail: (id: string) => [...vesselKeys.details(), id] as const,

  equipment: (id: string) => [...vesselKeys.detail(id), "equipment"] as const,
} as const;

/**
 * Telemetry query keys
 */
export const telemetryKeys = {
  all: ["telemetry"] as const,

  latest: (filters?: TelemetryFilters) => [...telemetryKeys.all, "latest", filters ?? {}] as const,

  byEquipment: (equipmentId: string, filters?: TelemetryFilters) =>
    [...telemetryKeys.all, "equipment", equipmentId, filters ?? {}] as const,

  bySensor: (equipmentId: string, sensorType: string) =>
    [...telemetryKeys.all, "sensor", equipmentId, sensorType] as const,
} as const;

/**
 * Operating parameters query keys
 */
export const operatingParamKeys = {
  all: ["operating-parameters"] as const,

  byEquipmentType: (equipmentType: string) =>
    [...operatingParamKeys.all, "type", equipmentType] as const,
} as const;

/**
 * Alert-related query keys
 */
export const alertKeys = {
  all: ["alerts"] as const,

  operatingCondition: (equipmentId?: string, acknowledged?: boolean) =>
    [...alertKeys.all, "operating-condition", { equipmentId, acknowledged }] as const,

  configurations: (equipmentId?: string) =>
    [...alertKeys.all, "configurations", equipmentId || "all"] as const,
} as const;

/**
 * Work order query keys
 */
export const workOrderKeys = {
  all: ["work-orders"] as const,

  lists: () => [...workOrderKeys.all, "list"] as const,
  list: (filters?: { status?: string; equipmentId?: string }) =>
    [...workOrderKeys.lists(), filters ?? {}] as const,

  details: () => [...workOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...workOrderKeys.details(), id] as const,
} as const;

/**
 * Inventory query keys
 */
export const inventoryKeys = {
  all: ["inventory"] as const,

  parts: () => [...inventoryKeys.all, "parts"] as const,
  part: (id: string) => [...inventoryKeys.parts(), id] as const,

  stock: () => [...inventoryKeys.all, "stock"] as const,
} as const;

/**
 * Analytics query keys
 */
export const analyticsKeys = {
  all: ["analytics"] as const,

  dashboard: () => [...analyticsKeys.all, "dashboard"] as const,

  insights: () => [...analyticsKeys.all, "insights"] as const,
  latestSnapshot: () => [...analyticsKeys.insights(), "latest"] as const,

  jobs: () => [...analyticsKeys.all, "jobs"] as const,
  jobStats: () => [...analyticsKeys.jobs(), "stats"] as const,
} as const;

/**
 * DTC (Diagnostic Trouble Code) query keys
 */
export const dtcKeys = {
  all: ["dtc"] as const,

  dashboard: () => [...dtcKeys.all, "dashboard-stats"] as const,

  active: (equipmentId?: string) => [...dtcKeys.all, "active", equipmentId || "all"] as const,
} as const;

/**
 * Utility function to invalidate all queries for a specific domain
 */
export const invalidateDomain = {
  equipment: () => equipmentKeys.all,
  sensors: () => sensorKeys.all,
  sensorTemplates: () => sensorTemplateKeys.all,
  vessels: () => vesselKeys.all,
  telemetry: () => telemetryKeys.all,
  alerts: () => alertKeys.all,
  workOrders: () => workOrderKeys.all,
  inventory: () => inventoryKeys.all,
  analytics: () => analyticsKeys.all,
  dtc: () => dtcKeys.all,
} as const;

/**
 * Helper to get all query keys that should be invalidated after equipment mutation
 */
export function getEquipmentMutationInvalidations(equipmentId?: string) {
  const keys = [equipmentKeys.all, analyticsKeys.dashboard(), dtcKeys.dashboard()];

  if (equipmentId) {
    keys.push(
      equipmentKeys.detail(equipmentId),
      sensorKeys.byEquipment(equipmentId),
      sensorKeys.status(equipmentId)
    );
  }

  return keys;
}

/**
 * Helper to get all query keys that should be invalidated after sensor mutation
 */
export function getSensorMutationInvalidations(equipmentId?: string) {
  const keys = [sensorKeys.all];

  if (equipmentId) {
    keys.push(
      sensorKeys.byEquipment(equipmentId),
      sensorKeys.status(equipmentId),
      equipmentKeys.sensorCoverage(equipmentId)
    );
  }

  return keys;
}

```

### `client/src/utils/errorHelpers.ts` (133 lines)

```ts
import { NormalizedError } from "@/components/patterns";

/**
 * Normalizes various error types (TanStack Query, Fetch, Error) into NormalizedError format
 */
export function normalizeQueryError(error: unknown): NormalizedError {
  // Handle null/undefined
  if (!error) {
    return {
      title: "Unknown Error",
      message: "An unexpected error occurred",
      code: "UNKNOWN_ERROR",
    };
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Check if it's a fetch/network error
    if (error.message.includes("Failed to fetch") || error.message.includes("Network")) {
      return {
        title: "Network Error",
        message: "Unable to connect to the server. Please check your internet connection.",
        code: "NETWORK_ERROR",
        details: error.stack,
      };
    }

    return {
      title: error.name || "Error",
      message: error.message,
      details: error.stack,
      code: error.name?.toUpperCase().replaceAll(' ', "_") || "GENERIC_ERROR",
    };
  }

  // Handle API error responses (with statusCode)
  if (typeof error === "object" && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Handle HTTP error responses
    if (errorObj.statusCode || errorObj.status) {
      const statusCode = errorObj.statusCode || errorObj.status;
      const message = errorObj.message || errorObj.error || getStatusMessage(statusCode);

      return {
        title: getStatusTitle(statusCode),
        message,
        statusCode,
        code: `HTTP_${statusCode}`,
        details: errorObj.details || errorObj.stack,
      };
    }

    // Handle error objects with message
    if (errorObj.message) {
      return {
        title: errorObj.title || "Error",
        message: errorObj.message,
        code: errorObj.code || "API_ERROR",
        details: errorObj.details || errorObj.stack,
      };
    }
  }

  // Handle string errors
  if (typeof error === "string") {
    return {
      title: "Error",
      message: error,
      code: "STRING_ERROR",
    };
  }

  // Fallback for unknown error types
  return {
    title: "Unexpected Error",
    message: "An unexpected error occurred. Please try again.",
    code: "UNKNOWN_ERROR",
    details: JSON.stringify(error),
  };
}

/**
 * Get human-friendly title for HTTP status codes
 */
function getStatusTitle(statusCode: number): string {
  if (statusCode >= 500) {
    return "Server Error";
  }

  if (statusCode === 404) {
    return "Not Found";
  }

  if (statusCode === 403) {
    return "Access Denied";
  }

  if (statusCode === 401) {
    return "Unauthorized";
  }

  if (statusCode === 400) {
    return "Bad Request";
  }
  return "Error";
}

/**
 * Get human-friendly message for HTTP status codes
 */
function getStatusMessage(statusCode: number): string {
  if (statusCode >= 500) {
    return "The server encountered an error. Please try again later.";
  }

  if (statusCode === 404) {
    return "The requested resource was not found.";
  }

  if (statusCode === 403) {
    return "You don't have permission to access this resource.";
  }

  if (statusCode === 401) {
    return "You need to be logged in to access this resource.";
  }

  if (statusCode === 400) {
    return "The request was invalid. Please check your input.";
  }
  return "An error occurred while processing your request.";
}

```

### `client/src/utils/equipmentHelpers.ts` (134 lines)

```ts
import { Equipment, Vessel } from "@shared/schema";
import { EquipmentFilters } from "@/hooks/useEquipmentFilters";

/**
 * Filter equipment based on search and filter criteria
 */
export function filterEquipment(allEquipment: Equipment[], filters: EquipmentFilters): Equipment[] {
  return allEquipment.filter((equipment) => {
    // Search filter (case-insensitive, matches name, type, manufacturer, vesselName)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        equipment.name?.toLowerCase().includes(searchLower) ||
        equipment.type?.toLowerCase().includes(searchLower) ||
        equipment.manufacturer?.toLowerCase().includes(searchLower) ||
        equipment.vesselName?.toLowerCase().includes(searchLower);

      if (!matchesSearch) {
        return false;
      }
    }

    // Vessel filter
    if (filters.vessel !== "all" && equipment.vesselId !== filters.vessel) {
      return false;
    }

    // Type filter
    if (filters.type !== "all" && equipment.type !== filters.type) {
      return false;
    }

    // Status filter (active/inactive)
    if (filters.status !== "all") {
      const isActive = equipment.isActive;
      if (filters.status === "active" && !isActive) {
        return false;
      }

      if (filters.status === "inactive" && isActive) {
        return false;
      }
    }

    // Manufacturer filter
    if (filters.manufacturer !== "all" && equipment.manufacturer !== filters.manufacturer) {
      return false;
    }

    return true;
  });
}

/**
 * Format location string from snake_case to Title Case
 */
export function formatLocation(location: string): string {
  return location.replaceAll('_', " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format equipment type from snake_case to Title Case
 */
export function formatType(type: string): string {
  return type.replaceAll('_', " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get vessel information for an equipment item
 */
export function getVesselInfo(equipment: Equipment, vessels: Vessel[]) {
  // Equipment is properly linked if it has a vesselId (foreign key)
  if (equipment.vesselId) {
    const vessel = vessels.find((v) => v.id === equipment.vesselId);
    // If vessel is found in database, it's properly linked
    // If not found, it means the vessel was deleted but vesselId still references it (orphaned link)
    if (vessel) {
      return { name: vessel.name, id: vessel.id, isLinked: true };
    }
    // Orphaned vesselId - vessel was deleted
    return { name: equipment.vesselName || "Unknown", id: equipment.vesselId, isLinked: false };
  }
  // Equipment is not linked but may have a legacy vesselName (data migration artifact)
  if (equipment.vesselName) {
    // Check if a vessel exists with this name for potential linking
    const vessel = vessels.find((v) => v.name === equipment.vesselName);
    return vessel
      ? { name: vessel.name, id: vessel.id, isLinked: true }
      : { name: equipment.vesselName, id: null, isLinked: false };
  }
  // Equipment is not assigned to any vessel
  return { name: null, id: null, isLinked: false };
}

/**
 * Get equipment status type for StatusBadge component
 */
export function getEquipmentStatus(equipment: Equipment): "active" | "inactive" {
  return equipment.isActive ? "active" : "inactive";
}

/**
 * Calculate equipment statistics from a list of equipment
 */
export function calculateEquipmentStats(
  allEquipment: Equipment[],
  vessels: Vessel[],
  filteredCount?: number
) {
  const activeCount = allEquipment.filter((e) => e.isActive).length;
  const inactiveCount = allEquipment.length - activeCount;
  const unassignedCount = allEquipment.filter((e) => !e.vesselId).length;

  // Group by vessel
  const byVessel = allEquipment.reduce((acc: Record<string, number>, e: Equipment) => {
    if (e.vesselId) {
      const vessel = vessels.find((v) => v.id === e.vesselId);
      const vesselName = vessel?.name || "Unknown";
      acc[vesselName] = (acc[vesselName] || 0) + 1;
    }
    return acc;
  }, {});

  const vesselCount = Object.keys(byVessel).length;

  return {
    total: allEquipment.length,
    active: activeCount,
    inactive: inactiveCount,
    unassigned: unassignedCount,
    vesselCount,
    filtered: filteredCount ?? allEquipment.length,
  };
}

```

### `client/src/utils/perfLog.ts` (249 lines)

```ts
/**
 * ARUS Performance Logger Utility
 * 
 * Lightweight performance monitoring for React components and operations.
 * Enable via: localStorage.setItem('PERF_DEBUG', 'true')
 * 
 * Features:
 * - Component mount/render timing
 * - Render count tracking
 * - Operation timing (console.time wrapper)
 * - React Query refetch tracking
 * 
 * Usage:
 *   import { useRenderCount, useMountTime, perfTime } from '@/utils/perfLog';
 *   
 *   // Track render count
 *   useRenderCount('Dashboard');
 *   
 *   // Track mount time
 *   useMountTime('Dashboard');
 *   
 *   // Time an operation
 *   perfTime.start('fetchData');
 *   await fetchData();
 *   perfTime.end('fetchData');
 */

import { useEffect, useRef } from 'react';

const PERF_DEBUG_KEY = 'PERF_DEBUG';

// Check if performance debugging is enabled
export function isPerfDebugEnabled(): boolean {
  if (typeof globalThis === 'undefined') {
    return false;
  }
  return localStorage.getItem(PERF_DEBUG_KEY) === 'true';
}

// Enable/disable performance debugging
export function setPerfDebug(enabled: boolean): void {
  if (typeof globalThis === 'undefined') {
    return;
  }
  localStorage.setItem(PERF_DEBUG_KEY, enabled ? 'true' : 'false');
  console.info(`[PerfLog] Performance debugging ${enabled ? 'enabled' : 'disabled'}`);
}

// Performance log with optional color coding
function perfLog(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warn' | 'slow' = 'info'
): void {
  if (!isPerfDebugEnabled()) {
    return;
  }
  
  const colors = {
    info: 'color: #10b981',
    warn: 'color: #f59e0b',
    slow: 'color: #ef4444; font-weight: bold',
  };
  
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
  
  if (data) {
    console.info(`%c[PerfLog:${category}] ${timestamp} ${message}`, colors[level], data);
  } else {
    console.info(`%c[PerfLog:${category}] ${timestamp} ${message}`, colors[level]);
  }
}

// Render count storage
const renderCounts: Map<string, number> = new Map();

/**
 * Hook to track render count of a component
 * Logs to console when PERF_DEBUG=true
 */
export function useRenderCount(componentName: string): number {
  const countRef = useRef(0);
  countRef.current++;
  
  // Update global map
  renderCounts.set(componentName, countRef.current);
  
  // Log every 5 renders to reduce noise
  if (isPerfDebugEnabled() && countRef.current % 5 === 0) {
    perfLog('Render', `${componentName} rendered ${countRef.current} times`);
  }
  
  return countRef.current;
}

/**
 * Hook to track component mount time
 */
export function useMountTime(componentName: string): void {
  const startTimeRef = useRef(performance.now());
  
  useEffect(() => {
    const mountTime = performance.now() - startTimeRef.current;
    const level = mountTime > 100 ? 'slow' : mountTime > 50 ? 'warn' : 'info';
    
    perfLog('Mount', `${componentName} mounted in ${mountTime.toFixed(2)}ms`, undefined, level);
    
    return () => {
      perfLog('Unmount', `${componentName} unmounted`);
    };
  }, [componentName]);
}

/**
 * Hook to track effect execution time
 */
export function useEffectTime(effectName: string, deps: unknown[]): void {
  useEffect(() => {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      if (duration > 16) { // Log if effect takes longer than 1 frame
        perfLog('Effect', `${effectName} ran for ${duration.toFixed(2)}ms`, undefined, 'warn');
      }
    };
  }, deps);
}

// Operation timing utility
const timers: Map<string, number> = new Map();

export const perfTime = {
  start(label: string): void {
    timers.set(label, performance.now());
    if (isPerfDebugEnabled()) {
      console.time(`[PerfLog:Timer] ${label}`);
    }
  },
  
  end(label: string, warnThresholdMs = 200): number {
    const startTime = timers.get(label);
    const duration = startTime ? performance.now() - startTime : 0;
    timers.delete(label);
    
    if (isPerfDebugEnabled()) {
      console.timeEnd(`[PerfLog:Timer] ${label}`);
      
      if (duration > warnThresholdMs) {
        perfLog('Timer', `${label} took ${duration.toFixed(2)}ms (> ${warnThresholdMs}ms threshold)`, undefined, 'slow');
      }
    }
    
    return duration;
  },
  
  mark(label: string): void {
    if (isPerfDebugEnabled()) {
      performance.mark(`perf:${label}`);
      perfLog('Mark', label);
    }
  },
  
  measure(name: string, startMark: string, endMark?: string): number {
    if (!isPerfDebugEnabled()) {
      return 0;
    }
    
    try {
      const measureName = `measure:${name}`;
      performance.measure(measureName, `perf:${startMark}`, endMark ? `perf:${endMark}` : undefined);
      const entries = performance.getEntriesByName(measureName);
      const duration = entries[entries.length - 1]?.duration || 0;
      
      perfLog('Measure', `${name}: ${duration.toFixed(2)}ms`);
      return duration;
    } catch (_e) {
      return 0;
    }
  },
};

// React Query refetch tracking
const queryRefetchCounts: Map<string, { count: number; lastTime: number }> = new Map();

/**
 * Track React Query refetch frequency
 * Call this in your queryFn to monitor refetch patterns
 */
export function trackQueryRefetch(queryKey: string): void {
  if (!isPerfDebugEnabled()) {
    return;
  }
  
  const now = Date.now();
  const existing = queryRefetchCounts.get(queryKey) || { count: 0, lastTime: now };
  const timeSinceLast = now - existing.lastTime;
  
  existing.count++;
  existing.lastTime = now;
  queryRefetchCounts.set(queryKey, existing);
  
  // Warn if refetching too frequently (< 5 seconds apart)
  if (timeSinceLast < 5000 && existing.count > 1) {
    perfLog('Query', `${queryKey} refetched after ${timeSinceLast}ms (${existing.count} total)`, undefined, 'warn');
  } else if (existing.count % 10 === 0) {
    perfLog('Query', `${queryKey} refetch count: ${existing.count}`);
  }
}

// Get performance summary
export function getPerfSummary(): {
  renderCounts: Record<string, number>;
  queryRefetchCounts: Record<string, { count: number; lastTime: number }>;
} {
  return {
    renderCounts: Object.fromEntries(renderCounts),
    queryRefetchCounts: Object.fromEntries(queryRefetchCounts),
  };
}

// Debug command for console
if (typeof globalThis !== 'undefined') {
  const windowWithPerfLog = window as Window & { perfLog?: Record<string, unknown> };
  windowWithPerfLog.perfLog = {
    enable: () => setPerfDebug(true),
    disable: () => setPerfDebug(false),
    summary: getPerfSummary,
    renderCounts: () => Object.fromEntries(renderCounts),
    queryRefetchCounts: () => Object.fromEntries(queryRefetchCounts),
    clear: () => {
      renderCounts.clear();
      queryRefetchCounts.clear();
      console.info('[PerfLog] Cleared all tracking data');
    },
  };
  
  // Log availability on load
  if (isPerfDebugEnabled()) {
    console.info('%c🔍 Performance Debugging Enabled', 'color: #10b981; font-weight: bold; font-size: 14px');
    console.info('Commands: globalThis.perfLog.summary(), globalThis.perfLog.disable()');
  }
}

```

### `client/src/utils/pwa.ts` (291 lines)

```ts
// PWA Service Worker Registration and Management
// Handles service worker registration, updates, and PWA installation

export interface PWAInstallPrompt {
  platforms: string[];
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

export interface PWAInstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  platforms: string[];
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: PWAInstallEvent;
  }
}

class PWAManager {
  private installPrompt: PWAInstallEvent | null = null;
  private isInstalled = false;
  private isOnline = navigator.onLine;
  private callbacks: {
    onInstallPrompt?: (prompt: PWAInstallEvent) => void;
    onInstalled?: () => void;
    onOnlineChange?: (online: boolean) => void;
    onUpdateAvailable?: () => void;
  } = {};

  constructor() {
    this.setupEventListeners();
    this.checkIfInstalled();
  }

  /**
   * Register service worker and setup PWA functionality
   */
  async initialize(): Promise<void> {
    // In development, unregister any existing service workers to prevent caching issues
    if (import.meta.env.DEV) {
      console.info("⚙️ Service Worker registration skipped in development mode");
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.info("🗑️ Unregistered service worker in development mode");
        }
      }
      return;
    }

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
        });

        console.info("✅ Service Worker registered successfully:", registration.scope);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.info("🔄 Service Worker update available");
                this.callbacks.onUpdateAvailable?.();
              }
            });
          }
        });

        // Handle messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          console.info("📨 Message from SW:", event.data);
        });

        return registration;
      } catch (error) {
        console.error("❌ Service Worker registration failed:", error);
        throw error;
      }
    } else {
      console.warn("⚠️ Service Workers not supported");
    }
  }

  /**
   * Setup event listeners for PWA functionality
   */
  private setupEventListeners(): void {
    // Listen for install prompt
    globalThis.addEventListener("beforeinstallprompt", (event: PWAInstallEvent) => {
      event.preventDefault();
      this.installPrompt = event;
      console.info("📱 PWA install prompt available");
      this.callbacks.onInstallPrompt?.(event);
    });

    // Listen for app installation
    globalThis.addEventListener("appinstalled", () => {
      console.info("✅ PWA installed successfully");
      this.isInstalled = true;
      this.installPrompt = null;
      this.callbacks.onInstalled?.();
    });

    // Listen for online/offline status
    globalThis.addEventListener("online", () => {
      this.isOnline = true;
      console.info("🌐 Back online");
      this.callbacks.onOnlineChange?.(true);
    });

    globalThis.addEventListener("offline", () => {
      this.isOnline = false;
      console.info("📴 Gone offline");
      this.callbacks.onOnlineChange?.(false);
    });
  }

  /**
   * Check if app is already installed
   */
  private checkIfInstalled(): void {
    // Check if running in standalone mode (PWA)
    if (globalThis.matchMedia("(display-mode: standalone)").matches) {
      this.isInstalled = true;
      console.info("📱 Running as installed PWA");
    }

    // Check for Android TWA
    if ("getInstalledRelatedApps" in navigator) {
      const navWithApps = navigator as Navigator & { getInstalledRelatedApps: () => Promise<Array<{ id?: string; platform?: string }>> };
      navWithApps.getInstalledRelatedApps().then((apps) => {
        if (apps.length > 0) {
          this.isInstalled = true;
          console.info("📱 Running as TWA or installed app");
        }
      });
    }
  }

  /**
   * Show PWA install prompt
   */
  async showInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!this.installPrompt) {
      console.warn("⚠️ Install prompt not available");
      return "unavailable";
    }

    try {
      await this.installPrompt.prompt();
      const choice = await this.installPrompt.userChoice;
      console.info("📱 Install prompt result:", choice.outcome);

      if (choice.outcome === "accepted") {
        this.installPrompt = null;
      }

      return choice.outcome;
    } catch (error) {
      console.error("❌ Install prompt failed:", error);
      return "unavailable";
    }
  }

  /**
   * Check if PWA can be installed
   */
  canInstall(): boolean {
    return !!this.installPrompt && !this.isInstalled;
  }

  /**
   * Check if PWA is installed
   */
  isAppInstalled(): boolean {
    return this.isInstalled;
  }

  /**
   * Check if device is online
   */
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Register callbacks for PWA events
   */
  onInstallPrompt(callback: (prompt: PWAInstallEvent) => void): void {
    this.callbacks.onInstallPrompt = callback;
  }

  onInstalled(callback: () => void): void {
    this.callbacks.onInstalled = callback;
  }

  onOnlineChange(callback: (online: boolean) => void): void {
    this.callbacks.onOnlineChange = callback;
  }

  onUpdateAvailable(callback: () => void): void {
    this.callbacks.onUpdateAvailable = callback;
  }

  /**
   * Request persistent storage for offline data
   */
  async requestPersistentStorage(): Promise<boolean> {
    if ("storage" in navigator && "persist" in navigator.storage) {
      try {
        const persistent = await navigator.storage.persist();
        console.info(`💾 Persistent storage: ${persistent ? "granted" : "denied"}`);
        return persistent;
      } catch (error) {
        console.error("❌ Persistent storage request failed:", error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get storage usage estimate
   */
  async getStorageEstimate(): Promise<StorageEstimate | null> {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      try {
        return await navigator.storage.estimate();
      } catch (error) {
        console.error("❌ Storage estimate failed:", error);
        return null;
      }
    }
    return null;
  }

  /**
   * Force service worker update
   */
  async updateServiceWorker(): Promise<void> {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        console.info("🔄 Service Worker update forced");
      }
    }
  }

  /**
   * Post message to service worker
   */
  postMessageToSW(message: unknown): void {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
  }

  /**
   * Show notification (if permission granted)
   */
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.showNotification(title, options);
            return;
          }
        }
        new Notification(title, options);
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          await this.showNotification(title, options);
        }
      }
    }
  }
}

// Create global PWA manager instance
export const pwaManager = new PWAManager();

```

### `client/src/components/ErrorBoundary.tsx` (123 lines)

```tsx
import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.logToBackend(error, errorInfo);
  }

  async logToBackend(error: Error, errorInfo: React.ErrorInfo) {
    try {
      await fetch("/api/error-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: "default-org-id",
          severity: "error",
          category: "frontend",
          message: error.message,
          stackTrace: error.stack,
          context: {
            componentStack: errorInfo.componentStack,
            url: globalThis.location.href,
            userAgent: navigator.userAgent,
          },
          errorCode: error.name,
        }),
      });
    } catch (logError) {
      console.error("Failed to log error to backend:", logError);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    globalThis.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-2 text-foreground">Something went wrong</h1>

            <p className="text-muted-foreground mb-4">
              We're sorry, but something unexpected happened. The error has been logged and we'll
              look into it.
            </p>

            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Error Details
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-40">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${  this.state.error.stack}`}
                </pre>
              </details>
            )}

            <Button onClick={this.handleReset} className="w-full" data-testid="button-reload-app">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

```

### `client/src/components/theme-provider.tsx` (88 lines)

```tsx
import * as React from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
  resolvedTheme: "dark",
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "arus-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof globalThis !== "undefined") {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("dark");

  React.useEffect(() => {
    const root = globalThis.document.documentElement;
    root.classList.remove("light", "dark");

    let effectiveTheme: "light" | "dark" = "dark";

    if (theme === "system") {
      const systemTheme = globalThis.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      effectiveTheme = systemTheme;
    } else {
      effectiveTheme = theme;
    }

    root.classList.add(effectiveTheme);
    setResolvedTheme(effectiveTheme);
  }, [theme]);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme: (newTheme: Theme) => {
        if (typeof globalThis !== "undefined") {
          localStorage.setItem(storageKey, newTheme);
        }
        setTheme(newTheme);
      },
      resolvedTheme,
    }),
    [theme, resolvedTheme, storageKey]
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};

```

### `client/src/components/DevModeToggle.tsx` (77 lines)

```tsx
/**
 * DevModeToggle - Temporary Development Mode Toggle
 * 
 * TEMPORARY: This component is for development/testing purposes only.
 * Remove this file and its usage when RBAC is fully implemented and tested.
 * 
 * Usage: Import and place on any page. Click to toggle dev mode.
 * - Blue (Shield icon): Dev mode ON - all permissions granted
 * - Red (ShieldOff icon): Dev mode OFF - actual role permissions enforced
 */

import { useState, useEffect } from "react";
import { Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DEV_MODE_KEY = "arus_dev_mode_override";

export function getDevModeOverride(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEV_MODE_KEY) === "true";
}

export function setDevModeOverride(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEV_MODE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent("devModeChange", { detail: { enabled } }));
}

export function DevModeToggle() {
  const [isDevMode, setIsDevMode] = useState(getDevModeOverride);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsDevMode(getDevModeOverride());
    };

    const handleDevModeChange = (e: CustomEvent<{ enabled: boolean }>) => {
      setIsDevMode(e.detail.enabled);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("devModeChange", handleDevModeChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("devModeChange", handleDevModeChange as EventListener);
    };
  }, []);

  const toggle = () => {
    const newValue = !isDevMode;
    setDevModeOverride(newValue);
    setIsDevMode(newValue);
    window.location.reload();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          onClick={toggle}
          className={isDevMode ? "text-blue-500 hover:text-blue-600" : "text-red-500 hover:text-red-600"}
          data-testid="button-dev-mode-toggle"
        >
          {isDevMode ? <Shield className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isDevMode ? "Dev Mode ON (Full Permissions)" : "Dev Mode OFF (Role Permissions)"}</p>
        <p className="text-xs text-muted-foreground">Click to toggle</p>
      </TooltipContent>
    </Tooltip>
  );
}

```

### `client/src/components/DevPerformanceOverlay.tsx` (438 lines)

```tsx
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { X, Activity, Timer, RefreshCw, MemoryStick, ChevronDown, ChevronUp } from 'lucide-react';
import { getPerfSummary, isPerfDebugEnabled, setPerfDebug } from '@/utils/perfLog';
import { useLocation } from 'wouter';

interface ApiLatency {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
}

interface RouteNavigation {
  from: string;
  to: string;
  duration: number;
  timestamp: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

declare global {
  interface Performance {
    memory?: MemoryInfo;
  }
  interface Window {
    __devPerfOriginalFetch?: typeof fetch;
    __devPerfInterceptorInstalled?: boolean;
  }
}

const API_HISTORY_LIMIT = 20;
const ROUTE_HISTORY_LIMIT = 10;

const WRAPPER_SYMBOL = Symbol.for('__devPerfFetchWrapper');

const apiLatenciesRef: { current: ApiLatency[] } = { current: [] };
let apiLatencyListeners: ((latencies: ApiLatency[]) => void)[] = [];

function notifyApiLatencyListeners() {
  apiLatencyListeners.forEach(listener => listener([...apiLatenciesRef.current]));
}

function addApiLatency(latency: ApiLatency) {
  apiLatenciesRef.current = [latency, ...apiLatenciesRef.current].slice(0, API_HISTORY_LIMIT);
  notifyApiLatencyListeners();
}

export const FETCH_WRAPPER_SYMBOL = Symbol.for('__devPerfFetchWrapper');

export function installFetchInterceptor(): boolean {
  if (typeof window === 'undefined') return false;
  
  if (window.__devPerfInterceptorInstalled) return false;
  
  const currentFetch = window.fetch;
  if ((currentFetch as unknown as Record<symbol, boolean>)[FETCH_WRAPPER_SYMBOL]) {
    return false;
  }
  
  window.__devPerfOriginalFetch = currentFetch;
  window.__devPerfInterceptorInstalled = true;
  
  const wrappedFetch = async function(...args: Parameters<typeof fetch>): Promise<Response> {
    const originalFetch = window.__devPerfOriginalFetch!;
    
    // Wrap ENTIRE interceptor logic in try/catch - if anything fails, just call original fetch
    try {
      let url: string | undefined;
      try {
        const input = args[0];
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof Request) {
          url = input.url;
        } else if (input instanceof URL) {
          url = input.toString();
        } else if (input && typeof input === 'object' && 'toString' in input) {
          url = String(input);
        }
      } catch {
        // URL extraction failed - just pass through to original fetch
        return originalFetch.apply(window, args);
      }
      
      // Skip non-API calls
      if (!url || typeof url !== 'string' || !url.includes('/api/')) {
        return originalFetch.apply(window, args);
      }

      const method = (args[1]?.method || 'GET').toUpperCase();
      const start = performance.now();
      
      try {
        const response = await originalFetch.apply(window, args);
        const duration = performance.now() - start;
        
        try {
          const endpoint = url.replace(/^https?:\/\/[^/]+/, '');
          addApiLatency({ endpoint, method, duration, status: response.status, timestamp: Date.now() });
        } catch {
          // Latency tracking failed - don't block the response
        }
        
        return response;
      } catch (error) {
        const duration = performance.now() - start;
        
        try {
          const endpoint = url.replace(/^https?:\/\/[^/]+/, '');
          addApiLatency({ endpoint, method, duration, status: 0, timestamp: Date.now() });
        } catch {
          // Latency tracking failed - don't block the error
        }
        
        throw error;
      }
    } catch (interceptorError) {
      // If ANY part of the interceptor fails, fall back to original fetch
      // This ensures the interceptor never breaks the application
      console.warn('[DevPerformanceOverlay] Fetch interceptor error, falling back:', interceptorError);
      return originalFetch.apply(window, args);
    }
  };
  
  (wrappedFetch as unknown as Record<symbol, boolean>)[FETCH_WRAPPER_SYMBOL] = true;
  window.fetch = wrappedFetch;
  return true;
}

export function uninstallFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  
  if (window.__devPerfOriginalFetch) {
    window.fetch = window.__devPerfOriginalFetch;
    window.__devPerfOriginalFetch = undefined;
    window.__devPerfInterceptorInstalled = false;
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    uninstallFetchInterceptor();
  });
}

export function DevPerformanceOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [apiLatencies, setApiLatencies] = useState<ApiLatency[]>([]);
  const [routeNavigations, setRouteNavigations] = useState<RouteNavigation[]>([]);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [renderCounts, setRenderCounts] = useState<Record<string, number>>({});
  const [location] = useLocation();
  const lastLocationRef = useRef(location);
  const navigationStartRef = useRef(performance.now());

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!isDev) return;
    
    installFetchInterceptor();
    
    const listener = (latencies: ApiLatency[]) => setApiLatencies(latencies);
    apiLatencyListeners.push(listener);
    
    setApiLatencies([...apiLatenciesRef.current]);
    
    return () => {
      apiLatencyListeners = apiLatencyListeners.filter(l => l !== listener);
    };
  }, [isDev]);

  useEffect(() => {
    if (lastLocationRef.current !== location) {
      const duration = performance.now() - navigationStartRef.current;
      
      setRouteNavigations(prev => {
        const updated = [
          { from: lastLocationRef.current, to: location, duration, timestamp: Date.now() },
          ...prev
        ].slice(0, ROUTE_HISTORY_LIMIT);
        return updated;
      });
      
      lastLocationRef.current = location;
    }
    navigationStartRef.current = performance.now();
  }, [location]);

  useEffect(() => {
    if (!isVisible) return;

    const updateMemory = () => {
      if (performance.memory) {
        setMemoryInfo({
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        });
      }
    };

    const updateRenderCounts = () => {
      const summary = getPerfSummary();
      setRenderCounts(summary.renderCounts);
    };

    updateMemory();
    updateRenderCounts();

    const interval = setInterval(() => {
      updateMemory();
      updateRenderCounts();
    }, 2000);

    return () => clearInterval(interval);
  }, [isVisible]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsVisible(prev => !prev);
        if (!isPerfDebugEnabled()) {
          setPerfDebug(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isDev) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getLatencyColor = (ms: number) => {
    if (ms < 100) return 'text-green-600 dark:text-green-400';
    if (ms < 300) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const avgApiLatency = apiLatencies.length > 0
    ? apiLatencies.reduce((sum, a) => sum + a.duration, 0) / apiLatencies.length
    : 0;

  const avgRouteTime = routeNavigations.length > 0
    ? routeNavigations.reduce((sum, r) => sum + r.duration, 0) / routeNavigations.length
    : 0;

  const topRenderCounts = Object.entries(renderCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsVisible(true)}
          className="opacity-50 hover:opacity-100 text-xs"
          data-testid="button-show-perf-overlay"
        >
          <Activity className="h-3 w-3 mr-1" />
          Perf
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 max-h-[80vh] overflow-hidden">
      <Card className="bg-background/95 backdrop-blur border shadow-lg">
        <div className="p-2 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Dev Performance</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="button-toggle-perf-expanded"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setIsVisible(false)}
              data-testid="button-close-perf-overlay"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Timer className="h-3 w-3" />
                  <span>Avg API</span>
                </div>
                <span className={`font-mono font-medium ${getLatencyColor(avgApiLatency)}`}>
                  {formatDuration(avgApiLatency)}
                </span>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <RefreshCw className="h-3 w-3" />
                  <span>Avg Route</span>
                </div>
                <span className={`font-mono font-medium ${getLatencyColor(avgRouteTime)}`}>
                  {formatDuration(avgRouteTime)}
                </span>
              </div>
            </div>

            {memoryInfo && (
              <div className="p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <MemoryStick className="h-3 w-3" />
                  <span>JS Heap Memory</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono">
                    {formatBytes(memoryInfo.usedJSHeapSize)} / {formatBytes(memoryInfo.totalJSHeapSize)}
                  </span>
                  <span className="text-muted-foreground">
                    ({Math.round((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100)}%)
                  </span>
                </div>
              </div>
            )}

            {topRenderCounts.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">Top Render Counts</div>
                <div className="space-y-1">
                  {topRenderCounts.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="truncate max-w-[180px]">{name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {apiLatencies.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">Recent API Calls</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {apiLatencies.slice(0, 8).map((api, i) => (
                    <div key={i} className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <Badge variant="outline" className="text-[10px] px-1 shrink-0">
                          {api.method}
                        </Badge>
                        <span className="truncate text-muted-foreground max-w-[120px]">
                          {api.endpoint.replace('/api/', '')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`font-mono ${getLatencyColor(api.duration)}`}>
                          {formatDuration(api.duration)}
                        </span>
                        <Badge 
                          variant={api.status >= 200 && api.status < 300 ? 'default' : 'destructive'}
                          className="text-[10px] px-1"
                        >
                          {api.status || 'ERR'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {routeNavigations.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1">Route Navigations</div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {routeNavigations.slice(0, 5).map((nav, i) => (
                    <div key={i} className="flex items-center justify-between gap-1">
                      <span className="truncate max-w-[180px] text-muted-foreground">
                        {nav.to}
                      </span>
                      <span className={`font-mono shrink-0 ${getLatencyColor(nav.duration)}`}>
                        {formatDuration(nav.duration)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t text-muted-foreground text-center">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+Shift+P</kbd> to toggle
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

```

