import { lazy } from "react";

const FleetHub = lazy(() => import("@/pages/fleet-hub"));
const VesselManagement = lazy(() => import("@/pages/vessel-management"));
const VesselDashboard = lazy(() => import("@/pages/vessel-dashboard"));
const Equipment = lazy(() => import("@/pages/equipment"));

export const fleetRoutes = [
  { path: "/fleet", component: FleetHub },
  { path: "/vessel-management", component: VesselManagement },
  { path: "/vessels/:id", component: VesselDashboard },
  { path: "/equipment", component: Equipment },
];
