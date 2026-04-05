import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Boxes, Wrench, Building2 } from "lucide-react";

const logisticsItems: GridItem[] = [
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    description: "Stock levels & purchasing",
    load: () => import("./inventory-management"),
    loaderVariant: "table",
    legacyRoutes: ["/inventory-management"],
  },
  {
    id: "service-orders",
    label: "Service Orders",
    icon: Wrench,
    description: "External services",
    load: () => import("@/features/serviceOrders").then(m => ({ default: m.ServiceOrdersPage })),
    loaderVariant: "table",
    legacyRoutes: ["/service-orders"],
  },
  {
    id: "vendors",
    label: "Vendors & Providers",
    icon: Building2,
    description: "Suppliers & service providers",
    load: () => import("@/features/suppliers").then(m => ({ default: m.VendorsPage })),
    loaderVariant: "table",
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
