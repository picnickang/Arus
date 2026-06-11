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
const AdminTenants = lazy(() => import("@/pages/admin/tenants"));
const Admin3DModels = lazy(() => import("@/pages/admin/3d-models"));
const AdminEquipmentDependencies = lazy(() => import("@/pages/admin/equipment-dependencies"));
const AdminTelemetryWarehouse = lazy(() => import("@/pages/admin/telemetry-warehouse"));
const AdminAccessDiagnostic = lazy(() => import("@/pages/admin/access-diagnostic"));

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
  // Standalone settings routes intentionally unregistered: routeMigrations
  // sends them into the hubs that host the same pages as tabs
  // (/configuration?tab=… and /notifications?tab=…); /permissions-settings
  // goes straight to the consolidated role manager in Crew.
  { path: "/admin/tenants", component: AdminTenants },
  { path: "/admin/3d-models", component: Admin3DModels },
  { path: "/admin/equipment-dependencies", component: AdminEquipmentDependencies },
  { path: "/admin/telemetry-warehouse", component: AdminTelemetryWarehouse },
  { path: "/admin/access-diagnostic", component: AdminAccessDiagnostic },
];
