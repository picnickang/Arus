import { lazy } from "react";

const OperationsHub = lazy(() => import("@/pages/operations-hub"));
const Dashboard = lazy(() => import("@/pages/dashboard-improved"));

export const operationsRoutes = [
  { path: "/operations", component: OperationsHub },
  { path: "/dashboard", component: Dashboard },
];
