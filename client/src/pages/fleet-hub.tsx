import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Ship, Server } from "lucide-react";

const VesselManagement = lazy(() => import("./vessel-management"));
const Equipment = lazy(() => import("./equipment"));

const fleetItems: GridItem[] = [
  {
    id: "vessels",
    label: "Vessels",
    icon: Ship,
    description: "Fleet overview and vessel details",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <VesselManagement />
      </Suspense>
    ),
    legacyRoutes: ["/vessel-management", "/fleet-overview"],
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: Server,
    description: "Equipment registry and health",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <Equipment />
      </Suspense>
    ),
    legacyRoutes: ["/equipment", "/health"],
  },
];

export default function FleetHub() {
  return (
    <IconGridLayout
      title="Fleet"
      description="Vessels and equipment management"
      items={fleetItems}
      defaultItemId="vessels"
      baseRoute="/fleet"
    />
  );
}
