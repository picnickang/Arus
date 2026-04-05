import { lazy } from "react";

const FleetPage = lazy(() => import("@/pages/fleet-hub"));
const VesselDashboard = lazy(() => import("@/pages/vessel-dashboard"));

export const fleetRoutes = [
  { path: "/fleet", component: FleetPage },
  { path: "/vessels/:id", component: VesselDashboard },
];
