/**
 * Logistics Hub
 *
 * Improvement #17: "Vendors" tab renamed to "Vendors & Providers" to make
 * it clear that service providers (used in Service Orders) live in the same
 * place as parts suppliers. The underlying VendorsPage already filters by
 * supplier type but the label gave no indication of this.
 */

import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Boxes, Wrench, Building2, ClipboardCheck } from "lucide-react";

const InventoryManagement  = lazy(() => import("./inventory-management"));
const PurchaseRequestsPage = lazy(() => import("@/features/purchaseRequests").then(m => ({ default: m.PurchaseRequestsPage })));
const ServiceOrdersPage    = lazy(() => import("@/features/serviceOrders").then(m => ({ default: m.ServiceOrdersPage })));
const VendorsPage          = lazy(() => import("@/features/suppliers").then(m => ({ default: m.VendorsPage })));

const logisticsItems: GridItem[] = [
  {
    id:          "inventory",
    label:       "Inventory",
    icon:        Boxes,
    description: "Stock levels",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <InventoryManagement />
      </Suspense>
    ),
    legacyRoutes: ["/inventory-management"],
  },
  {
    id:          "purchasing",
    label:       "Purchasing",
    icon:        ClipboardCheck,
    description: "Requests & orders",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <PurchaseRequestsPage />
      </Suspense>
    ),
    legacyRoutes: ["/purchase-requests", "/purchase-orders"],
  },
  {
    id:          "service-orders",
    label:       "Service Orders",
    icon:        Wrench,
    description: "External services",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <ServiceOrdersPage />
      </Suspense>
    ),
    legacyRoutes: ["/service-orders"],
  },
  {
    id:    "vendors",
    // Improvement #17: label updated — service providers live here too
    label: "Vendors & Providers",
    icon:  Building2,
    // Improvement #17: description clarifies both types are managed here
    description: "Suppliers & service providers",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        {/*
          VendorsPage should accept an optional defaultTypeFilter prop.
          If it does, pass nothing here so both types are shown by default.
          Users can filter by type inside the page.
        */}
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
