import { lazy } from "react";

const LogisticsHub = lazy(() => import("@/pages/logistics-hub"));
const PRDetailPage = lazy(() =>
  import("@/features/purchaseRequests").then((m) => ({ default: m.PRDetailPage }))
);
const ServiceOrdersPage = lazy(() =>
  import("@/features/serviceOrders").then((m) => ({ default: m.ServiceOrdersPage }))
);
const ServiceRequestsPage = lazy(() =>
  import("@/features/serviceRequests").then((m) => ({ default: m.ServiceRequestsPage }))
);
const OptimizationTools = lazy(() => import("@/pages/optimization-tools"));

// NOTE: /inventory-management and /vendors are NOT registered here — their
// `routeMigrations` redirects (→ /logistics?tab=…) mount before these routes
// in App.tsx's <Switch>, so a registration here could never match
// (see docs/UI-CONSOLIDATION-AUDIT.md §2.1).
export const logisticsRoutes = [
  { path: "/logistics", component: LogisticsHub },
  { path: "/purchase-requests/:id", component: PRDetailPage },
  { path: "/service-orders", component: ServiceOrdersPage },
  { path: "/service-requests", component: ServiceRequestsPage },
  { path: "/optimization-tools", component: OptimizationTools },
];
