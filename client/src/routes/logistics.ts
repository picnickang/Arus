import { lazy } from "react";

const LogisticsHub = lazy(() => import("@/pages/logistics-hub"));
const InventoryManagement = lazy(() => import("@/pages/inventory-management"));
const VendorsPage = lazy(() => import("@/features/suppliers").then(m => ({ default: m.VendorsPage })));
const PRDetailPage = lazy(() => import("@/features/purchaseRequests").then(m => ({ default: m.PRDetailPage })));
const ServiceOrdersPage = lazy(() => import("@/features/serviceOrders").then(m => ({ default: m.ServiceOrdersPage })));
const ServiceRequestsPage = lazy(() => import("@/features/serviceRequests").then(m => ({ default: m.ServiceRequestsPage })));
const OptimizationTools = lazy(() => import("@/pages/optimization-tools"));

export const logisticsRoutes = [
  { path: "/logistics", component: LogisticsHub },
  { path: "/inventory-management", component: InventoryManagement },
  { path: "/vendors", component: VendorsPage },
  { path: "/purchase-requests/:id", component: PRDetailPage },
  { path: "/service-orders", component: ServiceOrdersPage },
  { path: "/service-requests", component: ServiceRequestsPage },
  { path: "/optimization-tools", component: OptimizationTools },
];
