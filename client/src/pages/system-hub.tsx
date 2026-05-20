import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Settings, Activity, Shield, Building, Bell, CloudSun, Bot, Boxes, Share2 } from "lucide-react";

const ConfigurationHub = lazy(() => import("./configuration-hub"));

const systemItems: GridItem[] = [
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    description: "System admin",
    load: () => import("./system-administration"),
    loaderVariant: "cards",
    legacyRoutes: ["/system-administration"],
  },
  {
    id: "configuration",
    label: "Configuration",
    icon: Settings,
    description: "System settings",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ConfigurationHub embedded />
      </Suspense>
    ),
    legacyRoutes: ["/configuration"],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Alerts, preferences & templates",
    load: () => import("./notifications-hub"),
    loaderVariant: "form",
    legacyRoutes: [
      "/notifications",
      "/notification-settings",
      "/email-alerts-settings",
      "/email-templates",
    ],
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: Building,
    description: "Org management",
    load: () => import("./organization-management"),
    loaderVariant: "table",
    legacyRoutes: ["/organization-management"],
  },
  {
    id: "sensors",
    label: "Sensors",
    icon: Activity,
    description: "Sensors & templates",
    load: () => import("./sensors-hub"),
    loaderVariant: "cards",
    legacyRoutes: ["/sensors", "/sensor-templates"],
  },
  {
    id: "stormgeo",
    label: "StormGeo",
    icon: CloudSun,
    description: "Weather integration",
    load: () => import("./stormgeo-settings"),
    loaderVariant: "form",
    legacyRoutes: ["/stormgeo-settings"],
  },
  {
    id: "3d-models",
    label: "3D Models",
    icon: Boxes,
    description: "Vessel GLB uploads & equipment pins",
    load: () => import("./admin/3d-models"),
    loaderVariant: "cards",
    legacyRoutes: ["/admin/3d-models"],
  },
  {
    id: "equipment-dependencies",
    label: "Dependency Map",
    icon: Share2,
    description: "Blast-radius dependency edges",
    load: () => import("./admin/equipment-dependencies"),
    loaderVariant: "cards",
    legacyRoutes: ["/admin/equipment-dependencies"],
  },
  {
    id: "copilot",
    label: "AI Copilot",
    icon: Bot,
    description: "Copilot config & usage",
    load: () => import("./copilot-admin"),
    loaderVariant: "cards",
    legacyRoutes: ["/copilot-admin"],
  },
];

export default function SystemHub() {
  return (
    <IconGridLayout
      title="System"
      description="Configuration, sensors, administration, and integrations"
      items={systemItems}
      defaultItemId="configuration"
      baseRoute="/system"
    />
  );
}
