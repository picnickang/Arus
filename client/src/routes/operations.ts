/**
 * Operations Route Module
 *
 * UX REFACTOR: Routes derived from navigationConfig, not duplicated in App.tsx.
 * Each category gets its own route module. App.tsx imports and spreads them.
 *
 * Pattern: export an array of { path, component } where component is lazy-loaded.
 * Hub pages use deferred loading (load function, not eager JSX).
 */

import { lazy } from "react";

// Hub page
const OperationsHub = lazy(() => import("@/pages/operations-hub"));

// Direct pages (accessible via hub or direct URL)
const Dashboard = lazy(() => import("@/pages/dashboard-improved"));
const ActiveTelemetry = lazy(() => import("@/pages/active-telemetry"));
const ActionableInsights = lazy(() => import("@/pages/actionable-insights"));

export const operationsRoutes = [
  // Hub
  { path: "/operations", component: OperationsHub },

  // Direct routes (also accessible within the hub)
  { path: "/dashboard", component: Dashboard },
  { path: "/active-telemetry", component: ActiveTelemetry },
  { path: "/actionable-insights", component: ActionableInsights },
];
