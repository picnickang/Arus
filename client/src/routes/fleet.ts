import { lazy } from "react";

const FleetHub = lazy(() => import("@/pages/fleet-hub"));
const VesselManagement = lazy(() => import("@/pages/vessel-management"));
const VesselDetail = lazy(() => import("@/pages/vessel-detail"));
const Equipment = lazy(() => import("@/pages/equipment"));

export const fleetRoutes = [
  { path: "/fleet", component: FleetHub },
  { path: "/vessel-management", component: VesselManagement },
  { path: "/vessels/:id", component: VesselDetail },
  { path: "/equipment", component: Equipment },
];
