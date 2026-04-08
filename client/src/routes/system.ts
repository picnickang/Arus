import { lazy } from "react";

const SystemHub = lazy(() => import("@/pages/system-hub"));
const ConfigurationHub = lazy(() => import("@/pages/configuration-hub"));
const SensorsHub = lazy(() => import("@/pages/sensors-hub"));
const NotificationsHub = lazy(() => import("@/pages/notifications-hub"));
const StormGeoSettings = lazy(() => import("@/pages/stormgeo-settings"));
const SensorTemplatesPage = lazy(() => import("@/pages/sensor-templates"));
const OrganizationManagement = lazy(() => import("@/pages/organization-management"));
const SystemAdministration = lazy(() => import("@/pages/system-administration"));
const Diagnostics = lazy(() => import("@/pages/DiagnosticsDashboard"));
const ManualTelemetryUpload = lazy(() => import("@/pages/manual-telemetry-upload"));
const CopilotAdmin = lazy(() => import("@/pages/copilot-admin"));
const AgentActivity = lazy(() => import("@/pages/agent-activity"));

export const systemRoutes = [
  { path: "/system", component: SystemHub },
  { path: "/configuration", component: ConfigurationHub },
  { path: "/sensors", component: SensorsHub },
  { path: "/notifications", component: NotificationsHub },
  { path: "/stormgeo-settings", component: StormGeoSettings },
  { path: "/sensor-templates", component: SensorTemplatesPage },
  { path: "/organization-management", component: OrganizationManagement },
  { path: "/system-administration", component: SystemAdministration },
  { path: "/diagnostics", component: Diagnostics },
  { path: "/telemetry-upload", component: ManualTelemetryUpload },
  { path: "/copilot-admin", component: CopilotAdmin },
  { path: "/agent/activity", component: AgentActivity },
];
