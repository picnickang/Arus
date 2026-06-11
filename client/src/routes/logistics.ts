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

export const logisticsRoutes = [
  { path: "/logistics", component: LogisticsHub },
  // /inventory-management and /vendors intentionally unregistered:
  // routeMigrations sends them to /logistics?tab=…, which hosts the pages.
  { path: "/purchase-requests/:id", component: PRDetailPage },
  { path: "/service-orders", component: ServiceOrdersPage },
  { path: "/service-requests", component: ServiceRequestsPage },
  { path: "/optimization-tools", component: OptimizationTools },
];
