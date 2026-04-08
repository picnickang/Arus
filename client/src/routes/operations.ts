import { lazy } from "react";

const OperationsHub = lazy(() => import("@/pages/operations-hub"));
const Dashboard = lazy(() => import("@/pages/dashboard-improved"));
const Findings = lazy(() => import("@/pages/findings"));
const Briefing = lazy(() => import("@/pages/briefing"));

export const operationsRoutes = [
  { path: "/operations", component: OperationsHub },
  { path: "/dashboard", component: Dashboard },
  { path: "/findings", component: Findings },
  { path: "/briefing", component: Briefing },
];
