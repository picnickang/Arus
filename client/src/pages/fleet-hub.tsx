import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Ship, Server } from "lucide-react";

const fleetItems: GridItem[] = [
  {
    id: "vessels",
    label: "Vessels",
    icon: Ship,
    description: "Fleet overview and vessel details",
    load: () => import("./vessel-management"),
    loaderVariant: "table",
    legacyRoutes: ["/vessel-management", "/fleet-overview"],
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: Server,
    description: "Equipment registry and health",
    load: () => import("./equipment"),
    loaderVariant: "table",
    legacyRoutes: ["/equipment", "/equipment-registry", "/health-monitor"],
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
