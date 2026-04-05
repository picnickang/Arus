import { lazy } from "react";

const MaintenanceHub = lazy(() => import("@/pages/maintenance-hub"));
const WorkOrders = lazy(() => import("@/pages/work-orders"));
const MaintenanceSchedules = lazy(() => import("@/pages/maintenance-schedules"));
const MaintenanceTemplatesPage = lazy(() => import("@/pages/MaintenanceTemplatesPage"));
const PdmEquipmentDetail = lazy(() => import("@/pages/pdm-equipment-detail"));
const PdmSchedule = lazy(() => import("@/pages/pdm-schedule"));
const PdmPack = lazy(() => import("@/pages/pdm-pack"));
const PdmDashboard = lazy(() => import("@/pages/pdm-dashboard"));
const PdmPlatform = lazy(() => import("@/pages/pdm-platform"));
const DigitalTwin = lazy(() => import("@/pages/digital-twin"));

export const maintenanceRoutes = [
  { path: "/maint", component: MaintenanceHub },
  { path: "/work-orders", component: WorkOrders },
  { path: "/maintenance", component: MaintenanceSchedules },
  { path: "/maintenance-templates", component: MaintenanceTemplatesPage },
  { path: "/pdm/equipment/:equipmentId", component: PdmEquipmentDetail },
  { path: "/pdm/schedule", component: PdmSchedule },
  { path: "/pdm-pack", component: PdmPack },
  { path: "/pdm-dashboard", component: PdmDashboard },
  { path: "/pdm-platform", component: PdmPlatform },
  { path: "/digital-twin", component: DigitalTwin },
];
