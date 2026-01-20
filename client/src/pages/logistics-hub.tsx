import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Boxes, Wrench, Building, ClipboardCheck } from "lucide-react";

const InventoryManagement = lazy(() => import("./inventory-management"));
const PurchaseRequestsPage = lazy(() => import("@/features/purchaseRequests").then(m => ({ default: m.PurchaseRequestsPage })));
const ServiceOrdersPage = lazy(() => import("@/features/serviceOrders").then(m => ({ default: m.ServiceOrdersPage })));
const VendorsPage = lazy(() => import("@/features/suppliers").then(m => ({ default: m.VendorsPage })));

const logisticsItems: GridItem[] = [
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    description: "Stock levels",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <InventoryManagement />
      </Suspense>
    ),
    legacyRoutes: ["/inventory-management"],
  },
  {
    id: "purchasing",
    label: "Purchasing",
    icon: ClipboardCheck,
    description: "Requests & orders",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <PurchaseRequestsPage />
      </Suspense>
    ),
    legacyRoutes: ["/purchase-requests", "/purchase-orders"],
  },
  {
    id: "service-orders",
    label: "Service Orders",
    icon: Wrench,
    description: "External services",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <ServiceOrdersPage />
      </Suspense>
    ),
    legacyRoutes: ["/service-orders"],
  },
  {
    id: "vendors",
    label: "Vendors",
    icon: Building,
    description: "Suppliers & providers",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <VendorsPage />
      </Suspense>
    ),
    legacyRoutes: ["/vendors", "/suppliers", "/service-providers"],
  },
];

export default function LogisticsHub() {
  return (
    <IconGridLayout
      title="Logistics"
      description="Inventory, purchasing, service orders, and supplier management"
      items={logisticsItems}
      defaultItemId="inventory"
      baseRoute="/logistics"
    />
  );
}
