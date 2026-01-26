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
import { useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";

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
  // Setup global error handler on mount
  useEffect(() => {
    initializeGlobalErrorHandlers();
  }, []);

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
