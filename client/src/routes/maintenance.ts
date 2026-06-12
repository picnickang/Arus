import { lazy } from "react";

const MaintenanceHub = lazy(() => import("@/pages/maintenance-hub"));
const WorkOrders = lazy(() => import("@/pages/work-orders"));
const MaintenanceSchedules = lazy(() => import("@/pages/maintenance-schedules"));
const MaintenanceTemplatesPage = lazy(() => import("@/pages/MaintenanceTemplatesPage"));
const PdmPlatform = lazy(() => import("@/pages/pdm-platform"));
const DigitalTwin = lazy(() => import("@/pages/digital-twin"));

export const maintenanceRoutes = [
  { path: "/maint", component: MaintenanceHub },
  { path: "/work-orders", component: WorkOrders },
  { path: "/maintenance", component: MaintenanceSchedules },
  { path: "/maintenance-templates", component: MaintenanceTemplatesPage },
  { path: "/pdm/equipment/:equipmentId", component: PdmPlatform },
  { path: "/pdm-platform", component: PdmPlatform },
  { path: "/digital-twin", component: DigitalTwin },
  { path: "/equipment/:equipmentId", component: PdmPlatform },
];
